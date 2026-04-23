import { AssetIds } from "../render/AssetIds.js";

const base = import.meta.env.BASE_URL; // "/" in dev, "/ridiculous-fishing-html5/" in prod

export const BrowserAssetManifest = {
  images: {
    [AssetIds.fishClassic]: `${base}assets/fish-sprite.png`,
    [AssetIds.fishSnapper]: `${base}assets/fish-snapper.png`,
    [AssetIds.fishAngler]: `${base}assets/fish-angler.png`,
    [AssetIds.fishJellyfish]: `${base}assets/fish-jellyfish.png`,
    [AssetIds.fishShark]: `${base}assets/fish-shark.png`,
    [AssetIds.fisherman]: `${base}assets/fisherman.png`,
    [AssetIds.bubble]: `${base}assets/bubble-1.png`,
    [AssetIds.tutorialHand]: `${base}assets/tutorial-hand.png`,
    [AssetIds.treasureChestLocked]: `${base}assets/chest-locked.png`,
    [AssetIds.treasureChestOpen]: `${base}assets/chest-open.png`,
    [AssetIds.trashBag]: `${base}assets/trash-bag.png`,
  },
} as const;
