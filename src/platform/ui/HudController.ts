import { formatMoney } from "../../core/FishEconomy.js";
import type { CollectionCategoryId } from "../../core/CollectionBook.js";
import type { RenderState } from "../../render/RenderState.js";

type HudElements = {
  hudDepth: HTMLDivElement;
  hudMult: HTMLDivElement;
  hudPhase: HTMLDivElement;
  hudCaught: HTMLDivElement;
  hudDanger: HTMLDivElement;
  hudHaul: HTMLDivElement;
  hudBonus: HTMLDivElement;
  hudToast: HTMLDivElement;
  hudBottomCta: HTMLDivElement;
  overlayReady: HTMLDivElement;
  overlayResult: HTMLDivElement;
  overlayTutorial: HTMLDivElement;
  overlayTutorialCard: HTMLDivElement;
  overlayTutorialTitle: HTMLDivElement;
  overlayTutorialBody: HTMLDivElement;
  overlayTutorialHandWrap: HTMLDivElement;
  overlayTutorialHand: HTMLImageElement;
  overlayTutorialFooter: HTMLDivElement;
  overlayTools: HTMLDivElement;
  overlayStorePanel: HTMLDivElement;
  overlayCollectionPanel: HTMLDivElement;
  overlayStoreScroller: HTMLDivElement;
  overlayCollectionScroller: HTMLDivElement;
  openStoreButton: HTMLButtonElement;
  openCollectionButton: HTMLButtonElement;
  storeCoins: HTMLDivElement;
  lineUpgradeStatus: HTMLSpanElement;
  readyUpgradeCost: HTMLSpanElement;
  extraLureStatus: HTMLSpanElement;
  extraLureCost: HTMLSpanElement;
  buyExtraLureButton: HTMLButtonElement;
  goldenReelStatus: HTMLSpanElement;
  goldenReelCost: HTMLSpanElement;
  buyGoldenReelButton: HTMLButtonElement;
  luckCharmStatus: HTMLSpanElement;
  luckCharmCost: HTMLSpanElement;
  buyLuckCharmButton: HTMLButtonElement;
  buyLineButton: HTMLButtonElement;
  collectionTabFish: HTMLButtonElement;
  collectionTabTreasure: HTMLButtonElement;
  collectionTabTrash: HTMLButtonElement;
  collectionEntries: HTMLDivElement;
  resultHeading: HTMLHeadingElement;
  resultRows: HTMLDivElement;
  resultEmpty: HTMLParagraphElement;
  resultMeta: HTMLDivElement;
  resultBonusLine: HTMLDivElement;
  resultTotal: HTMLDivElement;
};

type BottomPanel = "store" | "collection" | null;

export class HudController {
  private lastDepthPulse = 0;
  private lastResultSequence = -1;
  private resultAnimRaf = 0;
  private activePanel: BottomPanel = null;
  private collectionTab: CollectionCategoryId = "fish";
  private latestCollectionBook?: RenderState["collectionBook"];
  private tutorialPanelLock: BottomPanel = null;
  private readonly suppressPanelClicks = new WeakMap<HTMLElement, number>();

  private readonly storeCoachmark = document.querySelector<HTMLDivElement>("#store-coachmark") ?? undefined;
  private readonly collectionCoachmark = document.querySelector<HTMLDivElement>("#collection-coachmark") ?? undefined;
  private static readonly STORE_SEEN_KEY = "rh-store-seen";
  private static readonly COLLECTION_SEEN_KEY = "rh-collection-seen";

  constructor(private readonly elements: HudElements) {
    this.elements.openStoreButton.addEventListener("pointerdown", this.toggleStorePanel);
    this.elements.openCollectionButton.addEventListener("pointerdown", this.toggleCollectionPanel);
    this.elements.collectionTabFish.addEventListener("click", this.selectFishTab);
    this.elements.collectionTabTreasure.addEventListener("click", this.selectTreasureTab);
    this.elements.collectionTabTrash.addEventListener("click", this.selectTrashTab);
    this.enableDragScroll(this.elements.overlayStoreScroller);
    this.enableDragScroll(this.elements.overlayCollectionScroller);

    document.querySelector<HTMLButtonElement>("#store-coachmark-ok")?.addEventListener("click", (e) => {
      e.stopPropagation();
      localStorage.setItem(HudController.STORE_SEEN_KEY, "1");
      this.storeCoachmark?.classList.add("hidden");
    });
    document.querySelector<HTMLButtonElement>("#collection-coachmark-ok")?.addEventListener("click", (e) => {
      e.stopPropagation();
      localStorage.setItem(HudController.COLLECTION_SEEN_KEY, "1");
      this.collectionCoachmark?.classList.add("hidden");
    });
  }

