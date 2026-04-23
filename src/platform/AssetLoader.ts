import type { AssetId } from "../render/AssetIds.js";
import { BrowserAssetManifest } from "./AssetManifest.js";

export type LoadedAssets = {
  images: Record<AssetId, HTMLImageElement>;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

export async function loadAssets(): Promise<LoadedAssets> {
  const images = {} as Record<AssetId, HTMLImageElement>;
  const entries = Object.entries(BrowserAssetManifest.images) as [AssetId, string][];
  await Promise.all(
    entries.map(async ([id, src]) => {
      images[id] = await loadImage(src);
    }),
  );
  return { images };
}
