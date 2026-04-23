import {
  COLLECTION_CATEGORIES,
  COLLECTION_ENTRIES,
  collectionEntryIdForFish,
  emptyCollectionCounts,
  type CollectionCounts,
} from "./CollectionBook.js";
import { circleHitsAabb, findFirstFishHit, pointToAabbDistSq } from "./Collision.js";
import { CONFIG, type FishArtVariant } from "./Config.js";
import { formatMoney } from "./FishEconomy.js";
import { logicalToWorldX, worldToLogicalPoint } from "./Projection.js";
import {
  buildFishHaulBreakdown,
  depthScoreMult,
  haulSubtotalFromCounts,
} from "./Scoring.js";
import { createProgressiveFishField } from "./Spawn.js";
import type { RenderState } from "../render/RenderState.js";
import type {
  AirBonusFishModel,
  AppState,
  CatchableKind,
  FishModel,
  GameAppDebugState,
  GameAppOptions,
  GameAppPublic,
  PlayPhase,
} from "./Types.js";
import { AppState as AppStateValues, PlayPhase as PlayPhaseValues } from "./Types.js";

type CaughtBonusItem = {
  kind: CatchableKind;
  typeIndex: number;
  sizeScale: number;
  artVariant: FishArtVariant;
  faceRight: boolean;
  chestState?: "locked" | "open";
  prizeDollars?: number;
};

type TreasureChestRevealState = {
  elapsed: number;
  opened: boolean;
  awarded: boolean;
  prizeDollars: number;
  durationSec: number;
  awardAtSec: number;
};

type FtueStep =
  | "readyInvite"
  | "fishDodgeReveal"
  | "dragTeach"
  | "chestReveal"
  | "ascentTeach"
  | "trashReveal"
  | "bonusTeach"
  | "storeCoachmark";

