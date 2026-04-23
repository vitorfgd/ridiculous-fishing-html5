import type { GameInputCommand } from "../render/RenderState.js";

export class BrowserInputAdapter {
  private commands: GameInputCommand[] = [];
  private readonly overlayTools = document.querySelector<HTMLDivElement>("#overlay-tools") ?? undefined;
  private readonly overlayStorePanel = document.querySelector<HTMLDivElement>("#overlay-store-panel") ?? undefined;
  private readonly overlayCollectionPanel = document.querySelector<HTMLDivElement>("#overlay-collection-panel") ?? undefined;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    startButton: HTMLButtonElement,
    retryButton: HTMLButtonElement,
    storeButtons: {
      buyLineButton: HTMLButtonElement;
      buyExtraLureButton: HTMLButtonElement;
      buyGoldenReelButton: HTMLButtonElement;
      buyLuckCharmButton: HTMLButtonElement;
    },
  ) {
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    this.overlayTools?.addEventListener("pointerdown", this.onUiPointerDown);
    this.overlayTools?.addEventListener("pointermove", this.onUiPointerMove);
    this.overlayTools?.addEventListener("pointerup", this.onUiPointerUp);
    this.overlayStorePanel?.addEventListener("pointerdown", this.onUiPointerDown);
    this.overlayStorePanel?.addEventListener("pointermove", this.onUiPointerMove);
    this.overlayStorePanel?.addEventListener("pointerup", this.onUiPointerUp);
    this.overlayCollectionPanel?.addEventListener("pointerdown", this.onUiPointerDown);
    this.overlayCollectionPanel?.addEventListener("pointermove", this.onUiPointerMove);
    this.overlayCollectionPanel?.addEventListener("pointerup", this.onUiPointerUp);
    startButton.addEventListener("pointerdown", this.onStartRun);
    retryButton.addEventListener("pointerdown", this.onRetryRun);
    storeButtons.buyLineButton.addEventListener("click", this.onBuyLineUpgrade);
    storeButtons.buyExtraLureButton.addEventListener("click", this.onBuyExtraLureUpgrade);
    storeButtons.buyGoldenReelButton.addEventListener("click", this.onBuyGoldenReelUpgrade);
    storeButtons.buyLuckCharmButton.addEventListener("click", this.onBuyLuckCharm);
  }

  drainCommands(): GameInputCommand[] {
    const next = this.commands;
    this.commands = [];
    return next;
  }

  dispose(): void {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.overlayTools?.removeEventListener("pointerdown", this.onUiPointerDown);
    this.overlayTools?.removeEventListener("pointermove", this.onUiPointerMove);
    this.overlayTools?.removeEventListener("pointerup", this.onUiPointerUp);
    this.overlayStorePanel?.removeEventListener("pointerdown", this.onUiPointerDown);
    this.overlayStorePanel?.removeEventListener("pointermove", this.onUiPointerMove);
    this.overlayStorePanel?.removeEventListener("pointerup", this.onUiPointerUp);
    this.overlayCollectionPanel?.removeEventListener("pointerdown", this.onUiPointerDown);
    this.overlayCollectionPanel?.removeEventListener("pointermove", this.onUiPointerMove);
    this.overlayCollectionPanel?.removeEventListener("pointerup", this.onUiPointerUp);
  }

  private onStartRun = (event: PointerEvent): void => {
    event.preventDefault();
    this.commands.push({ type: "startRun" });
  };

  private onRetryRun = (event: PointerEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    this.commands.push({ type: "retryRun" });
  };

  private onBuyLineUpgrade = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    this.commands.push({ type: "buyLineUpgrade" });
  };

  private onBuyExtraLureUpgrade = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    this.commands.push({ type: "buyExtraLureUpgrade" });
  };

  private onBuyGoldenReelUpgrade = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    this.commands.push({ type: "buyGoldenReelUpgrade" });
  };

  private onBuyLuckCharm = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    this.commands.push({ type: "buyLuckCharm" });
  };

  private onPointerDown = (event: PointerEvent): void => {
    const point = this.clientToLogicalPoint(event);
    this.canvas.setPointerCapture(event.pointerId);
    this.commands.push({ type: "pointerDown", ...point });
    this.commands.push({ type: "bonusTap", ...point });
    event.preventDefault();
  };

  private onPointerMove = (event: PointerEvent): void => {
    const point = this.clientToLogicalPoint(event);
    this.commands.push({ type: "pointerMove", ...point });
    event.preventDefault();
  };

  private onPointerUp = (event: PointerEvent): void => {
    const point = this.clientToLogicalPoint(event);
    this.commands.push({ type: "pointerUp", ...point });
    event.preventDefault();
  };

  private onUiPointerDown = (event: PointerEvent): void => {
    const point = this.clientToLogicalPoint(event);
    this.commands.push({ type: "pointerDown", ...point });
  };

  private onUiPointerMove = (event: PointerEvent): void => {
    const point = this.clientToLogicalPoint(event);
    this.commands.push({ type: "pointerMove", ...point });
  };

  private onUiPointerUp = (event: PointerEvent): void => {
    const point = this.clientToLogicalPoint(event);
    this.commands.push({ type: "pointerUp", ...point });
  };

  private clientToLogicalPoint(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 540,
      y: ((event.clientY - rect.top) / rect.height) * 960,
    };
  }
}
