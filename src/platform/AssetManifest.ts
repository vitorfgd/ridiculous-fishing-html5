import { AssetIds } from "../render/AssetIds.js";

export const BrowserAssetManifest = {
  images: {
    [AssetIds.fishClassic]: "/assets/fish-sprite.png",
    [AssetIds.fishSnapper]: "/assets/fish-snapper.png",
    [AssetIds.fishAngler]: "/assets/fish-angler.png",
    [AssetIds.fishJellyfish]: "/assets/fish-jellyfish.png",
    [AssetIds.fishShark]: "/assets/fish-shark.png",
    [AssetIds.fisherman]: "/assets/fisherman.png",
    [AssetIds.bubble]: "/assets/bubble-1.png",
    [AssetIds.tutorialHand]: "/assets/tutorial-hand.png",
    [AssetIds.treasureChestLocked]: "/assets/chest-locked.png",
    [AssetIds.treasureChestOpen]: "/assets/chest-open.png",
    [AssetIds.trashBag]: "/assets/trash-bag.png",
  },
} as const;
