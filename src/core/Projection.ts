import { CONFIG } from "./Config.js";

export function cameraHalfHeight(scale: number): number {
  return CONFIG.cameraHalfHeight * scale;
}

export function cameraHalfWidth(
  logicalWidth: number,
  logicalHeight: number,
  scale: number,
): number {
  return cameraHalfHeight(scale) * (logicalWidth / logicalHeight);
}

export function logicalToWorldX(
  logicalX: number,
  logicalWidth: number,
  logicalHeight: number,
  scale: number,
): number {
  const halfW = cameraHalfWidth(logicalWidth, logicalHeight, scale);
  const t = logicalX / logicalWidth;
  return -halfW + t * halfW * 2;
}

export function worldToLogicalPoint(
  worldX: number,
  worldY: number,
  logicalWidth: number,
  logicalHeight: number,
  cameraCenterY: number,
  scale: number,
): { x: number; y: number } {
  const halfH = cameraHalfHeight(scale);
  const halfW = cameraHalfWidth(logicalWidth, logicalHeight, scale);
  return {
    x: ((worldX + halfW) / (halfW * 2)) * logicalWidth,
    y: ((cameraCenterY + halfH - worldY) / (halfH * 2)) * logicalHeight,
  };
}
