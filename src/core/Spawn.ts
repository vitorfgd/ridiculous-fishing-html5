import { CONFIG, FISH_TIERS, FISH_TYPES, type FishArtVariant } from "./Config.js";
import { pickFishArtVariant } from "./FishArt.js";
import { economyTierForSpawnDepthM } from "./FishEconomy.js";
import type { FishModel } from "./Types.js";

const MAX_FISH_SPAWN_DEPTH_M = FISH_TIERS[FISH_TIERS.length - 1]!.depthMax;

function placementDepthMForArt(rolledDepthM: number, _artVariant: FishArtVariant): number {
  return Math.min(rolledDepthM, MAX_FISH_SPAWN_DEPTH_M);
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function sizeScaleForSpawnDepth(depthM: number): number {
  const t = Math.max(0, Math.min(1, depthM / 560));
  const curved = Math.pow(t, 0.85);
  const shallowBoost = Math.max(0, 1 - depthM / 120) * 0.12;
  return Math.max(0.54, Math.min(0.84, 0.52 + curved * 0.26 + shallowBoost));
}

function swimSpeedForSpawnDepth(depthM: number): number {
  const t = Math.max(0, Math.min(1, depthM / 560));
  return 0.85 + t * 1.9;
}

function hitboxScaleForArt(artVariant: FishArtVariant): { w: number; h: number } {
  if (artVariant === 3) return { w: 0.62, h: 1.08 };
  if (artVariant === 4) return { w: 1.14, h: 0.82 };
  if (artVariant === 2) return { w: 0.92, h: 0.9 };
  return { w: 1, h: 1 };
}

function makeFishModel(input: {
  id: number;
  x: number;
  y: number;
  typeIndex: number;
  sizeScale: number;
  artVariant: FishArtVariant;
  faceRight: boolean;
  swimDir: -1 | 1;
  swimSpeed: number;
}): FishModel {
  const type = FISH_TYPES[input.typeIndex % FISH_TYPES.length]!;
  const economy = economyTierForSpawnDepthM(CONFIG.surfaceY - input.y);
  const hitboxScale = hitboxScaleForArt(input.artVariant);
  const hitHalfW = type.hitHalfW * input.sizeScale * hitboxScale.w;
  const hitHalfH = type.hitHalfH * input.sizeScale * hitboxScale.h;
  return {
    id: input.id,
    kind: "fish",
    x: input.x,
    y: input.y,
    baseX: input.x,
    baseY: input.y,
    alive: true,
    state: "swim",
    typeIndex: input.typeIndex,
    baseHitHalfW: hitHalfW,
    baseHitHalfH: hitHalfH,
    hitHalfW,
    hitHalfH,
    phase: Math.random() * Math.PI * 2,
    sizeScale: input.sizeScale * economy.visualScale,
    faceRight: input.faceRight,
    economyTierId: economy.id,
    economyName: economy.name,
    economyValue: economy.value,
    accentHex: economy.accentHex,
    artVariant: input.artVariant,
    swimDir: input.swimDir,
    swimSpeed: input.swimSpeed,
  };
}

function pushTreasureChest(fish: FishModel[], id: number, x: number, depthM: number): void {
  const y = CONFIG.surfaceY - depthM;
  const sizeScale = CONFIG.treasureChestUnderwaterSize;
  fish.push({
    id,
    kind: "treasureChest",
    x,
    y,
    baseX: x,
    baseY: y,
    alive: true,
    state: "swim",
    typeIndex: 0,
    baseHitHalfW: 0.78 * sizeScale,
    baseHitHalfH: 0.56 * sizeScale,
    hitHalfW: 0.78 * sizeScale,
    hitHalfH: 0.56 * sizeScale,
    phase: Math.random() * Math.PI * 2,
    sizeScale,
    faceRight: false,
    economyTierId: "treasureChest",
    economyName: "Treasure Chest",
    economyValue: 0,
    accentHex: "#ffd86c",
    artVariant: 0,
    chestState: "locked",
    swimDir: 1,
    swimSpeed: 0,
  });
}

function pushTrashBag(fish: FishModel[], id: number, x: number, depthM: number): void {
  const y = CONFIG.surfaceY - depthM;
  const sizeScale = CONFIG.trashBagUnderwaterSize;
  fish.push({
    id,
    kind: "trashBag",
    x,
    y,
    baseX: x,
    baseY: y,
    alive: true,
    state: "swim",
    typeIndex: 0,
    baseHitHalfW: 0.9 * sizeScale,
    baseHitHalfH: 0.68 * sizeScale,
    hitHalfW: 0.9 * sizeScale,
    hitHalfH: 0.68 * sizeScale,
    phase: Math.random() * Math.PI * 2,
    sizeScale,
    faceRight: false,
    economyTierId: "trashBag",
    economyName: "Trash Bag",
    economyValue: 0,
    accentHex: "#8c887f",
    artVariant: 0,
    swimDir: 1,
    swimSpeed: 0,
  });
}

function spawnBaseFish(): FishModel[] {
  const fish: FishModel[] = [];
  const placed: { x: number; y: number }[] = [];
  let spawnIdx = 0;
  let id = 1;

  for (const tier of FISH_TIERS) {
    const minSep2 = tier.minSep * tier.minSep;
    for (let n = 0; n < tier.count; n++) {
      const typeIndex = spawnIdx % FISH_TYPES.length;
      spawnIdx += 1;
      const faceRight = spawnIdx % 2 === 1;

      let x = 0;
      let y = 0;
      let rolledDepthM = tier.depthMin;
      let placementDepthM = rolledDepthM;
      let artVariant: FishArtVariant = 0;
      let ok = false;

      for (let attempt = 0; attempt < 120; attempt++) {
        x = CONFIG.hookMinX + 0.2 + Math.random() * (CONFIG.hookMaxX - CONFIG.hookMinX - 0.4);
        rolledDepthM = tier.depthMin + Math.random() * (tier.depthMax - tier.depthMin);
        artVariant = pickFishArtVariant(rolledDepthM);
        placementDepthM = placementDepthMForArt(rolledDepthM, artVariant);
        y = CONFIG.surfaceY - placementDepthM;
        ok = true;
        for (const p of placed) {
          if (dist2(x, y, p.x, p.y) < minSep2) {
            ok = false;
            break;
          }
        }
        if (ok) break;
      }

      const sizeScale = sizeScaleForSpawnDepth(placementDepthM);
      fish.push(
        makeFishModel({
          id: id++,
          x,
          y,
          typeIndex,
          sizeScale,
          artVariant,
          faceRight,
          swimDir: Math.random() > 0.5 ? 1 : -1,
          swimSpeed: swimSpeedForSpawnDepth(placementDepthM),
        }),
      );
      placed.push({ x, y });
    }
  }

  return fish;
}

function addSpecialSpawns(fish: FishModel[], treasureChestSpawnChance: number): void {
  let id = fish.reduce((max, entry) => Math.max(max, entry.id), 0) + 1;

  if (Math.random() <= treasureChestSpawnChance) {
    const depthM =
      CONFIG.treasureChestDepthMin +
      Math.random() * (CONFIG.treasureChestDepthMax - CONFIG.treasureChestDepthMin);
    pushTreasureChest(fish, id++, (Math.random() - 0.5) * 5.2, depthM);
  }

  for (const tier of FISH_TIERS) {
    if (Math.random() > CONFIG.trashBagTierSpawnChance) continue;
    const depthM = tier.depthMin + Math.random() * (tier.depthMax - tier.depthMin);
    pushTrashBag(fish, id++, (Math.random() - 0.5) * 5.8, depthM);
  }
}

export function createProgressiveRunField(
  treasureChestSpawnChance: number = CONFIG.treasureChestSpawnChance,
  _maxDepthM: number = FISH_TIERS[FISH_TIERS.length - 1]!.depthMax,
): { fish: FishModel[]; depthEvents: [] } {
  const fish = spawnBaseFish();
  addSpecialSpawns(fish, treasureChestSpawnChance);
  return { fish, depthEvents: [] };
}

export function createProgressiveFishField(
  treasureChestSpawnChance: number = CONFIG.treasureChestSpawnChance,
): FishModel[] {
  return createProgressiveRunField(treasureChestSpawnChance).fish;
}
