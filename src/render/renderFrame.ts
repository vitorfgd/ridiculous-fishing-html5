import {
  CONFIG,
  FISH_ART_ASPECTS,
  FISH_TYPES,
  TRASH_BAG_ASPECT,
  TREASURE_CHEST_ASPECTS,
  type FishArtVariant,
} from "../core/Config.js";
import { cameraHalfHeight, worldToLogicalPoint } from "../core/Projection.js";
import { AssetIds } from "./AssetIds.js";
import type { Canvas2DRenderer } from "./Canvas2DRenderer.js";
import type { RenderState, TextFloaterState } from "./RenderState.js";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function fract(v: number): number {
  return v - Math.floor(v);
}

function hash01(n: number): number {
  return fract(Math.sin(n * 127.1) * 43758.5453123);
}

function project(
  state: RenderState,
  worldX: number,
  worldY: number,
): { x: number; y: number; scale: number } {
  const halfH = cameraHalfHeight(state.camera.halfHeightScale);
  const base = worldToLogicalPoint(
    worldX + Math.sin(state.time * 44.3) * state.camera.shake * 0.2,
    worldY + Math.cos(state.time * 57.1) * state.camera.shake * 0.18,
    state.logicalWidth,
    state.logicalHeight,
    state.camera.centerY,
    state.camera.halfHeightScale,
  );
  return {
    x: base.x,
    y: base.y,
    scale: state.logicalHeight / (halfH * 2),
  };
}

