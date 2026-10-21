import type { CSSProperties } from "react";
import { badgeSpec, cardColor, cardLabel } from "../lib/banks";

export function Badge({ name, color, label }: { name: string; color: string; label?: string }) {
  const l = label || cardLabel(name);
  return <span className="fi" style={badgeSpec(color, l) as CSSProperties}>{l}</span>;
}
export const BankBadge = ({ name }: { name: string }) => <Badge name={name} color={cardColor(name)} />;
