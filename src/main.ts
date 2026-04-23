import "./styles.css";
import { GameApp } from "./core/GameApp.js";
import { loadAssets } from "./platform/AssetLoader.js";
import { BrowserAudioController } from "./platform/BrowserAudioController.js";
import { BrowserGameLoop } from "./platform/BrowserGameLoop.js";
import { BrowserInputAdapter } from "./platform/BrowserInputAdapter.js";
import { loadPlayerProfile, savePlayerProfile } from "./platform/PlayerProfileStore.js";
import { createHudController } from "./platform/ui/elements.js";

async function bootstrap(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>("#game");
  if (!canvas) throw new Error("Missing #game canvas");

  const assets = await loadAssets();
  const profile = loadPlayerProfile();
  const { hud, startButton, retryButton, storeButtons } = createHudController();
  const input = new BrowserInputAdapter(canvas, startButton, retryButton, storeButtons);
  const audio = new BrowserAudioController();
  const game = new GameApp({
    initialCoins: profile.coins,
    initialLineLengthM: profile.lineLengthM,
    initialHasExtraLure: profile.hasExtraLure,
    initialHasGoldenReel: profile.hasGoldenReel,
    initialHasLuckCharm: profile.hasLuckCharm,
    initialHasCompletedFtue: profile.hasCompletedFtue,
    initialHasSeenChestTutorial: profile.hasSeenChestTutorial,
    initialHasSeenTrashTutorial: profile.hasSeenTrashTutorial,
    initialCollectionCounts: profile.collectionCounts,
    onProfileChange: savePlayerProfile,
  });
  const loop = new BrowserGameLoop(game, canvas, assets, input, hud, audio);
  loop.start();
}

void bootstrap();