export class GameApp implements GameAppPublic {
  private readonly logicalWidth: number;
  private readonly logicalHeight: number;
  private readonly createFishField: () => FishModel[];
  private readonly onProfileChange?: (profile: {
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

  private appState: AppState = AppStateValues.Ready;
  private phase: PlayPhase = PlayPhaseValues.Descent;
  private coins: number;
  private lineLengthM: number;
  private hasExtraLure: boolean;
  private hasGoldenReel: boolean;
  private hasLuckCharm: boolean;
  private hasCompletedFtue: boolean;
  private hasSeenChestTutorial: boolean;
  private hasSeenTrashTutorial: boolean;
  private collectionCounts: CollectionCounts;
  private time = 0;
  private maxDepthUnits = 0;
  private fishCaught = 0;
  private trashBagCount = 0;
  private snapperCaughtCount = 0;
  private chestsOpenedThisRun = 0;
  private caughtByTier = new Map<string, number>();
  private trashPenaltyDollars = 0;
  private caughtBonusItems: CaughtBonusItem[] = [];
  private hookX = 0;
  private hookY = CONFIG.surfaceY - 0.6;
  private pointerTargetX = 0;
  private steerX = 0;
  private shake = 0;
  private camFollowY = CONFIG.surfaceY + CONFIG.cameraIdleBias;
  private camImpulseY = 0;
  private prevHookY = CONFIG.surfaceY - 0.6;
  private hudDisplayDepth = 0;
  private lastDepthMilestoneBand = 0;
  private nearMissCooldown = 0;
  private surfacePayoffT = 0;
  private toastText?: string;
  private toastRemaining = 0;
  private depthPulseCounter = 0;
  private catchBounce = 0;
  private trail: { x: number; y: number }[] = [];

  private lastRunScore = 0;
  private lastRunMult = 1;
  private lastRunFish = 0;
  private lastRunDepth = 0;
  private lastResultPayload?: RenderState["overlay"]["result"];
  private resultSequence = 0;

  private bonusAccum = 0;
  private bonusPhaseElapsed = 0;
  private airBonusFish: AirBonusFishModel[] = [];
  private bonusOrthoZoom = 1;
  private bonusHitShake = 0;
  private bonusTapStreak = 0;
  private bonusSkyCheer = 0;
  private treasureChestReveal?: TreasureChestRevealState;
  private lineLimitPauseRemaining = 0;
  private extraLureCharges = 0;
  private runGoldenReelActive = false;
  private runLuckCharmActive = false;
  private ftueMode: "off" | "run" | "teach" | "store" = "off";
  private ftueStep?: FtueStep;
  private ftueText?: string;
  private ftueTextRemaining = 0;
  private ftueAwaitingTap = false;
  private ftueSlowMoRemaining = 0;
  private ftueSlowMoDuration = 0;
  private ftueSkipBonusTap = false;
  private ftueFishDodgeShown = false;
  private ftueTrashShown = false;
  private ftueChestShown = false;
  private ftueAscentShown = false;
  private ftueBonusShown = false;
  private ftueMaxDepthShown = false;
  private ftueRevealTargetY?: number;
  private ftueSpotlightX?: number;
  private ftueSpotlightY?: number;
  private ftueSpotlightColor?: string;

  private fish: FishModel[] = [];
  private events: import("../render/RenderState.js").GameEvent[] = [];

  constructor(options: GameAppOptions = {}) {
    this.logicalWidth = options.logicalWidth ?? CONFIG.logicalWidth;
    this.logicalHeight = options.logicalHeight ?? CONFIG.logicalHeight;
    this.createFishField = options.createFishField ?? (() => createProgressiveFishField(this.currentTreasureChestSpawnChance()));
    this.onProfileChange = options.onProfileChange;
    this.coins = Math.max(0, Math.floor(options.initialCoins ?? 0));
    this.lineLengthM = Math.max(
      CONFIG.lineLengthDefaultM,
      Math.floor(options.initialLineLengthM ?? CONFIG.lineLengthDefaultM),
    );
    this.hasExtraLure = Boolean(options.initialHasExtraLure);
    this.hasGoldenReel = Boolean(options.initialHasGoldenReel);
    this.hasLuckCharm = Boolean(options.initialHasLuckCharm);
    this.hasCompletedFtue = options.initialHasCompletedFtue ?? true;
    this.hasSeenChestTutorial = Boolean(options.initialHasSeenChestTutorial);
    this.hasSeenTrashTutorial = Boolean(options.initialHasSeenTrashTutorial);
    this.collectionCounts = { ...(options.initialCollectionCounts ?? emptyCollectionCounts()) };
    this.reset();
  }

  reset(_seed?: number): void {
    this.appState = AppStateValues.Ready;
    this.phase = PlayPhaseValues.Descent;
    this.ftueMode = this.hasCompletedFtue ? "off" : "run";
    this.lastRunScore = 0;
    this.lastRunMult = 1;
    this.lastRunFish = 0;
    this.lastRunDepth = 0;
    this.lastResultPayload = undefined;
    this.resultSequence = 0;
    this.resetRunState();
    if (!this.hasCompletedFtue) {
      this.beginFtueRun();
    }
  }

  private isGameplayTutorialMode(): boolean {
    return this.ftueMode === "run" || this.ftueMode === "teach";
  }

  private isTutorialPauseActive(): boolean {
    return Boolean(this.isGameplayTutorialMode() && this.ftueStep && (this.ftueAwaitingTap || this.ftueSlowMoRemaining > 0));
  }

  private clearGameplayTutorialStep(): void {
    const wasChestReveal = this.ftueStep === "chestReveal";
    this.ftueAwaitingTap = false;
    this.ftueSlowMoRemaining = 0;
    this.ftueSlowMoDuration = 0;
    this.ftueStep = undefined;
    this.ftueRevealTargetY = undefined;
    if (!wasChestReveal) {
      // For chest reveal keep the spotlight visible so the player can find the chest
      this.ftueSpotlightX = undefined;
      this.ftueSpotlightY = undefined;
      this.ftueSpotlightColor = undefined;
    }
    this.ftueTextRemaining = Math.min(this.ftueTextRemaining, 0.95);
    if (this.ftueMode === "teach") {
      this.ftueMode = "off";
    }
  }

  private activateFtueAscent(): void {
    const ftueChest = this.findFtueFishById(9007);
    const ftueTrash = this.findFtueFishById(9004);
    if (ftueChest) { ftueChest.alive = true; ftueChest.state = "swim"; }
    if (ftueTrash) { ftueTrash.alive = true; ftueTrash.state = "swim"; }
    this.ftueStep = "ascentTeach";
    this.ftueAscentShown = true;
    this.ftueRevealTargetY = undefined;
    this.ftueSpotlightX = undefined;
    this.ftueSpotlightY = undefined;
    this.ftueSpotlightColor = undefined;
  }

  update(dt: number, commands: import("../render/RenderState.js").GameInputCommand[]): void {
    this.ftueSkipBonusTap = false;
    this.handleCommands(commands);

    this.time += dt;
    this.camImpulseY *= Math.exp(-dt * 4.8);
    this.toastRemaining = Math.max(0, this.toastRemaining - dt);
    this.ftueTextRemaining = Math.max(0, this.ftueTextRemaining - dt);
    if (this.toastRemaining <= 0) this.toastText = undefined;
    if (this.ftueTextRemaining <= 0) this.ftueText = undefined;
    this.shake = Math.max(0, this.shake - CONFIG.shakeDecay * dt);

    if (this.appState === AppStateValues.Ready || this.appState === AppStateValues.Result) {
      this.updateCameraFollow(dt);
      this.updateHookVisuals(dt, false);
      return;
    }

    if (this.isTutorialPauseActive()) {
      this.consumeFtueTimeScale(dt);
      this.updateHookVisuals(dt * 0.03, false);
      this.updateCameraFollow(dt);
      if (this.appState === AppStateValues.Playing || this.appState === AppStateValues.SurfacePayoff) {
        this.updateHudDepth(dt);
      }
      this.prevHookY = this.hookY;
      return;
    }

    if (this.isGameplayTutorialMode() && this.ftueAwaitingTap) {
      this.updateHookVisuals(dt * 0.04, false);
      this.updateCameraFollow(dt);
      if (this.appState === AppStateValues.Playing) {
        this.updateHudDepth(dt);
      }
      this.prevHookY = this.hookY;
      return;
    }

    const ftueTimeScale = this.consumeFtueTimeScale(dt);

    if (this.appState === AppStateValues.SurfacePayoff) {
      this.surfacePayoffT -= dt * ftueTimeScale;
      this.updateHookVisuals(dt * ftueTimeScale, false);
      this.updateCameraFollow(dt);
      this.hudDisplayDepth = this.lerpExp(this.hudDisplayDepth, this.maxDepthUnits, CONFIG.hudDepthLerp, dt);
      if (this.surfacePayoffT <= 0) {
        this.beginBonusTossAtSurface();
      }
      this.prevHookY = this.hookY;
      return;
    }

    if (this.appState === AppStateValues.BonusToss) {
      this.bonusHitShake *= Math.exp(-(dt * ftueTimeScale) * CONFIG.bonusHitShakeDecay);
      this.bonusSkyCheer = Math.min(
        1,
        this.bonusSkyCheer + (dt * ftueTimeScale) / Math.max(0.08, CONFIG.bonusSkyCheerRampSec),
      );

      if (this.treasureChestReveal) {
        this.updateTreasureChestReveal(dt * ftueTimeScale);
      } else {
        this.bonusPhaseElapsed += dt * ftueTimeScale;
        const sloMoDt = dt * ftueTimeScale * CONFIG.bonusTimeScale;
        this.updateBonusZoom(dt);
        this.updateBonusFish(sloMoDt);
        this.updateHookVisuals(sloMoDt, false);
      }
      this.updateCameraFollow(dt);
      if (this.isBonusComplete()) {
        this.goResult();
      }
      this.prevHookY = this.hookY;
      return;
    }

    if (this.lineLimitPauseRemaining > 0) {
      this.lineLimitPauseRemaining = Math.max(0, this.lineLimitPauseRemaining - dt);
      this.updateHookVisuals(dt * 0.08, false);
      this.updateCameraFollow(dt);
      this.updateHudDepth(dt);
      if (this.lineLimitPauseRemaining <= 0) {
        this.phase = PlayPhaseValues.Ascent;
        this.emit({ type: "phaseChanged", phase: "Ascent" });
        this.shake = Math.max(this.shake, CONFIG.shakeHitDescent);
      }
      this.prevHookY = this.hookY;
      return;
    }

    const descending = this.phase === PlayPhaseValues.Descent;
    const simDt = dt * ftueTimeScale;
    this.updateSwimmingFish(simDt);
    if (descending) {
      const preStepDepth = Math.max(0, CONFIG.surfaceY - this.hookY);
      const remainingLine = Math.max(0, this.lineLengthM - preStepDepth);
      const descentBoost =
        1 +
        Math.min(
          CONFIG.descentDepthSpeedMaxBoost,
          (preStepDepth / Math.max(1, CONFIG.descentDepthSpeedRampDepth)) * CONFIG.descentDepthSpeedMaxBoost,
        );
      const lineEndSlowMul =
        remainingLine <= CONFIG.lineLengthSlowBandM
          ? Math.max(
              0.08,
              0.2 + 0.8 * Math.pow(remainingLine / Math.max(0.001, CONFIG.lineLengthSlowBandM), 1.85),
            )
          : 1;
      this.hookY -= CONFIG.descentSpeed * descentBoost * lineEndSlowMul * simDt;
      const depthNow = CONFIG.surfaceY - this.hookY;
      if (depthNow >= this.lineLengthM) {
        this.hookY = CONFIG.surfaceY - this.lineLengthM;
        this.maxDepthUnits = Math.max(this.maxDepthUnits, this.lineLengthM);
        this.triggerLineLengthReached();
        this.prevHookY = this.hookY;
        return;
      }
        const limitedDepthNow = CONFIG.surfaceY - this.hookY;
        this.maxDepthUnits = Math.max(this.maxDepthUnits, limitedDepthNow);
        this.updateFtueDescentBeats(limitedDepthNow);
        const hit = findFirstFishHit(this.hookX, this.hookY, CONFIG.hookRadius, this.fish);
        if (hit) {
          if (hit.kind === "fish" && this.extraLureCharges > 0) {
            this.consumeExtraLure(hit);
            this.prevHookY = this.hookY;
            return;
          }
          const wasDescending = this.phase === PlayPhaseValues.Descent;
          this.catchTarget(hit);
        this.phase = PlayPhaseValues.Ascent;
        if (wasDescending) {
          this.emit({ type: "phaseChanged", phase: "Ascent" });
        }
        this.shake = Math.max(this.shake, CONFIG.shakeHitDescent);
        if (this.ftueMode === "run" && hit.kind === "treasureChest" && !this.ftueAscentShown) {
          this.activateFtueAscent();
        }
      }
      } else {
        this.hookY += CONFIG.ascentSpeed * simDt;
        const ascentDepthNow = Math.max(0, CONFIG.surfaceY - this.hookY);
        this.updateFtueAscentBeats(ascentDepthNow);
        this.collectAscentFish();
      this.updateSnapFish(simDt);
      if (this.prevHookY < CONFIG.surfaceY - 0.12 && this.hookY >= CONFIG.surfaceY - 0.14) {
        this.camImpulseY += 0.38;
      }
      if (this.hookY >= CONFIG.surfaceY - 0.15) {
        this.hookY = CONFIG.surfaceY - 0.15;
        this.shake = Math.max(this.shake, CONFIG.shakeSurface);
        this.emit({ type: "surfaceReached", x: this.hookX, y: CONFIG.surfaceY });
        if (this.fishCaught <= 0) {
          this.goResult();
        } else {
          this.surfacePayoffT = CONFIG.surfacePayoffSec;
          this.appState = AppStateValues.SurfacePayoff;
          this.camImpulseY += 0.58;
          this.setToast("Surface!", 0.65);
        }
      }
    }

    if (this.appState !== AppStateValues.Playing) {
      this.prevHookY = this.hookY;
      return;
    }

    this.updateHookVisuals(simDt, descending);
    this.updateCameraFollow(dt);
    this.updateNearMiss(dt, descending);
    this.updateHudDepth(dt);
    this.prevHookY = this.hookY;
  }

  getRenderState(): RenderState {
    const lineBobMul = this.appState === AppStateValues.Playing && this.phase === PlayPhaseValues.Descent
      ? CONFIG.hookDescentRollMul
      : 1;
    const bob = this.appState === AppStateValues.Playing && this.phase === PlayPhaseValues.Descent
      ? Math.sin(this.time * CONFIG.bobFrequency) * CONFIG.bobAmplitude * lineBobMul
      : Math.sin(this.time * (CONFIG.bobFrequency * 0.6)) * (CONFIG.bobAmplitude * 0.4);
    const lineStartY = CONFIG.surfaceY + 3 + bob;
    const lineStartX = this.steerX * 0.15;

    const caughtStack = this.fish
      .filter((fish) => fish.state === "hooked")
      .sort((a, b) => (a.hookedIndex ?? 0) - (b.hookedIndex ?? 0))
      .map((fish, index) => ({
        kind: fish.kind,
        typeIndex: fish.typeIndex,
        artVariant: fish.artVariant,
        faceRight: fish.faceRight,
        sizeScale: fish.sizeScale,
        chestState: fish.chestState,
        offsetY: -0.27 * index - 0.025 * Math.min(index, 6),
      }));

    const fishSprites = this.fish
      .filter((fish) => fish.state !== "hooked" && fish.state !== "consumed")
      .map((fish) => ({
        id: fish.id,
        kind: fish.kind,
        x: fish.x,
        y: fish.y,
        typeIndex: fish.typeIndex,
        sizeScale: fish.sizeScale,
        hitHalfW: fish.hitHalfW,
        hitHalfH: fish.hitHalfH,
        artVariant: fish.artVariant,
        faceRight: fish.faceRight,
        state: fish.state,
        rotation: fish.state === "swim"
          ? Math.sin(this.time * 1.1 + fish.phase) * 0.09 +
            Math.sin(this.time * 2.4 + fish.phase * 2) * 0.025
          : 0,
        economyTierId: fish.economyTierId,
        economyName: fish.economyName,
        economyValue: fish.economyValue,
        accentHex: fish.accentHex,
        chestState: fish.chestState,
      }));

    const bonusFish = this.airBonusFish.map((fish) => ({
      kind: fish.kind,
      x: fish.x,
      y: fish.y,
      artVariant: fish.artVariant,
      faceRight: fish.faceRight,
      aboveWater: fish.y >= CONFIG.surfaceY - 0.06,
      active: !fish.missed && fish.launched && this.bonusPhaseElapsed >= fish.launchTime,
      chestState: fish.chestState,
    }));

    const overlayMode =
      this.appState === AppStateValues.Ready
        ? "ready"
        : this.appState === AppStateValues.Result
          ? "result"
          : null;

    const depthForHud =
      this.appState === AppStateValues.Ready
        ? 0
        : this.appState === AppStateValues.Result
          ? this.lastRunDepth
          : this.appState === AppStateValues.BonusToss
            ? this.maxDepthUnits
            : this.hudDisplayDepth;

    const phaseText =
      this.appState === AppStateValues.Ready
        ? "Tap to drop"
        : this.appState === AppStateValues.Result
          ? "Nice run!"
          : this.appState === AppStateValues.SurfacePayoff
            ? "You made it!"
            : this.appState === AppStateValues.BonusToss
              ? this.treasureChestReveal
                ? "OPEN THE CHEST!"
                : this.bonusPhaseElapsed < 0.48
                  ? "BONUS! - TAP!"
                  : "TAP THE FISH!"
              : this.lineLimitPauseRemaining > 0
                ? "MAX LENGTH!"
              : this.phase === PlayPhaseValues.Descent
                ? "Down: dodge fish"
                : "Up: catch fish";

    const fishCountHud =
      this.appState === AppStateValues.Result ? this.lastRunFish : this.fishCaught;
    const multHud =
      this.appState === AppStateValues.Result
        ? this.lastRunMult
        : depthScoreMult(this.maxDepthUnits);
    const haulSubtotal = haulSubtotalFromCounts(this.caughtByTier);
    const haulText =
      haulSubtotal > 0 &&
      ((this.phase === PlayPhaseValues.Ascent && this.appState === AppStateValues.Playing) ||
        this.appState === AppStateValues.SurfacePayoff)
        ? `x${this.fishCaught} - ${formatMoney(haulSubtotal)}`
        : undefined;
    const bonusText =
      this.appState === AppStateValues.BonusToss
        ? `TOSS +${formatMoney(Math.round(this.bonusAccum * CONFIG.bonusMoneyPerPoint))}`
        : undefined;
    const collectionBook = {
      categories: COLLECTION_CATEGORIES.map((category) => ({
        id: category.id,
        label: category.label,
        entries: COLLECTION_ENTRIES
          .filter((entry) => entry.category === category.id)
          .map((entry) => ({
            id: entry.id,
            category: entry.category,
            name: entry.name,
            hint: entry.hint,
            accentHex: entry.accentHex,
            discovered: (this.collectionCounts[entry.id] ?? 0) > 0,
            count: this.collectionCounts[entry.id] ?? 0,
          })),
      })),
    };
    return {
      logicalWidth: this.logicalWidth,
      logicalHeight: this.logicalHeight,
      appState: this.appState,
      phase: this.phase,
      time: this.time,
      background: {
        surfaceY: CONFIG.surfaceY,
        depthUnits:
          this.appState === AppStateValues.Ready ? 0 : Math.max(0, CONFIG.surfaceY - this.hookY),
        bonusSkyCheer: this.bonusSkyCheer,
        time: this.time,
      },
      camera: {
        centerY: this.camFollowY + this.camImpulseY,
        halfHeightScale: this.currentCameraZoomScale(),
        shake:
          this.appState === AppStateValues.BonusToss
            ? Math.min(CONFIG.bonusShakeCapBonus, this.shake + this.bonusHitShake)
            : this.shake,
      },
      hook: {
        x: this.hookX,
        y: this.hookY,
        radius: CONFIG.hookRadius,
        lineStartX,
        lineStartY,
        trail: [...this.trail],
        caughtSwing:
          Math.sin(this.time * 2.65) * 0.12 + Math.sin(this.time * 1.55 + 0.7) * 0.07,
        caughtScale: 1 + Math.min(0.26, this.catchBounce * 0.12),
        caughtStack,
      },
      fish: fishSprites,
      bonusFish,
      treasureChestCinematic: this.treasureChestReveal
        ? {
            active: true,
            progress: Math.min(1, this.treasureChestReveal.elapsed / this.treasureChestReveal.durationSec),
            chestScale:
              0.96 +
              Math.min(1, this.treasureChestReveal.elapsed / 0.34) * 0.22 +
              (this.treasureChestReveal.opened ? 0.18 : 0),
            shake:
              !this.treasureChestReveal.opened
                ? 1 - Math.min(1, this.treasureChestReveal.elapsed / this.treasureChestReveal.awardAtSec)
                : Math.max(
                    0,
                    1 -
                      (this.treasureChestReveal.elapsed - this.treasureChestReveal.awardAtSec) /
                        Math.max(0.001, this.treasureChestReveal.durationSec - this.treasureChestReveal.awardAtSec),
                  ) * 0.22,
            lightAlpha: this.treasureChestReveal.opened
              ? Math.max(
                  0,
                  1 -
                    (this.treasureChestReveal.elapsed - this.treasureChestReveal.awardAtSec) /
                      Math.max(0.001, this.treasureChestReveal.durationSec - this.treasureChestReveal.awardAtSec),
                )
              : Math.min(1, this.treasureChestReveal.elapsed / this.treasureChestReveal.awardAtSec),
            opened: this.treasureChestReveal.opened,
            prizeText: `+${formatMoney(this.treasureChestReveal.prizeDollars)}`,
          }
        : undefined,
      tutorialHand: this.currentTutorialHand(),
      tutorialSpotlight:
        this.ftueSpotlightX !== undefined && this.ftueSpotlightY !== undefined && this.ftueSpotlightColor !== undefined
          ? { worldX: this.ftueSpotlightX, worldY: this.ftueSpotlightY, color: this.ftueSpotlightColor }
          : undefined,
      collectionBook,
      hud: {
        depthText: `${depthForHud.toFixed(0)}m/${this.lineLengthM}m`,
        phaseText,
        caughtText: `x${fishCountHud}`,
        haulText,
        multText: multHud > 1 ? `x${multHud} BONUS` : undefined,
          bonusText,
          tutorialText: this.currentFtueBottomCtaText() ? undefined : this.ftueText,
          tutorialCtaText: this.currentFtueBottomCtaText(),
          toastText: this.toastText,
          depthPulseCounter: this.depthPulseCounter,
        },
      overlay: {
        mode: overlayMode,
        profile: {
          coins: this.coins,
          lineLengthM: this.lineLengthM,
          nextLineUpgradeCost: this.nextLineUpgradeCost(),
          canBuyLineUpgrade: this.canAccessStore() && this.coins >= this.nextLineUpgradeCost(),
          hasExtraLure: this.hasExtraLure,
          nextExtraLureCost: this.nextExtraLureCost(),
          canBuyExtraLure: this.canAccessStore() && !this.hasExtraLure && this.coins >= this.nextExtraLureCost(),
          hasGoldenReel: this.hasGoldenReel,
          goldenReelCost: CONFIG.goldenReelCost,
          canBuyGoldenReel: this.canAccessStore() && !this.hasGoldenReel && this.coins >= CONFIG.goldenReelCost,
          hasLuckCharm: this.hasLuckCharm,
          luckCharmCost: CONFIG.luckCharmCost,
          canBuyLuckCharm: this.canAccessStore() && !this.hasLuckCharm && this.coins >= CONFIG.luckCharmCost,
        },
        ready:
          overlayMode === "ready"
            ? {
                coins: this.coins,
                lineLengthM: this.lineLengthM,
                nextLineUpgradeCost: this.nextLineUpgradeCost(),
                canBuyLineUpgrade: this.coins >= this.nextLineUpgradeCost(),
              }
            : undefined,
        result: this.lastResultPayload,
        tutorial: this.currentFtueOverlay(),
      },
      effects: {
        bubbles: [],
        particles: [],
        floaters: [],
      },
    };
  }

  drainEvents(): import("../render/RenderState.js").GameEvent[] {
    const next = this.events;
    this.events = [];
    return next;
  }

  getDebugState(): GameAppDebugState {
    const current = this.getRenderState();
    return {
      appState: this.appState,
      phase: this.phase,
      hookX: this.hookX,
      hookY: this.hookY,
      maxDepthUnits: this.maxDepthUnits,
      fishCaught: this.fishCaught,
      coins: this.coins,
      lineLengthM: this.lineLengthM,
      hasExtraLure: this.hasExtraLure,
      hasGoldenReel: this.hasGoldenReel,
      hasLuckCharm: this.hasLuckCharm,
      hasCompletedFtue: this.hasCompletedFtue,
      hasSeenChestTutorial: this.hasSeenChestTutorial,
      hasSeenTrashTutorial: this.hasSeenTrashTutorial,
      collectionCounts: { ...this.collectionCounts },
      bonusAccum: this.bonusAccum,
      fish: this.fish.map((fish) => ({ ...fish })),
      bonusFish: current.bonusFish,
      overlay: current.overlay,
    };
  }

  private handleCommands(commands: import("../render/RenderState.js").GameInputCommand[]): void {
    for (const command of commands) {
      if (
        this.ftueMode === "store" &&
        command.type !== "retryRun"
      ) {
        this.dismissStoreCoachmark();
      }

      switch (command.type) {
        case "startRun":
          if (this.appState === AppStateValues.Ready) {
            if (!this.hasCompletedFtue) {
              this.beginFtueRun();
            } else {
              this.ftueMode = "off";
              this.ftueText = undefined;
              this.ftueTextRemaining = 0;
              this.ftueAwaitingTap = false;
              this.appState = AppStateValues.Playing;
              this.phase = PlayPhaseValues.Descent;
              this.resetRunState(true);
            }
          }
          break;
        case "retryRun":
          if (this.appState === AppStateValues.Result) {
            this.appState = AppStateValues.Ready;
            this.phase = PlayPhaseValues.Descent;
            this.resetRunState(false);
          }
          break;
        case "buyLineUpgrade":
          if (this.canAccessStore()) {
            this.tryBuyLineUpgrade();
          }
          break;
        case "buyExtraLureUpgrade":
          if (this.canAccessStore()) {
            this.tryBuyExtraLureUpgrade();
          }
          break;
        case "buyGoldenReelUpgrade":
          if (this.canAccessStore()) {
            this.tryBuyGoldenReelUpgrade();
          }
          break;
        case "buyLuckCharm":
          if (this.canAccessStore()) {
            this.tryBuyLuckCharm();
          }
          break;
        case "pointerDown":
        case "pointerMove":
          if (this.handleFtuePointerInteraction(command.type)) {
            break;
          }
          if (this.appState !== AppStateValues.BonusToss && this.appState !== AppStateValues.SurfacePayoff) {
            this.pointerTargetX = logicalToWorldX(
              command.x,
              this.logicalWidth,
              this.logicalHeight,
              this.bonusOrthoZoom,
            );
          }
          break;
        case "pointerUp":
          break;
        case "bonusTap":
          if (this.ftueSkipBonusTap) {
            break;
          }
          if (this.appState === AppStateValues.BonusToss && !this.treasureChestReveal) {
            this.tryTapBonusFish(command.x, command.y);
          }
          break;
      }
    }
  }

  private resetRunState(startingRun = false): void {
    this.extraLureCharges = startingRun && this.hasExtraLure ? 1 : 0;
    this.runGoldenReelActive = startingRun ? this.hasGoldenReel : false;
    this.runLuckCharmActive = startingRun ? this.hasLuckCharm : false;
    this.fish = this.createFishField().map((fish) => ({ ...fish }));
    this.phase = PlayPhaseValues.Descent;
    this.maxDepthUnits = 0;
    this.fishCaught = 0;
    this.trashBagCount = 0;
    this.snapperCaughtCount = 0;
    this.chestsOpenedThisRun = 0;
    this.caughtByTier = new Map();
    this.trashPenaltyDollars = 0;
    this.caughtBonusItems = [];
    this.time = 0;
    this.hookX = 0;
    this.hookY = CONFIG.surfaceY - 0.6;
    this.pointerTargetX = this.hookX;
    this.steerX = this.hookX;
    this.camFollowY = CONFIG.surfaceY + CONFIG.cameraIdleBias;
    this.prevHookY = this.hookY;
    this.hudDisplayDepth = 0;
    this.lastDepthMilestoneBand = 0;
    this.nearMissCooldown = 0;
    this.surfacePayoffT = 0;
    this.toastText = undefined;
    this.toastRemaining = 0;
    this.depthPulseCounter = 0;
    this.catchBounce = 0;
    this.trail = [];
    this.bonusAccum = 0;
    this.bonusPhaseElapsed = 0;
    this.airBonusFish = [];
    this.bonusOrthoZoom = 1;
    this.bonusHitShake = 0;
    this.bonusTapStreak = 0;
    this.bonusSkyCheer = 0;
    this.treasureChestReveal = undefined;
    this.lineLimitPauseRemaining = 0;
    this.ftueStep = undefined;
    this.ftueText = undefined;
    this.ftueTextRemaining = 0;
    this.ftueAwaitingTap = false;
    this.ftueSlowMoRemaining = 0;
    this.ftueSlowMoDuration = 0;
    this.ftueSkipBonusTap = false;
    this.ftueFishDodgeShown = false;
    this.ftueTrashShown = false;
    this.ftueChestShown = false;
    this.ftueAscentShown = false;
    this.ftueBonusShown = false;
    this.ftueMaxDepthShown = false;
    this.ftueRevealTargetY = undefined;
    this.ftueSpotlightX = undefined;
    this.ftueSpotlightY = undefined;
    this.ftueSpotlightColor = undefined;
    this.camImpulseY = 0;
    this.shake = 0;
    this.events = [];
  }

  private beginFtueRun(): void {
    this.resetRunState(true);
    this.ftueMode = "run";
    this.appState = AppStateValues.Playing;
    this.phase = PlayPhaseValues.Descent;
    this.fish = this.createFtueFishField();
    this.hookX = 0;
    this.pointerTargetX = 0;
    this.steerX = 0;
    this.hookY = CONFIG.surfaceY - 6;
    this.prevHookY = this.hookY;
    this.maxDepthUnits = 6;
    this.hudDisplayDepth = 6;
    this.camFollowY = this.hookY + CONFIG.cameraDescentBias;
    this.ftueStep = "dragTeach";
    this.ftueAwaitingTap = true;
    this.ftueSlowMoRemaining = 0;
    this.ftueSlowMoDuration = 0;
  }

  private createFtueFishField(): FishModel[] {
    const makeFish = (
      id: number,
      depthM: number,
      x: number,
      artVariant: FishArtVariant,
      typeIndex: number,
      economyTierId: string,
      economyName: string,
      economyValue: number,
      sizeScale = 1,
    ): FishModel => ({
      id,
      kind: "fish",
      x,
      y: CONFIG.surfaceY - depthM,
      baseX: x,
      baseY: CONFIG.surfaceY - depthM,
      alive: true,
      state: "swim",
      typeIndex,
      baseHitHalfW: 1.15 * sizeScale,
      baseHitHalfH: 0.54 * sizeScale,
      hitHalfW: 1.15 * sizeScale,
      hitHalfH: 0.54 * sizeScale,
      phase: id * 0.73,
      sizeScale,
      faceRight: x < 0,
      economyTierId,
      economyName,
      economyValue,
      accentHex: artVariant === 1 ? "#ffb8d8" : artVariant === 2 ? "#ffe8a8" : "#9ae0ff",
      artVariant,
      swimDir: x < 0 ? 1 : -1,
      swimSpeed: 0,
    });

    const makeChest = (id: number, depthM: number, x: number): FishModel => ({
      id,
      kind: "treasureChest",
      x,
      y: CONFIG.surfaceY - depthM,
      baseX: x,
      baseY: CONFIG.surfaceY - depthM,
      alive: true,
      state: "swim",
      typeIndex: 0,
      baseHitHalfW: 0.95,
      baseHitHalfH: 0.7,
      hitHalfW: 0.95,
      hitHalfH: 0.7,
      phase: 0,
      sizeScale: CONFIG.treasureChestUnderwaterSize,
      faceRight: false,
      economyTierId: "treasureChest",
      economyName: "Treasure Chest",
      economyValue: 0,
      accentHex: "#ffd46a",
      artVariant: 0,
      chestState: "locked",
      swimDir: 1,
      swimSpeed: 0,
    });

    const makeTrashBag = (id: number, depthM: number, x: number): FishModel => ({
      id,
      kind: "trashBag",
      x,
      y: CONFIG.surfaceY - depthM,
      baseX: x,
      baseY: CONFIG.surfaceY - depthM,
      alive: true,
      state: "swim",
      typeIndex: 0,
      baseHitHalfW: 1.02,
      baseHitHalfH: 0.72,
      hitHalfW: 1.02,
      hitHalfH: 0.72,
      phase: 0,
      sizeScale: CONFIG.trashBagUnderwaterSize,
      faceRight: false,
      economyTierId: "trashBag",
      economyName: "Trash Bag",
      economyValue: 0,
      accentHex: "#cda68d",
      artVariant: 0,
      swimDir: 1,
      swimSpeed: 0,
    });

    // Fish on descent — alternating sides so the player learns to steer
    const fish1 = makeFish(9001, 18, -3.8, 0, 0, "sardine", "Blue Fish",  250, 1.12);
    const fish2 = makeFish(9002, 27, 3.6,  1, 1, "trout",   "Snapper",   500, 1.08);
    const fish3 = makeFish(9003, 35, -3.2, 0, 2, "sardine", "Blue Fish", 250, 1.10);
    const fish4 = makeFish(9005, 40,  2.8, 1, 0, "trout",   "Snapper",   500, 1.06);

    // Chest visible on descent — catching it reverses the player
    const chest = makeChest(9007, 47, 0.06);

    // Trash hidden until chest is caught — dodge on the way back up
    const hiddenTrash = makeTrashBag(9004, 22, 3.4);
    hiddenTrash.alive = false;
    hiddenTrash.state = "consumed";

    return [fish1, fish2, fish3, fish4, chest, hiddenTrash];
  }

  private handleFtuePointerInteraction(commandType: "pointerDown" | "pointerMove"): boolean {
    if (this.isGameplayTutorialMode()) {
      if (this.ftueStep === "dragTeach" && this.ftueAwaitingTap && (commandType === "pointerDown" || commandType === "pointerMove")) {
        this.clearGameplayTutorialStep();
        return false;
      }

      if (
        (
          this.ftueStep === "fishDodgeReveal" ||
          this.ftueStep === "chestReveal" ||
          this.ftueStep === "trashReveal" ||
          this.ftueStep === "bonusTeach"
        ) &&
        commandType === "pointerDown" &&
        (this.ftueSlowMoRemaining > 0 || this.ftueAwaitingTap)
      ) {
        this.clearGameplayTutorialStep();
        return false;
      }
    }

    return false;
  }

  private consumeFtueTimeScale(dt: number): number {
    if (!this.isGameplayTutorialMode()) {
      return 1;
    }
    if (this.ftueSlowMoRemaining <= 0 || this.ftueSlowMoDuration <= 0) {
      return 0.94;
    }

    this.ftueSlowMoRemaining = Math.max(0, this.ftueSlowMoRemaining - dt);
    const progress = 1 - this.ftueSlowMoRemaining / this.ftueSlowMoDuration;
    const scale = Math.max(0.06, 1 - progress * 0.94);
    if (this.ftueSlowMoRemaining <= 0) {
      this.ftueAwaitingTap = true;
    }
    return scale * 0.94;
  }

  private updateFtueDescentBeats(currentDepth: number): void {
    if (this.isTutorialPauseActive()) return;

    // Fish dodge reveal — FTUE only, triggers when first fish enters camera view
    if (!this.ftueFishDodgeShown && this.ftueMode === "run") {
      const fish = this.fish.find((f) => f.kind === "fish" && f.alive && f.state === "swim");
      if (fish) {
        const fishDepth = Math.max(0, CONFIG.surfaceY - fish.y);
        if (currentDepth >= fishDepth - 9) {
          this.ftueFishDodgeShown = true;
          this.ftueRevealTargetY = fish.y;
          this.ftueSpotlightX = fish.x;
          this.ftueSpotlightY = fish.y;
          this.ftueSpotlightColor = "#ff4444";
          this.startFtuePause("fishDodgeReveal", true, 0.55);
          return;
        }
      }
    }

    // Chest reveal — for all players who haven't seen it yet
    if (!this.ftueChestShown && !this.hasSeenChestTutorial) {
      const chest = this.findNearestTutorialTarget("treasureChest", currentDepth);
      const chestDepth = chest ? Math.max(0, CONFIG.surfaceY - chest.y) : undefined;
      if (chestDepth !== undefined && currentDepth >= chestDepth - 10.5) {
        this.ftueChestShown = true;
        this.hasSeenChestTutorial = true;
        if (this.ftueMode === "off") {
          this.ftueMode = "teach";
        }
        if (chest) {
          this.ftueRevealTargetY = chest.y;
          this.ftueSpotlightX = chest.x;
          this.ftueSpotlightY = chest.y;
          this.ftueSpotlightColor = "#ffd700";
        }
        this.syncProfile();
        this.startFtuePause("chestReveal", true, 0.45);
      }
    }
  }

  private updateFtueAscentBeats(currentDepth: number): void {
    if (this.isTutorialPauseActive()) return;

    // Trash reveal — only when trash is above the hook (on the ascent path)
    if (!this.ftueTrashShown && !this.hasSeenTrashTutorial) {
      const trash = this.findNearestTutorialTarget("trashBag", currentDepth);
      const trashDepth = trash ? Math.max(0, CONFIG.surfaceY - trash.y) : undefined;
      if (trashDepth !== undefined && currentDepth <= trashDepth + 9.5 && trashDepth < currentDepth) {
        this.ftueTrashShown = true;
        this.hasSeenTrashTutorial = true;
        if (this.ftueMode === "off") {
          this.ftueMode = "teach";
        }
        if (trash) {
          this.ftueRevealTargetY = trash.y;
          this.ftueSpotlightX = trash.x;
          this.ftueSpotlightY = trash.y;
          this.ftueSpotlightColor = "#ff7700";
        }
        this.syncProfile();
        this.startFtuePause("trashReveal", true, 0.45);
        return;
      }
    }

  }

  private startFtuePause(step: FtueStep, useSlowMo = true, slowMoDuration = 0.42): void {
    this.ftueStep = step;
    this.ftueAwaitingTap = !useSlowMo;
    this.ftueSlowMoDuration = useSlowMo ? slowMoDuration : 0;
    this.ftueSlowMoRemaining = useSlowMo ? this.ftueSlowMoDuration : 0;
    if (step === "bonusTeach") {
      this.ftueBonusShown = true;
      this.showFtueText("Tap bonus", 30);
    }
  }

  private showFtueText(text: string, seconds: number): void {
    this.ftueText = text;
    this.ftueTextRemaining = seconds;
  }

  private currentFtueBottomCtaText(): string | undefined {
    if (this.ftueMode !== "run" && this.ftueMode !== "teach") return undefined;
    if (this.lineLimitPauseRemaining > 0 && this.ftueMode === "run") {
      return "MAX DEPTH — UPGRADES EXTEND YOUR LINE!";
    }
    switch (this.ftueStep) {
      case "dragTeach":
        return "← DRAG TO STEER →";
      case "fishDodgeReveal":
        return "DODGE FISH ON THE WAY DOWN!";
      case "chestReveal":
        return "CATCH THE TREASURE CHEST!";
      case "ascentTeach":
        return "GO UP — CATCH FISH!";
      case "trashReveal":
        return "DODGE THE TRASH BAG!";
      case "bonusTeach":
        return "TAP THE FISH!";
      default:
        return this.ftueText ?? undefined;
    }
  }

  private findNearestTutorialTarget(kind: CatchableKind, currentDepth: number): FishModel | undefined {
    return this.fish
      .filter((fish) => fish.kind === kind && fish.alive && fish.state === "swim")
      .sort((a, b) => {
        const aDepth = Math.abs(Math.max(0, CONFIG.surfaceY - a.y) - currentDepth);
        const bDepth = Math.abs(Math.max(0, CONFIG.surfaceY - b.y) - currentDepth);
        return aDepth - bDepth;
      })[0];
  }

  private currentFtueOverlay(): RenderState["overlay"]["tutorial"] | undefined {
    if (this.ftueMode === "store") {
      return {
        id: "ftue-store",
        title: "STORE",
        body: "Upgrades are permanent. Stock consumables before diving.",
        accent: "cyan",
        panel: "store",
      };
    }
    return undefined;
  }

  private currentCameraZoomScale(): number {
    const ftueZoom = this.currentFtueZoomScale();
    if (ftueZoom !== 1) return ftueZoom;
    if (this.appState === AppStateValues.BonusToss) {
      return this.bonusOrthoZoom;
    }
    if (this.lineLimitPauseRemaining > 0) {
      return CONFIG.lineLengthTriggerZoomScale;
    }
    return 1;
  }

  private currentFtueZoomScale(): number {
    if (this.ftueMode !== "run" && this.ftueMode !== "teach") return 1;
    const revealSteps: (FtueStep | undefined)[] = ["fishDodgeReveal", "chestReveal", "trashReveal"];
    if (revealSteps.includes(this.ftueStep)) {
      const target = 0.82;
      if (this.ftueAwaitingTap) return target;
      if (this.ftueSlowMoDuration <= 0 || this.ftueSlowMoRemaining <= 0) return 1;
      const progress = 1 - this.ftueSlowMoRemaining / this.ftueSlowMoDuration;
      return 1 + (target - 1) * progress;
    }
    if (this.ftueMode === "run" && this.ftueStep === "bonusTeach") {
      const target = 0.96;
      if (this.ftueAwaitingTap) return target;
      if (this.ftueSlowMoDuration <= 0 || this.ftueSlowMoRemaining <= 0) return 1;
      const progress = 1 - this.ftueSlowMoRemaining / this.ftueSlowMoDuration;
      return 1 + (target - 1) * progress;
    }
    return 1;
  }

  private dismissStoreCoachmark(): void {
    if (this.ftueMode !== "store") return;
    this.ftueMode = "off";
    this.ftueStep = undefined;
  }

  private findFtueFishById(id: number): FishModel | undefined {
    return this.fish.find((fish) => fish.id === id);
  }


  private currentTutorialHand(): RenderState["tutorialHand"] | undefined {
    if (this.appState === AppStateValues.Ready && this.ftueMode === "run" && !this.hasCompletedFtue) {
      return {
        visible: true,
        x: this.logicalWidth * 0.71,
        y: this.logicalHeight * 0.56,
        rotationDeg: 92,
        mode: "tapPulse",
        anchor: "ui",
      };
    }

    if (this.ftueMode !== "run") return undefined;

    if (this.ftueStep === "dragTeach" && this.phase === PlayPhaseValues.Descent) {
      return {
        visible: true,
        x: this.logicalWidth * 0.5,
        y: this.logicalHeight * 0.65,
        rotationDeg: -88,
        mode: "sweepHorizontal",
        anchor: "ui",
      };
    }

    if (this.ftueStep === "bonusTeach") {
      const target = this.airBonusFish.find((fish) => !fish.missed && fish.launched);
      if (!target) return undefined;
      return {
        visible: true,
        x: target.x - 1.1,
        y: target.y + 0.55,
        rotationDeg: -18,
        mode: "tapPulse",
        anchor: "world",
      };
    }

    return undefined;
  }

  private updateHookVisuals(dt: number, isDescending: boolean): void {
    this.steerX = this.lerpExp(this.steerX, this.pointerTargetX, CONFIG.hookHorizontalLerp, dt);
    this.steerX = Math.max(CONFIG.hookMinX, Math.min(CONFIG.hookMaxX, this.steerX));

    const sway = isDescending
      ? Math.sin(this.time * 2.35 + 0.4) * CONFIG.hookDescentSway +
        Math.sin(this.time * 3.8) * (CONFIG.hookDescentSway * 0.45)
      : Math.sin(this.time * 1.9) * (CONFIG.hookDescentSway * 0.35);
    this.hookX = Math.max(
      CONFIG.hookMinX,
      Math.min(CONFIG.hookMaxX, this.steerX + sway),
    );

    if (this.catchBounce > 0) {
      this.catchBounce = Math.max(0, this.catchBounce - dt * 3.2);
    }

    this.trail.push({ x: this.hookX, y: this.hookY });
    if (this.trail.length > CONFIG.trailMaxPoints) {
      this.trail.splice(0, this.trail.length - CONFIG.trailMaxPoints);
    }
  }

  private updateSwimmingFish(dt: number): void {
    const swimBound = 0.36;
    for (const fish of this.fish) {
      if (!fish.alive || fish.state !== "swim" || fish.kind !== "fish" || fish.swimSpeed <= 0) continue;
      fish.x += fish.swimDir * fish.swimSpeed * dt;

      if (fish.x <= CONFIG.hookMinX + swimBound) {
        fish.x = CONFIG.hookMinX + swimBound;
        fish.swimDir = 1;
      } else if (fish.x >= CONFIG.hookMaxX - swimBound) {
        fish.x = CONFIG.hookMaxX - swimBound;
        fish.swimDir = -1;
      }
      fish.faceRight = fish.swimDir > 0;
    }
  }

  private collectAscentFish(): void {
    for (const fish of this.fish) {
      if (!fish.alive || fish.state !== "swim") continue;
      if (circleHitsAabb(this.hookX, this.hookY, CONFIG.hookRadius, fish.x, fish.y, fish.hitHalfW, fish.hitHalfH)) {
        this.catchTarget(fish);
      }
    }
  }

  private catchTarget(fish: FishModel): void {
    if (!fish.alive || fish.state !== "swim") return;

    fish.alive = false;
    fish.state = "snap";
    this.fishCaught += 1;
    this.caughtBonusItems.push({
      kind: fish.kind,
      typeIndex: fish.typeIndex,
      sizeScale: fish.sizeScale,
      artVariant: fish.artVariant,
      faceRight: fish.faceRight,
      chestState: fish.chestState,
      prizeDollars: fish.kind === "treasureChest" ? CONFIG.treasureChestBonusDollars : undefined,
    });
    this.recordCollectionCatch(fish);
    if (fish.kind === "treasureChest") {
      // If the chest was spotlighted (caught on ascent), clear the spotlight now
      if (this.ftueSpotlightX !== undefined) {
        this.ftueRevealTargetY = undefined;
        this.ftueSpotlightX = undefined;
        this.ftueSpotlightY = undefined;
        this.ftueSpotlightColor = undefined;
      }
      this.emit({
        type: "treasureChestCaught",
        x: fish.x,
        y: fish.y,
      });
    } else if (fish.kind === "trashBag") {
      this.trashBagCount += 1;
      this.trashPenaltyDollars += CONFIG.trashBagPenaltyDollars;
      this.emit({
        type: "trashBagCaught",
        x: fish.x,
        y: fish.y,
        amount: CONFIG.trashBagPenaltyDollars,
      });
    } else {
      if (fish.artVariant === 1) {
        this.snapperCaughtCount += 1;
      }
      this.caughtByTier.set(fish.economyTierId, (this.caughtByTier.get(fish.economyTierId) ?? 0) + 1);
      this.emit({
        type: "fishCaught",
        x: fish.x,
        y: fish.y,
        value: fish.economyValue,
        tierId: fish.economyTierId,
        artVariant: fish.artVariant,
      });
    }
  }

  private updateSnapFish(dt: number): void {
    for (const fish of this.fish) {
      if (fish.state !== "snap") continue;
      const dx = this.hookX - fish.x;
      const dy = this.hookY - fish.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.085) {
        fish.x = this.hookX;
        fish.y = this.hookY;
        fish.state = "hooked";
        fish.hookedIndex = this.fish.filter((candidate) => candidate.state === "hooked").length - 1;
        this.catchBounce = Math.min(1.45, 1 + (fish.hookedIndex ?? 0) * CONFIG.catchBouncePerFish);
      } else {
        const step = Math.min(1, (32 * dt) / Math.max(d, 0.001));
        fish.x += dx * step;
        fish.y += dy * step;
      }
    }
  }

  private updateNearMiss(dt: number, descending: boolean): void {
    this.nearMissCooldown = Math.max(0, this.nearMissCooldown - dt);
    if (!descending || this.nearMissCooldown > 0) return;
    const r = CONFIG.hookRadius;
    const r2 = r * r;
    const outer = r + CONFIG.nearMissExtra;
    const o2 = outer * outer;
    for (const fish of this.fish) {
      if (!fish.alive || fish.state !== "swim") continue;
      const d2 = pointToAabbDistSq(this.hookX, this.hookY, fish.x, fish.y, fish.hitHalfW, fish.hitHalfH);
      if (d2 > r2 && d2 < o2) {
        this.nearMissCooldown = CONFIG.nearMissCooldownSec;
        this.camImpulseY += 0.06;
        this.emit({ type: "nearMiss", x: this.hookX, y: this.hookY });
        break;
      }
    }
  }

  private consumeExtraLure(fish: FishModel): void {
    this.extraLureCharges = Math.max(0, this.extraLureCharges - 1);
    fish.alive = false;
    fish.state = "consumed";
    this.shake = Math.max(this.shake, CONFIG.shakeHitDescent * 0.35);
    this.camImpulseY += 0.04;
    this.setToast(this.extraLureCharges > 0 ? `EXTRA LURE x${this.extraLureCharges}` : "EXTRA LURE USED", 0.7);
  }

  private updateHudDepth(dt: number): void {
    const rawDepthHud = Math.max(0, CONFIG.surfaceY - this.hookY);
    this.hudDisplayDepth = this.lerpExp(this.hudDisplayDepth, rawDepthHud, CONFIG.hudDepthLerp, dt);
    const depthBand = Math.floor(rawDepthHud / 10);
    if (depthBand > this.lastDepthMilestoneBand && depthBand >= 1) {
      this.lastDepthMilestoneBand = depthBand;
      this.depthPulseCounter += 1;
      const mult = depthScoreMult(rawDepthHud);
      this.setToast(mult >= 2 ? `${depthBand * 10} m - x${mult}` : `${depthBand * 10} m`, 0.82);
    }
  }

  private triggerLineLengthReached(): void {
    this.lineLimitPauseRemaining = CONFIG.lineLengthTriggerSlowMoSec;
    this.camImpulseY += 0.22;
    this.shake = Math.max(this.shake, CONFIG.shakeHitDescent);
    if (this.ftueMode === "run") {
      if (!this.ftueAscentShown) {
        this.activateFtueAscent();
      }
      if (!this.ftueMaxDepthShown) {
        this.ftueMaxDepthShown = true;
        this.setToast("MAX DEPTH!", 2.2);
      }
    } else {
      this.setToast("MAX LENGTH", 1.1);
    }
  }

  private beginBonusTossAtSurface(): void {
    this.bonusAccum = 0;
    this.bonusPhaseElapsed = 0;
    this.airBonusFish = this.spawnBonusTossFish();
    if (this.ftueMode === "run" && !this.ftueBonusShown) {
      const firstAirTarget = this.airBonusFish.find((fish) => !fish.missed);
      if (firstAirTarget) {
        firstAirTarget.launchTime = 0;
        firstAirTarget.launched = true;
        firstAirTarget.justLaunched = true;
      }
    }
    this.treasureChestReveal = undefined;
    this.shake = 0;
    this.bonusHitShake = 0;
    this.bonusTapStreak = 0;
    this.bonusSkyCheer = 0;
    this.camImpulseY += CONFIG.bonusIntroCamImpulse;
    this.setToast("BONUS!", 0.52);
    this.camFollowY = this.camFollowY + (this.bonusCameraTrackingTargetY() - this.camFollowY) * 0.35;
    this.appState = AppStateValues.BonusToss;
    if (this.ftueMode === "run" && !this.ftueBonusShown) {
      this.startFtuePause("bonusTeach");
    }
  }

  private spawnBonusTossFish(): AirBonusFishModel[] {
    const cap = CONFIG.bonusMaxAirTargets;
    const specialItems = this.caughtBonusItems
      .filter((item) => item.kind !== "fish")
      .slice(0, cap);
    const selectedFishCount = Math.max(0, cap - specialItems.length);
    const fishItems = this.caughtBonusItems.filter((item) => item.kind === "fish");
    const selectedFish = fishItems.slice(0, selectedFishCount);
    const overflow = Math.max(0, fishItems.length - selectedFish.length);
    const bankedPoints = overflow * CONFIG.bonusPerTap;
    this.bonusAccum += bankedPoints;
    if (bankedPoints > 0) {
      this.emit({
        type: "bonusBanked",
        x: this.hookX,
        y: CONFIG.surfaceY,
        amount: Math.round(bankedPoints * CONFIG.bonusMoneyPerPoint),
      });
    }

    const selectedItems: CaughtBonusItem[] = [];
    const middleIndex = specialItems.length > 0 ? Math.floor((selectedFish.length + specialItems.length) * 0.5) : -1;
    let fishIndex = 0;
    let specialIndex = 0;
    const total = selectedFish.length + specialItems.length;
    for (let i = 0; i < total; i++) {
      if (i === middleIndex && specialIndex < specialItems.length) {
        selectedItems.push(specialItems[specialIndex]!);
        specialIndex += 1;
      } else if (fishIndex < selectedFish.length) {
        selectedItems.push(selectedFish[fishIndex]!);
        fishIndex += 1;
      } else if (specialIndex < specialItems.length) {
        selectedItems.push(specialItems[specialIndex]!);
        specialIndex += 1;
      }
    }

    const airFish: AirBonusFishModel[] = [];
    const clampedHook = Math.max(CONFIG.hookMinX + 0.3, Math.min(CONFIG.hookMaxX - 0.3, this.hookX));
    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i]!;
      const spread =
        item.kind !== "fish"
          ? (Math.random() - 0.5) * 0.18
          : (i - (selectedItems.length - 1) / 2) * 0.42 + (Math.random() - 0.5) * CONFIG.bonusSpawnJitterX;
      const x = Math.max(
        CONFIG.hookMinX + 0.2,
        Math.min(CONFIG.hookMaxX - 0.2, clampedHook + spread),
      );
      const y = CONFIG.surfaceY + CONFIG.bonusSpawnYOffset;
      const vxSpread =
        item.kind !== "fish"
          ? CONFIG.bonusLaunchVxSpread * 0.32
          : CONFIG.bonusLaunchVxSpread + CONFIG.bonusLaunchVxExtraSpread;
      const vyMin = item.kind !== "fish" ? CONFIG.bonusLaunchVyMin * 0.82 : CONFIG.bonusLaunchVyMin;
      const vyMax = item.kind !== "fish" ? CONFIG.bonusLaunchVyMax * 0.9 : CONFIG.bonusLaunchVyMax;

      airFish.push({
        kind: item.kind,
        x,
        y,
        vx: ((Math.random() - 0.5) * 2 * vxSpread) / Math.max(selectedItems.length, 1),
        vy: vyMin + Math.random() * (vyMax - vyMin + CONFIG.bonusLaunchVyJitter * Math.random()),
        artVariant: item.artVariant,
        faceRight: item.faceRight,
        launchTime:
          item.kind !== "fish"
            ? 0.08 + Math.random() * 0.03
            : i * CONFIG.bonusLaunchStagger + Math.random() * 0.04,
        launched: false,
        justLaunched: false,
        missed: false,
        chestState: item.chestState,
        prizeDollars: item.prizeDollars,
      });
    }
    return airFish;
  }

  private updateBonusFish(dt: number): void {
    const centerY = this.camFollowY + this.camImpulseY;
    const viewHalfHeight = CONFIG.cameraHalfHeight * this.bonusOrthoZoom;
    const missBelow = centerY - viewHalfHeight - CONFIG.bonusMissMarginBelowView;

    for (const fish of this.airBonusFish) {
      if (fish.missed) continue;
      if (!fish.launched) {
        if (this.bonusPhaseElapsed >= fish.launchTime) {
          fish.launched = true;
          fish.justLaunched = true;
        } else {
          continue;
        }
      }
      fish.vy -= CONFIG.bonusGravity * dt;
      fish.x += fish.vx * dt;
      fish.y += fish.vy * dt;
      if (fish.y < missBelow) {
        fish.missed = true;
      }
    }
  }

  private tryTapBonusFish(logicalX: number, logicalY: number): void {
    const r2 = CONFIG.bonusTapRadiusPx * CONFIG.bonusTapRadiusPx;
    let bestIndex = -1;
    let bestDistance = r2;
    const cameraCenterY = this.camFollowY + this.camImpulseY;

    for (let i = 0; i < this.airBonusFish.length; i++) {
      const fish = this.airBonusFish[i]!;
      if (fish.missed) continue;
      if (this.bonusPhaseElapsed < fish.launchTime) continue;
      if (!fish.launched) {
        fish.launched = true;
        fish.justLaunched = true;
      }
      const logical = worldToLogicalPoint(
        fish.x,
        fish.y,
        this.logicalWidth,
        this.logicalHeight,
        cameraCenterY,
        this.bonusOrthoZoom,
      );
      const dx = logical.x - logicalX;
      const dy = logical.y - logicalY;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r2 && d2 < bestDistance) {
        bestDistance = d2;
        bestIndex = i;
      }
    }

    if (bestIndex < 0) return;
    const fish = this.airBonusFish[bestIndex]!;
    fish.missed = true;

    if (fish.kind === "treasureChest") {
      this.startTreasureChestReveal(fish.prizeDollars ?? CONFIG.treasureChestBonusDollars);
      return;
    }
    if (fish.kind === "trashBag") {
      this.emit({
        type: "trashBagBurst",
        x: fish.x,
        y: fish.y,
      });
      this.setToast("GUNK!", 0.8);
      return;
    }

    this.bonusAccum += CONFIG.bonusPerTap;
    this.bonusTapStreak += 1;
    const stack = Math.min(10, this.bonusTapStreak);
    this.bonusHitShake = Math.min(
      CONFIG.bonusShakeCapBonus,
      this.bonusHitShake + CONFIG.bonusTapShakeBase + stack * CONFIG.bonusTapShakeStack,
    );
    this.emit({
      type: "bonusTapped",
      x: fish.x,
      y: fish.y,
      amount: Math.round(CONFIG.bonusPerTap * CONFIG.bonusMoneyPerPoint),
      streak: this.bonusTapStreak,
    });
  }

  private startTreasureChestReveal(prizeDollars: number): void {
    const isFtue = this.ftueMode === "run";
    this.treasureChestReveal = {
      elapsed: 0,
      opened: false,
      awarded: false,
      prizeDollars,
      durationSec: isFtue ? 1.5 : CONFIG.treasureChestRevealSec,
      awardAtSec: isFtue ? 0.72 : CONFIG.treasureChestRevealAwardAtSec,
    };
    this.bonusTapStreak = 0;
    this.bonusHitShake = Math.min(CONFIG.bonusShakeCapBonus, this.bonusHitShake + (isFtue ? 0.26 : 0.18));
    this.setToast("TREASURE!", isFtue ? 1.15 : 0.9);
  }

  private updateTreasureChestReveal(dt: number): void {
    if (!this.treasureChestReveal) return;

    this.treasureChestReveal.elapsed += dt;
    const reveal = this.treasureChestReveal;

    if (!reveal.opened && reveal.elapsed >= reveal.awardAtSec * 0.92) {
      reveal.opened = true;
    }

    if (!reveal.awarded && reveal.elapsed >= reveal.awardAtSec) {
      reveal.awarded = true;
      this.chestsOpenedThisRun += 1;
      this.bonusAccum += reveal.prizeDollars / CONFIG.bonusMoneyPerPoint;
      this.bonusHitShake = Math.min(CONFIG.bonusShakeCapBonus, this.bonusHitShake + 0.22);
      this.emit({
        type: "treasureChestOpened",
        amount: reveal.prizeDollars,
      });
      this.setToast(`CHEST ${formatMoney(reveal.prizeDollars)}`, 1.05);
    }

    if (reveal.elapsed >= reveal.durationSec) {
      this.treasureChestReveal = undefined;
    }
  }

  private isBonusComplete(): boolean {
    if (this.treasureChestReveal) return false;
    if (this.bonusPhaseElapsed >= CONFIG.bonusTossMaxSeconds) return true;
    if (this.airBonusFish.length === 0) return true;
    const allSettled = this.airBonusFish.every((fish) => fish.missed);
    const allLaunched = this.airBonusFish.every((fish) => fish.launched);
    return allSettled && allLaunched;
  }

  private goResult(): void {
    this.airBonusFish = [];
    this.bonusOrthoZoom = 1;
    this.bonusHitShake = 0;
    this.bonusTapStreak = 0;
    this.bonusSkyCheer = 0;
    this.treasureChestReveal = undefined;
    this.appState = AppStateValues.Result;
    const haul = buildFishHaulBreakdown(this.caughtByTier, this.maxDepthUnits);
    const totalBonusDollars = Math.round(this.bonusAccum * CONFIG.bonusMoneyPerPoint);
    const bonusDollars = totalBonusDollars;
    const goldenReelBonusDollars = this.runGoldenReelActive
      ? Math.round(haul.fishPayout * CONFIG.goldenReelFishBonusMultiplier)
      : 0;
    const trashPenaltyDollars = this.trashPenaltyDollars;
    this.lastRunMult = haul.depthMult;
    this.lastRunScore =
      haul.fishPayout +
      goldenReelBonusDollars +
      bonusDollars -
      trashPenaltyDollars;
    this.coins = Math.max(0, this.coins + this.lastRunScore);
    if (this.extraLureCharges > 0 || this.hasExtraLure) {
      this.hasExtraLure = false;
      this.extraLureCharges = 0;
    }
    if (this.runGoldenReelActive) {
      this.hasGoldenReel = false;
      this.runGoldenReelActive = false;
    }
    if (this.ftueMode === "run" && !this.hasCompletedFtue) {
      this.hasCompletedFtue = true;
    }
    this.syncProfile();
    this.lastRunFish = this.fishCaught;
    this.lastRunDepth = this.maxDepthUnits;
    this.resultSequence += 1;
    this.lastResultPayload = {
      haul,
      bonusDollars,
      goldenReelBonusDollars,
      trashPenaltyDollars,
      trashBagCount: this.trashBagCount,
      undiscoveredFishIds: COLLECTION_ENTRIES
        .filter((entry) => entry.category === "fish" && (this.collectionCounts[entry.id] ?? 0) <= 0)
      .map((entry) => entry.id),
      totalDollars: this.lastRunScore,
      depthM: this.lastRunDepth,
      sequence: this.resultSequence,
    };
    this.emit({
      type: "resultShown",
      total: this.lastRunScore,
      depthM: this.lastRunDepth,
      fishCaught: this.fishCaught,
    });
  }

  private getBonusActiveFishYBounds(): { minY: number; maxY: number; count: number } | null {
    let minY = Infinity;
    let maxY = -Infinity;
    let count = 0;
    for (const fish of this.airBonusFish) {
      if (fish.missed) continue;
      count += 1;
      minY = Math.min(minY, fish.y);
      maxY = Math.max(maxY, fish.y);
    }
    if (count === 0) return null;
    return { minY, maxY, count };
  }

  private bonusCameraTrackingTargetY(): number {
    const bounds = this.getBonusActiveFishYBounds();
    if (!bounds) return CONFIG.surfaceY + CONFIG.bonusCameraBias;
    const mid = bounds.count === 1 ? bounds.minY : (bounds.minY + bounds.maxY) * 0.5;
    const biased = mid + CONFIG.bonusCameraTrackBiasUp;
    return Math.max(
      CONFIG.bonusCameraTrackMinY,
      Math.min(CONFIG.bonusCameraTrackMaxY, biased),
    );
  }

  private desiredCameraCenterY(): number {
    // During FTUE reveal pauses, pan camera toward the highlighted target
    if (this.ftueRevealTargetY !== undefined && this.isTutorialPauseActive()) {
      return this.ftueRevealTargetY;
    }
    if (this.appState === AppStateValues.BonusToss) {
      return this.bonusCameraTrackingTargetY();
    }
    if (this.lineLimitPauseRemaining > 0) {
      return this.hookY + 0.2;
    }
    if (this.appState === AppStateValues.SurfacePayoff) {
      return this.hookY + CONFIG.cameraAscentBias * 0.85;
    }
    if (this.appState !== AppStateValues.Playing) {
      return CONFIG.surfaceY + CONFIG.cameraIdleBias;
    }
    const bias =
      this.phase === PlayPhaseValues.Descent ? CONFIG.cameraDescentBias : CONFIG.cameraAscentBias;
    return this.hookY + bias;
  }

  private updateCameraFollow(dt: number): void {
    const target = this.desiredCameraCenterY();
    const lerpK =
      this.appState === AppStateValues.BonusToss ? CONFIG.bonusCameraTrackLerp : CONFIG.cameraFollowLerp;
    this.camFollowY = this.lerpExp(this.camFollowY, target, lerpK, dt);
  }

  private updateBonusZoom(dt: number): void {
    const bounds = this.getBonusActiveFishYBounds();
    const spread = bounds ? Math.max(0.35, bounds.maxY - bounds.minY) : 1;
    const targetZoom = Math.max(
      CONFIG.bonusOrthoZoomMin,
      Math.min(
        CONFIG.bonusOrthoZoomMax,
        CONFIG.bonusOrthoZoomMin + spread * CONFIG.bonusOrthoZoomPerSpread,
      ),
    );
    this.bonusOrthoZoom = this.lerpExp(this.bonusOrthoZoom, targetZoom, CONFIG.bonusOrthoZoomLerp, dt);
  }

  private setToast(text: string, seconds: number): void {
    this.toastText = text;
    this.toastRemaining = seconds;
  }

  private canAccessStore(): boolean {
    return this.appState === AppStateValues.Ready || this.appState === AppStateValues.Result;
  }

  private currentTreasureChestSpawnChance(): number {
    return Math.min(
      1,
      CONFIG.treasureChestSpawnChance + (this.runLuckCharmActive ? CONFIG.luckCharmTreasureBonusChance : 0),
    );
  }

  private lineUpgradeIndex(): number {
    return Math.max(
      0,
      Math.floor((this.lineLengthM - CONFIG.lineLengthDefaultM) / CONFIG.lineLengthUpgradeStepM),
    );
  }

  private nextLineUpgradeCost(): number {
    return CONFIG.lineLengthUpgradeBaseCost + this.lineUpgradeIndex() * CONFIG.lineLengthUpgradeCostStep;
  }

  private nextExtraLureCost(): number {
    return CONFIG.extraLureBaseCost;
  }

  private tryBuyLineUpgrade(): void {
    const cost = this.nextLineUpgradeCost();
    if (this.coins < cost) return;
    this.coins -= cost;
    this.lineLengthM += CONFIG.lineLengthUpgradeStepM;
    this.syncProfile();
    this.setToast(`LINE +${CONFIG.lineLengthUpgradeStepM}M`, 0.8);
  }

  private tryBuyExtraLureUpgrade(): void {
    const cost = this.nextExtraLureCost();
    if (this.hasExtraLure || this.coins < cost) return;
    this.coins -= cost;
    this.hasExtraLure = true;
    this.syncProfile();
    this.setToast("EXTRA LURE READY", 0.9);
  }

  private tryBuyGoldenReelUpgrade(): void {
    if (this.hasGoldenReel || this.coins < CONFIG.goldenReelCost) return;
    this.coins -= CONFIG.goldenReelCost;
    this.hasGoldenReel = true;
    this.syncProfile();
    this.setToast("GOLDEN REEL READY", 0.9);
  }

  private tryBuyLuckCharm(): void {
    if (this.hasLuckCharm || this.coins < CONFIG.luckCharmCost) return;
    this.coins -= CONFIG.luckCharmCost;
    this.hasLuckCharm = true;
    this.syncProfile();
    this.setToast("LUCK CHARM READY", 0.9);
  }

  private syncProfile(): void {
    this.onProfileChange?.({
      coins: this.coins,
      lineLengthM: this.lineLengthM,
      hasExtraLure: this.hasExtraLure,
      hasGoldenReel: this.hasGoldenReel,
      hasLuckCharm: this.hasLuckCharm,
      hasCompletedFtue: this.hasCompletedFtue,
      hasSeenChestTutorial: this.hasSeenChestTutorial,
      hasSeenTrashTutorial: this.hasSeenTrashTutorial,
      collectionCounts: { ...this.collectionCounts },
    });
  }

  private recordCollectionCatch(fish: FishModel): void {
    const entryId = collectionEntryIdForFish(fish);
    this.collectionCounts[entryId] = (this.collectionCounts[entryId] ?? 0) + 1;
    this.syncProfile();
  }

  private emit(event: import("../render/RenderState.js").GameEvent): void {
    this.events.push(event);
  }

  private lerpExp(from: number, to: number, k: number, dt: number): number {
    return from + (to - from) * (1 - Math.exp(-k * dt));
  }
}
