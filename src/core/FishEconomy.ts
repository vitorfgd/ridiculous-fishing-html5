export type EconomyTierDef = {
  id: string;
  name: string;
  depthMinM: number;
  depthMaxM: number;
  value: number;
  accentHex: string;
  visualScale: number;
};

export const ECONOMY_TIERS: readonly EconomyTierDef[] = [
  {
    id: "sardine",
    name: "Sardine",
    depthMinM: 0,
    depthMaxM: 20,
    value: 250,
    accentHex: "#9ae0ff",
    visualScale: 0.9,
  },
  {
    id: "trout",
    name: "Trout",
    depthMinM: 20,
    depthMaxM: 50,
    value: 500,
    accentHex: "#ffd48a",
    visualScale: 1,
  },
  {
    id: "tuna",
    name: "Tuna",
    depthMinM: 50,
    depthMaxM: 1e6,
    value: 1000,
    accentHex: "#d4b8ff",
    visualScale: 1.1,
  },
] as const;

export function economyTierForSpawnDepthM(depthM: number): EconomyTierDef {
  for (const tier of ECONOMY_TIERS) {
    if (depthM >= tier.depthMinM && depthM < tier.depthMaxM) return tier;
  }
  return ECONOMY_TIERS[ECONOMY_TIERS.length - 1]!;
}

export function formatMoney(n: number): string {
  const v = Math.round(n);
  const abs = Math.abs(v).toLocaleString("en-US");
  return v < 0 ? `-$${abs}` : `$${abs}`;
}