  sync(state: RenderState): void {
    const isBonusStage = state.appState === "BonusToss";
    const centerText =
      state.hud.tutorialText ??
      (state.appState === "BonusToss" ? state.hud.toastText : undefined);
    const showCenterPhase =
      state.appState === "Ready" ||
      state.appState === "Result" ||
      state.appState === "BonusToss" ||
      Boolean(state.overlay.tutorial);
    this.latestCollectionBook = state.collectionBook;

    this.elements.hudDepth.textContent = state.hud.depthText;
    this.elements.hudPhase.textContent = state.hud.phaseText;
    this.elements.hudCaught.textContent = state.hud.caughtText;
    this.elements.hudPhase.classList.toggle("hud-phase--bonus", isBonusStage);
    this.elements.hudBonus.classList.toggle("hud-bonus--bonus", isBonusStage);
    this.elements.hudToast.classList.toggle("hud-toast--bonus", isBonusStage);
    this.elements.hudPhase.classList.toggle("hidden", !showCenterPhase);

    this.elements.hudDanger.textContent = "";
    this.elements.hudDanger.classList.add("hidden");

    if (state.hud.haulText) {
      this.elements.hudHaul.textContent = state.hud.haulText;
      this.elements.hudHaul.classList.remove("hidden");
    } else {
      this.elements.hudHaul.textContent = "";
      this.elements.hudHaul.classList.add("hidden");
    }

    if (state.hud.multText) {
      this.elements.hudMult.textContent = state.hud.multText;
      this.elements.hudMult.classList.remove("hidden");
    } else {
      this.elements.hudMult.textContent = "";
      this.elements.hudMult.classList.add("hidden");
    }

    if (state.hud.bonusText) {
      this.elements.hudBonus.textContent = state.hud.bonusText;
      this.elements.hudBonus.classList.remove("hidden");
    } else {
      this.elements.hudBonus.textContent = "";
      this.elements.hudBonus.classList.add("hidden");
    }

    if (centerText) {
      this.elements.hudToast.textContent = centerText;
      this.elements.hudToast.classList.remove("hidden");
    } else {
      this.elements.hudToast.classList.add("hidden");
    }

    if (state.hud.tutorialCtaText) {
      this.elements.hudBottomCta.textContent = state.hud.tutorialCtaText;
      this.elements.hudBottomCta.classList.remove("hidden");
    } else {
      this.elements.hudBottomCta.classList.add("hidden");
    }

    if (state.hud.depthPulseCounter !== this.lastDepthPulse) {
      this.lastDepthPulse = state.hud.depthPulseCounter;
      this.elements.hudDepth.classList.remove("hud-depth--pulse");
      void this.elements.hudDepth.offsetWidth;
      this.elements.hudDepth.classList.add("hud-depth--pulse");
      window.setTimeout(() => this.elements.hudDepth.classList.remove("hud-depth--pulse"), 380);
    }

    this.elements.overlayReady.classList.toggle("hidden", state.overlay.mode !== "ready");
    this.elements.overlayResult.classList.toggle("hidden", state.overlay.mode !== "result");
    this.elements.overlayTutorial.classList.toggle("hidden", !state.overlay.tutorial);

    if (state.overlay.tutorial) {
      this.elements.overlayTutorialTitle.textContent = state.overlay.tutorial.title;
      this.elements.overlayTutorialBody.textContent = state.overlay.tutorial.body;
      this.elements.overlayTutorialHandWrap.dataset.hint = state.overlay.tutorial.handHint ?? "tap";
      this.elements.overlayTutorialHandWrap.classList.toggle("hidden", !state.overlay.tutorial.handHint);
      this.elements.overlayTutorialFooter.textContent = state.overlay.tutorial.footer ?? "";
      this.elements.overlayTutorialFooter.classList.toggle("hidden", !state.overlay.tutorial.footer);
      this.elements.overlayTutorialCard.dataset.accent = state.overlay.tutorial.accent;
      this.elements.overlayTutorial.dataset.panel = state.overlay.tutorial.panel ?? "";
      this.elements.overlayTutorialCard.dataset.panel = state.overlay.tutorial.panel ?? "";
      this.tutorialPanelLock = state.overlay.tutorial.panel ?? null;
    } else {
      this.elements.overlayTutorialCard.dataset.accent = "cyan";
      this.elements.overlayTutorial.dataset.panel = "";
      this.elements.overlayTutorialCard.dataset.panel = "";
      this.elements.overlayTutorialHandWrap.dataset.hint = "tap";
      this.elements.overlayTutorialHandWrap.classList.add("hidden");
      this.tutorialPanelLock = null;
    }

    const panelsAllowed =
      (state.overlay.mode === "ready" || state.overlay.mode === "result") &&
      !(state.overlay.mode === "ready" && state.tutorialHand?.visible);
    if (!panelsAllowed) {
      this.activePanel = null;
    }

    if (panelsAllowed && this.tutorialPanelLock) {
      this.activePanel = this.tutorialPanelLock;
    }

    this.elements.overlayTools.classList.toggle("hidden", !panelsAllowed);
    this.elements.overlayStorePanel.classList.toggle("hidden", !panelsAllowed || this.activePanel !== "store");
    this.elements.overlayCollectionPanel.classList.toggle("hidden", !panelsAllowed || this.activePanel !== "collection");
    this.elements.openStoreButton.classList.toggle("overlay-tool--active", this.activePanel === "store");
    this.elements.openCollectionButton.classList.toggle("overlay-tool--active", this.activePanel === "collection");

    this.elements.storeCoins.textContent = `COINS ${formatMoney(state.overlay.profile.coins)}`;
    this.elements.lineUpgradeStatus.textContent = `${state.overlay.profile.lineLengthM}M -> +25M`;
    this.elements.readyUpgradeCost.textContent = formatMoney(state.overlay.profile.nextLineUpgradeCost);
    this.elements.buyLineButton.disabled = !state.overlay.profile.canBuyLineUpgrade;
    this.elements.extraLureStatus.textContent = state.overlay.profile.hasExtraLure ? "READY" : "EMPTY";
    this.elements.extraLureCost.textContent = state.overlay.profile.hasExtraLure ? "STOCKED" : formatMoney(state.overlay.profile.nextExtraLureCost);
    this.elements.buyExtraLureButton.disabled = !state.overlay.profile.canBuyExtraLure;
    this.elements.goldenReelStatus.textContent = state.overlay.profile.hasGoldenReel ? "READY" : "EMPTY";
    this.elements.goldenReelCost.textContent = state.overlay.profile.hasGoldenReel ? "STOCKED" : formatMoney(state.overlay.profile.goldenReelCost);
    this.elements.buyGoldenReelButton.disabled = !state.overlay.profile.canBuyGoldenReel;
    this.elements.luckCharmStatus.textContent = state.overlay.profile.hasLuckCharm ? "ACTIVE" : "INACTIVE";
    this.elements.luckCharmCost.textContent = state.overlay.profile.hasLuckCharm ? "OWNED" : formatMoney(state.overlay.profile.luckCharmCost);
    this.elements.buyLuckCharmButton.disabled = !state.overlay.profile.canBuyLuckCharm;

    if (state.overlay.mode === "result" && state.overlay.result) {
      this.syncResult(state.overlay.result);
    }

    this.syncCollectionBook();
  }

