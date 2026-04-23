import { GameApp } from "../core/GameApp.js";
import { FISH_COLLECTION_ENTRY_BY_VARIANT } from "../core/CollectionBook.js";
import { CONFIG } from "../core/Config.js";
import { worldToLogicalPoint } from "../core/Projection.js";
import { buildFishHaulBreakdown, depthScoreMult } from "../core/Scoring.js";
import type { FishModel } from "../core/Types.js";

type TestCase = {
  name: string;
  run: () => void;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function createFish(overrides: Partial<FishModel>): FishModel {
  return {
    id: overrides.id ?? 1,
    kind: overrides.kind ?? "fish",
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    baseX: overrides.baseX ?? overrides.x ?? 0,
    baseY: overrides.baseY ?? overrides.y ?? 0,
    alive: overrides.alive ?? true,
    state: overrides.state ?? "swim",
    typeIndex: overrides.typeIndex ?? 0,
    baseHitHalfW: overrides.baseHitHalfW ?? overrides.hitHalfW ?? 1.2,
    baseHitHalfH: overrides.baseHitHalfH ?? overrides.hitHalfH ?? 0.6,
    hitHalfW: overrides.hitHalfW ?? 1.2,
    hitHalfH: overrides.hitHalfH ?? 0.6,
    phase: overrides.phase ?? 0,
    sizeScale: overrides.sizeScale ?? 1,
    faceRight: overrides.faceRight ?? false,
    economyTierId: overrides.economyTierId ?? "sardine",
    economyName: overrides.economyName ?? "Sardine",
    economyValue: overrides.economyValue ?? 250,
    accentHex: overrides.accentHex ?? "#9ae0ff",
    artVariant: overrides.artVariant ?? 0,
    chestState: overrides.chestState,
    swimDir: overrides.swimDir ?? 1,
    swimSpeed: overrides.swimSpeed ?? 0,
    hookedIndex: overrides.hookedIndex,
  };
}

function startGame(game: GameApp): void {
  game.update(0, [{ type: "startRun" }]);
}

function tick(game: GameApp, totalSeconds: number, dt = 1 / 60): void {
  const steps = Math.ceil(totalSeconds / dt);
  for (let i = 0; i < steps; i++) {
    game.update(dt, []);
  }
}

function advanceUntil(
  game: GameApp,
  predicate: () => boolean,
  timeoutSeconds: number,
  dt = 1 / 60,
): boolean {
  const steps = Math.ceil(timeoutSeconds / dt);
  for (let i = 0; i < steps; i++) {
    if (predicate()) return true;
    game.update(dt, []);
  }
  return predicate();
}

function steerToWorldX(game: GameApp, worldX: number, worldY = CONFIG.surfaceY - 6): void {
  const state = game.getRenderState();
  const point = worldToLogicalPoint(
    worldX,
    worldY,
    state.logicalWidth,
    state.logicalHeight,
    state.camera.centerY,
    state.camera.halfHeightScale,
  );
  game.update(0, [{ type: "pointerMove", x: point.x, y: point.y }]);
}

function tapActiveBonusFish(game: GameApp): boolean {
  const before = game.getDebugState().bonusAccum;
  for (let i = 0; i < 24; i++) {
    const state = game.getRenderState();
    const target = state.bonusFish.find((fish) => fish.active);
    if (target) {
      const point = worldToLogicalPoint(
        target.x,
        target.y,
        state.logicalWidth,
        state.logicalHeight,
        state.camera.centerY,
        state.camera.halfHeightScale,
      );
      game.update(0, [{ type: "bonusTap", x: point.x, y: point.y }]);
      game.drainEvents();
      if (game.getDebugState().bonusAccum > before) {
        return true;
      }
    }
    game.update(1 / 60, []);
  }
  return false;
}

function dismissTutorial(game: GameApp): void {
  game.update(0, [{ type: "pointerDown", x: 270, y: 480 }]);
}

const tests: TestCase[] = [
  {
    name: "ftue starts underwater with the line already cast",
    run: () => {
      const game = new GameApp({ initialHasCompletedFtue: false });
      const start = game.getDebugState();
      const render = game.getRenderState();
      assert(start.appState === "Playing", "expected incomplete FTUE to auto-start in gameplay");
      assert(Math.abs(start.maxDepthUnits - 6) < 0.5, "expected FTUE to begin a few meters underwater");
      assert(!render.overlay.tutorial, "expected no blocking FTUE popup on first frame");
      assert(render.tutorialHand?.visible, "expected tutorial hand to be visible during the underwater intro");
      assert(render.tutorialHand?.anchor === "world", "expected initial FTUE hand to be world-anchored");
      assert(render.tutorialHand?.mode === "arcUnderLure", "expected descent hand to guide movement under the lure");
      assert(render.hud.tutorialCtaText === "Drag to start", "expected an opening CTA at the bottom of the screen");
      const beforeY = start.hookY;
      tick(game, 0.6);
      assert(Math.abs(game.getDebugState().hookY - beforeY) < 0.02, "expected the FTUE opening to wait for player interaction");
      game.update(0, [{ type: "pointerMove", x: 320, y: 480 }]);
      assert(advanceUntil(game, () => game.getDebugState().maxDepthUnits > 7.2, 1.0), "expected the line to continue after the first interaction");
    },
  },
  {
    name: "ftue guarantees chest then shows a dismissible store coachmark",
    run: () => {
      const game = new GameApp({ initialHasCompletedFtue: false });
      game.update(0, [{ type: "pointerMove", x: 320, y: 480 }]);
      assert(
        advanceUntil(game, () => game.getRenderState().hud.tutorialText === "Catch treasure", 6.0),
        "expected the FTUE chest to pause and introduce treasure before the catch",
      );
      dismissTutorial(game);
      assert(advanceUntil(game, () => game.getDebugState().phase === "Ascent", 2.2), "expected chest to flip the FTUE into ascent");
      const ascentState = game.getDebugState();
      assert(ascentState.fishCaught === 1, "expected the FTUE chest to become the first catch");
      assert(ascentState.hasSeenChestTutorial, "expected the chest tutorial to be marked as seen once shown");
      assert(
        advanceUntil(
          game,
          () => {
            const state = game.getRenderState();
            if (state.hud.tutorialText === "Avoid trash") {
              dismissTutorial(game);
            }
            return state.appState === "BonusToss" && state.bonusFish.some((fish) => fish.kind === "treasureChest" && fish.active);
          },
          4.5,
        ),
        "expected FTUE to reach bonus toss",
      );
      const renderState = game.getRenderState();
      const chest = renderState.bonusFish.find((fish) => fish.kind === "treasureChest" && fish.active);
      assert(chest, "expected active chest during FTUE bonus");
      const point = worldToLogicalPoint(
        chest.x,
        chest.y,
        renderState.logicalWidth,
        renderState.logicalHeight,
        renderState.camera.centerY,
        renderState.camera.halfHeightScale,
      );
      game.update(0, [
        { type: "pointerDown", x: point.x, y: point.y },
        { type: "bonusTap", x: point.x, y: point.y },
      ]);
      assert(advanceUntil(game, () => Boolean(game.getDebugState().overlay.result), 6.0), "expected FTUE to reach result");
      const result = game.getDebugState().overlay.result;
      assert(Boolean(result), "expected FTUE result payload");
      assert(result!.trashPenaltyDollars === 0, "expected the scripted FTUE trash to be avoidable");
      game.update(0, [{ type: "retryRun" }]);
      assert(game.getRenderState().overlay.tutorial?.id === "ftue-store", "expected store explainer after FTUE retry");
      dismissTutorial(game);
      assert(!game.getRenderState().overlay.tutorial, "expected store FTUE to dismiss on a click anywhere");
    },
  },
  {
    name: "first unseen chest in a normal run pauses to teach it",
    run: () => {
      const fishField = [
        createFish({
          id: 10,
          kind: "treasureChest",
          x: 0,
          y: CONFIG.surfaceY - 15,
          hitHalfW: 0.95,
          hitHalfH: 0.7,
          sizeScale: CONFIG.treasureChestUnderwaterSize,
          economyTierId: "treasureChest",
          economyName: "Treasure Chest",
          economyValue: 0,
          chestState: "locked",
        }),
      ];
      const game = new GameApp({
        initialHasCompletedFtue: true,
        initialHasSeenChestTutorial: false,
        createFishField: () => fishField.map((fish) => ({ ...fish })),
      });
      startGame(game);
      assert(
        advanceUntil(game, () => game.getRenderState().hud.tutorialText === "Catch treasure", 1.1),
        "expected the first unseen chest to trigger a short teaching pause",
      );
      const beforeY = game.getDebugState().hookY;
      tick(game, 0.35);
      assert(Math.abs(game.getDebugState().hookY - beforeY) < 0.08, "expected chest teaching to hold the line in place");
      dismissTutorial(game);
      assert(advanceUntil(game, () => game.getDebugState().phase === "Ascent", 1.8), "expected the run to continue after dismissing chest teaching");
      assert(game.getDebugState().hasSeenChestTutorial, "expected chest teaching to persist after it is shown");
    },
  },
  {
    name: "descent collision flips to ascent",
    run: () => {
      const fishField = [createFish({ x: 0, y: CONFIG.surfaceY - 8 })];
      const game = new GameApp({ createFishField: () => fishField.map((fish) => ({ ...fish })) });
      startGame(game);
      tick(game, 1.0);
      const state = game.getDebugState();
      assert(state.phase === "Ascent", "expected phase to flip to ascent after fish collision");
      assert(state.fishCaught === 1, "expected the descent-hit fish to count as the first catch");
    },
  },
  {
    name: "ascent collision catches fish",
    run: () => {
      const fishField = [
        createFish({ id: 1, x: 0, y: CONFIG.surfaceY - 8, hitHalfW: 1.8, hitHalfH: 0.8 }),
        createFish({ id: 2, x: 2.1, y: CONFIG.surfaceY - 2.8, economyTierId: "trout", economyName: "Trout", economyValue: 500, artVariant: 1 }),
      ];
      const game = new GameApp({ createFishField: () => fishField.map((fish) => ({ ...fish })) });
      startGame(game);
      assert(advanceUntil(game, () => game.getDebugState().phase === "Ascent", 1.2), "expected descent to flip into ascent");
      steerToWorldX(game, 2.1, CONFIG.surfaceY - 2.8);
      assert(advanceUntil(game, () => game.getDebugState().fishCaught > 0, 1.2), "expected at least one fish to be caught on ascent");
    },
  },
  {
    name: "near miss only triggers during descent",
    run: () => {
      const fishField = [createFish({ x: 0.82, y: CONFIG.surfaceY - 4.5, hitHalfW: 0.4, hitHalfH: 0.3 })];
      const game = new GameApp({ createFishField: () => fishField.map((fish) => ({ ...fish })) });
      startGame(game);
      tick(game, 0.5);
      const nearMissEvents = game.drainEvents().filter((event) => event.type === "nearMiss");
      assert(nearMissEvents.length >= 1, "expected a near miss while descending");
      tick(game, 0.8);
      const laterEvents = game.drainEvents().filter((event) => event.type === "nearMiss");
      assert(laterEvents.length <= 1, "expected cooldown to prevent near-miss spam");
    },
  },
  {
    name: "depth multiplier thresholds match current behavior",
    run: () => {
      assert(depthScoreMult(0) === 1, "depth multiplier should bottom at 1");
      assert(depthScoreMult(19.9) === 1, "expected no depth bonus before 20m");
      assert(depthScoreMult(20) === 1, "expected 20m to still be x1");
      assert(depthScoreMult(30) === 2, "expected depth bonus to start increasing after 20m");
    },
  },
  {
    name: "haul breakdown totals fish payout correctly",
    run: () => {
      const counts = new Map<string, number>([
        ["sardine", 2],
        ["trout", 1],
        ["tuna", 1],
      ]);
      const haul = buildFishHaulBreakdown(counts, 20);
      assert(haul.subtotal === 2000, "expected subtotal 2000");
      assert(haul.depthMult === 1, "expected no depth multiplier bonus at 20m");
      assert(haul.fishPayout === 2000, "expected payout to stay at subtotal when depth bonus has not started");
    },
  },
  {
    name: "line cap forces ascent at 100m by default",
    run: () => {
      const fishField = [createFish({ x: 3.8, y: CONFIG.surfaceY - 220, swimSpeed: 0.5 })];
      const game = new GameApp({ createFishField: () => fishField.map((fish) => ({ ...fish })) });
      startGame(game);
      assert(advanceUntil(game, () => game.getDebugState().phase === "Ascent", 14), "expected line cap to force ascent");
      assert(game.getDebugState().maxDepthUnits <= CONFIG.lineLengthDefaultM + 1.2, "expected default line length to cap the run near 100m");
    },
  },
  {
    name: "buy line upgrade spends coins and extends the cap",
    run: () => {
      const game = new GameApp({
        initialCoins: CONFIG.lineLengthUpgradeBaseCost,
        initialLineLengthM: CONFIG.lineLengthDefaultM,
        createFishField: () => [createFish({ x: 3.8, y: CONFIG.surfaceY - 220, swimSpeed: 0.5 })],
      });
      game.update(0, [{ type: "buyLineUpgrade" }]);
      const state = game.getDebugState();
      assert(state.coins === 0, "expected upgrade cost to be deducted");
      assert(state.lineLengthM === CONFIG.lineLengthDefaultM + 25, "expected line length upgrades to add 25m");
    },
  },
  {
    name: "extra lure lets descent continue through the first fish hit",
    run: () => {
      const fishField = [
        createFish({ id: 1, x: 0, y: CONFIG.surfaceY - 6, hitHalfW: 1.6, hitHalfH: 0.8 }),
        createFish({ id: 2, x: 0, y: CONFIG.surfaceY - 9.5, hitHalfW: 1.6, hitHalfH: 0.8, artVariant: 1 }),
      ];
      const game = new GameApp({
        initialHasExtraLure: true,
        createFishField: () => fishField.map((fish) => ({ ...fish })),
      });
      startGame(game);
      assert(advanceUntil(game, () => game.getDebugState().phase === "Ascent", 2.2), "expected second hit to flip into ascent");
      const state = game.getDebugState();
      assert(state.maxDepthUnits > 8, "expected the hook to continue deeper after the first hit");
      assert(state.fishCaught === 1, "expected only the later fish to be caught");
    },
  },
  {
    name: "golden reel boosts fish payout at the result screen",
    run: () => {
      const fishField = [
        createFish({ id: 1, x: 0, y: CONFIG.surfaceY - 8, hitHalfW: 1.8, hitHalfH: 0.8 }),
        createFish({ id: 2, x: 2.1, y: CONFIG.surfaceY - 2.8, economyTierId: "tuna", economyName: "Tuna", economyValue: 1000, artVariant: 2 }),
      ];
      const game = new GameApp({
        initialHasGoldenReel: true,
        createFishField: () => fishField.map((fish) => ({ ...fish })),
      });
      startGame(game);
      assert(advanceUntil(game, () => game.getDebugState().phase === "Ascent", 2.0), "expected the run to reach ascent");
      steerToWorldX(game, 2.1, CONFIG.surfaceY - 2.8);
      assert(advanceUntil(game, () => Boolean(game.getDebugState().overlay.result), 4.5), "expected result overlay payload");
      const overlay = game.getDebugState().overlay.result;
      assert(Boolean(overlay), "expected result overlay payload");
      assert(
        overlay!.goldenReelBonusDollars === Math.round(overlay!.haul.fishPayout * CONFIG.goldenReelFishBonusMultiplier),
        "expected golden reel bonus to apply to fish payout",
      );
    },
  },
  {
    name: "luck charm persists across runs as a permanent upgrade",
    run: () => {
      const fishField = [createFish({ id: 1, x: 0, y: CONFIG.surfaceY - 5, hitHalfW: 1.8, hitHalfH: 0.8 })];
      const game = new GameApp({
        initialHasLuckCharm: true,
        createFishField: () => fishField.map((fish) => ({ ...fish })),
      });
      startGame(game);
      assert(advanceUntil(game, () => Boolean(game.getDebugState().overlay.result), 5.0), "expected result overlay payload");
      assert(game.getDebugState().overlay.profile.hasLuckCharm === true, "expected luck charm to persist after the run as a permanent upgrade");
    },
  },
  {
    name: "bonus overflow banks immediately",
    run: () => {
      const fishField: FishModel[] = [createFish({ x: 0, y: CONFIG.surfaceY - 10, hitHalfW: 1.8, hitHalfH: 0.8 })];
      for (let i = 0; i < 15; i++) {
        fishField.push(
          createFish({
            id: i + 2,
            x: 2.1,
            y: CONFIG.surfaceY - (0.8 + i * 0.22),
            economyTierId: i % 2 === 0 ? "trout" : "tuna",
            economyName: i % 2 === 0 ? "Trout" : "Tuna",
            economyValue: i % 2 === 0 ? 500 : 1000,
            artVariant: (i % 3) as 0 | 1 | 2,
          }),
        );
      }
      const game = new GameApp({ createFishField: () => fishField.map((fish) => ({ ...fish })) });
      startGame(game);
      assert(advanceUntil(game, () => game.getDebugState().phase === "Ascent", 1.4), "expected the run to reach ascent");
      steerToWorldX(game, 2.1, CONFIG.surfaceY - 5);
      assert(advanceUntil(game, () => game.getDebugState().appState === "BonusToss", 3.2), "expected bonus toss to begin");
      const banked = game.drainEvents().find((event) => event.type === "bonusBanked");
      assert(Boolean(banked), "expected bonus overflow to bank immediately");
    },
  },
  {
    name: "collection book records catches immediately",
    run: () => {
      const fishField = [
        createFish({ id: 1, x: 0, y: CONFIG.surfaceY - 8, hitHalfW: 1.8, hitHalfH: 0.8 }),
        createFish({ id: 2, x: 2.1, y: CONFIG.surfaceY - 2.8, economyTierId: "trout", economyName: "Trout", economyValue: 500, artVariant: 1 }),
      ];
      const game = new GameApp({ createFishField: () => fishField.map((fish) => ({ ...fish })) });
      startGame(game);
      assert(advanceUntil(game, () => game.getDebugState().phase === "Ascent", 1.2), "expected the run to reach ascent");
      steerToWorldX(game, 2.1, CONFIG.surfaceY - 2.8);
      const entryId = FISH_COLLECTION_ENTRY_BY_VARIANT[1];
      assert(
        advanceUntil(game, () => (game.getDebugState().collectionCounts[entryId] ?? 0) > 0, 1.2),
        "expected caught fish to enter the collection immediately",
      );
    },
  },
  {
    name: "bonus tap awards value",
    run: () => {
      const fishField = [
        createFish({ id: 1, x: 0, y: CONFIG.surfaceY - 8, hitHalfW: 1.8, hitHalfH: 0.8 }),
        createFish({ id: 2, x: 2.1, y: CONFIG.surfaceY - 2.8, economyTierId: "trout", economyName: "Trout", economyValue: 500, artVariant: 1 }),
      ];
      const game = new GameApp({ createFishField: () => fishField.map((fish) => ({ ...fish })) });
      startGame(game);
      assert(advanceUntil(game, () => game.getDebugState().phase === "Ascent", 2.0), "expected the run to reach ascent");
      steerToWorldX(game, 2.1, CONFIG.surfaceY - 2.8);
      assert(
        advanceUntil(
          game,
          () => {
            const state = game.getRenderState();
            return state.appState === "BonusToss" && state.bonusFish.some((fish) => fish.active);
          },
          3.0,
        ),
        "expected to reach bonus toss with an active target",
      );
      assert(tapActiveBonusFish(game), "expected bonus tap to add value");
    },
  },
  {
    name: "treasure chest opens and awards its prize in bonus",
    run: () => {
      const fishField = [
        createFish({
          id: 1,
          kind: "treasureChest",
          x: 0,
          y: CONFIG.surfaceY - 8,
          hitHalfW: 0.95,
          hitHalfH: 0.7,
          sizeScale: CONFIG.treasureChestUnderwaterSize,
          faceRight: false,
          economyTierId: "treasureChest",
          economyName: "Treasure Chest",
          economyValue: 0,
          chestState: "locked",
        }),
      ];
      const game = new GameApp({
        initialHasSeenChestTutorial: true,
        createFishField: () => fishField.map((fish) => ({ ...fish })),
      });
      startGame(game);
      assert(
        advanceUntil(
          game,
          () => {
            const state = game.getRenderState();
            return state.appState === "BonusToss" && state.bonusFish.some((fish) => fish.kind === "treasureChest" && fish.active);
          },
          4.5,
        ),
        "expected bonus toss to include an active treasure chest",
      );
      const renderState = game.getRenderState();
      const chest = renderState.bonusFish.find((fish) => fish.kind === "treasureChest" && fish.active);
      assert(chest, "expected active treasure chest");
      const before = game.getDebugState().bonusAccum;
      const point = worldToLogicalPoint(
        chest.x,
        chest.y,
        renderState.logicalWidth,
        renderState.logicalHeight,
        renderState.camera.centerY,
        renderState.camera.halfHeightScale,
      );
      game.update(0, [{ type: "bonusTap", x: point.x, y: point.y }]);
      assert(
        advanceUntil(game, () => game.drainEvents().some((event) => event.type === "treasureChestOpened"), 1.6),
        "expected chest opening event",
      );
      const gained = Math.round((game.getDebugState().bonusAccum - before) * CONFIG.bonusMoneyPerPoint);
      assert(gained === CONFIG.treasureChestBonusDollars, "expected chest prize to be added to bonus total");
    },
  },
  {
    name: "trash bag subtracts money and bursts in bonus",
    run: () => {
      const fishField = [
        createFish({
          id: 1,
          kind: "trashBag",
          x: 0,
          y: CONFIG.surfaceY - 8,
          hitHalfW: 1.0,
          hitHalfH: 0.72,
          sizeScale: CONFIG.trashBagUnderwaterSize,
          economyTierId: "trashBag",
          economyName: "Trash Bag",
          economyValue: 0,
        }),
      ];
      const game = new GameApp({
        initialHasSeenTrashTutorial: true,
        createFishField: () => fishField.map((fish) => ({ ...fish })),
      });
      startGame(game);
      assert(
        advanceUntil(
          game,
          () => {
            const state = game.getRenderState();
            return state.appState === "BonusToss" && state.bonusFish.some((fish) => fish.kind === "trashBag" && fish.active);
          },
          4.5,
        ),
        "expected bonus toss to include an active trash bag",
      );
      const renderState = game.getRenderState();
      const bag = renderState.bonusFish.find((fish) => fish.kind === "trashBag" && fish.active);
      assert(bag, "expected active trash bag");
      const point = worldToLogicalPoint(
        bag.x,
        bag.y,
        renderState.logicalWidth,
        renderState.logicalHeight,
        renderState.camera.centerY,
        renderState.camera.halfHeightScale,
      );
      game.update(0, [{ type: "bonusTap", x: point.x, y: point.y }]);
      const burstEvents = game.drainEvents();
      assert(burstEvents.some((event) => event.type === "trashBagBurst"), "expected trash bag burst event");
      assert(advanceUntil(game, () => Boolean(game.getDebugState().overlay.result), 5.0), "expected result overlay payload");
      const overlay = game.getDebugState().overlay.result;
      assert(Boolean(overlay), "expected result overlay payload");
      assert(overlay!.trashPenaltyDollars === CONFIG.trashBagPenaltyDollars, "expected trash penalty in result");
      assert(
        overlay!.totalDollars === overlay!.haul.fishPayout + overlay!.bonusDollars - overlay!.trashPenaltyDollars,
        "expected trash penalty to reduce the final total",
      );
    },
  },
  {
    name: "result total equals fish payout plus bonus",
    run: () => {
      const fishField = [
        createFish({ id: 1, x: 0, y: CONFIG.surfaceY - 8, hitHalfW: 1.8, hitHalfH: 0.8 }),
        createFish({ id: 2, x: 2.1, y: CONFIG.surfaceY - 2.8, economyTierId: "tuna", economyName: "Tuna", economyValue: 1000, artVariant: 2 }),
      ];
      const game = new GameApp({ createFishField: () => fishField.map((fish) => ({ ...fish })) });
      startGame(game);
      assert(advanceUntil(game, () => game.getDebugState().phase === "Ascent", 1.2), "expected the run to reach ascent");
      steerToWorldX(game, 2.1, CONFIG.surfaceY - 2.8);
      assert(
        advanceUntil(
          game,
          () => {
            const state = game.getRenderState();
            return state.appState === "BonusToss" && state.bonusFish.some((fish) => fish.active);
          },
          3.0,
        ),
        "expected to reach bonus toss with an active target",
      );
      assert(tapActiveBonusFish(game), "expected bonus tap to add value");
      assert(advanceUntil(game, () => Boolean(game.getDebugState().overlay.result), 5.0), "expected result overlay payload");
      const overlay = game.getDebugState().overlay.result;
      assert(Boolean(overlay), "expected result overlay payload");
      assert(
        overlay!.totalDollars === overlay!.haul.fishPayout + overlay!.bonusDollars - overlay!.trashPenaltyDollars + overlay!.goldenReelBonusDollars,
        "expected total to match fish payout plus bonus minus penalties",
      );
    },
  },
  {
    name: "retry returns to ready and waits for tap to drop",
    run: () => {
      const fishField = [createFish({ id: 1, x: 0, y: CONFIG.surfaceY - 5, hitHalfW: 1.8, hitHalfH: 0.8 })];
      const game = new GameApp({ createFishField: () => fishField.map((fish) => ({ ...fish })) });
      startGame(game);
      assert(advanceUntil(game, () => Boolean(game.getDebugState().overlay.result), 5.0), "expected result overlay payload");
      game.update(0, [{ type: "retryRun" }]);
      const state = game.getDebugState();
      assert(state.appState === "Ready", "expected retry to return to ready");
      assert(game.getRenderState().overlay.mode === "ready", "expected ready overlay after retry");
    },
  },
];

let failures = 0;
for (const test of tests) {
  try {
    test.run();
    console.log(`PASS ${test.name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${test.name}`);
    console.error(error instanceof Error ? error.stack ?? error.message : error);
  }
}

if (failures > 0) {
  throw new Error(`${failures} test(s) failed`);
}

console.log(`PASS ${tests.length} tests`);
