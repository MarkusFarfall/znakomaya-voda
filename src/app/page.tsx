import Game from "@/components/game/Game";
import { GameBoundary } from "@/components/game/Recovery";

export default function HomePage() {
  return <GameBoundary><Game /></GameBoundary>;
}
