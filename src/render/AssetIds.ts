export const AssetIds = {
  fishClassic: "fishClassic",
  fishSnapper: "fishSnapper",
  fishAngler: "fishAngler",
  fishJellyfish: "fishJellyfish",
  fishShark: "fishShark",
  fisherman: "fisherman",
  bubble: "bubble",
  tutorialHand: "tutorialHand",
  treasureChestLocked: "treasureChestLocked",
  treasureChestOpen: "treasureChestOpen",
  trashBag: "trashBag",
} as const;

export type AssetId = (typeof AssetIds)[keyof typeof AssetIds];
