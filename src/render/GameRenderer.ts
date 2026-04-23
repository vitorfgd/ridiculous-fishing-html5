export type TextStyle = {
  fontSize: number;
  fontFamily?: string;
  fontWeight?: "normal" | "bold" | "900";
  color: string;
  align?: "left" | "center" | "right";
  baseline?: CanvasTextBaseline;
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
};

export type DrawImageOptions = {
  alpha?: number;
  flipX?: boolean;
  rotationDegrees?: number;
  anchorX?: number;
  anchorY?: number;
  filter?: string;
  shadowColor?: string;
  shadowBlur?: number;
};

export interface GameRenderer {
  clear(color?: string): void;
  pushTranslate(x: number, y: number): void;
  pushScale(scaleX: number, scaleY: number, originX?: number, originY?: number): void;
  pushRotate(degrees: number, originX?: number, originY?: number): void;
  pop(): void;
  drawRect(color: string, x: number, y: number, width: number, height: number, alpha?: number): void;
  drawEllipse(color: string, centerX: number, centerY: number, radiusX: number, radiusY: number, alpha?: number): void;
  drawLine(color: string, width: number, x1: number, y1: number, x2: number, y2: number, alpha?: number): void;
  drawImage(id: string, x: number, y: number, width: number, height: number, options?: DrawImageOptions): void;
  drawText(text: string, x: number, y: number, width: number, height: number, style: TextStyle): void;
}
