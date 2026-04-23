import type { GameApp } from "../core/GameApp.js";
import type { BrowserAudioController } from "./BrowserAudioController.js";
import { Canvas2DRenderer } from "../render/Canvas2DRenderer.js";
import { EffectsController } from "../render/EffectsController.js";
import { renderFrame } from "../render/renderFrame.js";
import type { LoadedAssets } from "./AssetLoader.js";
import { BrowserInputAdapter } from "./BrowserInputAdapter.js";
import { HudController } from "./ui/HudController.js";

export class BrowserGameLoop {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly renderer: Canvas2DRenderer;
  private readonly effects = new EffectsController();
  private lastTime = 0;

  constructor(
    private readonly game: GameApp,
    private readonly canvas: HTMLCanvasElement,
    assets: LoadedAssets,
    private readonly input: BrowserInputAdapter,
    private readonly hud: HudController,
    private readonly audio: BrowserAudioController,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context is unavailable");
    this.ctx = ctx;
    this.renderer = new Canvas2DRenderer(ctx, assets, 540, 960);
    this.resize();
    window.addEventListener("resize", this.resize);
  }

  start(): void {
    requestAnimationFrame(this.tick);
  }

  dispose(): void {
    window.removeEventListener("resize", this.resize);
    this.input.dispose();
    this.audio.dispose();
  }

  private resize = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = 540 * dpr;
    this.canvas.height = 960 * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
  };

  private tick = (timeMs: number): void => {
    const dt = this.lastTime === 0 ? 0 : Math.min((timeMs - this.lastTime) / 1000, 1 / 30);
    this.lastTime = timeMs;

    const commands = this.input.drainCommands();
    this.game.update(dt, commands);
    const events = this.game.drainEvents();
    const baseState = this.game.getRenderState();
    this.effects.consumeGameEvents(events);
    this.effects.update(dt, baseState);
    const state = {
      ...baseState,
      effects: this.effects.getState(),
    };

    this.audio.sync(state);
    this.audio.update(dt);
    renderFrame(this.renderer, state);
    this.hud.sync(state);

    requestAnimationFrame(this.tick);
  };
}
