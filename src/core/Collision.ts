import type { FishModel } from "./Types.js";

export function pointToAabbDistSq(
  cx: number,
  cy: number,
  fx: number,
  fy: number,
  halfW: number,
  halfH: number,
): number {
  const nx = Math.max(fx - halfW, Math.min(cx, fx + halfW));
  const ny = Math.max(fy - halfH, Math.min(cy, fy + halfH));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy;
}

export function circleHitsAabb(
  cx: number,
  cy: number,
  radius: number,
  fx: number,
  fy: number,
  halfW: number,
  halfH: number,
): boolean {
  return pointToAabbDistSq(cx, cy, fx, fy, halfW, halfH) < radius * radius;
}

export function findFirstFishHit(
  cx: number,
  cy: number,
  radius: number,
  fish: FishModel[],
): FishModel | null {
  for (const f of fish) {
    if (!f.alive || f.state !== "swim") continue;
    if (circleHitsAabb(cx, cy, radius, f.x, f.y, f.hitHalfW, f.hitHalfH)) {
      return f;
    }
  }
  return null;
}