function drawCloudCluster(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  height: number,
  seed: number,
  alpha: number,
): void {
  const puffs = 7;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < puffs; i++) {
    const t = i / Math.max(1, puffs - 1);
    const nx = (t - 0.5) * width * 0.84 + (hash01(seed + i * 1.77) - 0.5) * width * 0.12;
    const ny = (hash01(seed + i * 3.11) - 0.5) * height * 0.32 - Math.sin(t * Math.PI) * height * 0.1;
    const rx = lerp(width * 0.12, width * 0.23, Math.sin((t + 0.1) * Math.PI));
    const ry = lerp(height * 0.24, height * 0.5, hash01(seed + i * 2.63));
    const gx = cx + nx;
    const gy = cy + ny;
    const puff = ctx.createRadialGradient(gx, gy, rx * 0.08, gx, gy, rx);
    puff.addColorStop(0, "rgba(255,250,240,0.96)");
    puff.addColorStop(0.58, "rgba(248,250,255,0.8)");
    puff.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = puff;
    ctx.beginPath();
    ctx.ellipse(gx, gy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = alpha * 0.42;
  const base = ctx.createLinearGradient(cx, cy - height * 0.25, cx, cy + height * 0.55);
  base.addColorStop(0, "rgba(255,255,255,0)");
  base.addColorStop(0.4, "rgba(255,247,230,0.42)");
  base.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.ellipse(cx, cy + height * 0.08, width * 0.54, height * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLightRays(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  surfaceYLogical: number,
): void {
  const shallowRayEndY = project(state, 0, CONFIG.surfaceY - 30).y;
  const maxDepth = Math.min(state.logicalHeight - surfaceYLogical, shallowRayEndY - surfaceYLogical);
  if (maxDepth <= 12) return;
  const shaftCount = 5;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < shaftCount; i++) {
    const t = state.time * (0.028 + i * 0.004);
    const seed = i * 9.17;
    const centerX = (0.1 + i / shaftCount) * state.logicalWidth + Math.sin(t + seed) * 30;
    const spreadTop = 34 + hash01(seed) * 28;
    const spreadBottom = spreadTop * (1.35 + hash01(seed + 1.2) * 0.35);
    const leanSign = i % 2 === 0 ? -1 : 1;
    const lean = leanSign * (54 + hash01(seed + 2.3) * 30);
    const alpha = 0.022 + hash01(seed + 5.7) * 0.018;
    const poly = new Path2D();
    poly.moveTo(centerX - spreadTop * 0.5, surfaceYLogical - 10);
    poly.lineTo(centerX + spreadTop * 0.5, surfaceYLogical - 10);
    poly.lineTo(centerX + lean + spreadBottom * 0.5, surfaceYLogical + maxDepth);
    poly.lineTo(centerX + lean - spreadBottom * 0.5, surfaceYLogical + maxDepth);
    poly.closePath();
    const beam = ctx.createLinearGradient(centerX, surfaceYLogical - 10, centerX + lean, surfaceYLogical + maxDepth);
    beam.addColorStop(0, `rgba(214, 255, 240, ${alpha * 1.35})`);
    beam.addColorStop(0.22, `rgba(166, 246, 232, ${alpha * 0.82})`);
    beam.addColorStop(0.55, `rgba(92, 210, 205, ${alpha * 0.34})`);
    beam.addColorStop(1, "rgba(50, 140, 165, 0)");
    ctx.fillStyle = beam;
    ctx.fill(poly);
  }
  ctx.restore();
}

function drawDeepDepthBands(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  surfaceYLogical: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.filter = "blur(8px)";

  const bandCount = 5;
  for (let i = 0; i < bandCount; i++) {
    const seed = i * 13.17;
    const depth = 36 + i * 16 + hash01(seed + 0.5) * 10;
    if (depth > 120) continue;

    const centerY = project(state, 0, CONFIG.surfaceY - depth).y;
    if (centerY < surfaceYLogical + 24 || centerY > state.logicalHeight + 70) continue;

    const centerX =
      state.logicalWidth * (0.14 + i * 0.18) +
      Math.sin(state.time * (0.08 + i * 0.012) + seed) * 20;
    const bandWidth = 180 + hash01(seed + 1.8) * 110;
    const bandHeight = 24 + hash01(seed + 2.7) * 18;
    const slant = (i % 2 === 0 ? 1 : -1) * (72 + hash01(seed + 3.4) * 58);
    const alpha = 0.022 + (1 - (depth - 36) / 84) * 0.022;

    const x1 = centerX - bandWidth * 0.5;
    const x2 = centerX + bandWidth * 0.5;
    const y1 = centerY - bandHeight * 0.5;
    const y2 = centerY + bandHeight * 0.5;

    const poly = new Path2D();
    poly.moveTo(x1, y1);
    poly.lineTo(x2, y1);
    poly.lineTo(x2 + slant, y2);
    poly.lineTo(x1 + slant, y2);
    poly.closePath();

    const gradient = ctx.createLinearGradient(x1, centerY, x2 + slant, centerY);
    gradient.addColorStop(0, "rgba(160, 238, 228, 0)");
    gradient.addColorStop(0.18, `rgba(134, 224, 214, ${alpha * 0.45})`);
    gradient.addColorStop(0.5, `rgba(170, 248, 236, ${alpha})`);
    gradient.addColorStop(0.82, `rgba(120, 214, 206, ${alpha * 0.42})`);
    gradient.addColorStop(1, "rgba(160, 238, 228, 0)");

    ctx.fillStyle = gradient;
    ctx.fill(poly);

    ctx.filter = "blur(14px)";
    ctx.fillStyle = `rgba(178, 252, 238, ${alpha * 0.28})`;
    ctx.fill(poly);
    ctx.filter = "blur(8px)";
  }

  ctx.filter = "none";
  ctx.restore();
}

function drawSky(renderer: Canvas2DRenderer, state: RenderState, surfaceYLogical: number): void {
  const { ctx } = renderer;
  const gradient = ctx.createLinearGradient(0, 0, 0, surfaceYLogical);
  gradient.addColorStop(0, "#072765");
  gradient.addColorStop(0.26, "#1550aa");
  gradient.addColorStop(0.62, "#3b8fe4");
  gradient.addColorStop(1, "#c8e3ff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.logicalWidth, surfaceYLogical + 90);

  ctx.save();
  const haze = ctx.createLinearGradient(0, 0, 0, surfaceYLogical);
  haze.addColorStop(0, "rgba(255,255,255,0)");
  haze.addColorStop(0.72, "rgba(155,205,255,0.05)");
  haze.addColorStop(1, "rgba(255,225,180,0.18)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, state.logicalWidth, surfaceYLogical + 80);
  ctx.restore();

  const cloudTime = state.background.time;
  const clouds = [
    { x: 0.24, y: 0.23, w: 0.27, h: 0.11, drift: 0.009, alpha: 0.9, seed: 2.1 },
    { x: 0.67, y: 0.37, w: 0.21, h: 0.085, drift: 0.006, alpha: 0.8, seed: 5.6 },
    { x: -0.08, y: 0.16, w: 0.18, h: 0.07, drift: 0.013, alpha: 0.62, seed: 8.4 },
  ];
  for (const cloud of clouds) {
    const cx = fract(cloud.x + cloudTime * cloud.drift) * state.logicalWidth;
    const cy = cloud.y * surfaceYLogical;
    drawCloudCluster(
      ctx,
      cx,
      cy,
      cloud.w * state.logicalWidth,
      cloud.h * state.logicalHeight,
      cloud.seed,
      cloud.alpha,
    );
  }

  if (state.background.bonusSkyCheer > 0.01) {
    ctx.save();
    ctx.globalAlpha = state.background.bonusSkyCheer * 0.24;
    const cheer = ctx.createLinearGradient(0, 0, 0, surfaceYLogical);
    cheer.addColorStop(0, "#ffe1aa");
    cheer.addColorStop(1, "#8fdbff");
    ctx.fillStyle = cheer;
    ctx.fillRect(0, 0, state.logicalWidth, surfaceYLogical + 60);
    ctx.restore();
  }
}

function drawSea(renderer: Canvas2DRenderer, state: RenderState, surfaceYLogical: number): void {
  const { ctx } = renderer;
  const gradient = ctx.createLinearGradient(0, surfaceYLogical, 0, state.logicalHeight);
  gradient.addColorStop(0, "#14a393");
  gradient.addColorStop(0.25, "#0d6d78");
  gradient.addColorStop(0.56, "#0a3c53");
  gradient.addColorStop(1, "#04142c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, surfaceYLogical, state.logicalWidth, state.logicalHeight - surfaceYLogical);

  drawLightRays(ctx, state, surfaceYLogical);

  const halfH = cameraHalfHeight(state.camera.halfHeightScale);
  const topWorld = state.camera.centerY + halfH;
  const bottomWorld = state.camera.centerY - halfH;
  const startDepth = Math.max(0, Math.floor((CONFIG.surfaceY - topWorld) / CONFIG.depthStripeIntervalM) * CONFIG.depthStripeIntervalM);
  const endDepth = Math.max(0, CONFIG.surfaceY - bottomWorld + CONFIG.depthStripeIntervalM);

  ctx.save();
  for (let depth = startDepth; depth <= endDepth; depth += CONFIG.depthStripeIntervalM) {
    const lineY = project(state, 0, CONFIG.surfaceY - depth).y;
    ctx.strokeStyle = "rgba(80, 175, 190, 0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(state.logicalWidth, lineY);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 9; i++) {
    const offsetY = surfaceYLogical + i * 18 + Math.sin(state.time * 0.75 + i * 0.6) * 8;
    if (offsetY > surfaceYLogical + 165) break;
    ctx.lineWidth = 5 + (i % 3);
    for (let band = 0; band < 2; band++) {
      const bandAlpha = (0.055 - i * 0.0055) * (band === 0 ? 1 : 0.52);
      if (bandAlpha <= 0) continue;
      ctx.strokeStyle = `rgba(${band === 0 ? "186, 255, 238" : "121, 225, 215"}, ${bandAlpha})`;
      ctx.beginPath();
      for (let x = 0; x <= state.logicalWidth + 20; x += 18) {
        const y =
          offsetY +
          Math.sin(x * 0.028 + state.time * (0.9 + band * 0.15) + i * 0.8) * (6 + band * 2) +
          Math.sin(x * 0.011 - state.time * 0.42 + i * 0.5) * 4;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();

  drawDeepDepthBands(ctx, state, surfaceYLogical);
}

function drawSurface(renderer: Canvas2DRenderer, state: RenderState, surfaceYLogical: number): void {
  const { ctx } = renderer;
  ctx.save();
  ctx.globalAlpha = 0.94;
  const height = 18;
  const gradient = ctx.createLinearGradient(0, surfaceYLogical - height / 2, 0, surfaceYLogical + height / 2);
  gradient.addColorStop(0, "rgba(210, 245, 255, 0.95)");
  gradient.addColorStop(1, "rgba(126, 220, 255, 0.68)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(0, surfaceYLogical);
  for (let x = 0; x <= state.logicalWidth; x += 24) {
    const y = surfaceYLogical + Math.sin(state.time * 2.2 + x * 0.06) * 3 + Math.sin(state.time * 1.7 + x * 0.11) * 1.4;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(state.logicalWidth, surfaceYLogical + height);
  ctx.lineTo(0, surfaceYLogical + height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFisherman(renderer: Canvas2DRenderer, state: RenderState): void {
  const p = project(state, -4.8, CONFIG.surfaceY - 1.2);
  const height = 7.2 * p.scale;
  const width = height * (612 / 408);
  renderer.drawImage(AssetIds.fisherman, p.x, p.y, width, height, {
    anchorX: 0.5,
    anchorY: 1,
  });
}

function fishAssetId(variant: FishArtVariant): string {
  return variant === 0
    ? AssetIds.fishClassic
    : variant === 1
      ? AssetIds.fishSnapper
      : variant === 2
        ? AssetIds.fishAngler
        : variant === 3
          ? AssetIds.fishJellyfish
          : AssetIds.fishShark;
}

function chestAssetId(chestState: "locked" | "open" = "locked"): string {
  return chestState === "open" ? AssetIds.treasureChestOpen : AssetIds.treasureChestLocked;
}

function trashBagAssetId(): string {
  return AssetIds.trashBag;
}

function fishWorldSize(typeIndex: number, sizeScale: number, artVariant: FishArtVariant): { width: number; height: number } {
  const type = FISH_TYPES[typeIndex % FISH_TYPES.length]!;
  const variantMul =
    artVariant === 3 ? 1.04 : artVariant === 4 ? 1.16 : artVariant === 2 ? 0.92 : 1;
  const width = 1.52 * type.scale * sizeScale * variantMul;
  const height = width / FISH_ART_ASPECTS[artVariant];
  return { width, height };
}

function chestWorldSize(
  sizeScale: number,
  chestState: "locked" | "open" = "locked",
): { width: number; height: number } {
  const width = 1.46 * sizeScale;
  const height = width / TREASURE_CHEST_ASPECTS[chestState];
  return { width, height };
}

function trashBagWorldSize(sizeScale: number): { width: number; height: number } {
  const width = 1.74 * sizeScale;
  const height = width / TRASH_BAG_ASPECT;
  return { width, height };
}

function drawFish(renderer: Canvas2DRenderer, state: RenderState): void {
  for (const fish of state.fish) {
    const p = project(state, fish.x, fish.y);
    if (fish.kind === "treasureChest") {
      const size = chestWorldSize(fish.sizeScale, fish.chestState ?? "locked");
      renderer.drawImage(
        chestAssetId(fish.chestState ?? "locked"),
        p.x,
        p.y,
        size.width * p.scale,
        size.height * p.scale,
        {
          rotationDegrees: (fish.rotation * 180) / Math.PI,
          shadowColor: "rgba(255, 218, 112, 0.42)",
          shadowBlur: 10,
          filter: fish.state === "snap" ? "brightness(1.14)" : "none",
        },
      );
      continue;
    }
    if (fish.kind === "trashBag") {
      const size = trashBagWorldSize(fish.sizeScale);
      renderer.drawImage(
        trashBagAssetId(),
        p.x,
        p.y,
        size.width * p.scale,
        size.height * p.scale,
        {
          rotationDegrees: (fish.rotation * 180) / Math.PI,
          shadowColor: "rgba(96, 84, 64, 0.35)",
          shadowBlur: 10,
          filter: fish.state === "snap" ? "brightness(1.06)" : "none",
        },
      );
      continue;
    }
    const size = fishWorldSize(fish.typeIndex, fish.sizeScale, fish.artVariant);
    renderer.drawImage(fishAssetId(fish.artVariant), p.x, p.y, size.width * p.scale, size.height * p.scale, {
      flipX: fish.faceRight,
      rotationDegrees: (fish.rotation * 180) / Math.PI,
      shadowColor: fish.artVariant === 0 ? fish.accentHex : undefined,
      shadowBlur: fish.artVariant === 0 ? 8 : 0,
      filter: fish.state === "snap" ? "brightness(1.1)" : "none",
    });
  }
}

function drawHook(renderer: Canvas2DRenderer, state: RenderState): void {
  const hookPoint = project(state, state.hook.x, state.hook.y);
  const rodPoint = project(state, state.hook.lineStartX, state.hook.lineStartY);

  for (let i = 1; i < state.hook.trail.length; i++) {
    const a = project(state, state.hook.trail[i - 1]!.x, state.hook.trail[i - 1]!.y);
    const b = project(state, state.hook.trail[i]!.x, state.hook.trail[i]!.y);
    const alpha = (i / state.hook.trail.length) * (state.phase === "Descent" ? 0.68 : 0.42);
    renderer.drawLine("#9ecbff", 2, a.x, a.y, b.x, b.y, alpha);
  }

  renderer.drawLine("#f2f6ff", 2, rodPoint.x, rodPoint.y, hookPoint.x, hookPoint.y, 0.92);
  renderer.drawEllipse("#d6deea", hookPoint.x, hookPoint.y, state.hook.radius * hookPoint.scale, state.hook.radius * hookPoint.scale, 1);
  renderer.drawEllipse("#98b7d8", hookPoint.x + 3, hookPoint.y - 3, state.hook.radius * hookPoint.scale * 0.35, state.hook.radius * hookPoint.scale * 0.35, 0.65);

  for (const caught of state.hook.caughtStack) {
    const swingX = Math.sin(state.hook.caughtSwing) * Math.abs(caught.offsetY) * 0.35;
    const p = project(state, state.hook.x + swingX, state.hook.y + caught.offsetY);
    if (caught.kind === "treasureChest") {
      const size = chestWorldSize(caught.sizeScale, caught.chestState ?? "locked");
      renderer.drawImage(
        chestAssetId(caught.chestState ?? "locked"),
        p.x,
        p.y,
        size.width * p.scale * state.hook.caughtScale,
        size.height * p.scale * state.hook.caughtScale,
        {
          rotationDegrees: (state.hook.caughtSwing * 180) / Math.PI,
          shadowColor: "rgba(255, 218, 112, 0.36)",
          shadowBlur: 8,
        },
      );
      continue;
    }
    if (caught.kind === "trashBag") {
      const size = trashBagWorldSize(caught.sizeScale);
      renderer.drawImage(
        trashBagAssetId(),
        p.x,
        p.y,
        size.width * p.scale * state.hook.caughtScale,
        size.height * p.scale * state.hook.caughtScale,
        {
          rotationDegrees: (state.hook.caughtSwing * 180) / Math.PI,
          shadowColor: "rgba(96, 84, 64, 0.28)",
          shadowBlur: 7,
        },
      );
      continue;
    }
    const size = fishWorldSize(caught.typeIndex, caught.sizeScale, caught.artVariant);
    renderer.drawImage(
      fishAssetId(caught.artVariant),
      p.x,
      p.y,
      size.width * p.scale * state.hook.caughtScale,
      size.height * p.scale * state.hook.caughtScale,
      {
        flipX: caught.faceRight,
        rotationDegrees: (state.hook.caughtSwing * 180) / Math.PI,
      },
    );
  }
}

function drawBonusFish(renderer: Canvas2DRenderer, state: RenderState): void {
  for (const fish of state.bonusFish) {
    if (!fish.active) continue;
    const p = project(state, fish.x, fish.y);
    if (fish.kind === "treasureChest") {
      const height = 0.98 * p.scale * CONFIG.treasureChestBonusTargetSize;
      const width = height * TREASURE_CHEST_ASPECTS[fish.chestState ?? "locked"];
      renderer.drawImage(chestAssetId(fish.chestState ?? "locked"), p.x, p.y, width, height, {
        filter: fish.aboveWater ? "none" : "brightness(1.06) saturate(0.82)",
        shadowColor: "rgba(255, 208, 88, 0.4)",
        shadowBlur: 12,
      });
      continue;
    }
    if (fish.kind === "trashBag") {
      const height = 1.02 * p.scale * CONFIG.trashBagBonusTargetSize;
      const width = height * TRASH_BAG_ASPECT;
      renderer.drawImage(trashBagAssetId(), p.x, p.y, width, height, {
        filter: fish.aboveWater ? "none" : "brightness(1.03) saturate(0.86)",
        shadowColor: "rgba(88, 74, 52, 0.28)",
        shadowBlur: 10,
      });
      continue;
    }
    const height = 0.92 * p.scale;
    const width = height * FISH_ART_ASPECTS[fish.artVariant];
    renderer.drawImage(fishAssetId(fish.artVariant), p.x, p.y, width, height, {
      flipX: fish.faceRight,
      filter: fish.aboveWater ? "none" : "brightness(1.05) saturate(0.7)",
    });
  }
}

function drawEffects(renderer: Canvas2DRenderer, state: RenderState): void {
  for (const bubble of state.effects.bubbles) {
    const p = project(state, bubble.x, bubble.y);
    const radius = bubble.radius * p.scale;
    renderer.drawImage(AssetIds.bubble, p.x, p.y, radius * 2.3, radius * 2.3, {
      alpha: bubble.alpha,
    });
  }

  for (const particle of state.effects.particles) {
    const p = project(state, particle.x, particle.y);
    renderer.drawEllipse(particle.color, p.x, p.y, particle.radius * p.scale, particle.radius * p.scale, particle.alpha);
  }

  for (const floater of state.effects.floaters) {
    drawFloater(renderer, state, floater);
  }
}

function drawFloater(renderer: Canvas2DRenderer, state: RenderState, floater: TextFloaterState): void {
  const p = project(state, floater.x, floater.y);
  const colors = {
    default: "#ffe760",
    nearMiss: "#8ef6ff",
    bonus: "#ffe760",
    bonusHot: "#ff9d2f",
  } as const;
  const size =
    floater.variant === "nearMiss" ? 18 : floater.variant === "bonusHot" ? 30 : floater.variant === "bonus" ? 24 : 20;
  renderer.drawText(floater.text, p.x, p.y, 180, 40, {
    fontSize: size * floater.scale,
    fontWeight: "900",
    color: colors[floater.variant],
    align: "center",
    baseline: "middle",
    strokeColor: "#000000",
    strokeWidth: 4,
    shadowColor: floater.variant === "bonusHot" ? "rgba(255,136,0,0.55)" : "rgba(255,224,0,0.45)",
    shadowBlur: floater.variant === "nearMiss" ? 2 : 10,
  });
}

function drawTreasureChestCinematic(renderer: Canvas2DRenderer, state: RenderState): void {
  const cinematic = state.treasureChestCinematic;
  if (!cinematic?.active) return;

  const { ctx } = renderer;
  const centerX = state.logicalWidth * 0.5;
  const centerY = state.logicalHeight * 0.48;
  const shakeX = Math.sin(state.time * 58) * cinematic.shake * 14;
  const shakeY = Math.cos(state.time * 47) * cinematic.shake * 10;
  const chestState = cinematic.opened ? "open" : "locked";
  const easeOut = 1 - Math.pow(1 - cinematic.progress, 3);
  const flare = cinematic.opened ? Math.sin(Math.min(1, cinematic.progress) * Math.PI) : 0;
  const baseHeight = state.logicalHeight * 0.23 * cinematic.chestScale;
  const baseWidth = baseHeight * TREASURE_CHEST_ASPECTS[chestState];

  ctx.save();
  ctx.fillStyle = "rgba(4, 12, 28, 0.52)";
  ctx.fillRect(0, 0, state.logicalWidth, state.logicalHeight);
  ctx.restore();

  ctx.save();
  const halo = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, baseWidth * 1.2);
  halo.addColorStop(0, `rgba(255, 247, 196, ${(0.92 + flare * 0.18) * cinematic.lightAlpha})`);
  halo.addColorStop(0.35, `rgba(255, 216, 96, ${(0.55 + flare * 0.2) * cinematic.lightAlpha})`);
  halo.addColorStop(1, "rgba(255, 216, 96, 0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(centerX, centerY, baseWidth * (1.2 + flare * 0.18), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (cinematic.lightAlpha > 0.04) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.filter = "blur(18px)";
    const burst = ctx.createRadialGradient(centerX, centerY, 12, centerX, centerY, baseWidth * 0.92);
    burst.addColorStop(0, `rgba(255,255,255,${0.95 * cinematic.lightAlpha})`);
    burst.addColorStop(0.48, `rgba(255,240,174,${0.82 * cinematic.lightAlpha})`);
    burst.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = burst;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, baseWidth * 0.9, baseHeight * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = "none";
    ctx.restore();
  }

  if (cinematic.opened) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = `rgba(255, 236, 170, ${0.3 + flare * 0.24})`;
    ctx.lineWidth = 4;
    for (let i = 0; i < 6; i++) {
      const angle = (-0.75 + i * 0.3) * Math.PI;
      const inner = baseWidth * 0.36;
      const outer = baseWidth * (0.85 + easeOut * 0.18);
      ctx.beginPath();
      ctx.moveTo(centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner * 0.72);
      ctx.lineTo(centerX + Math.cos(angle) * outer, centerY + Math.sin(angle) * outer * 0.72);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderer.drawImage(
    chestAssetId(chestState),
    centerX + shakeX,
    centerY + shakeY,
    baseWidth,
    baseHeight,
    {
      anchorX: 0.5,
      anchorY: 0.55,
      shadowColor: "rgba(255, 208, 88, 0.58)",
      shadowBlur: 22,
      filter: cinematic.opened ? "brightness(1.08)" : "none",
    },
  );

  if (cinematic.lightAlpha > 0.55) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = `rgba(255, 255, 255, ${0.28 * cinematic.lightAlpha})`;
    ctx.fillRect(0, 0, state.logicalWidth, state.logicalHeight);
    ctx.restore();
  }

  renderer.drawText(cinematic.prizeText, centerX, state.logicalHeight * 0.76, 320, 60, {
    fontSize: 36 + flare * 4,
    fontWeight: "900",
    color: "#ffe760",
    align: "center",
    baseline: "middle",
    strokeColor: "#000000",
    strokeWidth: 5,
    shadowColor: "rgba(255, 196, 0, 0.55)",
    shadowBlur: 16,
  });
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const v = hex.replace("#", "");
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

function drawTutorialSpotlight(renderer: Canvas2DRenderer, state: RenderState): void {
  if (!state.tutorialSpotlight) return;
  const sp = state.tutorialSpotlight;
  const pos = project(state, sp.worldX, sp.worldY);
  const ctx = renderer.ctx;
  const t = state.time;
  const { r, g, b } = hexToRgb(sp.color);
  const pulse = 0.5 + 0.5 * Math.sin(t * 4.8);
  const baseRadius = pos.scale * 2.8;
  const innerR = baseRadius * (1 + pulse * 0.07);
  const outerR = innerR * 1.5;

  ctx.save();

  // Dark vignette to draw focus to the target
  const grad = ctx.createRadialGradient(pos.x, pos.y, innerR * 0.5, pos.x, pos.y, outerR * 3.5);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.52)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, state.logicalWidth, state.logicalHeight);

  // Outer soft glow ring
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, outerR, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${r},${g},${b},${0.28 + pulse * 0.15})`;
  ctx.lineWidth = 9;
  ctx.stroke();

  // Sharp inner ring with glow
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, innerR, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${r},${g},${b},1)`;
  ctx.lineWidth = 3.5;
  ctx.shadowColor = `rgba(${r},${g},${b},0.9)`;
  ctx.shadowBlur = 20;
  ctx.stroke();

  // Slow rotating dashes
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(t * 1.2);
  ctx.setLineDash([innerR * 0.5, innerR * 0.32]);
  ctx.beginPath();
  ctx.arc(0, 0, innerR * 1.22, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${r},${g},${b},${0.45 + pulse * 0.3})`;
  ctx.lineWidth = 2;
  ctx.shadowBlur = 0;
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

function drawTutorialHand(renderer: Canvas2DRenderer, state: RenderState): void {
  const hand = state.tutorialHand;
  if (!hand?.visible) return;

  const pulse = 0.5 + 0.5 * Math.sin(state.time * 5.6);
  const dragWave = Math.sin(state.time * 3.4);
  const dragArcT = (Math.sin(state.time * 2.7) + 1) * 0.5;
  // sweepHorizontal: oscillates slowly left → right → left
  const sweepT = (Math.sin(state.time * 1.35) + 1) * 0.5;

  const scale =
    hand.mode === "tapPulse"
      ? 0.88 + pulse * 0.1
      : hand.mode === "sweepHorizontal"
        ? 1.15 + Math.abs(dragWave) * 0.04
        : hand.mode === "dragHorizontal" || hand.mode === "arcUnderLure"
          ? 0.92 + Math.abs(dragWave) * 0.04
          : 0.92 + pulse * 0.05;

  let offsetX = 0;
  let offsetY = 0;
  let rotation = hand.rotationDeg;

  if (hand.mode === "dragHorizontal") {
    offsetX = dragWave * 28;
  } else if (hand.mode === "arcUnderLure") {
    const startX = -20;
    const startY = 10;
    const controlX = 0;
    const controlY = 20;
    const endX = 20;
    const endY = 10;
    const t = dragArcT;
    const invT = 1 - t;
    offsetX = invT * invT * startX + 2 * invT * t * controlX + t * t * endX;
    offsetY = invT * invT * startY + 2 * invT * t * controlY + t * t * endY;
    rotation = -110;
  } else if (hand.mode === "sweepHorizontal") {
    // Wide semi-circle arc: left edge → peak-center → right edge
    const spreadX = 155;
    const riseY = 120;
    const t = sweepT;
    const invT = 1 - t;
    // Quadratic bezier: (−spread, 0) → (0, +rise) → (+spread, 0)  — U-shape arc downward
    offsetX = invT * invT * (-spreadX) + 2 * invT * t * 0 + t * t * spreadX;
    offsetY = invT * invT * 0 + 2 * invT * t * riseY + t * t * 0;
    // Tilt hand in the direction of travel (inverted for downward arc)
    rotation = hand.rotationDeg - (sweepT - 0.5) * 28;
  } else if (hand.mode === "nudge") {
    offsetX = Math.sin(state.time * 4.1) * 10;
  }

  if (hand.mode === "tapPulse") {
    offsetY = Math.sin(state.time * 5.6) * 5;
  }

  const base =
    hand.anchor === "world"
      ? project(state, hand.x, hand.y)
      : { x: hand.x, y: hand.y, scale: hand.mode === "sweepHorizontal" ? 30 : 24 };
  const width = base.scale * 4.1 * scale;
  const height = width * (179 / 288);

  // For sweepHorizontal, draw a faint trail arc to reinforce the gesture path
  if (hand.mode === "sweepHorizontal") {
    const ctx = renderer.ctx;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 224, 0, 0.18)";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 10]);
    ctx.lineDashOffset = -state.time * 22;
    ctx.beginPath();
    const spreadX = 155;
    const riseY = 120;
    const steps = 32;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const it = 1 - t;
      const px = base.x + it * it * (-spreadX) + 2 * it * t * 0 + t * t * spreadX;
      const py = base.y + it * it * 0 + 2 * it * t * riseY + t * t * 0;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  renderer.drawImage(AssetIds.tutorialHand, base.x + offsetX, base.y + offsetY, width, height, {
    rotationDegrees: rotation,
    anchorX: 0.52,
    anchorY: 0.5,
    alpha: 0.96,
    shadowColor: "rgba(0,0,0,0.45)",
    shadowBlur: 10,
  });
}

export function renderFrame(renderer: Canvas2DRenderer, state: RenderState): void {
  renderer.clear("#020c18");
  const surfaceYLogical = project(state, 0, CONFIG.surfaceY).y;
  drawSky(renderer, state, surfaceYLogical);
  drawSea(renderer, state, surfaceYLogical);
    drawFisherman(renderer, state);
    drawEffects(renderer, state);
    drawFish(renderer, state);
    drawTutorialSpotlight(renderer, state);
    drawHook(renderer, state);
  drawBonusFish(renderer, state);
  drawSurface(renderer, state, surfaceYLogical);
  drawTreasureChestCinematic(renderer, state);
  drawTutorialHand(renderer, state);
}
