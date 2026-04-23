import type { FishArtVariant } from "./Config.js";

const SPECIES_CENTERS_M = [50, 150, 250, 350, 500] as const;
const SPECIES_FALLOFF_M = 135;

export function pickFishArtVariant(depthM: number): FishArtVariant {
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < SPECIES_CENTERS_M.length; i++) {
    const distance = Math.abs(depthM - SPECIES_CENTERS_M[i]!);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = i;
    }
  }

  const minIndex = Math.max(0, nearestIndex - 1);
  const maxIndex = Math.min(SPECIES_CENTERS_M.length - 1, nearestIndex + 1);
  const weights = SPECIES_CENTERS_M.map((center, index) => {
    if (index < minIndex || index > maxIndex) return 0;
    return Math.max(0.001, 1 - Math.abs(depthM - center) / SPECIES_FALLOFF_M);
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * total;

  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return i as FishArtVariant;
  }

  return 0;
}
