import { CONFIG } from "./Config.js";
import { ECONOMY_TIERS } from "./FishEconomy.js";

export type FishHaulRow = {
  tierId: string;
  name: string;
  count: number;
  unitValue: number;
  lineTotal: number;
  accentHex: string;
};

export type FishHaulBreakdown = {
  rows: FishHaulRow[];
  subtotal: number;
  depthMult: number;
  fishPayout: number;
};

export function depthScoreMult(depthM: number): number {
  return 1 + Math.floor(Math.max(0, depthM - CONFIG.depthBonusStartM) * CONFIG.depthMultiplier);
}

export function buildFishHaulBreakdown(
  counts: Map<string, number>,
  maxDepthM: number,
  extraDepthMult = 0,
): FishHaulBreakdown {
  const rows: FishHaulRow[] = [];
  let subtotal = 0;
  for (const tier of ECONOMY_TIERS) {
    const count = counts.get(tier.id) ?? 0;
    if (count <= 0) continue;
    const lineTotal = count * tier.value;
    subtotal += lineTotal;
    rows.push({
      tierId: tier.id,
      name: tier.name,
      count,
      unitValue: tier.value,
      lineTotal,
      accentHex: tier.accentHex,
    });
  }
  const depthMult = depthScoreMult(maxDepthM) + Math.max(0, Math.floor(extraDepthMult));
  const fishPayout = Math.floor(subtotal * depthMult);
  return { rows, subtotal, depthMult, fishPayout };
}

export function haulSubtotalFromCounts(counts: Map<string, number>): number {
  let subtotal = 0;
  for (const tier of ECONOMY_TIERS) {
    subtotal += (counts.get(tier.id) ?? 0) * tier.value;
  }
  return subtotal;
}
