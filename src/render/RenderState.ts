import type { CollectionCategoryId } from "../core/CollectionBook.js";
import type { FishArtVariant } from "../core/Config.js";
import type { FishHaulBreakdown } from "../core/Scoring.js";

export type AppStateView = "Ready" | "Playing" | "SurfacePayoff" | "BonusToss" | "Result";
export type PlayPhaseView = "Descent" | "Ascent";

export type GameInputCommand =
  | { type: "pointerDown"; x: number; y: number }
  | { type: "pointerMove"; x: number; y: number }
  | { type: "pointerUp"; x: number; y: number }
  | { type: "bonusTap"; x: number; y: number }
  | { type: "buyLineUpgrade" }
  | { type: "buyExtraLureUpgrade" }
  | { type: "buyGoldenReelUpgrade" }
  | { type: "buyLuckCharm" }
  | { type: "startRun" }
  | { type: "retryRun" };

export type GameEvent =
  | { type: "nearMiss"; x: number; y: number }
  | { type: "phaseChanged"; phase: PlayPhaseView }
  | { type: "fishCaught"; x: number; y: number; value: number; tierId: string; artVariant: FishArtVariant }
  | { type: "treasureChestCaught"; x: number; y: number }
  | { type: "trashBagCaught"; x: number; y: number; amount: number }
  | { type: "surfaceReached"; x: number; y: number }
  | { type: "bonusBanked"; x: number; y: number; amount: number }
  | { type: "bonusTapped"; x: number; y: number; amount: number; streak: number }
  | { type: "treasureChestOpened"; amount: number }
  | { type: "trashBagBurst"; x: number; y: number }
  | { type: "resultShown"; total: number; depthM: number; fishCaught: number };

export type FishState = "swim" | "snap" | "hooked" | "consumed";

export type FishSpriteState = {
  id: number;
  kind: "fish" | "treasureChest" | "trashBag";
  x: number;
  y: number;
  typeIndex: number;
  sizeScale: number;
  hitHalfW: number;
  hitHalfH: number;
  artVariant: FishArtVariant;
  faceRight: boolean;
  state: FishState;
  rotation: number;
  economyTierId: string;
  economyName: string;
  economyValue: number;
  accentHex: string;
  chestState?: "locked" | "open";
};

export type CaughtStackSpriteState = {
  kind: "fish" | "treasureChest" | "trashBag";
  typeIndex: number;
  artVariant: FishArtVariant;
  faceRight: boolean;
  sizeScale: number;
  offsetY: number;
  chestState?: "locked" | "open";
};

export type BonusFishSpriteState = {
  kind: "fish" | "treasureChest" | "trashBag";
  x: number;
  y: number;
  artVariant: FishArtVariant;
  faceRight: boolean;
  aboveWater: boolean;
  active: boolean;
  chestState?: "locked" | "open";
};

export type TreasureChestCinematicState = {
  active: boolean;
  progress: number;
  chestScale: number;
  shake: number;
  lightAlpha: number;
  opened: boolean;
  prizeText: string;
};

export type TrashSmudgeState = {
  active: boolean;
  x: number;
  y: number;
  scale: number;
  alpha: number;
  rotation: number;
};

export type BackgroundState = {
  surfaceY: number;
  depthUnits: number;
  bonusSkyCheer: number;
  time: number;
};

export type CameraState = {
  centerY: number;
  halfHeightScale: number;
  shake: number;
};

export type HudState = {
  depthText: string;
  phaseText: string;
  caughtText: string;
  haulText?: string;
  multText?: string;
  bonusText?: string;
  tutorialText?: string;
  tutorialCtaText?: string;
  toastText?: string;
  depthPulseCounter: number;
};

export type ResultScreenPayload = {
  haul: FishHaulBreakdown;
  bonusDollars: number;
  goldenReelBonusDollars: number;
  trashPenaltyDollars: number;
  trashBagCount: number;
  undiscoveredFishIds: string[];
  totalDollars: number;
  depthM: number;
  sequence: number;
};

export type CollectionBookEntryState = {
  id: string;
  category: CollectionCategoryId;
  name: string;
  hint: string;
  accentHex: string;
  discovered: boolean;
  count: number;
};

export type CollectionBookCategoryState = {
  id: CollectionCategoryId;
  label: string;
  entries: CollectionBookEntryState[];
};

export type CollectionBookState = {
  categories: CollectionBookCategoryState[];
};

export type TutorialOverlayState = {
  id: string;
  title: string;
  body: string;
  footer?: string;
  handHint?: "tap" | "drag-horizontal";
  accent: "cyan" | "yellow" | "orange";
  panel?: "store" | "collection";
};

export type TutorialHandState = {
  visible: boolean;
  x: number;
  y: number;
  rotationDeg: number;
  mode: "tapPulse" | "dragHorizontal" | "arcUnderLure" | "nudge" | "sweepHorizontal";
  anchor: "world" | "ui";
};

export type OverlayState = {
  mode: "ready" | "result" | null;
  profile: {
    coins: number;
    lineLengthM: number;
    nextLineUpgradeCost: number;
    canBuyLineUpgrade: boolean;
    hasExtraLure: boolean;
    nextExtraLureCost: number;
    canBuyExtraLure: boolean;
    hasGoldenReel: boolean;
    goldenReelCost: number;
    canBuyGoldenReel: boolean;
    hasLuckCharm: boolean;
    luckCharmCost: number;
    canBuyLuckCharm: boolean;
  };
  ready?: {
    coins: number;
    lineLengthM: number;
    nextLineUpgradeCost: number;
    canBuyLineUpgrade: boolean;
  };
  result?: ResultScreenPayload;
  tutorial?: TutorialOverlayState;
};

export type TextFloaterState = {
  text: string;
  x: number;
  y: number;
  alpha: number;
  scale: number;
  variant: "default" | "nearMiss" | "bonus" | "bonusHot";
};

export type BubbleState = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
};

export type ParticleState = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  color: string;
};

export type EffectsState = {
  bubbles: BubbleState[];
  particles: ParticleState[];
  floaters: TextFloaterState[];
};

export type RenderState = {
  logicalWidth: number;
  logicalHeight: number;
  appState: AppStateView;
  phase: PlayPhaseView;
  time: number;
  background: BackgroundState;
  camera: CameraState;
  hook: {
    x: number;
    y: number;
    radius: number;
    lineStartX: number;
    lineStartY: number;
    trail: { x: number; y: number }[];
    caughtSwing: number;
    caughtScale: number;
    caughtStack: CaughtStackSpriteState[];
  };
  fish: FishSpriteState[];
  bonusFish: BonusFishSpriteState[];
  treasureChestCinematic?: TreasureChestCinematicState;
  trashSmudge?: TrashSmudgeState;
  tutorialHand?: TutorialHandState;
  tutorialSpotlight?: { worldX: number; worldY: number; color: string };
  collectionBook: CollectionBookState;
  hud: HudState;
  overlay: OverlayState;
  effects: EffectsState;
};
