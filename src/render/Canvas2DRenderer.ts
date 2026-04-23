import type { LoadedAssets } from "../platform/AssetLoader.js";
import type { DrawImageOptions, GameRenderer, TextStyle } from "./GameRenderer.js";

export class Canvas2DRenderer implements GameRenderer {
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly assets: LoadedAssets,
    readonly width: number,
    readonly height: number,
  ) {}

  clear(color = "#020c18"): void {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.restore();
  }

  pushTranslate(x: number, y: number): void {
    this.ctx.save();
    this.ctx.translate(x, y);
  }

  pushScale(scaleX: number, scaleY: number, originX = 0, originY = 0): void {
    this.ctx.save();
    this.ctx.translate(originX, originY);
    this.ctx.scale(scaleX, scaleY);
    this.ctx.translate(-originX, -originY);
  }

  pushRotate(degrees: number, originX = 0, originY = 0): void {
    this.ctx.save();
    this.ctx.translate(originX, originY);
    this.ctx.rotate((degrees * Math.PI) / 180);
    this.ctx.translate(-originX, -originY);
  }

  pop(): void {
    this.ctx.restore();
  }

  drawRect(color: string, x: number, y: number, width: number, height: number, alpha = 1): void {
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, width, height);
    this.ctx.restore();
  }

  drawEllipse(color: string, centerX: number, centerY: number, radiusX: number, radiusY: number, alpha = 1): void {
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  drawLine(color: string, width: number, x1: number, y1: number, x2: number, y2: number, alpha = 1): void {
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.lineCap = "round";
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawImage(id: string, x: number, y: number, width: number, height: number, options: DrawImageOptions = {}): void {
    const img = this.assets.images[id as keyof typeof this.assets.images];
    if (!img) return;
    const {
      alpha = 1,
      flipX = false,
      rotationDegrees = 0,
      anchorX = 0.5,
      anchorY = 0.5,
      filter = "none",
      shadowColor,
      shadowBlur = 0,
    } = options;
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.filter = filter;
    if (shadowColor) {
      this.ctx.shadowColor = shadowColor;
      this.ctx.shadowBlur = shadowBlur;
    }
    this.ctx.translate(x, y);
    this.ctx.rotate((rotationDegrees * Math.PI) / 180);
    this.ctx.scale(flipX ? -1 : 1, 1);
    this.ctx.drawImage(img, -width * anchorX, -height * anchorY, width, height);
    this.ctx.restore();
  }

  drawText(text: string, x: number, y: number, width: number, _height: number, style: TextStyle): void {
    this.ctx.save();
    this.ctx.fillStyle = style.color;
    this.ctx.textAlign = style.align ?? "left";
    this.ctx.textBaseline = style.baseline ?? "middle";
    this.ctx.font = `${style.fontWeight ?? "bold"} ${style.fontSize}px ${style.fontFamily ?? "Arial Black, Impact, sans-serif"}`;
    if (style.shadowColor) {
      this.ctx.shadowColor = style.shadowColor;
      this.ctx.shadowBlur = style.shadowBlur ?? 0;
    }
    if (style.strokeColor && style.strokeWidth) {
      this.ctx.lineJoin = "round";
      this.ctx.strokeStyle = style.strokeColor;
      this.ctx.lineWidth = style.strokeWidth;
      this.ctx.strokeText(text, x, y, width);
    }
    this.ctx.fillText(text, x, y, width);
    this.ctx.restore();
  }
}
