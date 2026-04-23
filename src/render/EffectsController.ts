import { CONFIG } from "../core/Config.js";
import type { RenderState } from "./RenderState.js";

type BubbleModel = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  speed: number;
  phase: number;
};

type ParticleModel = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  ttl: number;
  life: number;
  color: string;
  gravity: number;
};

type FloaterModel = {
  text: string;
  x: number;
  y: number;
  vy: number;
  ttl: number;
  life: number;
  variant: "default" | "nearMiss" | "bonus" | "bonusHot";
};

const BUBBLE_COUNT = 120;
const BUBBLE_DEPTH_MIN_M = 2;
const BUBBLE_DEPTH_MAX_M = 340;
const MAX_PARTICLES = 96;

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export class EffectsController {
  private bubbles: BubbleModel[] = [];
  private particles: ParticleModel[] = [];
  private floaters: FloaterModel[] = [];

  constructor() {
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      this.bubbles.push(this.makeAmbientBubble(i));
    }
  }

  handleEvents(events: RenderState["effects"]["floaters"][number][], _state?: RenderState): void {
    void events;
  }

  consumeGameEvents(events: import("./RenderState").GameEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case "nearMiss":
          this.floaters.push({
            text: "close",
            x: event.x,
            y: event.y + 0.6,
            vy: 0.9,
            ttl: 0.6,
            life: 0.6,
            variant: "nearMiss",
          });
          break;
        case "fishCaught":
          this.floaters.push({
            text: `+$${event.value}`,
            x: event.x,
            y: event.y,
            vy: 1.4,
            ttl: 0.9,
            life: 0.9,
            variant: "default",
          });
          break;
        case "treasureChestCaught":
          this.floaters.push({
            text: "CHEST!",
            x: event.x,
            y: event.y,
            vy: 1.25,
            ttl: 1.05,
            life: 1.05,
            variant: "bonusHot",
          });
          this.spawnTapBurst(event.x, event.y, 5);
          break;
        case "trashBagCaught":
          this.floaters.push({
            text: `-$${event.amount}`,
            x: event.x,
            y: event.y,
            vy: 1.15,
            ttl: 1.0,
            life: 1.0,
            variant: "default",
          });
          this.spawnTapBurst(event.x, event.y, 2);
          break;
        case "surfaceReached":
          this.spawnSurfaceBurst(event.x, event.y);
          break;
        case "bonusBanked":
          this.floaters.push({
            text: `+$${event.amount}`,
            x: event.x,
            y: event.y,
            vy: 1.6,
            ttl: 0.9,
            life: 0.9,
            variant: "bonus",
          });
          this.spawnLaunchBurst(event.x, event.y);
          break;
        case "bonusTapped":
          this.floaters.push({
            text: `+$${event.amount}`,
            x: event.x,
            y: event.y,
            vy: 1.8,
            ttl: 0.78,
            life: 0.78,
            variant: event.streak >= 3 ? "bonusHot" : "bonus",
          });
          this.spawnTapBurst(event.x, event.y, event.streak);
          break;
        case "treasureChestOpened":
          this.floaters.push({
            text: `+$${event.amount}`,
            x: 0,
            y: CONFIG.surfaceY + 5.8,
            vy: 1.9,
            ttl: 1.1,
            life: 1.1,
            variant: "bonusHot",
          });
          this.spawnTapBurst(0, CONFIG.surfaceY + 5.4, 8);
          this.spawnLaunchBurst(0, CONFIG.surfaceY + 5.2);
          break;
        case "trashBagBurst":
          this.floaters.push({
            text: "YUCK",
            x: event.x,
            y: event.y,
            vy: 1.4,
            ttl: 0.72,
            life: 0.72,
            variant: "nearMiss",
          });
          this.spawnTapBurst(event.x, event.y, 4);
          break;
        case "phaseChanged":
        case "resultShown":
          break;
      }
    }
  }

  update(dt: number, state: RenderState): void {
    const top = CONFIG.surfaceY - 0.25;
    const pull =
      state.appState === "Playing"
        ? state.phase === "Descent"
          ? 1
          : 0.28
        : state.appState === "SurfacePayoff"
          ? 0.22
          : state.appState === "BonusToss"
            ? 0.12
            : 0;

    for (let i = 0; i < this.bubbles.length; i++) {
      const bubble = this.bubbles[i]!;
      bubble.y += bubble.speed * dt;
      bubble.x += Math.sin(state.time * 1.35 + bubble.phase) * 0.018 * dt;
      if (bubble.y > top) {
        this.bubbles[i] = this.makeAmbientBubble(i + state.time);
      } else if (pull > 0.04 && Math.random() < pull * dt * 1.4 && i % 8 === 0) {
        this.bubbles[i] = this.makeHookBubble(state.hook.x, state.hook.y);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.ttl -= dt;
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, p.ttl / p.life);
      if (p.ttl <= 0) {
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const floater = this.floaters[i]!;
      floater.ttl -= dt;
      floater.y += floater.vy * dt;
      if (floater.ttl <= 0) {
        this.floaters.splice(i, 1);
      }
    }
  }

  getState(): RenderState["effects"] {
    return {
      bubbles: this.bubbles.map((bubble) => ({
        x: bubble.x,
        y: bubble.y,
        radius: bubble.radius,
        alpha: bubble.alpha,
      })),
      particles: this.particles.map((particle) => ({
        x: particle.x,
        y: particle.y,
        radius: particle.radius,
        alpha: particle.alpha,
        color: particle.color,
      })),
      floaters: this.floaters.map((floater) => ({
        text: floater.text,
        x: floater.x,
        y: floater.y,
        alpha: Math.max(0, floater.ttl / floater.life),
        scale: 1 + (1 - floater.ttl / floater.life) * 0.2,
        variant: floater.variant,
      })),
    };
  }

  private makeAmbientBubble(seed: number): BubbleModel {
    return {
      x: rand(CONFIG.hookMinX - 1.4, CONFIG.hookMaxX + 1.4) + Math.sin(seed * 1.7) * 0.55,
      y: CONFIG.surfaceY - rand(BUBBLE_DEPTH_MIN_M, BUBBLE_DEPTH_MAX_M),
      radius: rand(0.14, 0.34),
      alpha: rand(0.06, 0.18),
      speed: rand(0.3, 1.0),
      phase: Math.random() * Math.PI * 2,
    };
  }

  private makeHookBubble(hookX: number, hookY: number): BubbleModel {
    return {
      x: hookX + (Math.random() - 0.5) * 0.4,
      y: hookY - Math.random() * 0.8,
      radius: rand(0.08, 0.18),
      alpha: rand(0.04, 0.12),
      speed: rand(0.5, 1.4),
      phase: Math.random() * Math.PI * 2,
    };
  }

  private spawnSurfaceBurst(x: number, y: number): void {
    for (let i = 0; i < CONFIG.splashParticleCount + 10; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      const angle = (i / (CONFIG.splashParticleCount + 10)) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 1.6 + Math.random() * 3.4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed * 0.7,
        vy: Math.sin(angle) * speed * 0.25 + 2.8,
        radius: rand(0.06, 0.16),
        alpha: 1,
        ttl: rand(0.32, 0.55),
        life: 0.55,
        color: i % 2 === 0 ? "#d8f6ff" : "#f0fbff",
        gravity: 11 + Math.random() * 6,
      });
    }
  }

  private spawnLaunchBurst(x: number, y: number): void {
    for (let i = 0; i < CONFIG.bonusLaunchParticleCount; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      const angle = (i / Math.max(1, CONFIG.bonusLaunchParticleCount)) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 1.8 + Math.random() * 2.2;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 0.25,
        y: y + Math.random() * 0.12,
        vx: Math.cos(angle) * speed * 0.55 + (Math.random() - 0.5) * 0.8,
        vy: 2.2 + Math.random() * 3.8 + Math.sin(angle) * 0.6,
        radius: rand(0.03, 0.08),
        alpha: 1,
        ttl: rand(0.32, 0.46),
        life: 0.46,
        color: Math.random() > 0.5 ? "#86e4ff" : "#d5fbff",
        gravity: 10 + Math.random() * 6,
      });
    }
  }

  private spawnTapBurst(x: number, y: number, streak: number): void {
    const count = Math.min(18, CONFIG.bonusTapParticleCount + Math.min(5, Math.floor(streak)));
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 3.2 + Math.random() * 4.5 + streak * 0.35;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 0.12,
        y: y + (Math.random() - 0.5) * 0.12,
        vx: Math.cos(angle) * speed * 0.55,
        vy: Math.sin(angle) * speed * 0.55,
        radius: rand(0.04, 0.12) + streak * 0.004,
        alpha: 1,
        ttl: rand(0.22, 0.34),
        life: 0.34,
        color: Math.random() > 0.35 ? "#ffb24c" : "#ffffff",
        gravity: 8 + Math.random() * 5,
      });
    }
  }
}
