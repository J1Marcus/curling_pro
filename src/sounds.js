// ============================================
// SOUND MANAGER - Procedural Audio for Curling
// ============================================

class SoundManager {
  constructor() {
    this.enabled = false;
    this.audioContext = null;
    this.masterGain = null;
    this.slidingOscillator = null;
    this.slidingGain = null;
    this.sweepingInterval = null;
  }

  init() {
    if (this.audioContext) return;

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.audioContext.destination);
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (enabled) {
      this.init();
      // Resume audio context if suspended (browser autoplay policy)
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
    } else {
      this.stopAllSounds();
    }
  }

  stopAllSounds() {
    this.stopSliding();
    this.stopSweeping();
  }

  // ============================================
  // STONE THROW / RELEASE
  // ============================================
  playThrow() {
    if (!this.enabled || !this.audioContext) return;

    const now = this.audioContext.currentTime;

    // Thud sound for push-off
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  playRelease() {
    if (!this.enabled || !this.audioContext) return;

    const now = this.audioContext.currentTime;

    // Soft release sound
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  // ============================================
  // STONE SLIDING
  // ============================================
  startSliding() {
    if (!this.enabled || !this.audioContext || this.slidingOscillator) return;

    // Create noise for sliding sound
    const bufferSize = this.audioContext.sampleRate * 2;
    const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    // Low-pass filter for rumble
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;

    this.slidingGain = this.audioContext.createGain();
    this.slidingGain.gain.value = 0.15;

    noise.connect(filter);
    filter.connect(this.slidingGain);
    this.slidingGain.connect(this.masterGain);

    noise.start();
    this.slidingOscillator = noise;
  }

  updateSlidingVolume(speed) {
    if (!this.slidingGain) return;
    // Volume based on speed (0-1 range)
    const volume = Math.min(0.2, speed * 0.15);
    this.slidingGain.gain.setTargetAtTime(volume, this.audioContext.currentTime, 0.1);
  }

  stopSliding() {
    if (this.slidingOscillator) {
      try {
        this.slidingOscillator.stop();
      } catch (e) {}
      this.slidingOscillator = null;
      this.slidingGain = null;
    }
  }

  // ============================================
  // COLLISION
  // ============================================
  playCollision(intensity = 0.5) {
    if (!this.enabled || !this.audioContext) return;

    const now = this.audioContext.currentTime;

    // Impact sound - combination of thud and click
    const osc1 = this.audioContext.createOscillator();
    const osc2 = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    // Low thud
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(150 * intensity + 50, now);
    osc1.frequency.exponentialRampToValueAtTime(50, now + 0.1);

    // High click
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(800, now);
    osc2.frequency.exponentialRampToValueAtTime(200, now + 0.05);

    const gain2 = this.audioContext.createGain();
    gain2.gain.setValueAtTime(0.1 * intensity, now);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    gain.gain.setValueAtTime(0.4 * intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc1.connect(gain);
    osc2.connect(gain2);
    gain.connect(this.masterGain);
    gain2.connect(this.masterGain);

    osc1.start(now);
    osc1.stop(now + 0.15);
    osc2.start(now);
    osc2.stop(now + 0.05);

    // Add noise burst for realistic impact
    this.playNoiseHit(intensity * 0.3);
  }

  playNoiseHit(volume) {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    const bufferSize = this.audioContext.sampleRate * 0.1;
    const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = noiseBuffer;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    noise.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
  }

  // ============================================
  // SWEEPING
  // ============================================
  startSweeping() {
    if (!this.enabled || !this.audioContext || this.sweepingInterval) return;

    // Rhythmic brushing sound
    this.sweepingInterval = setInterval(() => {
      this.playBrushStroke();
    }, 150);

    this.playBrushStroke();
  }

  playBrushStroke() {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    const bufferSize = this.audioContext.sampleRate * 0.12;
    const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    // Shaped noise for brush sound
    for (let i = 0; i < bufferSize; i++) {
      const envelope = Math.sin((i / bufferSize) * Math.PI);
      output[i] = (Math.random() * 2 - 1) * envelope;
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 0.5;

    const gain = this.audioContext.createGain();
    gain.gain.value = 0.15;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
  }

  stopSweeping() {
    if (this.sweepingInterval) {
      clearInterval(this.sweepingInterval);
      this.sweepingInterval = null;
    }
  }

  // ============================================
  // UI SOUNDS
  // ============================================
  playClick() {
    if (!this.enabled || !this.audioContext) return;

    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.setValueAtTime(400, now + 0.02);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // ============================================
  // SCORING / CELEBRATION
  // ============================================
  playScore(points) {
    if (!this.enabled || !this.audioContext) return;

    const now = this.audioContext.currentTime;

    // Rising arpeggio for scoring
    const notes = [262, 330, 392, 523]; // C major chord

    for (let i = 0; i < Math.min(points, 4); i++) {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.value = notes[i];

      const startTime = now + i * 0.15;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(startTime);
      osc.stop(startTime + 0.4);
    }
  }

  playVictory() {
    if (!this.enabled || !this.audioContext) return;

    const now = this.audioContext.currentTime;

    // Victory fanfare
    const melody = [523, 659, 784, 1047]; // C5 E5 G5 C6

    melody.forEach((freq, i) => {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'triangle';
      osc.frequency.value = freq;

      const startTime = now + i * 0.2;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.25, startTime + 0.05);
      gain.gain.setValueAtTime(0.25, startTime + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(startTime);
      osc.stop(startTime + 0.5);
    });
  }

  playDefeat() {
    if (!this.enabled || !this.audioContext) return;

    const now = this.audioContext.currentTime;

    // Sad descending tones
    const melody = [392, 349, 330, 262]; // G4 F4 E4 C4

    melody.forEach((freq, i) => {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      const startTime = now + i * 0.3;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(startTime);
      osc.stop(startTime + 0.5);
    });
  }
}

// Export singleton instance
export const soundManager = new SoundManager();
