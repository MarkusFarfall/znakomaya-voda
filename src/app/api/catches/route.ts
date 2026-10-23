import { sql } from "drizzle-orm";
import { db } from "@/db";
import { catches, players } from "@/db/schema";
import { validateCatchPayload } from "@/lib/catchValidation";
import { checkPlayerAccess, isClean, rateLimit } from "@/lib/auth";
import { body, dbError, fail, json, sameOrigin } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("forbidden", 403);
  const limited = await rateLimit("catch", 40, 60_000);
  if (limited === null) return fail("Сервер временно недоступен", 503);
  if (!limited) return fail("slow down", 429);
  const b = await body<{ playerId?: string; fishId?: string; weight?: number; variant?: string | null; locationId?: string; gameDay?: number; cid?: string }>(req);
  if (!b?.playerId) return fail("bad payload");
  const valid = validateCatchPayload(b);
  if (!valid.ok) return fail(valid.error);
  const { fishId, weight, variant, locationId, gameDay } = valid.value;
  try {
    const acc = await checkPlayerAccess(b.playerId);
    if (!acc.ok) return fail(acc.error, acc.status);
    // Ключ улова приходит от клиента: уловы отправляются повторно при обрыве связи,
    // и повтор не должен задваивать строку в журнале — на это есть уникальный индекс catches_cid_uq.
    const cid = typeof b.cid === "string" && /^[A-Za-z0-9_-]{8,40}$/.test(b.cid) ? b.cid : null;
    await db.insert(catches).values({
      playerId: b.playerId,
      fishId,
      weight,
      variant,
      locationId,
      gameDay,
      cid,
    }).onConflictDoNothing();
    return json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}

// Мировые рекорды веса по каждому виду. `verified` зарезервировано для будущей
// серверной проверки события; привязка к аккаунту сама по себе её не заменяет.
export async function GET() {
  try {
    const rows = await db.execute(sql`
      select distinct on (c.fish_id) c.fish_id as "fishId", c.weight, c.variant, p.name,
        false as "verified", (p.user_id is not null) as "accountLinked"
      from ${catches} c join ${players} p on p.id = c.player_id
      order by c.fish_id, c.weight desc
    `);
    const records = (rows.rows as { name: string }[]).map((r) => ({ ...r, name: isClean(r.name) ? r.name : "Рыбак" }));
    return json({ records });
  } catch {
    return json({ records: [] }, 503);
  }
}
