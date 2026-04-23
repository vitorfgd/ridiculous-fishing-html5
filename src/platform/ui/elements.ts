import { HudController } from "./HudController.js";

export function createHudController(): {
  hud: HudController;
  startButton: HTMLButtonElement;
  retryButton: HTMLButtonElement;
  storeButtons: {
    buyLineButton: HTMLButtonElement;
    buyExtraLureButton: HTMLButtonElement;
    buyGoldenReelButton: HTMLButtonElement;
    buyLuckCharmButton: HTMLButtonElement;
  };
} {
  const startButton = document.querySelector<HTMLButtonElement>("#overlay-start");
  const retryButton = document.querySelector<HTMLButtonElement>("#result-retry");
  const buyLineButton = document.querySelector<HTMLButtonElement>("#ready-upgrade-line");
  const buyExtraLureButton = document.querySelector<HTMLButtonElement>("#ready-upgrade-extra-lure");
  const buyGoldenReelButton = document.querySelector<HTMLButtonElement>("#ready-upgrade-golden-reel");
  const buyLuckCharmButton = document.querySelector<HTMLButtonElement>("#ready-buy-luck-charm");
  const overlayTools = document.querySelector<HTMLDivElement>("#overlay-tools");
  const overlayStorePanel = document.querySelector<HTMLDivElement>("#overlay-store-panel");
  const overlayCollectionPanel = document.querySelector<HTMLDivElement>("#overlay-collection-panel");
  const overlayStoreScroller = overlayStorePanel?.querySelector<HTMLDivElement>(".sheet-card");
  const overlayCollectionScroller = overlayCollectionPanel?.querySelector<HTMLDivElement>(".sheet-card");
  const openStoreButton = document.querySelector<HTMLButtonElement>("#overlay-open-store");
  const openCollectionButton = document.querySelector<HTMLButtonElement>("#overlay-open-collection");
  const collectionTabFish = document.querySelector<HTMLButtonElement>("#collection-tab-fish");
  const collectionTabTreasure = document.querySelector<HTMLButtonElement>("#collection-tab-treasure");
  const collectionTabTrash = document.querySelector<HTMLButtonElement>("#collection-tab-trash");
  const collectionEntries = document.querySelector<HTMLDivElement>("#collection-entries");
  const hudDepth = document.querySelector<HTMLDivElement>("#hud-depth");
  const hudMult = document.querySelector<HTMLDivElement>("#hud-mult");
  const hudPhase = document.querySelector<HTMLDivElement>("#hud-phase");
  const hudCaught = document.querySelector<HTMLDivElement>("#hud-caught");
  const hudDanger = document.querySelector<HTMLDivElement>("#hud-danger");
  const hudHaul = document.querySelector<HTMLDivElement>("#hud-haul");
  const hudBonus = document.querySelector<HTMLDivElement>("#hud-bonus");
  const hudToast = document.querySelector<HTMLDivElement>("#hud-toast");
  const hudBottomCta = document.querySelector<HTMLDivElement>("#hud-cta-bottom");
  const overlayReady = document.querySelector<HTMLDivElement>("#overlay-ready");
  const overlayResult = document.querySelector<HTMLDivElement>("#overlay-result");
  const overlayTutorial = document.querySelector<HTMLDivElement>("#overlay-tutorial");
  const overlayTutorialCard = document.querySelector<HTMLDivElement>("#overlay-tutorial-card");
  const overlayTutorialTitle = document.querySelector<HTMLDivElement>("#overlay-tutorial-title");
  const overlayTutorialBody = document.querySelector<HTMLDivElement>("#overlay-tutorial-body");
  const overlayTutorialHandWrap = document.querySelector<HTMLDivElement>("#overlay-tutorial-hand-wrap");
  const overlayTutorialHand = document.querySelector<HTMLImageElement>("#overlay-tutorial-hand");
  const overlayTutorialFooter = document.querySelector<HTMLDivElement>("#overlay-tutorial-footer");
  const storeCoins = document.querySelector<HTMLDivElement>("#store-coins");
  const lineUpgradeStatus = document.querySelector<HTMLSpanElement>("#ready-upgrade-line-status");
  const readyUpgradeCost = document.querySelector<HTMLSpanElement>("#ready-upgrade-cost");
  const extraLureStatus = document.querySelector<HTMLSpanElement>("#ready-upgrade-extra-lure-status");
  const extraLureCost = document.querySelector<HTMLSpanElement>("#ready-upgrade-extra-lure-cost");
  const goldenReelStatus = document.querySelector<HTMLSpanElement>("#ready-upgrade-golden-reel-status");
  const goldenReelCost = document.querySelector<HTMLSpanElement>("#ready-upgrade-golden-reel-cost");
  const luckCharmStatus = document.querySelector<HTMLSpanElement>("#ready-buy-luck-charm-status");
  const luckCharmCost = document.querySelector<HTMLSpanElement>("#ready-buy-luck-charm-cost");
  const resultHeading = document.querySelector<HTMLHeadingElement>("#result-heading");
  const resultRows = document.querySelector<HTMLDivElement>("#result-rows");
  const resultEmpty = document.querySelector<HTMLParagraphElement>("#result-empty");
  const resultMeta = document.querySelector<HTMLDivElement>("#result-meta");
  const resultBonusLine = document.querySelector<HTMLDivElement>("#result-bonus-line");
  const resultTotal = document.querySelector<HTMLDivElement>("#result-total");

  if (
    !startButton ||
    !retryButton ||
    !buyLineButton ||
    !buyExtraLureButton ||
    !buyGoldenReelButton ||
    !buyLuckCharmButton ||
    !overlayTools ||
    !overlayStorePanel ||
    !overlayCollectionPanel ||
    !overlayStoreScroller ||
    !overlayCollectionScroller ||
    !openStoreButton ||
    !openCollectionButton ||
    !collectionTabFish ||
    !collectionTabTreasure ||
    !collectionTabTrash ||
    !collectionEntries ||
    !hudDepth ||
    !hudMult ||
    !hudPhase ||
    !hudCaught ||
    !hudDanger ||
    !hudHaul ||
    !hudBonus ||
    !hudToast ||
    !hudBottomCta ||
    !overlayReady ||
    !overlayResult ||
    !overlayTutorial ||
    !overlayTutorialCard ||
    !overlayTutorialTitle ||
    !overlayTutorialBody ||
    !overlayTutorialHandWrap ||
    !overlayTutorialHand ||
    !overlayTutorialFooter ||
    !storeCoins ||
    !lineUpgradeStatus ||
    !readyUpgradeCost ||
    !extraLureStatus ||
    !extraLureCost ||
    !goldenReelStatus ||
    !goldenReelCost ||
    !luckCharmStatus ||
    !luckCharmCost ||
    !resultHeading ||
    !resultRows ||
    !resultEmpty ||
    !resultMeta ||
    !resultBonusLine ||
    !resultTotal
  ) {
    throw new Error("Missing HUD elements");
  }

  return {
    hud: new HudController({
      hudDepth,
      hudMult,
      hudPhase,
      hudCaught,
      hudDanger,
      hudHaul,
      hudBonus,
      hudToast,
      hudBottomCta,
      overlayReady,
      overlayResult,
      overlayTutorial,
      overlayTutorialCard,
      overlayTutorialTitle,
      overlayTutorialBody,
      overlayTutorialHandWrap,
      overlayTutorialHand,
      overlayTutorialFooter,
      overlayTools,
      overlayStorePanel,
      overlayCollectionPanel,
      overlayStoreScroller,
      overlayCollectionScroller,
      openStoreButton,
      openCollectionButton,
      storeCoins,
      lineUpgradeStatus,
      readyUpgradeCost,
      buyLineButton,
      extraLureStatus,
      extraLureCost,
      buyExtraLureButton,
      goldenReelStatus,
      goldenReelCost,
      buyGoldenReelButton,
      luckCharmStatus,
      luckCharmCost,
      buyLuckCharmButton,
      collectionTabFish,
      collectionTabTreasure,
      collectionTabTrash,
      collectionEntries,
      resultHeading,
      resultRows,
      resultEmpty,
      resultMeta,
      resultBonusLine,
      resultTotal,
    }),
    startButton,
    retryButton,
    storeButtons: {
      buyLineButton,
      buyExtraLureButton,
      buyGoldenReelButton,
      buyLuckCharmButton,
    },
  };
}
