import type { PortId } from "@/game/types";

export const PORT_ACCENT: Record<PortId, string> = {
  home: "#d6b77d",
  nordhavn: "#9bcbd1",
  mirador: "#c6b3d8",
  coral: "#8ed3b3",
  southcross: "#b7d2ed",
};
export type HarborSymbol =
  | "market"
  | "shop"
  | "shipyard"
  | "tavern"
  | "orders"
  | "map"
  | "sea"
  | "crest";
const paths: Record<HarborSymbol, string> = {
  market:
    "M3 16h18l-2 5H5l-2-5Zm3 0V9m12 7V9M8 7c3-4 8-4 10 0-2 4-7 4-10 0Zm0 0L4 4v6l4-3Zm7-.1h.01",
  shop: "M4 21 17 3M7 17l3 2M9 13l3 2M17 3c5 5 5 10 2 12-3 2-6 0-5-2m3-10 3 3",
  shipyard: "M3 14h18l-4 5H7l-4-5Zm7 0V5h6v9M4 3h16M6 3v8m12-8v8M3 22h18",
  tavern: "M6 20V8l6-5 6 5v12M3 21h18M10 21v-6h4v6M9 9h6M9 12h6M10 3V1h4v2",
  orders:
    "M8 4H5v17h14V4h-3M8 2h8v4H8V2Zm0 8h.01M11 10h5M8 14h.01M11 14h5M8 18h.01M11 18h5",
  map: "m2 5 6-3 8 3 6-3v17l-6 3-8-3-6 3V5Zm6-3v17M16 5v17M10 10l4 4m-4 0 4-4",
  sea: "M3 19c3-3 3 3 6 0s3 3 6 0 3 3 6 0M3 23c3-3 3 3 6 0s3 3 6 0 3 3 6 0M12 2v14M12 3l8 10h-8M9 6 4 14h5",
  crest:
    "M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm0 4v14M7 11h10M3 13v4c0 5 9 5 9 5s9 0 9-5v-4M1 15l2-2 2 2m14 0 2-2 2 2",
};
export function HarborGlyph({
  kind,
  size = 24,
  className = "",
}: {
  kind: HarborSymbol;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={paths[kind]} />
    </svg>
  );
}
