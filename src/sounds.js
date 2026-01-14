// ============================================
// SOUND MANAGER - Procedural Audio for Curling
// ============================================

import { Howler } from 'howler';

class SoundManager {
  constructor() {
    this.enabled = false;
    this.audioContext = null;
    this.masterGain = null;
    this.slidingOscillator = null;
    this.slidingGain = null;
    // Sweeping sound (looping source instead of interval)
    this.sweepingSource = null;
    this.sweepingFilter = null;
    this.sweepingGain = null;
    this.sweepBuffer = null;  // Reusable sweep buffer
    this.sweepingActive = false;
    this.isFastForward = false;  // Track FFW state
    // Ambient crowd system
    this.ambientNodes = null;
    this.ambientVolume = 0.12;
    this.noiseBuffer = null;  // Reusable noise buffer

    // Live crowd reaction state (cooldowns to prevent spam)
    this.lastReactionTime = 0;
    this.lastGaspTime = 0;
    this.lastMurmurTime = 0;
    this.lastAnticipationUpdate = 0;
    this.crowdAnticipation = 0;  // 0-1 builds as stone approaches house
    this.anticipationOsc = null;
  }

  init() {
    if (this.audioContext) return;

    // Use Howler's audio context if available (it handles iOS unlocking)
    if (Howler.ctx) {
      this.audioContext = Howler.ctx;
    } else {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.audioContext.destination);

    // Handle iOS audio interruptions (notifications, phone calls, etc.)
    this.audioContext.addEventListener('statechange', () => {
      console.log('[Sound] AudioContext state changed:', this.audioContext.state);
      if (this.audioContext.state === 'interrupted' || this.audioContext.state === 'suspended') {
        // Try to resume after a brief delay (iOS needs user gesture sometimes)
        setTimeout(() => {
          if (this.enabled && this.audioContext.state !== 'running') {
            this.audioContext.resume().then(() => {
              console.log('[Sound] AudioContext resumed after interruption');
            }).catch(e => {
              console.log('[Sound] Could not resume AudioContext:', e);
            });
          }
        }, 100);
      }
    });

    // Also listen for page visibility changes (switching apps on iOS)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.enabled) {
        // Page became visible again - resume audio if needed
        if (this.audioContext && this.audioContext.state !== 'running') {
          this.audioContext.resume().then(() => {
            console.log('[Sound] AudioContext resumed on visibility change');
          }).catch(() => {});
        }
      }
    });
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

  // Lower volume during fast-forward (CPU shots)
  setFastForward(active) {
    this.isFastForward = active;

    if (!this.masterGain) return;

    // Set directly - avoid setTargetAtTime which can cause iOS issues
    try {
      this.masterGain.gain.value = active ? 0.1 : 0.5;
    } catch(e) {
      // If that fails, try cancelScheduledValues first
      try {
        this.masterGain.gain.cancelScheduledValues(0);
        this.masterGain.gain.value = active ? 0.1 : 0.5;
      } catch(e2) {}
    }
  }

  // Ensure volume is at normal level (call after any potential issue)
  restoreVolume() {
    if (!this.masterGain) return;
    this.isFastForward = false;
    try {
      this.masterGain.gain.cancelScheduledValues(0);
      this.masterGain.gain.value = 0.5;
    } catch(e) {}
  }

  stopAllSounds() {
    this.stopSliding();
    this.cleanupSweeping();
    this.stopAmbientCrowd();
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
  // SWEEPING (minimal nodes, pre-filtered buffer)
  // ============================================
  startSweeping() {
    if (!this.enabled || !this.audioContext) return;
    if (this.sweepingActive) return;

    // Check audio context health
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    if (this.audioContext.state === 'closed') {
      console.log('[Sound] AudioContext closed, reinitializing');
      this.audioContext = null;
      this.masterGain = null;
      this.init();
      if (!this.audioContext) return;
    }

    // Create pre-filtered buffer once (no filter node needed at runtime)
    if (!this.sweepBuffer) {
      const duration = 0.2;
      const sampleRate = this.audioContext.sampleRate;
      const bufferSize = Math.floor(sampleRate * duration);
      this.sweepBuffer = this.audioContext.createBuffer(1, bufferSize, sampleRate);
      const output = this.sweepBuffer.getChannelData(0);

      // Generate bandpass-filtered noise directly in buffer
      for (let i = 0; i < bufferSize; i++) {
        const envelope = Math.sin((i / bufferSize) * Math.PI);
        // Simple high-frequency bias for brush sound
        const noise = (Math.random() - 0.5) + (Math.random() - 0.5) * 0.5;
        output[i] = noise * envelope * 0.6;
      }
    }

    // Only 2 nodes: source + gain (no filter)
    try {
      this.sweepingSource = this.audioContext.createBufferSource();
      this.sweepingSource.buffer = this.sweepBuffer;
      this.sweepingSource.loop = true;

      this.sweepingGain = this.audioContext.createGain();
      this.sweepingGain.gain.value = 0.18;

      this.sweepingSource.connect(this.sweepingGain);
      this.sweepingGain.connect(this.masterGain);
      this.sweepingSource.start();
      this.sweepingActive = true;
    } catch(e) {
      console.log('[Sound] Error starting sweep:', e);
      this.sweepingActive = false;
    }
  }

  stopSweeping() {
    if (!this.sweepingActive) return;
    this.cleanupSweeping();
  }

  cleanupSweeping() {
    if (this.sweepingSource) {
      try {
        this.sweepingSource.stop();
        this.sweepingSource.disconnect();
      } catch(e) {}
    }
    if (this.sweepingGain) {
      try { this.sweepingGain.disconnect(); } catch(e) {}
    }
    this.sweepingSource = null;
    this.sweepingGain = null;
    this.sweepingActive = false;
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

  // ============================================
  // AMBIENT CROWD / ARENA ATMOSPHERE
  // ============================================

  // Create reusable noise buffer
  getNoiseBuffer(duration = 2) {
    if (!this.audioContext) return null;

    if (!this.noiseBuffer || this.noiseBuffer.duration < duration) {
      const bufferSize = this.audioContext.sampleRate * duration;
      this.noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const output = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
    }
    return this.noiseBuffer;
  }

  // Start ambient crowd sound
  // crowdSize: 'arena' (default, full crowd), 'club' (quiet practice environment)
  startAmbientCrowd(crowdSize = 'arena') {
    if (!this.enabled || !this.audioContext || this.ambientNodes) return;

    const now = this.audioContext.currentTime;

    // Set volume based on crowd size
    // Club level is very quiet - just subtle HVAC/building ambience
    const volumeMultiplier = crowdSize === 'club' ? 0.15 : 1.0;
    this.crowdSize = crowdSize; // Store for reference in reactions

    // Master gain for ambient crowd
    const masterAmbientGain = this.audioContext.createGain();
    masterAmbientGain.gain.setValueAtTime(0, now);
    masterAmbientGain.gain.linearRampToValueAtTime(this.ambientVolume * volumeMultiplier, now + 1.5);
    masterAmbientGain.connect(this.masterGain);

    // Layer 1: Low rumble base (filtered noise)
    const noiseBuffer = this.getNoiseBuffer(2);
    const noise1 = this.audioContext.createBufferSource();
    noise1.buffer = noiseBuffer;
    noise1.loop = true;

    const lowpass1 = this.audioContext.createBiquadFilter();
    lowpass1.type = 'lowpass';
    lowpass1.frequency.value = 120;
    lowpass1.Q.value = 0.5;

    const gain1 = this.audioContext.createGain();
    gain1.gain.value = 0.6;

    noise1.connect(lowpass1);
    lowpass1.connect(gain1);
    gain1.connect(masterAmbientGain);
    noise1.start();

    // Layer 2: Mid-range murmur (bandpass filtered noise)
    const noise2 = this.audioContext.createBufferSource();
    noise2.buffer = noiseBuffer;
    noise2.loop = true;

    const bandpass2 = this.audioContext.createBiquadFilter();
    bandpass2.type = 'bandpass';
    bandpass2.frequency.value = 300;
    bandpass2.Q.value = 0.8;

    const gain2 = this.audioContext.createGain();
    gain2.gain.value = 0.3;

    // Slow LFO for breathing effect
    const lfo = this.audioContext.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.15; // Very slow modulation

    const lfoGain = this.audioContext.createGain();
    lfoGain.gain.value = 0.1; // Subtle variation

    lfo.connect(lfoGain);
    lfoGain.connect(gain2.gain);

    noise2.connect(bandpass2);
    bandpass2.connect(gain2);
    gain2.connect(masterAmbientGain);
    noise2.start();
    lfo.start();

    // Layer 3: Occasional higher murmur (sparse)
    const noise3 = this.audioContext.createBufferSource();
    noise3.buffer = noiseBuffer;
    noise3.loop = true;

    const bandpass3 = this.audioContext.createBiquadFilter();
    bandpass3.type = 'bandpass';
    bandpass3.frequency.value = 600;
    bandpass3.Q.value = 1.2;

    const gain3 = this.audioContext.createGain();
    gain3.gain.value = 0.15;

    noise3.connect(bandpass3);
    bandpass3.connect(gain3);
    gain3.connect(masterAmbientGain);
    noise3.start();

    // Store all nodes for cleanup
    this.ambientNodes = {
      sources: [noise1, noise2, noise3, lfo],
      gains: [gain1, gain2, gain3, masterAmbientGain],
      masterGain: masterAmbientGain
    };
  }

  stopAmbientCrowd() {
    if (!this.ambientNodes) return;
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;

    // Fade out gracefully
    this.ambientNodes.masterGain.gain.setValueAtTime(
      this.ambientNodes.masterGain.gain.value, now
    );
    this.ambientNodes.masterGain.gain.linearRampToValueAtTime(0, now + 0.5);

    // Stop sources after fade
    setTimeout(() => {
      if (this.ambientNodes) {
        this.ambientNodes.sources.forEach(source => {
          try { source.stop(); } catch (e) {}
        });
        this.ambientNodes = null;
      }
    }, 600);
  }

  setAmbientVolume(vol) {
    this.ambientVolume = Math.max(0, Math.min(1, vol));
    if (this.ambientNodes && this.ambientNodes.masterGain) {
      this.ambientNodes.masterGain.gain.setTargetAtTime(
        this.ambientVolume,
        this.audioContext.currentTime,
        0.1
      );
    }
  }

  // Set crowd intensity based on game situation (0 = calm, 1 = very tense)
  // Affects ambient volume and adds excitement murmur
  setGameIntensity(intensity) {
    if (!this.enabled || !this.audioContext || !this.ambientNodes) return;
    // Skip intensity changes for club/practice environment (keep it quiet)
    if (this.crowdSize === 'club') return;

    intensity = Math.max(0, Math.min(1, intensity));

    // Base ambient volume increases with intensity
    const baseVolume = 0.12;
    const intensityBonus = intensity * 0.15; // Up to 0.27 total
    const targetVolume = baseVolume + intensityBonus;

    this.ambientNodes.masterGain.gain.setTargetAtTime(
      targetVolume,
      this.audioContext.currentTime,
      0.5 // Slower transition for natural feel
    );

    // At high intensity, add subtle anticipation murmur
    if (intensity > 0.7 && !this.anticipationActive) {
      this.startAnticipationMurmur(intensity);
    } else if (intensity <= 0.5 && this.anticipationActive) {
      this.stopAnticipationMurmur();
    }
  }

  startAnticipationMurmur(intensity) {
    if (!this.audioContext || this.anticipationActive) return;

    const now = this.audioContext.currentTime;

    // Rising tension sound - subtle tonal element
    const noiseBuffer = this.getNoiseBuffer(10);
    const noise = this.audioContext.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const bandpass = this.audioContext.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 350;
    bandpass.Q.value = 2;

    // Subtle pulsing via LFO
    const lfo = this.audioContext.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.5; // Heartbeat-like pulse

    const lfoGain = this.audioContext.createGain();
    lfoGain.gain.value = 0.03;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08 * intensity, now + 1);

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(this.masterGain);

    noise.start();
    lfo.start();

    this.anticipationActive = true;
    this.anticipationNodes = { noise, lfo, gain };
  }

  stopAnticipationMurmur() {
    if (!this.anticipationNodes) return;

    const now = this.audioContext.currentTime;
    this.anticipationNodes.gain.gain.setTargetAtTime(0, now, 0.3);

    setTimeout(() => {
      if (this.anticipationNodes) {
        try { this.anticipationNodes.noise.stop(); } catch(e) {}
        try { this.anticipationNodes.lfo.stop(); } catch(e) {}
        this.anticipationNodes = null;
        this.anticipationActive = false;
      }
    }, 500);
  }

  // Quick gasp for dramatic moments (close calls, near misses)
  playCrowdGasp() {
    if (!this.enabled || !this.audioContext) return;
    // Skip crowd reactions in club/practice environment
    if (this.crowdSize === 'club') return;

    const now = this.audioContext.currentTime;
    const duration = 0.35;

    // Sharp inhale sound
    const noiseBuffer = this.getNoiseBuffer(duration);
    const noise = this.audioContext.createBufferSource();
    noise.buffer = noiseBuffer;

    const highpass = this.audioContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 800;

    const bandpass = this.audioContext.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(2000, now);
    bandpass.frequency.linearRampToValueAtTime(1200, now + duration);
    bandpass.Q.value = 1.5;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    noise.connect(highpass);
    highpass.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + duration);
  }

  // Excited buzz when something interesting is developing
  playCrowdMurmur() {
    if (!this.enabled || !this.audioContext) return;
    // Skip crowd reactions in club/practice environment
    if (this.crowdSize === 'club') return;

    const now = this.audioContext.currentTime;
    const duration = 1.2;

    const noiseBuffer = this.getNoiseBuffer(duration);
    const noise = this.audioContext.createBufferSource();
    noise.buffer = noiseBuffer;

    const bandpass = this.audioContext.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 350;
    bandpass.Q.value = 0.8;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.2);
    gain.gain.setValueAtTime(0.08, now + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + duration);
  }

  // ============================================
  // CROWD REACTIONS
  // ============================================

  playCrowdCheer(intensity = 0.5) {
    if (!this.enabled || !this.audioContext) return;
    // Skip crowd cheers in club/practice environment
    if (this.crowdSize === 'club') return;

    const now = this.audioContext.currentTime;
    intensity = Math.max(0.1, Math.min(1, intensity));

    const duration = 0.8 + intensity * 1.2; // 0.8s to 2s
    const volume = 0.15 + intensity * 0.25; // 0.15 to 0.4

    // Noise burst for crowd roar
    const noiseBuffer = this.getNoiseBuffer(duration);
    const noise = this.audioContext.createBufferSource();
    noise.buffer = noiseBuffer;

    // Bandpass for voice-like quality
    const bandpass = this.audioContext.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(400, now);
    bandpass.frequency.linearRampToValueAtTime(800 + intensity * 600, now + 0.15);
    bandpass.frequency.linearRampToValueAtTime(500, now + duration);
    bandpass.Q.value = 0.6;

    // High-pass to remove rumble
    const highpass = this.audioContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 200;

    // Envelope
    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.08);
    gain.gain.setValueAtTime(volume * 0.9, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    noise.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + duration);

    // Add harmonic excitement for bigger cheers
    if (intensity > 0.5) {
      this.addCheerHarmonics(intensity, duration);
    }
  }

  addCheerHarmonics(intensity, duration) {
    const now = this.audioContext.currentTime;

    // Add tonal elements (voices in unison)
    const freqs = [260, 330, 390]; // C4, E4, G4 - major chord

    freqs.forEach((freq, i) => {
      const osc = this.audioContext.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq * (0.98 + Math.random() * 0.04), now);

      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1500;

      const gain = this.audioContext.createGain();
      const vol = (intensity - 0.5) * 0.1;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.8);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + duration);
    });
  }

  playCrowdOoh() {
    if (!this.enabled || !this.audioContext) return;
    // Skip crowd reactions in club/practice environment
    if (this.crowdSize === 'club') return;

    const now = this.audioContext.currentTime;
    const duration = 0.6;

    // Sympathetic "ooh" - pitch rises then falls
    // Multiple sine waves for choir effect
    const baseFreqs = [220, 225, 218]; // Slight detuning for realism

    baseFreqs.forEach(baseFreq => {
      const osc = this.audioContext.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.linearRampToValueAtTime(baseFreq * 1.15, now + 0.15);
      osc.frequency.linearRampToValueAtTime(baseFreq * 0.9, now + duration);

      const gain = this.audioContext.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.1);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + duration);
    });

    // Add breathiness with filtered noise
    const noiseBuffer = this.getNoiseBuffer(duration);
    const noise = this.audioContext.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 500;
    filter.Q.value = 1;

    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.06, now + 0.1);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + duration);
  }

  playCrowdApplause(duration = 1.5) {
    if (!this.enabled || !this.audioContext) return;
    // Skip applause in club/practice environment
    if (this.crowdSize === 'club') return;

    const now = this.audioContext.currentTime;
    duration = Math.max(0.5, Math.min(4, duration));

    // Applause is many individual claps - we'll use shaped noise bursts
    const clapCount = Math.floor(duration * 15); // ~15 claps per second

    for (let i = 0; i < clapCount; i++) {
      const clapTime = now + (i / clapCount) * duration + (Math.random() - 0.5) * 0.05;
      this.playIndividualClap(clapTime, duration, i / clapCount);
    }
  }

  playIndividualClap(time, totalDuration, progress) {
    if (!this.audioContext) return;

    const bufferSize = Math.floor(this.audioContext.sampleRate * 0.04);
    const clapBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = clapBuffer.getChannelData(0);

    // Sharp attack, quick decay
    for (let i = 0; i < bufferSize; i++) {
      const decay = Math.exp(-i / (bufferSize * 0.15));
      output[i] = (Math.random() * 2 - 1) * decay;
    }

    const clap = this.audioContext.createBufferSource();
    clap.buffer = clapBuffer;

    // Bandpass around clap frequencies
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200 + Math.random() * 600;
    filter.Q.value = 0.8;

    // Volume envelope for applause shape (builds, sustains, fades)
    const gain = this.audioContext.createGain();
    let volume = 0.04 + Math.random() * 0.03;

    // Envelope: quick build, sustain, fade
    if (progress < 0.15) {
      volume *= progress / 0.15;
    } else if (progress > 0.7) {
      volume *= (1 - progress) / 0.3;
    }

    gain.gain.value = volume;

    clap.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    clap.start(time);
  }

  playCrowdGroan() {
    if (!this.enabled || !this.audioContext) return;
    // Skip crowd reactions in club/practice environment
    if (this.crowdSize === 'club') return;

    const now = this.audioContext.currentTime;
    const duration = 0.8;

    // Disappointed groan - falling pitch, deflated feeling
    const baseFreqs = [180, 185, 175]; // Lower than "ooh"

    baseFreqs.forEach(baseFreq => {
      const osc = this.audioContext.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.linearRampToValueAtTime(baseFreq * 0.85, now + duration);

      const gain = this.audioContext.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.15);
      gain.gain.setValueAtTime(0.05, now + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + duration);
    });

    // Add some breathiness
    const noiseBuffer = this.getNoiseBuffer(duration);
    const noise = this.audioContext.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.linearRampToValueAtTime(200, now + duration);

    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.05, now + 0.15);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + duration);
  }

  // ============================================
  // LIVE CROWD REACTIONS (during stone movement)
  // ============================================

  // Call this every frame during stone movement
  // stoneInfo: { x, z, speed, distFromButton, distFromNearestStone, isInHouse, isHeadingToHouse }
  updateLiveCrowdReaction(stoneInfo) {
    if (!this.enabled || !this.audioContext) return;
    if (this.crowdSize === 'club') return;  // Skip in practice mode

    const now = Date.now();

    // Update anticipation based on stone position
    this.updateAnticipation(stoneInfo, now);

    // Check for gasp-worthy moments (near collision, close to edge)
    this.checkForGaspMoment(stoneInfo, now);

    // Murmur when something interesting is developing
    this.checkForMurmurMoment(stoneInfo, now);
  }

  updateAnticipation(stoneInfo, now) {
    // Only update every 200ms to avoid too much processing
    if (now - this.lastAnticipationUpdate < 200) return;
    this.lastAnticipationUpdate = now;

    const { z, speed, distFromButton, isHeadingToHouse } = stoneInfo;

    // Build anticipation as stone approaches scoring area
    let targetAnticipation = 0;

    if (isHeadingToHouse && speed > 0.5) {
      // Stone is moving toward the house
      // Anticipation builds based on how close and how fast
      const distanceFactor = Math.max(0, 1 - (distFromButton / 20));  // 20m = full sheet
      const speedFactor = Math.min(1, speed / 3);  // Normalize speed
      targetAnticipation = distanceFactor * speedFactor * 0.7;

      // Extra anticipation if stone is in the critical zone (near house)
      if (distFromButton < 5) {
        targetAnticipation = Math.min(1, targetAnticipation + 0.3);
      }
    }

    // Smooth transition
    const transitionSpeed = targetAnticipation > this.crowdAnticipation ? 0.15 : 0.1;
    this.crowdAnticipation += (targetAnticipation - this.crowdAnticipation) * transitionSpeed;

    // Update ambient intensity based on anticipation
    if (this.ambientNodes && this.ambientNodes.masterGain) {
      const baseVolume = this.ambientVolume;
      const anticipationBonus = this.crowdAnticipation * 0.15;
      this.ambientNodes.masterGain.gain.setTargetAtTime(
        baseVolume + anticipationBonus,
        this.audioContext.currentTime,
        0.2
      );
    }

    // Add subtle rising tone at high anticipation
    if (this.crowdAnticipation > 0.6 && !this.anticipationOsc) {
      this.startLiveAnticipationTone();
    } else if (this.crowdAnticipation < 0.4 && this.anticipationOsc) {
      this.stopLiveAnticipationTone();
    }
  }

  startLiveAnticipationTone() {
    if (!this.audioContext || this.anticipationOsc) return;

    const now = this.audioContext.currentTime;

    // Subtle filtered noise that rises with tension
    const noiseBuffer = this.getNoiseBuffer(5);
    const noise = this.audioContext.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const bandpass = this.audioContext.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 400;
    bandpass.Q.value = 2;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.04, now + 0.5);

    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(this.masterGain);

    noise.start();

    this.anticipationOsc = { noise, gain, bandpass };
  }

  stopLiveAnticipationTone() {
    if (!this.anticipationOsc) return;
    if (!this.audioContext) {
      this.anticipationOsc = null;
      return;
    }

    try {
      const now = this.audioContext.currentTime;
      this.anticipationOsc.gain.gain.setTargetAtTime(0, now, 0.2);

      const nodes = this.anticipationOsc;
      setTimeout(() => {
        try { nodes.noise.stop(); } catch(e) {}
      }, 400);
    } catch(e) {
      // Ignore errors during cleanup
    }

    this.anticipationOsc = null;
  }

  checkForGaspMoment(stoneInfo, now) {
    // Cooldown: at least 2 seconds between gasps
    if (now - this.lastGaspTime < 2000) return;

    const { speed, distFromNearestStone, distFromButton, isInHouse } = stoneInfo;

    // Gasp when stone is about to hit another stone
    if (distFromNearestStone !== null && distFromNearestStone < 0.4 && speed > 1) {
      this.playCrowdGasp();
      this.lastGaspTime = now;
      return;
    }

    // Gasp when stone is barely going to make it to the house
    if (speed < 0.8 && speed > 0.3 && distFromButton < 3 && distFromButton > 1.5) {
      this.playCrowdGasp();
      this.lastGaspTime = now;
      return;
    }

    // Gasp when a fast stone is heading right for the button
    if (speed > 2 && distFromButton < 2 && isInHouse) {
      this.playCrowdGasp();
      this.lastGaspTime = now;
      return;
    }
  }

  checkForMurmurMoment(stoneInfo, now) {
    // Cooldown: at least 3 seconds between murmurs
    if (now - this.lastMurmurTime < 3000) return;

    const { speed, distFromButton, isInHouse, distFromNearestStone } = stoneInfo;

    // Murmur when stone enters the house
    if (isInHouse && speed > 0.5 && speed < 2) {
      this.playCrowdMurmur();
      this.lastMurmurTime = now;
      return;
    }

    // Murmur when stone is perfectly on line for button
    if (distFromButton < 0.5 && speed > 0.3 && speed < 1.5) {
      this.playCrowdMurmur();
      this.lastMurmurTime = now;
      return;
    }

    // Excited murmur when stones are about to collide
    if (distFromNearestStone !== null && distFromNearestStone < 1 && speed > 1.5) {
      this.playCrowdMurmur();
      this.lastMurmurTime = now;
      return;
    }
  }

  // Quick excited noise when stone enters scoring position
  playQuickCheer() {
    if (!this.enabled || !this.audioContext) return;
    if (this.crowdSize === 'club') return;

    const now = this.audioContext.currentTime;
    const duration = 0.4;

    const noiseBuffer = this.getNoiseBuffer(duration);
    const noise = this.audioContext.createBufferSource();
    noise.buffer = noiseBuffer;

    const bandpass = this.audioContext.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 600;
    bandpass.Q.value = 0.8;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + duration);
  }

  // Reset live reaction state (call when stone stops or new throw starts)
  resetLiveReactions() {
    try {
      this.crowdAnticipation = 0;
      this.stopLiveAnticipationTone();
      this.lastReactionTime = 0;
      this.lastGaspTime = 0;
      this.lastMurmurTime = 0;
    } catch(e) {
      // Ignore errors during reset
    }
  }
}

// Export singleton instance
export const soundManager = new SoundManager();