  private syncResult(result: NonNullable<RenderState["overlay"]["result"]>): void {
    if (result.sequence === this.lastResultSequence) return;
    this.lastResultSequence = result.sequence;

    if (this.resultAnimRaf) {
      cancelAnimationFrame(this.resultAnimRaf);
      this.resultAnimRaf = 0;
    }

    this.elements.resultHeading.textContent = "CAUGHT!";
    this.elements.resultRows.innerHTML = "";
    this.elements.resultTotal.textContent = formatMoney(0);
    this.elements.resultTotal.classList.add("result-total--rolling");
    this.elements.resultTotal.classList.remove("result-total--pop");

    const hasRows =
      result.haul.rows.length > 0 ||
      result.trashPenaltyDollars > 0 ||
      result.undiscoveredFishIds.length > 0;
    this.elements.resultEmpty.classList.toggle("hidden", hasRows);

    for (const row of result.haul.rows) {
      const el = document.createElement("div");
      el.className = "result-row result-row--in";
      el.style.setProperty("--accent", row.accentHex);
      el.innerHTML =
        `<span class="result-row__name">${row.name.toUpperCase()}</span>` +
        `<span class="result-row__qty">x${row.count}</span>` +
        `<span class="result-row__amt">+${formatMoney(row.lineTotal)}</span>`;
      this.elements.resultRows.appendChild(el);
    }

    for (const _id of result.undiscoveredFishIds) {
      const el = document.createElement("div");
      el.className = "result-row result-row--ghost";
      el.innerHTML =
        `<span class="result-row__name">????</span>` +
        `<span class="result-row__qty">??</span>` +
        `<span class="result-row__amt">????</span>`;
      this.elements.resultRows.appendChild(el);
    }

    if (result.goldenReelBonusDollars > 0) {
      const el = document.createElement("div");
      el.className = "result-row result-row--in";
      el.style.setProperty("--accent", "#ffe27f");
      el.innerHTML =
        `<span class="result-row__name">GOLDEN REEL</span>` +
        `<span class="result-row__qty">BOOST</span>` +
        `<span class="result-row__amt">+${formatMoney(result.goldenReelBonusDollars)}</span>`;
      this.elements.resultRows.appendChild(el);
    }

    if (result.trashPenaltyDollars > 0) {
      const el = document.createElement("div");
      el.className = "result-row result-row--in";
      el.style.setProperty("--accent", "#cda68d");
      el.innerHTML =
        `<span class="result-row__name">TRASH BAG</span>` +
        `<span class="result-row__qty">x${result.trashBagCount}</span>` +
        `<span class="result-row__amt" style="color:#ff8c72">-${formatMoney(result.trashPenaltyDollars).replace(/^-/, "")}</span>`;
      this.elements.resultRows.appendChild(el);
    }

    const mult = result.haul.depthMult;
    this.elements.resultMeta.innerHTML =
      mult > 1
        ? `DEPTH <strong>${result.depthM.toFixed(0)} M</strong> - x${mult} MULTIPLIER -> <strong>${formatMoney(result.haul.fishPayout)}</strong>`
        : `DEPTH <strong>${result.depthM.toFixed(0)} M</strong> - PAYOUT <strong>${formatMoney(result.haul.fishPayout)}</strong>`;

    if (result.bonusDollars > 0) {
      this.elements.resultBonusLine.textContent = `TOSS BONUS +${formatMoney(result.bonusDollars)}`;
      this.elements.resultBonusLine.classList.remove("hidden");
    } else {
      this.elements.resultBonusLine.textContent = "";
      this.elements.resultBonusLine.classList.add("hidden");
    }

    const durationMs = 900;
    const start = performance.now();
    const endValue = result.totalDollars;
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      this.elements.resultTotal.textContent = formatMoney(Math.round(endValue * eased));
      if (t < 1) {
        this.resultAnimRaf = requestAnimationFrame(tick);
      } else {
        this.elements.resultTotal.textContent = formatMoney(endValue);
        this.elements.resultTotal.classList.remove("result-total--rolling");
        this.elements.resultTotal.classList.add("result-total--pop");
        window.setTimeout(() => this.elements.resultTotal.classList.remove("result-total--pop"), 420);
      }
    };
    this.resultAnimRaf = requestAnimationFrame(tick);
  }

  private syncCollectionBook(): void {
    this.elements.collectionTabFish.classList.toggle("collection-tab--active", this.collectionTab === "fish");
    this.elements.collectionTabTreasure.classList.toggle("collection-tab--active", this.collectionTab === "treasure");
    this.elements.collectionTabTrash.classList.toggle("collection-tab--active", this.collectionTab === "trash");

    const category = this.latestCollectionBook?.categories.find((entry) => entry.id === this.collectionTab);
    if (!category) {
      this.elements.collectionEntries.innerHTML = "";
      return;
    }

    this.elements.collectionEntries.innerHTML = "";
    for (const entry of category.entries) {
      const row = document.createElement("div");
      row.className = `collection-entry${entry.discovered ? "" : " collection-entry--locked"}`;
      row.style.setProperty("--accent", entry.accentHex);
      row.innerHTML =
        `<div class="collection-entry__main">` +
        `<div class="collection-entry__name">${entry.discovered ? entry.name.toUpperCase() : "????"}</div>` +
        `<div class="collection-entry__hint">${entry.discovered ? entry.hint : "Not discovered yet"}</div>` +
        `</div>` +
        `<div class="collection-entry__count">${entry.discovered ? `x${entry.count}` : "--"}</div>`;
      this.elements.collectionEntries.appendChild(row);
    }
  }

  private toggleStorePanel = (event: PointerEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    this.activePanel = this.activePanel === "store" ? null : "store";
    if (this.activePanel === "store") {
      this.elements.overlayStoreScroller.scrollTop = 0;
      if (!localStorage.getItem(HudController.STORE_SEEN_KEY)) {
        this.storeCoachmark?.classList.remove("hidden");
      }
    }
    this.elements.overlayStorePanel.classList.toggle("hidden", this.activePanel !== "store");
    this.elements.overlayCollectionPanel.classList.add("hidden");
    this.elements.openStoreButton.classList.toggle("overlay-tool--active", this.activePanel === "store");
    this.elements.openCollectionButton.classList.remove("overlay-tool--active");
  };

  private toggleCollectionPanel = (event: PointerEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    this.activePanel = this.activePanel === "collection" ? null : "collection";
    if (this.activePanel === "collection") {
      this.elements.overlayCollectionScroller.scrollTop = 0;
      if (!localStorage.getItem(HudController.COLLECTION_SEEN_KEY)) {
        this.collectionCoachmark?.classList.remove("hidden");
      }
    }
    this.elements.overlayCollectionPanel.classList.toggle("hidden", this.activePanel !== "collection");
    this.elements.overlayStorePanel.classList.add("hidden");
    this.elements.openCollectionButton.classList.toggle("overlay-tool--active", this.activePanel === "collection");
    this.elements.openStoreButton.classList.remove("overlay-tool--active");
    this.syncCollectionBook();
  };

  private selectFishTab = (event: Event): void => {
    event.preventDefault();
    this.collectionTab = "fish";
    this.syncCollectionBook();
  };

  private selectTreasureTab = (event: Event): void => {
    event.preventDefault();
    this.collectionTab = "treasure";
    this.syncCollectionBook();
  };

  private selectTrashTab = (event: Event): void => {
    event.preventDefault();
    this.collectionTab = "trash";
    this.syncCollectionBook();
  };

  private enableDragScroll(element: HTMLDivElement): void {
    const dragThresholdPx = 8;
    let drag:
      | {
          pointerId: number;
          startY: number;
          startScrollTop: number;
          dragging: boolean;
        }
      | undefined;

    element.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      drag = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startScrollTop: element.scrollTop,
        dragging: false,
      };
      element.setPointerCapture(event.pointerId);
    });

    element.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const deltaY = event.clientY - drag.startY;
      if (!drag.dragging && Math.abs(deltaY) >= dragThresholdPx) {
        drag.dragging = true;
        element.classList.add("sheet-card--dragging");
      }
      if (!drag.dragging) return;
      element.scrollTop = drag.startScrollTop - deltaY;
      event.preventDefault();
    });

    const finishDrag = (event: PointerEvent): void => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (drag.dragging) {
        this.suppressPanelClicks.set(element, performance.now() + 180);
      }
      if (element.hasPointerCapture(event.pointerId)) {
        element.releasePointerCapture(event.pointerId);
      }
      element.classList.remove("sheet-card--dragging");
      drag = undefined;
    };

    element.addEventListener("pointerup", finishDrag);
    element.addEventListener("pointercancel", finishDrag);
    element.addEventListener("lostpointercapture", () => {
      element.classList.remove("sheet-card--dragging");
      drag = undefined;
    });

    element.addEventListener(
      "click",
      (event) => {
        const suppressUntil = this.suppressPanelClicks.get(element) ?? 0;
        if (performance.now() <= suppressUntil) {
          event.preventDefault();
          event.stopPropagation();
          this.suppressPanelClicks.delete(element);
        }
      },
      true,
    );
  }
}
