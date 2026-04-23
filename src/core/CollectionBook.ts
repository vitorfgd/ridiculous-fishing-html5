import type { FishArtVariant } from "./Config.js";
import type { CatchableKind, FishModel } from "./Types.js";

export type CollectionCategoryId = "fish" | "treasure" | "trash";

export type CollectionEntryDef = {
  id: string;
  category: CollectionCategoryId;
  name: string;
  accentHex: string;
  hint: string;
};

export type CollectionCounts = Record<string, number>;

export const FISH_COLLECTION_ENTRY_BY_VARIANT: Record<FishArtVariant, string> = {
  0: "classicFish",
  1: "snapper",
  2: "angler",
  3: "jellyfish",
  4: "shark",
};

export const COLLECTION_ENTRIES: readonly CollectionEntryDef[] = [
  {
    id: "classicFish",
    category: "fish",
    name: "Blue Fish",
    accentHex: "#9ae0ff",
    hint: "Most common in the first 100m",
  },
  {
    id: "snapper",
    category: "fish",
    name: "Snapper",
    accentHex: "#ffd48a",
    hint: "Starts showing up around 100m",
  },
  {
    id: "angler",
    category: "fish",
    name: "Angler",
    accentHex: "#d4b8ff",
    hint: "More common near 300m",
  },
  {
    id: "jellyfish",
    category: "fish",
    name: "Jellyfish",
    accentHex: "#ff9de6",
    hint: "Floats in the 400m depths",
  },
  {
    id: "shark",
    category: "fish",
    name: "Shark",
    accentHex: "#7bc3ff",
    hint: "Lurks past 500m",
  },
  {
    id: "treasureChest",
    category: "treasure",
    name: "Treasure Chest",
    accentHex: "#ffd86c",
    hint: "Rare bonus chest",
  },
  {
    id: "trashBag",
    category: "trash",
    name: "Trash Bag",
    accentHex: "#cda68d",
    hint: "Costs you money",
  },
] as const;

export const COLLECTION_CATEGORIES: readonly { id: CollectionCategoryId; label: string }[] = [
  { id: "fish", label: "Fish" },
  { id: "treasure", label: "Treasures" },
  { id: "trash", label: "Trash" },
] as const;

export function emptyCollectionCounts(): CollectionCounts {
  return {};
}

export function collectionEntryIdForFish(fish: FishModel): string {
  return collectionEntryIdForKind(fish.kind, fish);
}

export function collectionEntryIdForKind(
  kind: CatchableKind,
  fish?: Pick<FishModel, "artVariant">,
): string {
  if (kind === "fish") return FISH_COLLECTION_ENTRY_BY_VARIANT[fish?.artVariant ?? 0];
  if (kind === "treasureChest") return "treasureChest";
  return "trashBag";
}
