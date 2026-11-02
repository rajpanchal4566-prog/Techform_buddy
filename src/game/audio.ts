export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;

  unlock(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) return;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.14;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') void this.context.resume();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled && !this.context) {
      this.unlock(true);
      return;
    }
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(enabled ? 0.14 : 0, this.context.currentTime, 0.02);
    }
  }

  play(name: 'shoot' | 'hit' | 'death' | 'damage' | 'heal' | 'wave' | 'game-over'): void {
    if (!this.enabled || !this.context || !this.master) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const config = {
      shoot: [640, 340, 0.055, 'square'],
      hit: [280, 150, 0.075, 'triangle'],
      death: [190, 75, 0.18, 'sawtooth'],
      damage: [120, 55, 0.2, 'sawtooth'],
      heal: [420, 840, 0.24, 'sine'],
      wave: [520, 1040, 0.32, 'sine'],
      'game-over': [240, 65, 0.55, 'triangle'],
    }[name] as [number, number, number, OscillatorType];
    oscillator.type = config[3];
    oscillator.frequency.setValueAtTime(config[0], now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, config[1]), now + config[2]);
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + config[2]);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + config[2]);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }

  dispose(): void {
    if (this.context && this.context.state !== 'closed') void this.context.close();
    this.context = null;
    this.master = null;
  }
}
