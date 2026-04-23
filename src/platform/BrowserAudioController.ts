import type { RenderState } from "../render/RenderState.js";

const TRACK_MAX_VOLUME = 0.2;

type ManagedTrack = {
  audio: HTMLAudioElement;
  targetVolume: number;
};

export class BrowserAudioController {
  private readonly readyTrack: ManagedTrack = {
    audio: new Audio("/assets/ready-loop.mp3"),
    targetVolume: 0,
  };
  private readonly gameplayTrack: ManagedTrack = {
    audio: new Audio("/assets/gameplay-loop.mp3"),
    targetVolume: 0,
  };
  private unlocked = false;

  constructor() {
    for (const track of [this.readyTrack, this.gameplayTrack]) {
      track.audio.loop = true;
      track.audio.preload = "auto";
      track.audio.volume = 0;
    }

    window.addEventListener("pointerdown", this.unlockAudio, { once: true });
    window.addEventListener("keydown", this.unlockAudio, { once: true });
  }

  sync(state: RenderState): void {
    const useReadyTrack = state.appState === "Ready" || state.appState === "Result";
    this.readyTrack.targetVolume = useReadyTrack ? TRACK_MAX_VOLUME : 0;
    this.gameplayTrack.targetVolume = useReadyTrack ? 0 : TRACK_MAX_VOLUME;

    this.ensureTrackState(this.readyTrack);
    this.ensureTrackState(this.gameplayTrack);
  }

  update(dt: number): void {
    this.updateTrack(this.readyTrack, dt);
    this.updateTrack(this.gameplayTrack, dt);
  }

  dispose(): void {
    window.removeEventListener("pointerdown", this.unlockAudio);
    window.removeEventListener("keydown", this.unlockAudio);
    this.readyTrack.audio.pause();
    this.gameplayTrack.audio.pause();
  }

  private unlockAudio = (): void => {
    this.unlocked = true;
    this.ensureTrackState(this.readyTrack);
    this.ensureTrackState(this.gameplayTrack);
  };

  private ensureTrackState(track: ManagedTrack): void {
    if (!this.unlocked || track.targetVolume <= 0.001 || !track.audio.paused) return;
    void track.audio.play().catch(() => {
      // Browser autoplay policy can still block us; we'll retry on the next interaction.
    });
  }

  private updateTrack(track: ManagedTrack, dt: number): void {
    const current = track.audio.volume;
    const rate = track.targetVolume > current ? 3.4 : 4.8;
    const next = current + (track.targetVolume - current) * Math.min(1, dt * rate);
    track.audio.volume = Math.max(0, Math.min(1, next));

    if (track.targetVolume <= 0.001 && track.audio.volume <= 0.01 && !track.audio.paused) {
      track.audio.pause();
      track.audio.currentTime = 0;
    }
  }
}
