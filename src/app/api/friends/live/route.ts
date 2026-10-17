import { and, desc, eq, gt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { friendPresence, friendships, players, users } from "@/db/schema";
import { FRIEND_PRESENCE_TTL_MS, normalizeFriendPresenceUpdate, type LiveFriendPresence } from "@/game/friends";
import { checkPlayerAccess, rateLimit } from "@/lib/auth";
import { body, dbError, fail, json, sameOrigin } from "@/lib/http";

export const dynamic = "force-dynamic";
const PRESENCE_TTL_SECONDS = FRIEND_PRESENCE_TTL_MS / 1000;
const MAX_FRIENDS = 50;

/** Симметричное соединение с принятым другом. Заявки не дают доступ к позиции. */
const otherFriend = (me: string) =>
  sql`${users.id} = case when ${friendships.aUserId} = ${me} then ${friendships.bUserId} else ${friendships.aUserId} end`;

async function friendsInSameLocation(userId: string, location: string): Promise<LiveFriendPresence[]> {
  const rows = await db
    .select({
      userId: users.id,
      username: users.username,
      location: friendPresence.location,
      x: friendPresence.x,
      heading: friendPresence.heading,
      velocity: friendPresence.velocity,
      boat: friendPresence.boat,
      activity: friendPresence.activity,
      updatedAt: friendPresence.updatedAt,
    })
    .from(friendships)
    .innerJoin(users, otherFriend(userId))
    .innerJoin(players, eq(players.userId, users.id))
    .innerJoin(friendPresence, eq(friendPresence.playerId, players.id))
    .where(and(
      or(eq(friendships.aUserId, userId), eq(friendships.bUserId, userId)),
      eq(friendships.status, "accepted"),
      eq(friendPresence.location, location),
      eq(players.hideLocation, false),
      gt(friendPresence.updatedAt, sql`now() - ${PRESENCE_TTL_SECONDS} * interval '1 second'`),
    ))
    .orderBy(desc(friendPresence.updatedAt))
    .limit(MAX_FRIENDS);
  return rows.map((row) => ({
    userId: row.userId,
    username: row.username,
    location: row.location as LiveFriendPresence["location"],
    x: row.x,
    heading: row.heading === -1 ? -1 : 1,
    velocity: row.velocity,
    boat: row.boat,
    activity: row.activity as LiveFriendPresence["activity"],
    updatedAt: row.updatedAt.toISOString(),
  }));
}


/**
 * Heartbeat позиции и ответ со снимком экипажа в той же акватории.
 * Координаты живут отдельно от saves, исчезают по TTL и доступны только
 * принятым друзьям, которые сами сейчас находятся в этой акватории.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("forbidden", 403);
  const payload = await body<{
    playerId?: string;
    sessionId?: string;
    active?: boolean;
    presence?: unknown;
  }>(req);
  if (!payload || typeof payload.playerId !== "string" || typeof payload.sessionId !== "string" || !/^[a-zA-Z0-9-]{16,64}$/.test(payload.sessionId)) return fail("Некорректный запрос");

  try {
    const access = await checkPlayerAccess(payload.playerId);
    if (!access.ok) return fail(access.error, access.status);
    const limited = await rateLimit("friends-live", 50, 60_000, access.userId);
    if (limited === null) return fail("Сервер временно недоступен", 503);
    if (!limited) return fail("Слишком часто обновляется позиция", 429);

    if (payload.active !== true) {
      const profile = await db
        .select({ hideLocation: players.hideLocation })
        .from(players)
        .where(eq(players.id, payload.playerId))
        .limit(1);
      // A privacy change is global across tabs; a normal stop only releases its own lease.
      if (profile[0]?.hideLocation) {
        await db.delete(friendPresence).where(eq(friendPresence.playerId, payload.playerId));
      } else {
        await db.delete(friendPresence).where(and(
          eq(friendPresence.playerId, payload.playerId),
          eq(friendPresence.sessionId, payload.sessionId),
        ));
      }
      return json({ friends: [] as LiveFriendPresence[], serverNow: new Date().toISOString() });
    }

    const position = normalizeFriendPresenceUpdate(payload.presence);
    if (!position) return fail("Некорректная позиция игрока");
    const profile = await db
      .select({ hideLocation: players.hideLocation })
      .from(players)
      .where(eq(players.id, payload.playerId))
      .limit(1);
    if (!profile[0] || profile[0].hideLocation) {
      await db.delete(friendPresence).where(eq(friendPresence.playerId, payload.playerId));
      return json({ friends: [] as LiveFriendPresence[], serverNow: new Date().toISOString() });
    }

    await db
      .insert(friendPresence)
      .values({ playerId: payload.playerId, sessionId: payload.sessionId, ...position })
      .onConflictDoUpdate({
        target: friendPresence.playerId,
        set: { sessionId: payload.sessionId, ...position, updatedAt: sql`now()` },
      });

    return json({ friends: await friendsInSameLocation(access.userId, position.location), serverNow: new Date().toISOString() });
  } catch (error) {
    return dbError(error);
  }
}
