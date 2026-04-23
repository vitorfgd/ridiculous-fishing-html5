import type { CollectionCounts } from "./CollectionBook.js";
import type { FishArtVariant } from "./Config.js";
import type {
  AppStateView,
  BonusFishSpriteState,
  GameInputCommand,
  GameEvent,
  OverlayState,
  PlayPhaseView,
} from "../render/RenderState.js";

export const AppState = {
  Ready: "Ready",
  Playing: "Playing",
  SurfacePayoff: "SurfacePayoff",
  BonusToss: "BonusToss",
  Result: "Result",
} as const;

export const PlayPhase = {
  Descent: "Descent",
  Ascent: "Ascent",
} as const;

export type AppState = (typeof AppState)[keyof typeof AppState];
export type PlayPhase = (typeof PlayPhase)[keyof typeof PlayPhase];
export type FishState = "swim" | "snap" | "hooked" | "consumed";
export type CatchableKind = "fish" | "treasureChest" | "trashBag";

export type FishModel = {
  id: number;
  kind: CatchableKind;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  alive: boolean;
  state: FishState;
  typeIndex: number;
  baseHitHalfW: number;
  baseHitHalfH: number;
  hitHalfW: number;
  hitHalfH: number;
  phase: number;
  sizeScale: number;
  faceRight: boolean;
  economyTierId: string;
  economyName: string;
  economyValue: number;
  accentHex: string;
  artVariant: FishArtVariant;
  chestState?: "locked" | "open";
  swimDir: -1 | 1;
  swimSpeed: number;
  hookedIndex?: number;
};

export type AirBonusFishModel = {
  kind: CatchableKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  artVariant: FishArtVariant;
  faceRight: boolean;
  launchTime: number;
  launched: boolean;
  justLaunched: boolean;
  missed: boolean;
  chestState?: "locked" | "open";
  prizeDollars?: number;
};

export type GameAppOptions = {
  logicalWidth?: number;
  logicalHeight?: number;
  createFishField?: () => FishModel[];
  initialCoins?: number;
  initialLineLengthM?: number;
  initialHasExtraLure?: boolean;
  initialHasGoldenReel?: boolean;
  initialHasLuckCharm?: boolean;
  initialHasCompletedFtue?: boolean;
  initialHasSeenChestTutorial?: boolean;
  initialHasSeenTrashTutorial?: boolean;
  initialCollectionCounts?: CollectionCounts;
  onProfileChange?: (profile: {
    coins: number;
    lineLengthM: number;
    hasExtraLure: boolean;
    hasGoldenReel: boolean;
    hasLuckCharm: boolean;
    hasCompletedFtue: boolean;
    hasSeenChestTutorial: boolean;
    hasSeenTrashTutorial: boolean;
    collectionCounts: CollectionCounts;
  }) => void;
};

export type GameAppDebugState = {
  appState: AppStateView;
  phase: PlayPhaseView;
  hookX: number;
  hookY: number;
  maxDepthUnits: number;
  fishCaught: number;
  coins: number;
  lineLengthM: number;
  hasExtraLure: boolean;
  hasGoldenReel: boolean;
  hasLuckCharm: boolean;
  hasCompletedFtue: boolean;
  hasSeenChestTutorial: boolean;
  hasSeenTrashTutorial: boolean;
  collectionCounts: CollectionCounts;
  bonusAccum: number;
  fish: FishModel[];
  bonusFish: BonusFishSpriteState[];
  overlay: OverlayState;
};

export type GameAppPublic = {
  update(dt: number, commands: GameInputCommand[]): void;
  getRenderState(): import("../render/RenderState.js").RenderState;
  drainEvents(): GameEvent[];
  reset(seed?: number): void;
  getDebugState(): GameAppDebugState;
};
