import * as THREE from 'three';
import Matter from 'matter-js';
import { soundManager } from './sounds.js';
import * as multiplayer from './multiplayer.js';
import * as analytics from './analytics.js';

// ============================================
// SPLASH SCREEN / LOADING
// ============================================
window.splashStartTime = Date.now();

function updateLoadingProgress(percent, text) {
  const progressBar = document.getElementById('loading-progress');
  const loadingText = document.getElementById('loading-text');
  if (progressBar) progressBar.style.width = percent + '%';
  if (loadingText) loadingText.textContent = text;
}

function hideSplashScreen() {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => {
      splash.style.display = 'none';
    }, 500);
  }
}

updateLoadingProgress(10, 'Initializing...');

// ============================================
// GAME CONSTANTS (from mycurling.com)
// ============================================
// Sheet dimensions
const SHEET_LENGTH = 44.5;    // meters (146 ft)
const SHEET_WIDTH = 4.75;     // meters (15 ft 7 in max)

// House ring radii (diameters / 2)
const RING_12FT = 1.83;       // 12ft ring = 3.66m diameter
const RING_8FT = 1.22;        // 8ft ring = 2.44m diameter
const RING_4FT = 0.61;        // 4ft ring = 1.22m diameter
const BUTTON_RADIUS = 0.15;   // Button (center)

// Key positions (from hack end)
const HACK_Z = 0;
const BACK_LINE_NEAR = 1.5;           // Near back line
const TEE_LINE_NEAR = 3.33;           // Near tee (1.83m from back)
const HOG_LINE_NEAR = 9.73;           // Near hog line (6.4m from tee)
const HOG_LINE_FAR = 34.67;           // Far hog line (24.94m between hog lines)
const TEE_LINE_FAR = 41.07;           // Far tee (6.4m from far hog)
const BACK_LINE_FAR = 42.9;           // Far back line (1.83m from tee)
const OUT_OF_PLAY_Z = 45.0;           // Behind back wall where out-of-play stones are placed

// Stone specs
const STONE_RADIUS = 0.145;   // ~29cm circumference = ~9.2cm radius, but visually use 14.5cm
const STONE_MASS = 20;        // ~20kg (44 lbs)

// Physics scale: 1 Three.js unit = 1 meter, Matter.js uses pixels (100px = 1m)
const PHYSICS_SCALE = 100;

// Realistic physics - tuned to real curling timing:
// Draw weight: hog-to-hog ~14s, far hog-to-rest ~4-5s, total ~18-19s
// frictionAir in Matter.js acts as a velocity dampening factor
const ICE_FRICTION_BASE = 0.0015;      // Base friction (original value)
const SWEEP_FRICTION_BASE = 0.0009;    // Reduced friction when sweeping (~40% reduction)

// Ice conditioning: ice gets faster throughout a match (pebble wears, paths polish)
// Real curling: ~4-8% speed increase over 8-10 ends (~0.2-0.4s faster hog-to-hog)
// Only applies to medium and hard difficulties
const ICE_CONDITIONING = {
  maxSpeedIncrease: 0.07,  // 7% faster by end of game (friction reduced by 7%)
  // Guards are more affected by friction changes than hits
  guardMultiplier: 1.3,    // Guards feel ~9% faster
  hitMultiplier: 0.7       // Hits feel ~5% faster
};

// Get current ice friction adjusted for game progression
// Lower friction = faster ice
function getIceFriction(isGuardWeight = false) {
  const difficulty = gameState.settings.difficulty;

  // Only apply ice conditioning on medium and hard
  if (difficulty === 'easy') {
    return ICE_FRICTION_BASE;
  }

  // Calculate progression (0 at end 1, 1 at max ends)
  const currentEnd = gameState.end || 1;
  const maxEnds = gameState.settings.gameLength || 8;
  const progression = Math.min(1, (currentEnd - 1) / (maxEnds - 1));

  // Speed increase factor (how much faster the ice is)
  // Guards are more affected since they're slower and more friction-dominated
  const weightMultiplier = isGuardWeight ? ICE_CONDITIONING.guardMultiplier : 1.0;
  const speedIncrease = progression * ICE_CONDITIONING.maxSpeedIncrease * weightMultiplier;

  // Lower friction = faster ice
  const adjustedFriction = ICE_FRICTION_BASE * (1 - speedIncrease);

  // Debug: log ice speed changes (only on first call per end to avoid spam)
  if (!getIceFriction._lastLoggedEnd || getIceFriction._lastLoggedEnd !== currentEnd) {
    getIceFriction._lastLoggedEnd = currentEnd;
    const speedPercent = (speedIncrease * 100).toFixed(1);
    if (speedIncrease > 0) {
      console.log(`[Ice] End ${currentEnd}: Ice is ${speedPercent}% faster (guards: ${(speedIncrease * ICE_CONDITIONING.guardMultiplier * 100).toFixed(1)}%)`);
    }
  }

  return adjustedFriction;
}

// Get sweep friction adjusted for game progression
function getSweepFriction(isGuardWeight = false) {
  const difficulty = gameState.settings.difficulty;

  if (difficulty === 'easy') {
    return SWEEP_FRICTION_BASE;
  }

  const currentEnd = gameState.end || 1;
  const maxEnds = gameState.settings.gameLength || 8;
  const progression = Math.min(1, (currentEnd - 1) / (maxEnds - 1));

  const weightMultiplier = isGuardWeight ? ICE_CONDITIONING.guardMultiplier : 1.0;
  const speedIncrease = progression * ICE_CONDITIONING.maxSpeedIncrease * weightMultiplier;

  // Sweep friction also decreases (but sweep effectiveness is slightly reduced late game)
  // since the ice is already fast
  return SWEEP_FRICTION_BASE * (1 - speedIncrease * 0.8);
}

// Legacy constants for compatibility (used by some code paths)
const ICE_FRICTION = ICE_FRICTION_BASE;
const SWEEP_FRICTION = SWEEP_FRICTION_BASE;

// ============================================
// ADVANCED PHYSICS & AI TUNING SYSTEM
// Quantified real-world curling dynamics
// ============================================

const ADVANCED_PHYSICS = {
  // ----------------------------------------
  // 1A: SWEEPING DISTANCE GAIN
  // Strong sweeping can extend travel by ~2-3 meters
  // ----------------------------------------
  sweep: {
    // Friction multiplier when sweeping (0.85 = 15% friction reduction)
    frictionMultiplier: 0.60,        // Base sweep reduces friction by 40%
    maxDistanceBonusMeters: 3.0,     // Max ~3m extra travel
    // Sweep effect vs speed curve: more effective at moderate speeds
    // At peel weight, sweeping matters less (speed dominates)
    speedEffectCurve: (speed) => {
      // Returns 0-1, where 1 = full sweep effect
      // Moderate speeds (1.5-3.0) get full effect
      // Very fast (>4) or very slow (<0.5) get reduced effect
      if (speed > 4.0) return 0.5;        // Peel weight - less sweep effect
      if (speed > 3.0) return 0.7;        // Takeout - moderate effect
      if (speed > 1.5) return 1.0;        // Draw/guard - full effect
      if (speed > 0.5) return 0.9;        // Slow - still good
      return 0.5;                          // Very slow - reduced
    }
  },

  // ----------------------------------------
  // 1B: ASYMMETRIC SWEEPING (HARD MODE ONLY)
  // Directional sweeping can slightly nudge the line
  // ----------------------------------------
  directionalSweep: {
    enabled: true,                    // Only active on hard difficulty
    maxCurlBias: 0.000003,           // Small lateral force modifier
    // Player must actively sweep left/right side to activate
    activationThreshold: 0.3         // Sweep effectiveness needed
  },

  // ----------------------------------------
  // 2: LATE CURL BEHAVIOR (Normalized Speed Model)
  // Curl is continuous function of normalized speed (v/v0)
  // Formula: g(v) = clamp((v_high - v_n) / (v_high - v_low), 0, 1)^p
  // ----------------------------------------
  lateCurl: {
    // Normalized speed thresholds (relative to initial throw speed)
    // v_high: above this, curl is minimal (stone traveling fast/straight)
    // v_low: below this, curl is at maximum
    vHighNorm: 0.75,                 // Curl starts becoming noticeable below 75% speed
    vLowNorm: 0.25,                  // Maximum curl below 25% speed
    // Exponent controls ramp shape: higher = curl "waits" longer then ramps faster
    // 1.5-2.0 = realistic late curl, lower = more gradual/earlier
    exponent: 1.6,                   // Slightly lower for earlier curl onset
    // Maximum multiplier for curl at low speeds
    lateCurlMultiplierMax: 4.0,      // Up to 4x curl at low speeds
    // Curl gain function: returns 0-1 based on normalized speed
    // 0 at high speed, 1 at low speed
    getCurlGain: function(speed, initialSpeed) {
      // Use fallback if no initial speed recorded
      const v0 = initialSpeed > 0 ? initialSpeed : 3.5;
      const vNorm = Math.max(0, speed) / v0;

      // g(v) = clamp((v_high - v_n) / (v_high - v_low), 0, 1)^p
      const rawGain = (this.vHighNorm - vNorm) / (this.vHighNorm - this.vLowNorm);
      const clampedGain = Math.max(0, Math.min(1, rawGain));
      return Math.pow(clampedGain, this.exponent);
    },
    // Full multiplier: 1.0 at high speed, up to max at low speed
    getCurlMultiplier: function(speed, initialSpeed) {
      const gain = this.getCurlGain(speed, initialSpeed);
      return 1 + (this.lateCurlMultiplierMax - 1) * gain;
    }
  },

  // ----------------------------------------
  // 3: ROTATION/STABILITY SYSTEM
  // Rotation affects stability more than curl magnitude
  // ----------------------------------------
  rotation: {
    omegaRef: 1.2,                   // Reference angular velocity (rad/s)
    omegaMin: 0.4,                   // Below this = unstable "dump"
    // Stability: more RPM = less random variance
    // Returns multiplier for shot variance (1.0 = normal, 0.7 = 30% less variance)
    getStabilityFactor: function(omega) {
      const absOmega = Math.abs(omega);
      if (absOmega < this.omegaMin) {
        // Dumped stone - very unstable
        return 1.5;  // 50% MORE variance
      }
      // More rotation = more stable (less variance)
      // At omegaRef, stability = 0.8 (20% less variance)
      const stability = 1.0 - 0.3 * Math.min(absOmega / this.omegaRef, 1.0);
      return Math.max(0.7, stability);
    },
    // Curl magnitude exponent - higher = more difference between min/max handle
    curlOmegaExponent: 0.6           // Stronger relationship for noticeable slider effect
  }
};

// ============================================
// AI STRATEGY & SKILL SYSTEM
// ============================================

const AI_STRATEGY = {
  // ----------------------------------------
  // 4: HAMMER ADVANTAGE SCALING
  // AI exploits hammer more in late game
  // ----------------------------------------
  hammerAdvantage: {
    // Base win probability with hammer in tied game
    baseWinProb: 0.60,               // 60% with hammer early
    // Final end hammer advantage (tied game)
    finalEndWinProb: 0.74,           // 74% in last end
    // Returns aggression modifier based on hammer state
    // Higher = more aggressive (takeouts), Lower = more defensive (guards)
    getAggressionMod: function(hasHammer, endNumber, maxEnds, scoreDiff) {
      const endsRemaining = maxEnds - endNumber + 1;
      const isLateGame = endsRemaining <= 2;
      const isFinalEnd = endsRemaining === 1;

      if (hasHammer) {
        // With hammer: play more aggressive late, especially if tied/trailing
        if (isFinalEnd && scoreDiff <= 0) return 1.3;   // Very aggressive
        if (isLateGame && scoreDiff <= 0) return 1.2;   // Aggressive
        if (scoreDiff < 0) return 1.15;                  // Trailing - aggressive
        return 1.0;                                      // Normal
      } else {
        // Without hammer: try to steal, more guards early
        if (isFinalEnd && scoreDiff >= 0) return 0.7;   // Protect lead - defensive
        if (isLateGame && scoreDiff > 0) return 0.75;   // Defensive
        if (scoreDiff > 0) return 0.85;                  // Leading - careful
        return 1.0;                                      // Normal
      }
    }
  },

  // ----------------------------------------
  // 5: SKILL TIERS (Accuracy + Variance)
  // ----------------------------------------
  skillTiers: {
    // Each tier defines mean error and consistency
    // meanErrorMod: multiplier on base aim error (lower = more accurate)
    // varianceMod: multiplier on shot variance (lower = more consistent)
    // Based on real curling: elite teams ~82% accuracy ±6%
    club: {
      meanErrorMod: 1.3,             // 30% more error
      varianceMod: 1.4,              // 40% more variance (inconsistent)
      accuracy: 0.65                  // ~65% make rate
    },
    regional: {
      meanErrorMod: 1.1,
      varianceMod: 1.2,
      accuracy: 0.72                  // ~72% make rate
    },
    provincial: {
      meanErrorMod: 1.0,             // Baseline
      varianceMod: 1.0,
      accuracy: 0.78                  // ~78% make rate
    },
    national: {
      meanErrorMod: 0.85,
      varianceMod: 0.85,
      accuracy: 0.82                  // ~82% make rate (elite)
    },
    international: {
      meanErrorMod: 0.75,
      varianceMod: 0.7,
      accuracy: 0.85                  // ~85% make rate
    },
    olympic: {
      meanErrorMod: 0.65,
      varianceMod: 0.6,
      accuracy: 0.88                  // ~88% make rate (world class)
    }
  },

  // ----------------------------------------
  // 6: STRATEGY MIX SHIFTS
  // Shot type ratios based on game state
  // ----------------------------------------
  shotMix: {
    // Returns weights for shot categories
    // { draw, guard, hit, peel }
    getWeights: function(scoreDiff, endNumber, maxEnds, hasHammer) {
      const endsRemaining = maxEnds - endNumber + 1;
      const isEarlyGame = endNumber <= 2;
      const isLateGame = endsRemaining <= 2;
      const isFinalEnd = endsRemaining === 1;

      // Base neutral mix (~50/50 draw vs hit)
      let weights = { draw: 0.30, guard: 0.20, hit: 0.35, peel: 0.15 };

      if (scoreDiff > 2) {
        // Big lead - simplify, more takeouts
        weights = { draw: 0.15, guard: 0.10, hit: 0.50, peel: 0.25 };
      } else if (scoreDiff > 0) {
        // Small lead - moderate defense
        weights = { draw: 0.25, guard: 0.15, hit: 0.40, peel: 0.20 };
      } else if (scoreDiff < -2) {
        // Big deficit - high variance offense, more guards
        weights = { draw: 0.35, guard: 0.35, hit: 0.20, peel: 0.10 };
      } else if (scoreDiff < 0) {
        // Small deficit - balanced offense
        weights = { draw: 0.35, guard: 0.25, hit: 0.30, peel: 0.10 };
      }

      // Late game adjustments
      if (isLateGame) {
        if (scoreDiff > 0) {
          // Protecting lead late - more hits
          weights.hit += 0.15;
          weights.guard -= 0.10;
          weights.draw -= 0.05;
        } else if (scoreDiff < 0 && hasHammer) {
          // Trailing with hammer - set up big end
          weights.guard += 0.15;
          weights.draw += 0.05;
          weights.hit -= 0.15;
          weights.peel -= 0.05;
        }
      }

      // Early game - more guards to build
      if (isEarlyGame && hasHammer) {
        weights.guard += 0.10;
        weights.hit -= 0.10;
      }

      // Normalize weights
      const total = weights.draw + weights.guard + weights.hit + weights.peel;
      weights.draw /= total;
      weights.guard /= total;
      weights.hit /= total;
      weights.peel /= total;

      return weights;
    }
  }
};

// Velocities based on real curling timing (T-line to hog = 6.4m)
// Guard: 4.3-4.8s, Draw: 3.6-4.2s, Takeout: 2.9-3.5s, Peel: 2.2-2.8s
const MIN_SLIDE_SPEED = 2.2;      // Ultra-light guard
const MAX_SLIDE_SPEED = 5.0;      // Peel weight

// Camera positions
const THROWER_CAM = { x: 0, y: 1.5, z: -2, lookAt: { x: 0, y: 0, z: 25 } };
const OVERHEAD_CAM = { x: 0, y: 12, z: 28, lookAt: { x: 0, y: 0, z: 40 } };

// Hog line positions (physics units)
const HOG_LINE_Y = HOG_LINE_NEAR * PHYSICS_SCALE;    // Near hog line
const FAR_HOG_LINE_Y = HOG_LINE_FAR * PHYSICS_SCALE; // Far hog line
const HOUSE_CENTER_Y = TEE_LINE_FAR * PHYSICS_SCALE; // Far house center (target)

// Physics timing - frame-rate independent
const PHYSICS_TIMESTEP = 1000 / 60;  // Fixed 60 FPS physics (16.67ms per step)
const MAX_PHYSICS_STEPS = 5;         // Cap to prevent spiral of death
let physicsAccumulator = 0;
let lastPhysicsTime = 0;

// Shot type thresholds (effort 0-100)
const SHOT_TYPES = {
  ULTRA_LIGHT: { min: 0, max: 29, name: 'Ultra Light Guard', color: '#60a5fa' },
  GUARD: { min: 30, max: 49, name: 'Guard', color: '#34d399' },
  DRAW: { min: 50, max: 69, name: 'Draw', color: '#fbbf24' },
  TAKEOUT: { min: 70, max: 84, name: 'Takeout', color: '#f97316' },
  PEEL: { min: 85, max: 100, name: 'Peel / Big Weight', color: '#ef4444' }
};

// Curl/Rotation Physics Constants
// Based on real curling: more rotation = straighter path (less curl)
// Typical rotation: 2-4 rotations over full travel, ~10-15 RPM at release
const CURL_PHYSICS = {
  // Reference angular velocity (rad/s) - ~11.5 RPM, "typical" handle
  OMEGA_REF: 1.2,
  // Minimum angular velocity (below this = unpredictable "dumping")
  OMEGA_MIN: 0.4,
  // Base curl strength constant (tune for desired curl distance)
  K_CURL: 0.00001,  // Reduced significantly - was causing wall hits
  // Speed exponent (how much slower speed increases curl)
  P_SPEED: 1.5,
  // Rotation exponent (how much rotation affects curl, keep small)
  P_ROTATION: 0.35,
  // Minimum speed to avoid division issues
  V_MIN: 0.15,
  // Angular velocity damping per frame (60fps)
  // Stone loses ~25% spin over full run
  SPIN_DAMP: 0.001,
  // Map handle slider (0-100) to angular velocity (rad/s)
  // 0 = minimal rotation (0.2 rad/s) = maximum curl
  // 100 = maximum rotation (1.8 rad/s) = straighter path
  // Wider range for more noticeable curl difference
  HANDLE_TO_OMEGA: (handle) => 0.2 + (handle / 100) * 1.6
};

function getShotType(effort) {
  if (effort <= 29) return SHOT_TYPES.ULTRA_LIGHT;
  if (effort <= 49) return SHOT_TYPES.GUARD;
  if (effort <= 69) return SHOT_TYPES.DRAW;
  if (effort <= 84) return SHOT_TYPES.TAKEOUT;
  return SHOT_TYPES.PEEL;
}

// ============================================
// GAME STATE
// ============================================
const gameState = {
  // Game mode: '1player' or '2player'
  gameMode: '1player',
  computerTeam: 'yellow',  // Computer plays yellow in 1-player mode
  // Computer's current shot info for sweeping decisions
  computerShotTarget: null,  // { x, z, shotType, effort }

  // Country selection
  playerCountry: null,  // { id, name, flag, color }
  opponentCountry: null,  // { id, name, flag, color }
  setupComplete: false,  // Whether initial setup (country, toss) is done

  // Phases: 'aiming' -> 'charging' -> 'sliding' -> 'throwing' -> 'sweeping' -> 'waiting'
  phase: 'aiming',
  currentTeam: 'red',
  end: 1,
  scores: { red: 0, yellow: 0 },
  endScores: { red: [null, null, null, null, null, null, null, null, null, null], yellow: [null, null, null, null, null, null, null, null, null, null] },
  hammer: 'yellow',  // Team with last stone advantage (typically starts with team throwing second)
  stonesThrown: { red: 0, yellow: 0 },
  stones: [],

  // Throwing state
  pullStart: null,
  pullCurrent: null,
  maxPower: 0,
  slideStartTime: null,
  initialThrowSpeed: 0,  // Store initial velocity for normalized curl calculation
  currentPower: 0,
  aimAngle: 0,
  baseAimAngle: 0,  // Base angle from target, mouse adjusts relative to this

  // Curl/Handle system
  // curlDirection: 1 = IN (clockwise), -1 = OUT (counter-clockwise), null = not selected
  curlDirection: null,
  playerCurlDirection: null,  // Remember player's preferred curl direction
  // Handle amount: 0-100, controls rotation rate
  // More handle = more rotation = straighter path (less curl)
  // Less handle = less rotation = more curl (but less predictable)
  handleAmount: 0,  // Default to neutral (middle of slider)
  playerHandleAmount: 0,  // Remember player's preference

  // Sweeping - New model: speed = distance, diagonal bias = curl influence
  isSweeping: false,
  sweepEffectiveness: 0,  // 0-1 based on swipe speed (affects distance/friction)
  sweepCurlInfluence: 0,  // -1 to +1: negative = reduce curl, positive = let it curl more
  sweepTouches: [],       // Track recent touch positions for speed calc
  lastSweepTime: 0,
  sweepAngle: 0,          // Angle from vertical (0° = straight, 90° = horizontal)
  sweepVector: { x: 0, y: 0 }, // Normalized sweep direction vector
  activeStone: null,

  // Preview stone shown during aiming
  previewStone: null,

  // Timing (for split time display)
  tLineCrossTime: null,
  splitTime: null,

  // Physics timing instrumentation (for tuning)
  // gameTime tracks simulated time (unaffected by fast-forward)
  gameTime: 0,
  nearHogCrossTime: null,
  farHogCrossTime: null,
  stoneStopTime: null,

  // Stored slide speed for consistent velocity
  slideSpeed: 0,

  // Preview camera state
  lastMousePos: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
  previewHeight: 0,  // 0 = thrower view, 1 = max height overhead
  previewLocked: false,  // When true, panning is disabled
  targetViewZoom: 1,  // Pinch zoom level for target view (1 = default, 2 = max zoom in)

  // Target marker
  targetMarker: null,
  targetPosition: null,

  // Opponent's target marker (multiplayer)
  opponentTargetMarker: null,
  lastAimBroadcast: 0,  // Throttle aim state broadcasts
  lastPositionSync: 0,  // Throttle position sync broadcasts
  pendingSync: null,    // Pending position sync to interpolate toward

  // Turn timer (multiplayer)
  turnTimer: null,      // setInterval reference
  turnTimeLeft: 60,     // Seconds remaining

  // Aiming line
  aimLine: null,

  // Preview stone at hack (visual only)
  previewStone: null,

  // Settings
  settings: {
    difficulty: 'medium',  // easy, medium, hard
    soundEnabled: true,
    gameLength: 8,  // number of ends
    quickPlayLevel: 4  // Default to National for quick play
  },

  // CPU fast forward (hold to speed up CPU turn)
  cpuFastForward: false,

  // Career mode
  career: {
    level: 1,  // 1-8
    wins: 0,
    losses: 0
  },

  // Learn mode
  learnMode: {
    enabled: false,
    level: 1,  // 1=Beginner, 2=Know Basics, 3=Intermediate, 4=Advanced
    tutorialsShown: {},  // Track which tutorials have been shown
    tutorialsDisabled: false,  // User opted out of tutorials
    currentTutorial: null,  // Currently displayed tutorial ID
    tutorialPaused: false,  // Physics paused for tutorial
    currentSuggestion: null,  // Current shot suggestion
    lastShotIntended: null,   // What the coach suggested
    showOverlays: true,       // Show visual aids on ice
    panelExpanded: true,      // Coach panel expanded or minimized
    preThrowState: null,      // Snapshot of stone positions before throw
    preTossPhase: false       // Showing pre-toss tutorials
  },

  // Coach target marker (Three.js mesh)
  coachTargetMarker: null,

  // First-run tutorial state (for regular mode)
  firstRunTutorial: null,  // { id, pausesGame }
  firstRunTutorialsShownThisSession: {},  // Track tutorials shown this session (resets on refresh)
  welcomeTutorialActive: false,  // Welcome tutorial showing before mode selection
  interactiveTutorialMode: false,  // Interactive tutorial mode active

  // App backgrounding state (iOS lifecycle)
  isPaused: false,
  pausedPhase: null,  // Phase when paused (for resume)
  activeTimers: [],    // Track setTimeout IDs for cleanup on pause

  // Practice mode state
  practiceMode: {
    active: false,
    currentDrill: null,      // 'takeout' | 'bump' | 'draw' | 'guard' | 'freeze' | 'hitroll'
    currentScenario: null,   // Scenario ID within drill
    difficulty: 1,           // 1-5 progressive difficulty
    attempts: 0,             // Attempts on current scenario
    successes: 0,            // Successes on current scenario
    currentStreak: 0,        // Current success streak
    showHints: true,         // Show hint panel
    lastOutcome: null        // 'success' | 'fail' | null
  }
};

// Level definitions
const CAREER_LEVELS = [
  // Variance values: controls aim error in radians (0.10 = ±2.9°, 0.05 = ±1.4°)
  { id: 1, name: 'Club', difficulty: 0.12, winsToAdvance: 2, color: '#6b7280', difficultyLabel: 'Beginner' },
  { id: 2, name: 'Regional', difficulty: 0.10, winsToAdvance: 2, color: '#3b82f6', difficultyLabel: 'Beginner' },
  { id: 3, name: 'Provincial', difficulty: 0.08, winsToAdvance: 3, color: '#8b5cf6', difficultyLabel: 'Easy' },
  { id: 4, name: 'National', difficulty: 0.06, winsToAdvance: 3, color: '#ef4444', difficultyLabel: 'Medium' },
  { id: 5, name: 'International', difficulty: 0.05, winsToAdvance: 3, color: '#f59e0b', difficultyLabel: 'Medium' },
  { id: 6, name: 'World Championship', difficulty: 0.04, winsToAdvance: 4, color: '#10b981', difficultyLabel: 'Hard' },
  { id: 7, name: 'Olympic Trials', difficulty: 0.03, winsToAdvance: 4, color: '#ec4899', difficultyLabel: 'Expert' },
  { id: 8, name: 'Olympics', difficulty: 0.02, winsToAdvance: null, color: '#ffd700', difficultyLabel: 'Elite' }  // Final level
];

// Curling nations with flag emojis
const CURLING_COUNTRIES = [
  { id: 'canada', name: 'Canada', flag: '🇨🇦', color: '#ef4444' },
  { id: 'sweden', name: 'Sweden', flag: '🇸🇪', color: '#3b82f6' },
  { id: 'switzerland', name: 'Switzerland', flag: '🇨🇭', color: '#ef4444' },
  { id: 'norway', name: 'Norway', flag: '🇳🇴', color: '#ef4444' },
  { id: 'usa', name: 'USA', flag: '🇺🇸', color: '#3b82f6' },
  { id: 'scotland', name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', color: '#3b82f6' },
  { id: 'japan', name: 'Japan', flag: '🇯🇵', color: '#ef4444' },
  { id: 'south_korea', name: 'South Korea', flag: '🇰🇷', color: '#1e40af' },
  { id: 'china', name: 'China', flag: '🇨🇳', color: '#ef4444' },
  { id: 'italy', name: 'Italy', flag: '🇮🇹', color: '#22c55e' },
  { id: 'germany', name: 'Germany', flag: '🇩🇪', color: '#1f2937' },
  { id: 'denmark', name: 'Denmark', flag: '🇩🇰', color: '#ef4444' },
  { id: 'russia', name: 'Russia', flag: '🇷🇺', color: '#3b82f6' },
  { id: 'gb', name: 'Great Britain', flag: '🇬🇧', color: '#1e40af' },
  { id: 'finland', name: 'Finland', flag: '🇫🇮', color: '#3b82f6' },
  { id: 'netherlands', name: 'Netherlands', flag: '🇳🇱', color: '#f97316' }
];

// ============================================
// SHOT FEEDBACK SYSTEM
// ============================================

// Feedback configuration - thresholds can be tuned per difficulty
const SHOT_FEEDBACK_CONFIG = {
  // Distance thresholds (in game units, relative to stone radius ~0.14)
  thresholds: {
    button: 0.2,          // Within button (perfect draw)
    fourFoot: 0.61,       // Within 4-foot ring
    eightFoot: 1.22,      // Within 8-foot ring
    twelveFoot: 1.83,     // Within 12-foot ring (house)
    nearMissBuffer: 0.4,  // Extra buffer for "almost" in house
    guardZoneStart: null, // Set dynamically based on HOG_LINE_FAR
    guardZoneEnd: null    // Set dynamically based on TEE_LINE_FAR
  },

  // Success messages by shot outcome
  successMessages: {
    button: ['Button!', 'Perfect!', 'Bullseye!'],
    fourFoot: ['Great Draw!', 'Nice Shot!', 'In the 4-foot!'],
    eightFoot: ['Good Shot!', 'In the House!', 'Solid Draw!'],
    twelveFoot: ['In the House!', 'Counting!'],
    guard: ['Nice Guard!', 'Great Position!', 'Guard Set!'],
    takeout: ['Nice Takeout!', 'Got it!', 'Cleared!'],
    doubleTakeout: ['Double!', 'Two Birds!', 'Cleared them out!'],
    hitAndStick: ['Hit & Stick!', 'Perfect Takeout!', 'Textbook!'],
    freeze: ['Great Freeze!', 'Frozen!', 'Perfectly Placed!']
  },

  // Near-miss messages
  nearMissMessages: {
    justHeavy: ['Just heavy!', 'A touch too much!', 'Just through!'],
    justLight: ['Just light!', 'Almost there!', 'Needed a bit more!'],
    justWide: ['Just wide!', 'Barely missed!', 'So close!'],
    almostHouse: ['Ooh, so close!', 'Almost in!', 'Just short!'],
    almostTakeout: ['Clipped it!', 'Just grazed!', 'Almost got it!'],
    rubbed: ['Rubbed!', 'Picked!', 'Deflected!']
  },

  // Timing settings
  displayDuration: 2000,  // How long to show feedback (ms)
  fadeOutDuration: 300    // Fade animation duration (ms)
};

// Track last shot info for feedback evaluation
let lastShotInfo = {
  team: null,
  targetX: null,
  targetZ: null,
  shotType: null,
  effort: null,
  preThrowState: null  // Snapshot of stones before throw
};

// ============================================
// FAQ DATA
// ============================================

const FAQ_DATA = [
  {
    category: 'Getting Started',
    icon: '🎮',
    questions: [
      {
        q: 'How do I throw a stone?',
        a: 'Tap and hold anywhere on the ice to set your target, then release to throw. The longer you hold, the more power you apply. On mobile, you can also swipe to throw.'
      },
      {
        q: 'What are the basic controls?',
        a: 'Tap to aim, hold for power, release to throw. Use the left/right curl buttons to add spin. Tap the broom icon to toggle sweeping while the stone is moving.'
      },
      {
        q: 'How do I switch between camera views?',
        a: 'Double-tap anywhere on the screen to toggle between the overhead view and the throwing view. You can also use the camera button in the corner.'
      }
    ]
  },
  {
    category: 'Sweeping',
    icon: '🧹',
    questions: [
      {
        q: 'What does sweeping do?',
        a: 'Sweeping heats the ice, reducing friction and making the stone travel farther and straighter. Use it to help a stone reach its target or to reduce curl.'
      },
      {
        q: 'How do I sweep in the game?',
        a: 'While your stone is moving, swipe back and forth on the screen. The faster and more consistently you swipe, the more effective your sweeping. You\'ll see a percentage indicator showing your sweep intensity.'
      },
      {
        q: 'How does sweep direction affect the stone?',
        a: 'Your sweep angle matters! Sweeping parallel to the stone\'s path (▲ indicator) gives maximum effect - the stone travels farther and straighter. Sweeping at a diagonal (◢) is moderately effective. Sweeping perpendicular to the path (►) wastes energy and has minimal effect. The percentage shown while sweeping indicates your effectiveness based on speed and angle. For best results, swipe back and forth in line with where the stone is heading.'
      },
      {
        q: 'When should I sweep vs let it curl?',
        a: 'Sweep when: the stone needs more distance to reach its target, you want it to travel straighter (less curl), or you\'re trying to push through guards. Don\'t sweep when: the stone has enough weight, you need maximum curl to get around a guard, or the stone is already past your target.'
      },
      {
        q: 'What is defensive sweeping?',
        a: 'Once your opponent\'s stone crosses the T-line (the center line of the house), you can sweep it! This is called defensive sweeping. Use it to push their stone through the house and out of play, or to move it to a less favorable position. The "Sweep past T-Line" message tells you when defensive sweeping becomes available.'
      }
    ]
  },
  {
    category: 'Curling Rules & Scoring',
    icon: '📋',
    questions: [
      {
        q: 'How is scoring calculated?',
        a: 'After all 16 stones are thrown (8 per team), only one team scores. The team with the stone closest to the button scores one point for each of their stones that is closer than the opponent\'s closest stone.'
      },
      {
        q: 'What is the "hammer" and why does it matter?',
        a: 'The hammer is the last stone advantage. The team with hammer throws last in an end, giving them the final chance to score. The team that doesn\'t score gets hammer in the next end.'
      },
      {
        q: 'What is the Free Guard Zone rule?',
        a: 'Stones in the Free Guard Zone (between the hog line and the house, excluding the house) cannot be removed from play by the opposing team until after the first 4 stones of the end have been thrown.'
      },
      {
        q: 'What happens if a stone goes out of play?',
        a: 'A stone that crosses the back line, touches the side boards, or stops before the far hog line is removed from play and doesn\'t count for scoring.'
      },
      {
        q: 'How many ends are in a game?',
        a: 'A standard game has 8 ends. In Career Mode, difficulty and tournament type may vary the number of ends. The team with the most points after all ends wins.'
      }
    ]
  },
  {
    category: 'Shot Types',
    icon: '🥌',
    questions: [
      {
        q: 'What is a draw?',
        a: 'A draw is a shot intended to come to rest in a specific position, usually in the house (scoring area). Draws require precise weight control.'
      },
      {
        q: 'What is a takeout?',
        a: 'A takeout removes an opponent\'s stone from play by hitting it with enough force. Takeouts are used to eliminate scoring threats or clear the house.'
      },
      {
        q: 'What is a guard?',
        a: 'A guard is a stone placed in front of the house to protect other stones from being hit. Guards are often used early in the end to set up scoring opportunities.'
      },
      {
        q: 'What is a freeze?',
        a: 'A freeze is a draw that comes to rest touching another stone. This makes it difficult for the opponent to remove without also affecting their own stone.'
      },
      {
        q: 'What is a hit-and-roll?',
        a: 'A hit-and-roll removes an opponent\'s stone while your thrown stone "rolls" to a new position, ideally behind cover or into a scoring position.'
      },
      {
        q: 'How do I control shot power?',
        a: 'Hold longer before releasing for more power. The power indicator shows your current weight. For draws, use lighter weight; for takeouts, use heavier weight.'
      }
    ]
  },
  {
    category: 'Career Mode',
    icon: '🏆',
    questions: [
      {
        q: 'How does career progression work?',
        a: 'Start at Club level competing in local bonspiels. Win tournaments to earn qualifications for higher-tier competitions, eventually reaching Provincial, National, and Olympic levels.'
      },
      {
        q: 'What are the different tournament tiers?',
        a: 'From lowest to highest: Club (local bonspiels), Regional (playdowns), Provincial (championships), National, International (World Championships), and Olympic.'
      },
      {
        q: 'How do I qualify for higher-level tournaments?',
        a: 'Win or place highly in tournaments at your current tier. Winning a Club League qualifies you for Regionals, winning Regionals qualifies for Provincials, and so on.'
      },
      {
        q: 'What happens if I lose a tournament?',
        a: 'Losing means you\'re eliminated from that tournament, but you can enter other available tournaments. There\'s no demotion - you keep your tier and try again next season.'
      },
      {
        q: 'Can I be demoted to a lower tier?',
        a: 'No. Once you\'ve qualified for a tier, you maintain that status. If you fail to advance, you simply retry in the next season with your current qualifications intact.'
      },
      {
        q: 'Why can\'t I select my country at the start?',
        a: 'Career Mode follows real curling progression: you start representing your local club. Once you reach National/International tier, you\'ll be prompted to select a country to represent.'
      }
    ]
  },
  {
    category: 'Tournaments & Brackets',
    icon: '🗓️',
    questions: [
      {
        q: 'What is the Page Playoff system?',
        a: 'The Page Playoff is used in major curling events. The top 4 teams after round-robin play: 1v2 (winner to final), 3v4 (loser out), then the 1v2 loser plays the 3v4 winner for the other finals spot.'
      },
      {
        q: 'How does single elimination work?',
        a: 'In single elimination, one loss and you\'re out. Win and advance to the next round. Club bonspiels often use this format for faster tournaments.'
      },
      {
        q: 'What are rivals?',
        a: 'Rivals are recurring opponents you\'ll face throughout your career. They have memorable personalities and your win/loss record against them is tracked. Beat them to earn bragging rights!'
      },
      {
        q: 'Do results carry over between seasons?',
        a: 'Your tier level, club identity, and lifetime stats carry over. However, tournament qualifications (except your base tier) reset each season - you must re-earn Worlds and Olympic spots annually.'
      }
    ]
  },
  {
    category: 'Difficulty & AI',
    icon: '🤖',
    questions: [
      {
        q: 'What do the difficulty levels affect?',
        a: 'Difficulty affects both player aids and CPU skill. Player aids: Easy gives you a longer aiming arrow (12m) to help visualize your shot, while Medium/Hard have a shorter arrow (5m). CPU changes: Easy AI is 30% less accurate, plays guards only 25% of the time, and makes strategic mistakes 15% of shots. Hard AI is 25% more accurate, plays guards 70% of the time, never makes strategic mistakes, and hits 5% harder on takeouts.'
      },
      {
        q: 'What\'s the difference between Easy, Medium, and Hard?',
        a: 'Easy: Long aiming arrow, CPU misses more often, plays simpler strategy. Medium: Standard arrow, balanced CPU accuracy and strategy. Hard: Standard arrow, CPU rarely misses, plays aggressive takeouts and smart guards, makes no strategic errors. The CPU also gets progressively better at precision shots (draws, guards) on higher difficulties.'
      },
      {
        q: 'Why do some opponents play aggressively?',
        a: 'AI opponents have personalities that affect their playstyle. Aggressive opponents favor takeouts and risky shots, while conservative opponents prefer guards and safe draws.'
      },
      {
        q: 'What are AI personality types?',
        a: 'Opponents can be Aggressive (lots of takeouts), Patient (builds up position), Risk-Taker (attempts difficult shots), Conservative (plays it safe), or Balanced (adapts to situation).'
      }
    ]
  },
  {
    category: 'Saves & Progress',
    icon: '💾',
    questions: [
      {
        q: 'Is my progress saved automatically?',
        a: 'Yes! Career progress is automatically saved to your browser\'s local storage after each match and tournament. Your progress persists between sessions.'
      },
      {
        q: 'Can I have multiple career saves?',
        a: 'Currently, the game supports one career save. Starting a new career will overwrite your existing progress. A multiple-save feature may come in a future update.'
      },
      {
        q: 'How do I reset my career?',
        a: 'Open Settings (gear icon) during a game, scroll to the Career Progress section, and tap "Reset Career". This will erase all progress and let you start fresh.'
      },
      {
        q: 'How do I save a game scenario for practice?',
        a: 'During a game, when stones have stopped moving, a 💾 button appears in the top-right. Tap it to save the current stone positions. Saved scenarios appear in Practice Mode under "Custom" - perfect for practicing tricky situations you encounter!'
      }
    ]
  },
  {
    category: 'Practice Mode',
    icon: '🎯',
    questions: [
      {
        q: 'What is Practice Mode?',
        a: 'Practice Mode lets you train specific shots without playing a full game. Choose from Takeouts, Draws, Guards, Freezes, Hit & Rolls, Bumps, and Skip Calls. Each drill has multiple scenarios with increasing difficulty.'
      },
      {
        q: 'What is Skip Calls mode?',
        a: 'Skip Calls is a strategic training mode where you make decisions like a real skip. You\'re presented with a game scenario (stones on ice, score, end number) and must decide: where to aim, which curl direction, and what weight to use. After making your call, the system evaluates your decision against the optimal play and explains the reasoning.'
      },
      {
        q: 'How do I make a Skip Call?',
        a: 'In Skip Calls mode: 1) Tap on the ice to place your target, 2) Select your curl direction (left or right), 3) Choose your weight (Guard, Draw, Control, or Takeout), 4) Press "Make Call" to see how your decision compares to optimal strategy. You can then try executing your shot or move to the next scenario.'
      },
      {
        q: 'What do the Skip Call ratings mean?',
        a: 'Excellent Call: Your decision matches the optimal play. Good Call: Solid choice, close to optimal. Okay: Reasonable but not ideal for the situation. Consider This: The scenario called for a different approach - read the explanation to learn why.'
      },
      {
        q: 'How do Custom scenarios work?',
        a: 'During any game, save stone positions using the 💾 button. These appear in Practice Mode under "Custom". Perfect for recreating and practicing specific situations you encounter in games.'
      }
    ]
  }
];

// ============================================
// PRACTICE MODE - Drill Scenarios
// ============================================

const PRACTICE_DRILLS = {
  takeout: { name: 'Takeouts', icon: '⚡', description: 'Remove opponent stones from play' },
  bump: { name: 'Bumps & Taps', icon: '👆', description: 'Gentle touches to adjust positions' },
  draw: { name: 'Draws', icon: '🎯', description: 'Precision placement shots' },
  guard: { name: 'Guards', icon: '🛡️', description: 'Strategic protection shots' },
  freeze: { name: 'Freezes', icon: '❄️', description: 'Come to rest touching another stone' },
  hitroll: { name: 'Hit & Roll', icon: '🎱', description: 'Takeout with controlled roll' },
  skip: { name: 'Skip Calls', icon: '🧠', description: 'Make strategic decisions like a skip', isStrategic: true }
};

// TEE_LINE_FAR = 41.07, BUTTON position is (0, 41.07)
// Stone positions use game coordinates (x, z) where z is along the sheet
const PRACTICE_SCENARIOS = {
  takeout: [
    {
      id: 'takeout_1',
      name: 'Open Takeout',
      difficulty: 1,
      description: 'Remove the opponent stone with a clear path',
      stones: [
        { team: 'yellow', x: 0, z: 41.07 }  // Stone on button
      ],
      target: { type: 'takeout', minRemoved: 1 },
      hint: 'Aim directly at the stone, use 70-80% power'
    },
    {
      id: 'takeout_2',
      name: 'Offset Takeout',
      difficulty: 1,
      description: 'Hit the stone slightly off-center',
      stones: [
        { team: 'yellow', x: 0.5, z: 40.5 }  // Stone offset right
      ],
      target: { type: 'takeout', minRemoved: 1 },
      hint: 'Aim at the center of the stone, adjust for the angle'
    },
    {
      id: 'takeout_3',
      name: 'Angled Takeout',
      difficulty: 2,
      description: 'Remove a stone at a sharper angle',
      stones: [
        { team: 'yellow', x: 1.0, z: 40.2 }  // Stone further offset
      ],
      target: { type: 'takeout', minRemoved: 1 },
      hint: 'Use inside-out curl to hit the stone cleanly'
    },
    {
      id: 'takeout_4',
      name: 'Guarded Takeout',
      difficulty: 3,
      description: 'Navigate around a guard to hit the target',
      stones: [
        { team: 'yellow', x: 0, z: 41.07 },   // Target on button
        { team: 'yellow', x: 0.3, z: 38.5 }   // Guard in front
      ],
      target: { type: 'takeout', minRemoved: 1, targetIndex: 0 },
      hint: 'Curl around the guard to find the target'
    },
    {
      id: 'takeout_5',
      name: 'Double Takeout',
      difficulty: 4,
      description: 'Remove two stones with one shot',
      stones: [
        { team: 'yellow', x: -0.3, z: 41.0 },  // Two stones close together
        { team: 'yellow', x: 0.3, z: 40.8 }
      ],
      target: { type: 'takeout', minRemoved: 2 },
      hint: 'Hit the first stone to drive it into the second'
    },
    {
      id: 'takeout_6',
      name: 'Triple Takeout',
      difficulty: 5,
      description: 'Remove three stones with one devastating shot',
      stones: [
        { team: 'yellow', x: 0, z: 41.2 },
        { team: 'yellow', x: -0.4, z: 40.6 },
        { team: 'yellow', x: 0.4, z: 40.4 }
      ],
      target: { type: 'takeout', minRemoved: 3 },
      hint: 'Hit the center stone hard to scatter all three'
    },
    {
      id: 'takeout_7',
      name: 'Run-back Double',
      difficulty: 5,
      description: 'Hit one stone into another to remove both',
      stones: [
        { team: 'yellow', x: 0, z: 38.5 },   // Guard in front
        { team: 'yellow', x: 0, z: 41.0 }    // Shot stone behind
      ],
      target: { type: 'takeout', minRemoved: 2 },
      hint: 'Hit the guard to drive it back into the shot stone'
    },
    {
      id: 'takeout_8',
      name: 'Raise Takeout',
      difficulty: 5,
      description: 'Hit your own stone to take out an opponent',
      stones: [
        { team: 'red', x: 0, z: 38.0 },      // Your guard
        { team: 'yellow', x: 0, z: 41.0 }    // Target behind it
      ],
      target: { type: 'raise_takeout', raiseStoneIndex: 0, targetStoneIndex: 1 },
      hint: 'Promote your guard into their stone to remove it'
    }
  ],

  bump: [
    {
      id: 'bump_1',
      name: 'Nudge to Button',
      difficulty: 1,
      description: 'Bump your stone closer to the center',
      stones: [
        { team: 'red', x: 0, z: 40.0 }  // Own stone in front of button
      ],
      target: { type: 'bump', stoneIndex: 0, zone: 'button' },
      hint: 'Use light weight (40-50%) to gently push the stone'
    },
    {
      id: 'bump_2',
      name: 'Tap Back',
      difficulty: 2,
      description: 'Push the opponent stone to the back of the house',
      stones: [
        { team: 'yellow', x: 0, z: 40.5 }  // Opponent stone
      ],
      target: { type: 'bump', zone: 'backHouse' },
      hint: 'Medium weight to move it back without removing'
    },
    {
      id: 'bump_3',
      name: 'Promotion',
      difficulty: 3,
      description: 'Bump your guard into scoring position',
      stones: [
        { team: 'red', x: 0, z: 38.0 }  // Own guard
      ],
      target: { type: 'bump', stoneIndex: 0, zone: 'house' },
      hint: 'Promote your guard into the rings with controlled weight'
    },
    {
      id: 'bump_4',
      name: 'Raise to Button',
      difficulty: 4,
      description: 'Promote your guard directly onto the button',
      stones: [
        { team: 'red', x: 0, z: 38.5 }  // Own guard
      ],
      target: { type: 'bump', stoneIndex: 0, zone: 'button' },
      hint: 'Perfect weight to raise the stone to the button'
    },
    {
      id: 'bump_5',
      name: 'Angle Raise',
      difficulty: 5,
      description: 'Hit the side of your guard to angle it to the button',
      stones: [
        { team: 'red', x: 0.6, z: 38.0 }  // Own guard offset
      ],
      target: { type: 'bump', stoneIndex: 0, zone: 'button' },
      hint: 'Hit the outside of the stone to redirect it to center'
    },
    {
      id: 'bump_6',
      name: 'Hit and Stick',
      difficulty: 4,
      description: 'Remove opponent and stay in the same spot',
      stones: [
        { team: 'yellow', x: 0, z: 41.0 }  // Target on button
      ],
      target: { type: 'hit_and_stick', targetZone: 'fourFoot' },
      hint: 'Hit nose-on with enough weight to stick'
    }
  ],

  draw: [
    {
      id: 'draw_1',
      name: 'Open Draw',
      difficulty: 1,
      description: 'Draw to the button with an empty house',
      stones: [],  // Empty house
      target: { type: 'draw', ring: 'fourFoot' },
      hint: 'Aim for the button, use 50-60% power'
    },
    {
      id: 'draw_2',
      name: 'Draw Around Guard',
      difficulty: 2,
      description: 'Navigate around a center guard to score',
      stones: [
        { team: 'yellow', x: 0, z: 38.5 }  // Opponent center guard
      ],
      target: { type: 'draw', ring: 'eightFoot' },
      hint: 'Use curl to swing wide around the guard'
    },
    {
      id: 'draw_3',
      name: 'Draw to the Side',
      difficulty: 2,
      description: 'Draw to the left side of the house away from opponent',
      stones: [
        { team: 'yellow', x: 0.8, z: 41.0 }  // Opponent stone on right side
      ],
      target: { type: 'draw', ring: 'eightFoot', side: 'left' },
      hint: 'Draw to the open side to score without contact'
    },
    {
      id: 'draw_4',
      name: 'Come Around',
      difficulty: 3,
      description: 'Curl behind your own guard for protection',
      stones: [
        { team: 'red', x: 0.5, z: 38.0 }  // Own guard for cover
      ],
      target: { type: 'draw', ring: 'fourFoot', behindGuard: true },
      hint: 'Curl behind your guard to hide from takeouts'
    },
    {
      id: 'draw_5',
      name: 'Split the House',
      difficulty: 3,
      description: 'Draw between two opponent stones to score',
      stones: [
        { team: 'yellow', x: -0.7, z: 40.8 },  // Opponent stone left
        { team: 'yellow', x: 0.7, z: 41.2 }    // Opponent stone right
      ],
      target: { type: 'draw', ring: 'fourFoot' },
      hint: 'Thread the needle between the two stones'
    },
    {
      id: 'draw_6',
      name: 'Back of House',
      difficulty: 4,
      description: 'Draw to the back of the house behind opponents',
      stones: [
        { team: 'yellow', x: 0, z: 40.5 }  // Opponent in front of button
      ],
      target: { type: 'draw', ring: 'eightFoot', zone: 'back' },
      hint: 'Use more weight to get behind their stone'
    },
    {
      id: 'draw_7',
      name: 'Tight Port',
      difficulty: 4,
      description: 'Navigate through a narrow gap to score',
      stones: [
        { team: 'yellow', x: -0.4, z: 38.2 },  // Guard left
        { team: 'yellow', x: 0.5, z: 38.8 }    // Guard right
      ],
      target: { type: 'draw', ring: 'fourFoot' },
      hint: 'Find the port between the guards'
    },
    {
      id: 'draw_8',
      name: 'Buried Draw',
      difficulty: 5,
      description: 'Hide completely behind multiple guards',
      stones: [
        { team: 'red', x: 0.3, z: 38.0 },   // Own guard
        { team: 'red', x: 0.5, z: 39.5 }    // Second own guard
      ],
      target: { type: 'draw', ring: 'button', behindGuard: true },
      hint: 'Curl around both guards to bury on the button'
    }
  ],

  guard: [
    {
      id: 'guard_1',
      name: 'Center Guard',
      difficulty: 1,
      description: 'Place a guard on the centerline',
      stones: [],
      target: { type: 'guard', zone: 'center' },
      hint: 'Stop the stone between hog line and house, on center'
    },
    {
      id: 'guard_2',
      name: 'Corner Guard',
      difficulty: 2,
      description: 'Place a guard off to one side',
      stones: [],
      target: { type: 'guard', zone: 'corner', x: 0.8 },
      hint: 'Aim off-center, light weight to stop short of house'
    },
    {
      id: 'guard_3',
      name: 'Tight Guard',
      difficulty: 3,
      description: 'Place a guard just in front of the house',
      stones: [],
      target: { type: 'guard', zone: 'tight' },
      hint: 'Almost in the house but not quite'
    },
    {
      id: 'guard_4',
      name: 'Long Guard',
      difficulty: 4,
      description: 'Place a guard far from the house',
      stones: [],
      target: { type: 'guard', zone: 'long' },
      hint: 'Light weight, stop well before the house'
    }
  ],

  freeze: [
    {
      id: 'freeze_1',
      name: 'Open Freeze',
      difficulty: 1,
      description: 'Freeze to a stone on the button',
      stones: [
        { team: 'red', x: 0, z: 41.07 }  // Own stone on button
      ],
      target: { type: 'freeze', stoneIndex: 0 },
      hint: 'Come to rest just touching the stone'
    },
    {
      id: 'freeze_2',
      name: 'Side Freeze',
      difficulty: 2,
      description: 'Freeze to the side of a stone',
      stones: [
        { team: 'red', x: 0.5, z: 40.5 }
      ],
      target: { type: 'freeze', stoneIndex: 0 },
      hint: 'Angle in to touch the side of the stone'
    },
    {
      id: 'freeze_3',
      name: 'Opponent Freeze',
      difficulty: 3,
      description: 'Freeze to an opponent stone to protect it',
      stones: [
        { team: 'yellow', x: 0, z: 41.07 }  // Opponent on button
      ],
      target: { type: 'freeze', stoneIndex: 0 },
      hint: 'Freeze makes it hard for them to remove cleanly'
    }
  ],

  hitroll: [
    {
      id: 'hitroll_1',
      name: 'Basic Hit-Roll',
      difficulty: 1,
      description: 'Hit the stone and roll to the side',
      stones: [
        { team: 'yellow', x: 0, z: 40.5 }  // Target stone
      ],
      target: { type: 'hitroll', rollZone: 'house' },
      hint: 'Hit at an angle to roll off into position'
    },
    {
      id: 'hitroll_2',
      name: 'Roll to Button',
      difficulty: 2,
      description: 'Hit and roll to scoring position',
      stones: [
        { team: 'yellow', x: 0.5, z: 40.0 }
      ],
      target: { type: 'hitroll', rollZone: 'fourFoot' },
      hint: 'Thin hit to maximize roll distance'
    },
    {
      id: 'hitroll_3',
      name: 'Roll Behind Cover',
      difficulty: 3,
      description: 'Hit and roll behind a guard',
      stones: [
        { team: 'yellow', x: -0.5, z: 40.5 },  // Target
        { team: 'red', x: 0.5, z: 38.0 }       // Guard to hide behind
      ],
      target: { type: 'hitroll', rollZone: 'behindGuard', guardIndex: 1 },
      hint: 'Hit the outside of the stone to roll toward the guard'
    }
  ],

  skip: [
    {
      id: 'skip_1',
      name: 'First Stone with Hammer',
      difficulty: 1,
      description: 'Empty house, first stone of the end. You have hammer.',
      stones: [],
      context: {
        end: 2,
        totalEnds: 8,
        redScore: 0,
        yellowScore: 0,
        hammer: 'red',
        stonesRemaining: 8
      },
      solutions: [
        {
          type: 'guard',
          rating: 'excellent',
          target: { x: 0, z: 38.5 },
          weight: 'guard',
          curl: 'either',
          explanation: 'With hammer in an early end, placing a center guard controls the house and sets up scoring opportunities. This is the standard play.'
        },
        {
          type: 'draw',
          rating: 'good',
          target: { x: 0, z: 41 },
          weight: 'draw',
          curl: 'either',
          explanation: 'Drawing to the button works but gives your opponent an easy target. You\'re not using your hammer advantage optimally.'
        },
        {
          type: 'corner',
          rating: 'okay',
          target: { x: 0.8, z: 38.5 },
          weight: 'guard',
          curl: 'either',
          explanation: 'A corner guard is less common but can work in some strategies. Center guard is usually preferred.'
        }
      ],
      hint: 'Think about what having the hammer means for your strategy.'
    },
    {
      id: 'skip_2',
      name: 'First Stone without Hammer',
      difficulty: 1,
      description: 'Empty house, first stone. Opponent has hammer.',
      stones: [],
      context: {
        end: 2,
        totalEnds: 8,
        redScore: 0,
        yellowScore: 0,
        hammer: 'yellow',
        stonesRemaining: 8
      },
      solutions: [
        {
          type: 'draw',
          rating: 'excellent',
          target: { x: 0, z: 41 },
          weight: 'draw',
          curl: 'either',
          explanation: 'Without hammer, drawing to the button puts pressure on your opponent. They must respond to your stone.'
        },
        {
          type: 'guard',
          rating: 'okay',
          target: { x: 0, z: 38.5 },
          weight: 'guard',
          curl: 'either',
          explanation: 'A guard without hammer is risky - it can help your opponent set up their offense. Usually better to draw.'
        }
      ],
      hint: 'Without hammer, you want to put pressure on the opponent early.'
    },
    {
      id: 'skip_3',
      name: 'Opponent on Button',
      difficulty: 2,
      description: 'Opponent has a stone on the button. You have hammer.',
      stones: [
        { team: 'yellow', x: 0, z: 41.07 }
      ],
      context: {
        end: 3,
        totalEnds: 8,
        redScore: 1,
        yellowScore: 2,
        hammer: 'red',
        stonesRemaining: 6
      },
      solutions: [
        {
          type: 'draw',
          rating: 'excellent',
          target: { x: 0.6, z: 40.8 },
          weight: 'draw',
          curl: 'right',
          explanation: 'Draw around to the 4-foot. This scores a point if they miss, and you still have hammer if they take it out.'
        },
        {
          type: 'takeout',
          rating: 'good',
          target: { x: 0, z: 41.07 },
          weight: 'takeout',
          curl: 'either',
          explanation: 'Taking it out clears the house but resets the end. With hammer, you usually want to build, not just clear.'
        },
        {
          type: 'guard',
          rating: 'okay',
          target: { x: 0.5, z: 38.5 },
          weight: 'guard',
          curl: 'either',
          explanation: 'A guard protects future draws but leaves their button stone counting. Riskier with them already scoring.'
        }
      ],
      hint: 'With hammer, you want to score multiple points, not just one.'
    },
    {
      id: 'skip_4',
      name: 'Use Your Guard',
      difficulty: 2,
      description: 'You have a center guard. Opponent hasn\'t scored yet.',
      stones: [
        { team: 'red', x: 0, z: 38.5 }
      ],
      context: {
        end: 3,
        totalEnds: 8,
        redScore: 2,
        yellowScore: 1,
        hammer: 'red',
        stonesRemaining: 6
      },
      solutions: [
        {
          type: 'draw',
          rating: 'excellent',
          target: { x: 0.3, z: 41 },
          weight: 'draw',
          curl: 'right',
          explanation: 'Come around your guard to hide behind it! This makes your stone very difficult to remove. Classic hammer strategy.'
        },
        {
          type: 'guard',
          rating: 'good',
          target: { x: 0.5, z: 39.5 },
          weight: 'guard',
          curl: 'either',
          explanation: 'Stacking another guard adds protection, but you\'re not scoring yet. Good if you want to build more.'
        },
        {
          type: 'draw',
          rating: 'okay',
          target: { x: 0.8, z: 41 },
          weight: 'draw',
          curl: 'right',
          explanation: 'Drawing to the side ignores your guard\'s protection. The stone is more exposed to takeouts.'
        }
      ],
      hint: 'Your guard is there for a reason - use it!'
    },
    {
      id: 'skip_5',
      name: 'Down Two, Final End',
      difficulty: 3,
      description: 'Down 2 points in the final end. You have hammer.',
      stones: [],
      context: {
        end: 8,
        totalEnds: 8,
        redScore: 3,
        yellowScore: 5,
        hammer: 'red',
        stonesRemaining: 8
      },
      solutions: [
        {
          type: 'guard',
          rating: 'excellent',
          target: { x: 0, z: 38.5 },
          weight: 'guard',
          curl: 'either',
          explanation: 'You MUST score 3 to win! Center guard is essential to build a big end. Aggressive guards give you a chance at multiple points.'
        },
        {
          type: 'corner',
          rating: 'good',
          target: { x: 0.8, z: 38.5 },
          weight: 'guard',
          curl: 'either',
          explanation: 'Corner guards can work too. You need protection for come-around attempts. Any guard is better than drawing.'
        },
        {
          type: 'draw',
          rating: 'poor',
          target: { x: 0, z: 41 },
          weight: 'draw',
          curl: 'either',
          explanation: 'Drawing to the button only scores 1 at best - you need 3! Without guards, opponent will pick you apart.'
        }
      ],
      hint: 'You need 3 points to win. Think about what gives you the best chance.'
    },
    {
      id: 'skip_6',
      name: 'Up Two, Final End',
      difficulty: 3,
      description: 'Up 2 points in the final end. Opponent has hammer.',
      stones: [],
      context: {
        end: 8,
        totalEnds: 8,
        redScore: 5,
        yellowScore: 3,
        hammer: 'yellow',
        stonesRemaining: 8
      },
      solutions: [
        {
          type: 'draw',
          rating: 'excellent',
          target: { x: 0, z: 41 },
          weight: 'draw',
          curl: 'either',
          explanation: 'Put stones in play! They need 3 points - make them work for it. Occupying the house forces difficult decisions.'
        },
        {
          type: 'guard',
          rating: 'poor',
          target: { x: 0, z: 38.5 },
          weight: 'guard',
          curl: 'either',
          explanation: 'NO guards when defending! Guards help the team with hammer build a big end. You\'re helping them score 3.'
        },
        {
          type: 'corner',
          rating: 'okay',
          target: { x: 1.0, z: 40.5 },
          weight: 'draw',
          curl: 'right',
          explanation: 'Drawing to the side is okay but center is better. You want to be in their way, not off to the side.'
        }
      ],
      hint: 'They need 3 points to tie. How do you prevent a big end?'
    },
    {
      id: 'skip_7',
      name: 'Steal Opportunity',
      difficulty: 4,
      description: 'Opponent has hammer but you have shot stone. 4 stones left.',
      stones: [
        { team: 'red', x: 0.2, z: 40.8 },
        { team: 'yellow', x: -0.5, z: 41.2 }
      ],
      context: {
        end: 5,
        totalEnds: 8,
        redScore: 3,
        yellowScore: 3,
        hammer: 'yellow',
        stonesRemaining: 4
      },
      solutions: [
        {
          type: 'guard',
          rating: 'excellent',
          target: { x: 0.2, z: 38.5 },
          weight: 'guard',
          curl: 'either',
          explanation: 'Protect your shot stone! A guard makes it harder for them to score. If they can\'t remove you, you steal a point!'
        },
        {
          type: 'draw',
          rating: 'good',
          target: { x: 0.5, z: 40.5 },
          weight: 'draw',
          curl: 'right',
          explanation: 'Adding another stone in the house is good, but it\'s not protected. They might take out both with a double.'
        },
        {
          type: 'takeout',
          rating: 'poor',
          target: { x: -0.5, z: 41.2 },
          weight: 'takeout',
          curl: 'left',
          explanation: 'Taking out their stone removes the threat but also removes your guard opportunity. You likely roll out and waste the steal chance.'
        }
      ],
      hint: 'You have a chance to steal. How do you protect it?'
    },
    {
      id: 'skip_8',
      name: 'Buried Stone Problem',
      difficulty: 4,
      description: 'Opponent\'s stone is buried behind guards. You need to score.',
      stones: [
        { team: 'yellow', x: 0, z: 40.8 },
        { team: 'yellow', x: 0.3, z: 38.5 },
        { team: 'yellow', x: -0.3, z: 38.2 }
      ],
      context: {
        end: 6,
        totalEnds: 8,
        redScore: 2,
        yellowScore: 4,
        hammer: 'red',
        stonesRemaining: 4
      },
      solutions: [
        {
          type: 'peel',
          rating: 'excellent',
          target: { x: 0.3, z: 38.5 },
          weight: 'takeout',
          curl: 'right',
          explanation: 'Peel the guards! Remove their protection first. Once guards are gone, you can access the shot stone. Patience wins.'
        },
        {
          type: 'draw',
          rating: 'good',
          target: { x: -0.7, z: 40.5 },
          weight: 'draw',
          curl: 'left',
          explanation: 'Drawing around to score is possible but risky. If you\'re light, you give them another guard. If heavy, you miss entirely.'
        },
        {
          type: 'runback',
          rating: 'okay',
          target: { x: -0.3, z: 38.2 },
          weight: 'control',
          curl: 'left',
          explanation: 'A runback through a guard to the buried stone is spectacular but low percentage. High risk, high reward.'
        }
      ],
      hint: 'Their stone is protected. What\'s the safest way to get to it?'
    },
    {
      id: 'skip_9',
      name: 'Last Rock Decision',
      difficulty: 5,
      description: 'Last rock of end. Draw for 1 or attempt for 2?',
      stones: [
        { team: 'red', x: 0.5, z: 40.6 },
        { team: 'yellow', x: 0, z: 41.07 },
        { team: 'red', x: -0.6, z: 41.3 }
      ],
      context: {
        end: 6,
        totalEnds: 8,
        redScore: 3,
        yellowScore: 3,
        hammer: 'red',
        stonesRemaining: 1
      },
      solutions: [
        {
          type: 'draw',
          rating: 'excellent',
          target: { x: 0.1, z: 40.9 },
          weight: 'draw',
          curl: 'right',
          explanation: 'Take the sure point! Draw to the 4-foot beside your stone. You score 1 and keep hammer equivalent going into late ends.'
        },
        {
          type: 'takeout',
          rating: 'okay',
          target: { x: 0, z: 41.07 },
          weight: 'control',
          curl: 'either',
          explanation: 'Trying to hit-and-roll for 2 is tempting but risky. If you roll out, you blank and give up the chance to score.'
        },
        {
          type: 'draw',
          rating: 'poor',
          target: { x: -0.3, z: 40.5 },
          weight: 'draw',
          curl: 'left',
          explanation: 'Drawing to an exposed position risks giving up a steal if you\'re light. The safe play is better here.'
        }
      ],
      hint: 'Tied game, late ends. Is it worth the risk for an extra point?'
    },
    {
      id: 'skip_10',
      name: 'Strategic Blank',
      difficulty: 5,
      description: 'You have hammer but only see 1 point. Take it or blank?',
      stones: [
        { team: 'yellow', x: 0.3, z: 41 },
        { team: 'yellow', x: -0.3, z: 40.8 },
        { team: 'red', x: 0, z: 40.5 }
      ],
      context: {
        end: 5,
        totalEnds: 8,
        redScore: 3,
        yellowScore: 2,
        hammer: 'red',
        stonesRemaining: 1
      },
      solutions: [
        {
          type: 'takeout',
          rating: 'excellent',
          target: { x: 0, z: 40.5 },
          weight: 'takeout',
          curl: 'either',
          explanation: 'Blank the end! Hit your own stone out to score 0 and KEEP hammer. With 3 ends left, hammer is worth more than 1 point.'
        },
        {
          type: 'draw',
          rating: 'good',
          target: { x: 0.1, z: 40.9 },
          weight: 'draw',
          curl: 'right',
          explanation: 'Taking 1 point is safe and extends your lead. But you give up hammer - they might score 2 or more next end.'
        },
        {
          type: 'takeout',
          rating: 'poor',
          target: { x: 0.3, z: 41 },
          weight: 'takeout',
          curl: 'right',
          explanation: 'Trying to remove their stones is risky - you might stick and score 1 anyway, losing hammer for nothing.'
        }
      ],
      hint: 'Sometimes scoring 0 with hammer is better than scoring 1. When?'
    }
  ]
};

// Practice stats persistence
let practiceStats = {
  takeout: { attempts: 0, successes: 0, unlocked: 1, scenarios: {} },
  bump: { attempts: 0, successes: 0, unlocked: 1, scenarios: {} },
  draw: { attempts: 0, successes: 0, unlocked: 1, scenarios: {} },
  guard: { attempts: 0, successes: 0, unlocked: 1, scenarios: {} },
  freeze: { attempts: 0, successes: 0, unlocked: 1, scenarios: {} },
  hitroll: { attempts: 0, successes: 0, unlocked: 1, scenarios: {} },
  skip: { attempts: 0, successes: 0, unlocked: 1, scenarios: {} }
};

// ============================================
// CAREER MODE - Tournament System
// ============================================

// Career tier progression order
const CAREER_TIERS = ['club', 'regional', 'provincial', 'national', 'international', 'olympic'];

// Tournament definitions by tier
const TOURNAMENT_DEFINITIONS = [
  // Club Tier
  {
    id: 'club_bonspiel',
    name: 'Club Bonspiel',
    shortName: 'Bonspiel',
    tier: 'club',
    format: {
      type: 'single_elimination',
      teams: 4,
      bestOf: 1
    },
    requirements: { minTier: 'club' },
    rewards: { points: 25, qualifiesFor: null, tierAdvance: false },
    color: '#6b7280'
  },
  {
    id: 'club_championship',
    name: 'Club Championship',
    shortName: 'Club Champ',
    tier: 'club',
    format: {
      type: 'single_elimination',
      teams: 8,
      bestOf: 1
    },
    requirements: { minTier: 'club' },
    rewards: { points: 75, qualifiesFor: 'regionalQualified', tierAdvance: true },
    color: '#6b7280'
  },
  // Regional Tier
  {
    id: 'regional_playdowns',
    name: 'Regional Playdowns',
    shortName: 'Regionals',
    tier: 'regional',
    format: {
      type: 'single_elimination',
      teams: 8,
      bestOf: 1
    },
    requirements: { minTier: 'regional', qualification: 'regionalQualified' },
    rewards: { points: 150, qualifiesFor: 'provincialQualified', tierAdvance: true },
    color: '#3b82f6'
  },
  // Provincial Tier
  {
    id: 'provincial_championship',
    name: 'Provincial Championship',
    shortName: 'Provincials',
    tier: 'provincial',
    format: {
      type: 'page_playoff',
      teams: 8,
      bestOf: 1
    },
    requirements: { minTier: 'provincial', qualification: 'provincialQualified' },
    rewards: { points: 300, qualifiesFor: 'nationalQualified', tierAdvance: true },
    color: '#8b5cf6'
  },
  // National Tier
  {
    id: 'national_championship',
    name: 'National Championship',
    shortName: 'Nationals',
    tier: 'national',
    format: {
      type: 'page_playoff',
      teams: 8,
      bestOf: 1
    },
    requirements: { minTier: 'national', qualification: 'nationalQualified' },
    rewards: { points: 500, qualifiesFor: 'worldsQualified', tierAdvance: true },
    color: '#ef4444'
  },
  // International Tier
  {
    id: 'world_championship',
    name: 'World Championship',
    shortName: 'Worlds',
    tier: 'international',
    format: {
      type: 'page_playoff',
      teams: 8,
      bestOf: 1
    },
    requirements: { minTier: 'international', qualification: 'worldsQualified' },
    rewards: { points: 1000, qualifiesFor: 'olympicTrialsQualified', tierAdvance: true },
    color: '#10b981'
  },
  // Olympic Tier
  {
    id: 'olympic_trials',
    name: 'Olympic Trials',
    shortName: 'Trials',
    tier: 'olympic',
    format: {
      type: 'page_playoff',
      teams: 8,
      bestOf: 3
    },
    requirements: { minTier: 'international', qualification: 'olympicTrialsQualified' },
    rewards: { points: 800, qualifiesFor: 'olympicsQualified', tierAdvance: false },
    color: '#ec4899'
  },
  {
    id: 'olympics',
    name: 'Winter Olympics',
    shortName: 'Olympics',
    tier: 'olympic',
    format: {
      type: 'single_elimination',
      teams: 8,
      bestOf: 1,
      thirdPlaceGame: true
    },
    requirements: { minTier: 'international', qualification: 'olympicsQualified' },
    rewards: { points: 2000, qualifiesFor: null, tierAdvance: false, isEndgame: true },
    color: '#ffd700'
  }
];

// Season state (persisted to localStorage)
const seasonState = {
  currentSeason: 1,
  seasonYear: 2026,
  careerTier: 'club',

  activeTournament: null,  // TournamentState when in tournament

  qualifications: {
    regionalQualified: false,
    provincialQualified: false,
    nationalQualified: false,
    worldsQualified: false,
    olympicTrialsQualified: false,
    olympicsQualified: false
  },

  seasonCalendar: {
    completed: [],  // TournamentResult[]
    available: []   // Tournament IDs available this season
  },

  stats: {
    totalWins: 0,
    totalLosses: 0,
    tournamentsWon: 0,
    tournamentsEntered: 0,
    seasonsPlayed: 0
  },

  rivalryHistory: {},  // { rivalId: { wins, losses, lastMet } }

  playerTeam: {
    name: 'Team Player',
    ranking: 1000,

    // Club identity (selected at career start)
    club: {
      id: null,
      name: 'My Club',
      colors: { primary: '#4ade80', secondary: '#1a1a2e' },
      crest: '🥌'  // Emoji or icon identifier
    },

    // Country identity (deferred until national/international)
    country: null,           // Country object (null until unlocked)
    countryLocked: false,    // Once true, cannot change
    countryUnlockShown: false  // Track if we've shown the unlock prompt
  },

  // Career progression stage for UI decisions
  careerStage: 'club'  // 'club' | 'regional' | 'national' | 'international'
};

// Club definitions for selection
const CLUB_OPTIONS = [
  { id: 'granite', name: 'Granite Curling Club', crest: '🏔️', colors: { primary: '#64748b', secondary: '#1e293b' } },
  { id: 'maple', name: 'Maple Leaf CC', crest: '🍁', colors: { primary: '#dc2626', secondary: '#450a0a' } },
  { id: 'northern', name: 'Northern Lights CC', crest: '✨', colors: { primary: '#22c55e', secondary: '#14532d' } },
  { id: 'highland', name: 'Highland CC', crest: '🏰', colors: { primary: '#7c3aed', secondary: '#1e1b4b' } },
  { id: 'coastal', name: 'Coastal Curling Club', crest: '🌊', colors: { primary: '#0ea5e9', secondary: '#0c4a6e' } },
  { id: 'prairie', name: 'Prairie CC', crest: '🌾', colors: { primary: '#eab308', secondary: '#422006' } },
  { id: 'metro', name: 'Metro Curling Club', crest: '🏙️', colors: { primary: '#f97316', secondary: '#431407' } },
  { id: 'custom', name: 'Custom Club', crest: '🥌', colors: { primary: '#4ade80', secondary: '#1a1a2e' } }
];

// Name pools for random opponent generation
const OPPONENT_NAME_DATA = {
  firstNames: {
    canada: ['Brad', 'Kevin', 'Mike', 'Jennifer', 'Rachel', 'Mark', 'Glenn', 'Ben', 'John', 'Colleen'],
    sweden: ['Niklas', 'Anna', 'Fredrik', 'Sara', 'Oskar', 'Emma', 'Rasmus', 'Agnes', 'Christoffer', 'Sofia'],
    scotland: ['David', 'Eve', 'Thomas', 'Vicky', 'Bruce', 'Hamish', 'Morag', 'Ross', 'Grant', 'Jennifer'],
    norway: ['Thomas', 'Steffen', 'Torger', 'Marianne', 'Kristin', 'Magnus', 'Lars', 'Ingrid', 'Håvard', 'Camilla'],
    usa: ['John', 'Matt', 'Tyler', 'Cory', 'Tabitha', 'Nina', 'Becca', 'Pete', 'Craig', 'Aileen'],
    switzerland: ['Benoit', 'Peter', 'Silvana', 'Alina', 'Yannick', 'Marcel', 'Irene', 'Sven', 'Manuela', 'Romano'],
    japan: ['Yusuke', 'Satsuki', 'Chinami', 'Mari', 'Yurika', 'Tetsuro', 'Kosei', 'Ayumi', 'Kotomi', 'Yumi'],
    default: ['Alex', 'Chris', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery']
  },
  lastNames: {
    canada: ['Gushue', 'Koe', 'Martin', 'Howard', 'Jones', 'Lawes', 'Ferbey', 'Homan', 'Carey', 'Jacobs'],
    sweden: ['Edin', 'Hasselborg', 'Lindahl', 'Wrana', 'Eriksson', 'Sundgren', 'McManus', 'Kjellberg', 'Norberg', 'Arman'],
    scotland: ['Mouat', 'Muirhead', 'Brewster', 'Dodds', 'Kyle', 'Morrison', 'Smith', 'Gray', 'Henderson', 'Sheridan'],
    norway: ['Ulsrud', 'Nergård', 'Svae', 'Walstad', 'Ramsfjell', 'Skaslien', 'Loen', 'Petersson', 'Hovden', 'Kjaer'],
    usa: ['Shuster', 'Hamilton', 'Landsteiner', 'Christensen', 'Peterson', 'Roth', 'Brown', 'Plys', 'Sinclair', 'Persinger'],
    switzerland: ['Schwarz', 'De Cruz', 'Tirinzoni', 'Pätz', 'Michel', 'Brunner', 'Hürlimann', 'Schnider', 'Amstutz', 'Hefti'],
    japan: ['Fujisawa', 'Yoshida', 'Suzuki', 'Morozumi', 'Iwai', 'Matsumura', 'Ogasawara', 'Kitazawa', 'Yamamoto', 'Tanaka'],
    default: ['Smith', 'Johnson', 'Williams', 'Brown', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor', 'Thomas']
  }
};

const DAY_JOBS = [
  'Accountant', 'Plumber', 'Teacher', 'Farmer', 'Electrician',
  'Nurse', 'Software Developer', 'Carpenter', 'Chef', 'Lawyer',
  'Sales Rep', 'Firefighter', 'Banker', 'Engineer', 'Pharmacist',
  'Contractor', 'Real Estate Agent', 'Graphic Designer', 'Marketing Manager', 'Physiotherapist',
  null, null, null, null  // null = professional curler (more common at higher tiers)
];

const HOME_CLUBS = {
  canada: ['Granite Curling Club', 'Saville Centre', 'Kelowna Curling Club', 'Royal Montreal', 'Rideau CC', 'St. Paul\'s CC', 'Brier Island CC'],
  sweden: ['Karlstad CK', 'Uppsala CK', 'Sundbybergs CK', 'Härnösands CK', 'Söderhamns CK', 'Stockholm CK'],
  scotland: ['Royal Caledonian CC', 'Murrayfield CC', 'Greenacres CC', 'Braehead CC', 'Hamilton CC', 'Lockerbie Ice Rink'],
  norway: ['Snarøya CC', 'Oppdal CC', 'Lillehammer CC', 'Oslo CC', 'Trondheim CK', 'Bergen CK'],
  usa: ['Denver CC', 'Madison CC', 'Seattle CC', 'Duluth CC', 'St. Paul CC', 'Fargo CC', 'Chaska CC'],
  switzerland: ['CC Bern', 'CC Zürich', 'CC Genève', 'CC Adelboden', 'Curling Arena Wetzikon'],
  japan: ['Karuizawa CC', 'Sapporo CC', 'Nagano CC', 'Tokoro CC', 'Kitami CC'],
  default: ['Central CC', 'City Curling Club', 'Metro CC', 'Capital CC', 'Highland CC']
};

// Persistent Rivals - memorable opponents at each tier
const PERSISTENT_RIVALS = [
  // CLUB TIER (3 rivals)
  {
    id: 'rival_earl',
    firstName: 'Earl',
    lastName: 'Thompson',
    nickname: 'Steady Eddie',
    countryId: 'canada',
    dayJob: 'Plumber',
    teamName: null,
    homeClub: 'Riverside Curling Club',
    skills: { draw: 65, takeout: 55, strategy: 70, pressure: 45, sweeping: 60 },
    personality: { aggression: 25, riskTolerance: 20, patience: 85, clutchFactor: 40, consistency: 80 },
    bio: "Been curling at Riverside for 35 years. Don't let the gray hair fool you - Earl's draw weight is legendary.",
    catchphrase: "Let's just make our shots.",
    tierRange: { min: 1, max: 2 }
  },
  {
    id: 'rival_dakota',
    firstName: 'Dakota',
    lastName: 'Chen',
    nickname: 'The Hammer',
    countryId: 'canada',
    dayJob: 'Electrician',
    teamName: null,
    homeClub: 'Valley View CC',
    skills: { draw: 50, takeout: 75, strategy: 55, pressure: 60, sweeping: 70 },
    personality: { aggression: 85, riskTolerance: 75, patience: 25, clutchFactor: 65, consistency: 45 },
    bio: "Young gun with a cannon arm. Every stone is a potential takeout.",
    catchphrase: "Why tap when you can peel?",
    tierRange: { min: 1, max: 3 }
  },
  {
    id: 'rival_margaret',
    firstName: 'Margaret',
    lastName: 'O\'Brien',
    nickname: 'Maggie',
    countryId: 'scotland',
    dayJob: 'Teacher',
    teamName: null,
    homeClub: 'Highland CC',
    skills: { draw: 70, takeout: 60, strategy: 65, pressure: 55, sweeping: 65 },
    personality: { aggression: 45, riskTolerance: 40, patience: 70, clutchFactor: 50, consistency: 75 },
    bio: "Primary school teacher by day, fierce competitor on weekends. Known for her patience and textbook delivery.",
    catchphrase: "Patience wins games.",
    tierRange: { min: 1, max: 2 }
  },

  // REGIONAL TIER (3 rivals)
  {
    id: 'rival_jake',
    firstName: 'Jake',
    lastName: 'Lindstrom',
    nickname: null,
    countryId: 'usa',
    dayJob: 'Contractor',
    teamName: 'Team Lindstrom',
    homeClub: 'Minneapolis CC',
    skills: { draw: 68, takeout: 72, strategy: 65, pressure: 62, sweeping: 70 },
    personality: { aggression: 60, riskTolerance: 55, patience: 50, clutchFactor: 58, consistency: 65 },
    bio: "Builds houses in summer, dominates bonspiels in winter. Physical player who relies on power.",
    catchphrase: "Let's get to work.",
    tierRange: { min: 2, max: 4 }
  },
  {
    id: 'rival_yuki',
    firstName: 'Yuki',
    lastName: 'Tanaka',
    nickname: 'Ice Queen',
    countryId: 'japan',
    dayJob: null,
    teamName: 'Team Tanaka',
    homeClub: 'Karuizawa CC',
    skills: { draw: 78, takeout: 65, strategy: 75, pressure: 70, sweeping: 72 },
    personality: { aggression: 35, riskTolerance: 45, patience: 80, clutchFactor: 72, consistency: 78 },
    bio: "Rising star from Karuizawa with ice in her veins. Her precision draws are a thing of beauty.",
    catchphrase: "Read the ice.",
    tierRange: { min: 2, max: 5 }
  },
  {
    id: 'rival_anders',
    firstName: 'Anders',
    lastName: 'Berglund',
    nickname: null,
    countryId: 'sweden',
    dayJob: 'Pharmacist',
    teamName: 'Team Berglund',
    homeClub: 'Uppsala CK',
    skills: { draw: 72, takeout: 70, strategy: 68, pressure: 65, sweeping: 68 },
    personality: { aggression: 50, riskTolerance: 50, patience: 60, clutchFactor: 60, consistency: 70 },
    bio: "Methodical and precise, Anders brings scientific rigor to his game. Never rattled.",
    catchphrase: "Trust the process.",
    tierRange: { min: 2, max: 4 }
  },

  // PROVINCIAL TIER (4 rivals)
  {
    id: 'rival_heather',
    firstName: 'Heather',
    lastName: 'MacDonald',
    nickname: 'The General',
    countryId: 'canada',
    dayJob: null,
    teamName: 'Team MacDonald',
    homeClub: 'Granite Curling Club',
    skills: { draw: 80, takeout: 75, strategy: 82, pressure: 78, sweeping: 75 },
    personality: { aggression: 55, riskTolerance: 50, patience: 65, clutchFactor: 80, consistency: 75 },
    bio: "Three-time provincial champion with a tactical mind. Commands her team like a general on the ice.",
    catchphrase: "Execute the plan.",
    tierRange: { min: 3, max: 6 }
  },
  {
    id: 'rival_marco',
    firstName: 'Marco',
    lastName: 'Bianchi',
    nickname: null,
    countryId: 'italy',
    dayJob: 'Chef',
    teamName: 'Team Italia',
    homeClub: 'Cortina CC',
    skills: { draw: 75, takeout: 78, strategy: 70, pressure: 68, sweeping: 72 },
    personality: { aggression: 65, riskTolerance: 60, patience: 45, clutchFactor: 62, consistency: 68 },
    bio: "Passionate and expressive, Marco brings Italian flair to the ice. Loves the big shot.",
    catchphrase: "Perfetto!",
    tierRange: { min: 3, max: 5 }
  },
  {
    id: 'rival_emily',
    firstName: 'Emily',
    lastName: 'Ross',
    nickname: null,
    countryId: 'scotland',
    dayJob: null,
    teamName: 'Team Ross',
    homeClub: 'Braehead CC',
    skills: { draw: 82, takeout: 72, strategy: 78, pressure: 75, sweeping: 74 },
    personality: { aggression: 40, riskTolerance: 45, patience: 75, clutchFactor: 78, consistency: 80 },
    bio: "Emerging Scottish talent with exceptional draw weight. Cool under pressure.",
    catchphrase: "Stay in the moment.",
    tierRange: { min: 3, max: 6 }
  },
  {
    id: 'rival_olaf',
    firstName: 'Olaf',
    lastName: 'Henriksen',
    nickname: 'The Viking',
    countryId: 'norway',
    dayJob: null,
    teamName: 'Team Henriksen',
    homeClub: 'Oslo CC',
    skills: { draw: 74, takeout: 82, strategy: 72, pressure: 70, sweeping: 78 },
    personality: { aggression: 75, riskTolerance: 70, patience: 35, clutchFactor: 68, consistency: 65 },
    bio: "Aggressive player who loves to hit. Built like a Viking and throws like one too.",
    catchphrase: "HURRY HARD!",
    tierRange: { min: 3, max: 5 }
  },

  // NATIONAL TIER (4 rivals)
  {
    id: 'rival_jennifer',
    firstName: 'Jennifer',
    lastName: 'Blackwood',
    nickname: null,
    countryId: 'scotland',
    dayJob: null,
    teamName: 'Team Blackwood',
    homeClub: 'Royal Caledonian CC',
    skills: { draw: 85, takeout: 80, strategy: 88, pressure: 85, sweeping: 80 },
    personality: { aggression: 50, riskTolerance: 55, patience: 70, clutchFactor: 90, consistency: 85 },
    bio: "Three-time Scottish champion. Her ice reading is uncanny - she knows where your stone stops before you throw.",
    catchphrase: "The ice tells you everything.",
    tierRange: { min: 4, max: 7 }
  },
  {
    id: 'rival_pierre',
    firstName: 'Pierre',
    lastName: 'Dubois',
    nickname: 'Le Professeur',
    countryId: 'switzerland',
    dayJob: null,
    teamName: 'Team Dubois',
    homeClub: 'CC Genève',
    skills: { draw: 88, takeout: 78, strategy: 90, pressure: 82, sweeping: 76 },
    personality: { aggression: 30, riskTolerance: 35, patience: 90, clutchFactor: 85, consistency: 88 },
    bio: "Swiss precision personified. Pierre plays curling like chess - always three ends ahead.",
    catchphrase: "Every stone has a purpose.",
    tierRange: { min: 4, max: 7 }
  },
  {
    id: 'rival_sarah',
    firstName: 'Sarah',
    lastName: 'Mitchell',
    nickname: null,
    countryId: 'canada',
    dayJob: null,
    teamName: 'Team Mitchell',
    homeClub: 'Saville Centre',
    skills: { draw: 84, takeout: 85, strategy: 82, pressure: 80, sweeping: 82 },
    personality: { aggression: 60, riskTolerance: 58, patience: 55, clutchFactor: 78, consistency: 78 },
    bio: "All-around threat with no weaknesses. National team regular with Olympic aspirations.",
    catchphrase: "Let's go!",
    tierRange: { min: 4, max: 8 }
  },
  {
    id: 'rival_kim',
    firstName: 'Min-jun',
    lastName: 'Kim',
    nickname: null,
    countryId: 'south_korea',
    dayJob: null,
    teamName: 'Team Kim',
    homeClub: 'Gangneung CC',
    skills: { draw: 86, takeout: 80, strategy: 84, pressure: 88, sweeping: 85 },
    personality: { aggression: 45, riskTolerance: 50, patience: 65, clutchFactor: 92, consistency: 82 },
    bio: "Olympic medalist with nerves of steel. Thrives in pressure situations.",
    catchphrase: "Focus.",
    tierRange: { min: 4, max: 8 }
  },

  // INTERNATIONAL/WORLDS TIER (5 rivals)
  {
    id: 'rival_magnus',
    firstName: 'Magnus',
    lastName: 'Eriksson',
    nickname: 'The Professor',
    countryId: 'sweden',
    dayJob: null,
    teamName: 'Team Eriksson',
    homeClub: 'Karlstad CK',
    skills: { draw: 95, takeout: 90, strategy: 98, pressure: 92, sweeping: 88 },
    personality: { aggression: 45, riskTolerance: 40, patience: 90, clutchFactor: 95, consistency: 92 },
    bio: "Olympic gold medalist and the most decorated skip in Swedish history. Plays curling like chess.",
    catchphrase: "Every stone has a purpose.",
    tierRange: { min: 5, max: 8 }
  },
  {
    id: 'rival_anna',
    firstName: 'Anna',
    lastName: 'Hasselborg',
    nickname: null,
    countryId: 'sweden',
    dayJob: null,
    teamName: 'Team Hasselborg',
    homeClub: 'Sundbybergs CK',
    skills: { draw: 94, takeout: 88, strategy: 92, pressure: 94, sweeping: 86 },
    personality: { aggression: 48, riskTolerance: 52, patience: 72, clutchFactor: 96, consistency: 90 },
    bio: "World and Olympic champion. Known for clutch performances in must-win situations.",
    catchphrase: "One shot at a time.",
    tierRange: { min: 5, max: 8 }
  },
  {
    id: 'rival_brad',
    firstName: 'Brad',
    lastName: 'Guthrie',
    nickname: 'Old Bear',
    countryId: 'canada',
    dayJob: null,
    teamName: 'Team Guthrie',
    homeClub: 'St. John\'s CC',
    skills: { draw: 92, takeout: 90, strategy: 95, pressure: 88, sweeping: 84 },
    personality: { aggression: 52, riskTolerance: 48, patience: 68, clutchFactor: 88, consistency: 86 },
    bio: "Four-time Brier champion and multiple world medalist. The old bear still has plenty of fight.",
    catchphrase: "Trust your instincts.",
    tierRange: { min: 5, max: 8 }
  },
  {
    id: 'rival_elena',
    firstName: 'Elena',
    lastName: 'Stern',
    nickname: null,
    countryId: 'switzerland',
    dayJob: null,
    teamName: 'Team Stern',
    homeClub: 'CC Bern',
    skills: { draw: 90, takeout: 86, strategy: 88, pressure: 85, sweeping: 82 },
    personality: { aggression: 38, riskTolerance: 42, patience: 78, clutchFactor: 82, consistency: 88 },
    bio: "Swiss precision with German efficiency. Her technical fundamentals are textbook perfect.",
    catchphrase: "Precision wins.",
    tierRange: { min: 5, max: 7 }
  },
  {
    id: 'rival_bruce',
    firstName: 'Bruce',
    lastName: 'Mouat',
    nickname: null,
    countryId: 'scotland',
    dayJob: null,
    teamName: 'Team Mouat',
    homeClub: 'Royal Caledonian CC',
    skills: { draw: 91, takeout: 92, strategy: 90, pressure: 90, sweeping: 88 },
    personality: { aggression: 55, riskTolerance: 58, patience: 58, clutchFactor: 88, consistency: 85 },
    bio: "Scotland's finest. Complete player with no weaknesses and championship pedigree.",
    catchphrase: "Keep it clean.",
    tierRange: { min: 5, max: 8 }
  },

  // OLYMPIC TRIALS/OLYMPICS TIER (4 rivals)
  {
    id: 'rival_legend_nils',
    firstName: 'Nils',
    lastName: 'Johansson',
    nickname: 'The Legend',
    countryId: 'sweden',
    dayJob: null,
    teamName: 'Team Johansson',
    homeClub: 'Karlstad CK',
    skills: { draw: 96, takeout: 94, strategy: 98, pressure: 96, sweeping: 90 },
    personality: { aggression: 42, riskTolerance: 45, patience: 88, clutchFactor: 98, consistency: 94 },
    bio: "Two-time Olympic gold medalist. The greatest skip of his generation, still competing at the highest level.",
    catchphrase: "Championships are won in the final end.",
    tierRange: { min: 6, max: 8 }
  },
  {
    id: 'rival_legend_rachel',
    firstName: 'Rachel',
    lastName: 'Homan',
    nickname: null,
    countryId: 'canada',
    dayJob: null,
    teamName: 'Team Homan',
    homeClub: 'Ottawa CC',
    skills: { draw: 94, takeout: 96, strategy: 94, pressure: 90, sweeping: 88 },
    personality: { aggression: 62, riskTolerance: 60, patience: 52, clutchFactor: 88, consistency: 86 },
    bio: "Most decorated female skip in Canadian history. Aggressive, confident, and battle-tested.",
    catchphrase: "Go for it.",
    tierRange: { min: 6, max: 8 }
  },
  {
    id: 'rival_legend_david',
    firstName: 'David',
    lastName: 'Murdoch',
    nickname: null,
    countryId: 'scotland',
    dayJob: null,
    teamName: 'Team Murdoch',
    homeClub: 'Lockerbie Ice Rink',
    skills: { draw: 92, takeout: 93, strategy: 96, pressure: 94, sweeping: 86 },
    personality: { aggression: 48, riskTolerance: 52, patience: 70, clutchFactor: 94, consistency: 90 },
    bio: "World champion and Olympic silver medalist. Master tactician who always has a plan.",
    catchphrase: "Stay patient.",
    tierRange: { min: 6, max: 8 }
  },
  {
    id: 'rival_legend_niklas',
    firstName: 'Niklas',
    lastName: 'Edin',
    nickname: null,
    countryId: 'sweden',
    dayJob: null,
    teamName: 'Team Edin',
    homeClub: 'Karlstad CK',
    skills: { draw: 97, takeout: 95, strategy: 99, pressure: 97, sweeping: 92 },
    personality: { aggression: 40, riskTolerance: 42, patience: 92, clutchFactor: 99, consistency: 96 },
    bio: "The GOAT. Five-time world champion, Olympic gold medalist. The standard by which all skips are measured.",
    catchphrase: "Stay calm.",
    tierRange: { min: 7, max: 8 }
  }
];

// Learn mode level definitions
const LEARN_LEVELS = [
  {
    id: 1,
    name: 'Complete Beginner',
    description: 'New to curling? Start here!',
    color: '#4ade80',
    features: ['Basic controls tutorial', 'Rules explanation', 'Simple shot suggestions', 'Heavy hand-holding']
  },
  {
    id: 2,
    name: 'Know the Basics',
    description: 'Understand controls, learning strategy',
    color: '#3b82f6',
    features: ['Shot type explanations', 'Weight recommendations', 'Post-shot feedback', 'When to use each shot']
  },
  {
    id: 3,
    name: 'Intermediate',
    description: 'Ready for strategic play',
    color: '#f59e0b',
    features: ['Strategic reasoning', 'Complex shot suggestions', 'Opponent analysis', 'Minimal hand-holding']
  },
  {
    id: 4,
    name: 'Advanced',
    description: 'Expert-level coaching only when needed',
    color: '#ef4444',
    features: ['Situational tips only', 'Risk/reward analysis', 'Can disable suggestions', 'Post-game analysis']
  }
];

// ============================================
// TUTORIAL SYSTEM (Beginner Level)
// ============================================

// Tutorial definitions - only shown in Learn Mode Level 1 (Complete Beginner)
const TUTORIALS = {
  // PART 1: Game Basics & Rules (shown before coin toss in Learn Mode)
  // Note: 'welcome' is now shown to ALL new users after splash screen
  scoring: {
    id: 'scoring',
    icon: '🏆',
    title: 'How Scoring Works',
    text: `Only ONE team can score per end - the team with the stone closest to the button.

You score 1 point for each of your stones that is closer to the button than the opponent's closest stone. If your two closest stones beat their closest, you score 2 points!

Stones must be touching the house (the colored rings) to count.`,
    hint: 'The team that doesn\'t score gets the "hammer" next end.',
    step: 1,
    total: 9
  },
  hammer: {
    id: 'hammer',
    icon: '🔨',
    title: 'The Hammer',
    text: `The "hammer" is the last stone of the end - a HUGE advantage! The team with hammer throws last, so they can always respond to the opponent.

The team that scores gives up the hammer. If neither team scores (a "blank end"), the hammer stays with whoever had it.

Strategy tip: Teams with hammer often try to score 2+ points. Scoring just 1 point ("getting forced") gives the opponent hammer.`,
    hint: 'Winning the coin toss and choosing hammer is a big advantage!',
    step: 2,
    total: 9
  },
  freeGuardZone: {
    id: 'freeGuardZone',
    icon: '🛡️',
    title: 'Free Guard Zone Rule',
    text: `Important rule: During the first 4 stones of each end, you CANNOT remove opponent's guards from play!

Guards are stones between the hog line and the house. If you knock out a protected guard, the stones are reset and YOUR stone is removed.

This rule encourages strategic play and prevents early aggressive takeouts.`,
    hint: 'After stone 4, all stones are fair game!',
    step: 3,
    total: 9
  },
  shotTypes: {
    id: 'shotTypes',
    icon: '📋',
    title: 'Types of Shots',
    text: `Common shot types you'll see:

• DRAW - A stone that stops in the house (scoring position)
• GUARD - A stone that stops in front of the house to protect other stones
• TAKEOUT - Removes an opponent's stone from play
• FREEZE - Stops touching another stone (hard to remove)
• PEEL - Removes a guard at high speed`,
    hint: 'The Coach panel will suggest which shot type to play.',
    step: 4,
    total: 9
  },

  // PART 2: Controls
  aiming: {
    id: 'aiming',
    icon: '🎯',
    title: 'Aiming Your Shot',
    text: `Drag LEFT and RIGHT to aim the stone. The green arrow shows where your stone will travel.

Your Coach (the panel on the right) suggests where to aim based on the current game situation. Look for the green target marker on the ice.`,
    hint: 'Tap when the aim arrow points toward your target.',
    step: 5,
    total: 9
  },
  curl: {
    id: 'curl',
    icon: '🌀',
    title: 'Setting the Curl',
    text: `Before you throw, you must select a curl direction. Curling stones rotate as they travel, causing them to curve near the end.

Tap the IN or OUT button (bottom left):
• IN-turn curls the stone LEFT
• OUT-turn curls the stone RIGHT

Curl helps you navigate around guards and reach positions you couldn't hit straight-on.`,
    hint: 'You must select curl before you can throw!',
    step: 6,
    total: 9
  },
  effort: {
    id: 'effort',
    icon: '💪',
    title: 'Setting the Weight',
    text: `After setting curl, tap and drag DOWN to set the throwing power (called "weight").

Different weights for different shots:
• Guard weight (30-50%): Stops before the house
• Draw weight (50-70%): Stops in the house
• Takeout weight (70-85%): Hits and removes stones`,
    hint: 'Watch the weight indicator on the left side of the screen.',
    step: 7,
    total: 9
  },
  throw: {
    id: 'throw',
    icon: '🚀',
    title: 'Releasing the Stone',
    text: `Once you've set your aim, weight, and curl, RELEASE to throw the stone!

The stone will slide down the ice following the path determined by your aim. The curl effect increases as the stone slows down near the house.`,
    hint: 'Release when you\'re happy with your weight setting.',
    step: 8,
    total: 9
  },
  sweeping: {
    id: 'sweeping',
    icon: '🧹',
    title: 'Sweeping',
    text: `While your stone is moving, you can SWEEP to make it travel farther and straighter!

Tap and hold anywhere on the screen to sweep. Sweeping warms the ice, reducing friction. Use it to:
• Help a light stone reach its target
• Keep a stone straighter when it starts to curl too much`,
    hint: 'You can only sweep your own team\'s stones!',
    step: 9,
    total: 9,
    pausesGame: true  // Pause stone movement during this tutorial
  },
  // Intermediate version - focuses on directional sweeping
  sweepingAdvanced: {
    id: 'sweepingAdvanced',
    icon: '🧹',
    title: 'Directional Sweeping',
    text: `You can influence your stone's path with directional sweeping!

Sweep on one side of the stone to push it the opposite direction:
• Sweep on the LEFT side → stone moves RIGHT
• Sweep on the RIGHT side → stone moves LEFT

Keep your sweeping motion aligned with the stone's travel direction for maximum effect.`,
    hint: 'Use directional sweeping to fine-tune your line!',
    step: 1,
    total: 1,
    pausesGame: true  // Pause stone movement during this tutorial
  }
};

// Load tutorial preferences from localStorage
function loadTutorialPrefs() {
  try {
    const saved = localStorage.getItem('curlingpro_tutorials');
    if (saved) {
      const data = JSON.parse(saved);
      gameState.learnMode.tutorialsShown = data.shown || {};
      gameState.learnMode.tutorialsDisabled = data.disabled || false;
    }
  } catch (e) {
    console.warn('Failed to load tutorial prefs:', e);
  }
}

// Save tutorial preferences to localStorage
function saveTutorialPrefs() {
  try {
    localStorage.setItem('curlingpro_tutorials', JSON.stringify({
      shown: gameState.learnMode.tutorialsShown,
      disabled: gameState.learnMode.tutorialsDisabled
    }));
  } catch (e) {
    console.warn('Failed to save tutorial prefs:', e);
  }
}

// Show a tutorial popup
function showTutorial(tutorialId) {
  // Only show in Learn Mode
  if (!gameState.learnMode.enabled) {
    console.log('[Tutorial] showTutorial returning false - learnMode not enabled');
    return false;
  }

  // Check if tutorials are disabled
  if (gameState.learnMode.tutorialsDisabled) {
    console.log('[Tutorial] showTutorial returning false - tutorials disabled');
    return false;
  }

  // Check if already shown
  if (gameState.learnMode.tutorialsShown[tutorialId]) {
    console.log('[Tutorial] showTutorial returning false - already shown:', tutorialId);
    return false;
  }

  // Filter tutorials based on level
  const level = gameState.learnMode.level;
  // Note: 'welcome' is now shown to ALL new users after splash screen (not Learn Mode specific)
  const ruleTutorials = ['scoring', 'hammer', 'freeGuardZone', 'shotTypes'];
  const controlTutorials = ['aiming', 'curl', 'effort', 'throw', 'sweeping'];

  // Level 1 (Beginner): Show all tutorials
  // Level 2 (Know Basics): Skip rules, show controls only
  // Level 3 (Intermediate): Only show advanced sweeping
  // Level 4 (Advanced): No tutorials
  if (level === 4) {
    return false;  // Advanced - no tutorials
  } else if (level === 3) {
    // Intermediate - only advanced sweeping tutorial
    if (tutorialId !== 'sweepingAdvanced') return false;
  } else if (level === 2) {
    // Know the Basics - skip rules, show controls only
    if (ruleTutorials.includes(tutorialId)) return false;
  }
  // Level 1 shows all tutorials

  const tutorial = TUTORIALS[tutorialId];
  if (!tutorial) {
    console.log('[Tutorial] showTutorial returning false - tutorial not found:', tutorialId);
    return false;
  }

  // Update UI
  const overlay = document.getElementById('tutorial-overlay');
  const icon = document.getElementById('tutorial-icon');
  const title = document.getElementById('tutorial-title');
  const step = document.getElementById('tutorial-step');
  const text = document.getElementById('tutorial-text');
  const hintDiv = document.getElementById('tutorial-hint');
  const hintText = document.getElementById('tutorial-hint-text');

  if (!overlay) {
    console.log('[Tutorial] showTutorial returning false - overlay not found');
    return false;
  }

  icon.textContent = tutorial.icon;
  title.textContent = tutorial.title;
  step.textContent = `Step ${tutorial.step} of ${tutorial.total}`;
  text.innerHTML = tutorial.text.replace(/\n/g, '<br>');

  if (tutorial.hint) {
    hintDiv.style.display = 'block';
    hintText.textContent = tutorial.hint;
  } else {
    hintDiv.style.display = 'none';
  }

  // Reset checkbox
  const checkbox = document.getElementById('tutorial-dont-show');
  if (checkbox) checkbox.checked = false;

  // Update button text - "Next" if more tutorials, "Got it!" if last one
  const nextBtn = document.getElementById('tutorial-next-btn');
  if (nextBtn) {
    nextBtn.textContent = tutorial.step < tutorial.total ? 'Next' : 'Got it!';
  }

  // Make sure Exit button is hidden (only for interactive tutorial)
  const exitBtn = document.getElementById('tutorial-exit-btn');
  if (exitBtn) exitBtn.style.display = 'none';

  // Make sure checkbox is visible (only hidden in interactive tutorial)
  const checkboxContainer = document.getElementById('tutorial-checkbox-container');
  if (checkboxContainer) checkboxContainer.style.display = 'flex';

  // Store current tutorial ID
  gameState.learnMode.currentTutorial = tutorialId;

  // Get popup element for animation
  const popup = document.getElementById('tutorial-popup');

  // If overlay is already visible (chaining tutorials), slide in from right
  if (overlay.style.display === 'block' && popup) {
    // Start from right side
    popup.style.transition = 'none';  // Disable transition temporarily
    popup.style.transform = 'translate(50%, -50%)';
    popup.style.opacity = '0';

    // Force reflow to apply the starting position
    popup.offsetHeight;

    // Re-enable transition and slide to center
    popup.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    requestAnimationFrame(() => {
      popup.style.transform = 'translate(-50%, -50%)';
      popup.style.opacity = '1';
    });
  } else {
    // First tutorial - just show normally
    console.log('[Tutorial] Showing tutorial overlay for:', tutorialId);
    overlay.style.display = 'block';
    console.log('[Tutorial] Overlay display set to:', overlay.style.display, 'computed:', getComputedStyle(overlay).display);
    if (popup) {
      popup.style.transform = 'translate(-50%, -50%)';
      popup.style.opacity = '1';
      console.log('[Tutorial] Popup opacity:', popup.style.opacity, 'transform:', popup.style.transform);
    }
  }

  // Pause physics if this tutorial requires it (e.g., sweeping tutorial)
  if (tutorial.pausesGame) {
    gameState.learnMode.tutorialPaused = true;
  }

  // Track tutorial shown for analytics
  analytics.trackEvent('tutorial', tutorialId, { step: tutorial.step, level: gameState.learnMode.level });

  return true;
}

// Dismiss current tutorial with slide animation
window.dismissTutorial = function() {
  const overlay = document.getElementById('tutorial-overlay');
  const popup = document.getElementById('tutorial-popup');
  const continueBtn = document.getElementById('tutorial-continue-btn');

  // Check if this is the interactive tutorial mode
  if (gameState.interactiveTutorialMode) {
    // Check if the standalone continue button is visible
    if (continueBtn && continueBtn.style.display !== 'none') {
      continueTutorial();
    } else {
      dismissInteractiveTutorialStep();
    }
    return;
  }

  // Check if this is the pre-mode tutorial sequence (before mode selection)
  if (gameState.welcomeTutorialActive) {
    dismissPreModeTutorial();
    return;
  }

  // Check if this is a first-run tutorial (regular mode)
  if (gameState.firstRunTutorial) {
    dismissFirstRunTutorial();
    // Slide out
    if (popup) {
      popup.style.transform = 'translate(-150%, -50%)';
      popup.style.opacity = '0';
    }
    setTimeout(() => {
      if (overlay) overlay.style.display = 'none';
      if (popup) {
        popup.style.transform = 'translate(-50%, -50%)';
        popup.style.opacity = '1';
      }
    }, 300);
    return;
  }

  // Learn Mode tutorial handling
  // Mark as shown
  const tutorialId = gameState.learnMode.currentTutorial;
  if (tutorialId) {
    gameState.learnMode.tutorialsShown[tutorialId] = true;
  }

  // Check if user wants to disable tutorials
  const checkbox = document.getElementById('tutorial-dont-show');
  if (checkbox && checkbox.checked) {
    gameState.learnMode.tutorialsDisabled = true;
  }

  // Save preferences
  saveTutorialPrefs();

  gameState.learnMode.currentTutorial = null;

  // Resume physics if it was paused
  gameState.learnMode.tutorialPaused = false;

  // Slide out to the left
  if (popup) {
    popup.style.transform = 'translate(-150%, -50%)';
    popup.style.opacity = '0';
  }

  // After slide-out animation, check for next tutorial
  setTimeout(() => {
    // If in pre-toss phase, show next pre-toss tutorial or proceed to coin toss
    if (gameState.learnMode.preTossPhase) {
      if (!showNextPreTossTutorial()) {
        // No more pre-toss tutorials, hide overlay
        if (overlay) overlay.style.display = 'none';
        if (popup) {
          popup.style.transform = 'translate(-50%, -50%)';
          popup.style.opacity = '1';
        }
      }
      return;
    }

    if (typeof updateCoachPanel === 'function') {
      updateCoachPanel();
    }

    // If no new tutorial was shown, hide the overlay
    if (!gameState.learnMode.currentTutorial && overlay) {
      overlay.style.display = 'none';
      // Reset popup position for next time
      if (popup) {
        popup.style.transform = 'translate(-50%, -50%)';
        popup.style.opacity = '1';
      }
    }
  }, 300);
};

// Reset tutorials (for testing or user request)
window.resetTutorials = function() {
  gameState.learnMode.tutorialsShown = {};
  gameState.learnMode.tutorialsDisabled = false;
  gameState.learnMode.currentTutorial = null;
  saveTutorialPrefs();
  console.log('[Tutorials] Reset complete - all tutorials will show again');

  // Also reset game state to End 1, Stone 0 so tutorials can show
  gameState.end = 1;
  gameState.stonesThrown = { red: 0, yellow: 0 };
  gameState.scores = { red: 0, yellow: 0 };
  gameState.currentTeam = 'red';
  gameState.phase = 'aiming';

  // Clear any existing stones
  for (const stone of gameState.stones) {
    if (stone.mesh) scene.remove(stone.mesh);
    if (stone.body) Matter.Composite.remove(world, stone.body);
  }
  gameState.stones = [];

  // Make sure we're in Learn Mode Beginner
  gameState.learnMode.enabled = true;
  gameState.learnMode.level = 1;

  // Update UI
  if (typeof updateScoreDisplay === 'function') updateScoreDisplay();
  if (typeof updateStoneCountDisplay === 'function') updateStoneCountDisplay();

  // Trigger tutorials
  setTimeout(() => {
    if (typeof updateCoachPanel === 'function') {
      updateCoachPanel();
    }
  }, 200);

  console.log('[Tutorials] Game reset to End 1, Stone 0 in Learn Mode Beginner');
};

// ============================================
// FREE GUARD ZONE RULE
// ============================================
// The Free Guard Zone (FGZ) rule: During stones 1-4, guards in the FGZ
// (between hog line and the house) cannot be removed from play.
// If violated, stones are reset and the thrown stone is removed.

// FGZ (Free Guard Zone) rule: During stones 1-4, opponent stones OUTSIDE the house
// cannot be removed from play. This includes guards and any stone not in the 12-foot ring.
// The "house" is the 12-foot ring (stones within RING_12FT of the button)

// State for FGZ tracking
let fgzPreThrowGuards = [];  // Opponent stones outside the house before each throw
let fgzThrownStone = null;   // Reference to the stone just thrown

// Check if a stone is outside the house (protected during FGZ)
function isOutsideHouse(stone) {
  const buttonX = 0;
  const buttonZ = TEE_LINE_FAR;
  const dx = stone.mesh.position.x - buttonX;
  const dz = stone.mesh.position.z - buttonZ;
  const distFromButton = Math.sqrt(dx * dx + dz * dz);
  // Stone is outside the house if it's beyond the 12-foot ring
  return distFromButton > RING_12FT + STONE_RADIUS;
}

// Capture FGZ state before a throw
function captureFGZState() {
  const totalThrown = gameState.stonesThrown.red + gameState.stonesThrown.yellow;

  // Only track FGZ during stones 1-4 (first 4 stones of the end)
  if (totalThrown >= 4) {
    fgzPreThrowGuards = [];
    return;
  }

  // Get the team that's about to throw
  const throwingTeam = gameState.currentTeam;
  const opponentTeam = throwingTeam === 'red' ? 'yellow' : 'red';

  // Find opponent stones OUTSIDE the house (all are protected during FGZ period)
  fgzPreThrowGuards = [];
  for (const stone of gameState.stones) {
    if (stone.team === opponentTeam && !stone.outOfPlay) {
      // Check if stone is outside the house (protected by FGZ rule)
      if (isOutsideHouse(stone)) {
        fgzPreThrowGuards.push({
          stone: stone,
          originalX: stone.mesh.position.x,
          originalZ: stone.mesh.position.z,
          bodyX: stone.body.position.x,
          bodyY: stone.body.position.y
        });
      }
    }
  }

  console.log(`[FGZ] Stone ${totalThrown + 1} of end - ${fgzPreThrowGuards.length} protected stones outside house`);
}

// Check for FGZ violation after stones stop
function checkFGZViolation() {
  const totalThrown = gameState.stonesThrown.red + gameState.stonesThrown.yellow;

  console.log(`[FGZ] Checking violation - totalThrown: ${totalThrown}, protected guards: ${fgzPreThrowGuards.length}`);

  // FGZ only applies during stones 1-4
  if (totalThrown > 4) {
    console.log('[FGZ] FGZ not active (> 4 stones thrown)');
    return false;
  }

  // No guards were protected
  if (fgzPreThrowGuards.length === 0) {
    console.log('[FGZ] No protected guards were captured');
    return false;
  }

  // Check if any protected guard was removed from play
  for (const guardInfo of fgzPreThrowGuards) {
    console.log(`[FGZ] Checking guard - outOfPlay: ${guardInfo.stone.outOfPlay}, originalPos: (${guardInfo.originalX.toFixed(2)}, ${guardInfo.originalZ.toFixed(2)}), currentPos: (${guardInfo.stone.mesh.position.x.toFixed(2)}, ${guardInfo.stone.mesh.position.z.toFixed(2)})`);
    if (guardInfo.stone.outOfPlay) {
      console.log('[FGZ] VIOLATION: Protected guard was removed from play!');
      return true;
    }
  }

  console.log('[FGZ] No violation detected - guards still in play');
  return false;
}

// Handle FGZ violation - reset stones and remove thrown stone
function handleFGZViolation() {
  console.log('[FGZ] Restoring stone positions...');

  // Show violation message
  showFGZViolationMessage();

  // Restore protected guards to their original positions
  for (const guardInfo of fgzPreThrowGuards) {
    const stone = guardInfo.stone;
    stone.outOfPlay = false;
    stone.outOfPlayReason = null;

    // Restore Three.js mesh position
    stone.mesh.position.x = guardInfo.originalX;
    stone.mesh.position.z = guardInfo.originalZ;
    stone.mesh.position.y = STONE_RADIUS;
    stone.mesh.visible = true;

    // Restore Matter.js body position
    Matter.Body.setPosition(stone.body, {
      x: guardInfo.bodyX,
      y: guardInfo.bodyY
    });
    Matter.Body.setVelocity(stone.body, { x: 0, y: 0 });
  }

  // Remove the thrown stone (the last one thrown)
  if (fgzThrownStone) {
    moveStoneOutOfPlay(fgzThrownStone, 'FGZ violation - stone removed');
    // Don't decrement stone count - the throw still counts
  }

  // Reset the out-of-play stone area so the removed stone shows properly
  // (it's the offending stone, not the guard)
}

// Show FGZ violation message overlay
function showFGZViolationMessage() {
  // Create overlay if it doesn't exist
  let overlay = document.getElementById('fgz-violation-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'fgz-violation-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(185, 28, 28, 0.95) 100%);
      border: 3px solid #fca5a5;
      border-radius: 16px;
      padding: 24px 40px;
      text-align: center;
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: white;
      z-index: 1000;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    `;
    overlay.innerHTML = `
      <div style="font-size: 32px; margin-bottom: 8px;">⚠️</div>
      <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">FREE GUARD ZONE VIOLATION</div>
      <div style="font-size: 14px; color: #fee2e2;">
        Stones 1-4 cannot remove opponent guards.<br>
        Guard restored, your stone removed.
      </div>
    `;
    document.body.appendChild(overlay);
  }

  overlay.style.display = 'block';

  // Hide after 3 seconds
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 3000);
}

// Career helper functions
function getCurrentLevel() {
  // In Quick Play mode (2player), use the selected quick play level
  if (gameState.gameMode === '2player') {
    return CAREER_LEVELS[gameState.settings.quickPlayLevel - 1] || CAREER_LEVELS[3]; // Default to National
  }
  // In Career mode, use career progression level
  return CAREER_LEVELS[gameState.career.level - 1] || CAREER_LEVELS[0];
}

function loadCareer() {
  try {
    const saved = localStorage.getItem('curlingpro_career');
    if (saved) {
      const data = JSON.parse(saved);
      gameState.career.level = data.level || 1;
      gameState.career.wins = data.wins || 0;
      gameState.career.losses = data.losses || 0;
    }
  } catch (e) {
    console.warn('Could not load career data:', e);
  }
  updateCareerDisplay();
}

function saveCareer() {
  try {
    localStorage.setItem('curlingpro_career', JSON.stringify(gameState.career));
  } catch (e) {
    console.warn('Could not save career data:', e);
  }
}

// ============================================
// LOCAL MATCH HISTORY (Career/Quickplay)
// ============================================

const MATCH_HISTORY_KEY = 'curlingpro_match_history';
const MAX_LOCAL_MATCHES = 50;

function saveLocalMatchToHistory(matchData) {
  try {
    let history = JSON.parse(localStorage.getItem(MATCH_HISTORY_KEY) || '{"matches":[]}');

    const match = {
      id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      opponentName: matchData.opponentName,
      matchType: matchData.matchType,
      won: matchData.won,
      playerScore: matchData.playerScore,
      opponentScore: matchData.opponentScore,
      endScores: matchData.endScores || null,
      gameLength: matchData.gameLength || 8,
      playedAt: new Date().toISOString(),
      careerLevel: matchData.careerLevel || null,
      careerLevelName: matchData.careerLevelName || null
    };

    // Add to beginning (most recent first)
    history.matches.unshift(match);

    // Enforce 50 match limit
    if (history.matches.length > MAX_LOCAL_MATCHES) {
      history.matches = history.matches.slice(0, MAX_LOCAL_MATCHES);
    }

    localStorage.setItem(MATCH_HISTORY_KEY, JSON.stringify(history));
    console.log('[MatchHistory] Saved local match:', matchData.matchType);

  } catch (e) {
    console.warn('Could not save match history:', e);
  }
}

function getLocalMatchHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(MATCH_HISTORY_KEY) || '{"matches":[]}');
    return history.matches || [];
  } catch (e) {
    console.warn('Could not load match history:', e);
    return [];
  }
}

function getLocalMatchStats() {
  const matches = getLocalMatchHistory();

  const stats = {
    totalGames: matches.length,
    wins: 0,
    losses: 0,
    careerGames: 0,
    careerWins: 0,
    quickplayGames: 0,
    quickplayWins: 0,
    avgPlayerScore: 0,
    avgOpponentScore: 0
  };

  let totalPlayerScore = 0;
  let totalOpponentScore = 0;

  matches.forEach(m => {
    if (m.won) stats.wins++;
    else stats.losses++;

    if (m.matchType === 'career') {
      stats.careerGames++;
      if (m.won) stats.careerWins++;
    } else if (m.matchType === 'quickplay') {
      stats.quickplayGames++;
      if (m.won) stats.quickplayWins++;
    }

    totalPlayerScore += m.playerScore || 0;
    totalOpponentScore += m.opponentScore || 0;
  });

  if (stats.totalGames > 0) {
    stats.avgPlayerScore = (totalPlayerScore / stats.totalGames).toFixed(1);
    stats.avgOpponentScore = (totalOpponentScore / stats.totalGames).toFixed(1);
    stats.winRate = Math.round((stats.wins / stats.totalGames) * 100);
  } else {
    stats.winRate = 0;
  }

  return stats;
}

// ============================================
// SEASON/TOURNAMENT STATE PERSISTENCE
// ============================================

function saveSeasonState() {
  try {
    // Save main season state (without activeTournament)
    const toSave = {
      currentSeason: seasonState.currentSeason,
      seasonYear: seasonState.seasonYear,
      careerTier: seasonState.careerTier,
      qualifications: seasonState.qualifications,
      seasonCalendar: seasonState.seasonCalendar,
      stats: seasonState.stats,
      rivalryHistory: seasonState.rivalryHistory,
      playerTeam: seasonState.playerTeam
    };
    localStorage.setItem('curlingpro_season', JSON.stringify(toSave));

    // Save active tournament separately (for crash recovery)
    if (seasonState.activeTournament) {
      localStorage.setItem('curlingpro_tournament', JSON.stringify(seasonState.activeTournament));
    } else {
      localStorage.removeItem('curlingpro_tournament');
    }
  } catch (e) {
    console.warn('Could not save season state:', e);
  }
}

// Save current match progress (for crash recovery during tournament matches)
// Now saves after every shot with full stone positions for mid-end recovery
function saveMatchProgress() {
  if (!seasonState.activeTournament) return;

  try {
    // Capture current stone positions
    const stonePositions = gameState.stones
      .filter(s => !s.outOfPlay)
      .map(s => ({
        team: s.team,
        x: s.mesh.position.x,
        y: s.mesh.position.y,
        z: s.mesh.position.z,
        rotation: s.mesh.rotation.y
      }));

    const matchState = {
      end: gameState.end,
      scores: gameState.scores,
      endScores: gameState.endScores,
      hammer: gameState.hammer,
      currentTeam: gameState.currentTeam,
      computerTeam: gameState.computerTeam,
      gameMode: gameState.gameMode,
      stonesThrown: gameState.stonesThrown,
      stonePositions: stonePositions,
      playerCountry: gameState.playerCountry,
      opponentCountry: gameState.opponentCountry,
      timestamp: Date.now()
    };
    localStorage.setItem('curlingpro_match_progress', JSON.stringify(matchState));
    const totalThrown = gameState.stonesThrown.red + gameState.stonesThrown.yellow;
    console.log('[Save] Match progress saved - End', gameState.end, 'Shot', totalThrown, 'Stones on ice:', stonePositions.length);
  } catch (e) {
    console.warn('Could not save match progress:', e);
  }
}

// Load match progress if available
function loadMatchProgress() {
  try {
    const saved = localStorage.getItem('curlingpro_match_progress');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Could not load match progress:', e);
  }
  return null;
}

// Clear match progress (when match completes)
function clearMatchProgress() {
  try {
    localStorage.removeItem('curlingpro_match_progress');
  } catch (e) {
    console.warn('Could not clear match progress:', e);
  }
}

function loadSeasonState() {
  try {
    const saved = localStorage.getItem('curlingpro_season');
    if (saved) {
      const data = JSON.parse(saved);
      seasonState.currentSeason = data.currentSeason || 1;
      seasonState.seasonYear = data.seasonYear || 2026;
      seasonState.careerTier = data.careerTier || 'club';
      seasonState.qualifications = data.qualifications || {
        regionalQualified: false,
        provincialQualified: false,
        nationalQualified: false,
        worldsQualified: false,
        olympicTrialsQualified: false,
        olympicsQualified: false
      };
      seasonState.seasonCalendar = data.seasonCalendar || { completed: [], available: [] };
      seasonState.stats = data.stats || { totalWins: 0, totalLosses: 0, tournamentsWon: 0, tournamentsEntered: 0, seasonsPlayed: 0 };
      seasonState.rivalryHistory = data.rivalryHistory || {};
      seasonState.playerTeam = data.playerTeam || { name: 'Team Player', country: null, ranking: 1000 };

      // Track if we need to save after migrations
      let needsSave = false;

      // Migration: Add club identity for saves before club-first update
      if (!seasonState.playerTeam.club) {
        seasonState.playerTeam.club = {
          id: 'granite',  // Default club for legacy saves
          name: 'Granite Curling Club',
          colors: { primary: '#64748b', secondary: '#1e293b' },
          crest: '🏔️'
        };
        needsSave = true;
      }

      // Migration: Add country lock fields for saves before deferred country update
      if (seasonState.playerTeam.countryLocked === undefined) {
        // If they had a country selected before, it should remain locked
        const hadCountry = seasonState.playerTeam.country !== null && seasonState.playerTeam.country !== undefined;
        seasonState.playerTeam.countryLocked = hadCountry;
        seasonState.playerTeam.countryUnlockShown = hadCountry;
        needsSave = true;
      }

      // Migration: Add careerStage based on tier
      if (!seasonState.careerStage) {
        const tierIndex = CAREER_TIERS.indexOf(seasonState.careerTier);
        if (tierIndex >= 3) {  // national or higher
          seasonState.careerStage = 'national';
        } else if (tierIndex >= 1) {
          seasonState.careerStage = 'regional';
        } else {
          seasonState.careerStage = 'club';
        }
        needsSave = true;
      }

      // Persist migrations if any occurred
      if (needsSave) {
        saveSeasonState();
      }
    }

    // Check for in-progress tournament
    const tournamentSaved = localStorage.getItem('curlingpro_tournament');
    if (tournamentSaved) {
      seasonState.activeTournament = JSON.parse(tournamentSaved);
    }
  } catch (e) {
    console.warn('Could not load season state:', e);
    initializeNewSeason();
  }
}

// ============================================
// PRACTICE MODE - Save/Load
// ============================================

function savePracticeStats() {
  try {
    localStorage.setItem('curlingpro_practice', JSON.stringify(practiceStats));
  } catch (e) {
    console.warn('Could not save practice stats:', e);
  }
}

function loadPracticeStats() {
  try {
    const saved = localStorage.getItem('curlingpro_practice');
    if (saved) {
      const data = JSON.parse(saved);
      // Merge saved data with defaults (in case new drills added)
      for (const drillType of Object.keys(PRACTICE_DRILLS)) {
        if (data[drillType]) {
          practiceStats[drillType] = {
            attempts: data[drillType].attempts || 0,
            successes: data[drillType].successes || 0,
            unlocked: data[drillType].unlocked || 1,
            scenarios: data[drillType].scenarios || {}
          };
        }
      }
    }
  } catch (e) {
    console.warn('Could not load practice stats:', e);
  }
}

function resetPracticeStats() {
  practiceStats = {
    takeout: { attempts: 0, successes: 0, unlocked: 1, scenarios: {} },
    bump: { attempts: 0, successes: 0, unlocked: 1, scenarios: {} },
    draw: { attempts: 0, successes: 0, unlocked: 1, scenarios: {} },
    guard: { attempts: 0, successes: 0, unlocked: 1, scenarios: {} },
    freeze: { attempts: 0, successes: 0, unlocked: 1, scenarios: {} },
    hitroll: { attempts: 0, successes: 0, unlocked: 1, scenarios: {} },
    skip: { attempts: 0, successes: 0, unlocked: 1, scenarios: {} }
  };
  localStorage.removeItem('curlingpro_practice');
}

// ============================================
// CUSTOM SCENARIOS (Save from gameplay)
// ============================================

const CUSTOM_SCENARIOS_KEY = 'curlingpro_custom_scenarios';

function getCustomScenarios() {
  try {
    const saved = localStorage.getItem(CUSTOM_SCENARIOS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.warn('Could not load custom scenarios:', e);
    return [];
  }
}

function saveCustomScenarios(scenarios) {
  try {
    localStorage.setItem(CUSTOM_SCENARIOS_KEY, JSON.stringify(scenarios));
  } catch (e) {
    console.warn('Could not save custom scenarios:', e);
  }
}

let saveScenarioGuard = false;

window.saveScenarioPrompt = function() {
  console.log('[SaveScenario] Button tapped');

  // Guard against double-firing
  if (saveScenarioGuard) {
    console.log('[SaveScenario] Guard active, ignoring');
    return;
  }
  saveScenarioGuard = true;
  setTimeout(() => { saveScenarioGuard = false; }, 300);

  // Check if there are any stones on the ice
  const stonesInPlay = gameState.stones.filter(s => !s.outOfPlay);
  if (stonesInPlay.length === 0) {
    console.log('[SaveScenario] No stones to save');
    showToast('No stones to save', 'info');
    return;
  }

  // Show the dialog
  const overlay = document.getElementById('save-scenario-overlay');
  const input = document.getElementById('scenario-name-input');
  const countDisplay = document.getElementById('save-scenario-stone-count');

  // Count stones by team
  const redCount = stonesInPlay.filter(s => s.team === 'red').length;
  const yellowCount = stonesInPlay.filter(s => s.team === 'yellow').length;
  countDisplay.textContent = `${redCount} red, ${yellowCount} yellow stones`;

  // Generate default name
  const existing = getCustomScenarios();
  input.value = `Custom ${existing.length + 1}`;

  overlay.style.display = 'flex';
  input.focus();
  input.select();
};

window.hideSaveScenario = function() {
  document.getElementById('save-scenario-overlay').style.display = 'none';
};

let confirmSaveGuard = false;

window.confirmSaveScenario = function() {
  // Guard against double-firing
  if (confirmSaveGuard) return;
  confirmSaveGuard = true;
  setTimeout(() => { confirmSaveGuard = false; }, 300);

  const input = document.getElementById('scenario-name-input');
  const name = input.value.trim() || 'Custom Scenario';

  // Get stones in play
  const stonesInPlay = gameState.stones.filter(s => !s.outOfPlay);
  if (stonesInPlay.length === 0) {
    window.hideSaveScenario();
    return;
  }

  // Extract stone positions
  const stones = stonesInPlay.map(s => ({
    team: s.team,
    x: s.mesh.position.x,
    z: s.mesh.position.z
  }));

  // Create scenario object
  const scenario = {
    id: 'custom_' + Date.now(),
    name: name,
    stones: stones,
    createdAt: Date.now()
  };

  // Save to localStorage
  const existing = getCustomScenarios();
  existing.push(scenario);
  saveCustomScenarios(existing);

  console.log('[SaveScenario] Saved:', scenario.name, 'with', stones.length, 'stones');

  // Hide dialog and show confirmation
  window.hideSaveScenario();

  // Brief visual feedback
  const btn = document.getElementById('save-scenario-btn');
  if (btn) {
    btn.textContent = '✓';
    btn.style.background = 'rgba(34, 197, 94, 0.8)';
    setTimeout(() => {
      btn.textContent = '💾';
      btn.style.background = 'rgba(100, 116, 139, 0.8)';
    }, 1500);
  }
};

window.deleteCustomScenario = function(scenarioId) {
  const scenarios = getCustomScenarios();
  const filtered = scenarios.filter(s => s.id !== scenarioId);
  saveCustomScenarios(filtered);
  console.log('[SaveScenario] Deleted scenario:', scenarioId);
};

// Evaluate practice shot outcome
function processPracticeOutcome() {
  const drillId = gameState.practiceMode.currentDrill;
  const scenarioId = gameState.practiceMode.currentScenario;
  const scenarios = PRACTICE_SCENARIOS[drillId];
  const scenario = scenarios.find(s => s.id === scenarioId);

  if (!scenario) return;

  // Increment attempt count
  gameState.practiceMode.attempts++;

  // Evaluate success based on scenario type
  const success = evaluatePracticeSuccess(scenario);

  // Update stats
  practiceStats[drillId].attempts++;
  if (!practiceStats[drillId].scenarios[scenarioId]) {
    practiceStats[drillId].scenarios[scenarioId] = { attempts: 0, successes: 0 };
  }
  practiceStats[drillId].scenarios[scenarioId].attempts++;

  if (success) {
    gameState.practiceMode.successes++;
    gameState.practiceMode.currentStreak++;
    practiceStats[drillId].successes++;
    practiceStats[drillId].scenarios[scenarioId].successes++;

    // Track success
    analytics.trackEvent('practice_success', drillId, { scenario: scenarioId, streak: gameState.practiceMode.currentStreak });

    // Check for unlock progression
    checkPracticeUnlocks(drillId);

    // Crowd cheers for success (louder for streaks)
    const streakBonus = Math.min(0.3, gameState.practiceMode.currentStreak * 0.05);
    soundManager.playCrowdCheer(0.6 + streakBonus);
  } else {
    gameState.practiceMode.currentStreak = 0;

    // Track attempt (failure)
    analytics.trackEvent('practice_attempt', drillId, { scenario: scenarioId, success: false });

    // Sympathetic crowd reaction for miss
    soundManager.playCrowdOoh();
  }

  // Save stats
  savePracticeStats();

  // Update UI
  document.getElementById('practice-attempts').textContent = gameState.practiceMode.attempts;
  document.getElementById('practice-successes').textContent = gameState.practiceMode.successes;

  // Show result popup after a short delay
  setTimeout(() => {
    showPracticeResult(success);
  }, 500);
}

// Evaluate if the practice shot was successful
function evaluatePracticeSuccess(scenario) {
  const target = scenario.target;

  // Find the thrown stone (last stone of player's team)
  const thrownStone = gameState.stones.find(s =>
    s.team === 'red' && !s.outOfPlay
  );

  switch (target.type) {
    case 'takeout': {
      // Count how many opponent stones were removed
      const preThrowOpponentCount = scenario.stones.filter(s => s.team === 'yellow').length;
      const currentOpponentCount = gameState.stones.filter(s =>
        s.team === 'yellow' && !s.outOfPlay
      ).length;
      const removedCount = preThrowOpponentCount - currentOpponentCount;
      return removedCount >= (target.minRemoved || 1);
    }

    case 'draw': {
      // Check if stone is in the target ring
      if (!thrownStone || thrownStone.outOfPlay) return false;

      const x = thrownStone.mesh.position.x;
      const z = thrownStone.mesh.position.z;
      const distFromButton = Math.sqrt(x * x + Math.pow(z - 41.07, 2));

      const ringDistances = {
        button: 0.15,
        fourFoot: 0.61,
        eightFoot: 1.22,
        twelveFoot: 1.83
      };

      const targetDist = ringDistances[target.ring] || 1.83;
      return distFromButton <= targetDist;
    }

    case 'guard': {
      // Check if stone is in guard zone (past hog line, before house)
      if (!thrownStone || thrownStone.outOfPlay) return false;

      const z = thrownStone.mesh.position.z;
      const x = thrownStone.mesh.position.x;
      const distFromButton = Math.sqrt(x * x + Math.pow(z - 41.07, 2));

      // Guard should be past far hog line (34.67) but not in house (dist > 1.83)
      const isInGuardZone = z >= 34.67 && z < 39.24 && distFromButton > 1.83;

      // Additional check for specific guard types
      if (target.zone === 'center') {
        return isInGuardZone && Math.abs(x) < 0.5;
      } else if (target.zone === 'corner') {
        return isInGuardZone && Math.abs(x) >= 0.3;
      } else if (target.zone === 'tight') {
        return isInGuardZone && z >= 38.0;
      } else if (target.zone === 'long') {
        return isInGuardZone && z < 37.0;
      }

      return isInGuardZone;
    }

    case 'freeze': {
      // Check if thrown stone is touching target stone
      if (!thrownStone || thrownStone.outOfPlay) return false;

      const targetStoneIndex = target.stoneIndex || 0;
      if (targetStoneIndex >= scenario.stones.length) return false;

      // Find the corresponding stone in current game state
      const targetStoneData = scenario.stones[targetStoneIndex];
      const targetStone = gameState.stones.find(s =>
        s.team === targetStoneData.team &&
        s !== thrownStone &&
        !s.outOfPlay
      );

      if (!targetStone) return false;

      // Check if touching (distance <= 2 * stone radius)
      const dx = thrownStone.mesh.position.x - targetStone.mesh.position.x;
      const dz = thrownStone.mesh.position.z - targetStone.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      return dist <= 0.32;  // 2 * STONE_RADIUS (0.145 * 2 ≈ 0.29, with small buffer)
    }

    case 'bump': {
      // Check if target stone moved to target zone
      const targetStoneIndex = target.stoneIndex || 0;
      const targetStoneData = scenario.stones[targetStoneIndex];

      const targetStone = gameState.stones.find(s =>
        s.team === targetStoneData.team && !s.outOfPlay
      );

      if (!targetStone) return false;

      const x = targetStone.mesh.position.x;
      const z = targetStone.mesh.position.z;
      const distFromButton = Math.sqrt(x * x + Math.pow(z - 41.07, 2));

      if (target.zone === 'button') {
        return distFromButton <= 0.3;
      } else if (target.zone === 'house') {
        return distFromButton <= 1.83;
      } else if (target.zone === 'backHouse') {
        return z >= 41.5 && distFromButton <= 1.83;
      }

      return distFromButton <= 1.83;
    }

    case 'hitroll': {
      // Must hit (remove) stone AND have thrown stone in target zone
      const preThrowOpponentCount = scenario.stones.filter(s => s.team === 'yellow').length;
      const currentOpponentCount = gameState.stones.filter(s =>
        s.team === 'yellow' && !s.outOfPlay
      ).length;
      const removedCount = preThrowOpponentCount - currentOpponentCount;

      if (removedCount < 1) return false;

      if (!thrownStone || thrownStone.outOfPlay) return false;

      const x = thrownStone.mesh.position.x;
      const z = thrownStone.mesh.position.z;
      const distFromButton = Math.sqrt(x * x + Math.pow(z - 41.07, 2));

      if (target.rollZone === 'house') {
        return distFromButton <= 1.83;
      } else if (target.rollZone === 'fourFoot') {
        return distFromButton <= 0.61;
      }

      return distFromButton <= 1.83;
    }

    case 'raise_takeout': {
      // Hit your own stone to remove an opponent's stone
      // Check that the target opponent stone was removed
      const targetStoneData = scenario.stones[target.targetStoneIndex];
      if (!targetStoneData || targetStoneData.team !== 'yellow') return false;

      const targetStoneRemoved = !gameState.stones.some(s =>
        s.team === 'yellow' && !s.outOfPlay
      );

      return targetStoneRemoved;
    }

    case 'hit_and_stick': {
      // Remove opponent stone AND have thrown stone stay in target zone
      const preThrowOpponentCount = scenario.stones.filter(s => s.team === 'yellow').length;
      const currentOpponentCount = gameState.stones.filter(s =>
        s.team === 'yellow' && !s.outOfPlay
      ).length;
      const removedCount = preThrowOpponentCount - currentOpponentCount;

      if (removedCount < 1) return false;

      if (!thrownStone || thrownStone.outOfPlay) return false;

      const x = thrownStone.mesh.position.x;
      const z = thrownStone.mesh.position.z;
      const distFromButton = Math.sqrt(x * x + Math.pow(z - 41.07, 2));

      if (target.targetZone === 'button') {
        return distFromButton <= 0.15;
      } else if (target.targetZone === 'fourFoot') {
        return distFromButton <= 0.61;
      } else if (target.targetZone === 'eightFoot') {
        return distFromButton <= 1.22;
      }

      return distFromButton <= 1.83;
    }

    default:
      return false;
  }
}

// Check if player unlocked new difficulty level
function checkPracticeUnlocks(drillId) {
  const stats = practiceStats[drillId];
  const scenarios = PRACTICE_SCENARIOS[drillId];

  // Find scenarios at current unlocked level
  const currentLevelScenarios = scenarios.filter(s => s.difficulty === stats.unlocked);

  // Check if player has completed all current level scenarios 3+ times
  let allCompleted = true;
  for (const scenario of currentLevelScenarios) {
    const scenarioStats = stats.scenarios[scenario.id] || { attempts: 0, successes: 0 };
    if (scenarioStats.successes < 3) {
      allCompleted = false;
      break;
    }
  }

  // Unlock next level if all completed
  if (allCompleted && stats.unlocked < 5) {
    stats.unlocked++;
  }
}

// Show practice result popup
function showPracticeResult(success, customMessage = null) {
  const resultEl = document.getElementById('practice-result');
  const iconEl = document.getElementById('practice-result-icon');
  const textEl = document.getElementById('practice-result-text');

  if (success) {
    iconEl.textContent = '✅';
    iconEl.style.color = '#4ade80';
    textEl.textContent = customMessage || 'Success!';
    textEl.style.color = '#4ade80';
  } else {
    iconEl.textContent = '❌';
    iconEl.style.color = '#f87171';
    textEl.textContent = customMessage || 'Try Again';
    textEl.style.color = '#f87171';
  }

  // Update "Next Shot" button text based on position in category
  const nextBtn = document.getElementById('practice-next-btn');
  if (nextBtn) {
    const drillId = gameState.practiceMode.currentDrill;
    const scenarioId = gameState.practiceMode.currentScenario;

    if (drillId === 'custom') {
      // Custom scenarios - hide next button
      nextBtn.style.display = 'none';
    } else {
      nextBtn.style.display = 'inline-block';
      const scenarios = PRACTICE_SCENARIOS[drillId];
      if (scenarios && scenarios.length > 0) {
        const currentIndex = scenarios.findIndex(s => s.id === scenarioId);
        const isLastShot = currentIndex === scenarios.length - 1;
        nextBtn.textContent = isLastShot ? 'Choose Drill' : 'Next Shot';
      }
    }
  }

  resultEl.style.display = 'block';
}

function initializeNewSeason() {
  seasonState.currentSeason = (seasonState.currentSeason || 0) + 1;
  seasonState.seasonYear = 2025 + seasonState.currentSeason;

  // Reset qualifications for new season (tier is preserved)
  const tierIndex = CAREER_TIERS.indexOf(seasonState.careerTier);
  seasonState.qualifications = {
    regionalQualified: tierIndex >= 1,
    provincialQualified: tierIndex >= 2,
    nationalQualified: tierIndex >= 3,
    worldsQualified: false,  // Must re-earn each season
    olympicTrialsQualified: false,
    olympicsQualified: false
  };

  // Generate available tournaments for this season based on tier
  seasonState.seasonCalendar = {
    completed: [],
    available: getAvailableTournaments()
  };

  seasonState.activeTournament = null;
  saveSeasonState();
}

function getAvailableTournaments() {
  // Return tournaments available based on current tier and qualifications
  return TOURNAMENT_DEFINITIONS.filter(t => {
    const tierIndex = CAREER_TIERS.indexOf(seasonState.careerTier);
    const tournamentTierIndex = CAREER_TIERS.indexOf(t.tier);

    // Check tier requirement
    if (tournamentTierIndex > tierIndex) return false;

    // Check qualification requirement
    if (t.requirements.qualification) {
      if (!seasonState.qualifications[t.requirements.qualification]) return false;
    }

    // Check if already completed this season
    const alreadyCompleted = seasonState.seasonCalendar.completed.some(c => c.tournamentId === t.id);
    if (alreadyCompleted) return false;

    return true;
  }).map(t => t.id);
}

// Generate a random opponent for tournaments
function generateRandomOpponent(tierLevel, excludeCountryId = null) {
  // Pick country (avoid player's country for variety)
  const availableCountries = CURLING_COUNTRIES.filter(c => c.id !== excludeCountryId);
  const country = availableCountries[Math.floor(Math.random() * availableCountries.length)];

  // Get name data for country
  const firstNames = OPPONENT_NAME_DATA.firstNames[country.id] || OPPONENT_NAME_DATA.firstNames.default;
  const lastNames = OPPONENT_NAME_DATA.lastNames[country.id] || OPPONENT_NAME_DATA.lastNames.default;
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

  // Day job (pros more common at higher tiers)
  const proProbability = tierLevel / 10;
  const dayJob = Math.random() < proProbability ? null : DAY_JOBS[Math.floor(Math.random() * DAY_JOBS.length)];

  // Home club
  const clubs = HOME_CLUBS[country.id] || HOME_CLUBS.default;
  const homeClub = clubs[Math.floor(Math.random() * clubs.length)];

  // Personality - random with some clustering
  const personalityArchetype = Math.random();
  let aggression, consistency, riskTolerance, patience, clutchFactor;

  if (personalityArchetype < 0.25) {
    // Aggressive type
    aggression = 60 + Math.random() * 40;
    patience = 20 + Math.random() * 40;
    riskTolerance = 55 + Math.random() * 35;
  } else if (personalityArchetype < 0.5) {
    // Conservative type
    aggression = 10 + Math.random() * 40;
    patience = 60 + Math.random() * 35;
    riskTolerance = 20 + Math.random() * 40;
  } else {
    // Balanced type
    aggression = 35 + Math.random() * 30;
    patience = 40 + Math.random() * 30;
    riskTolerance = 35 + Math.random() * 30;
  }
  consistency = 40 + Math.random() * 50;
  clutchFactor = 40 + Math.random() * 50;

  // Skills based on tier (higher tier = better skills)
  const baseSkill = 40 + (tierLevel * 6);
  const skillVariance = 15;
  const skills = {
    draw: Math.min(100, Math.max(30, baseSkill + (Math.random() - 0.5) * skillVariance * 2)),
    takeout: Math.min(100, Math.max(30, baseSkill + (Math.random() - 0.5) * skillVariance * 2)),
    strategy: Math.min(100, Math.max(30, baseSkill + (Math.random() - 0.5) * skillVariance * 2)),
    pressure: Math.min(100, Math.max(30, baseSkill + (Math.random() - 0.5) * skillVariance * 2)),
    sweeping: Math.min(100, Math.max(30, baseSkill + (Math.random() - 0.5) * skillVariance * 2))
  };

  // Generate bio
  const bioTemplates = [
    `${firstName} from ${country.name} curls out of ${homeClub}.`,
    dayJob ? `A ${dayJob.toLowerCase()} by day, ${firstName} is a fierce competitor.` : `${firstName} is a rising talent from ${country.name}.`,
    `Known at ${homeClub} for ${['clutch shots', 'steady play', 'aggressive takeouts', 'beautiful draws'][Math.floor(Math.random() * 4)]}.`
  ];
  const bio = bioTemplates[Math.floor(Math.random() * bioTemplates.length)];

  return {
    id: `gen_${country.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    firstName,
    lastName,
    nickname: null,
    countryId: country.id,
    dayJob,
    teamName: tierLevel >= 3 ? `Team ${lastName}` : `${homeClub} - ${lastName}`,
    homeClub,
    skills,
    personality: { aggression, riskTolerance, patience, clutchFactor, consistency },
    bio,
    catchphrase: null,
    tierRange: { min: Math.max(1, tierLevel - 1), max: Math.min(8, tierLevel + 1) },
    isRival: false,
    isGenerated: true
  };
}

// Get eligible rivals for a tournament tier
function getEligibleRivals(tierLevel) {
  return PERSISTENT_RIVALS.filter(rival => {
    return tierLevel >= rival.tierRange.min && tierLevel <= rival.tierRange.max;
  });
}

// Select opponent for a match (40% rival, 60% generated)
function selectOpponentForMatch(tierLevel) {
  const encounterRival = Math.random() < 0.4;

  if (encounterRival) {
    const eligibleRivals = getEligibleRivals(tierLevel);
    if (eligibleRivals.length > 0) {
      // Prefer rivals player hasn't faced recently
      const sortedByRecency = eligibleRivals.sort((a, b) => {
        const aHistory = seasonState.rivalryHistory[a.id];
        const bHistory = seasonState.rivalryHistory[b.id];
        const aLast = aHistory ? aHistory.lastMet : 0;
        const bLast = bHistory ? bHistory.lastMet : 0;
        return aLast - bLast;
      });

      // Pick from the least-recently-faced rivals
      const pickIndex = Math.floor(Math.random() * Math.min(3, sortedByRecency.length));
      return { ...sortedByRecency[pickIndex], isRival: true };
    }
  }

  // Generate random opponent
  return generateRandomOpponent(tierLevel, seasonState.playerTeam.country?.id);
}

// Get country object from ID
function getCountryById(countryId) {
  return CURLING_COUNTRIES.find(c => c.id === countryId) || CURLING_COUNTRIES[0];
}

// ============================================
// TOURNAMENT ENGINE
// ============================================

// Create and start a new tournament
function createTournament(tournamentId) {
  const definition = TOURNAMENT_DEFINITIONS.find(t => t.id === tournamentId);
  if (!definition) {
    console.error('Tournament not found:', tournamentId);
    return null;
  }

  // Get tier level for opponent generation
  const tierIndex = CAREER_TIERS.indexOf(definition.tier) + 1;

  // Generate tournament field
  const teams = generateTournamentField(definition, tierIndex);

  // Generate bracket based on format
  let bracket;
  if (definition.format.type === 'single_elimination') {
    bracket = generateSingleEliminationBracket(teams, definition.format.bestOf);
  } else if (definition.format.type === 'page_playoff') {
    bracket = generatePagePlayoffBracket(teams, definition.format.bestOf);
  } else {
    // Default to single elimination
    bracket = generateSingleEliminationBracket(teams, definition.format.bestOf);
  }

  // Create tournament state
  const tournament = {
    definition: definition,
    phase: 'playoff',  // For now, skip round robin and go straight to playoffs
    teams: teams,
    bracket: bracket,
    currentMatchup: null,
    startTime: Date.now(),
    result: null
  };

  // Set the first match
  tournament.currentMatchup = getNextPlayerMatch(tournament);

  // Save to season state
  seasonState.activeTournament = tournament;
  seasonState.stats.tournamentsEntered++;
  saveSeasonState();

  return tournament;
}

// Generate the field of teams for a tournament
function generateTournamentField(definition, tierLevel) {
  const teams = [];
  const numTeams = definition.format.teams;

  // Add player team first (seed 1)
  const playerCountry = seasonState.playerTeam.country || null;
  const playerClub = seasonState.playerTeam.club || { id: null, name: 'My Club', colors: { primary: '#4ade80', secondary: '#1a1a2e' }, crest: '🥌' };
  const showCountryInBracket = seasonState.playerTeam.countryLocked && playerCountry;

  teams.push({
    id: 'player',
    name: seasonState.playerTeam.name || 'Team Player',
    country: showCountryInBracket ? playerCountry : null,
    club: playerClub,
    seed: 1,
    isPlayer: true,
    isRival: false,
    rivalId: null,
    opponent: null  // Player doesn't have opponent data
  });

  // Determine how many rivals to include (1-3 based on tournament size)
  const maxRivals = Math.min(Math.floor(numTeams / 3), 3);
  const eligibleRivals = getEligibleRivals(tierLevel);

  // Shuffle and pick rivals
  const shuffledRivals = [...eligibleRivals].sort(() => Math.random() - 0.5);
  const selectedRivals = shuffledRivals.slice(0, maxRivals);

  // Add rival teams
  selectedRivals.forEach((rival, index) => {
    const country = getCountryById(rival.countryId);
    teams.push({
      id: `rival_${rival.id}`,
      name: rival.teamName || `Team ${rival.lastName}`,
      country: country,
      seed: teams.length + 1,
      isPlayer: false,
      isRival: true,
      rivalId: rival.id,
      opponent: rival
    });
  });

  // Fill remaining spots with generated opponents
  while (teams.length < numTeams) {
    const opponent = generateRandomOpponent(tierLevel, playerCountry?.id || null);
    const country = getCountryById(opponent.countryId);
    teams.push({
      id: opponent.id,
      name: opponent.teamName || `Team ${opponent.lastName}`,
      country: country,
      seed: teams.length + 1,
      isPlayer: false,
      isRival: false,
      rivalId: null,
      opponent: opponent
    });
  }

  // Shuffle seeds 2+ (keep player at seed 1 for easier bracket positioning)
  const otherTeams = teams.slice(1).sort(() => Math.random() - 0.5);
  otherTeams.forEach((team, index) => {
    team.seed = index + 2;
  });

  return [teams[0], ...otherTeams];
}

// Generate single elimination bracket
function generateSingleEliminationBracket(teams, bestOf = 1) {
  const numTeams = teams.length;
  const numRounds = Math.ceil(Math.log2(numTeams));
  const rounds = [];

  // Round names
  const roundNames = {
    1: 'Final',
    2: 'Semifinals',
    3: 'Quarterfinals',
    4: 'Round of 16',
    5: 'Round of 32'
  };

  // Create bracket structure from finals backwards
  // round 0 = Final (1 match), round 1 = Semifinals (2 matches), etc.
  let matchesInRound = 1;
  for (let round = 0; round < numRounds; round++) {
    const roundNum = numRounds - round;
    // Use round + 1 for name lookup: Final=1, Semis=2, Quarters=4, etc.
    const roundName = roundNames[round + 1] || `Round of ${matchesInRound * 2}`;
    const matchups = [];

    for (let i = 0; i < matchesInRound; i++) {
      matchups.push({
        id: `r${roundNum}_m${i + 1}`,
        roundNum: roundNum,
        position: i,
        team1: null,
        team2: null,
        winner: null,
        scores: { team1: null, team2: null },
        status: 'pending',  // pending, ready, in_progress, complete
        bestOf: bestOf,
        games: [],  // For best-of series
        nextMatchId: round > 0 ? `r${roundNum + 1}_m${Math.floor(i / 2) + 1}` : null,
        nextMatchSlot: round > 0 ? (i % 2 === 0 ? 'team1' : 'team2') : null
      });
    }

    rounds.unshift({
      name: roundName,
      roundNum: roundNum,
      matchups: matchups
    });

    matchesInRound *= 2;
  }

  // Seed teams into first round using standard bracket seeding
  const firstRound = rounds[0];
  const bracketOrder = getBracketSeedOrder(numTeams);

  for (let i = 0; i < firstRound.matchups.length; i++) {
    const match = firstRound.matchups[i];
    const seed1Index = bracketOrder[i * 2];
    const seed2Index = bracketOrder[i * 2 + 1];

    match.team1 = seed1Index < teams.length ? teams[seed1Index] : null;
    match.team2 = seed2Index < teams.length ? teams[seed2Index] : null;

    // If one team has a bye, advance them automatically
    if (match.team1 && !match.team2) {
      match.winner = 'team1';
      match.status = 'complete';
      advanceWinner(rounds, match);
    } else if (match.team2 && !match.team1) {
      match.winner = 'team2';
      match.status = 'complete';
      advanceWinner(rounds, match);
    } else if (match.team1 && match.team2) {
      match.status = 'ready';
    }
  }

  return { type: 'single_elimination', rounds: rounds };
}

// Generate Page Playoff bracket (common in curling)
// 1v2 game (winner to final), 3v4 game (loser out), then loser of 1v2 vs winner of 3v4 (winner to final)
function generatePagePlayoffBracket(teams, bestOf = 1) {
  // Page playoff requires exactly 4 teams in playoffs
  // Take top 4 seeds
  const playoffTeams = teams.slice(0, 4);

  const rounds = [
    {
      name: 'Page Playoff',
      roundNum: 1,
      matchups: [
        {
          id: 'page_1v2',
          roundNum: 1,
          position: 0,
          team1: playoffTeams[0],  // #1 seed
          team2: playoffTeams[1],  // #2 seed
          winner: null,
          scores: { team1: null, team2: null },
          status: 'ready',
          bestOf: bestOf,
          games: [],
          nextMatchId: 'final',
          nextMatchSlot: 'team1',
          loserNextMatchId: 'page_semi',
          loserNextMatchSlot: 'team1',
          description: '1 vs 2 - Winner to Final'
        },
        {
          id: 'page_3v4',
          roundNum: 1,
          position: 1,
          team1: playoffTeams[2],  // #3 seed
          team2: playoffTeams[3],  // #4 seed
          winner: null,
          scores: { team1: null, team2: null },
          status: 'ready',
          bestOf: bestOf,
          games: [],
          nextMatchId: 'page_semi',
          nextMatchSlot: 'team2',
          loserNextMatchId: null,  // Loser is eliminated
          description: '3 vs 4 - Loser Eliminated'
        }
      ]
    },
    {
      name: 'Page Semifinal',
      roundNum: 2,
      matchups: [
        {
          id: 'page_semi',
          roundNum: 2,
          position: 0,
          team1: null,  // Loser of 1v2
          team2: null,  // Winner of 3v4
          winner: null,
          scores: { team1: null, team2: null },
          status: 'pending',
          bestOf: bestOf,
          games: [],
          nextMatchId: 'final',
          nextMatchSlot: 'team2',
          loserNextMatchId: null,  // Loser gets bronze
          description: 'Semifinal - Winner to Final'
        }
      ]
    },
    {
      name: 'Final',
      roundNum: 3,
      matchups: [
        {
          id: 'final',
          roundNum: 3,
          position: 0,
          team1: null,  // Winner of 1v2
          team2: null,  // Winner of semifinal
          winner: null,
          scores: { team1: null, team2: null },
          status: 'pending',
          bestOf: bestOf,
          games: [],
          nextMatchId: null,
          description: 'Championship Final'
        }
      ]
    }
  ];

  return { type: 'page_playoff', rounds: rounds };
}

// Get standard bracket seeding order (1v8, 4v5, 2v7, 3v6 for 8 teams)
function getBracketSeedOrder(numTeams) {
  if (numTeams <= 2) return [0, 1];
  if (numTeams <= 4) return [0, 3, 1, 2];
  if (numTeams <= 8) return [0, 7, 3, 4, 1, 6, 2, 5];
  // For larger brackets, use recursive algorithm
  const order = [];
  const halfSize = numTeams / 2;
  const smallerOrder = getBracketSeedOrder(halfSize);
  for (let i = 0; i < smallerOrder.length; i++) {
    order.push(smallerOrder[i]);
    order.push(numTeams - 1 - smallerOrder[i]);
  }
  return order;
}

// Advance winner to next match in bracket
function advanceWinner(rounds, match) {
  if (!match.nextMatchId) return;

  const winnerTeam = match.winner === 'team1' ? match.team1 : match.team2;

  // Find the next match
  for (const round of rounds) {
    for (const nextMatch of round.matchups) {
      if (nextMatch.id === match.nextMatchId) {
        nextMatch[match.nextMatchSlot] = winnerTeam;

        // Check if both teams are now set
        if (nextMatch.team1 && nextMatch.team2) {
          nextMatch.status = 'ready';
        }
        return;
      }
    }
  }
}

// Advance loser (for page playoff)
function advanceLoser(rounds, match) {
  if (!match.loserNextMatchId) return;

  const loserTeam = match.winner === 'team1' ? match.team2 : match.team1;

  // Find the next match for loser
  for (const round of rounds) {
    for (const nextMatch of round.matchups) {
      if (nextMatch.id === match.loserNextMatchId) {
        nextMatch[match.loserNextMatchSlot] = loserTeam;

        // Check if both teams are now set
        if (nextMatch.team1 && nextMatch.team2) {
          nextMatch.status = 'ready';
        }
        return;
      }
    }
  }
}

// Simulate all pending AI vs AI matches in the bracket
// This ensures that when the player advances, their next opponent is ready
function simulateAIMatches(tournament) {
  if (!tournament || !tournament.bracket) return;

  const rounds = tournament.bracket.rounds;
  let matchSimulated = true;

  // Keep simulating until no more AI matches can be completed
  while (matchSimulated) {
    matchSimulated = false;

    for (const round of rounds) {
      for (const match of round.matchups) {
        // Check if this is a ready AI vs AI match (both teams present, neither is player)
        if (match.status === 'ready' &&
            match.team1 && match.team2 &&
            !match.team1.isPlayer && !match.team2.isPlayer) {

          // Simulate the match - higher seed (lower number) has slight advantage
          const team1Advantage = (match.team2.seed - match.team1.seed) * 0.05;
          const team1WinChance = 0.5 + team1Advantage;
          const team1Wins = Math.random() < team1WinChance;

          // Set winner and scores
          match.winner = team1Wins ? 'team1' : 'team2';
          const winnerScore = Math.floor(Math.random() * 4) + 5; // 5-8
          const loserScore = Math.floor(Math.random() * Math.min(winnerScore, 5)); // 0 to min(winner-1, 4)
          match.scores = {
            team1: team1Wins ? winnerScore : loserScore,
            team2: team1Wins ? loserScore : winnerScore
          };
          match.games = [{
            team1Score: match.scores.team1,
            team2Score: match.scores.team2,
            winner: match.winner
          }];
          match.status = 'complete';

          console.log(`[Tournament] Simulated AI match: ${match.team1.name} vs ${match.team2.name} -> ${team1Wins ? match.team1.name : match.team2.name} wins`);

          // Advance winner to next match
          advanceWinner(rounds, match);

          // For page playoff, also advance loser if applicable
          if (tournament.bracket.type === 'page_playoff' && match.loserNextMatchId) {
            advanceLoser(rounds, match);
          }

          matchSimulated = true;
        }
      }
    }
  }
}

// Get the next match the player needs to play
function getNextPlayerMatch(tournament) {
  const t = tournament || seasonState.activeTournament;
  if (!t || !t.bracket) return null;

  for (const round of t.bracket.rounds) {
    for (const match of round.matchups) {
      // Check for 'ready' or 'pending' status
      if (match.status === 'ready' || match.status === 'pending') {
        // Check if player is in this match
        const playerInMatch = (match.team1 && match.team1.isPlayer) ||
                             (match.team2 && match.team2.isPlayer);
        if (playerInMatch) {
          return { round, matchup: match };
        }
      }
    }
  }

  return null;
}

// Get opponent for current match
function getCurrentMatchOpponent(tournament) {
  const t = tournament || seasonState.activeTournament;
  if (!t) return null;

  // Get the actual match object - currentMatchup may be {round, matchup} or just matchup
  let match = null;

  // First try currentMatchup
  if (t.currentMatchup) {
    // Handle both formats: {round, matchup} or direct matchup object
    match = t.currentMatchup.matchup || t.currentMatchup;
  }

  // If no match or it's complete, get fresh from bracket
  if (!match || match.status === 'complete') {
    const nextMatch = getNextPlayerMatch(t);
    if (nextMatch) {
      match = nextMatch.matchup;
    }
  }

  if (!match) {
    console.log('[getCurrentMatchOpponent] No match found');
    return null;
  }

  console.log('[getCurrentMatchOpponent] match:', match.id, 'team1:', match.team1?.name, 'team2:', match.team2?.name);

  // Get opponent from match
  if (match.team1 && match.team1.isPlayer) {
    const opp = match.team2?.opponent || match.team2;
    console.log('[getCurrentMatchOpponent] Player is team1, returning team2:', opp);
    return opp;
  } else if (match.team2 && match.team2.isPlayer) {
    const opp = match.team1?.opponent || match.team1;
    console.log('[getCurrentMatchOpponent] Player is team2, returning team1:', opp);
    return opp;
  }
  console.log('[getCurrentMatchOpponent] Player not found in match');
  return null;
}

// Update bracket after a match is played
function updateBracketWithResult(playerWon, playerScore, opponentScore) {
  const tournament = seasonState.activeTournament;
  if (!tournament || !tournament.currentMatchup) return null;

  // currentMatchup can be { round, matchup } format from getNextPlayerMatch
  const match = tournament.currentMatchup.matchup || tournament.currentMatchup;
  let result = { playerWon, tournamentComplete: false, playerEliminated: false };

  try {
    // Determine which team the player is
    const playerIsTeam1 = match.team1 && match.team1.isPlayer;

    // Set scores
    match.scores = {
      team1: playerIsTeam1 ? playerScore : opponentScore,
      team2: playerIsTeam1 ? opponentScore : playerScore
    };

    // Set winner
    if (playerWon) {
      match.winner = playerIsTeam1 ? 'team1' : 'team2';
    } else {
      match.winner = playerIsTeam1 ? 'team2' : 'team1';
    }

    match.status = 'complete';

    // Record game in series (for best-of)
    if (!match.games) match.games = [];
    match.games.push({
      team1Score: match.scores.team1,
      team2Score: match.scores.team2,
      winner: match.winner
    });

    // Save immediately after recording basic match result
    saveSeasonState();

    // Update stats
    if (playerWon) {
      seasonState.stats.totalWins++;
    } else {
      seasonState.stats.totalLosses++;
    }

    // Update rivalry history if opponent is a rival
    const opponent = getCurrentMatchOpponent(tournament);
    if (opponent && opponent.isRival && opponent.rivalId) {
      if (!seasonState.rivalryHistory[opponent.rivalId]) {
        seasonState.rivalryHistory[opponent.rivalId] = { wins: 0, losses: 0, lastMet: null };
      }
      if (playerWon) {
        seasonState.rivalryHistory[opponent.rivalId].wins++;
      } else {
        seasonState.rivalryHistory[opponent.rivalId].losses++;
      }
      seasonState.rivalryHistory[opponent.rivalId].lastMet = Date.now();
    }

    // Advance winner in bracket (with defensive check)
    if (tournament.bracket && tournament.bracket.rounds) {
      advanceWinner(tournament.bracket.rounds, match);

      // For page playoff, also advance loser if applicable
      if (tournament.bracket.type === 'page_playoff' && match.loserNextMatchId) {
        advanceLoser(tournament.bracket.rounds, match);
      }
    } else {
      console.warn('[updateBracketWithResult] Missing bracket data, skipping advancement');
    }

    // Simulate any AI vs AI matches that are now ready
    // This ensures the player's next opponent is determined
    simulateAIMatches(tournament);

    // Check if player is eliminated or tournament is complete
    result = checkTournamentStatus(tournament, playerWon);

    if (result.tournamentComplete || result.playerEliminated) {
      completeTournament(tournament, result);
    } else {
      // Find next match for player
      tournament.currentMatchup = getNextPlayerMatch(tournament);
    }

    // Final save with all updates
    saveSeasonState();

  } catch (error) {
    console.error('[updateBracketWithResult] Error updating bracket:', error);
    // Try to save whatever state we have
    try {
      saveSeasonState();
    } catch (saveError) {
      console.error('[updateBracketWithResult] Failed to save state:', saveError);
    }
    // Track the error
    if (typeof trackError === 'function') {
      trackError('bracket_update_error', error.message, { playerWon, playerScore, opponentScore });
    }
  }

  return result;
}

// Check tournament status after a match
function checkTournamentStatus(tournament, playerWon) {
  const result = {
    tournamentComplete: false,
    playerEliminated: false,
    playerWon: playerWon,
    placement: null,
    isFinal: false,
    isChampion: false
  };

  // Defensive check for bracket
  if (!tournament || !tournament.bracket || !tournament.bracket.rounds) {
    console.warn('[checkTournamentStatus] Missing tournament or bracket data');
    return result;
  }

  // Check if this was the final
  const finalMatch = tournament.bracket.rounds[tournament.bracket.rounds.length - 1].matchups[0];
  // currentMatchup can be { round, matchup } format
  const currentMatch = tournament.currentMatchup.matchup || tournament.currentMatchup;
  if (currentMatch.id === finalMatch.id) {
    result.tournamentComplete = true;
    result.isFinal = true;
    if (playerWon) {
      result.isChampion = true;
      result.placement = 1;
    } else {
      result.placement = 2;
    }
    return result;
  }

  // Check if player is eliminated
  if (!playerWon) {
    // In single elimination, loss = elimination
    if (tournament.bracket.type === 'single_elimination') {
      result.playerEliminated = true;
      result.tournamentComplete = true;
      // Calculate placement based on round
      result.placement = calculatePlacement(tournament);
    }
    // In page playoff, check if there's a loser bracket path
    else if (tournament.bracket.type === 'page_playoff') {
      // currentMatch already extracted above
      if (!currentMatch.loserNextMatchId) {
        result.playerEliminated = true;
        result.tournamentComplete = true;
        result.placement = calculatePlacement(tournament);
      }
    }
  }

  return result;
}

// Calculate player's placement in tournament
function calculatePlacement(tournament) {
  // Defensive check
  if (!tournament || !tournament.bracket || !tournament.bracket.rounds) {
    return 4; // Default placement if data missing
  }

  // Count remaining teams
  let teamsRemaining = 0;
  for (const round of tournament.bracket.rounds) {
    for (const match of round.matchups) {
      if (match.status !== 'complete') {
        if (match.team1) teamsRemaining++;
        if (match.team2) teamsRemaining++;
      }
    }
  }

  // Placement is based on when you were eliminated
  // Lost in final = 2nd, Lost in semis = 3rd-4th, etc.
  const totalTeams = tournament.teams?.length || 8;
  return Math.max(2, Math.min(totalTeams, teamsRemaining + 1));
}

// Complete tournament and update season
function completeTournament(tournament, result) {
  const definition = tournament.definition;

  // Create tournament result record
  const tournamentResult = {
    tournamentId: definition.id,
    tournamentName: definition.name,
    season: seasonState.currentSeason,
    placement: result.placement,
    isChampion: result.isChampion,
    completedAt: Date.now()
  };

  // Handle based on whether player won or was eliminated
  if (result.isChampion) {
    // Player won - mark tournament as completed (can't re-enter this season)
    seasonState.seasonCalendar.completed.push(tournamentResult);

    // Remove from available
    const availableIndex = seasonState.seasonCalendar.available.indexOf(definition.id);
    if (availableIndex > -1) {
      seasonState.seasonCalendar.available.splice(availableIndex, 1);
    }

    seasonState.stats.tournamentsWon++;

    // Grant qualification
    if (definition.rewards.qualifiesFor) {
      seasonState.qualifications[definition.rewards.qualifiesFor] = true;
    }

    // Tier advancement
    if (definition.rewards.tierAdvance) {
      const currentTierIndex = CAREER_TIERS.indexOf(seasonState.careerTier);
      if (currentTierIndex < CAREER_TIERS.length - 1) {
        seasonState.careerTier = CAREER_TIERS[currentTierIndex + 1];
      }
    }

    // Refresh available tournaments (new ones may be unlocked)
    seasonState.seasonCalendar.available = getAvailableTournaments();
  }
  // If eliminated, tournament stays available for retry from round 1

  // Store result in tournament
  tournament.result = result;
  tournament.phase = 'complete';

  // Clear active tournament so player can enter a new one
  // (they must start fresh if they want to re-enter, not replay from where they lost)
  seasonState.activeTournament = null;

  saveSeasonState();

  return tournamentResult;
}

// Exit/abandon current tournament
function abandonTournament() {
  if (!seasonState.activeTournament) return;

  // Clear active tournament without recording result
  seasonState.activeTournament = null;
  saveSeasonState();
}

// Get tournament definition by ID
function getTournamentDefinition(tournamentId) {
  return TOURNAMENT_DEFINITIONS.find(t => t.id === tournamentId);
}

// Check if player can enter a tournament
function canEnterTournament(tournamentId) {
  const definition = getTournamentDefinition(tournamentId);
  if (!definition) {
    console.log('[canEnterTournament] No definition found for:', tournamentId);
    return false;
  }

  // Check if already in a tournament
  if (seasonState.activeTournament) {
    console.log('[canEnterTournament] Already in tournament:', seasonState.activeTournament);
    return false;
  }

  // Check tier requirement
  const playerTierIndex = CAREER_TIERS.indexOf(seasonState.careerTier);
  const tournamentTierIndex = CAREER_TIERS.indexOf(definition.requirements.minTier);
  console.log('[canEnterTournament] playerTierIndex:', playerTierIndex, 'tournamentTierIndex:', tournamentTierIndex);
  if (playerTierIndex < tournamentTierIndex) {
    console.log('[canEnterTournament] Tier too low');
    return false;
  }

  // Check qualification requirement
  if (definition.requirements.qualification) {
    console.log('[canEnterTournament] Requires qualification:', definition.requirements.qualification);
    if (!seasonState.qualifications[definition.requirements.qualification]) {
      console.log('[canEnterTournament] Missing qualification');
      return false;
    }
  }

  // Check if already completed this season
  const alreadyCompleted = seasonState.seasonCalendar.completed.some(
    c => c.tournamentId === definition.id
  );
  if (alreadyCompleted) {
    console.log('[canEnterTournament] Already completed this season');
    return false;
  }

  console.log('[canEnterTournament] Can enter!');
  return true;
}

function handleCareerResult(won) {
  if (gameState.gameMode !== '1player') return null;

  const level = getCurrentLevel();
  let result = { advanced: false, demoted: false, message: '' };

  if (won) {
    gameState.career.wins++;

    // Check for advancement
    if (level.winsToAdvance && gameState.career.wins >= level.winsToAdvance) {
      if (gameState.career.level < 8) {
        gameState.career.level++;
        gameState.career.wins = 0;
        gameState.career.losses = 0;
        result.advanced = true;
        result.message = `Advanced to ${getCurrentLevel().name}!`;
      } else {
        result.message = 'Olympic Champion!';
      }
    } else if (level.winsToAdvance) {
      const remaining = level.winsToAdvance - gameState.career.wins;
      result.message = `${remaining} more win${remaining > 1 ? 's' : ''} to advance`;
    }
  } else {
    gameState.career.losses++;

    // Check for demotion (after 3 losses at a level, drop down)
    if (gameState.career.losses >= 3 && gameState.career.level > 1) {
      gameState.career.level--;
      gameState.career.wins = 0;
      gameState.career.losses = 0;
      result.demoted = true;
      result.message = `Dropped to ${getCurrentLevel().name}`;
    }
  }

  saveCareer();
  updateCareerDisplay();

  // Update arena if level changed
  if (result.advanced || result.demoted) {
    updateArenaForLevel();
  }

  return result;
}

function updateCareerDisplay() {
  const level = getCurrentLevel();

  // Get user's selected difficulty label
  const difficultyLabels = {
    'easy': 'Easy',
    'medium': 'Medium',
    'hard': 'Hard',
    'expert': 'Expert'
  };
  const userDifficulty = difficultyLabels[gameState.settings.difficulty] || 'Medium';

  // Update main display
  const levelDisplay = document.getElementById('career-level');
  const progressDisplay = document.getElementById('career-progress');
  const difficultyDisplay = document.getElementById('career-difficulty');

  if (levelDisplay) {
    levelDisplay.textContent = level.name;
    levelDisplay.style.color = level.color;
  }

  if (difficultyDisplay) {
    difficultyDisplay.textContent = `(${userDifficulty})`;
  }

  if (progressDisplay) {
    if (level.winsToAdvance) {
      progressDisplay.textContent = `${gameState.career.wins}/${level.winsToAdvance} wins`;
    } else {
      progressDisplay.textContent = 'Final Level';
    }
  }

  // Update settings display
  const settingsLevel = document.getElementById('settings-career-level');
  const settingsProgress = document.getElementById('settings-career-progress');
  const settingsDifficulty = document.getElementById('settings-career-difficulty');

  if (settingsLevel) {
    settingsLevel.textContent = level.name;
    settingsLevel.style.color = level.color;
  }

  if (settingsDifficulty) {
    settingsDifficulty.textContent = `(${userDifficulty})`;
  }

  if (settingsProgress) {
    if (level.winsToAdvance) {
      settingsProgress.textContent = `${gameState.career.wins}/${level.winsToAdvance} wins`;
    } else {
      settingsProgress.textContent = 'Final Level';
    }
  }

  // Update level pips
  const pips = document.querySelectorAll('.level-pip');
  pips.forEach(pip => {
    const pipLevel = parseInt(pip.getAttribute('data-level'));
    if (pipLevel <= gameState.career.level) {
      pip.style.background = CAREER_LEVELS[pipLevel - 1].color;
    } else {
      pip.style.background = '#333';
    }
  });
}

function resetCareer() {
  gameState.career.level = 1;
  gameState.career.wins = 0;
  gameState.career.losses = 0;
  saveCareer();
  updateCareerDisplay();
  updateArenaForLevel();  // Reset arena to Club level
}

window.resetCareer = resetCareer;

// Custom confirm modal
let confirmCallback = null;

window.showResetConfirm = function() {
  const overlay = document.getElementById('confirm-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    confirmCallback = () => {
      resetCareer();
      window.hideConfirm();
    };
  }
};

window.hideConfirm = function() {
  const overlay = document.getElementById('confirm-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
  confirmCallback = null;
};

window.confirmAction = function() {
  if (confirmCallback) {
    confirmCallback();
  }
};

// ============================================
// THREE.JS SETUP
// ============================================
updateLoadingProgress(20, 'Setting up renderer...');
const scene = new THREE.Scene();
// Dark arena background - makes the white ice pop
scene.background = new THREE.Color(0x0d1117);
// Add fog for depth
scene.fog = new THREE.Fog(0x0d1117, 30, 60);

// Use visualViewport for more reliable aspect ratio on iOS
const initVP = window.visualViewport || { width: window.innerWidth, height: window.innerHeight };
const camera = new THREE.PerspectiveCamera(60, initVP.width / initVP.height, 0.1, 100);
camera.position.set(THROWER_CAM.x, THROWER_CAM.y, THROWER_CAM.z);
camera.lookAt(THROWER_CAM.lookAt.x, THROWER_CAM.lookAt.y, THROWER_CAM.lookAt.z);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(initVP.width, initVP.height);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Lighting - simulating indoor arena lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

// Main overhead light (center)
const mainLight = new THREE.DirectionalLight(0xffffff, 0.9);
mainLight.position.set(0, 25, SHEET_LENGTH / 2);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 2048;
mainLight.shadow.mapSize.height = 2048;
// Configure shadow camera to cover entire sheet (including hack area)
mainLight.shadow.camera.left = -SHEET_WIDTH;
mainLight.shadow.camera.right = SHEET_WIDTH;
mainLight.shadow.camera.top = SHEET_LENGTH;
mainLight.shadow.camera.bottom = -5;  // Slightly past hack
mainLight.shadow.camera.near = 1;
mainLight.shadow.camera.far = 60;
scene.add(mainLight);

// Additional overhead lights along the sheet - high and wide for even coverage
const light1 = new THREE.PointLight(0xffffff, 0.25, 80);
light1.position.set(0, 25, 10);
scene.add(light1);

const light2 = new THREE.PointLight(0xffffff, 0.25, 80);
light2.position.set(0, 25, 25);
scene.add(light2);

const light3 = new THREE.PointLight(0xffffff, 0.25, 80);
light3.position.set(0, 25, 38);
scene.add(light3);

// Soft fill light from sides
const fillLeft = new THREE.PointLight(0xf8f8ff, 0.2, 40);
fillLeft.position.set(-8, 8, SHEET_LENGTH / 2);
scene.add(fillLeft);

const fillRight = new THREE.PointLight(0xf8f8ff, 0.2, 40);
fillRight.position.set(8, 8, SHEET_LENGTH / 2);
scene.add(fillRight);

// Hemisphere light for realistic ambient
const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe0e0e0, 0.3);
scene.add(hemiLight);

// ============================================
// ARENA / SPECTATOR STANDS
// ============================================
let arenaGroup = null;  // Group to hold all arena elements for easy updates

// Create a more realistic seated spectator with rounded shapes and facial features
function createSpectator() {
  const group = new THREE.Group();

  // Random colors for clothing
  const shirtColors = [0x3b82f6, 0xef4444, 0x22c55e, 0xf59e0b, 0x8b5cf6, 0xec4899, 0x06b6d4, 0xf97316, 0x1e40af, 0x991b1b];
  const pantsColors = [0x1f2937, 0x374151, 0x4b5563, 0x1e3a5f, 0x3d2914];
  const skinTones = [0xf5d0c5, 0xd4a373, 0x8b5a2b, 0xf8d9c0, 0xc68642, 0xe8beac];
  const hairColors = [0x2c1810, 0x4a3728, 0x8b4513, 0xd4a574, 0x1a1a1a, 0x808080, 0xffd700];

  const shirtColor = shirtColors[Math.floor(Math.random() * shirtColors.length)];
  const pantsColor = pantsColors[Math.floor(Math.random() * pantsColors.length)];
  const skinColor = skinTones[Math.floor(Math.random() * skinTones.length)];
  const hairColor = hairColors[Math.floor(Math.random() * hairColors.length)];

  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.9 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x222222 });

  // Torso (capsule-like using sphere + cylinder + sphere)
  const torsoMidGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.22, 12);
  const torsoMid = new THREE.Mesh(torsoMidGeo, shirtMat);
  torsoMid.position.set(0, 0.45, 0);
  group.add(torsoMid);

  // Shoulders (rounded top)
  const shoulderGeo = new THREE.SphereGeometry(0.12, 12, 8);
  const shoulders = new THREE.Mesh(shoulderGeo, shirtMat);
  shoulders.position.set(0, 0.56, 0);
  shoulders.scale.set(1.1, 0.5, 0.9);
  group.add(shoulders);

  // Head (slightly oval)
  const headGeo = new THREE.SphereGeometry(0.1, 16, 14);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.set(0, 0.75, 0);
  head.scale.set(1, 1.1, 0.95);
  group.add(head);

  // Face features
  // Eyes
  const eyeGeo = new THREE.SphereGeometry(0.018, 8, 8);
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.035, 0.77, -0.085);
  group.add(leftEye);

  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.035, 0.77, -0.085);
  group.add(rightEye);

  // Nose (small bump)
  const noseGeo = new THREE.SphereGeometry(0.015, 8, 6);
  const nose = new THREE.Mesh(noseGeo, skinMat);
  nose.position.set(0, 0.73, -0.095);
  group.add(nose);

  // Hair or cap
  const hasHat = Math.random() > 0.7;
  if (hasHat) {
    // Baseball cap
    const capGeo = new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const capMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(0, 0.78, 0);
    group.add(cap);
    // Brim
    const brimGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.02, 12, 1, false, -Math.PI/3, Math.PI * 2/3);
    const brim = new THREE.Mesh(brimGeo, capMat);
    brim.position.set(0, 0.76, -0.08);
    brim.rotation.x = -0.3;
    group.add(brim);
  } else {
    // Hair (fuller, covers more of head)
    const hairGeo = new THREE.SphereGeometry(0.105, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 0.77, 0.01);
    group.add(hair);
  }

  // Arms (rounded, capsule-like)
  const upperArmGeo = new THREE.CapsuleGeometry(0.03, 0.12, 4, 8);
  const forearmGeo = new THREE.CapsuleGeometry(0.025, 0.1, 4, 8);
  const armPose = Math.random();

  // Left upper arm
  const leftUpperArm = new THREE.Mesh(upperArmGeo, shirtMat);
  leftUpperArm.position.set(-0.16, 0.48, 0);
  leftUpperArm.rotation.z = 0.4;
  group.add(leftUpperArm);

  // Left forearm
  const leftForearm = new THREE.Mesh(forearmGeo, skinMat);
  if (armPose > 0.85) {
    // Raised
    leftForearm.position.set(-0.22, 0.62, 0);
    leftForearm.rotation.z = 0.2;
  } else {
    // Resting
    leftForearm.position.set(-0.18, 0.32, -0.06);
    leftForearm.rotation.x = 1.2;
    leftForearm.rotation.z = 0.3;
  }
  group.add(leftForearm);

  // Right upper arm
  const rightUpperArm = new THREE.Mesh(upperArmGeo, shirtMat);
  rightUpperArm.position.set(0.16, 0.48, 0);
  rightUpperArm.rotation.z = -0.4;
  group.add(rightUpperArm);

  // Right forearm
  const rightForearm = new THREE.Mesh(forearmGeo, skinMat);
  if (armPose > 0.9) {
    // Raised
    rightForearm.position.set(0.22, 0.62, 0);
    rightForearm.rotation.z = -0.2;
  } else {
    // Resting
    rightForearm.position.set(0.18, 0.32, -0.06);
    rightForearm.rotation.x = 1.2;
    rightForearm.rotation.z = -0.3;
  }
  group.add(rightForearm);

  // Thighs (capsule for roundness)
  const thighGeo = new THREE.CapsuleGeometry(0.045, 0.15, 4, 8);

  const leftThigh = new THREE.Mesh(thighGeo, pantsMat);
  leftThigh.position.set(-0.07, 0.22, -0.1);
  leftThigh.rotation.x = Math.PI / 2.2;
  group.add(leftThigh);

  const rightThigh = new THREE.Mesh(thighGeo, pantsMat);
  rightThigh.position.set(0.07, 0.22, -0.1);
  rightThigh.rotation.x = Math.PI / 2.2;
  group.add(rightThigh);

  // Lower legs
  const shinGeo = new THREE.CapsuleGeometry(0.035, 0.12, 4, 8);

  const leftShin = new THREE.Mesh(shinGeo, pantsMat);
  leftShin.position.set(-0.07, 0.05, -0.22);
  leftShin.rotation.x = 0.15;
  group.add(leftShin);

  const rightShin = new THREE.Mesh(shinGeo, pantsMat);
  rightShin.position.set(0.07, 0.05, -0.22);
  rightShin.rotation.x = 0.15;
  group.add(rightShin);

  // Slight random lean for natural look
  group.rotation.x = (Math.random() - 0.5) * 0.15;

  return group;
}

function createArena(level = 1) {
  // Remove existing arena if present
  if (arenaGroup) {
    scene.remove(arenaGroup);
    arenaGroup = null;
  }

  arenaGroup = new THREE.Group();

  // Arena configuration based on level
  // Level 1 (Club): Handful of spectators, small venue
  // Level 8 (Olympics): Packed house, full arena
  // Rows kept low for performance (max 4)
  const arenaConfig = {
    1: { rows: 1, fillPercent: 0.10, standHeight: 2, bgColor: 0x1a1a2e, name: 'Club' },
    2: { rows: 2, fillPercent: 0.25, standHeight: 2.5, bgColor: 0x1a1a2e, name: 'Regional' },
    3: { rows: 2, fillPercent: 0.40, standHeight: 3, bgColor: 0x16213e, name: 'Provincial' },
    4: { rows: 3, fillPercent: 0.55, standHeight: 3.5, bgColor: 0x16213e, name: 'National' },
    5: { rows: 3, fillPercent: 0.70, standHeight: 4, bgColor: 0x0f3460, name: 'International' },
    6: { rows: 4, fillPercent: 0.80, standHeight: 5, bgColor: 0x0f3460, name: 'World' },
    7: { rows: 4, fillPercent: 0.90, standHeight: 6, bgColor: 0x1a1a4e, name: 'Trials' },
    8: { rows: 4, fillPercent: 1.00, standHeight: 7, bgColor: 0x1a1a4e, name: 'Olympics' }
  };

  const config = arenaConfig[level] || arenaConfig[1];

  // Update scene background
  scene.background = new THREE.Color(config.bgColor);
  scene.fog = new THREE.Fog(config.bgColor, 30, 70);

  // Stand dimensions
  const standLength = SHEET_LENGTH + 10;
  const surroundWidth = 3;  // Must match the blue surround width
  const standOffset = SHEET_WIDTH / 2 + surroundWidth + 1.5;  // Distance from ice edge (after blue surround + draping)
  const rowDepth = 1.2;
  const rowHeight = 0.8;

  // Create stands on both sides
  [-1, 1].forEach(side => {
    for (let row = 0; row < config.rows; row++) {
      const xPos = side * (standOffset + row * rowDepth);
      const yPos = row * rowHeight + 0.5;

      // Stand platform (bleacher row)
      const standGeometry = new THREE.BoxGeometry(rowDepth - 0.1, 0.3, standLength);
      const standMaterial = new THREE.MeshStandardMaterial({
        color: 0x2d2d3d,
        roughness: 0.8
      });
      const stand = new THREE.Mesh(standGeometry, standMaterial);
      stand.position.set(xPos, yPos, SHEET_LENGTH / 2);
      stand.receiveShadow = true;
      arenaGroup.add(stand);

      // Add spectators to this row
      const spectatorSpacing = 0.45;  // Balanced spacing for performance
      const spectatorsPerRow = Math.floor(standLength / spectatorSpacing);

      for (let i = 0; i < spectatorsPerRow; i++) {
        // Random chance to place spectator based on fill percent
        if (Math.random() > config.fillPercent) continue;

        const zPos = (i - spectatorsPerRow / 2) * spectatorSpacing + SHEET_LENGTH / 2;

        // Create realistic spectator
        const spectator = createSpectator();
        spectator.position.set(xPos, yPos, zPos);
        // Face toward the ice (side stands face inward)
        // Right side (positive X) needs to face -X (toward ice): rotate +90°
        // Left side (negative X) needs to face +X (toward ice): rotate -90°
        spectator.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        spectator.rotation.y += (Math.random() - 0.5) * 0.2;  // Slight variation

        arenaGroup.add(spectator);
      }
    }
  });

  // Back wall behind far house (for higher levels, add more seating)
  if (level >= 4) {
    const backRows = Math.min(level - 2, 5);
    for (let row = 0; row < backRows; row++) {
      const zPos = SHEET_LENGTH + surroundWidth + 2 + row * rowDepth;  // After blue surround and draping
      const yPos = row * rowHeight + 0.5;

      // Stand platform
      const standGeometry = new THREE.BoxGeometry(SHEET_WIDTH + 8, 0.3, rowDepth - 0.1);
      const standMaterial = new THREE.MeshStandardMaterial({
        color: 0x2d2d3d,
        roughness: 0.8
      });
      const stand = new THREE.Mesh(standGeometry, standMaterial);
      stand.position.set(0, yPos, zPos);
      stand.receiveShadow = true;
      arenaGroup.add(stand);

      // Spectators
      const spectatorSpacing = 0.45;  // Balanced spacing for performance
      const spectatorsPerRow = Math.floor((SHEET_WIDTH + 6) / spectatorSpacing);

      for (let i = 0; i < spectatorsPerRow; i++) {
        if (Math.random() > config.fillPercent) continue;

        const xPos = (i - spectatorsPerRow / 2) * spectatorSpacing;

        // Create realistic spectator
        const spectator = createSpectator();
        spectator.position.set(xPos, yPos, zPos);
        // Face the ice (back stands face toward near end)
        spectator.rotation.y = Math.PI + (Math.random() - 0.5) * 0.2;

        arenaGroup.add(spectator);
      }
    }
  }

  // Add arena lights for bigger venues (level 5+)
  if (level >= 5) {
    const lightPositions = [
      { x: -8, z: 15 }, { x: 8, z: 15 },
      { x: -8, z: 30 }, { x: 8, z: 30 }
    ];

    if (level >= 7) {
      lightPositions.push({ x: 0, z: 10 }, { x: 0, z: 35 });
    }

    lightPositions.forEach(pos => {
      // Light fixture
      const fixtureGeometry = new THREE.BoxGeometry(1.5, 0.3, 1.5);
      const fixtureMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.5
      });
      const fixture = new THREE.Mesh(fixtureGeometry, fixtureMaterial);
      fixture.position.set(pos.x, 15, pos.z);
      arenaGroup.add(fixture);

      // Glowing light panel
      const panelGeometry = new THREE.PlaneGeometry(1.2, 1.2);
      const panelMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffee,
        transparent: true,
        opacity: 0.8
      });
      const panel = new THREE.Mesh(panelGeometry, panelMaterial);
      panel.rotation.x = Math.PI / 2;
      panel.position.set(pos.x, 14.8, pos.z);
      arenaGroup.add(panel);
    });
  }

  // Level-specific championship symbols (levels 2-8)
  if (level >= 2) {
    const symbolGroup = new THREE.Group();

    // Helper function to create a 5-pointed star shape
    function createStarShape(outerRadius, innerRadius) {
      const shape = new THREE.Shape();
      const points = 5;
      for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i * Math.PI) / points - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
      shape.closePath();
      return shape;
    }

    // Helper function to create a star mesh
    function createStar(color, size = 0.5) {
      const starShape = createStarShape(size, size * 0.4);
      const geometry = new THREE.ExtrudeGeometry(starShape, { depth: 0.1, bevelEnabled: false });
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.7 });
      return new THREE.Mesh(geometry, material);
    }

    const bronze = 0xCD7F32;
    const silver = 0xC0C0C0;
    const gold = 0xFFD700;

    if (level === 2) {
      // Regional: 1 bronze star
      const star = createStar(bronze, 0.8);
      symbolGroup.add(star);
    } else if (level === 3) {
      // Provincial: 2 silver stars
      [-0.9, 0.9].forEach(x => {
        const star = createStar(silver, 0.7);
        star.position.x = x;
        symbolGroup.add(star);
      });
    } else if (level === 4) {
      // National: 3 gold stars
      [-1.2, 0, 1.2].forEach(x => {
        const star = createStar(gold, 0.7);
        star.position.x = x;
        symbolGroup.add(star);
      });
    } else if (level === 5) {
      // International: Globe
      const globeGeometry = new THREE.SphereGeometry(1, 32, 32);
      const globeMaterial = new THREE.MeshStandardMaterial({
        color: 0x4169E1, roughness: 0.5, metalness: 0.3
      });
      const globe = new THREE.Mesh(globeGeometry, globeMaterial);
      symbolGroup.add(globe);

      // Add latitude/longitude lines
      const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
      // Equator
      const equatorGeometry = new THREE.TorusGeometry(1.02, 0.02, 8, 64);
      const equator = new THREE.Mesh(equatorGeometry, lineMaterial);
      equator.rotation.x = Math.PI / 2;
      symbolGroup.add(equator);
      // Prime meridian
      const meridianGeometry = new THREE.TorusGeometry(1.02, 0.02, 8, 64);
      const meridian = new THREE.Mesh(meridianGeometry, lineMaterial);
      symbolGroup.add(meridian);
    } else if (level === 6) {
      // World Championship: Laurel wreath
      const leafMaterial = new THREE.MeshStandardMaterial({
        color: 0x228B22, roughness: 0.6, metalness: 0.2
      });
      const leafCount = 12;

      // Left branch
      for (let i = 0; i < leafCount; i++) {
        const angle = (i / leafCount) * Math.PI * 0.7 + Math.PI * 0.15;
        const leafGeometry = new THREE.SphereGeometry(0.15, 8, 8);
        leafGeometry.scale(1, 2, 0.3);
        const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
        leaf.position.x = -Math.cos(angle) * 1.2;
        leaf.position.y = Math.sin(angle) * 1.2 - 0.3;
        leaf.rotation.z = angle - Math.PI / 2;
        symbolGroup.add(leaf);
      }
      // Right branch (mirror)
      for (let i = 0; i < leafCount; i++) {
        const angle = (i / leafCount) * Math.PI * 0.7 + Math.PI * 0.15;
        const leafGeometry = new THREE.SphereGeometry(0.15, 8, 8);
        leafGeometry.scale(1, 2, 0.3);
        const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
        leaf.position.x = Math.cos(angle) * 1.2;
        leaf.position.y = Math.sin(angle) * 1.2 - 0.3;
        leaf.rotation.z = -angle + Math.PI / 2;
        symbolGroup.add(leaf);
      }
      // Gold ribbon at bottom
      const ribbonGeometry = new THREE.TorusGeometry(0.3, 0.08, 8, 16, Math.PI);
      const ribbonMaterial = new THREE.MeshStandardMaterial({ color: gold, metalness: 0.7 });
      const ribbon = new THREE.Mesh(ribbonGeometry, ribbonMaterial);
      ribbon.position.y = -1.1;
      ribbon.rotation.z = Math.PI;
      symbolGroup.add(ribbon);
    } else if (level === 7) {
      // Trials: Crown
      const crownMaterial = new THREE.MeshStandardMaterial({
        color: gold, roughness: 0.3, metalness: 0.8
      });
      // Crown base (ring)
      const baseGeometry = new THREE.TorusGeometry(0.8, 0.15, 16, 32);
      const base = new THREE.Mesh(baseGeometry, crownMaterial);
      base.rotation.x = Math.PI / 2;
      base.position.y = -0.3;
      symbolGroup.add(base);
      // Crown points
      const pointCount = 5;
      for (let i = 0; i < pointCount; i++) {
        const angle = (i / pointCount) * Math.PI * 2;
        const pointGeometry = new THREE.ConeGeometry(0.2, 0.8, 4);
        const point = new THREE.Mesh(pointGeometry, crownMaterial);
        point.position.x = Math.cos(angle) * 0.7;
        point.position.z = Math.sin(angle) * 0.7;
        point.position.y = 0.2;
        symbolGroup.add(point);
        // Jewel on each point
        const jewelGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const jewelMaterial = new THREE.MeshStandardMaterial({
          color: i % 2 === 0 ? 0xFF0000 : 0x0000FF, roughness: 0.2, metalness: 0.5
        });
        const jewel = new THREE.Mesh(jewelGeometry, jewelMaterial);
        jewel.position.copy(point.position);
        jewel.position.y += 0.45;
        symbolGroup.add(jewel);
      }
    } else if (level === 8) {
      // Championship: Golden curling stone with radiating stars
      // Golden stone
      const stoneGeometry = new THREE.CylinderGeometry(0.6, 0.7, 0.5, 32);
      const stoneMaterial = new THREE.MeshStandardMaterial({
        color: gold, roughness: 0.2, metalness: 0.9
      });
      const stone = new THREE.Mesh(stoneGeometry, stoneMaterial);
      symbolGroup.add(stone);
      // Handle
      const handleGeometry = new THREE.TorusGeometry(0.25, 0.06, 8, 16, Math.PI);
      const handle = new THREE.Mesh(handleGeometry, stoneMaterial);
      handle.position.y = 0.35;
      handle.rotation.x = Math.PI / 2;
      symbolGroup.add(handle);
      // Radiating stars around the stone
      const starCount = 8;
      for (let i = 0; i < starCount; i++) {
        const angle = (i / starCount) * Math.PI * 2;
        const star = createStar(0xFFFFFF, 0.25);
        star.position.x = Math.cos(angle) * 1.5;
        star.position.y = Math.sin(angle) * 1.5;
        symbolGroup.add(star);
      }
      // Larger corner stars
      [[-1.8, 1.8], [1.8, 1.8], [-1.8, -1.8], [1.8, -1.8]].forEach(([x, y]) => {
        const star = createStar(gold, 0.35);
        star.position.x = x;
        star.position.y = y;
        symbolGroup.add(star);
      });

      // National flags of major curling nations along the arena walls
      const flagWidth = 3;
      const flagHeight = 2;
      const flagDepth = 0.05;

      // Helper to create a flag with colored sections
      function createFlag(design) {
        const flagGroup = new THREE.Group();
        design.forEach(section => {
          const geometry = new THREE.BoxGeometry(
            section.w * flagWidth,
            section.h * flagHeight,
            flagDepth
          );
          const material = new THREE.MeshStandardMaterial({
            color: section.color, roughness: 0.5
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(
            (section.x - 0.5) * flagWidth,
            (section.y - 0.5) * flagHeight,
            section.z || 0
          );
          flagGroup.add(mesh);
        });
        return flagGroup;
      }

      // Accurate flag designs for major curling nations
      // Using proper proportions and official colors

      // Helper to create diagonal stripe for saltire flags
      function createDiagonalStripe(width, height, color, angle) {
        const stripeGroup = new THREE.Group();
        const stripeLength = Math.sqrt(width * width + height * height);
        const geometry = new THREE.BoxGeometry(stripeLength, height * 0.14, flagDepth);
        const material = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
        const stripe = new THREE.Mesh(geometry, material);
        stripe.rotation.z = angle;
        stripeGroup.add(stripe);
        return stripeGroup;
      }

      const flags = [
        // 0: Canada - Red (1/4) White (1/2) Red (1/4) with maple leaf implied
        { name: 'Canada', design: [
          { x: 0.125, y: 0.5, w: 0.25, h: 1, color: 0xFF0000 },
          { x: 0.5, y: 0.5, w: 0.5, h: 1, color: 0xFFFFFF },
          { x: 0.875, y: 0.5, w: 0.25, h: 1, color: 0xFF0000 }
        ]},
        // 1: Sweden - Blue with yellow Nordic cross (offset left)
        { name: 'Sweden', design: [
          { x: 0.5, y: 0.5, w: 1, h: 1, color: 0x006AA7 },
          { x: 0.36, y: 0.5, w: 0.10, h: 1, color: 0xFECC00, z: 0.01 },
          { x: 0.5, y: 0.5, w: 1, h: 0.10, color: 0xFECC00, z: 0.01 }
        ]},
        // 2: Switzerland - Red with white cross (Swiss cross is 7:6 ratio arms)
        { name: 'Switzerland', design: [
          { x: 0.5, y: 0.5, w: 1, h: 1, color: 0xDA291C },
          { x: 0.5, y: 0.5, w: 0.15, h: 0.5, color: 0xFFFFFF, z: 0.01 },
          { x: 0.5, y: 0.5, w: 0.5, h: 0.15, color: 0xFFFFFF, z: 0.01 }
        ]},
        // 3: Norway - Red with blue-bordered white Nordic cross
        { name: 'Norway', design: [
          { x: 0.5, y: 0.5, w: 1, h: 1, color: 0xBA0C2F },
          { x: 0.36, y: 0.5, w: 0.16, h: 1, color: 0xFFFFFF, z: 0.01 },
          { x: 0.5, y: 0.5, w: 1, h: 0.16, color: 0xFFFFFF, z: 0.01 },
          { x: 0.36, y: 0.5, w: 0.08, h: 1, color: 0x00205B, z: 0.02 },
          { x: 0.5, y: 0.5, w: 1, h: 0.08, color: 0x00205B, z: 0.02 }
        ]},
        // 4: Scotland - Blue with white saltire (diagonal cross)
        { name: 'Scotland', design: [
          { x: 0.5, y: 0.5, w: 1, h: 1, color: 0x0065BD }
        ], saltire: true, saltireColor: 0xFFFFFF },
        // 5: Japan - White with red circle (Hinomaru)
        { name: 'Japan', design: [
          { x: 0.5, y: 0.5, w: 1, h: 1, color: 0xFFFFFF }
        ], circle: { color: 0xBC002D, radius: 0.3 }},
        // 6: South Korea - White with red/blue taeguk
        { name: 'SouthKorea', design: [
          { x: 0.5, y: 0.5, w: 1, h: 1, color: 0xFFFFFF }
        ], taeguk: true },
        // 7: USA - 13 stripes (7 red, 6 white) with blue canton
        { name: 'USA', design: (() => {
          const stripes = [];
          for (let i = 0; i < 13; i++) {
            stripes.push({
              x: 0.5,
              y: (i + 0.5) / 13,
              w: 1,
              h: 1/13,
              color: i % 2 === 0 ? 0xB31942 : 0xFFFFFF
            });
          }
          // Blue canton (covers top 7 stripes, left 40%)
          stripes.push({ x: 0.2, y: 0.73, w: 0.4, h: 7/13, color: 0x0A3161, z: 0.01 });
          return stripes;
        })()}
      ];

      // Position flags - 4 on each wall, no duplicates
      const flagSpacing = 8;
      const wallX = SHEET_WIDTH / 2 + surroundWidth + 1;
      const startZ = SHEET_LENGTH * 0.2;

      flags.forEach((flagData, i) => {
        const flag = createFlag(flagData.design);
        const isLeftWall = i < 4;
        const wallIndex = i % 4;
        const zPos = startZ + wallIndex * flagSpacing;
        const xPos = isLeftWall ? -wallX : wallX;
        const rotY = isLeftWall ? Math.PI / 2 : -Math.PI / 2;

        flag.position.set(xPos, 8, zPos);
        flag.rotation.y = rotY;
        arenaGroup.add(flag);

        // Add saltire (diagonal cross) for Scotland
        if (flagData.saltire) {
          const angle1 = Math.atan2(flagHeight, flagWidth);
          const angle2 = -angle1;
          const stripe1 = createDiagonalStripe(flagWidth, flagHeight, flagData.saltireColor, angle1);
          const stripe2 = createDiagonalStripe(flagWidth, flagHeight, flagData.saltireColor, angle2);
          stripe1.position.set(xPos + (isLeftWall ? 0.05 : -0.05), 8, zPos);
          stripe2.position.set(xPos + (isLeftWall ? 0.05 : -0.05), 8, zPos);
          stripe1.rotation.y = rotY;
          stripe2.rotation.y = rotY;
          arenaGroup.add(stripe1);
          arenaGroup.add(stripe2);
        }

        // Add circle for Japan
        if (flagData.circle) {
          const circleGeom = new THREE.CircleGeometry(flagHeight * flagData.circle.radius, 32);
          const circleMat = new THREE.MeshStandardMaterial({ color: flagData.circle.color, roughness: 0.5 });
          const circle = new THREE.Mesh(circleGeom, circleMat);
          circle.position.set(xPos + (isLeftWall ? 0.05 : -0.05), 8, zPos);
          circle.rotation.y = rotY;
          arenaGroup.add(circle);
        }

        // Add taeguk for South Korea
        if (flagData.taeguk) {
          const taegukRadius = flagHeight * 0.25;
          // Red top half
          const redGeom = new THREE.CircleGeometry(taegukRadius, 32, 0, Math.PI);
          const redMat = new THREE.MeshStandardMaterial({ color: 0xC60C30, roughness: 0.5 });
          const redHalf = new THREE.Mesh(redGeom, redMat);
          redHalf.position.set(xPos + (isLeftWall ? 0.05 : -0.05), 8, zPos);
          redHalf.rotation.y = rotY;
          redHalf.rotation.z = Math.PI / 2;
          arenaGroup.add(redHalf);
          // Blue bottom half
          const blueGeom = new THREE.CircleGeometry(taegukRadius, 32, Math.PI, Math.PI);
          const blueMat = new THREE.MeshStandardMaterial({ color: 0x003478, roughness: 0.5 });
          const blueHalf = new THREE.Mesh(blueGeom, blueMat);
          blueHalf.position.set(xPos + (isLeftWall ? 0.05 : -0.05), 8, zPos);
          blueHalf.rotation.y = rotY;
          blueHalf.rotation.z = Math.PI / 2;
          arenaGroup.add(blueHalf);
          // Small inner circles for yin-yang effect
          const smallRed = new THREE.Mesh(
            new THREE.CircleGeometry(taegukRadius * 0.25, 16),
            redMat
          );
          smallRed.position.set(xPos + (isLeftWall ? 0.06 : -0.06), 8 - taegukRadius * 0.5, zPos);
          smallRed.rotation.y = rotY;
          arenaGroup.add(smallRed);
          const smallBlue = new THREE.Mesh(
            new THREE.CircleGeometry(taegukRadius * 0.25, 16),
            blueMat
          );
          smallBlue.position.set(xPos + (isLeftWall ? 0.06 : -0.06), 8 + taegukRadius * 0.5, zPos);
          smallBlue.rotation.y = rotY;
          arenaGroup.add(smallBlue);
        }
      });
    }

    // Position on back wall above stands
    symbolGroup.position.set(0, 12, SHEET_LENGTH + surroundWidth + 5);
    symbolGroup.rotation.x = -0.2;
    symbolGroup.scale.set(2, 2, 2);
    arenaGroup.add(symbolGroup);

    // Add symbol on ice for levels 5+ (more prestigious levels)
    if (level >= 5) {
      const iceSymbol = symbolGroup.clone();
      iceSymbol.position.set(0, 0.05, SHEET_LENGTH / 2);
      iceSymbol.rotation.x = -Math.PI / 2;
      iceSymbol.scale.set(0.4, 0.4, 0.1);
      // Make ice version semi-transparent
      iceSymbol.traverse(child => {
        if (child.isMesh) {
          child.material = child.material.clone();
          child.material.transparent = true;
          child.material.opacity = 0.4;
        }
      });
      arenaGroup.add(iceSymbol);
    }
  }

  // ========== BLUE SURROUND (authentic curling arena style) ==========
  // surroundWidth already defined above (3m)
  const blueSurroundMaterial = new THREE.MeshStandardMaterial({
    color: 0x1e4d8c,  // Curling blue
    roughness: 0.7
  });

  // Blue floor surrounding the ice
  // Left side
  const leftSurroundGeo = new THREE.BoxGeometry(surroundWidth, 0.02, SHEET_LENGTH + 6);
  const leftSurround = new THREE.Mesh(leftSurroundGeo, blueSurroundMaterial);
  leftSurround.position.set(-(SHEET_WIDTH / 2 + surroundWidth / 2), 0.01, SHEET_LENGTH / 2);
  leftSurround.receiveShadow = true;
  arenaGroup.add(leftSurround);

  // Right side
  const rightSurround = new THREE.Mesh(leftSurroundGeo, blueSurroundMaterial);
  rightSurround.position.set(SHEET_WIDTH / 2 + surroundWidth / 2, 0.01, SHEET_LENGTH / 2);
  rightSurround.receiveShadow = true;
  arenaGroup.add(rightSurround);

  // Back (behind far house)
  const backSurroundGeo = new THREE.BoxGeometry(SHEET_WIDTH + surroundWidth * 2, 0.02, surroundWidth);
  const backSurround = new THREE.Mesh(backSurroundGeo, blueSurroundMaterial);
  backSurround.position.set(0, 0.01, SHEET_LENGTH + surroundWidth / 2);
  backSurround.receiveShadow = true;
  arenaGroup.add(backSurround);

  // Front (behind hack)
  const frontSurroundGeo = new THREE.BoxGeometry(SHEET_WIDTH + surroundWidth * 2, 0.02, surroundWidth);
  const frontSurround = new THREE.Mesh(frontSurroundGeo, blueSurroundMaterial);
  frontSurround.position.set(0, 0.01, -surroundWidth / 2);
  frontSurround.receiveShadow = true;
  arenaGroup.add(frontSurround);


  // ========== BLACK DRAPING WITH SPONSOR BANNERS ==========
  const drapeMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.9
  });
  const bannerMaterial = new THREE.MeshBasicMaterial({
    color: 0x1a4d8c  // Blue sponsor banner
  });

  // Draping along sides (between blue surround and seating)
  const drapeHeight = 0.9;
  [-1, 1].forEach(side => {
    // Main drape
    const drapeGeo = new THREE.BoxGeometry(0.1, drapeHeight, SHEET_LENGTH + 4);
    const drape = new THREE.Mesh(drapeGeo, drapeMaterial);
    drape.position.set(side * (SHEET_WIDTH / 2 + surroundWidth + 0.05), drapeHeight / 2, SHEET_LENGTH / 2);
    arenaGroup.add(drape);

    // Sponsor banner panels on drape
    for (let i = 0; i < 5; i++) {
      const bannerGeo = new THREE.PlaneGeometry(0.08, 0.5);
      const banner = new THREE.Mesh(bannerGeo, bannerMaterial);
      const zPos = 4 + i * 9;
      banner.position.set(
        side * (SHEET_WIDTH / 2 + surroundWidth + 0.11),
        0.5,
        zPos
      );
      banner.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      arenaGroup.add(banner);

      // White text area on banner
      const textGeo = new THREE.PlaneGeometry(0.06, 0.15);
      const textMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const text = new THREE.Mesh(textGeo, textMat);
      text.position.set(
        side * (SHEET_WIDTH / 2 + surroundWidth + 0.115),
        0.5,
        zPos
      );
      text.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      arenaGroup.add(text);
    }
  });

  // Back draping
  const backDrapeGeo = new THREE.BoxGeometry(SHEET_WIDTH + surroundWidth * 2, drapeHeight, 0.1);
  const backDrape = new THREE.Mesh(backDrapeGeo, drapeMaterial);
  backDrape.position.set(0, drapeHeight / 2, SHEET_LENGTH + surroundWidth + 0.5);
  arenaGroup.add(backDrape);

  // ========== CEILING STRUCTURE (for level 3+) ==========
  if (level >= 3) {
    const ceilingHeight = 12 + level;
    const beamMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      roughness: 0.6,
      metalness: 0.3
    });

    // Main longitudinal beams
    [-6, 0, 6].forEach(xPos => {
      const beamGeo = new THREE.BoxGeometry(0.4, 0.6, SHEET_LENGTH + 20);
      const beam = new THREE.Mesh(beamGeo, beamMaterial);
      beam.position.set(xPos, ceilingHeight, SHEET_LENGTH / 2);
      arenaGroup.add(beam);
    });

    // Cross beams
    for (let z = 0; z < SHEET_LENGTH + 10; z += 8) {
      const crossBeamGeo = new THREE.BoxGeometry(16, 0.4, 0.4);
      const crossBeam = new THREE.Mesh(crossBeamGeo, beamMaterial);
      crossBeam.position.set(0, ceilingHeight - 0.5, z);
      arenaGroup.add(crossBeam);
    }

    // Diagonal support trusses (for level 5+)
    if (level >= 5) {
      const trussMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.5,
        metalness: 0.4
      });

      for (let z = 4; z < SHEET_LENGTH + 10; z += 16) {
        [-5, 5].forEach(xPos => {
          // Vertical supports
          const vertGeo = new THREE.CylinderGeometry(0.1, 0.1, ceilingHeight - 5, 8);
          const vert = new THREE.Mesh(vertGeo, trussMaterial);
          vert.position.set(xPos, (ceilingHeight - 5) / 2 + 5, z);
          arenaGroup.add(vert);
        });
      }
    }
  }

  // ========== IMPROVED BLEACHERS WITH RISERS ==========
  // Add vertical risers between rows for more realistic bleacher look
  const riserMaterial = new THREE.MeshStandardMaterial({
    color: 0x252535,
    roughness: 0.9
  });

  [-1, 1].forEach(side => {
    for (let row = 0; row < config.rows; row++) {
      const xPos = side * (standOffset + row * rowDepth);
      const yPos = row * rowHeight;

      // Vertical riser (front face of each step)
      if (row > 0) {
        const riserGeo = new THREE.BoxGeometry(rowDepth - 0.1, rowHeight - 0.3, standLength);
        const riser = new THREE.Mesh(riserGeo, riserMaterial);
        riser.position.set(xPos, yPos + 0.15, SHEET_LENGTH / 2);
        arenaGroup.add(riser);
      }
    }
  });

  // ========== RAILINGS ==========
  if (level >= 2) {
    const railMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.3,
      metalness: 0.6
    });

    // Front railing (between walkway and first row)
    [-1, 1].forEach(side => {
      const railX = side * (standOffset - rowDepth / 2 - 0.1);

      // Horizontal rail
      const railGeo = new THREE.CylinderGeometry(0.03, 0.03, standLength, 8);
      const rail = new THREE.Mesh(railGeo, railMaterial);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(railX, 0.9, SHEET_LENGTH / 2);
      arenaGroup.add(rail);

      // Vertical posts
      for (let z = 2; z < SHEET_LENGTH; z += 4) {
        const postGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.9, 8);
        const post = new THREE.Mesh(postGeo, railMaterial);
        post.position.set(railX, 0.45, z);
        arenaGroup.add(post);
      }
    });
  }

  // ========== SCOREBOARD (for level 4+) ==========
  if (level >= 4) {
    const scoreboardHeight = level >= 6 ? 14 : 11;

    // Main scoreboard housing
    const sbHousingGeo = new THREE.BoxGeometry(4, 1.5, 2);
    const sbHousingMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.7
    });
    const sbHousing = new THREE.Mesh(sbHousingGeo, sbHousingMat);
    sbHousing.position.set(0, scoreboardHeight, SHEET_LENGTH / 2);
    arenaGroup.add(sbHousing);

    // Display screen (front)
    const sbScreenGeo = new THREE.PlaneGeometry(3.6, 1.2);
    const sbScreenMat = new THREE.MeshBasicMaterial({
      color: 0x001133
    });
    const sbScreen = new THREE.Mesh(sbScreenGeo, sbScreenMat);
    sbScreen.position.set(0, scoreboardHeight, SHEET_LENGTH / 2 - 1.01);
    arenaGroup.add(sbScreen);

    // Display screen (back)
    const sbScreenBack = new THREE.Mesh(sbScreenGeo, sbScreenMat);
    sbScreenBack.position.set(0, scoreboardHeight, SHEET_LENGTH / 2 + 1.01);
    sbScreenBack.rotation.y = Math.PI;
    arenaGroup.add(sbScreenBack);

    // Hanging cables
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    [-1.5, 1.5].forEach(xOff => {
      const cableGeo = new THREE.CylinderGeometry(0.03, 0.03, 6, 8);
      const cable = new THREE.Mesh(cableGeo, cableMat);
      cable.position.set(xOff, scoreboardHeight + 3.75, SHEET_LENGTH / 2);
      arenaGroup.add(cable);
    });
  }

  scene.add(arenaGroup);
}

// Update arena when career level changes
function updateArenaForLevel() {
  // Use career level for Career mode, quickPlayLevel for Quick Play
  const level = gameState.selectedMode === 'career'
    ? gameState.career.level
    : gameState.settings.quickPlayLevel;
  createArena(level);
}

// ============================================
// MATTER.JS PHYSICS SETUP
// ============================================
const engine = Matter.Engine.create();
engine.gravity.y = 0; // Top-down, no gravity
const world = engine.world;

// Track side walls for collision detection
let leftWall, rightWall;

// ============================================
// CREATE CURLING SHEET
// ============================================
function createSheet() {
  // Ice surface - bright white with realistic reflections
  const iceGeometry = new THREE.PlaneGeometry(SHEET_WIDTH, SHEET_LENGTH);

  // Create ice texture with realistic appearance
  const iceCanvas = document.createElement('canvas');
  iceCanvas.width = 512;
  iceCanvas.height = 4096;  // Longer for full sheet detail
  const iceCtx = iceCanvas.getContext('2d');

  // Base bright white ice color
  iceCtx.fillStyle = '#ffffff';
  iceCtx.fillRect(0, 0, iceCanvas.width, iceCanvas.height);

  // Add very subtle cool tint variation
  const baseGradient = iceCtx.createLinearGradient(0, 0, 0, iceCanvas.height);
  baseGradient.addColorStop(0, 'rgba(240, 248, 255, 0.15)');
  baseGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
  baseGradient.addColorStop(1, 'rgba(240, 248, 255, 0.1)');
  iceCtx.fillStyle = baseGradient;
  iceCtx.fillRect(0, 0, iceCanvas.width, iceCanvas.height);

  // Add subtle vertical light streaks (overhead light reflections)
  for (let i = 0; i < 5; i++) {
    const x = (iceCanvas.width / 6) * (i + 1) + (Math.random() - 0.5) * 20;
    const streakGradient = iceCtx.createLinearGradient(x - 10, 0, x + 10, 0);
    streakGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    streakGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.1)');
    streakGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
    streakGradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.1)');
    streakGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    iceCtx.fillStyle = streakGradient;
    iceCtx.fillRect(x - 12, 0, 24, iceCanvas.height);
  }

  // Add subtle pebble texture (very fine, barely visible)
  for (let i = 0; i < 1500; i++) {
    const x = Math.random() * iceCanvas.width;
    const y = Math.random() * iceCanvas.height;
    const brightness = 250 + Math.random() * 5;
    iceCtx.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness}, 0.3)`;
    iceCtx.beginPath();
    iceCtx.arc(x, y, 0.5 + Math.random() * 1, 0, Math.PI * 2);
    iceCtx.fill();
  }

  // Add subtle overhead light reflection spots
  for (let row = 0; row < 8; row++) {
    const y = (iceCanvas.height / 8) * row + iceCanvas.height / 16;
    for (let col = 0; col < 2; col++) {
      const x = (iceCanvas.width / 3) * (col + 1);
      const size = 15 + Math.random() * 10;

      // Very soft, subtle glow for light reflection
      const lightGradient = iceCtx.createRadialGradient(x, y, 0, x, y, size);
      lightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
      lightGradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.08)');
      lightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      iceCtx.fillStyle = lightGradient;
      iceCtx.beginPath();
      iceCtx.arc(x, y, size, 0, Math.PI * 2);
      iceCtx.fill();
    }
  }

  // Add occasional bright sparkle points
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * iceCanvas.width;
    const y = Math.random() * iceCanvas.height;
    const size = 1 + Math.random() * 2;

    iceCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    iceCtx.beginPath();
    iceCtx.arc(x, y, size, 0, Math.PI * 2);
    iceCtx.fill();
  }

  const iceTexture = new THREE.CanvasTexture(iceCanvas);
  iceTexture.wrapS = THREE.ClampToEdgeWrapping;
  iceTexture.wrapT = THREE.ClampToEdgeWrapping;

  const iceMaterial = new THREE.MeshStandardMaterial({
    map: iceTexture,
    roughness: 0.35,  // Slightly glossy for realistic ice look
    metalness: 0.0,
    color: 0xffffff,
    envMapIntensity: 0.15,
    emissive: 0xffffff,  // Add slight self-illumination for brighter white
    emissiveIntensity: 0.08
  });
  const ice = new THREE.Mesh(iceGeometry, iceMaterial);
  ice.rotation.x = -Math.PI / 2;
  ice.position.z = SHEET_LENGTH / 2;
  ice.receiveShadow = true;
  scene.add(ice);

  // Add subtle gradient edge shadows along the sides of the ice
  const shadowWidth = 1.0;

  // Create gradient texture for shadow
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 64;
  shadowCanvas.height = 4;
  const shadowCtx = shadowCanvas.getContext('2d');

  // Left shadow gradient: dark at left edge (0), transparent at right (width)
  const leftGradient = shadowCtx.createLinearGradient(0, 0, 64, 0);
  leftGradient.addColorStop(0, 'rgba(0, 0, 0, 0.25)');
  leftGradient.addColorStop(0.3, 'rgba(0, 0, 0, 0.12)');
  leftGradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.05)');
  leftGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  shadowCtx.fillStyle = leftGradient;
  shadowCtx.fillRect(0, 0, 64, 4);

  const leftShadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const leftShadowGeo = new THREE.PlaneGeometry(shadowWidth, SHEET_LENGTH);
  const leftShadowMat = new THREE.MeshBasicMaterial({
    map: leftShadowTexture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const leftShadow = new THREE.Mesh(leftShadowGeo, leftShadowMat);
  leftShadow.rotation.x = -Math.PI / 2;
  leftShadow.position.set(-SHEET_WIDTH / 2 + shadowWidth / 2, 0.02, SHEET_LENGTH / 2);
  scene.add(leftShadow);

  // Right shadow gradient: transparent at left (0), dark at right edge (width)
  const rightShadowCanvas = document.createElement('canvas');
  rightShadowCanvas.width = 64;
  rightShadowCanvas.height = 4;
  const rightShadowCtx = rightShadowCanvas.getContext('2d');
  const rightGradient = rightShadowCtx.createLinearGradient(0, 0, 64, 0);
  rightGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  rightGradient.addColorStop(0.4, 'rgba(0, 0, 0, 0.05)');
  rightGradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.12)');
  rightGradient.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
  rightShadowCtx.fillStyle = rightGradient;
  rightShadowCtx.fillRect(0, 0, 64, 4);

  const rightShadowTexture = new THREE.CanvasTexture(rightShadowCanvas);
  const rightShadowMat = new THREE.MeshBasicMaterial({
    map: rightShadowTexture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const rightShadow = new THREE.Mesh(leftShadowGeo.clone(), rightShadowMat);
  rightShadow.rotation.x = -Math.PI / 2;
  rightShadow.position.set(SHEET_WIDTH / 2 - shadowWidth / 2, 0.02, SHEET_LENGTH / 2);
  scene.add(rightShadow);

  // Side borders (dark edges like real rinks)
  const borderMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    roughness: 0.8
  });
  const borderGeometry = new THREE.BoxGeometry(0.1, 0.15, SHEET_LENGTH);

  const leftBorder = new THREE.Mesh(borderGeometry, borderMaterial);
  leftBorder.position.set(-SHEET_WIDTH / 2 - 0.05, 0.075, SHEET_LENGTH / 2);
  scene.add(leftBorder);

  const rightBorder = new THREE.Mesh(borderGeometry, borderMaterial);
  rightBorder.position.set(SHEET_WIDTH / 2 + 0.05, 0.075, SHEET_LENGTH / 2);
  scene.add(rightBorder);

  // === LOGOS ON ICE ===
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load('/curlingpro.png', (logoTexture) => {
    // Logo material with transparency
    const logoMaterial = new THREE.MeshBasicMaterial({
      map: logoTexture,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });

    // Logo size (adjust as needed)
    const logoWidth = 3.0;
    const logoHeight = 2.5;
    const logoGeometry = new THREE.PlaneGeometry(logoWidth, logoHeight);

    // Near side logo (right side of sheet, between hog lines)
    // Positioned on right side, facing outward (toward right wall)
    const nearLogo = new THREE.Mesh(logoGeometry, logoMaterial);
    nearLogo.rotation.x = -Math.PI / 2;  // Lay flat on ice
    nearLogo.rotation.z = Math.PI / 2;   // Face outward (toward right)
    nearLogo.position.set(SHEET_WIDTH / 6, 0.01, (HOG_LINE_NEAR + HOG_LINE_FAR) / 2 - 6);  // Near side
    scene.add(nearLogo);

    // Far side logo (left side of sheet, between hog lines)
    // Positioned on left side, facing outward (toward left wall)
    const farLogo = new THREE.Mesh(logoGeometry, logoMaterial);
    farLogo.rotation.x = -Math.PI / 2;  // Lay flat on ice
    farLogo.rotation.z = -Math.PI / 2;  // Face outward (toward left)
    farLogo.position.set(-SHEET_WIDTH / 6, 0.01, (HOG_LINE_NEAR + HOG_LINE_FAR) / 2 + 6);  // Far side
    scene.add(farLogo);

    console.log('Logos loaded and added to ice');
  }, undefined, (error) => {
    console.warn('Could not load curlingpro.png - please add it to the public folder');
  });

  // === FAR HOUSE (target end) ===
  createHouse(TEE_LINE_FAR);

  // === NEAR HOUSE (throwing end) ===
  createHouse(TEE_LINE_NEAR);

  // Tee lines (horizontal through house centers)
  createLine(-SHEET_WIDTH/2, TEE_LINE_FAR, SHEET_WIDTH/2, TEE_LINE_FAR, 0x333333);
  createLine(-SHEET_WIDTH/2, TEE_LINE_NEAR, SHEET_WIDTH/2, TEE_LINE_NEAR, 0x333333);

  // Back lines
  createLine(-SHEET_WIDTH/2, BACK_LINE_FAR, SHEET_WIDTH/2, BACK_LINE_FAR, 0x333333);
  createLine(-SHEET_WIDTH/2, BACK_LINE_NEAR, SHEET_WIDTH/2, BACK_LINE_NEAR, 0x333333);

  // Center line (down the middle of entire sheet)
  createLine(0, BACK_LINE_NEAR, 0, BACK_LINE_FAR, 0x333333);

  // Hog lines (red)
  createLine(-SHEET_WIDTH/2, HOG_LINE_NEAR, SHEET_WIDTH/2, HOG_LINE_NEAR, 0xcc0000);
  createLine(-SHEET_WIDTH/2, HOG_LINE_FAR, SHEET_WIDTH/2, HOG_LINE_FAR, 0xcc0000);

  // Hack (foot hold) - where thrower stands
  // Center plate (white/light gray)
  const centerPlateGeometry = new THREE.BoxGeometry(0.2, 0.02, 0.25);
  const centerPlateMaterial = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.5 });
  const centerPlate = new THREE.Mesh(centerPlateGeometry, centerPlateMaterial);
  centerPlate.position.set(0, 0.01, HACK_Z);
  scene.add(centerPlate);

  // Left foot hold (rubber block)
  const footHoldGeometry = new THREE.BoxGeometry(0.15, 0.06, 0.3);
  const footHoldMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });

  const leftFootHold = new THREE.Mesh(footHoldGeometry, footHoldMaterial);
  leftFootHold.position.set(-0.22, 0.03, HACK_Z + 0.05);
  leftFootHold.rotation.x = -0.15;  // Tilted back
  scene.add(leftFootHold);

  // Left foot hold - rubber texture ridges
  for (let i = 0; i < 4; i++) {
    const ridgeGeometry = new THREE.BoxGeometry(0.14, 0.015, 0.02);
    const ridge = new THREE.Mesh(ridgeGeometry, footHoldMaterial);
    ridge.position.set(-0.22, 0.06, HACK_Z + 0.12 - i * 0.06);
    scene.add(ridge);
  }

  // Right foot hold (rubber block)
  const rightFootHold = new THREE.Mesh(footHoldGeometry, footHoldMaterial);
  rightFootHold.position.set(0.22, 0.03, HACK_Z + 0.05);
  rightFootHold.rotation.x = -0.15;  // Tilted back
  scene.add(rightFootHold);

  // Right foot hold - rubber texture ridges
  for (let i = 0; i < 4; i++) {
    const ridgeGeometry = new THREE.BoxGeometry(0.14, 0.015, 0.02);
    const ridge = new THREE.Mesh(ridgeGeometry, footHoldMaterial);
    ridge.position.set(0.22, 0.06, HACK_Z + 0.12 - i * 0.06);
    scene.add(ridge);
  }

  // Metal frame connecting the pieces
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.4, metalness: 0.3 });
  const frameGeometry = new THREE.BoxGeometry(0.55, 0.015, 0.05);
  const frame = new THREE.Mesh(frameGeometry, frameMaterial);
  frame.position.set(0, 0.005, HACK_Z - 0.12);
  scene.add(frame);

  // Sheet boundaries (physics walls)
  const wallOptions = { isStatic: true, restitution: 0.5 };

  // Back wall (behind far house) - stones hitting this are out of play
  const backWall = Matter.Bodies.rectangle(0, BACK_LINE_FAR * PHYSICS_SCALE + 50, SHEET_WIDTH * PHYSICS_SCALE, 10, { ...wallOptions, label: 'backWall' });

  // Side walls - stones hitting these are out of play
  leftWall = Matter.Bodies.rectangle(-SHEET_WIDTH/2 * PHYSICS_SCALE - 5, SHEET_LENGTH/2 * PHYSICS_SCALE, 10, SHEET_LENGTH * PHYSICS_SCALE, { ...wallOptions, label: 'sideWall' });
  rightWall = Matter.Bodies.rectangle(SHEET_WIDTH/2 * PHYSICS_SCALE + 5, SHEET_LENGTH/2 * PHYSICS_SCALE, 10, SHEET_LENGTH * PHYSICS_SCALE, { ...wallOptions, label: 'sideWall' });

  Matter.Composite.add(world, [backWall, leftWall, rightWall]);

  // Collision detection for side walls
  Matter.Events.on(engine, 'collisionStart', handleCollision);
}

// Create a complete house (all rings) at a given Z position
function createHouse(teeZ) {
  // Create house with gradient rings using a single canvas texture
  const houseSize = RING_12FT * 2 + 0.1;
  const canvasSize = 512;
  const houseCanvas = document.createElement('canvas');
  houseCanvas.width = canvasSize;
  houseCanvas.height = canvasSize;
  const ctx = houseCanvas.getContext('2d');

  const centerX = canvasSize / 2;
  const centerY = canvasSize / 2;
  const scale = canvasSize / houseSize;

  // 12ft ring - blue gradient (outermost)
  const blueGradient = ctx.createRadialGradient(
    centerX, centerY, RING_8FT * scale,
    centerX, centerY, RING_12FT * scale
  );
  blueGradient.addColorStop(0, '#0088ee');
  blueGradient.addColorStop(0.3, '#0066cc');
  blueGradient.addColorStop(0.7, '#0055bb');
  blueGradient.addColorStop(1, '#003d99');
  ctx.fillStyle = blueGradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, RING_12FT * scale, 0, Math.PI * 2);
  ctx.fill();

  // 8ft ring - white gradient
  const whiteGradient = ctx.createRadialGradient(
    centerX, centerY, RING_4FT * scale,
    centerX, centerY, RING_8FT * scale
  );
  whiteGradient.addColorStop(0, '#ffffff');
  whiteGradient.addColorStop(0.5, '#f8f8f8');
  whiteGradient.addColorStop(1, '#e8e8e8');
  ctx.fillStyle = whiteGradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, RING_8FT * scale, 0, Math.PI * 2);
  ctx.fill();

  // 4ft ring - red gradient
  const redGradient = ctx.createRadialGradient(
    centerX, centerY, BUTTON_RADIUS * scale,
    centerX, centerY, RING_4FT * scale
  );
  redGradient.addColorStop(0, '#ff4444');
  redGradient.addColorStop(0.3, '#dd2222');
  redGradient.addColorStop(0.7, '#cc0000');
  redGradient.addColorStop(1, '#990000');
  ctx.fillStyle = redGradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, RING_4FT * scale, 0, Math.PI * 2);
  ctx.fill();

  // Button - white center with subtle gradient
  const buttonGradient = ctx.createRadialGradient(
    centerX - BUTTON_RADIUS * scale * 0.3, centerY - BUTTON_RADIUS * scale * 0.3, 0,
    centerX, centerY, BUTTON_RADIUS * scale
  );
  buttonGradient.addColorStop(0, '#ffffff');
  buttonGradient.addColorStop(0.7, '#f0f0f0');
  buttonGradient.addColorStop(1, '#e0e0e0');
  ctx.fillStyle = buttonGradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, BUTTON_RADIUS * scale, 0, Math.PI * 2);
  ctx.fill();

  // Add ring outlines for definition
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.lineWidth = 2;
  [RING_12FT, RING_8FT, RING_4FT, BUTTON_RADIUS].forEach(radius => {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * scale, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Create texture from canvas
  const houseTexture = new THREE.CanvasTexture(houseCanvas);

  // Create house mesh
  const houseGeometry = new THREE.PlaneGeometry(houseSize, houseSize);
  const houseMaterial = new THREE.MeshBasicMaterial({
    map: houseTexture,
    transparent: true,
    side: THREE.DoubleSide
  });
  const house = new THREE.Mesh(houseGeometry, houseMaterial);
  house.rotation.x = -Math.PI / 2;
  house.position.set(0, 0.005, teeZ);
  scene.add(house);
}

// Track next out-of-play position (spread them out along the back wall)
let outOfPlayCount = 0;

// Move a stone to the out-of-play area behind the back wall
function moveStoneOutOfPlay(stone, reason) {
  if (stone.outOfPlay) return; // Already out of play

  // Mark as out of play and store reason
  stone.outOfPlay = true;
  stone.outOfPlayReason = reason;

  // Calculate position along the back wall (spread them out)
  const xOffset = (outOfPlayCount % 8 - 3.5) * (STONE_RADIUS * 2.5);
  outOfPlayCount++;

  // Stop the stone's physics body
  Matter.Body.setVelocity(stone.body, { x: 0, y: 0 });
  Matter.Body.setAngularVelocity(stone.body, 0);

  // Move to back wall area
  Matter.Body.setPosition(stone.body, {
    x: xOffset * PHYSICS_SCALE,
    y: OUT_OF_PLAY_Z * PHYSICS_SCALE
  });

  // Update the 3D mesh position
  stone.mesh.position.x = xOffset;
  stone.mesh.position.z = OUT_OF_PLAY_Z;

  // Make the stone semi-transparent to indicate it's out of play
  stone.mesh.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material = child.material.clone();
      child.material.transparent = true;
      child.material.opacity = 0.5;
    }
  });

  console.log(`Stone out of play - ${reason}`);
}

// Reset out-of-play stones for new end
function resetOutOfPlayStones() {
  outOfPlayCount = 0;
}

// Custom stone-to-stone collision physics
// Implements proper 2D elastic collision with coefficient of restitution e = 0.85
// This ensures shooter "dies" (loses most velocity) while target moves at ~92.5% of incoming speed
const COLLISION_RESTITUTION = 0.85;  // Coefficient of restitution for stone-on-stone

function applyStoneCollision(bodyA, bodyB) {
  // Get positions and velocities
  const posA = bodyA.position;
  const posB = bodyB.position;
  const velA = { x: bodyA.velocity.x, y: bodyA.velocity.y };
  const velB = { x: bodyB.velocity.x, y: bodyB.velocity.y };

  // Calculate collision normal (from A to B)
  const dx = posB.x - posA.x;
  const dy = posB.y - posA.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.001) return; // Avoid division by zero

  const nx = dx / dist;  // Normal x component
  const ny = dy / dist;  // Normal y component

  // Calculate relative velocity along the collision normal
  const relVelX = velA.x - velB.x;
  const relVelY = velA.y - velB.y;
  const relVelNormal = relVelX * nx + relVelY * ny;

  // Only process if stones are approaching each other
  if (relVelNormal <= 0) return;

  // For equal mass collision with coefficient of restitution e:
  // Impulse magnitude = (1 + e) * relVelNormal / 2 (for equal masses)
  const e = COLLISION_RESTITUTION;
  const impulseMag = (1 + e) * relVelNormal / 2;

  // Apply impulse to both bodies
  // Body A loses velocity along normal, Body B gains it
  const impulseX = impulseMag * nx;
  const impulseY = impulseMag * ny;

  // New velocities
  const newVelA = {
    x: velA.x - impulseX,
    y: velA.y - impulseY
  };
  const newVelB = {
    x: velB.x + impulseX,
    y: velB.y + impulseY
  };

  // Apply the calculated velocities
  Matter.Body.setVelocity(bodyA, newVelA);
  Matter.Body.setVelocity(bodyB, newVelB);

  // Debug logging
  const speedA = Math.sqrt(velA.x * velA.x + velA.y * velA.y);
  const speedB = Math.sqrt(velB.x * velB.x + velB.y * velB.y);
  const newSpeedA = Math.sqrt(newVelA.x * newVelA.x + newVelA.y * newVelA.y);
  const newSpeedB = Math.sqrt(newVelB.x * newVelB.x + newVelB.y * newVelB.y);
  console.log(`[COLLISION] Stone A: ${speedA.toFixed(2)} -> ${newSpeedA.toFixed(2)} | Stone B: ${speedB.toFixed(2)} -> ${newSpeedB.toFixed(2)}`);
}

// Handle collisions - move stones to back wall when they hit side or back walls
function handleCollision(event) {
  const pairs = event.pairs;

  for (const pair of pairs) {
    const bodyA = pair.bodyA;
    const bodyB = pair.bodyB;

    // Check if one body is a side wall or back wall
    const isSideWallA = bodyA.label === 'sideWall';
    const isSideWallB = bodyB.label === 'sideWall';
    const isBackWallA = bodyA.label === 'backWall';
    const isBackWallB = bodyB.label === 'backWall';

    const isWallCollision = isSideWallA || isSideWallB || isBackWallA || isBackWallB;

    // Check for stone-to-stone collision
    const stoneA = gameState.stones.find(s => s.body === bodyA);
    const stoneB = gameState.stones.find(s => s.body === bodyB);
    if (stoneA && stoneB) {
      // Calculate collision intensity based on relative velocity
      const relVelX = bodyA.velocity.x - bodyB.velocity.x;
      const relVelY = bodyA.velocity.y - bodyB.velocity.y;
      const relSpeed = Math.sqrt(relVelX * relVelX + relVelY * relVelY);
      const intensity = Math.min(1, relSpeed / 5);  // Normalize to 0-1
      soundManager.playCollision(intensity);

      // Custom collision response for proper momentum transfer
      // Matter.js sometimes doesn't handle restitution correctly, so we manually apply physics
      applyStoneCollision(bodyA, bodyB);
    }

    if (isWallCollision) {
      // Find the stone (the other body)
      const stoneBody = (isSideWallA || isBackWallA) ? bodyB : bodyA;
      const reason = (isSideWallA || isSideWallB) ? 'hit side wall' : 'went past back line';

      // Find the stone in our game state
      const stone = gameState.stones.find(s => s.body === stoneBody);
      if (stone && !stone.outOfPlay) {
        // Move stone to back wall instead of removing
        moveStoneOutOfPlay(stone, reason);

        // If this was the active stone, clear it
        if (gameState.activeStone === stone) {
          gameState.activeStone = null;
          gameState.isSweeping = false;
          gameState._computerSweepSoundStarted = false;

          // Stop sounds and hide sweep indicator
          soundManager.stopSliding();
          soundManager.stopSweeping();
          const indicator = document.getElementById('sweep-indicator');
          if (indicator) indicator.style.display = 'none';

          // Move to next turn after a delay
          setTimeout(() => {
            if (gameState.phase === 'sweeping' || gameState.phase === 'throwing') {
              gameState.phase = 'waiting';
              setTimeout(() => nextTurn(), 1000);
            }
          }, 500);
        }
      }
    }
  }
}

function createLine(x1, z1, x2, z2, color) {
  const points = [new THREE.Vector3(x1, 0.01, z1), new THREE.Vector3(x2, 0.01, z2)];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color });
  const line = new THREE.Line(geometry, material);
  scene.add(line);
}

// ============================================
// STONE CREATION
// ============================================
function createStone(team) {
  const capColor = team === 'red' ? 0xdc2626 : 0xfbbf24;
  const capColorDark = team === 'red' ? 0xb91c1c : 0xd97706;

  // Granite body material - speckled gray
  const graniteMaterial = new THREE.MeshStandardMaterial({
    color: 0x707070,
    roughness: 0.7,
    metalness: 0.05
  });

  // Create smooth stone profile using LatheGeometry for realistic rounded shape
  const stoneProfile = [];
  const radius = STONE_RADIUS;
  const height = 0.11;

  // Define the profile curve (half cross-section of the stone)
  // Bottom center to outer edge, up the side, to top
  stoneProfile.push(new THREE.Vector2(0, 0));  // Bottom center
  stoneProfile.push(new THREE.Vector2(radius * 0.3, 0));  // Bottom flat
  stoneProfile.push(new THREE.Vector2(radius * 0.85, 0.005));  // Curve out
  stoneProfile.push(new THREE.Vector2(radius * 1.0, 0.02));  // Lower bulge
  stoneProfile.push(new THREE.Vector2(radius * 1.05, 0.04));  // Max width
  stoneProfile.push(new THREE.Vector2(radius * 1.02, 0.06));  // Upper curve
  stoneProfile.push(new THREE.Vector2(radius * 0.95, 0.08));  // Taper in
  stoneProfile.push(new THREE.Vector2(radius * 0.88, height));  // Top edge
  stoneProfile.push(new THREE.Vector2(0, height));  // Top center

  const bodyGeometry = new THREE.LatheGeometry(stoneProfile, 32);
  const mesh = new THREE.Mesh(bodyGeometry, graniteMaterial);
  mesh.castShadow = true;
  mesh.position.set(0, 0, 0);

  // Colored plastic top cap
  const capMaterial = new THREE.MeshStandardMaterial({
    color: capColor,
    roughness: 0.3,
    metalness: 0.1
  });

  // Cap profile - slightly domed
  const capProfile = [];
  capProfile.push(new THREE.Vector2(0, 0));
  capProfile.push(new THREE.Vector2(radius * 0.68, 0));
  capProfile.push(new THREE.Vector2(radius * 0.7, 0.008));
  capProfile.push(new THREE.Vector2(radius * 0.65, 0.02));
  capProfile.push(new THREE.Vector2(0, 0.025));

  const capGeometry = new THREE.LatheGeometry(capProfile, 32);
  const cap = new THREE.Mesh(capGeometry, capMaterial);
  cap.position.y = height;
  mesh.add(cap);

  // Handle - arched bridge style (same color as cap)
  const handleMaterial = new THREE.MeshStandardMaterial({
    color: capColor,
    roughness: 0.35,
    metalness: 0.1
  });

  // Create arch handle using a partial torus
  const handleArchGeometry = new THREE.TorusGeometry(0.04, 0.01, 12, 24, Math.PI);
  const handleArch = new THREE.Mesh(handleArchGeometry, handleMaterial);
  handleArch.rotation.z = Math.PI / 2;  // Stand upright
  handleArch.rotation.y = Math.PI / 2;  // Face forward
  handleArch.position.y = height + 0.02;
  mesh.add(handleArch);

  // Handle feet (where arch meets cap)
  const footGeometry = new THREE.CylinderGeometry(0.01, 0.012, 0.015, 12);
  const footMaterialDark = new THREE.MeshStandardMaterial({
    color: capColorDark,
    roughness: 0.4,
    metalness: 0.1
  });

  const footLeft = new THREE.Mesh(footGeometry, footMaterialDark);
  footLeft.position.set(-0.04, height + 0.007, 0);
  mesh.add(footLeft);

  const footRight = new THREE.Mesh(footGeometry, footMaterialDark);
  footRight.position.set(0.04, height + 0.007, 0);
  mesh.add(footRight);

  // Scoring indicator - glowing ring under stone (hidden by default)
  // Outer radius must match STONE_RADIUS so glow accurately shows scoring boundary
  const glowColor = team === 'red' ? 0xff4444 : 0xffdd44;
  const glowGeometry = new THREE.RingGeometry(STONE_RADIUS * 0.7, STONE_RADIUS * 1.0, 32);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: glowColor,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide
  });
  const scoringGlow = new THREE.Mesh(glowGeometry, glowMaterial);
  scoringGlow.rotation.x = -Math.PI / 2;  // Lay flat on ice
  scoringGlow.position.y = 0.002;  // Just above ice
  scoringGlow.name = 'scoringGlow';
  mesh.add(scoringGlow);

  scene.add(mesh);

  // Physics body (scaled for Matter.js)
  const body = Matter.Bodies.circle(0, 0, STONE_RADIUS * PHYSICS_SCALE, {
    mass: STONE_MASS,
    friction: 0.01,       // Low friction for stone-on-stone sliding
    frictionAir: ICE_FRICTION,
    frictionStatic: 0.01, // Low static friction
    restitution: 0,       // We handle collision response manually in applyStoneCollision()
    label: team
  });
  Matter.Composite.add(world, body);

  return { mesh, body, team };
}

// Create preview stone at the hack (visual only, no physics)
function createPreviewStone(team) {
  const capColor = team === 'red' ? 0xdc2626 : 0xfbbf24;
  const capColorDark = team === 'red' ? 0xb91c1c : 0xd97706;

  // Granite body material
  const graniteMaterial = new THREE.MeshStandardMaterial({
    color: 0x707070,
    roughness: 0.7,
    metalness: 0.05
  });

  // Stone profile
  const stoneProfile = [];
  const radius = STONE_RADIUS;
  const height = 0.11;

  stoneProfile.push(new THREE.Vector2(0, 0));
  stoneProfile.push(new THREE.Vector2(radius * 0.3, 0));
  stoneProfile.push(new THREE.Vector2(radius * 0.85, 0.005));
  stoneProfile.push(new THREE.Vector2(radius * 1.0, 0.02));
  stoneProfile.push(new THREE.Vector2(radius * 1.05, 0.04));
  stoneProfile.push(new THREE.Vector2(radius * 1.02, 0.06));
  stoneProfile.push(new THREE.Vector2(radius * 0.95, 0.08));
  stoneProfile.push(new THREE.Vector2(radius * 0.88, height));
  stoneProfile.push(new THREE.Vector2(0, height));

  const bodyGeometry = new THREE.LatheGeometry(stoneProfile, 32);
  const mesh = new THREE.Mesh(bodyGeometry, graniteMaterial);
  mesh.castShadow = true;

  // Colored cap
  const capMaterial = new THREE.MeshStandardMaterial({
    color: capColor,
    roughness: 0.3,
    metalness: 0.1
  });

  const capProfile = [];
  capProfile.push(new THREE.Vector2(0, 0));
  capProfile.push(new THREE.Vector2(radius * 0.68, 0));
  capProfile.push(new THREE.Vector2(radius * 0.7, 0.008));
  capProfile.push(new THREE.Vector2(radius * 0.65, 0.02));
  capProfile.push(new THREE.Vector2(0, 0.025));

  const capGeometry = new THREE.LatheGeometry(capProfile, 32);
  const cap = new THREE.Mesh(capGeometry, capMaterial);
  cap.position.y = height;
  mesh.add(cap);

  // Handle
  const handleMaterial = new THREE.MeshStandardMaterial({
    color: capColor,
    roughness: 0.35,
    metalness: 0.1
  });

  const handleArchGeometry = new THREE.TorusGeometry(0.04, 0.01, 12, 24, Math.PI);
  const handleArch = new THREE.Mesh(handleArchGeometry, handleMaterial);
  handleArch.rotation.z = Math.PI / 2;
  handleArch.rotation.y = Math.PI / 2;
  handleArch.position.y = height + 0.02;
  mesh.add(handleArch);

  // Handle feet
  const footGeometry = new THREE.CylinderGeometry(0.01, 0.012, 0.015, 12);
  const footMaterialDark = new THREE.MeshStandardMaterial({
    color: capColorDark,
    roughness: 0.4,
    metalness: 0.1
  });

  const footLeft = new THREE.Mesh(footGeometry, footMaterialDark);
  footLeft.position.set(-0.04, height + 0.007, 0);
  mesh.add(footLeft);

  const footRight = new THREE.Mesh(footGeometry, footMaterialDark);
  footRight.position.set(0.04, height + 0.007, 0);
  mesh.add(footRight);

  // Position stone in front of the hack
  mesh.position.set(0, 0, HACK_Z + 0.3);

  return mesh;
}

// Update preview stone rotation based on curl direction
function updatePreviewStoneRotation() {
  if (!gameState.previewStone) return;

  // Curl direction: 1 = curl RIGHT (clockwise rotation) -> handle at 2:00 position
  //                -1 = curl LEFT (counter-clockwise rotation) -> handle at 10:00 position
  //                null = not selected -> handle at 12:00 (straight)
  // 2:00 is 60 degrees clockwise from 12:00 (forward)
  // 10:00 is 60 degrees counter-clockwise from 12:00
  // In Three.js Y-up, positive rotation is counter-clockwise when viewed from above
  let handleAngle = 0;  // Default to 12:00 when not selected
  if (gameState.curlDirection === 1) {
    handleAngle = -Math.PI / 3;
  } else if (gameState.curlDirection === -1) {
    handleAngle = Math.PI / 3;
  }
  gameState.previewStone.rotation.y = handleAngle;
}

// Show/hide preview stone based on game phase
function updatePreviewStoneVisibility() {
  if (!gameState.previewStone) return;

  // Only show during aiming phase when in thrower's view
  const shouldShow = (gameState.phase === 'aiming' || gameState.phase === 'charging') &&
                     gameState.previewHeight < 0.3;
  gameState.previewStone.visible = shouldShow;
}

// Recreate preview stone for the current team (called when team changes)
function updatePreviewStoneForTeam() {
  // Remove old preview stone
  if (gameState.previewStone) {
    scene.remove(gameState.previewStone);
    gameState.previewStone = null;
  }

  // Create new preview stone for current team
  gameState.previewStone = createPreviewStone(gameState.currentTeam);
  scene.add(gameState.previewStone);
  updatePreviewStoneRotation();
}

// ============================================
// CAMERA ANIMATION
// ============================================
let cameraAnimation = null;

function animateCamera(from, to, duration, onComplete) {
  const startTime = Date.now();
  const startPos = { ...from };
  const startLookAt = { ...from.lookAt };

  cameraAnimation = {
    update: () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - t, 3);

      camera.position.x = startPos.x + (to.x - startPos.x) * ease;
      camera.position.y = startPos.y + (to.y - startPos.y) * ease;
      camera.position.z = startPos.z + (to.z - startPos.z) * ease;

      const lookX = startLookAt.x + (to.lookAt.x - startLookAt.x) * ease;
      const lookY = startLookAt.y + (to.lookAt.y - startLookAt.y) * ease;
      const lookZ = startLookAt.z + (to.lookAt.z - startLookAt.z) * ease;
      camera.lookAt(lookX, lookY, lookZ);

      if (t >= 1) {
        cameraAnimation = null;
        if (onComplete) onComplete();
      }
    }
  };
}

// ============================================
// TARGET MARKER (Skip with broom)
// ============================================
function createTargetMarker() {
  // Create a skip figure holding a broom as target
  // Skip stands behind the broom pad, facing the thrower
  // Broom extends FORWARD (toward thrower) with pad on ice as target
  // One arm signals curl direction
  // TALL BEACON for visibility from throwing view
  const group = new THREE.Group();

  // Materials (transparent: true enables opacity fading when stones pass nearby)
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8, transparent: true });  // Dark jacket
  const pantsMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8, transparent: true });  // Dark pants
  const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xe0b090, roughness: 0.6, transparent: true });  // Skin tone
  const broomMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, transparent: true });  // Dark gray handle
  const padMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true });  // Bright green broom pad (unlit for visibility)
  const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });  // Bright green beacon (unlit) - not faded

  // Skip body offset behind the target point (broom pad is at 0,0)
  const skipZ = 0.6;  // Skip stands behind the broom pad

  // === TALL VISIBILITY BEACON ===
  // Vertical pole - very tall so it's visible from distance
  const beaconPoleGeometry = new THREE.CylinderGeometry(0.03, 0.03, 2.5, 8);
  const beaconPole = new THREE.Mesh(beaconPoleGeometry, beaconMaterial);
  beaconPole.position.set(0, 1.25, 0);
  beaconPole.name = 'beacon';
  group.add(beaconPole);

  // Top ball on beacon
  const beaconTopGeometry = new THREE.SphereGeometry(0.12, 16, 12);
  const beaconTop = new THREE.Mesh(beaconTopGeometry, beaconMaterial);
  beaconTop.position.set(0, 2.5, 0);
  beaconTop.name = 'beacon';
  group.add(beaconTop);

  // Horizontal crossbar for curl direction
  const crossbarGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.8, 8);
  const crossbar = new THREE.Mesh(crossbarGeometry, beaconMaterial);
  crossbar.rotation.z = Math.PI / 2;
  crossbar.position.set(0, 2.0, 0);
  crossbar.name = 'beacon';
  group.add(crossbar);

  // Arrow indicator on crossbar (shows curl direction)
  const arrowGeometry = new THREE.ConeGeometry(0.08, 0.2, 8);
  const arrow = new THREE.Mesh(arrowGeometry, beaconMaterial);
  arrow.rotation.z = -Math.PI / 2;  // Point right by default
  arrow.position.set(0.5, 2.0, 0);
  arrow.name = 'curlArrow';
  group.add(arrow);

  // === SKIP BODY (smaller, behind beacon) ===
  // Torso
  const torsoGeometry = new THREE.CylinderGeometry(0.1, 0.08, 0.35, 12);
  const torso = new THREE.Mesh(torsoGeometry, bodyMaterial);
  torso.position.set(0, 0.5, skipZ);
  group.add(torso);

  // Head
  const headGeometry = new THREE.SphereGeometry(0.08, 12, 10);
  const head = new THREE.Mesh(headGeometry, skinMaterial);
  head.position.set(0, 0.78, skipZ);
  group.add(head);

  // Legs
  const legGeometry = new THREE.CylinderGeometry(0.04, 0.035, 0.35, 8);
  const leftLeg = new THREE.Mesh(legGeometry, pantsMaterial);
  leftLeg.position.set(-0.05, 0.18, skipZ);
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeometry, pantsMaterial);
  rightLeg.position.set(0.05, 0.18, skipZ);
  group.add(rightLeg);

  // === BROOM (extends forward toward thrower) ===
  const handleGeometry = new THREE.CylinderGeometry(0.015, 0.015, 0.8, 8);
  const broomHandle = new THREE.Mesh(handleGeometry, broomMaterial);
  broomHandle.rotation.x = Math.PI / 2.8;
  broomHandle.position.set(0, 0.3, skipZ * 0.4);
  group.add(broomHandle);

  // Broom arms
  const broomArmGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8);
  const leftBroomArm = new THREE.Mesh(broomArmGeometry, bodyMaterial);
  leftBroomArm.rotation.x = Math.PI / 3;
  leftBroomArm.rotation.z = 0.3;
  leftBroomArm.position.set(-0.08, 0.45, skipZ - 0.1);
  group.add(leftBroomArm);

  const rightBroomArm = new THREE.Mesh(broomArmGeometry, bodyMaterial);
  rightBroomArm.rotation.x = Math.PI / 3;
  rightBroomArm.rotation.z = -0.3;
  rightBroomArm.position.set(0.08, 0.45, skipZ - 0.1);
  rightBroomArm.name = 'rightBroomArm';
  group.add(rightBroomArm);

  // === BROOM PAD (THE TARGET) - Large and bright ===
  const padGeometry = new THREE.BoxGeometry(0.25, 0.03, 0.15);
  const broomPad = new THREE.Mesh(padGeometry, padMaterial);
  broomPad.position.set(0, 0.015, 0);
  broomPad.name = 'beacon';
  group.add(broomPad);

  // Large glow ring on ice
  const glowRing = new THREE.RingGeometry(0.2, 0.35, 32);
  const glowMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
  const glow = new THREE.Mesh(glowRing, glowMaterial);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.005;
  glow.name = 'beacon';
  group.add(glow);

  // Inner glow ring
  const innerGlow = new THREE.RingGeometry(0.1, 0.18, 32);
  const innerGlowMaterial = new THREE.MeshBasicMaterial({ color: 0x88ff88, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
  const innerGlowMesh = new THREE.Mesh(innerGlow, innerGlowMaterial);
  innerGlowMesh.rotation.x = -Math.PI / 2;
  innerGlowMesh.position.y = 0.006;
  innerGlowMesh.name = 'beacon';
  group.add(innerGlowMesh);

  // === SIGNAL ARM (indicates curl direction) ===
  const signalArmGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8);
  const signalArm = new THREE.Mesh(signalArmGeometry, bodyMaterial);
  signalArm.name = 'signalArm';
  group.add(signalArm);

  const handGeometry = new THREE.SphereGeometry(0.03, 8, 6);
  const signalHand = new THREE.Mesh(handGeometry, skinMaterial);
  signalHand.name = 'signalHand';
  group.add(signalHand);

  group.visible = false;
  scene.add(group);
  return group;
}

// Create opponent's target marker (blue/cyan colored for visibility)
function createOpponentTargetMarker() {
  const group = new THREE.Group();

  // Blue/cyan color scheme for opponent
  const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0x00bfff });  // Deep sky blue
  const padMaterial = new THREE.MeshBasicMaterial({ color: 0x00bfff });

  // Simplified marker - just beacon and pad (no skip figure needed)

  // Vertical beacon pole
  const beaconPoleGeometry = new THREE.CylinderGeometry(0.03, 0.03, 2.5, 8);
  const beaconPole = new THREE.Mesh(beaconPoleGeometry, beaconMaterial);
  beaconPole.position.set(0, 1.25, 0);
  group.add(beaconPole);

  // Top ball on beacon
  const beaconTopGeometry = new THREE.SphereGeometry(0.12, 16, 12);
  const beaconTop = new THREE.Mesh(beaconTopGeometry, beaconMaterial);
  beaconTop.position.set(0, 2.5, 0);
  group.add(beaconTop);

  // Horizontal crossbar for curl direction
  const crossbarGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.8, 8);
  const crossbar = new THREE.Mesh(crossbarGeometry, beaconMaterial);
  crossbar.rotation.z = Math.PI / 2;
  crossbar.position.set(0, 2.0, 0);
  group.add(crossbar);

  // Arrow indicator for curl direction
  const arrowGeometry = new THREE.ConeGeometry(0.08, 0.2, 8);
  const arrow = new THREE.Mesh(arrowGeometry, beaconMaterial);
  arrow.rotation.z = -Math.PI / 2;  // Point right by default
  arrow.position.set(0.5, 2.0, 0);
  arrow.name = 'curlArrow';
  group.add(arrow);

  // Broom pad on ice
  const padGeometry = new THREE.BoxGeometry(0.25, 0.03, 0.15);
  const broomPad = new THREE.Mesh(padGeometry, padMaterial);
  broomPad.position.set(0, 0.015, 0);
  group.add(broomPad);

  // Glow ring on ice
  const glowRing = new THREE.RingGeometry(0.2, 0.35, 32);
  const glowMaterial = new THREE.MeshBasicMaterial({ color: 0x00bfff, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
  const glow = new THREE.Mesh(glowRing, glowMaterial);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.005;
  group.add(glow);

  group.visible = false;
  scene.add(group);
  return group;
}

// Update opponent's aim preview (multiplayer)
function updateOpponentAimPreview(data) {
  const { targetX, targetZ, curlDirection, handleAmount } = data;

  // Create opponent marker if it doesn't exist
  if (!gameState.opponentTargetMarker) {
    gameState.opponentTargetMarker = createOpponentTargetMarker();
  }

  // Position the marker
  gameState.opponentTargetMarker.position.x = targetX;
  gameState.opponentTargetMarker.position.z = targetZ;
  gameState.opponentTargetMarker.visible = true;

  // Update curl arrow direction
  const curlArrow = gameState.opponentTargetMarker.getObjectByName('curlArrow');
  if (curlArrow) {
    if (curlDirection === 1) {
      // Curl RIGHT (clockwise/in-turn)
      curlArrow.rotation.z = -Math.PI / 2;
      curlArrow.position.x = 0.5;
    } else if (curlDirection === -1) {
      // Curl LEFT (counter-clockwise/out-turn)
      curlArrow.rotation.z = Math.PI / 2;
      curlArrow.position.x = -0.5;
    } else {
      // No curl selected yet - hide arrow
      curlArrow.visible = false;
    }
    if (curlDirection) {
      curlArrow.visible = true;
    }
  }
}

// Hide opponent's aim preview
function hideOpponentAimPreview() {
  if (gameState.opponentTargetMarker) {
    gameState.opponentTargetMarker.visible = false;
  }
}

// Broadcast aim state to opponent (throttled)
function broadcastAimStateThrottled() {
  if (gameState.selectedMode !== 'online') return;

  const localTeam = multiplayer.multiplayerState.localPlayer.team;
  if (gameState.currentTeam !== localTeam) return;  // Not our turn

  const now = Date.now();
  if (now - gameState.lastAimBroadcast < 100) return;  // 10 updates/sec max
  gameState.lastAimBroadcast = now;

  if (gameState.targetPosition) {
    multiplayer.broadcastAimState(
      gameState.targetPosition.x,
      gameState.targetPosition.z,
      gameState.curlDirection,
      gameState.handleAmount
    );
  }
}

// Update skip's signal arm and beacon arrow based on curl direction
function updateSkipSignalArm() {
  if (!gameState.targetMarker) return;

  const signalArm = gameState.targetMarker.getObjectByName('signalArm');
  const signalHand = gameState.targetMarker.getObjectByName('signalHand');
  const rightBroomArm = gameState.targetMarker.getObjectByName('rightBroomArm');
  const curlArrow = gameState.targetMarker.getObjectByName('curlArrow');

  // curlDirection: 1 = IN (clockwise) = curl right
  // curlDirection: -1 = OUT (counter-clockwise) = curl left
  // curlDirection: null = not selected yet
  const direction = gameState.curlDirection;
  const skipZ = 0.6;

  // Hide arrow and arm if no direction selected
  if (direction === null) {
    if (curlArrow) curlArrow.visible = false;
    if (signalArm) signalArm.visible = false;
    if (signalHand) signalHand.visible = false;
    if (rightBroomArm) rightBroomArm.visible = false;
    return;
  }

  // Update beacon arrow direction (only visible in throw view, not target view)
  if (curlArrow) {
    // Only show arrow in throw view (previewHeight < 0.5), hide in target view
    curlArrow.visible = gameState.previewHeight < 0.5;
    curlArrow.rotation.z = direction > 0 ? -Math.PI / 2 : Math.PI / 2;
    curlArrow.position.x = direction * 0.5;
  }

  // Update skip's signal arm
  if (signalArm && signalHand) {
    signalArm.visible = true;
    signalHand.visible = true;
    signalArm.rotation.set(0, 0, Math.PI / 2);
    signalArm.position.set(direction * 0.2, 0.55, skipZ);
    signalHand.position.set(direction * 0.38, 0.55, skipZ);

    if (rightBroomArm) {
      rightBroomArm.visible = (direction === -1);
    }
  }
}

// Fade skip when stones are nearby to avoid visual overlap
function updateSkipFade() {
  // Need a target marker to fade
  if (!gameState.targetMarker) return;

  // Don't fade in target view - skip should always be visible from above
  if (gameState.previewHeight > 0.5) {
    // Ensure skip is fully visible in target view
    gameState.targetMarker.traverse((child) => {
      if (child.isMesh && child.name !== 'beacon' && child.name !== 'curlArrow') {
        if (child.material) {
          child.material.opacity = 1;
        }
      }
    });
    return;
  }

  // Get skip position - use targetMarker position or CPU target if available
  let skipWorldPos;
  if (gameState.targetPosition) {
    skipWorldPos = gameState.targetMarker.position.clone();
    skipWorldPos.z += 0.6;  // Skip stands 0.6m behind the broom pad
  } else if (gameState.computerShotTarget) {
    // CPU turn - use computer's target position
    skipWorldPos = { x: gameState.computerShotTarget.x, z: gameState.computerShotTarget.z + 0.6 };
  } else {
    // Default to tee line center
    skipWorldPos = { x: 0, z: TEE_LINE_FAR + 0.6 };
  }

  // Check distance to all moving stones
  let minDistance = Infinity;
  for (const stone of gameState.stones) {
    if (stone.outOfPlay) continue;
    const stonePos = stone.mesh.position;
    const dx = stonePos.x - skipWorldPos.x;
    const dz = stonePos.z - skipWorldPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    minDistance = Math.min(minDistance, distance);
  }

  // Fade skip when stone is within 1.5m, fully transparent at 0.3m
  const fadeStart = 1.5;
  const fadeEnd = 0.3;
  let opacity = 1;
  if (minDistance < fadeStart) {
    opacity = Math.max(0, (minDistance - fadeEnd) / (fadeStart - fadeEnd));
  }

  // Apply opacity to skip body parts (not beacon)
  gameState.targetMarker.traverse((child) => {
    if (child.isMesh && child.name !== 'beacon' && child.name !== 'curlArrow') {
      if (child.material) {
        child.material.transparent = true;
        child.material.opacity = opacity;
      }
    }
  });
}

function placeTargetMarker(screenX, screenY) {
  // Prevent player from placing marker during computer's turn
  if (gameState.gameMode === '1player' && gameState.currentTeam === gameState.computerTeam) {
    return false;
  }

  // Raycast from screen position to ice surface
  const mouse = new THREE.Vector2(
    (screenX / window.innerWidth) * 2 - 1,
    -(screenY / window.innerHeight) * 2 + 1
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  // Create a plane at ice level (y = 0)
  const icePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersection = new THREE.Vector3();

  if (raycaster.ray.intersectPlane(icePlane, intersection)) {
    // Check if click is within the sheet bounds and near the far house
    if (intersection.x >= -SHEET_WIDTH / 2 && intersection.x <= SHEET_WIDTH / 2 &&
        intersection.z >= HOG_LINE_FAR && intersection.z <= BACK_LINE_FAR) {
      // Create marker if it doesn't exist
      if (!gameState.targetMarker) {
        gameState.targetMarker = createTargetMarker();
      }

      // Position and show the marker (skip only, beacon hidden until throw view)
      gameState.targetMarker.position.x = intersection.x;
      gameState.targetMarker.position.z = intersection.z;
      gameState.targetMarker.visible = true;
      // Show skip and broom, hide tall beacon parts (will show when returning to throw)
      gameState.targetMarker.traverse((child) => {
        if (child.name === 'beacon' || child.name === 'curlArrow') {
          child.visible = false;
        } else {
          child.visible = true;
        }
      });
      gameState.targetPosition = { x: intersection.x, z: intersection.z };

      // Skip faces toward the thrower (hack end at z=0)
      // No rotation needed - skip is set up facing negative Z (toward thrower)
      gameState.targetMarker.rotation.y = 0;

      // Update signal arm for current curl direction
      updateSkipSignalArm();

      // Broadcast aim state to opponent in multiplayer
      broadcastAimStateThrottled();

      updateReturnButton();  // Show the return button
      updateMarkerHint();    // Hide the marker hint
      setCurlDisplayVisible(true);  // Show curl selection

      // Interactive tutorial: detect aim action
      onTutorialActionComplete('aim');

      // Tutorials are now handled by interactive tutorial at startup

      return true;  // Marker was placed
    }
  }
  return false;  // No marker placed
}

function clearTargetMarker() {
  if (gameState.targetMarker) {
    gameState.targetMarker.visible = false;
    gameState.targetPosition = null;
  }
  setCurlDisplayVisible(false);  // Hide curl selection
}

// Drag existing target marker to new position
function dragTargetMarker(screenX, screenY) {
  // Only allow dragging during interactive tutorial (not regular gameplay)
  if (!gameState.interactiveTutorialMode) return;

  // Only drag if marker exists and we're in target view
  if (!gameState.targetMarker || !gameState.targetMarker.visible) return;
  if (gameState.phase !== 'aiming') return;
  if (gameState.previewHeight < 0.3) return;  // Must be in target view

  // Prevent dragging during computer's turn
  if (gameState.gameMode === '1player' && gameState.currentTeam === gameState.computerTeam) {
    return;
  }

  // Raycast from screen position to ice surface
  const mouse = new THREE.Vector2(
    (screenX / window.innerWidth) * 2 - 1,
    -(screenY / window.innerHeight) * 2 + 1
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  const icePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersection = new THREE.Vector3();

  if (raycaster.ray.intersectPlane(icePlane, intersection)) {
    // Check if within valid bounds (near the far house)
    if (intersection.x >= -SHEET_WIDTH / 2 && intersection.x <= SHEET_WIDTH / 2 &&
        intersection.z >= HOG_LINE_FAR && intersection.z <= BACK_LINE_FAR) {

      // Update marker position
      gameState.targetMarker.position.x = intersection.x;
      gameState.targetMarker.position.z = intersection.z;
      gameState.targetPosition = { x: intersection.x, z: intersection.z };

      // Update skip signal arm
      updateSkipSignalArm();

      // Broadcast to opponent in multiplayer
      broadcastAimStateThrottled();
    }
  }
}

// ============================================
// AIMING LINE
// ============================================
function createAimLine() {
  // Create an arrow (line with arrowhead) using a group
  const arrowGroup = new THREE.Group();

  const material = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.8
  });

  // Line shaft (thin box)
  const lineWidth = 0.06;  // 6cm wide
  const lineHeight = 0.02; // 2cm tall
  const shaftGeometry = new THREE.BoxGeometry(lineWidth, lineHeight, 1);
  shaftGeometry.translate(0, 0, 0.5);  // Origin at start
  const shaft = new THREE.Mesh(shaftGeometry, material);
  arrowGroup.add(shaft);

  // Arrowhead (cone pointing forward)
  const headRadius = 0.15;  // 15cm radius
  const headLength = 0.3;   // 30cm long
  const headGeometry = new THREE.ConeGeometry(headRadius, headLength, 8);
  headGeometry.rotateX(Math.PI / 2);  // Point forward (Z direction)
  headGeometry.translate(0, 0, headLength / 2);  // Move so base is at origin
  const head = new THREE.Mesh(headGeometry, material);
  head.name = 'arrowhead';
  arrowGroup.add(head);

  arrowGroup.position.y = 0.03;  // Slightly above ice
  arrowGroup.visible = false;

  scene.add(arrowGroup);
  return arrowGroup;
}

function updateAimLine(angle) {
  if (!gameState.aimLine) {
    gameState.aimLine = createAimLine();
  }

  // Line length varies by difficulty
  // Easy: longer line (12m) to help with aiming, Medium/Hard: 5m
  const distance = gameState.settings.difficulty === 'easy' ? 12 : 5;

  const line = gameState.aimLine;

  // Position at the hack (start of throw)
  line.position.x = 0;
  line.position.z = HACK_Z;

  // Scale shaft to desired length
  line.scale.z = distance;

  // Position arrowhead at end of shaft
  // Since shaft spans 0-1 in local coords (before scaling), put head at z=1
  const arrowhead = line.getObjectByName('arrowhead');
  if (arrowhead) {
    arrowhead.position.z = 1;  // At end of shaft (local coords)
    arrowhead.scale.z = 1 / distance;  // Compensate for parent scale to keep head proportional
  }

  // Rotate to point in aim direction
  line.rotation.y = angle;

  line.visible = true;
}

function hideAimLine() {
  if (gameState.aimLine) {
    gameState.aimLine.visible = false;
  }
}

// Preview camera - look around before throwing by sliding mouse up/down
function updatePreviewCamera(x, y, isMouseMove = true) {
  if (gameState.phase !== 'aiming') return;

  // Calculate delta from last mouse position and update preview height
  // Skip panning if preview is locked
  if (isMouseMove && y !== undefined && !gameState.previewLocked && gameState.lastMousePos) {
    const deltaY = gameState.lastMousePos.y - y;  // Positive = moved up

    // Adjust preview height based on mouse movement (sensitivity factor)
    const sensitivity = 0.008;
    gameState.previewHeight += deltaY * sensitivity;

    // Clamp between 0 (thrower view) and 1 (max overhead)
    gameState.previewHeight = Math.max(0, Math.min(1, gameState.previewHeight));

    // Auto-lock when reaching the top - user can then freely position mouse to place marker
    if (gameState.previewHeight >= 0.95) {
      gameState.previewHeight = 1;  // Snap to top
      gameState.previewLocked = true;
    }

    // Store current position for next delta calculation
    gameState.lastMousePos = { x, y };
  }

  // Map preview height (0-1) to camera parameters
  const t = gameState.previewHeight;

  // Camera height: thrower's eye level to moderate overhead
  const minHeight = 1.5;
  const maxHeight = 12;
  let targetHeight = minHeight + t * (maxHeight - minHeight);

  // Apply pinch zoom in target view (t > 0.5)
  // Zoom > 1 brings camera closer for precision, zoom < 1 moves it farther
  if (t > 0.5 && gameState.targetViewZoom !== 1) {
    // At zoom=2, reduce height to 6m (half); at zoom=0.5, increase to 18m
    targetHeight = targetHeight / gameState.targetViewZoom;
    // Clamp to reasonable bounds
    targetHeight = Math.max(5, Math.min(20, targetHeight));
  }

  // Camera Z position - move forward toward far house when higher
  const minCamZ = -2;        // Behind hack at low view
  const maxCamZ = TEE_LINE_FAR - 5;  // Over the far house at high view
  const targetCamZ = minCamZ + t * (maxCamZ - minCamZ);

  // Look at the far house (slightly ahead of camera)
  const minLookZ = 10;
  const maxLookZ = TEE_LINE_FAR;
  const targetLookZ = minLookZ + t * (maxLookZ - minLookZ);

  // Smooth camera movement - keep centered on sheet (x=0) for straight view
  camera.position.x += (0 - camera.position.x) * 0.1;
  camera.position.y += (targetHeight - camera.position.y) * 0.1;
  camera.position.z += (targetCamZ - camera.position.z) * 0.1;
  camera.lookAt(0, 0, targetLookZ);

  // Update scoreboard visibility based on view
  updateScoreboardVisibility();
}

// Follow stone during sliding phase
function updateCameraFollow() {
  if (!gameState.activeStone) return;

  const stoneZ = gameState.activeStone.mesh.position.z;
  const stoneX = gameState.activeStone.mesh.position.x;

  if (gameState.phase === 'sliding') {
    // During sliding: camera follows behind and slightly above the stone
    const followDistance = 3;  // meters behind stone
    const followHeight = 1.8;  // meters above ice

    const targetZ = stoneZ - followDistance;
    const targetY = followHeight;

    // Lerp camera position for smooth following - keep centered (x=0) for straight view
    camera.position.x += (0 - camera.position.x) * 0.1;
    camera.position.y += (targetY - camera.position.y) * 0.1;
    camera.position.z += (targetZ - camera.position.z) * 0.1;

    // Look straight ahead down the center line
    const lookAheadZ = Math.min(stoneZ + 15, TEE_LINE_FAR);
    camera.lookAt(0, 0, lookAheadZ);

  } else if (gameState.phase === 'throwing' || gameState.phase === 'sweeping') {
    // During sweeping: overhead view that follows the stone and lowers as it approaches

    // Calculate how far stone is from the far house (0 = at house, 1 = at near hog)
    const distanceToHouse = TEE_LINE_FAR - stoneZ;
    const maxDistance = TEE_LINE_FAR - HOG_LINE_NEAR;
    const progressToHouse = Math.max(0, Math.min(1, 1 - (distanceToHouse / maxDistance)));

    // Height decreases as stone gets closer to house (from 15m down to 6m)
    const maxHeight = 15;
    const minHeight = 6;
    const targetY = maxHeight - (progressToHouse * (maxHeight - minHeight));

    // Camera stays behind stone but gets closer as it approaches
    const followDistance = 8 - (progressToHouse * 4);  // 8m to 4m behind
    const targetZ = stoneZ - followDistance;

    // Smooth camera movement - keep centered (x=0) for straight view
    camera.position.x += (0 - camera.position.x) * 0.05;
    camera.position.y += (targetY - camera.position.y) * 0.05;
    camera.position.z += (targetZ - camera.position.z) * 0.05;

    // Look straight down the center line at the stone's Z position
    camera.lookAt(0, 0, stoneZ + 2);
  }
}

function resetCameraToThrower() {
  animateCamera(
    { x: camera.position.x, y: camera.position.y, z: camera.position.z, lookAt: OVERHEAD_CAM.lookAt },
    THROWER_CAM,
    1000
  );
}

// ============================================
// THROWING MECHANICS
// ============================================

// Phase 1: Start aiming - click and drag back
function startPull(x, y) {
  if (gameState.phase !== 'aiming') return;

  // Prevent player from throwing during computer's turn
  if (gameState.gameMode === '1player' && gameState.currentTeam === gameState.computerTeam) {
    return;
  }

  // Prevent throwing if curl direction not selected
  if (gameState.curlDirection === null) {
    // Flash the handle display to indicate they need to select
    const curlDisplay = document.getElementById('curl-direction');
    if (curlDisplay) {
      curlDisplay.style.color = '#ef4444';
      const handleValue = document.getElementById('handle-value');
      if (handleValue) handleValue.textContent = 'MOVE SLIDER FIRST!';
      setTimeout(() => {
        updateCurlDisplay();
      }, 1500);
    }
    return;
  }

  // Tutorials are now handled by interactive tutorial at startup
  // No blocking tutorials needed here

  // Save pre-shot state for potential rollback on interruption
  savePreShotState();

  // Hide save button, show pause button when shot starts
  updateGameButtons(false);

  gameState.phase = 'charging';
  gameState.pullStart = { x, y };
  gameState.pullCurrent = { x, y };
  gameState.maxPower = 0;
  gameState.currentPower = 0;

  // Hide coach panel and target marker when throw starts
  const coachPanel = document.getElementById('coach-panel');
  if (coachPanel) coachPanel.style.display = 'none';
  if (gameState.coachTargetMarker) {
    scene.remove(gameState.coachTargetMarker);
    gameState.coachTargetMarker = null;
  }

  // Move curl display down to make room for power display
  const curlDisplay = document.getElementById('curl-display');
  if (curlDisplay) curlDisplay.style.top = '140px';

  document.getElementById('power-display').style.display = 'block';
  document.getElementById('power-bar').style.display = 'block';
  document.getElementById('phase-text').style.color = '#4ade80';
  document.getElementById('phase-text').textContent = 'Pull back to set effort...';

  // Hide shot type and effort text on hard difficulty
  const isHard = gameState.settings.difficulty === 'hard';
  document.getElementById('shot-type').style.display = isHard ? 'none' : 'block';
  document.getElementById('effort-text').style.display = isHard ? 'none' : 'block';
  document.getElementById('shot-type').textContent = 'Ultra Light Guard';
  document.getElementById('shot-type').style.color = '#60a5fa';
}

// Update aim and power during drag
function updatePull(x, y) {
  if (gameState.phase !== 'charging') return;
  if (!gameState.pullStart) return;  // Guard against null pullStart

  gameState.pullCurrent = { x, y };

  // Calculate pull distance (pulling down/back increases power)
  const dy = y - gameState.pullStart.y;
  const dx = x - gameState.pullStart.x;

  // Effort based on vertical pull (max at ~200px pull)
  const pullDistance = Math.max(0, dy);
  gameState.maxPower = Math.min(100, pullDistance / 2);
  gameState.currentPower = gameState.maxPower;

  // Aim angle based on horizontal offset
  gameState.aimAngle = Math.atan2(dx, 200) * 0.5;

  // Get shot type based on effort
  const shotType = getShotType(gameState.currentPower);

  // Update UI
  document.getElementById('power-value').textContent = Math.round(gameState.currentPower);
  document.getElementById('power-fill').style.width = gameState.currentPower + '%';
  document.getElementById('power-fill').style.background = shotType.color;
  document.getElementById('shot-type').textContent = shotType.name;
  document.getElementById('shot-type').style.color = shotType.color;

  // Show aiming line
  updateAimLine(gameState.aimAngle);
}

// Phase 2: Release drag = push off from hack, start sliding
function pushOff() {
  if (gameState.phase !== 'charging') return;

  // Must have some power to push off - if 0, cancel and return to aiming
  if (gameState.maxPower < 1) {
    gameState.phase = 'aiming';
    document.getElementById('power-display').style.display = 'none';
    hideAimLine();
    // Reset curl display position and restore save button (shot was canceled)
    const curlDisplay = document.getElementById('curl-display');
    if (curlDisplay) curlDisplay.style.top = 'max(20px, env(safe-area-inset-top))';
    updateGameButtons(true);
    return;
  }

  hideAimLine();  // Hide aiming line on push off
  gameState.phase = 'sliding';
  setCurlButtonsEnabled(false);  // Disable curl buttons during throw
  setCurlDisplayVisible(false);  // Hide curl slider during throw
  gameState.slideStartTime = Date.now();

  // Play throw sound - ensure audio context is resumed first
  soundManager.ensureAudioResumed();
  soundManager.playThrow();
  gameState.currentPower = gameState.maxPower;
  gameState.tLineCrossTime = null;  // Reset timing
  gameState.splitTime = null;
  gameState.nearHogCrossTime = null;  // Reset physics timing
  gameState.farHogCrossTime = null;
  gameState.stoneStopTime = null;

  // Create the stone and start it moving with the thrower
  const stone = createStone(gameState.currentTeam);
  stone.mesh.position.set(0, 0.06, 0);
  Matter.Body.setPosition(stone.body, { x: 0, y: 0 });

  // Calculate slide speed based on effort (0-100)
  // Linear interpolation between MIN and MAX slide speed
  const effortFactor = gameState.maxPower / 100;
  const slideSpeed = MIN_SLIDE_SPEED + effortFactor * (MAX_SLIDE_SPEED - MIN_SLIDE_SPEED);
  const initialVelocity = slideSpeed * PHYSICS_SCALE / 60;

  // Store slide speed for consistent velocity during aiming
  gameState.slideSpeed = initialVelocity;

  // Calculate initial aim angle from target position if set
  // Player's drag adjustment (aimAngle) is added to the base angle to target
  const isComputer = gameState.gameMode === '1player' && gameState.currentTeam === gameState.computerTeam;
  const playerAimAdjustment = gameState.aimAngle || 0;  // Save player's drag adjustment

  if (isComputer) {
    // Computer already set aimAngle in executeComputerShot - preserve it
    gameState.baseAimAngle = gameState.aimAngle;
  } else if (gameState.targetPosition) {
    // Base angle points to target, player's drag adjusts from there
    gameState.baseAimAngle = Math.atan2(gameState.targetPosition.x, gameState.targetPosition.z - HACK_Z);
    gameState.aimAngle = gameState.baseAimAngle + playerAimAdjustment;
  } else {
    // No target - use player's aim directly
    gameState.baseAimAngle = playerAimAdjustment;
    gameState.aimAngle = playerAimAdjustment;
  }

  // Set initial velocity toward the aim direction (proper trigonometry)
  const initialVelX = Math.sin(gameState.aimAngle) * initialVelocity;
  const initialVelY = Math.cos(gameState.aimAngle) * initialVelocity;
  Matter.Body.setVelocity(stone.body, { x: initialVelX, y: initialVelY });

  // During slide, stone shouldn't slow down (thrower is pushing it)
  stone.body.frictionAir = 0;

  gameState.stones.push(stone);
  gameState.activeStone = stone;

  // Get shot type for display
  const shotType = getShotType(gameState.maxPower);

  // Show release prompt with shot type
  document.getElementById('power-display').style.display = 'block';
  document.getElementById('power-bar').style.display = 'none';
  document.getElementById('phase-text').textContent = `${shotType.name} - CLICK to release!`;
  document.getElementById('phase-text').style.color = shotType.color;
  // Only show release warning for human players, not computer
  if (!isComputer) {
    document.getElementById('hold-warning').style.display = 'block';
    document.getElementById('hold-warning').textContent = '⚠️ TAP TO RELEASE! ⚠️';
  }
}

// Update aim during sliding phase based on mouse position
// NOTE: Disabled - stone now follows the aim line exactly toward the target
function updateSlidingAim(x) {
  // Stone follows the projected aim line, no adjustment based on finger position
  return;
}

// Update sliding phase - check for hog line violation and track timing
function updateSliding() {
  if (gameState.phase !== 'sliding') return;

  if (gameState.activeStone) {
    const body = gameState.activeStone.body;
    const stoneZ = body.position.y / PHYSICS_SCALE;  // Convert to meters

    // Thrower slows down during slide - stone loses momentum over distance
    // This means late release = less velocity = lighter weight
    const distanceFromHack = stoneZ;
    const slideDistance = HOG_LINE_NEAR;  // Max slide distance before release required

    // Decay factor: stone retains 70-100% of speed based on distance traveled
    // At hack (0m): 100% speed, at hog line (9.7m): 70% speed
    const decayFactor = 1.0 - (distanceFromHack / slideDistance) * 0.3;
    const currentSpeed = gameState.slideSpeed * Math.max(0.7, decayFactor);

    // Apply aim direction during slide (proper trigonometry)
    Matter.Body.setVelocity(body, {
      x: Math.sin(gameState.aimAngle) * currentSpeed,
      y: Math.cos(gameState.aimAngle) * currentSpeed
    });

    // Track T-line crossing for split time
    if (stoneZ >= TEE_LINE_NEAR && !gameState.tLineCrossTime) {
      gameState.tLineCrossTime = Date.now();
    }

    // Check if stone crossed hog line without being released - VIOLATION
    if (body.position.y >= HOG_LINE_Y) {
      // Calculate split time before violation
      if (gameState.tLineCrossTime) {
        gameState.splitTime = (Date.now() - gameState.tLineCrossTime) / 1000;
      }
      hogViolation();
    }
  }
}

// Hog line violation - stone removed from play
function hogViolation() {
  if (!gameState.activeStone) return;

  gameState.phase = 'waiting';
  document.getElementById('hold-warning').style.display = 'none';
  document.getElementById('power-display').style.display = 'none';
  document.getElementById('phase-text').textContent = 'HOG LINE VIOLATION!';

  // Remove the stone from play
  scene.remove(gameState.activeStone.mesh);
  Matter.Composite.remove(world, gameState.activeStone.body);
  gameState.stones = gameState.stones.filter(s => s !== gameState.activeStone);

  gameState.stonesThrown[gameState.currentTeam]++;
  updateStoneCountDisplay();
  gameState.activeStone = null;

  // Show violation message briefly then handle next action
  setTimeout(() => {
    // Interactive tutorial: let user try again
    if (gameState.interactiveTutorialMode) {
      document.getElementById('phase-text').textContent = 'Try again!';
      gameState.phase = 'aiming';
      gameState.stonesThrown[gameState.currentTeam]--;  // Don't count this attempt
      updateStoneCountDisplay();
      return;
    }

    // Practice mode: show result and allow retry
    if (gameState.practiceMode.active) {
      showPracticeResult(false, 'Hog Line Violation!');
      return;
    }

    nextTurn();
  }, 2000);
}

// Phase 3: Click again = release the stone (continues at same speed)
function releaseStone() {
  if (gameState.phase !== 'sliding') return;
  if (!gameState.activeStone || !gameState.activeStone.body) {
    console.error('[releaseStone] No active stone - aborting');
    return;
  }

  // Stop turn timer when shot is made
  stopTurnTimer();

  // Capture FGZ state before the throw
  captureFGZState();
  fgzThrownStone = gameState.activeStone;  // Track the stone being thrown

  // Capture pre-throw state for feedback (Learn Mode)
  if (gameState.learnMode.enabled) {
    const buttonPos = { x: 0, z: TEE_LINE_FAR };
    gameState.learnMode.preThrowState = {
      stones: gameState.stones.map(s => ({
        team: s.team,
        x: s.mesh.position.x,
        z: s.mesh.position.z,
        outOfPlay: s.outOfPlay,
        distFromButton: Math.sqrt(
          Math.pow(s.mesh.position.x - buttonPos.x, 2) +
          Math.pow(s.mesh.position.z - buttonPos.z, 2)
        )
      })),
      playerShotStone: gameState.stones.filter(s => s.team === 'red' && !s.outOfPlay)
        .sort((a, b) => {
          const distA = Math.sqrt(Math.pow(a.mesh.position.x, 2) + Math.pow(a.mesh.position.z - TEE_LINE_FAR, 2));
          const distB = Math.sqrt(Math.pow(b.mesh.position.x, 2) + Math.pow(b.mesh.position.z - TEE_LINE_FAR, 2));
          return distA - distB;
        })[0]?.mesh.position.z || null,
      opponentShotStone: gameState.stones.filter(s => s.team === 'yellow' && !s.outOfPlay)
        .sort((a, b) => {
          const distA = Math.sqrt(Math.pow(a.mesh.position.x, 2) + Math.pow(a.mesh.position.z - TEE_LINE_FAR, 2));
          const distB = Math.sqrt(Math.pow(b.mesh.position.x, 2) + Math.pow(b.mesh.position.z - TEE_LINE_FAR, 2));
          return distA - distB;
        })[0]?.mesh.position.z || null
    };
  }

  // Capture pre-throw state for shot feedback system
  capturePreThrowState();

  gameState.phase = 'throwing';

  // Capture initial throw speed for normalized curl calculation
  if (gameState.activeStone) {
    const vel = gameState.activeStone.body.velocity;
    gameState.initialThrowSpeed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
  }

  updateFastForwardButton();  // Show fast-forward button when stone starts moving
  document.getElementById('hold-warning').style.display = 'none';
  document.getElementById('power-display').style.display = 'none';
  document.getElementById('phase-text').style.color = '#4ade80';
  document.getElementById('phase-text').textContent = 'Released!';

  // Interactive tutorial: detect throw action
  onTutorialActionComplete('throw');

  // Hide green beacon and curl arrow but keep the skip visible
  if (gameState.targetMarker) {
    gameState.targetMarker.traverse((child) => {
      if (child.name === 'beacon' || child.name === 'curlArrow') {
        child.visible = false;
      }
    });
  }

  // Play release sound and start sliding sound
  soundManager.playRelease();
  soundManager.startSliding();

  // Stone continues at current velocity - NO speed change
  // Set angular velocity based on handle amount (for curl physics)
  // More handle = more rotation (rad/s) = straighter path
  const omega = CURL_PHYSICS.HANDLE_TO_OMEGA(gameState.handleAmount || 0);
  // Negate because: clockwise rotation (negative omega) = curl RIGHT, counterclockwise (positive) = curl LEFT
  const safeDirection = gameState.curlDirection || 1;  // Default to 1 if null
  const finalOmega = -safeDirection * omega;

  // VISUAL ROTATION: Inverted from handle - extremes = minimal rotation, middle = more rotation
  // Real curling: ~2-4 rotations over full travel for typical handle
  // Middle of slider (handle=0) → more visual rotation (~6 rotations = ~2.1 rad/s over 18s)
  // Extremes (handle=100) → minimal rotation (~1.5 rotations = ~0.5 rad/s over 18s)
  const visualOmegaMax = 2.1;   // rad/s at middle of slider
  const visualOmegaMin = 0.5;   // rad/s at extremes
  const handleAmount = gameState.handleAmount || 0;
  const curlDir = gameState.curlDirection || 1;  // Default to 1 if null
  const visualOmega = visualOmegaMax - (handleAmount / 100) * (visualOmegaMax - visualOmegaMin);
  gameState.activeStone.visualOmega = -curlDir * visualOmega;
  gameState.activeStone.visualAngle = 0;  // Track visual rotation separately

  // Debug logging for throw
  console.log(`THROW: curlDirection=${curlDir}, handleAmount=${handleAmount}, physicsOmega=${finalOmega.toFixed(2)}, visualOmega=${gameState.activeStone.visualOmega.toFixed(2)}`);

  // Clockwise (negative omega) curls right, counterclockwise (positive) curls left
  Matter.Body.setAngularVelocity(gameState.activeStone.body, finalOmega);

  // Now apply ice friction since thrower released
  // Determine if this is guard weight (slower shots affected more by ice conditioning)
  const releaseSpeed = Math.sqrt(
    gameState.activeStone.body.velocity.x ** 2 +
    gameState.activeStone.body.velocity.y ** 2
  );
  const isGuardWeight = releaseSpeed < 3.0; // Guards and light draws
  gameState.activeStone._isGuardWeight = isGuardWeight; // Store for sweeping friction
  gameState.activeStone.body.frictionAir = getIceFriction(isGuardWeight);

  gameState.stonesThrown[gameState.currentTeam]++;
  updateStoneCountDisplay();

  // Broadcast shot to opponent in multiplayer mode
  if (gameState.selectedMode === 'online') {
    const localTeam = multiplayer.multiplayerState.localPlayer.team;
    // Only broadcast if this is our shot
    if (gameState.currentTeam === localTeam) {
      multiplayer.broadcastShot(
        gameState.maxPower,
        gameState.aimAngle,
        gameState.curlDirection,
        gameState.handleAmount,
        gameState.currentTeam
      );
    }
  }

  // Camera will smoothly follow stone via updateCameraFollow()
  // Transition to sweeping phase after a brief moment
  setTimeout(() => {
    if (gameState.phase === 'throwing') {
      gameState.phase = 'sweeping';

      // Tutorials are now handled by interactive tutorial at startup
    }
  }, 500);
}

// Update curl from slider value (-100 to +100)
// Slider direction matches curl direction: left = curl left, right = curl right
// Absolute value determines handle amount (rotation rate)
window.updateCurlSlider = function(value) {
  const sliderValue = parseInt(value);

  // Slider direction = curl direction (intuitive)
  // Left (negative) = curl LEFT = counter-clockwise rotation
  // Right (positive) = curl RIGHT = clockwise rotation
  if (sliderValue < 0) {
    gameState.curlDirection = -1;  // Curl LEFT
  } else if (sliderValue > 0) {
    gameState.curlDirection = 1;   // Curl RIGHT
  } else {
    // At exactly 0, keep previous direction or default
    if (gameState.curlDirection === null) {
      gameState.curlDirection = 1;
    }
  }

  // Handle amount is the absolute value (0-100)
  gameState.handleAmount = Math.abs(sliderValue);

  // Remember player's preferences
  gameState.playerCurlDirection = gameState.curlDirection;
  gameState.playerHandleAmount = gameState.handleAmount;

  // Debug logging
  console.log(`Curl slider: value=${sliderValue}, direction=${gameState.curlDirection === 1 ? 'CW' : 'CCW'}, handleAmount=${gameState.handleAmount}`);

  updateCurlDisplay();
  updateSkipSignalArm();
  updatePreviewStoneRotation();

  // Interactive tutorial: detect curl action
  onTutorialActionComplete('curl');

  // Broadcast aim state to opponent in multiplayer
  broadcastAimStateThrottled();

  // Update Make Call button state in Skip mode
  if (gameState.practiceMode?.currentDrill === 'skip') {
    updateReturnButton();
  }
};

// Legacy function for compatibility (used by computer shots)
function setCurlDirection(direction) {
  gameState.curlDirection = direction;
  gameState.playerCurlDirection = direction;

  // Set slider to match direction with current handle amount
  // direction=-1 (curl left) → slider negative (left), direction=1 (curl right) → slider positive (right)
  const slider = document.getElementById('curl-slider');
  if (slider) {
    slider.value = direction * gameState.handleAmount;
  }

  updateCurlDisplay();
  updateSkipSignalArm();
  updatePreviewStoneRotation();

  // Broadcast aim state to opponent in multiplayer
  broadcastAimStateThrottled();
}

function updateCurlDisplay() {
  const handleValue = document.getElementById('handle-value');
  if (!handleValue) return;

  // Show direction and handle amount
  const direction = gameState.curlDirection === 1 ? 'CW ↻' :
                    gameState.curlDirection === -1 ? 'CCW ↺' : '—';
  const handle = gameState.handleAmount;

  // Describe the handle amount
  let handleDesc;
  if (handle < 20) {
    handleDesc = 'Very Light';  // Lots of curl, unpredictable
  } else if (handle < 40) {
    handleDesc = 'Light';       // More curl
  } else if (handle < 60) {
    handleDesc = 'Normal';      // Balanced
  } else if (handle < 80) {
    handleDesc = 'Heavy';       // Less curl, more stable
  } else {
    handleDesc = 'Max';         // Straightest path
  }

  handleValue.textContent = `${direction} • ${handleDesc} (${handle}%)`;

  // Color based on direction
  const curlDisplay = document.getElementById('curl-direction');
  if (curlDisplay) {
    if (gameState.curlDirection === 1) {
      curlDisplay.style.color = '#22c55e';  // Green for RIGHT
    } else if (gameState.curlDirection === -1) {
      curlDisplay.style.color = '#3b82f6';  // Blue for LEFT
    } else {
      curlDisplay.style.color = '#f59e0b';  // Orange for unset
    }
  }
}

function setCurlButtonsEnabled(enabled) {
  // Now controls slider instead of buttons
  const slider = document.getElementById('curl-slider');
  if (slider) {
    slider.disabled = !enabled;
    slider.style.opacity = enabled ? '1' : '0.5';
    slider.style.cursor = enabled ? 'pointer' : 'not-allowed';
  }
}

// Show/hide curl display based on target placement
function setCurlDisplayVisible(visible) {
  const curlDisplay = document.getElementById('curl-display');
  if (curlDisplay) {
    curlDisplay.style.display = visible ? 'block' : 'none';
  }

  if (visible) {
    // Initialize slider with player's remembered preference or default
    const slider = document.getElementById('curl-slider');
    if (slider) {
      const direction = gameState.playerCurlDirection || 1;  // Default to curl RIGHT
      const handle = gameState.playerHandleAmount ?? 0;      // Default to neutral (0)
      // direction matches slider side: -1 (left) = curl left, 1 (right) = curl right
      slider.value = direction * handle;

      // Apply the slider value to game state
      gameState.curlDirection = direction;
      gameState.handleAmount = handle;
      updateCurlDisplay();
    }
  }
}

// Expose to window for HTML button onclick
window.setCurl = setCurlDirection;

// Game mode toggle
window.setGameMode = function(mode) {
  // Handle online mode - close settings and show multiplayer lobby
  if (mode === 'online') {
    window.closeSettings();
    showMultiplayerLobby();
    return;
  }

  // Handle learn mode specially - it's a modifier on 1player mode
  if (mode === 'learn') {
    gameState.gameMode = '1player';
    gameState.learnMode.enabled = true;
    // Track learn mode page view for analytics
    analytics.trackPageView('learn_mode');
  } else {
    gameState.gameMode = mode;
    gameState.learnMode.enabled = false;
  }

  // Update button styles for new UI
  const btnCareer = document.getElementById('mode-career');
  const btnQuickplay = document.getElementById('mode-quickplay');
  const btnLearn = document.getElementById('learn-mode-btn');
  const quickPlayLevelSection = document.getElementById('quickplay-level-section');
  const learnLevelSection = document.getElementById('learn-level-section');
  const learnBadge = document.getElementById('learn-mode-badge');

  // Reset all buttons
  btnCareer.style.background = '#333';
  btnCareer.style.borderColor = '#666';
  btnQuickplay.style.background = '#333';
  btnQuickplay.style.borderColor = '#666';
  if (btnLearn) {
    btnLearn.style.background = '#333';
    btnLearn.style.borderColor = '#666';
  }

  // Hide all level sections
  if (quickPlayLevelSection) quickPlayLevelSection.style.display = 'none';
  if (learnLevelSection) learnLevelSection.style.display = 'none';
  if (learnBadge) learnBadge.style.display = 'none';

  if (mode === '1player') {
    // Career mode selected
    btnCareer.style.background = '#2d5a3d';
    btnCareer.style.borderColor = '#4ade80';
  } else if (mode === '2player') {
    // Quick play selected
    btnQuickplay.style.background = '#2d5a3d';
    btnQuickplay.style.borderColor = '#4ade80';
    if (quickPlayLevelSection) quickPlayLevelSection.style.display = 'block';
  } else if (mode === 'learn') {
    // Learn mode selected
    if (btnLearn) {
      btnLearn.style.background = '#2d5a3d';
      btnLearn.style.borderColor = '#4ade80';
    }
    if (learnBadge) learnBadge.style.display = 'inline';
    if (learnLevelSection) learnLevelSection.style.display = 'block';
  }

  // Update coach panel visibility
  updateCoachPanel();

  // Update arena for the new mode (Career uses career level, Quick Play uses selected difficulty)
  updateArenaForLevel();
};

// Quick Play level selector
window.setQuickPlayLevel = function(level) {
  gameState.settings.quickPlayLevel = level;

  // Update button styles
  const levelBtns = document.querySelectorAll('.level-btn');
  levelBtns.forEach(btn => {
    const btnLevel = parseInt(btn.dataset.level);
    if (btnLevel === level) {
      btn.style.background = '#2d5a3d';
      btn.style.borderColor = '#4ade80';
    } else {
      btn.style.background = '#333';
      btn.style.borderColor = '#666';
    }
  });

  // Update description
  const levelInfo = CAREER_LEVELS[level - 1];
  const desc = document.getElementById('quickplay-level-description');
  if (desc && levelInfo) {
    desc.textContent = `${levelInfo.name} level - ${levelInfo.difficultyLabel} difficulty`;
  }

  // Update arena for the new level
  updateArenaForLevel();
};

// Learn mode level selector
window.setLearnLevel = function(level) {
  gameState.learnMode.level = level;

  // Update button styles
  const levelBtns = document.querySelectorAll('.learn-level-btn');
  levelBtns.forEach(btn => {
    const btnLevel = parseInt(btn.dataset.level);
    if (btnLevel === level) {
      btn.style.background = '#2d5a3d';
      btn.style.borderColor = '#4ade80';
    } else {
      btn.style.background = '#333';
      btn.style.borderColor = '#666';
    }
  });

  // Update description
  const levelInfo = LEARN_LEVELS[level - 1];
  const desc = document.getElementById('learn-level-description');
  if (desc && levelInfo) {
    desc.textContent = levelInfo.description + ' - ' + levelInfo.features[0];
  }
};

// Toggle coach panel expand/collapse
window.toggleCoachPanel = function() {
  gameState.learnMode.panelExpanded = !gameState.learnMode.panelExpanded;
  const content = document.getElementById('coach-content');
  const toggle = document.getElementById('coach-toggle');
  if (content) {
    content.style.display = gameState.learnMode.panelExpanded ? 'block' : 'none';
  }
  if (toggle) {
    toggle.textContent = gameState.learnMode.panelExpanded ? '▼' : '▲';
  }
};

// Dismiss/hide the coach panel
window.dismissCoachSuggestion = function() {
  const panel = document.getElementById('coach-panel');
  const showBtn = document.getElementById('show-coach-btn');
  if (panel) {
    panel.style.display = 'none';
  }
  if (showBtn && gameState.learnMode.enabled) {
    showBtn.style.display = 'block';
  }
};

// Show the coach panel again
window.showCoachPanel = function() {
  const panel = document.getElementById('coach-panel');
  const showBtn = document.getElementById('show-coach-btn');
  if (panel) {
    panel.style.display = 'block';
    // Regenerate suggestion if needed
    if (!gameState.learnMode.currentSuggestion && gameState.phase === 'aiming') {
      generateCoachSuggestion();
    }
  }
  if (showBtn) {
    showBtn.style.display = 'none';
  }
};

// Update coach panel visibility and content
function updateCoachPanel() {
  const panel = document.getElementById('coach-panel');
  const showBtn = document.getElementById('show-coach-btn');
  if (!panel) return;

  // Only show in learn mode during player's turn
  const isPlayerTurn = gameState.currentTeam !== gameState.computerTeam;
  if (gameState.learnMode.enabled && isPlayerTurn && gameState.phase === 'aiming') {
    panel.style.display = 'block';
    if (showBtn) showBtn.style.display = 'none';  // Hide "show coach" button
    generateCoachSuggestion();
    // Tutorials are now handled by interactive tutorial at startup
  } else {
    panel.style.display = 'none';
    if (showBtn) showBtn.style.display = 'none';  // Also hide when not player's turn
  }
}

// Generate coach suggestion based on game state
function generateCoachSuggestion() {
  // Use the same logic as computer AI but generate human-readable suggestions
  const buttonPos = { x: 0, z: TEE_LINE_FAR };
  const playerTeam = 'red';  // Player is always red

  // Find all stones and categorize them (exclude out-of-play stones)
  const houseStonesPlayer = [];
  const houseStonesOpponent = [];
  const guardsPlayer = [];
  const guardsOpponent = [];

  for (const stone of gameState.stones) {
    // Skip out-of-play stones
    if (stone.outOfPlay) continue;

    const dx = stone.mesh.position.x - buttonPos.x;
    const dz = stone.mesh.position.z - buttonPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance <= RING_12FT + STONE_RADIUS) {
      // Stone is in the house
      if (stone.team === playerTeam) {
        houseStonesPlayer.push({ stone, distance, x: stone.mesh.position.x, z: stone.mesh.position.z });
      } else {
        houseStonesOpponent.push({ stone, distance, x: stone.mesh.position.x, z: stone.mesh.position.z });
      }
    } else if (stone.mesh.position.z >= HOG_LINE_FAR && stone.mesh.position.z < BACK_LINE_FAR) {
      // Stone is past far hog line but not in house - it's a guard
      if (stone.team === playerTeam) {
        guardsPlayer.push({ stone, x: stone.mesh.position.x, z: stone.mesh.position.z });
      } else {
        guardsOpponent.push({ stone, x: stone.mesh.position.x, z: stone.mesh.position.z });
      }
    }
  }

  // Debug logging
  console.log('[Coach] Analyzing game state:', {
    playerHouseStones: houseStonesPlayer.length,
    opponentHouseStones: houseStonesOpponent.length,
    playerGuards: guardsPlayer.length,
    opponentGuards: guardsOpponent.length,
    totalStones: gameState.stones.filter(s => !s.outOfPlay).length
  });

  houseStonesPlayer.sort((a, b) => a.distance - b.distance);
  houseStonesOpponent.sort((a, b) => a.distance - b.distance);

  const playerStonesLeft = 8 - gameState.stonesThrown[playerTeam];
  const hasHammer = gameState.hammer === playerTeam;
  const earlyEnd = playerStonesLeft >= 6;

  const playerHasShot = houseStonesPlayer.length > 0 &&
    (houseStonesOpponent.length === 0 || houseStonesPlayer[0].distance < houseStonesOpponent[0].distance);
  const opponentHasShot = houseStonesOpponent.length > 0 &&
    (houseStonesPlayer.length === 0 || houseStonesOpponent[0].distance < houseStonesPlayer[0].distance);

  // Generate suggestion
  let shotType, targetDesc, weight, curl, reason;
  let targetX = 0, targetZ = TEE_LINE_FAR;

  if (houseStonesPlayer.length === 0 && houseStonesOpponent.length === 0) {
    // Empty house - check if we have guards set up
    if (guardsPlayer.length > 0) {
      // We have a guard - draw behind it to the house
      shotType = 'Draw Behind Guard';
      targetDesc = 'Behind your guard, into the house';
      weight = 'Draw weight (55-62%)';
      reason = 'You have a guard set up! Now draw behind it into the house for a protected scoring position.';
      targetX = guardsPlayer[0].x * 0.8;  // Slightly toward center
      targetZ = TEE_LINE_FAR - 0.5;  // Top of house
      curl = targetX > 0 ? 1 : -1;  // Curl toward the guard line
    } else if (earlyEnd && hasHammer) {
      shotType = 'Guard';
      targetDesc = 'In front of the house';
      weight = 'Guard weight (40-50%)';
      reason = 'With hammer early in the end, place a guard to set up scoring opportunities later.';
      targetZ = HOG_LINE_FAR + 2;  // Just past far hog line
      curl = 1;
    } else if (earlyEnd && !hasHammer) {
      shotType = 'Draw';
      targetDesc = 'Top of the house (8-foot)';
      weight = 'Draw weight (50-60%)';
      reason = 'Without hammer, draw to the top of the house to establish position early.';
      targetZ = TEE_LINE_FAR - 0.8;
      curl = 1;
    } else {
      shotType = 'Draw to Button';
      targetDesc = 'Center of the house (button)';
      weight = 'Draw weight (55-65%)';
      reason = 'Empty house - draw to the button to establish a scoring stone.';
      curl = 1;
    }
  } else if (opponentHasShot) {
    // Opponent has shot rock - need to respond
    const shotStone = houseStonesOpponent[0];
    if (shotStone.distance < 0.5) {
      shotType = 'Takeout';
      targetDesc = 'Opponent\'s shot stone';
      weight = 'Takeout weight (72-80%)';
      reason = 'Opponent has a stone close to the button. Remove it to take back control.';
      targetX = shotStone.x;
      targetZ = shotStone.z;
      curl = targetX > 0 ? -1 : 1;
    } else if (earlyEnd && guardsPlayer.length < 2) {
      shotType = 'Guard';
      targetDesc = 'Center guard position';
      weight = 'Guard weight (45-50%)';
      reason = 'Early in the end - consider a guard to protect future draws or make opponent\'s takeout harder.';
      targetZ = HOG_LINE_FAR - 2;
      curl = 1;
    } else {
      shotType = 'Takeout';
      targetDesc = 'Opponent\'s shot stone';
      weight = 'Takeout weight (70-78%)';
      reason = 'Remove the opponent\'s scoring stone to prevent them from stealing points.';
      targetX = shotStone.x;
      targetZ = shotStone.z;
      curl = targetX > 0 ? -1 : 1;
    }
  } else if (playerHasShot) {
    // We have shot - protect it
    if (guardsPlayer.length < 2 && houseStonesPlayer[0].distance < RING_8FT) {
      shotType = 'Guard';
      targetDesc = 'In front of your shot stone';
      weight = 'Guard weight (45-52%)';
      reason = 'You have shot! Protect it with a guard to make it harder for opponent to remove.';
      targetX = houseStonesPlayer[0].x * 0.3;
      targetZ = HOG_LINE_FAR - 1.5;
      curl = targetX > 0.2 ? 1 : (targetX < -0.2 ? -1 : 1);
    } else {
      shotType = 'Draw';
      targetDesc = 'Next to your shot stone (freeze)';
      weight = 'Draw weight (52-58%)';
      reason = 'Add another stone close to your shot to increase potential score.';
      targetX = houseStonesPlayer[0].x + 0.3;
      targetZ = houseStonesPlayer[0].z;
      curl = targetX > 0 ? 1 : -1;
    }
  } else {
    // Default - draw to button
    shotType = 'Draw to Button';
    targetDesc = 'Center of the house';
    weight = 'Draw weight (55-65%)';
    reason = 'Draw to the button to establish scoring position.';
    curl = 1;
  }

  // Calculate aim point accounting for curl
  // In this game's physics:
  // IN-turn (curl=1) actually curls LEFT (-X direction)
  // OUT-turn (curl=-1) actually curls RIGHT (+X direction)
  // So to hit a center target with IN-turn, aim RIGHT so it curls left into center
  const effort = weight.includes('70') || weight.includes('80') ? 75 :
                 weight.includes('40') || weight.includes('50') ? 48 : 58;  // Estimate from weight description
  const normalizedEffort = effort / 100;
  const estimatedCurlDrift = (1.0 - normalizedEffort * 0.7) * 2.5;  // Same formula as computer AI
  // Positive curl (IN) curls left, so aim right (+compensation)
  // Negative curl (OUT) curls right, so aim left (-compensation)
  const curlCompensation = curl * estimatedCurlDrift * 0.6;
  const aimX = targetX + curlCompensation;

  // Determine aim direction instruction
  let aimInstruction = '';
  if (Math.abs(curlCompensation) > 0.3) {
    const aimDirection = curlCompensation > 0 ? 'RIGHT' : 'LEFT';
    const curlDirection = curl === 1 ? 'left' : 'right';
    aimInstruction = ` Aim ${aimDirection} of center - the stone will curl ${curlDirection} into the target.`;
  }

  // Store suggestion with both target and aim point
  gameState.learnMode.currentSuggestion = {
    shotType, targetX, targetZ, aimX, curl, weight, reason,
    aimInstruction
  };

  // Debug logging
  console.log('[Coach] Suggestion:', shotType, '| Target:', targetDesc, '| AimX:', aimX.toFixed(2), '| Curl:', curl);

  // Update coach panel
  const shotTypeEl = document.getElementById('coach-shot-type');
  const weightEl = document.getElementById('coach-weight-value');
  const curlEl = document.getElementById('coach-curl-value');
  const reasonEl = document.getElementById('coach-reason-text');
  const targetDescEl = document.getElementById('coach-target-desc');

  if (shotTypeEl) shotTypeEl.textContent = shotType;
  if (weightEl) weightEl.textContent = weight;

  // Enhanced curl instruction with aim direction
  const curlText = curl === 1 ? 'IN-turn (clockwise)' : 'OUT-turn (counter-clockwise)';
  if (curlEl) curlEl.textContent = curlText;

  if (reasonEl) {
    reasonEl.textContent = reason + aimInstruction;
  }
  if (targetDescEl) targetDescEl.textContent = targetDesc;

  // Update target marker on ice
  updateCoachTargetMarker();
}

// Create/update coach target marker on ice
function updateCoachTargetMarker() {
  const suggestion = gameState.learnMode.currentSuggestion;
  if (!suggestion || !gameState.learnMode.enabled) {
    // Remove marker if it exists
    if (gameState.coachTargetMarker) {
      scene.remove(gameState.coachTargetMarker);
      gameState.coachTargetMarker = null;
    }
    return;
  }

  // Create marker if it doesn't exist
  if (!gameState.coachTargetMarker) {
    const markerGroup = new THREE.Group();

    // Outer ring (pulsing)
    const outerRingGeo = new THREE.RingGeometry(0.35, 0.4, 32);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.name = 'outerRing';
    markerGroup.add(outerRing);

    // Inner dot
    const innerDotGeo = new THREE.CircleGeometry(0.08, 16);
    const innerDotMat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      side: THREE.DoubleSide
    });
    const innerDot = new THREE.Mesh(innerDotGeo, innerDotMat);
    innerDot.rotation.x = -Math.PI / 2;
    innerDot.position.y = 0.01;
    markerGroup.add(innerDot);

    markerGroup.position.y = 0.02;
    gameState.coachTargetMarker = markerGroup;
    scene.add(markerGroup);
  }

  // Update position - use aimX (where to aim) not targetX (where stone ends up)
  gameState.coachTargetMarker.position.x = suggestion.aimX !== undefined ? suggestion.aimX : suggestion.targetX;
  gameState.coachTargetMarker.position.z = suggestion.targetZ;

  // Animate pulse effect
  const outerRing = gameState.coachTargetMarker.getObjectByName('outerRing');
  if (outerRing) {
    const time = Date.now() * 0.003;
    const scale = 1 + Math.sin(time) * 0.15;
    outerRing.scale.set(scale, scale, 1);
    outerRing.material.opacity = 0.4 + Math.sin(time) * 0.2;
  }
}

// Show post-shot feedback after player's throw
function showPostShotFeedback() {
  // Skip feedback during interactive tutorial
  if (gameState.interactiveTutorialMode) {
    return;
  }

  const panel = document.getElementById('feedback-shot-panel');
  if (!panel) {
    // Fallback to normal flow if panel doesn't exist
    setTimeout(() => nextTurn(), 1500);
    return;
  }

  const buttonPos = { x: 0, z: TEE_LINE_FAR };
  let rating, result, tip;

  // Analyze what changed from pre-throw state
  const preState = gameState.learnMode.preThrowState;
  const playerStonesInPlay = gameState.stones.filter(s => s.team === 'red' && !s.outOfPlay);
  const playerStonesOutOfPlay = gameState.stones.filter(s => s.team === 'red' && s.outOfPlay);
  const opponentStonesInPlay = gameState.stones.filter(s => s.team === 'yellow' && !s.outOfPlay);
  const opponentStonesOutOfPlay = gameState.stones.filter(s => s.team === 'yellow' && s.outOfPlay);

  // The thrown stone is the most recently added player stone
  const thrownStone = gameState.stones.filter(s => s.team === 'red')[gameState.stonesThrown['red'] - 1];
  const thrownStoneOut = thrownStone?.outOfPlay;
  const thrownStoneReason = thrownStone?.outOfPlayReason;

  // Count what happened
  let opponentStonesRemoved = 0;
  let opponentStonesPromoted = 0;  // Moved into better position (into house or closer to button)
  let ownStonesKnockedOut = 0;

  if (preState) {
    // Check opponent stones
    const preOpponentStones = preState.stones.filter(s => s.team === 'yellow' && !s.outOfPlay);

    for (const prestone of preOpponentStones) {
      // Find this stone's current state
      const currentStone = opponentStonesInPlay.find(s =>
        Math.abs(s.mesh.position.x - prestone.x) < 3 &&
        Math.abs(s.mesh.position.z - prestone.z) < 3
      ) || opponentStonesOutOfPlay.find(s => s.outOfPlay);

      if (!currentStone || currentStone.outOfPlay) {
        opponentStonesRemoved++;
      } else {
        // Check if opponent stone moved into a better position
        const newDist = Math.sqrt(
          Math.pow(currentStone.mesh.position.x - buttonPos.x, 2) +
          Math.pow(currentStone.mesh.position.z - buttonPos.z, 2)
        );
        const wasInHouse = prestone.distFromButton <= RING_12FT + STONE_RADIUS;
        const nowInHouse = newDist <= RING_12FT + STONE_RADIUS;

        // Promoted = moved into house from outside, or moved significantly closer to button
        if ((!wasInHouse && nowInHouse) || (newDist < prestone.distFromButton - 0.5 && nowInHouse)) {
          opponentStonesPromoted++;
        }
      }
    }

    // Check own stones (excluding the just-thrown one which starts at the hack)
    // Stones at z < 10 are at/near the hack and being thrown, not existing stones
    const prePlayerStones = preState.stones.filter(s => s.team === 'red' && !s.outOfPlay && s.z > 10);
    for (const prestone of prePlayerStones) {
      const stillInPlay = playerStonesInPlay.some(s =>
        Math.abs(s.mesh.position.x - prestone.x) < 3 &&
        Math.abs(s.mesh.position.z - prestone.z) < 3
      );
      if (!stillInPlay) {
        ownStonesKnockedOut++;
      }
    }
  }

  // Determine feedback based on outcome
  if (thrownStoneOut) {
    // Thrown stone went out of play
    if (opponentStonesRemoved > 0 && thrownStoneReason === 'went past back line') {
      // Successful takeout but rolled out (hit and roll)
      rating = { text: 'Takeout!', color: '#4ade80' };
      result = `You removed ${opponentStonesRemoved} opponent stone${opponentStonesRemoved > 1 ? 's' : ''}, but your stone rolled out.`;
      tip = opponentStonesRemoved > 1 ? 'Great double takeout!' : 'Try to stick next time for better position.';
    } else if (thrownStoneReason === 'did not reach far hog line') {
      rating = { text: 'Too Light', color: '#ef4444' };
      result = 'Your stone did not reach the hog line.';
      tip = 'Try adding more weight or sweeping to help the stone travel further.';
    } else if (thrownStoneReason === 'went past back line') {
      rating = { text: 'Too Heavy', color: '#ef4444' };
      result = 'Your stone went through the house and out the back.';
      tip = 'Try using less weight next time.';
    } else if (thrownStoneReason === 'hit side wall') {
      rating = { text: 'Wide', color: '#ef4444' };
      result = 'Your stone went out the side.';
      tip = 'Check your aim direction and curl settings.';
    } else {
      rating = { text: 'Out of Play', color: '#ef4444' };
      result = 'Your stone went out of play.';
      tip = 'Try adjusting your weight and aim.';
    }
  } else if (opponentStonesPromoted > 0 && opponentStonesRemoved === 0) {
    // Bad outcome - promoted opponent stone(s) into house
    rating = { text: 'Uh Oh!', color: '#ef4444' };
    result = `You accidentally promoted ${opponentStonesPromoted} opponent stone${opponentStonesPromoted > 1 ? 's' : ''} into a better position.`;
    tip = 'Be careful when hitting stones - consider where they might end up.';
  } else if (ownStonesKnockedOut > 0 && opponentStonesRemoved === 0) {
    // Knocked own stone out
    rating = { text: 'Own Goal!', color: '#ef4444' };
    result = `You knocked ${ownStonesKnockedOut} of your own stone${ownStonesKnockedOut > 1 ? 's' : ''} out of play.`;
    tip = 'Be careful with your aim to avoid hitting your own stones.';
  } else if (opponentStonesRemoved > 0) {
    // Successful takeout
    const stonePos = thrownStone.mesh.position;
    const distFromButton = Math.sqrt(
      Math.pow(stonePos.x - buttonPos.x, 2) + Math.pow(stonePos.z - buttonPos.z, 2)
    );
    const inHouse = distFromButton <= RING_12FT + STONE_RADIUS;

    if (opponentStonesRemoved > 1) {
      rating = { text: 'Double!', color: '#4ade80' };
      result = `Excellent! You removed ${opponentStonesRemoved} opponent stones!`;
    } else if (inHouse) {
      rating = { text: 'Hit & Stick!', color: '#4ade80' };
      result = 'Great takeout! Your stone stayed in the house.';
    } else {
      rating = { text: 'Takeout!', color: '#4ade80' };
      result = 'You removed an opponent stone.';
      if (!inHouse) tip = 'Try to roll into the house after the hit for better position.';
    }
  } else {
    // No collisions - evaluate based on where stone landed
    const stonePos = thrownStone.mesh.position;
    const distFromButton = Math.sqrt(
      Math.pow(stonePos.x - buttonPos.x, 2) + Math.pow(stonePos.z - buttonPos.z, 2)
    );

    if (distFromButton <= BUTTON_RADIUS + STONE_RADIUS) {
      rating = { text: 'Button!', color: '#4ade80' };
      result = 'Perfect draw to the button!';
    } else if (distFromButton <= RING_4FT + STONE_RADIUS) {
      rating = { text: 'Great Shot!', color: '#4ade80' };
      result = 'Your stone came to rest in the 4-foot ring.';
    } else if (distFromButton <= RING_8FT + STONE_RADIUS) {
      rating = { text: 'Good Shot!', color: '#3b82f6' };
      result = 'Your stone came to rest in the 8-foot ring.';
    } else if (distFromButton <= RING_12FT + STONE_RADIUS) {
      rating = { text: 'In the House', color: '#f59e0b' };
      result = 'Your stone came to rest in the 12-foot ring.';
    } else if (stonePos.z >= HOG_LINE_FAR && stonePos.z < TEE_LINE_FAR - RING_12FT) {
      rating = { text: 'Guard', color: '#3b82f6' };
      result = 'Your stone is in guard position in front of the house.';
    } else if (stonePos.z >= TEE_LINE_FAR + RING_12FT) {
      rating = { text: 'Too Heavy', color: '#f59e0b' };
      result = 'Your stone went through the house.';
      tip = 'Try less weight next time.';
    } else {
      rating = { text: 'Okay', color: '#f59e0b' };
      result = 'Your stone is in play but outside the scoring area.';
    }

    // Check suggestion accuracy - compare what was suggested vs what happened
    const suggestion = gameState.learnMode.currentSuggestion;
    if (suggestion) {
      const targetDist = Math.sqrt(
        Math.pow(stonePos.x - suggestion.targetX, 2) +
        Math.pow(stonePos.z - suggestion.targetZ, 2)
      );

      // Determine what shot type was actually executed
      const inHouse = distFromButton <= RING_12FT + STONE_RADIUS;
      const isGuardPosition = stonePos.z >= HOG_LINE_FAR && stonePos.z < TEE_LINE_FAR - RING_12FT;
      const suggestedGuard = suggestion.shotType === 'guard' || suggestion.shotType === 'centerGuard' || suggestion.shotType === 'cornerGuard';
      const suggestedDraw = suggestion.shotType === 'draw' || suggestion.shotType === 'freeze' || suggestion.shotType === 'drawToButton';

      if (targetDist < 0.5) {
        tip = 'You hit the target! Great execution.';
      } else if (targetDist < 1.5) {
        tip = 'Close to the target - almost there!';
      } else if (suggestedGuard && inHouse) {
        // Called for guard but threw into the house
        tip = 'The coach suggested a guard, but your stone ended up in the house. Try less weight for guards.';
        rating = { text: 'Heavy', color: '#f59e0b' };
      } else if (suggestedDraw && isGuardPosition) {
        // Called for draw but came up short as a guard
        tip = 'The coach suggested a draw to the house, but your stone stopped short. Try a bit more weight.';
        rating = { text: 'Light', color: '#f59e0b' };
      }
    }
  }

  // Update panel content
  const ratingEl = document.getElementById('feedback-shot-rating');
  const resultEl = document.getElementById('feedback-shot-result');
  const tipEl = document.getElementById('feedback-shot-tip');

  if (ratingEl) {
    ratingEl.textContent = rating.text;
    ratingEl.style.color = rating.color;
  }
  if (resultEl) resultEl.textContent = result;
  if (tipEl) {
    if (tip) {
      tipEl.textContent = tip;
      tipEl.style.display = 'block';
    } else {
      tipEl.style.display = 'none';
    }
  }

  // Show panel
  panel.style.display = 'block';
}

// Dismiss shot feedback and continue
window.dismissShotFeedback = function() {
  const panel = document.getElementById('feedback-shot-panel');
  if (panel) panel.style.display = 'none';

  // Continue to next turn
  setTimeout(() => nextTurn(), 500);
};

// ============================================
// SHOT FEEDBACK TOAST SYSTEM
// ============================================

// Capture pre-throw state for shot evaluation
function capturePreThrowState() {
  const buttonPos = { x: 0, z: TEE_LINE_FAR };

  lastShotInfo.preThrowState = {
    stones: gameState.stones.map(s => ({
      team: s.team,
      x: s.mesh.position.x,
      z: s.mesh.position.z,
      outOfPlay: s.outOfPlay,
      distFromButton: Math.sqrt(
        Math.pow(s.mesh.position.x - buttonPos.x, 2) +
        Math.pow(s.mesh.position.z - buttonPos.z, 2)
      )
    }))
  };

  // Store current team
  lastShotInfo.team = gameState.currentTeam;
}

// Store player's shot intent (called when player sets target)
function capturePlayerShotIntent(targetX, targetZ, shotType, effort) {
  lastShotInfo.targetX = targetX;
  lastShotInfo.targetZ = targetZ;
  lastShotInfo.shotType = shotType || 'draw';  // Default to draw if not specified
  lastShotInfo.effort = effort;
}

// Evaluate practice mode shot outcome based on intended shot type
function evaluatePracticeShotOutcome(thrownStone) {
  const drillType = gameState.practiceMode.currentDrill;
  const buttonPos = { x: 0, z: TEE_LINE_FAR };
  const preState = lastShotInfo.preThrowState;
  const throwingTeam = lastShotInfo.team;

  // Stone position
  const stoneX = thrownStone.mesh.position.x;
  const stoneZ = thrownStone.mesh.position.z;
  const distFromButton = Math.sqrt(
    Math.pow(stoneX - buttonPos.x, 2) + Math.pow(stoneZ - buttonPos.z, 2)
  );

  // Position zones
  const isInHouse = distFromButton <= RING_12FT + STONE_RADIUS;
  const isInFourFoot = distFromButton <= RING_4FT + STONE_RADIUS;
  const isOnButton = distFromButton <= BUTTON_RADIUS + STONE_RADIUS;
  const isGuardPosition = stoneZ >= HOG_LINE_FAR && stoneZ < TEE_LINE_FAR - RING_12FT && !thrownStone.outOfPlay;
  const isShortOfHouse = stoneZ < TEE_LINE_FAR - RING_12FT && stoneZ >= HOG_LINE_FAR;

  // Check for takeout
  let removedOpponentStones = 0;
  if (preState) {
    const opponentTeam = throwingTeam === 'red' ? 'yellow' : 'red';
    const preOpponentStones = preState.stones.filter(s => s.team === opponentTeam && !s.outOfPlay);
    const currentOpponentStones = gameState.stones.filter(s => s.team === opponentTeam && !s.outOfPlay);
    removedOpponentStones = preOpponentStones.length - currentOpponentStones.length;
  }

  // Check for freeze (touching another stone)
  let isFreezing = false;
  const ownStones = gameState.stones.filter(s => s.team === throwingTeam && s !== thrownStone && !s.outOfPlay);
  for (const otherStone of ownStones) {
    const dx = stoneX - otherStone.mesh.position.x;
    const dz = stoneZ - otherStone.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < STONE_RADIUS * 2.5) {
      isFreezing = true;
      break;
    }
  }

  // Evaluate based on drill type (intended shot)
  switch (drillType) {
    case 'draw':
      // Draw should end in house
      if (thrownStone.outOfPlay) {
        return { type: 'nearMiss', category: 'justHeavy' };
      }
      if (isOnButton) {
        return { type: 'success', category: 'button' };
      }
      if (isInFourFoot) {
        return { type: 'success', category: 'fourFoot' };
      }
      if (isInHouse) {
        return { type: 'success', category: 'eightFoot' };
      }
      if (isShortOfHouse) {
        // Intended draw but ended up short - this is a miss, not a "great guard"
        return { type: 'nearMiss', category: 'almostHouse' };
      }
      return null;

    case 'guard':
      // Guard should stop in front of house
      if (thrownStone.outOfPlay) {
        return { type: 'nearMiss', category: 'justHeavy' };
      }
      if (isGuardPosition) {
        return { type: 'success', category: 'guard' };
      }
      if (isInHouse) {
        // Intended guard but went into house - too heavy
        return { type: 'nearMiss', category: 'justHeavy' };
      }
      if (stoneZ < HOG_LINE_FAR) {
        // Didn't even make it to the hog line
        return { type: 'nearMiss', category: 'almostHouse' };
      }
      return null;

    case 'takeout':
    case 'bump':
    case 'hitroll':
      // Takeout-type shots should remove opponent stones
      if (removedOpponentStones > 1) {
        return { type: 'success', category: 'doubleTakeout' };
      }
      if (removedOpponentStones === 1) {
        if (drillType === 'hitroll' && isInHouse && !thrownStone.outOfPlay) {
          return { type: 'success', category: 'hitAndStick' };
        }
        return { type: 'success', category: 'takeout' };
      }
      // Missed the takeout
      if (isInHouse && !thrownStone.outOfPlay) {
        // Ended up in house but didn't take out - wrong shot type executed
        return { type: 'nearMiss', category: 'almostTakeout' };
      }
      if (isGuardPosition) {
        // Ended as guard when trying to take out
        return { type: 'nearMiss', category: 'almostTakeout' };
      }
      if (thrownStone.outOfPlay) {
        return { type: 'nearMiss', category: 'justHeavy' };
      }
      return null;

    case 'freeze':
      // Freeze should touch own stone and stay in house
      if (thrownStone.outOfPlay) {
        return { type: 'nearMiss', category: 'justHeavy' };
      }
      if (isFreezing && isInHouse) {
        return { type: 'success', category: 'freeze' };
      }
      if (isInHouse) {
        // In house but not freezing
        return { type: 'nearMiss', category: 'almostHouse' };
      }
      if (isShortOfHouse) {
        return { type: 'nearMiss', category: 'almostHouse' };
      }
      return null;

    default:
      // For custom or unknown drills, fall through to regular evaluation
      return null;
  }
}

// Evaluate shot outcome and return feedback type
function evaluateShotOutcome() {
  const buttonPos = { x: 0, z: TEE_LINE_FAR };
  const config = SHOT_FEEDBACK_CONFIG;

  // Find the stone that was just thrown (most recent for the team that just threw)
  const throwingTeam = lastShotInfo.team;
  const teamStones = gameState.stones.filter(s => s.team === throwingTeam);
  const thrownStone = teamStones[teamStones.length - 1];

  if (!thrownStone) return null;

  // In practice mode, evaluate based on intended shot type
  if (gameState.practiceMode?.active) {
    return evaluatePracticeShotOutcome(thrownStone);
  }

  // Helper: Check if throwing team now has shot stone (closest to button)
  const allInPlayStones = gameState.stones.filter(s => !s.outOfPlay);
  const getDistFromButton = (stone) => {
    const dx = stone.mesh.position.x - buttonPos.x;
    const dz = stone.mesh.position.z - buttonPos.z;
    return Math.sqrt(dx * dx + dz * dz);
  };
  const stonesInHouse = allInPlayStones.filter(s => getDistFromButton(s) <= RING_12FT + STONE_RADIUS);
  const sortedByDist = stonesInHouse.sort((a, b) => getDistFromButton(a) - getDistFromButton(b));
  const hasShotStone = sortedByDist.length > 0 && sortedByDist[0].team === throwingTeam;

  // Check if stone went out of play
  if (thrownStone.outOfPlay) {
    // Analyze what happened before giving up
    const preState = lastShotInfo.preThrowState;
    if (preState) {
      const opponentTeam = throwingTeam === 'red' ? 'yellow' : 'red';
      const preOpponentStones = preState.stones.filter(s => s.team === opponentTeam && !s.outOfPlay);
      const currentOpponentStones = gameState.stones.filter(s => s.team === opponentTeam && !s.outOfPlay);

      // Check if we removed opponent stones (successful takeout even if we rolled out)
      const removedCount = preOpponentStones.length - currentOpponentStones.length;
      if (removedCount > 0) {
        if (removedCount > 1) {
          return { type: 'success', category: 'doubleTakeout' };
        }
        return { type: 'success', category: 'takeout' };
      }
    }

    // Stone went out without accomplishing anything - check for near miss
    const reason = thrownStone.outOfPlayReason;
    if (reason === 'went past back line') {
      return { type: 'nearMiss', category: 'justHeavy' };
    } else if (reason === 'hit side wall') {
      return { type: 'nearMiss', category: 'justWide' };
    }
    // Clear miss - no feedback
    return null;
  }

  const stoneX = thrownStone.mesh.position.x;
  const stoneZ = thrownStone.mesh.position.z;
  const distFromButton = Math.sqrt(
    Math.pow(stoneX - buttonPos.x, 2) +
    Math.pow(stoneZ - buttonPos.z, 2)
  );

  // Check for takeouts
  const preState = lastShotInfo.preThrowState;
  if (preState) {
    const opponentTeam = throwingTeam === 'red' ? 'yellow' : 'red';
    const preOpponentStones = preState.stones.filter(s => s.team === opponentTeam && !s.outOfPlay);
    const currentOpponentStones = gameState.stones.filter(s => s.team === opponentTeam && !s.outOfPlay);
    const removedCount = preOpponentStones.length - currentOpponentStones.length;

    if (removedCount > 1) {
      return { type: 'success', category: 'doubleTakeout' };
    } else if (removedCount === 1) {
      // Hit and stick if we're in the house
      if (distFromButton <= RING_12FT + STONE_RADIUS) {
        return { type: 'success', category: 'hitAndStick' };
      }
      return { type: 'success', category: 'takeout' };
    }

    // Check for near-miss on takeout attempt (clipped but didn't remove)
    // But if we now have shot stone, it's actually a good result!
    if (!hasShotStone) {
      for (const preStone of preOpponentStones) {
        const currentStone = currentOpponentStones.find(s => {
          const dx = Math.abs(s.mesh.position.x - preStone.x);
          const dz = Math.abs(s.mesh.position.z - preStone.z);
          return dx > 0.3 || dz > 0.3; // Stone moved
        });
        if (currentStone && !currentStone.outOfPlay) {
          // We hit something but didn't remove it
          return { type: 'nearMiss', category: 'almostTakeout' };
        }
      }
    }
  }

  // Check for freeze (touching another stone)
  const ownStones = gameState.stones.filter(s => s.team === throwingTeam && s !== thrownStone && !s.outOfPlay);
  for (const otherStone of ownStones) {
    const dx = stoneX - otherStone.mesh.position.x;
    const dz = stoneZ - otherStone.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < STONE_RADIUS * 2.5) {  // Touching or very close
      return { type: 'success', category: 'freeze' };
    }
  }

  // Evaluate draws by position
  if (distFromButton <= BUTTON_RADIUS + STONE_RADIUS) {
    return { type: 'success', category: 'button' };
  } else if (distFromButton <= RING_4FT + STONE_RADIUS) {
    return { type: 'success', category: 'fourFoot' };
  } else if (distFromButton <= RING_8FT + STONE_RADIUS) {
    return { type: 'success', category: 'eightFoot' };
  } else if (distFromButton <= RING_12FT + STONE_RADIUS) {
    return { type: 'success', category: 'twelveFoot' };
  }

  // Check for guard position (in play, in front of house)
  if (stoneZ >= HOG_LINE_FAR && stoneZ < TEE_LINE_FAR - RING_12FT) {
    return { type: 'success', category: 'guard' };
  }

  // Check for near misses (but not if we have shot stone - that's a win!)
  if (!hasShotStone) {
    // Just short of house
    if (distFromButton <= RING_12FT + STONE_RADIUS + config.thresholds.nearMissBuffer &&
        distFromButton > RING_12FT + STONE_RADIUS) {
      return { type: 'nearMiss', category: 'almostHouse' };
    }

    // Just through (past back line but close)
    if (stoneZ > BACK_LINE_FAR - 0.5 && stoneZ < BACK_LINE_FAR + 1) {
      return { type: 'nearMiss', category: 'justHeavy' };
    }
  }

  // If we have shot stone but didn't match other success categories, still give positive feedback
  if (hasShotStone && distFromButton <= RING_12FT + STONE_RADIUS) {
    return { type: 'success', category: 'twelveFoot' };
  }

  // Miss - no feedback to avoid noise
  return null;
}

// Get random message from category
function getRandomMessage(type, category) {
  const config = SHOT_FEEDBACK_CONFIG;
  const messages = type === 'success'
    ? config.successMessages[category]
    : config.nearMissMessages[category];

  if (!messages || messages.length === 0) return null;
  return messages[Math.floor(Math.random() * messages.length)];
}

// Show shot feedback toast
function showShotFeedbackToast(message, type) {
  const toast = document.getElementById('shot-feedback-toast');
  if (!toast) return;

  // Reset and set message
  toast.textContent = message;
  toast.className = 'shot-feedback-toast';

  // Force reflow to restart animation
  void toast.offsetWidth;

  // Add type class (triggers animation)
  toast.classList.add(type === 'success' ? 'success' : 'near-miss');
  toast.style.display = 'block';

  // Auto-dismiss after duration
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, -50%) scale(0.8) rotate(3deg)';
    toast.style.filter = 'blur(5px)';
    toast.style.transition = 'all 0.4s ease-out';
    setTimeout(() => {
      toast.style.display = 'none';
      toast.style.transform = '';
      toast.style.filter = '';
      toast.style.opacity = '';
      toast.style.transition = '';
    }, 400);
  }, SHOT_FEEDBACK_CONFIG.displayDuration);
}

// Main function to evaluate and show feedback
function processShotFeedback() {
  // Skip during interactive tutorial
  if (gameState.interactiveTutorialMode) return;

  // Skip if in learn mode (it has its own detailed feedback)
  if (gameState.learnMode && gameState.learnMode.enabled) return;

  const outcome = evaluateShotOutcome();
  if (!outcome) return;  // No feedback for clear misses

  const message = getRandomMessage(outcome.type, outcome.category);
  if (message) {
    showShotFeedbackToast(message, outcome.type);
  }

  // Crowd reactions based on shot outcome
  // Scale reactions based on game intensity (bigger reactions in tense moments)
  const gameIntensity = calculateGameIntensity();
  const intensityMultiplier = 0.7 + gameIntensity * 0.3; // 0.7 to 1.0

  if (outcome.type === 'success') {
    // Map shot categories to crowd cheer intensity
    const cheerIntensity = {
      button: 1.0,          // Perfect shot - big cheer
      fourFoot: 0.8,        // Great shot
      eightFoot: 0.5,       // Good shot
      twelveFoot: 0.3,      // Decent shot
      doubleTakeout: 0.95,  // Spectacular play
      hitAndStick: 0.7,     // Smart shot
      takeout: 0.6,         // Solid shot
      freeze: 0.75,         // Precision shot
      guard: 0.4            // Strategic shot
    };
    let intensity = cheerIntensity[outcome.category] || 0.5;
    intensity = Math.min(1, intensity * intensityMultiplier);
    soundManager.playCrowdCheer(intensity);

    // Big shots in tense moments get extra excitement
    if (gameIntensity > 0.6 && intensity > 0.7) {
      setTimeout(() => soundManager.playCrowdMurmur(), 800);
    }
  } else if (outcome.type === 'nearMiss') {
    // Sympathetic reaction from crowd
    soundManager.playCrowdOoh();

    // Dramatic near-miss in tense moment = gasp first
    if (gameIntensity > 0.5) {
      soundManager.playCrowdGasp();
    }
  } else if (outcome.type === 'miss') {
    // Stone went out of play or missed badly
    if (gameIntensity > 0.4) {
      soundManager.playCrowdGroan();
    }
  }
}

// Update scoreboard visibility based on camera view
function updateScoreboardVisibility() {
  const scoreboard = document.getElementById('scoreboard');
  const turnDiv = document.getElementById('turn');
  const turnRow = turnDiv?.parentElement?.parentElement;  // Get the outer flex container
  const stoneCount = document.getElementById('stone-count');
  const careerDisplay = document.getElementById('career-display');
  const pauseBtn = document.getElementById('pause-btn');
  const saveBtn = document.getElementById('save-scenario-btn');
  const settingsBtn = document.getElementById('settings-btn-top');

  // In practice mode, always hide scoreboard-related elements
  const inPracticeMode = gameState.practiceMode?.active;

  // Keep scoreboard hidden during aiming and charging phases (until thrower releases)
  // Also hide in practice mode and interactive tutorial
  const hideScoreboard = inPracticeMode || gameState.interactiveTutorialMode || gameState.phase === 'aiming' || gameState.phase === 'charging';

  // Sliding phase includes: sliding, throwing, sweeping
  const isSlidingPhase = gameState.phase === 'sliding' || gameState.phase === 'throwing' || gameState.phase === 'sweeping';

  // Check if it's CPU's turn
  const isCpuTurn = gameState.gameMode === '1player' && gameState.currentTeam === gameState.computerTeam;

  // Target view: aiming phase with camera looking at house
  const inTargetView = gameState.phase === 'aiming' && gameState.previewHeight > 0.5;

  // Save button extra conditions: not in practice mode, not multiplayer, not computer's turn
  const canShowSave = inTargetView &&
    !inPracticeMode &&
    gameState.selectedMode !== 'online' &&
    !isCpuTurn;

  if (scoreboard) scoreboard.style.display = hideScoreboard ? 'none' : '';
  if (turnRow) turnRow.style.display = hideScoreboard ? 'none' : '';
  if (stoneCount) stoneCount.style.display = hideScoreboard ? 'none' : '';
  if (careerDisplay) careerDisplay.style.display = hideScoreboard ? 'none' : '';

  // Settings and pause buttons swap - pause shows during player's sliding phase only
  const showPause = isSlidingPhase && !isCpuTurn;
  if (settingsBtn) settingsBtn.style.display = showPause ? 'none' : '';
  if (pauseBtn) pauseBtn.style.display = showPause ? '' : 'none';

  // Save button only shows in target view (with extra conditions)
  if (saveBtn) saveBtn.style.display = canShowSave ? '' : 'none';
}

// Return to throw view button
window.returnToThrowView = function() {
  // Prevent during computer's turn
  if (gameState.gameMode === '1player' && gameState.currentTeam === gameState.computerTeam) {
    return;
  }

  if (gameState.phase === 'aiming' && gameState.previewLocked) {
    // Check if marker has been placed (use targetPosition, not targetMarker object)
    if (!gameState.targetPosition) {
      showMarkerReminder();
      return;
    }

    // Handle Skip mode differently - evaluate the call instead of throwing
    if (gameState.practiceMode?.currentDrill === 'skip') {
      if (handleSkipMakeCall()) {
        return;  // Skip mode handled the call
      }
    }

    gameState.previewHeight = 0;  // Animate to thrower view
    gameState.targetViewZoom = 1;  // Reset zoom when leaving target view
    updateReturnButton();
    updateMarkerHint();
    updateScoreboardVisibility();  // Show scoreboard when returning to throw view

    // Interactive tutorial: detect ready action
    onTutorialActionComplete('ready');

    // Show the green beacon now that we're preparing to throw
    if (gameState.targetMarker) {
      gameState.targetMarker.traverse((child) => {
        if (child.name === 'beacon' || child.name === 'curlArrow') {
          child.visible = true;
        }
      });
      updateSkipSignalArm();  // Update arrow direction
    }
  }
};

// Show reminder to set marker
function showMarkerReminder() {
  // Check if reminder already visible
  let reminder = document.getElementById('marker-reminder');
  if (reminder) {
    // Pulse the existing reminder
    reminder.style.animation = 'none';
    void reminder.offsetWidth;
    reminder.style.animation = 'marker-reminder-pulse 0.5s ease';
    return;
  }

  // Create reminder element
  reminder = document.createElement('div');
  reminder.id = 'marker-reminder';
  reminder.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 24px;">👆</span>
      <div>
        <div style="font-weight: bold; margin-bottom: 4px;">Set Your Target First!</div>
        <div style="font-size: 13px; opacity: 0.9;">Tap on the ice to place your skip's marker</div>
      </div>
    </div>
  `;
  reminder.style.cssText = `
    position: fixed;
    top: 20%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(59, 130, 246, 0.95);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 15px;
    z-index: 1000;
    box-shadow: 0 8px 32px rgba(59, 130, 246, 0.4);
    animation: marker-reminder-enter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    pointer-events: none;
  `;

  document.body.appendChild(reminder);

  // Auto-dismiss after 2.5 seconds
  setTimeout(() => {
    if (reminder && reminder.parentNode) {
      reminder.style.opacity = '0';
      reminder.style.transform = 'translateX(-50%) translateY(-20px)';
      reminder.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        if (reminder.parentNode) {
          reminder.parentNode.removeChild(reminder);
        }
      }, 300);
    }
  }, 2500);
}

function updateReturnButton() {
  const btn = document.getElementById('return-to-throw');
  if (!btn) return;

  // Hide during tutorial until curl step is active (user clicked "Try it!" on curl)
  if (gameState.interactiveTutorialMode) {
    const currentStep = INTERACTIVE_TUTORIAL_STEPS[interactiveTutorialStep];
    const continueBtn = document.getElementById('tutorial-continue-btn');
    const continueBtnVisible = continueBtn && continueBtn.style.display !== 'none';

    // Hide during welcome, aim, and curl steps (show during 'ready' step so user can click it)
    if (currentStep && (currentStep.action === 'welcome' || currentStep.action === 'aim' || currentStep.action === 'curl')) {
      btn.style.display = 'none';
      return;
    }
    // Also hide if Continue button is visible (user hasn't proceeded yet)
    if (continueBtnVisible) {
      btn.style.display = 'none';
      return;
    }
  }

  // Show button when locked at far view (marker optional), but NOT for computer or opponent's turn
  if (gameState.phase === 'aiming' && gameState.previewLocked && gameState.previewHeight > 0.5 && !isInputBlocked()) {
    btn.style.display = 'block';

    // In Skip mode, change button text and behavior
    if (gameState.practiceMode?.currentDrill === 'skip') {
      btn.textContent = 'CALL';
      btn.style.fontSize = '28px';  // Slightly smaller to fit
      btn.style.padding = '16px 40px';  // Smaller padding
      // Check if all requirements are met
      const hasTarget = gameState.targetPosition !== null;
      const hasCurl = gameState.curlDirection !== null;
      const hasWeight = gameState.skipCallWeight !== null;
      const isReady = hasTarget && hasCurl && hasWeight;
      btn.style.opacity = isReady ? '1' : '0.5';
    } else {
      btn.textContent = 'READY';
      btn.style.fontSize = '32px';  // Reset to default
      btn.style.padding = '20px 50px';  // Reset to default
      btn.style.opacity = '1';
    }
  } else {
    btn.style.display = 'none';
  }
}

function updateMarkerHint() {
  const hint = document.getElementById('marker-hint');
  if (!hint) return;

  // Show hint when:
  // - In aiming phase
  // - Looking at the ice (preview height > 0.5, seeing the house)
  // - No marker currently placed this turn (check targetPosition, not targetMarker object)
  // - Not computer or opponent's turn
  const shouldShow = gameState.phase === 'aiming' &&
                     gameState.previewHeight > 0.5 &&
                     !gameState.targetPosition &&
                     !isInputBlocked();

  hint.style.display = shouldShow ? 'block' : 'none';
}

// ============================================
// T-LINE TIME DISPLAY
// ============================================
function displaySplitTime(time) {
  const splitDisplay = document.getElementById('split-time');
  if (!splitDisplay) return;

  // Color based on timing (green=slow/guard, red=fast/hit)
  // Based on actual game physics: draws ~2s, guards ~2.5s, takeouts ~1.5s
  let color;
  if (time >= 2.3) {
    color = '#34d399';  // Green - guard weight
  } else if (time >= 1.8) {
    color = '#fbbf24';  // Yellow - draw weight
  } else if (time >= 1.3) {
    color = '#f97316';  // Orange - takeout weight
  } else {
    color = '#ef4444';  // Red - hit/peel weight
  }

  splitDisplay.innerHTML = `<span style="color:${color}">${time.toFixed(1)}s</span> <span style="color:#9ca3af;">T-Time</span>`;
  splitDisplay.style.display = 'block';

  // Hide after 3 seconds
  setTimeout(() => {
    splitDisplay.style.display = 'none';
  }, 3000);
}

// Display hog-to-hog time (interval time / peel time)
function displayHogToHogTime(time) {
  const hogDisplay = document.getElementById('hog-to-hog-time');
  if (!hogDisplay) return;

  // Hog-to-hog time correlates with shot weight
  // Faster times = harder shots
  let color;
  if (time >= 14.0) {
    color = '#34d399';  // Green - very soft
  } else if (time >= 11.0) {
    color = '#fbbf24';  // Yellow - draw weight
  } else if (time >= 8.0) {
    color = '#f97316';  // Orange - takeout weight
  } else {
    color = '#ef4444';  // Red - peel/hit weight
  }

  hogDisplay.innerHTML = `<span style="color:#9ca3af; font-size: 14px;">Hog-to-hog:</span> <span style="color:${color}">${time.toFixed(1)}s</span>`;
  hogDisplay.style.display = 'block';

  // Hide after 2 seconds
  setTimeout(() => {
    hogDisplay.style.display = 'none';
  }, 2000);
}

// ============================================
// SWEEPING
// ============================================

// Calculate sweep effectiveness and direction from touch/mouse movement
// Now includes angle-based effectiveness: cos(angle) between sweep and stone velocity
function updateSweepFromMovement(x, y) {
  if (gameState.phase !== 'sweeping') return;
  if (!gameState.activeStone) return;

  // Check if this is the opponent's stone (defensive sweeping)
  // In 1-player mode, opponent is the computer
  // In multiplayer mode, opponent is the remote player
  let isOpponentStone = false;
  if (gameState.gameMode === '1player') {
    isOpponentStone = gameState.activeStone.team === gameState.computerTeam;
  } else if (gameState.selectedMode === 'online') {
    const localTeam = multiplayer.multiplayerState.localPlayer.team;
    isOpponentStone = gameState.activeStone.team !== localTeam;
  }

  // Defensive sweeping only allowed after stone passes the T-line
  if (isOpponentStone) {
    const stoneZ = gameState.activeStone.body.position.y / PHYSICS_SCALE;
    if (stoneZ < TEE_LINE_FAR) {
      return;
    }
    // Debug: log when defensive sweep is allowed
    if (!gameState._debugDefensiveSweepLogged) {
      gameState._debugDefensiveSweepLogged = true;
    }
  }

  const now = Date.now();

  // Add current position to tracking array
  gameState.sweepTouches.push({ x, y, time: now });

  // Keep only last 500ms of touches
  gameState.sweepTouches = gameState.sweepTouches.filter(t => now - t.time < 500);

  // Calculate speed and direction from recent movements
  if (gameState.sweepTouches.length >= 2) {
    let totalDistance = 0;
    let totalDx = 0;
    let totalDy = 0;

    for (let i = 1; i < gameState.sweepTouches.length; i++) {
      const dx = gameState.sweepTouches[i].x - gameState.sweepTouches[i-1].x;
      const dy = gameState.sweepTouches[i].y - gameState.sweepTouches[i-1].y;
      totalDistance += Math.sqrt(dx * dx + dy * dy);
      totalDx += dx;
      totalDy += dy;
    }

    const timeSpan = now - gameState.sweepTouches[0].time;
    const speed = timeSpan > 0 ? totalDistance / timeSpan : 0;

    // NEW SWEEP MODEL:
    // - Speed determines distance effect (friction reduction)
    // - Diagonal bias relative to curl direction affects curl
    // - Direction does NOT affect distance effectiveness

    // Distance effectiveness is based purely on speed
    const baseEffectiveness = Math.min(1, speed / 1.5);

    // Sweep effectiveness for distance = just speed (direction doesn't matter)
    gameState.sweepEffectiveness = baseEffectiveness;

    const wasSweeping = gameState.isSweeping;
    gameState.isSweeping = gameState.sweepEffectiveness > 0.1;
    gameState.lastSweepTime = now;

    // Calculate sweep vector for curl influence
    const sweepMagnitude = Math.sqrt(totalDx * totalDx + totalDy * totalDy);
    if (sweepMagnitude > 5 && gameState.activeStone) {
      gameState.sweepVector = {
        x: totalDx / sweepMagnitude,
        y: totalDy / sweepMagnitude
      };

      // Get stone's curl direction (which way it's curling)
      // Positive angular velocity = curling right (+X), Negative = curling left (-X)
      const omega = gameState.activeStone.body.angularVelocity;
      const curlingSide = omega > 0 ? 1 : -1; // 1 = curling right, -1 = curling left

      // Calculate horizontal bias of sweep (-1 = left, +1 = right)
      // totalDx is the horizontal component of sweep direction
      const horizontalBias = totalDx / sweepMagnitude;

      // Diagonal sweep curl influence:
      // - Sweeping toward the curl side (same direction stone is curling) = reduces curl
      // - Sweeping away from curl side = allows more curl
      // Value from -1 (max curl reduction) to +1 (max curl increase)
      // Positive curlingSide + positive horizontalBias = sweeping toward curl = reduce curl
      gameState.sweepCurlInfluence = -horizontalBias * curlingSide;

      // Only apply curl influence if there's meaningful diagonal bias
      // Pure vertical sweeping (up/down) has no curl effect
      const diagonalAmount = Math.abs(horizontalBias);
      if (diagonalAmount < 0.2) {
        gameState.sweepCurlInfluence = 0; // Too vertical, no curl effect
      } else {
        // Scale influence by how diagonal the sweep is and effectiveness
        gameState.sweepCurlInfluence *= diagonalAmount * baseEffectiveness;
      }

      // Store for display - angle from vertical (0 = straight up, 90 = horizontal)
      gameState.sweepAngle = Math.asin(Math.abs(horizontalBias)) * (180 / Math.PI);
    }

    // Debug: log sweep detection
    if (gameState.isSweeping && !wasSweeping) {
      const curlEffect = gameState.sweepCurlInfluence > 0.1 ? 'letting curl' :
                         gameState.sweepCurlInfluence < -0.1 ? 'reducing curl' : 'neutral';

      // Interactive tutorial: detect sweep action
      onTutorialActionComplete('sweep');
    }

    // Start/stop sweeping sound
    if (gameState.isSweeping && !wasSweeping) {
      soundManager.startSweeping();
    } else if (!gameState.isSweeping && wasSweeping) {
      soundManager.stopSweeping();
    }
  }
}

// Decay sweep effectiveness when not actively sweeping
function decaySweepEffectiveness() {
  const now = Date.now();
  const timeSinceLastSweep = now - gameState.lastSweepTime;

  // Decay over 200ms
  if (timeSinceLastSweep > 100) {
    gameState.sweepEffectiveness *= 0.9;
    if (gameState.sweepEffectiveness < 0.05) {
      gameState.sweepEffectiveness = 0;
      if (gameState.isSweeping) {
        gameState.isSweeping = false;
        soundManager.stopSweeping();
      }
    }
  }
}

// Computer AI sweeping - both offensive (own stones) and defensive (opponent stones)
function updateComputerSweeping() {
  if (gameState.gameMode !== '1player') return;
  if (gameState.phase !== 'sweeping') return;
  if (!gameState.activeStone) return;

  const stone = gameState.activeStone;
  const stoneX = stone.body.position.x / PHYSICS_SCALE;
  const stoneZ = stone.body.position.y / PHYSICS_SCALE;
  const velocity = stone.body.velocity;
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

  const isComputerStone = stone.team === gameState.computerTeam;
  const isPlayerStone = !isComputerStone;

  // Get current level for AI skill
  const level = getCurrentLevel();
  let skillFactor = 1 - level.difficulty; // Higher skill = lower difficulty value

  // Apply opponent sweeping skill if in tournament with personality
  const opponent = getCurrentOpponent();
  if (opponent && opponent.skills && opponent.skills.sweeping) {
    // Blend level difficulty with opponent's sweeping skill (0-100)
    // sweeping 100 = 0.95 skillFactor, sweeping 50 = 0.75, sweeping 0 = 0.55
    const sweepingSkill = opponent.skills.sweeping / 100;
    skillFactor = 0.55 + sweepingSkill * 0.4;
  }

  // Defensive sweeping: Player's stone, after T-line
  if (isPlayerStone && stoneZ >= TEE_LINE_FAR) {
    // Computer can defensively sweep player's stone to make it go too far
    // Sweep if the stone looks like it will stop in a good position
    const distanceToBack = BACK_LINE_FAR - stoneZ;
    const estimatedTravel = speed * 15; // Rough estimate of remaining distance

    // If stone will stop in the house (good for player), sweep it out
    const willStopInHouse = estimatedTravel < distanceToBack && estimatedTravel > 0.5;
    const stoneNearButton = Math.abs(stoneX) < 1.5 && stoneZ < BACK_LINE_FAR - 1;

    // Higher skill = more likely to defensively sweep at the right time
    const shouldDefensiveSweep = willStopInHouse && stoneNearButton && Math.random() < skillFactor * 0.8;

    if (shouldDefensiveSweep && speed > 0.5) {
      // Computer sweeps to push stone through (neutral curl influence - just distance)
      gameState.isSweeping = true;
      gameState.sweepEffectiveness = 0.7 + Math.random() * 0.3; // 70-100%
      gameState.sweepCurlInfluence = 0; // Computer uses neutral sweep
      gameState.lastSweepTime = Date.now();

      if (!gameState._computerSweepSoundStarted) {
        soundManager.startSweeping();
        gameState._computerSweepSoundStarted = true;
      }
      return;
    }
  }

  // Offensive sweeping: Computer's own stone
  if (isComputerStone && gameState.computerShotTarget) {
    const target = gameState.computerShotTarget;
    const distanceToTarget = target.z - stoneZ;
    const estimatedTravel = speed * 18; // Rough estimate based on friction

    // Decision: Will the stone reach its target?
    const willComeUpShort = estimatedTravel < distanceToTarget * 0.9;
    const needsMoreDistance = distanceToTarget > 2 && willComeUpShort;

    // For takeouts, always sweep to maintain speed
    const isTakeout = target.shotType === 'takeout' || target.shotType === 'peel';
    const shouldSweepTakeout = isTakeout && distanceToTarget > 3 && speed > 1;

    // For draws, sweep if coming up short
    const shouldSweepDraw = !isTakeout && needsMoreDistance && speed > 0.3;

    // Higher skill = better sweeping decisions
    const sweepDecision = (shouldSweepTakeout || shouldSweepDraw) && Math.random() < skillFactor * 0.9;

    if (sweepDecision) {
      // Computer sweeps its own stone (neutral curl influence - just distance)
      gameState.isSweeping = true;
      gameState.sweepEffectiveness = 0.6 + skillFactor * 0.4; // Better at higher levels
      gameState.sweepCurlInfluence = 0; // Computer uses neutral sweep for now
      gameState.lastSweepTime = Date.now();

      if (!gameState._computerSweepSoundStarted) {
        soundManager.startSweeping();
        gameState._computerSweepSoundStarted = true;
      }
      return;
    }
  }

  // Not sweeping - stop sound if it was playing
  if (gameState._computerSweepSoundStarted && !gameState.isSweeping) {
    soundManager.stopSweeping();
    gameState._computerSweepSoundStarted = false;
  }
}

function updateSweeping() {
  // If no active stone, ensure sweeping is stopped
  if (!gameState.activeStone) {
    if (gameState.isSweeping) {
      gameState.isSweeping = false;
      gameState.sweepEffectiveness = 0;
      soundManager.stopSweeping();
    }
    gameState._computerSweepSoundStarted = false;
    return;
  }

  // Let computer AI decide on sweeping
  updateComputerSweeping();

  decaySweepEffectiveness();

  // Friction varies based on sweep effectiveness
  // Full sweep = SWEEP_FRICTION, no sweep = ICE_FRICTION
  // Use ice conditioning based on shot weight and game progression
  const isGuardWeight = gameState.activeStone?._isGuardWeight || false;
  const currentIceFriction = getIceFriction(isGuardWeight);
  const currentSweepFriction = getSweepFriction(isGuardWeight);

  // ADVANCED PHYSICS 1A: Sweep effectiveness varies with stone speed
  const stoneVel = gameState.activeStone.body.velocity;
  const stoneSpeed = Math.sqrt(stoneVel.x * stoneVel.x + stoneVel.y * stoneVel.y);
  const sweepSpeedFactor = ADVANCED_PHYSICS.sweep.speedEffectCurve(stoneSpeed);
  const effectiveSweep = gameState.sweepEffectiveness * sweepSpeedFactor;

  const friction = currentIceFriction - (effectiveSweep * (currentIceFriction - currentSweepFriction));
  gameState.activeStone.body.frictionAir = friction;

  // Update sweep indicator (hide in Skip practice mode - no sweeping in strategic calls)
  const indicator = document.getElementById('sweep-indicator');
  if (gameState.practiceMode?.currentDrill === 'skip') {
    if (indicator) indicator.style.display = 'none';
  } else if (indicator && gameState.phase === 'sweeping') {
    const stoneZ = gameState.activeStone.body.position.y / PHYSICS_SCALE;
    // Check stone ownership - works for both 1-player and multiplayer
    let isOpponentStone = false;
    if (gameState.gameMode === '1player') {
      isOpponentStone = gameState.activeStone.team === gameState.computerTeam;
    } else if (gameState.selectedMode === 'online') {
      const localTeam = multiplayer.multiplayerState.localPlayer.team;
      isOpponentStone = gameState.activeStone.team !== localTeam;
    }
    const isPlayerStone = !isOpponentStone;
    const canPlayerSweep = !isOpponentStone || stoneZ >= TEE_LINE_FAR;

    // Check if computer is currently sweeping
    const computerIsSweeping = gameState._computerSweepSoundStarted;

    if (computerIsSweeping && gameState.isSweeping) {
      // Computer is sweeping (1-player mode only) - show what it's doing
      indicator.style.display = 'block';
      const intensity = Math.round(gameState.sweepEffectiveness * 100);
      if (isOpponentStone) {
        indicator.textContent = `🖥️ CPU SWEEPING ${intensity}%`;
        indicator.style.color = '#fbbf24'; // Yellow for computer
      } else {
        indicator.textContent = `🖥️ CPU DEFENSE ${intensity}%`;
        indicator.style.color = '#ef4444'; // Red for defensive sweep
      }
    } else if (!canPlayerSweep) {
      // Opponent's stone - player waiting for T-line (defensive sweep)
      indicator.style.display = 'block';
      indicator.innerHTML = 'Sweep past<br><span style="display:block;text-align:center;">T-Line</span>';
      indicator.style.color = '#888';
    } else if (gameState.isSweeping && !computerIsSweeping) {
      indicator.style.display = 'block';
      // Player is sweeping - show speed-based effectiveness and curl influence
      const intensity = Math.round(gameState.sweepEffectiveness * 100);
      const curlInfluence = gameState.sweepCurlInfluence;

      // Curl influence indicator
      let curlIndicator = '';
      let curlText = '';
      if (curlInfluence < -0.15) {
        curlIndicator = '⟨'; // Reducing curl (sweeping toward curl side)
        curlText = ' hold';
      } else if (curlInfluence > 0.15) {
        curlIndicator = '⟩'; // Letting it curl (sweeping away from curl)
        curlText = ' curl';
      } else {
        curlIndicator = '↑'; // Neutral/straight sweep
        curlText = '';
      }

      // Color based on speed effectiveness (brighter = faster sweep)
      const greenIntensity = Math.min(255, 128 + intensity);
      const color = `rgb(74, ${greenIntensity}, 128)`;

      indicator.textContent = `${curlIndicator} ${intensity}%${curlText}`;
      indicator.style.color = color;
    } else {
      // No one is sweeping - show ready message
      indicator.style.display = 'block';
      if (isOpponentStone) {
        indicator.textContent = canPlayerSweep ? 'SWEEP NOW!' : 'Waiting...';
      } else {
        indicator.textContent = 'SWEEP!';
      }
      indicator.style.color = '#4ade80';
    }
  } else if (indicator) {
    indicator.style.display = 'none';
  }
}

// ============================================
// COMPUTER AI
// ============================================
function isComputerTurn() {
  return gameState.gameMode === '1player' &&
         gameState.currentTeam === gameState.computerTeam &&
         gameState.phase === 'aiming';
}

// Check if it's the opponent's turn in multiplayer
function isOpponentTurn() {
  if (gameState.selectedMode !== 'online') return false;
  const localTeam = multiplayer.multiplayerState.localPlayer.team;
  return gameState.currentTeam !== localTeam;
}

// Check if player input should be blocked (computer or multiplayer opponent)
function isInputBlocked() {
  return isComputerTurn() || isOpponentTurn();
}

// Get current opponent's profile (from tournament or default)
function getCurrentOpponent() {
  // Check if in tournament with a current matchup
  if (seasonState.activeTournament && seasonState.activeTournament.currentMatchup) {
    const opponentTeam = getCurrentMatchOpponent(seasonState.activeTournament);
    if (opponentTeam && opponentTeam.opponent) {
      return opponentTeam.opponent;
    }
  }

  // Default opponent (no personality modifiers)
  return null;
}

// Calculate personality modifiers for shot selection
function getPersonalityModifiers(opponent) {
  // Default modifiers (neutral)
  const mods = {
    guardProbability: 50,       // Base 50% chance to play guard when appropriate
    takeoutAggression: 0,       // Effort modifier for takeouts
    drawPrecision: 0,           // Target tightness for draws
    riskShots: false,           // Attempt difficult shots
    earlyGuardMultiplier: 1,    // Multiplier for early-end guard tendency
    clutchVarianceMultiplier: 1 // Variance modifier in pressure situations
  };

  if (!opponent || !opponent.personality) {
    return mods;
  }

  const p = opponent.personality;

  // Aggression (0-100): affects guard vs takeout balance
  // High aggression = fewer guards, more takeouts, harder hits
  mods.guardProbability = Math.max(20, 70 - (p.aggression * 0.5));  // 70% at 0 aggression, 20% at 100
  mods.takeoutAggression = (p.aggression - 50) * 0.1;  // -5 to +5 effort modifier

  // Risk Tolerance (0-100): affects target tightness and difficult shot attempts
  mods.drawPrecision = (p.riskTolerance - 50) * 0.01;  // Tighter targets for high risk tolerance
  mods.riskShots = p.riskTolerance > 65;  // Attempt come-arounds and tricky shots

  // Patience (0-100): affects early-end strategy
  mods.earlyGuardMultiplier = 0.5 + (p.patience / 100);  // 0.5x to 1.5x guard tendency

  // Clutch Factor (0-100): affects variance in pressure situations
  // High clutch = lower variance under pressure, low clutch = higher variance
  mods.clutchVarianceMultiplier = 1 + ((50 - p.clutchFactor) / 100);  // 0.5x to 1.5x

  return mods;
}

// Calculate skill-based variance modifier
function getSkillVarianceModifier(opponent, shotType) {
  if (!opponent || !opponent.skills) {
    return 1.0;  // No modifier
  }

  const skills = opponent.skills;

  // Determine relevant skill based on shot type
  let skillValue;
  if (shotType === 'draw' || shotType === 'freeze' || shotType === 'guard' || shotType === 'come-around') {
    skillValue = skills.draw;
  } else if (shotType === 'takeout' || shotType === 'peel') {
    skillValue = skills.takeout;
  } else {
    skillValue = (skills.draw + skills.takeout) / 2;
  }

  // Convert skill (0-100) to variance multiplier
  // Skill 50 = 1.0x, Skill 100 = 0.5x (half variance), Skill 0 = 1.5x (more variance)
  return 1.5 - (skillValue / 100);
}

// Check if current game situation is a pressure situation
function isPressureSituation() {
  const playerTeam = gameState.computerTeam === 'yellow' ? 'red' : 'yellow';
  const scoreDiff = gameState.scores[gameState.computerTeam] - gameState.scores[playerTeam];
  const computerStonesLeft = 8 - gameState.stonesThrown[gameState.computerTeam];
  const isLateGame = gameState.end >= gameState.settings.gameLength - 1;
  const isCloseGame = Math.abs(scoreDiff) <= 2;

  return (computerStonesLeft <= 2 && isCloseGame) ||  // Last stones in close game
         (isLateGame && isCloseGame) ||                // Late in close game
         (computerStonesLeft === 1);                   // Last stone
}

// Apply consistency modifier to base variance
function applyConsistencyModifier(baseVariance, opponent) {
  if (!opponent || !opponent.personality) {
    return baseVariance;
  }

  const consistency = opponent.personality.consistency;
  // Consistency 100 = 0.6x variance (very consistent)
  // Consistency 50 = 1.0x variance (average)
  // Consistency 0 = 1.4x variance (inconsistent)
  const multiplier = 1.4 - (consistency / 100) * 0.8;

  return baseVariance * multiplier;
}

function getComputerShot() {
  // Get current opponent for personality modifiers
  const opponent = getCurrentOpponent();
  const personalityMods = getPersonalityModifiers(opponent);

  // Analyze the game situation
  const buttonPos = { x: 0, z: TEE_LINE_FAR };
  const playerTeam = gameState.computerTeam === 'yellow' ? 'red' : 'yellow';

  // Find all stones and categorize them
  const houseStonesComputer = [];
  const houseStonesPlayer = [];
  const guardsComputer = [];
  const guardsPlayer = [];

  for (const stone of gameState.stones) {
    const dx = stone.mesh.position.x - buttonPos.x;
    const dz = stone.mesh.position.z - buttonPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    // Check if stone is in the house
    if (distance <= RING_12FT + STONE_RADIUS) {
      if (stone.team === gameState.computerTeam) {
        houseStonesComputer.push({ stone, distance, x: stone.mesh.position.x, z: stone.mesh.position.z });
      } else {
        houseStonesPlayer.push({ stone, distance, x: stone.mesh.position.x, z: stone.mesh.position.z });
      }
    }
    // Check if stone is a guard (past far hog line but not in house)
    else if (stone.mesh.position.z >= HOG_LINE_FAR) {
      if (stone.team === gameState.computerTeam) {
        guardsComputer.push({ stone, x: stone.mesh.position.x, z: stone.mesh.position.z });
      } else {
        guardsPlayer.push({ stone, x: stone.mesh.position.x, z: stone.mesh.position.z });
      }
    }
  }

  // Sort house stones by distance to button
  houseStonesComputer.sort((a, b) => a.distance - b.distance);
  houseStonesPlayer.sort((a, b) => a.distance - b.distance);

  // Game situation analysis
  const computerStonesLeft = 8 - gameState.stonesThrown[gameState.computerTeam];
  const playerStonesLeft = 8 - gameState.stonesThrown[playerTeam];
  const hasHammer = gameState.hammer === gameState.computerTeam;
  const isLastStone = computerStonesLeft === 1;
  const earlyEnd = computerStonesLeft >= 6;

  // Scoring analysis
  const computerHasShot = houseStonesComputer.length > 0 &&
    (houseStonesPlayer.length === 0 || houseStonesComputer[0].distance < houseStonesPlayer[0].distance);
  const playerHasShot = houseStonesPlayer.length > 0 &&
    (houseStonesComputer.length === 0 || houseStonesPlayer[0].distance < houseStonesComputer[0].distance);

  // Count potential points
  let computerPoints = 0;
  let playerPoints = 0;
  if (computerHasShot) {
    for (const s of houseStonesComputer) {
      if (houseStonesPlayer.length === 0 || s.distance < houseStonesPlayer[0].distance) {
        computerPoints++;
      }
    }
  } else if (playerHasShot) {
    for (const s of houseStonesPlayer) {
      if (houseStonesComputer.length === 0 || s.distance < houseStonesComputer[0].distance) {
        playerPoints++;
      }
    }
  }

  let shotType, targetX, targetZ, effort, curl;

  // Difficulty affects CPU strategic decisions
  const difficulty = gameState.settings.difficulty;
  const isEasyMode = difficulty === 'easy';
  const isHardMode = difficulty === 'hard';

  // AI STRATEGY 4: HAMMER ADVANTAGE SCALING (stronger on hard mode)
  // Calculate score difference from AI's perspective
  const aiScore = gameState.computerTeam === 'red' ? gameState.scores.red : gameState.scores.yellow;
  const playerScore = gameState.computerTeam === 'red' ? gameState.scores.yellow : gameState.scores.red;
  const scoreDiff = aiScore - playerScore;  // Positive = AI leading
  const maxEnds = gameState.settings.gameLength || 8;

  // Get hammer advantage aggression modifier (only on medium/hard)
  let hammerAggressionMod = 1.0;
  if (!isEasyMode) {
    hammerAggressionMod = AI_STRATEGY.hammerAdvantage.getAggressionMod(
      hasHammer, gameState.end, maxEnds, scoreDiff
    );
    // Hard mode uses full hammer advantage; medium uses reduced
    if (!isHardMode) hammerAggressionMod = 1 + (hammerAggressionMod - 1) * 0.5;
  }

  // AI STRATEGY 6: STRATEGY MIX SHIFTS (stronger on hard mode)
  // Get shot type weights based on game state
  const shotMixWeights = AI_STRATEGY.shotMix.getWeights(scoreDiff, gameState.end, maxEnds, hasHammer);
  // Easy mode ignores mix weights; medium uses partial; hard uses full
  const mixInfluence = isEasyMode ? 0 : (isHardMode ? 1.0 : 0.5);

  // Guard probability incorporating strategy mix and hammer advantage
  const baseGuardProb = isEasyMode ? 0.25 : (isHardMode ? 0.6 : 0.45);
  // Blend base probability with strategy mix
  const strategyGuardProb = shotMixWeights.guard / (shotMixWeights.guard + shotMixWeights.draw);
  const blendedGuardProb = baseGuardProb * (1 - mixInfluence) + strategyGuardProb * mixInfluence;
  const guardProbability = personalityMods.guardProbability || blendedGuardProb;
  const shouldPlayGuard = Math.random() < guardProbability * hammerAggressionMod;

  // Takeout aggression modifier incorporating hammer advantage
  const baseAggression = isHardMode ? 1.05 : 1.0;
  const takeoutAggressionMod = (personalityMods.takeoutAggression || baseAggression) * hammerAggressionMod;

  // Strategic mistake chance: Easy AI sometimes makes poor shot choices
  const mistakeChance = isEasyMode ? 0.15 : (isHardMode ? 0 : 0.05);

  // Log AI strategy decision (dev only)
  if (isHardMode && gameState.end >= maxEnds - 1) {
    console.log(`[AI Strategy] End ${gameState.end}/${maxEnds}, Score: AI ${aiScore} - ${playerScore} Player, ` +
                `Hammer: ${hasHammer}, AggressionMod: ${hammerAggressionMod.toFixed(2)}, ` +
                `Mix: draw=${(shotMixWeights.draw*100).toFixed(0)}% guard=${(shotMixWeights.guard*100).toFixed(0)}% hit=${(shotMixWeights.hit*100).toFixed(0)}%`);
  }

  // Strategic decision making
  if (isLastStone && hasHammer) {
    // Last stone with hammer - maximize score or steal prevention
    if (playerHasShot) {
      // Must hit their shot stone
      shotType = 'takeout';
      targetX = houseStonesPlayer[0].x;
      targetZ = houseStonesPlayer[0].z;
      effort = (72 + Math.random() * 8) * takeoutAggressionMod;
    } else {
      // Draw for more points or to button
      shotType = 'draw';
      targetX = 0;
      targetZ = TEE_LINE_FAR;
      effort = 48 + Math.random() * 5;  // Draw weight to tee line
    }
  } else if (playerHasShot && playerPoints >= 2) {
    // Player scoring multiple - aggressive takeout
    shotType = 'takeout';
    targetX = houseStonesPlayer[0].x;
    targetZ = houseStonesPlayer[0].z;
    effort = (78 + Math.random() * 8) * takeoutAggressionMod;
  } else if (playerHasShot) {
    // Player has shot - decide between takeout and other options
    const shotStoneDistance = houseStonesPlayer[0].distance;

    if (shotStoneDistance < 0.3) {
      // Very close to button - must remove
      shotType = 'takeout';
      targetX = houseStonesPlayer[0].x;
      targetZ = houseStonesPlayer[0].z;
      effort = (75 + Math.random() * 8) * takeoutAggressionMod;
    } else if (earlyEnd && guardsComputer.length < 2 && shouldPlayGuard) {
      // Early in end, try to set up guards first (but not on easy mode often)
      shotType = 'guard';
      targetX = (Math.random() - 0.5) * 1.5;  // Keep guards more centered
      targetZ = HOG_LINE_FAR + 2 + Math.random() * 2;  // Guards go AFTER far hog line
      effort = 62 + Math.random() * 5;  // ~62-67% for guard weight
    } else {
      // Standard takeout
      shotType = 'takeout';
      targetX = houseStonesPlayer[0].x;
      targetZ = houseStonesPlayer[0].z;
      effort = (73 + Math.random() * 8) * takeoutAggressionMod;
    }
  } else if (computerHasShot && computerPoints >= 2) {
    // We're scoring multiple - protect with guard or add more
    if (guardsComputer.length < 2 && shouldPlayGuard && Math.random() > 0.3) {
      shotType = 'guard';
      // Place guard in front of scoring stones
      targetX = houseStonesComputer[0].x * 0.5;
      targetZ = HOG_LINE_FAR + 1.5 + Math.random() * 2;  // Guards go AFTER far hog line
      effort = 62 + Math.random() * 5;  // ~62-67% for guard weight
    } else {
      // Draw for more points
      shotType = 'draw';
      targetX = (Math.random() - 0.5) * 0.8;
      targetZ = TEE_LINE_FAR + (Math.random() - 0.5) * 0.5;
      effort = 48 + Math.random() * 5;  // Draw weight
    }
  } else if (computerHasShot) {
    // We have shot - protect or add
    if (shouldPlayGuard && Math.random() > 0.5 && guardsComputer.length < 2) {
      // Throw a guard
      shotType = 'guard';
      targetX = houseStonesComputer[0].x * 0.3 + (Math.random() - 0.5) * 0.8;
      targetZ = HOG_LINE_FAR + 2 + Math.random() * 2;  // Guards go AFTER far hog line
      effort = 62 + Math.random() * 5;  // ~62-67% for guard weight
    } else {
      // Freeze to our stone
      shotType = 'freeze';
      targetX = houseStonesComputer[0].x + (Math.random() - 0.5) * 0.3;
      targetZ = houseStonesComputer[0].z - STONE_RADIUS * 2.2;
      effort = 45 + Math.random() * 5;  // Light freeze weight
    }
  } else if (houseStonesComputer.length === 0 && houseStonesPlayer.length === 0) {
    // Empty house
    if (earlyEnd && hasHammer && shouldPlayGuard) {
      // Early with hammer - place guards (but not often on easy mode)
      shotType = 'guard';
      targetX = (Math.random() - 0.5) * 1.2;  // Keep more centered
      targetZ = HOG_LINE_FAR + 2 + Math.random() * 2;  // Guards go AFTER far hog line
      effort = 62 + Math.random() * 5;  // ~62-67% for guard weight
    } else if (earlyEnd && !hasHammer) {
      // Early without hammer - draw to top of house
      shotType = 'draw';
      targetX = (Math.random() - 0.5) * 1;
      targetZ = TEE_LINE_FAR - 1;
      effort = 50 + Math.random() * 4;  // Draw to top of house
    } else {
      // Draw to button
      shotType = 'draw';
      targetX = (Math.random() - 0.5) * 0.3;
      targetZ = TEE_LINE_FAR;
      effort = 48 + Math.random() * 5;  // Draw weight to button
    }
  } else if (guardsPlayer.length > 0 && !computerHasShot) {
    // Player has guards blocking - try to peel or come around
    // Check if FGZ rule applies (stones 1-4, stones outside house are protected)
    const totalThrown = gameState.stonesThrown.red + gameState.stonesThrown.yellow;
    const fgzActive = totalThrown < 4;
    const targetGuard = guardsPlayer[0];
    // Guard is protected if it's outside the 12-foot ring
    const distFromButton = Math.sqrt(targetGuard.x * targetGuard.x + Math.pow(targetGuard.z - TEE_LINE_FAR, 2));
    const guardProtected = distFromButton > RING_12FT + STONE_RADIUS;

    if (fgzActive && guardProtected) {
      // Can't peel FGZ-protected guard - must come around or draw
      console.log('[FGZ] Computer avoiding protected guard, playing around it');
      shotType = 'come-around';
      targetX = targetGuard.x > 0 ? -0.8 : 0.8;
      targetZ = TEE_LINE_FAR;
      effort = 48 + Math.random() * 4;  // Come-around weight
    } else if (Math.random() > 0.4) {
      // Peel the guard (FGZ not active or guard not in FGZ)
      shotType = 'peel';
      targetX = targetGuard.x;
      targetZ = targetGuard.z;
      effort = (85 + Math.random() * 10) * takeoutAggressionMod;
    } else {
      // Try to come around
      shotType = 'come-around';
      targetX = guardsPlayer[0].x > 0 ? -0.8 : 0.8;
      targetZ = TEE_LINE_FAR;
      effort = 48 + Math.random() * 4;  // Come-around weight
    }
  } else {
    // Default - draw to button area
    shotType = 'draw';
    targetX = (Math.random() - 0.5) * 0.6;
    targetZ = TEE_LINE_FAR + (Math.random() - 0.5) * 0.8;
    effort = 48 + Math.random() * 5;  // Draw weight
  }

  // Easy mode: occasionally make a strategic mistake
  if (Math.random() < mistakeChance) {
    console.log('[CPU] Making strategic mistake (easy mode)');
    // Convert optimal shot to suboptimal
    if (shotType === 'takeout' && houseStonesPlayer.length > 0) {
      // Miss the optimal target slightly
      targetX += (Math.random() - 0.5) * 1.5;
    } else if (shotType === 'draw') {
      // Draw too heavy or too light
      effort += (Math.random() > 0.5 ? 12 : -8);
    } else if (shotType === 'guard') {
      // Place guard in less optimal position
      targetX += (Math.random() - 0.5) * 1.0;
    }
  }

  // Determine curl direction based on target position and shot type
  if (shotType === 'takeout' || shotType === 'peel') {
    // For takeouts, curl toward the target (stone curves INTO target)
    curl = targetX > 0 ? -1 : 1;
  } else if (shotType === 'come-around') {
    // Come around curls away from guard then back
    curl = targetX > 0 ? 1 : -1;
  } else {
    // For draws/guards, pick curl direction to curve INTO the target
    // In this game: IN-turn (1) curls LEFT, OUT-turn (-1) curls RIGHT
    // If target is left of center, use IN-turn to curl left into it
    // If target is right of center, use OUT-turn to curl right into it
    curl = targetX > 0.2 ? -1 : (targetX < -0.2 ? 1 : (Math.random() > 0.5 ? 1 : -1));
  }

  // Calculate aim angle with proper curl compensation
  // In this game's physics:
  // IN-turn (curl=1) curls LEFT (-X direction)
  // OUT-turn (curl=-1) curls RIGHT (+X direction)
  const normalizedEffort = effort / 100;
  // Curl drift decreases with effort (fast stones curl less)
  // At effort 50 (draw): ~1m drift, at effort 80 (takeout): ~0.4m drift
  // Reduced from previous values to prevent over-compensation
  const estimatedCurlDrift = (1.0 - normalizedEffort * 0.7) * 1.2;

  // Compensate for curl:
  // IN-turn (curl=1) curls left, so aim RIGHT (+compensation)
  // OUT-turn (curl=-1) curls right, so aim LEFT (-compensation)
  const curlCompensation = curl * estimatedCurlDrift * 0.4; // 40% compensation (conservative)

  // Adjust aim: compensate for curl
  const aimX = targetX + curlCompensation;
  const aimAngle = Math.atan2(aimX, TEE_LINE_FAR - HACK_Z);

  // Add randomness based on difficulty setting
  // AI STRATEGY 5: SKILL TIERS - accuracy and variance by career tier
  const level = getCurrentLevel();

  // Map career tier to skill tier for quantified accuracy/variance
  const careerTier = gameState.careerLevel || seasonState?.activeTournament?.definition?.tier || 'provincial';
  const skillTier = AI_STRATEGY.skillTiers[careerTier] || AI_STRATEGY.skillTiers.provincial;

  // Base variance by difficulty setting
  const difficultyVariance = {
    easy: 0.025,   // ~1.4 degrees aim variance
    medium: 0.015, // ~0.9 degrees aim variance
    hard: 0.006    // ~0.3 degrees aim variance (very precise)
  };

  // Difficulty modifier for CPU accuracy (combines with skill tier)
  const cpuDifficultyMod = {
    easy: 1.3,    // CPU makes more mistakes
    medium: 1.0,  // Normal
    hard: 0.75    // CPU is more precise
  };
  const diffMod = cpuDifficultyMod[gameState.settings.difficulty] || 1.0;

  // Career mode: Use skill tier modifiers for accuracy and variance
  // Skill tier modifies both mean error and consistency
  let variance;
  if (gameState.gameMode === '1player' && gameState.inTournamentMatch) {
    // Tournament match: use skill tier variance modifier
    const baseVariance = 0.012; // Baseline for provincial level
    variance = baseVariance * skillTier.varianceMod * diffMod;
  } else if (gameState.gameMode === '1player') {
    // Quick play 1-player: scale by level difficulty
    variance = (0.005 + (level.difficulty / 0.12) * 0.020) * diffMod;
  } else {
    // Quick play difficulty-based
    variance = difficultyVariance[gameState.settings.difficulty] || difficultyVariance.medium;
  }

  // Apply skill tier mean error modifier (shifts aim systematically)
  const meanErrorMod = skillTier.meanErrorMod;

  // Guards and draws (low effort) require more precision
  // Skilled AI is more accurate on finesse shots; takeouts are forgiving due to speed
  if (effort < 70) {
    // For precision shots (draws, guards, freezes), significantly reduce variance
    // The lower the effort, the more precision is needed
    const effortFactor = effort / 70;  // 0.65-1.0 range
    const skillFactor = 1 - level.difficulty; // 0.88 for Club, 0.98 for Olympics

    // Draws and guards need 50-70% less variance than takeouts
    // Lower effort shots get more variance reduction (draws harder than guards)
    const precisionBonus = 0.3 + 0.4 * effortFactor;  // 0.3-0.7 multiplier
    variance = variance * precisionBonus * (0.7 + 0.3 * (1 - skillFactor));
  }

  // Apply opponent-specific skill variance (if in tournament with personality)
  if (opponent && opponent.skills) {
    const skillMod = getSkillVarianceModifier(opponent, shotType);
    variance = variance * skillMod;
  }

  // Apply consistency modifier (if opponent has personality)
  variance = applyConsistencyModifier(variance, opponent);

  // Apply clutch factor in pressure situations
  if (opponent && opponent.personality && isPressureSituation()) {
    const clutchFactor = opponent.personality.clutchFactor;
    // Clutch 100 = 0.7x variance (performs better under pressure)
    // Clutch 50 = 1.0x variance (average)
    // Clutch 0 = 1.3x variance (chokes under pressure)
    const clutchMod = 1.3 - (clutchFactor / 100) * 0.6;
    variance = variance * clutchMod;
  }

  // Apply variance (random consistency error)
  const accuracyVariance = (Math.random() - 0.5) * variance;

  // AI STRATEGY 5: Apply mean error modifier (systematic skill-based error)
  // meanErrorMod > 1 = more systematic error; < 1 = less error
  // Creates a small bias that varies per shot (but less random than variance)
  const meanErrorBias = (Math.random() - 0.5) * 0.005 * meanErrorMod;

  // Effort variance is proportional to base variance but scaled for weight control
  // Precision shots (draws, guards) should have tighter weight control
  let effortVarianceMultiplier = 15;
  if (effort < 70) {
    // Reduce effort variance for precision shots - CPU throws more consistent weight
    effortVarianceMultiplier = 8;
  }
  const effortVariance = (Math.random() - 0.5) * variance * effortVarianceMultiplier;
  // Mean error also affects weight control
  const effortMeanError = (Math.random() - 0.5) * 3 * meanErrorMod;

  const finalEffort = Math.min(100, Math.max(30, effort + effortVariance + effortMeanError));  // Min 30% effort
  let finalAimAngle = aimAngle + accuracyVariance + meanErrorBias;

  // Safety clamp: max angle of ~4° prevents wall hits (sheet edge is ~3.3° from center)
  const maxAimAngle = 0.07;  // ~4 degrees
  finalAimAngle = Math.max(-maxAimAngle, Math.min(maxAimAngle, finalAimAngle));

  const opponentName = opponent ? `${opponent.firstName} ${opponent.lastName}` : 'Generic AI';
  console.log('[COMPUTER SHOT]', opponentName, '-', shotType,
    '- target:', targetX.toFixed(2), targetZ.toFixed(2),
    '- effort:', finalEffort.toFixed(0) + '%',
    '- curl:', curl > 0 ? 'CCW' : 'CW',
    '- aimAngle:', (finalAimAngle * 180 / Math.PI).toFixed(1) + '°',
    opponent ? `(variance mod: skill=${getSkillVarianceModifier(opponent, shotType).toFixed(2)})` : '');

  return {
    shotType,
    targetX,
    targetZ,
    effort: finalEffort,
    aimAngle: finalAimAngle,
    curl
  };
}

// Schedule computer shot with retry mechanism to ensure it executes
// Adaptive delay that responds to fast-forward button in real-time
// Uses polling to check fast-forward state continuously
function cpuWait(normalDelay, callback) {
  let elapsed = 0;

  const check = () => {
    // Accumulate time faster when fast-forward is held
    const increment = gameState.cpuFastForward ? 100 : 10;  // 10x speed when held
    elapsed += increment;

    if (elapsed >= normalDelay) {
      callback();
    } else {
      setTimeout(check, 10);  // Check every 10ms
    }
  };

  setTimeout(check, 10);
}

function scheduleComputerShot() {
  // Cancel any existing scheduled shot
  if (gameState._computerShotTimeout) {
    clearTimeout(gameState._computerShotTimeout);
  }

  // Prevent scheduling if a computer shot is already in progress
  if (gameState._computerShotInProgress) {
    console.log('[COMPUTER] Shot already in progress, skipping schedule');
    return;
  }

  const attemptComputerShot = (attempts = 0) => {
    if (attempts >= 15) {
      console.error('[COMPUTER] Failed to execute shot after 15 attempts - forcing phase reset');
      // Force phase to aiming and try one more time
      if (gameState.gameMode === '1player' && gameState.currentTeam === gameState.computerTeam) {
        gameState.phase = 'aiming';
        executeComputerShot();
      }
      return;
    }

    const canShoot = gameState.phase === 'aiming' &&
                     gameState.gameMode === '1player' &&
                     gameState.currentTeam === gameState.computerTeam;

    console.log('[COMPUTER] Attempt', attempts + 1, '- canShoot:', canShoot,
      'phase:', gameState.phase, 'currentTeam:', gameState.currentTeam, 'computerTeam:', gameState.computerTeam);

    if (canShoot) {
      console.log('[COMPUTER] Conditions met, executing shot');
      executeComputerShot();
    } else {
      cpuWait(400, () => attemptComputerShot(attempts + 1));
    }
  };

  // Initial delay before first attempt
  cpuWait(800, () => attemptComputerShot());
}

function executeComputerShot() {
  console.log('[COMPUTER] executeComputerShot called:',
    'isComputerTurn():', isComputerTurn(),
    'gameMode:', gameState.gameMode,
    'currentTeam:', gameState.currentTeam,
    'computerTeam:', gameState.computerTeam,
    'phase:', gameState.phase);

  if (!isComputerTurn()) {
    console.log('[COMPUTER] Not computer turn - returning');
    return;
  }

  // Prevent double-throws: check if computer already threw more stones than player
  // In alternating turns, computer can be at most 1 ahead (if they throw first)
  const computerStones = gameState.stonesThrown[gameState.computerTeam];
  const playerTeam = gameState.computerTeam === 'yellow' ? 'red' : 'yellow';
  const playerStones = gameState.stonesThrown[playerTeam];

  if (computerStones > playerStones + 1) {
    console.warn('[COMPUTER] Already threw 2+ more stones than player, skipping to prevent double-throw');
    return;
  }

  // Mark that a computer shot is in progress
  gameState._computerShotInProgress = true;

  // Save pre-shot state for potential rollback on interruption
  savePreShotState();

  // Capture pre-throw state for shot feedback system
  capturePreThrowState();

  const shot = getComputerShot();

  // Store shot target for sweeping decisions
  gameState.computerShotTarget = {
    x: shot.targetX,
    z: shot.targetZ,
    shotType: shot.shotType,
    effort: shot.effort
  };

  // Show what the computer is doing
  console.log(`Computer playing: ${shot.shotType}, effort: ${shot.effort.toFixed(0)}%`);

  // Set up the shot
  gameState.curlDirection = shot.curl;

  // Computer chooses handle amount based on shot type
  // Guards: lighter handle (more curl to get around stones)
  // Draws: medium handle (balanced)
  // Takeouts: heavier handle (straighter, more predictable)
  let computerHandle;
  if (shot.effort < 40) {
    computerHandle = 30 + Math.random() * 20;  // 30-50% for guards (more curl)
  } else if (shot.effort < 70) {
    computerHandle = 45 + Math.random() * 20;  // 45-65% for draws (balanced)
  } else {
    computerHandle = 60 + Math.random() * 30;  // 60-90% for takeouts (straighter)
  }
  gameState.handleAmount = computerHandle;

  updateCurlDisplay();

  // Simulate the throw sequence with adaptive delays (responds to fast-forward in real-time)
  cpuWait(1500, () => {
    // Start charging phase
    gameState.phase = 'charging';
    gameState.maxPower = shot.effort;
    gameState.currentPower = shot.effort;
    gameState.aimAngle = shot.aimAngle;

    // Show power display briefly
    const shotTypeInfo = getShotType(shot.effort);
    const isHard = gameState.settings.difficulty === 'hard';
    document.getElementById('power-display').style.display = 'block';
    document.getElementById('power-bar').style.display = 'block';
    document.getElementById('power-value').textContent = Math.round(shot.effort);
    document.getElementById('power-fill').style.width = shot.effort + '%';
    document.getElementById('shot-type').style.display = isHard ? 'none' : 'block';
    document.getElementById('effort-text').style.display = isHard ? 'none' : 'block';
    document.getElementById('shot-type').textContent = shotTypeInfo.name;
    document.getElementById('shot-type').style.color = shotTypeInfo.color;

    updateAimLine(shot.aimAngle);

    cpuWait(1000, () => {
      // Push off
      hideAimLine();
      pushOff();

      cpuWait(800, () => {
        // Release stone
        if (gameState.phase === 'sliding') {
          releaseStone();
        }
      });
    });
  });
}

// ============================================
// PHYSICS UPDATE
// ============================================
function updatePhysics() {
  try {
  // Skip physics if game is paused (backgrounded) or tutorial is pausing
  if (gameState.isPaused || gameState.learnMode.tutorialPaused) {
    return;
  }

  // Fast-forward: run physics multiple times per frame during stone movement (except online)
  const canFastForward = gameState.cpuFastForward &&
                         gameState.selectedMode !== 'online' &&
                         (gameState.phase === 'throwing' || gameState.phase === 'sweeping');

  // Run physics 5x per frame when fast-forwarding
  const physicsIterations = canFastForward ? 5 : 1;

  for (let i = 0; i < physicsIterations; i++) {
    Matter.Engine.update(engine, 1000 / 60);
    // Track simulated game time (unaffected by fast-forward for accurate timing display)
    gameState.gameTime += 1000 / 60;
  }

  // Update sliding phase
  updateSliding();

  // Sync 3D meshes with physics bodies
  for (const stone of gameState.stones) {
    // Guest: use host's positions directly if available (host is authoritative)
    if (gameState.selectedMode === 'online' && !multiplayer.multiplayerState.isHost && stone._targetPos) {
      // Smoothly interpolate mesh toward host position
      const targetX = stone._targetPos.x / PHYSICS_SCALE;
      const targetZ = stone._targetPos.y / PHYSICS_SCALE;
      stone.mesh.position.x += (targetX - stone.mesh.position.x) * 0.3;
      stone.mesh.position.z += (targetZ - stone.mesh.position.z) * 0.3;

      // Also update physics body to stay in sync
      Matter.Body.setPosition(stone.body, { x: stone._targetPos.x, y: stone._targetPos.y });
      if (stone._targetVel) {
        Matter.Body.setVelocity(stone.body, { x: stone._targetVel.x, y: stone._targetVel.y });
      }
    } else {
      stone.mesh.position.x = stone.body.position.x / PHYSICS_SCALE;
      stone.mesh.position.z = stone.body.position.y / PHYSICS_SCALE;
    }

    // Visual rotation: use separate visual omega for realistic rotation speed
    // Active stone uses visual rotation (inverted from handle), stationary stones stay put
    if (stone === gameState.activeStone && stone.visualOmega !== undefined && !isNaN(stone.visualOmega)) {
      // Update visual angle based on visual omega (frame rate independent)
      const vel = stone.body.velocity;
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      if (speed > 0.2) {
        // Stone is moving - rotate visually
        stone.visualAngle = (stone.visualAngle || 0) + stone.visualOmega / 60;  // Assuming ~60fps
        stone.mesh.rotation.y = stone.visualAngle;
      }
      // When stopped, keep final rotation angle
    } else if (stone.visualAngle !== undefined && !isNaN(stone.visualAngle)) {
      // Stone was thrown but now stopped - keep its final visual angle
      stone.mesh.rotation.y = stone.visualAngle;
    }
    // Stationary/practice stones keep default rotation (0)
  }

  // Host: broadcast stone positions periodically during movement
  if (gameState.selectedMode === 'online' && multiplayer.multiplayerState.isHost) {
    if (gameState.phase === 'throwing' || gameState.phase === 'sweeping') {
      const now = Date.now();
      if (now - gameState.lastPositionSync > 100) {  // ~10 updates/sec
        gameState.lastPositionSync = now;
        const positions = gameState.stones.map((stone, index) => ({
          index: index,
          x: stone.body.position.x,
          y: stone.body.position.y,
          vx: stone.body.velocity.x,
          vy: stone.body.velocity.y,
          angle: stone.body.angle,
          outOfPlay: stone.outOfPlay || false
        }));
        multiplayer.broadcastStonePositions(positions);
      }
    }
  }

  // Track hog line crossing after release for split time
  // Check both 'throwing' and 'sweeping' phases since phase transitions 500ms after release
  if (gameState.activeStone && (gameState.phase === 'throwing' || gameState.phase === 'sweeping') && gameState.tLineCrossTime && !gameState.splitTime) {
    const stoneZ = gameState.activeStone.body.position.y / PHYSICS_SCALE;
    if (stoneZ >= HOG_LINE_NEAR) {
      gameState.splitTime = (Date.now() - gameState.tLineCrossTime) / 1000;
      displaySplitTime(gameState.splitTime);
    }
  }

  // Track hog line crossings for physics timing (for tuning)
  if (gameState.activeStone && (gameState.phase === 'throwing' || gameState.phase === 'sweeping')) {
    const stoneZ = gameState.activeStone.body.position.y / PHYSICS_SCALE;

    // Track near hog line crossing (use gameTime for accurate display during fast-forward)
    if (!gameState.nearHogCrossTime && stoneZ >= HOG_LINE_NEAR) {
      gameState.nearHogCrossTime = gameState.gameTime;
      console.log(`[TIMING] Near hog crossed at ${stoneZ.toFixed(2)}m`);
    }

    // Track far hog line crossing
    if (gameState.nearHogCrossTime && !gameState.farHogCrossTime && stoneZ >= HOG_LINE_FAR) {
      gameState.farHogCrossTime = gameState.gameTime;
      const hogToHog = (gameState.farHogCrossTime - gameState.nearHogCrossTime) / 1000;
      const vel = gameState.activeStone.body.velocity;
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      console.log(`[TIMING] Far hog crossed - Hog-to-hog: ${hogToHog.toFixed(2)}s (target: ~14s for draw)`);
      console.log(`[TIMING] Speed at far hog: ${speed.toFixed(3)} (cliff kicks in at < 1.0)`);

      // Display hog-to-hog time for player feedback
      displayHogToHogTime(hogToHog);
    }
  }

  // Apply curl effect during movement (stone curves based on rotation)
  // Ice condition variability based on level
  // Beginners get very consistent ice, higher levels have more realistic variation
  const levelId = gameState.gameMode === '1player' ? gameState.career.level : 4;
  // Level 1: 0% variation (perfectly consistent ice)
  // Level 8: 15% variation (realistic ice conditions that vary)
  const iceVariability = (levelId - 1) * 0.02;  // 0 to 0.14

  // Simple curl physics - angular velocity directly affects curl
  // Positive angularVelocity (IN turn) curls RIGHT (+X)
  // Negative angularVelocity (OUT turn) curls LEFT (-X)
  if (gameState.activeStone && (gameState.phase === 'throwing' || gameState.phase === 'sweeping')) {
    const body = gameState.activeStone.body;
    const vel = body.velocity;
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

    if (speed > 0.3) {
      const normalizedSpeed = Math.min(speed, 5) / 5;

      // ADVANCED PHYSICS 2: LATE CURL BEHAVIOR (Normalized Speed Model)
      // Curl is continuous function of normalized speed (v/v0)
      // Curl ramps up smoothly as stone slows, not just at threshold
      const lateCurlMultiplier = ADVANCED_PHYSICS.lateCurl.getCurlMultiplier(speed, gameState.initialThrowSpeed);

      // Ice variability - slight random variation in curl
      // ADVANCED PHYSICS 3: Rotation affects stability/variance
      const omega = body.angularVelocity;
      const absOmega = Math.abs(omega);
      const stabilityFactor = ADVANCED_PHYSICS.rotation.getStabilityFactor(omega);
      const iceRandomness = 1 + (Math.random() - 0.5) * iceVariability * stabilityFactor;

      // Calculate curl force - INVERSE relationship: more rotation = straighter path
      // Rotation direction: negative omega = clockwise = curl LEFT, positive omega = counterclockwise = curl RIGHT
      // Magnitude is weakly inversely proportional to rotation rate (curlOmegaExponent is small)
      const curlDirection = omega < 0 ? -1 : 1;

      // Base curl force with late curl multiplier
      // Uses weak omega exponent so rotation doesn't dominate
      // Ensure base is positive for Math.pow with fractional exponent
      const omegaBase = Math.max(0.01, ADVANCED_PHYSICS.rotation.omegaRef / (absOmega + 0.15));
      const omegaFactor = Math.pow(omegaBase, ADVANCED_PHYSICS.rotation.curlOmegaExponent);
      // Base curl constant increased for more noticeable curl effect
      let curlForce = curlDirection * 0.000006 * lateCurlMultiplier * iceRandomness * omegaFactor;
      curlForce = Math.max(-0.0002, Math.min(0.0002, curlForce));  // Slightly higher cap for more curl

      // NEW SWEEP MODEL:
      // - Fast sweeping (any direction) carries the stone farther (handled in friction)
      // - Diagonal sweeping toward curl side = reduces curl
      // - Diagonal sweeping away from curl side = lets it curl more
      // - Effect is subtle (centimeters, not steering)
      if (gameState.isSweeping && gameState.sweepEffectiveness > 0.1) {
        // sweepCurlInfluence: -1 = reduce curl, +1 = let it curl
        // Negative influence reduces curl force, positive allows more
        // Base reduction from any sweeping (parallel sweeping gives distance but minimal curl change)
        const baseCurlReduction = 0.15; // Small base reduction from friction smoothing

        // Diagonal influence adds/subtracts from curl
        // Max effect is ~40% curl modification at full diagonal sweep
        const diagonalEffect = gameState.sweepCurlInfluence * 0.4;

        // Combined effect: reduce by base amount, then apply diagonal influence
        // Negative sweepCurlInfluence (sweeping toward curl) = more reduction
        // Positive sweepCurlInfluence (sweeping away) = less reduction (or slight increase)
        const curlModifier = 1 - baseCurlReduction + diagonalEffect;
        curlForce *= Math.max(0.3, Math.min(1.3, curlModifier)); // Clamp to reasonable range
      }

      // Final cap to prevent extreme cases while allowing meaningful curl
      curlForce = Math.max(-0.00012, Math.min(0.00012, curlForce));
      Matter.Body.applyForce(body, body.position, { x: curlForce, y: 0 });

      // Update sliding sound volume based on speed
      soundManager.updateSlidingVolume(normalizedSpeed);
    }
  }

  // Apply increased friction at low speeds to make stones stop faster
  // Real curling: stones "fall off a cliff" as they slow - friction spikes dramatically
  // Post-hog glide should be ~4-5s, not 18s, so we need aggressive low-speed friction
  // The key: only apply aggressive slowdown at VERY low speeds (post-hog territory)
  const frictionVariation = 1 + (Math.random() - 0.5) * iceVariability * 0.5;

  for (const stone of gameState.stones) {
    const vel = stone.body.velocity;
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

    if (speed > 0.1) {
      // Progressive friction increase as stone slows
      // At high speeds: base friction only
      // At low speeds: aggressive "cliff" slowdown kicks in
      // Use ice conditioning based on shot weight
      const isGuardWeight = stone._isGuardWeight || false;
      let friction = getIceFriction(isGuardWeight);

      // Mild increase at medium-low speeds (1.5 to 1.0)
      if (speed < 1.5 && speed >= 1.0) {
        friction *= 1 + (1.5 - speed) * 0.8;
      }

      // Aggressive "cliff" at low speeds (< 1.0)
      // Stone needs to stop quickly when moving slowly, not drift forever
      // frictionAir alone isn't enough - directly dampen velocity
      const stoneZ = stone.body.position.y / PHYSICS_SCALE;
      if (speed < 1.0) {
        // Direct velocity damping
        // More aggressive after far hog line (tuned for 4-5s post-hog glide)
        // Slightly more aggressive before hog line to stop weak throws faster
        let dampingRate;
        if (stoneZ >= HOG_LINE_FAR) {
          // Post-hog: need to stop in 4-5s
          dampingRate = 0.002 + (1.0 - speed) * 0.004;  // ~0.2-0.6% per frame
        } else {
          // Pre-hog: weak throws - slightly more aggressive than before
          dampingRate = 0.0015 + (1.0 - speed) * 0.007;  // Small bump from original
        }
        const dampedSpeed = Math.max(0.1, speed * (1 - dampingRate));
        const scale = dampedSpeed / speed;
        Matter.Body.setVelocity(stone.body, {
          x: vel.x * scale,
          y: vel.y * scale
        });
      }

      stone.body.frictionAir = friction * frictionVariation;
    } else {
      // Stop the stone completely when very slow
      Matter.Body.setVelocity(stone.body, { x: 0, y: 0 });
    }
  }

  // Check if ALL stones have stopped before ending turn
  if (gameState.activeStone && (gameState.phase === 'sweeping' || gameState.phase === 'throwing')) {
    // Check if any stone is still moving
    let anyStoneMoving = false;
    for (const stone of gameState.stones) {
      const vel = stone.body.velocity;
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      if (speed > 0.1) {
        anyStoneMoving = true;
        break;
      }
    }

    // Re-check activeStone - it could have been nulled by a collision event during this frame
    if (!gameState.activeStone) return;

    const activeVel = gameState.activeStone.body.velocity;
    const activeSpeed = Math.sqrt(activeVel.x * activeVel.x + activeVel.y * activeVel.y);
    const stoneZ = gameState.activeStone.body.position.y / PHYSICS_SCALE;

    // Only end turn when ALL stones have stopped
    if (activeSpeed < 0.1 && !anyStoneMoving) {
      // Log physics timing when stone stops (use gameTime for accurate display during fast-forward)
      if (gameState.farHogCrossTime && !gameState.stoneStopTime) {
        gameState.stoneStopTime = gameState.gameTime;
        const hogToHog = (gameState.farHogCrossTime - gameState.nearHogCrossTime) / 1000;
        const hogToRest = (gameState.stoneStopTime - gameState.farHogCrossTime) / 1000;
        const totalTime = (gameState.stoneStopTime - gameState.nearHogCrossTime) / 1000;
        const finalZ = gameState.activeStone.body.position.y / PHYSICS_SCALE;

        // Determine where stone stopped relative to house
        let stopPosition = '';
        if (finalZ < HOG_LINE_FAR) stopPosition = 'short of far hog';
        else if (finalZ < TEE_LINE_FAR - 1.83) stopPosition = 'top 12-foot';
        else if (finalZ < TEE_LINE_FAR - 1.22) stopPosition = 'top 8-foot';
        else if (finalZ < TEE_LINE_FAR - 0.61) stopPosition = 'top 4-foot';
        else if (finalZ < TEE_LINE_FAR + 0.61) stopPosition = 'button area';
        else if (finalZ < TEE_LINE_FAR + 1.22) stopPosition = 'back 4-foot';
        else if (finalZ < TEE_LINE_FAR + 1.83) stopPosition = 'back 8-foot';
        else if (finalZ < BACK_LINE_FAR) stopPosition = 'back 12-foot';
        else stopPosition = 'through the house';

        console.log(`[TIMING] Stone stopped at ${finalZ.toFixed(2)}m (${stopPosition})`);
        console.log(`[TIMING] === PHYSICS SUMMARY ===`);
        console.log(`[TIMING] Hog-to-hog: ${hogToHog.toFixed(2)}s (target: ~14s for draw)`);
        console.log(`[TIMING] Far hog-to-rest: ${hogToRest.toFixed(2)}s (target: 4-5s for draw)`);
        console.log(`[TIMING] Total (near hog to rest): ${totalTime.toFixed(2)}s (target: ~18-19s for draw)`);
        console.log(`[TIMING] Effort was: ${gameState.maxPower}% (Draw = 50-69%)`);
      }

      // Check if stone didn't reach far hog line - move to out-of-play area
      if (stoneZ < HOG_LINE_FAR && !gameState.activeStone.outOfPlay) {
        moveStoneOutOfPlay(gameState.activeStone, 'did not reach far hog line');
      }

      // Check for Free Guard Zone violation
      if (checkFGZViolation()) {
        handleFGZViolation();
      }

      gameState.phase = 'waiting';
      updateFastForwardButton();  // Hide fast-forward button when stone stops
      gameState.activeStone = null;
      gameState.isSweeping = false;
      gameState.sweepEffectiveness = 0;
      gameState.sweepCurlInfluence = 0;
      gameState.sweepTouches = [];
      gameState.sweepAngle = 0;
      gameState.sweepVector = { x: 0, y: 0 };
      gameState._computerSweepSoundStarted = false;
      gameState.computerShotTarget = null;

      // Stop all sounds when stone comes to rest
      soundManager.stopSliding();
      soundManager.stopSweeping();

      // Hide sweep indicator
      const indicator = document.getElementById('sweep-indicator');
      if (indicator) indicator.style.display = 'none';

      // Clear target marker for next turn
      clearTargetMarker();

      // Broadcast final stone positions in multiplayer (host is authoritative)
      if (gameState.selectedMode === 'online' && multiplayer.multiplayerState.isHost) {
        const positions = gameState.stones.map((stone, index) => ({
          index: index,
          x: stone.body.position.x,
          y: stone.body.position.y,
          angle: stone.body.angle,
          outOfPlay: stone.outOfPlay || false
        }));
        multiplayer.broadcastStonesSettled(positions);
      }

      // Process shot feedback toast (only for human player shots, not CPU)
      const localTeam = gameState.selectedMode === 'online'
        ? multiplayer.multiplayerState.localPlayer.team
        : null;
      const wasCpuShot = gameState.gameMode === '1player' && gameState.currentTeam === gameState.computerTeam;
      const wasMyShot = !wasCpuShot && (gameState.selectedMode !== 'online' || gameState.currentTeam === localTeam);
      if (wasMyShot) {
        processShotFeedback();
      }

      // Interactive tutorial: complete sweep step when stone stops (even if user didn't sweep)
      if (gameState.interactiveTutorialMode) {
        onTutorialActionComplete('sweep');
        return;  // Don't proceed to normal game flow
      }

      // Practice mode: evaluate outcome and show result
      if (gameState.practiceMode.active) {
        processPracticeOutcome();
        return;  // Don't proceed to next turn in practice mode
      }

      // Check for mathematical elimination mid-end (mercy rule)
      if (checkMathematicalElimination()) {
        console.log(`[MERCY] Triggering mid-end concession`);
        setTimeout(() => {
          showGameOverOverlay();
        }, 1500);
        return;
      }

      // Show post-shot feedback in learn mode (player's shots only)
      const wasPlayerShot = gameState.gameMode === '1player' &&
        gameState.currentTeam !== gameState.computerTeam;
      if (gameState.learnMode.enabled && wasPlayerShot) {
        showPostShotFeedback();
      } else {
        // Check if end is complete or switch turns
        setTimeout(() => {
          nextTurn();
        }, 1500);
      }
    }
  }

  updateSweeping();
  } catch (err) {
    // Send diagnostic info to analytics but DON'T crash - just skip this frame
    const stoneData = gameState.activeStone ? {
      posX: gameState.activeStone.body.position.x?.toFixed(2),
      posY: gameState.activeStone.body.position.y?.toFixed(2),
      velX: gameState.activeStone.body.velocity.x?.toFixed(3),
      velY: gameState.activeStone.body.velocity.y?.toFixed(3),
      angVel: gameState.activeStone.body.angularVelocity?.toFixed(3)
    } : null;

    analytics.trackError('physics_error', `${err.name}: ${err.message}`, {
      phase: gameState.phase,
      ffw: gameState.cpuFastForward,
      stone: stoneData ? JSON.stringify(stoneData) : 'none',
      stones: gameState.stones.length,
      end: gameState.currentEnd
    });
    // Don't re-throw - gracefully continue
  }
}

// ============================================
// TURN TIMER (Multiplayer)
// ============================================
const TURN_TIME_LIMIT = 60;  // seconds

function startTurnTimer() {
  // Only in multiplayer and when it's our turn
  if (gameState.selectedMode !== 'online') return;

  const localTeam = multiplayer.multiplayerState.localPlayer.team;
  if (gameState.currentTeam !== localTeam) return;

  // Clear any existing timer
  stopTurnTimer();

  gameState.turnTimeLeft = TURN_TIME_LIMIT;
  updateTurnTimerDisplay();

  const timerEl = document.getElementById('turn-timer');
  if (timerEl) timerEl.style.display = 'block';

  gameState.turnTimer = setInterval(() => {
    gameState.turnTimeLeft--;
    updateTurnTimerDisplay();

    if (gameState.turnTimeLeft <= 0) {
      handleTurnTimeout();
    }
  }, 1000);
}

function stopTurnTimer() {
  if (gameState.turnTimer) {
    clearInterval(gameState.turnTimer);
    gameState.turnTimer = null;
  }

  const timerEl = document.getElementById('turn-timer');
  if (timerEl) timerEl.style.display = 'none';
}

function updateTurnTimerDisplay() {
  const timerEl = document.getElementById('turn-timer');
  if (!timerEl) return;

  timerEl.textContent = gameState.turnTimeLeft;

  // Color based on time remaining
  if (gameState.turnTimeLeft <= 10) {
    timerEl.style.background = '#dc2626';  // Red - urgent
    timerEl.style.color = 'white';
  } else if (gameState.turnTimeLeft <= 20) {
    timerEl.style.background = '#f59e0b';  // Orange - warning
    timerEl.style.color = 'white';
  } else {
    timerEl.style.background = '#333';
    timerEl.style.color = 'white';
  }
}

function handleTurnTimeout() {
  stopTurnTimer();

  console.log('[Multiplayer] Turn timeout - skipping turn');

  // Show timeout message
  showToast('Time ran out! Turn skipped.', 'warning');

  // Broadcast to opponent that we timed out
  if (multiplayer.multiplayerState.channel) {
    multiplayer.multiplayerState.channel.send({
      type: 'broadcast',
      event: 'turn_timeout',
      payload: { team: gameState.currentTeam }
    });
  }

  // Skip this turn (don't throw a stone, just move to next turn)
  // Increment stones thrown so game progresses
  gameState.stonesThrown[gameState.currentTeam]++;
  updateStoneCountDisplay();

  // Move to next turn
  setTimeout(() => {
    nextTurn();
  }, 1000);
}

// ============================================
// GAME FLOW
// ============================================

// Calculate game intensity for crowd atmosphere (0 = calm, 1 = very tense)
function calculateGameIntensity() {
  // Practice mode - low intensity
  if (gameState.practiceMode?.active) return 0.2;

  const totalEnds = gameState.settings?.gameLength || 8;
  const currentEnd = gameState.end || 1;
  const stonesThrown = (gameState.stonesThrown?.red || 0) + (gameState.stonesThrown?.yellow || 0);
  const scoreDiff = Math.abs((gameState.score?.red || 0) - (gameState.score?.yellow || 0));

  // Base intensity from game progress
  let intensity = 0;

  // End progress factor (later ends = more intense)
  const endProgress = currentEnd / totalEnds;
  intensity += endProgress * 0.3; // Up to 0.3 for final end

  // Stone progress within end (later stones = more intense)
  const stoneProgress = stonesThrown / 16;
  intensity += stoneProgress * 0.25; // Up to 0.25 for last stones

  // Close game factor (closer score = more intense)
  if (scoreDiff <= 1) {
    intensity += 0.25; // Tied or 1 point game
  } else if (scoreDiff <= 2) {
    intensity += 0.15; // 2 point game
  } else if (scoreDiff <= 3) {
    intensity += 0.05; // 3 point game
  }

  // Final end, last few stones, close game = maximum intensity
  if (currentEnd === totalEnds && stonesThrown >= 12 && scoreDiff <= 2) {
    intensity += 0.2; // Crunch time bonus
  }

  // Last stone of the game
  if (currentEnd === totalEnds && stonesThrown >= 15) {
    intensity = Math.max(intensity, 0.9);
  }

  return Math.min(1, intensity);
}

// Update crowd atmosphere based on game state
function updateCrowdAtmosphere() {
  const intensity = calculateGameIntensity();
  soundManager.setGameIntensity(intensity);
}

function nextTurn() {
  // Skip during interactive tutorial - no turn progression
  if (gameState.interactiveTutorialMode) {
    return;
  }

  console.log('[TURN] nextTurn called, stonesThrown:', gameState.stonesThrown);

  // Clear computer shot in progress flag
  gameState._computerShotInProgress = false;

  const totalThrown = gameState.stonesThrown.red + gameState.stonesThrown.yellow;

  if (totalThrown >= 16) {
    // End complete - calculate score
    calculateScore();
    return;
  }

  // Switch teams
  const previousTeam = gameState.currentTeam;
  gameState.currentTeam = gameState.currentTeam === 'red' ? 'yellow' : 'red';
  gameState.phase = 'aiming';

  // Save match progress after each shot (for crash recovery)
  saveMatchProgress();

  // Determine if it's computer's turn (needed for camera view)
  const isComputer = gameState.gameMode === '1player' && gameState.currentTeam === gameState.computerTeam;

  console.log('[TURN] Switched from', previousTeam, 'to', gameState.currentTeam,
    '- computerTeam:', gameState.computerTeam,
    '- isComputerTurn:', isComputer);

  // Set camera view - target view for player, thrower view for computer
  if (isComputer) {
    gameState.previewHeight = 0;  // Thrower view for computer
    gameState.previewLocked = false;
  } else {
    gameState.previewHeight = 1;  // Target view for player
    gameState.previewLocked = true;
  }
  gameState.targetViewZoom = 1;  // Reset pinch-to-zoom at start of each turn
  clearTargetMarker();  // Remove target marker from previous turn
  setCurlButtonsEnabled(true);  // Re-enable curl buttons for next turn
  updatePreviewStoneForTeam();  // Update preview stone color for new team

  // Hide power display and reset curl display position from previous turn
  document.getElementById('power-display').style.display = 'none';
  document.getElementById('hold-warning').style.display = 'none';
  const curlDisplay = document.getElementById('curl-display');
  if (curlDisplay) curlDisplay.style.top = 'max(20px, env(safe-area-inset-top))';

  // Update UI
  let turnText;
  const totalEnds = gameState.settings.gameLength;

  // Multiplayer mode - use player names
  if (gameState.selectedMode === 'online') {
    const localTeam = multiplayer.multiplayerState.localPlayer.team;
    const isMyTurn = gameState.currentTeam === localTeam;
    const localName = multiplayer.multiplayerState.localPlayer.name || 'You';
    const remoteName = multiplayer.multiplayerState.remotePlayer.name || 'Opponent';

    if (isMyTurn) {
      turnText = `End ${gameState.end}/${totalEnds} - ${localName}'s Turn`;
      // Hide opponent's aim preview when it's our turn
      hideOpponentAimPreview();
      // Start turn timer
      startTurnTimer();
    } else {
      turnText = `End ${gameState.end}/${totalEnds} - ${remoteName}'s Turn`;
      // Stop timer when it's opponent's turn
      stopTurnTimer();
    }
  } else if (gameState.playerCountry && gameState.opponentCountry) {
    const country = gameState.currentTeam === 'red' ? gameState.playerCountry : gameState.opponentCountry;
    // Use non-breaking spaces to keep team name and "'s Turn" together
    turnText = `End ${gameState.end}/${totalEnds} - ${country.flag}\u00A0${country.name}'s\u00A0Turn${isComputer ? ' (CPU)' : ''}`;
  } else {
    const teamName = gameState.currentTeam.charAt(0).toUpperCase() + gameState.currentTeam.slice(1);
    turnText = `End ${gameState.end}/${totalEnds} - ${teamName}'s\u00A0Turn${isComputer ? ' (Computer)' : ''}`;
  }
  document.getElementById('turn').textContent = turnText;

  // Camera will update via animation loop to target view

  // Trigger computer turn if applicable, or restore player's curl preference
  if (isComputer) {
    console.log('[COMPUTER] Scheduling computer turn in nextTurn()...');
    scheduleComputerShot();
  } else {
    // Restore player's preferred curl direction
    gameState.curlDirection = gameState.playerCurlDirection;
    updateCurlDisplay();
    updateSkipSignalArm();
    updatePreviewStoneRotation();
  }

  // Force update button visibility after state changes
  updateReturnButton();
  updateMarkerHint();

  // Show save button (replaces pause button) when it's player's turn
  updateGameButtons(true);

  // Update coach panel for learn mode
  updateCoachPanel();

  // Update fast-forward button visibility
  updateFastForwardButton();

  // Update crowd atmosphere based on game intensity
  updateCrowdAtmosphere();
}

function calculateScore() {
  const buttonPos = { x: 0, z: TEE_LINE_FAR };

  // Calculate distances from button for all stones (exclude out-of-play stones)
  const distances = gameState.stones
    .filter(stone => !stone.outOfPlay)
    .map(stone => {
      const dx = stone.mesh.position.x - buttonPos.x;
      const dz = stone.mesh.position.z - buttonPos.z;
      return {
        team: stone.team,
        distance: Math.sqrt(dx * dx + dz * dz)
      };
    }).filter(s => s.distance <= RING_12FT + STONE_RADIUS); // Stone touching 12ft ring counts

  if (distances.length === 0) {
    // No stones in house - blank end (team with hammer keeps it)
    gameState.endScores.red[gameState.end - 1] = 0;
    gameState.endScores.yellow[gameState.end - 1] = 0;
    updateScoreDisplay();
    showScoreOverlay(null, 0, gameState.end);
    return;
  }

  // Sort by distance
  distances.sort((a, b) => a.distance - b.distance);

  // Scoring team is closest
  const scoringTeam = distances[0].team;
  const nonScoringTeam = scoringTeam === 'red' ? 'yellow' : 'red';
  let points = 0;

  for (const stone of distances) {
    if (stone.team === scoringTeam) {
      // Check if closer than any opponent stone
      const closerOpponent = distances.find(s => s.team !== scoringTeam && s.distance < stone.distance);
      if (!closerOpponent) {
        points++;
      } else {
        break;
      }
    }
  }

  // Record end scores
  gameState.endScores[scoringTeam][gameState.end - 1] = points;
  gameState.endScores[nonScoringTeam][gameState.end - 1] = 0;

  // Update total score
  gameState.scores[scoringTeam] += points;

  // Hammer switches to non-scoring team (they get advantage next end)
  gameState.hammer = nonScoringTeam;

  updateScoreDisplay();

  // Save match progress after each end (for crash recovery)
  saveMatchProgress();

  showScoreOverlay(scoringTeam, points, gameState.end);
}

// Update scoring indicators on stones (show which stones are currently counting)
// Only shows glow when all stones have stopped moving
function updateScoringIndicators() {
  // First check if any stone is still moving - if so, hide all glows
  const anyStoneMoving = gameState.stones.some(stone => {
    if (stone.outOfPlay || !stone.body) return false;
    const vel = stone.body.velocity;
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
    return speed > 0.02; // Threshold for "at rest"
  });

  // If stones are moving, fade out all glows and return
  if (anyStoneMoving) {
    for (const stone of gameState.stones) {
      const glow = stone.mesh.getObjectByName('scoringGlow');
      if (glow && glow.material.opacity > 0) {
        glow.material.opacity *= 0.8; // Fade out
        if (glow.material.opacity < 0.05) {
          glow.material.opacity = 0;
        }
      }
    }
    return;
  }

  const buttonPos = { x: 0, z: TEE_LINE_FAR };

  // Calculate distances from button for all stones in the house
  const stonesWithDist = gameState.stones
    .filter(stone => !stone.outOfPlay)
    .map(stone => {
      const dx = stone.mesh.position.x - buttonPos.x;
      const dz = stone.mesh.position.z - buttonPos.z;
      return {
        stone: stone,
        distance: Math.sqrt(dx * dx + dz * dz)
      };
    })
    .filter(s => s.distance <= RING_12FT + STONE_RADIUS)
    .sort((a, b) => a.distance - b.distance);

  // Determine scoring stones - only the team with the closest stone scores
  // and only their stones that are closer than any opponent stone
  const scoringStones = new Set();

  if (stonesWithDist.length > 0) {
    const scoringTeam = stonesWithDist[0].stone.team;

    for (const entry of stonesWithDist) {
      if (entry.stone.team === scoringTeam) {
        // Check if closer than any opponent stone
        const closerOpponent = stonesWithDist.find(
          s => s.stone.team !== scoringTeam && s.distance < entry.distance
        );
        if (!closerOpponent) {
          scoringStones.add(entry.stone);
        } else {
          break;
        }
      }
    }

    // Debug: check for potential glow mismatch every 60 frames (~1 sec)
    if (gameState._glowDebugCounter === undefined) gameState._glowDebugCounter = 0;
    gameState._glowDebugCounter++;
    if (gameState._glowDebugCounter >= 60) {
      gameState._glowDebugCounter = 0;
      // Log current scoring state
      console.log('[Glow Debug] Scoring team:', scoringTeam,
        '| Scoring stones:', scoringStones.size,
        '| All in house:', stonesWithDist.map(s =>
          `${s.stone.team}:${s.distance.toFixed(2)}`).join(', '));
    }
  }

  // Update glow visibility on all stones
  for (const stone of gameState.stones) {
    const glow = stone.mesh.getObjectByName('scoringGlow');
    if (glow) {
      const isScoring = scoringStones.has(stone);
      const targetOpacity = isScoring ? 0.6 : 0;
      // Faster fade for more responsive feedback
      glow.material.opacity += (targetOpacity - glow.material.opacity) * 0.25;
      // Snap to zero when very small to avoid lingering glow
      if (glow.material.opacity < 0.05) {
        glow.material.opacity = 0;
      }

      // Debug: detect if wrong team's glow is visible
      if (glow.material.opacity > 0.1 && !isScoring) {
        console.warn('[Glow Bug] Non-scoring stone has visible glow!',
          'Team:', stone.team, 'Opacity:', glow.material.opacity.toFixed(2),
          'ScoringTeam:', scoringStones.size > 0 ? [...scoringStones][0]?.team : 'none');
      }
    }
  }
}

// ============================================
// SCORE OVERLAY
// ============================================
function showScoreOverlay(team, points, endNumber) {
  const overlay = document.getElementById('score-overlay');
  const endLabel = document.getElementById('score-end-label');
  const teamDisplay = document.getElementById('score-team');
  const pointsDisplay = document.getElementById('score-points');
  const pointsLabel = document.getElementById('score-points-label');
  const stonesDisplay = document.getElementById('score-stones-display');
  const totalRed = document.getElementById('score-total-red');
  const totalYellow = document.getElementById('score-total-yellow');

  if (!overlay) return;

  // Play score sound and crowd reaction
  if (points > 0) {
    soundManager.playScore(points);
    // Crowd applause - bigger for more points
    const applauseDuration = 1 + points * 0.5; // 1.5s to 3s
    soundManager.playCrowdApplause(applauseDuration);
  }

  // Update content
  endLabel.textContent = `End ${endNumber} Complete`;

  if (team === null) {
    // Blank end
    teamDisplay.textContent = 'BLANK END';
    teamDisplay.className = 'blank';
    pointsDisplay.textContent = '0';
    pointsLabel.textContent = 'No Score';
    stonesDisplay.innerHTML = '';
  } else {
    teamDisplay.textContent = team.toUpperCase();
    teamDisplay.className = team;
    pointsDisplay.textContent = points;
    pointsLabel.textContent = points === 1 ? 'Point Scored' : 'Points Scored';

    // Create stone icons with staggered animation
    stonesDisplay.innerHTML = '';
    for (let i = 0; i < points; i++) {
      const stone = document.createElement('div');
      stone.className = `score-stone ${team}`;
      stone.style.animationDelay = `${0.1 + i * 0.1}s`;
      stonesDisplay.appendChild(stone);
    }
  }

  // Update totals
  totalRed.textContent = gameState.scores.red;
  totalYellow.textContent = gameState.scores.yellow;

  // Show overlay with animation
  overlay.style.display = 'flex';
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
  });
}

window.continueGame = function() {
  const overlay = document.getElementById('score-overlay');
  // Guard against double-firing from touch + click
  if (overlay && overlay.classList.contains('visible')) {
    overlay.classList.remove('visible');
    setTimeout(() => {
      overlay.style.display = 'none';
      startNewEnd();
    }, 500);
  }
};

function launchConfetti(winnerColor) {
  const container = document.getElementById('confetti-container');
  if (!container) return;

  // Clear any existing confetti
  container.innerHTML = '';

  // Confetti colors based on winner
  const colors = winnerColor === 'red'
    ? ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fee2e2', '#ffffff', '#ffd700']
    : ['#fbbf24', '#f59e0b', '#fcd34d', '#fde68a', '#fef3c7', '#ffffff', '#ffd700'];

  // Create confetti pieces
  const confettiCount = 150;
  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';

    // Random properties
    const left = Math.random() * 100;
    const delay = Math.random() * 3;
    const duration = 3 + Math.random() * 2;
    const size = 8 + Math.random() * 12;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const shape = Math.random() > 0.5 ? '50%' : '0';

    confetti.style.cssText = `
      left: ${left}%;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: ${shape};
      animation-delay: ${delay}s;
      animation-duration: ${duration}s;
    `;

    container.appendChild(confetti);
  }

  // Clean up confetti after animation
  setTimeout(() => {
    container.innerHTML = '';
  }, 8000);
}

function launchRaindrops() {
  const container = document.getElementById('confetti-container');
  if (!container) return;

  // Clear any existing elements
  container.innerHTML = '';

  // Create raindrops
  const dropCount = 150;
  for (let i = 0; i < dropCount; i++) {
    const drop = document.createElement('div');

    // Random properties for rain effect
    const left = Math.random() * 100;
    const delay = Math.random() * 3;
    const duration = 0.8 + Math.random() * 0.6;
    const width = 2 + Math.random() * 2;
    const height = 20 + Math.random() * 30;

    drop.style.cssText = `
      position: absolute;
      top: -40px;
      left: ${left}%;
      width: ${width}px;
      height: ${height}px;
      background: linear-gradient(to bottom, rgba(150, 180, 220, 0.2), rgba(100, 150, 200, 0.7));
      border-radius: 0 0 50% 50%;
      animation: rain-fall ${duration}s linear ${delay}s infinite;
    `;

    container.appendChild(drop);
  }

  // Clean up after animation
  setTimeout(() => {
    container.innerHTML = '';
  }, 8000);
}

function showGameOverOverlay() {
  // Clear saved match progress since match is complete
  clearMatchProgress();

  const overlay = document.getElementById('gameover-overlay');
  const winnerDisplay = document.getElementById('gameover-winner');
  const subtitleDisplay = document.getElementById('gameover-subtitle');
  const redScore = document.getElementById('gameover-red');
  const yellowScore = document.getElementById('gameover-yellow');

  if (!overlay) return;

  // Determine winner
  let winner, winnerClass;
  if (gameState.scores.red > gameState.scores.yellow) {
    winner = 'RED';
    winnerClass = 'red';
    subtitleDisplay.textContent = 'WINS!';
  } else if (gameState.scores.yellow > gameState.scores.red) {
    winner = 'YELLOW';
    winnerClass = 'yellow';
    subtitleDisplay.textContent = 'WINS!';
  } else {
    winner = 'TIE GAME';
    winnerClass = 'tie';
    subtitleDisplay.textContent = '';
  }

  // Determine if user won or lost (for effects)
  // In 1-player mode, check if user's team won
  // In 2-player mode, always show confetti for the winner
  const userTeam = gameState.gameMode === '1player'
    ? (gameState.computerTeam === 'yellow' ? 'red' : 'yellow')
    : null;

  // Track game completion
  const gameMode = gameState.selectedMode || 'quickplay';
  const playerScore = userTeam ? gameState.scores[userTeam] : gameState.scores.red;
  const opponentScore = userTeam ? gameState.scores[userTeam === 'red' ? 'yellow' : 'red'] : gameState.scores.yellow;
  const won = userTeam ? (playerScore > opponentScore) : null;
  console.log('[GameOver] Tracking game_complete:', { gameMode, selectedMode: gameState.selectedMode, won, playerScore, opponentScore, ends: gameState.end });
  analytics.trackGameComplete(gameMode, won, playerScore, opponentScore, gameState.end, gameState.learnMode?.enabled || false);

  if (winnerClass !== 'tie') {
    if (gameState.gameMode === '2player') {
      // 2-player: confetti for winner
      launchConfetti(winnerClass);
      soundManager.playVictory();
      soundManager.playCrowdCheer(1.0);  // Big celebration
    } else if (winnerClass === userTeam) {
      // User wins: confetti!
      launchConfetti(winnerClass);
      soundManager.playVictory();
      soundManager.playCrowdCheer(1.0);  // Big celebration
    } else {
      // User loses: rain
      launchRaindrops();
      soundManager.playDefeat();
      soundManager.playCrowdGroan();     // Disappointed crowd
    }
  }

  // Stop ambient crowd (game is over)
  soundManager.stopAmbientCrowd();

  winnerDisplay.textContent = winner;
  winnerDisplay.className = winnerClass;
  redScore.textContent = gameState.scores.red;
  yellowScore.textContent = gameState.scores.yellow;

  // Handle career progression (1-player mode only)
  const careerMessageEl = document.getElementById('gameover-career-message');
  if (gameState.gameMode === '1player' && winnerClass !== 'tie') {
    const userWon = winnerClass === userTeam;

    // Calculate player/opponent scores
    const playerScore = userTeam === 'red' ? gameState.scores.red : gameState.scores.yellow;
    const opponentScore = userTeam === 'red' ? gameState.scores.yellow : gameState.scores.red;
    const level = getCurrentLevel();

    // Check if this is a tournament match
    if (gameState.inTournamentMatch && seasonState.activeTournament) {
      // Handle tournament match result
      handleTournamentMatchResult(userWon);

      // Save to match history
      saveLocalMatchToHistory({
        opponentName: 'Tournament Opponent',
        matchType: 'career',
        won: userWon,
        playerScore,
        opponentScore,
        endScores: gameState.endScores,
        gameLength: gameState.settings.gameLength,
        careerLevel: gameState.career.level,
        careerLevelName: level.name
      });

      if (careerMessageEl) {
        careerMessageEl.textContent = userWon ? 'Tournament match won!' : 'Eliminated from tournament';
        careerMessageEl.style.color = userWon ? '#4ade80' : '#f87171';
        careerMessageEl.style.display = 'block';
      }
    } else {
      // Regular career progression
      const careerResult = handleCareerResult(userWon);

      // Save to match history
      const matchType = gameState.selectedMode === 'career' ? 'career' : 'quickplay';
      saveLocalMatchToHistory({
        opponentName: level.name + ' AI',
        matchType,
        won: userWon,
        playerScore,
        opponentScore,
        endScores: gameState.endScores,
        gameLength: gameState.settings.gameLength,
        careerLevel: gameState.career.level,
        careerLevelName: level.name
      });

      if (careerMessageEl && careerResult) {
        careerMessageEl.textContent = careerResult.message;
        if (careerResult.advanced) {
          careerMessageEl.style.color = '#4ade80';
        } else if (careerResult.demoted) {
          careerMessageEl.style.color = '#f87171';
        } else {
          careerMessageEl.style.color = '#94a3b8';
        }
        careerMessageEl.style.display = 'block';
      }
    }
  } else if (gameState.rankedMatch && careerMessageEl) {
    // Handle ranked multiplayer match result
    // Determine if local player won based on their team
    const localTeam = multiplayer.multiplayerState?.localPlayer?.team;
    const localWon = localTeam && winnerClass === localTeam;

    // Calculate player/opponent scores for history
    const playerScore = localTeam === 'red' ? gameState.scores.red : gameState.scores.yellow;
    const opponentScore = localTeam === 'red' ? gameState.scores.yellow : gameState.scores.red;

    // Update rating and save to history asynchronously
    updateRankedMatchRating(localWon).then(async result => {
      if (result && careerMessageEl) {
        const changeStr = result.change >= 0 ? `+${result.change}` : `${result.change}`;
        careerMessageEl.textContent = `Rating: ${result.oldElo} → ${result.newElo} (${changeStr})`;
        careerMessageEl.style.color = result.change >= 0 ? '#4ade80' : '#f87171';
        careerMessageEl.style.display = 'block';

        // Save to match history
        await multiplayer.saveMatchToHistory({
          playerName: multiplayer.multiplayerState.localPlayer?.name || 'Player',
          opponentId: null,  // We don't have opponent's player_id stored
          opponentName: multiplayer.multiplayerState.remotePlayer?.name || 'Opponent',
          matchType: 'ranked',
          won: localWon,
          playerScore,
          opponentScore,
          endScores: gameState.endScores,
          eloBefore: result.oldElo,
          eloAfter: result.newElo,
          eloChange: result.change,
          gameLength: gameState.settings.gameLength
        });
      }
    });
  } else if (careerMessageEl) {
    careerMessageEl.style.display = 'none';
  }

  // Show/hide rematch button based on game mode
  const rematchBtn = document.getElementById('gameover-rematch');
  if (rematchBtn) {
    // Only show rematch for online multiplayer games
    const isMultiplayer = multiplayer.multiplayerState.connected && gameState.selectedMode === 'online';
    rematchBtn.style.display = isMultiplayer ? 'block' : 'none';
  }

  // Show overlay
  overlay.style.display = 'flex';
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
  });
}

// Temporary test function for score overlay
window.testScoreOverlay = function() {
  showScoreOverlay('red', 3, 1);
};

// Temporary test functions for game over
window.testGameOverWin = function() {
  // Simulate user winning (user is red in 1-player mode)
  gameState.scores.red = 7;
  gameState.scores.yellow = 5;
  showGameOverOverlay();
};

window.testGameOverLose = function() {
  // Simulate user losing (user is red in 1-player mode)
  gameState.scores.red = 4;
  gameState.scores.yellow = 8;
  showGameOverOverlay();
};

window.restartGame = function() {
  // Check if we just finished a tournament match
  const wasTournamentMatch = window._lastMatchResult !== undefined;

  // Clear confetti/rain if any
  const confettiContainer = document.getElementById('confetti-container');
  if (confettiContainer) confettiContainer.innerHTML = '';

  const overlay = document.getElementById('gameover-overlay');
  // Guard against double-firing from touch + click
  if (overlay && overlay.classList.contains('visible')) {
    overlay.classList.remove('visible');
    setTimeout(() => {
      overlay.style.display = 'none';

      // Reset game state
      gameState.end = 1;
      gameState.scores = { red: 0, yellow: 0 };
      gameState.endScores = { red: [null, null, null, null, null, null, null, null, null, null], yellow: [null, null, null, null, null, null, null, null, null, null] };
      gameState.hammer = 'yellow';  // Reset hammer
      gameState.computerTeam = 'yellow';  // Reset computer team to default
      gameState.stonesThrown = { red: 0, yellow: 0 };
      gameState.currentTeam = 'red';
      gameState.phase = 'aiming';
      gameState.previewHeight = 0;
      gameState.previewLocked = false;
      gameState.curlDirection = null;  // Reset curl selection
      gameState.playerCurlDirection = null;
      gameState.setupComplete = false;  // Reset setup
      gameState.playerCountry = null;
      gameState.opponentCountry = null;
      gameState.selectedMode = null;  // Reset mode selection
      gameState.careerLevel = null;  // Reset career level
      gameState.inTournamentMatch = false;  // Clear tournament match flag

      // Clear any remaining stones
      for (const stone of gameState.stones) {
        scene.remove(stone.mesh);
        Matter.Composite.remove(world, stone.body);
      }
      gameState.stones = [];

      // Update UI
      updateScoreDisplay();
      updateStoneCountDisplay();
      clearTargetMarker();
      setCurlButtonsEnabled(true);  // Re-enable curl buttons
      resetOutOfPlayStones();  // Reset out-of-play counter
      updatePreviewStoneForTeam();  // Reset preview stone for red team
      updateCurlDisplay();  // Reset curl display to require selection

      // Reset scoreboard labels to RED/YELLOW
      const redLabel = document.querySelector('#red-score-row .team-col');
      const yellowLabel = document.querySelector('#yellow-score-row .team-col');
      if (redLabel) redLabel.innerHTML = 'RED';
      if (yellowLabel) yellowLabel.innerHTML = 'YELLOW';

      // Hide save scenario button
      const saveScenarioBtn = document.getElementById('save-scenario-btn');
      if (saveScenarioBtn) saveScenarioBtn.style.display = 'none';

      // If this was a tournament match, show post-match screen instead of mode selection
      if (wasTournamentMatch) {
        showPostMatch();
      } else {
        // Show mode selection to start new game setup
        showModeSelection();
      }
    }, 500);
  }
};

// ============================================
// SETTINGS
// ============================================
window.openSettings = function() {
  const overlay = document.getElementById('settings-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    // Sync UI with current state
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) soundToggle.checked = gameState.settings.soundEnabled;
    updateDifficultyButtons(gameState.settings.difficulty);
    updateEndsButtons(gameState.settings.gameLength);
    // Sync game mode buttons
    const btn1p = document.getElementById('mode-1p');
    const btn2p = document.getElementById('mode-2p');
    if (btn1p && btn2p) {
      if (gameState.gameMode === '1player') {
        btn1p.style.borderColor = '#4ade80';
        btn1p.style.background = '#2d5a3d';
        btn2p.style.borderColor = '#666';
        btn2p.style.background = '#333';
      } else {
        btn2p.style.borderColor = '#4ade80';
        btn2p.style.background = '#2d5a3d';
        btn1p.style.borderColor = '#666';
        btn1p.style.background = '#333';
      }
    }

    // Update country settings button state
    updateCountrySettingsButton();
  }
};

// Update country settings button based on player's progress
function updateCountrySettingsButton() {
  const btn = document.getElementById('country-settings-btn');
  const display = document.getElementById('country-settings-display');
  const badge = document.getElementById('country-settings-badge');

  if (!btn || !display || !badge) return;

  // Check if player has unlocked country selection
  const hasUnlocked = seasonState.playerTeam?.countryLocked && seasonState.playerTeam?.country;

  if (hasUnlocked) {
    // Player has a country - show it
    const country = seasonState.playerTeam.country;
    display.innerHTML = `
      <span style="font-size: 24px;">${country.flag}</span>
      <span style="font-weight: bold;">${country.name}</span>
    `;
    badge.textContent = 'CHANGE';
    badge.style.background = '#4ade80';
    badge.style.color = '#000';
    btn.disabled = false;
    btn.style.cursor = 'pointer';
    btn.style.opacity = '1';
    btn.style.borderColor = '#4ade80';
    btn.style.color = 'white';
  } else {
    // Not yet unlocked
    display.innerHTML = `
      <span style="font-size: 24px;">🏳️</span>
      <span style="font-weight: bold;">Select Country</span>
    `;
    badge.textContent = 'REACH NATIONAL';
    badge.style.background = '#4a5568';
    badge.style.color = '#a0aec0';
    btn.disabled = true;
    btn.style.cursor = 'not-allowed';
    btn.style.opacity = '0.7';
    btn.style.borderColor = '#444';
    btn.style.color = '#666';
  }
}

// Open country selection from settings
window.openCountrySelection = function() {
  if (!seasonState.playerTeam?.countryLocked) return;

  window.closeSettings();
  showCountryUnlockScreen();
};

window.closeSettings = function() {
  const overlay = document.getElementById('settings-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
  // Trigger coach panel/tutorials now that menu is closed
  updateCoachPanel();
};

// Exit current game and return to mode selection
window.exitToMenu = function() {
  // Close settings overlay
  window.closeSettings();

  // Close pause overlay if open
  const pauseOverlay = document.getElementById('pause-overlay');
  if (pauseOverlay) pauseOverlay.style.display = 'none';

  // Hide game canvas
  const canvas = document.getElementById('game-canvas');
  if (canvas) canvas.style.display = 'none';

  // Hide game UI
  const gameUI = document.getElementById('game-ui');
  if (gameUI) gameUI.style.display = 'none';

  // Hide any game-over overlays
  const gameOver = document.getElementById('game-over-overlay');
  if (gameOver) gameOver.style.display = 'none';

  // Hide practice screens
  const practiceScreen = document.getElementById('practice-drill-screen');
  if (practiceScreen) practiceScreen.style.display = 'none';
  const practiceScenario = document.getElementById('practice-scenario-screen');
  if (practiceScenario) practiceScenario.style.display = 'none';

  // Reset game state
  gameState.phase = 'setup';
  gameState.selectedMode = null;
  gameState.learnMode.enabled = false;
  gameState.practiceMode = { active: false };

  // Clear any active stones
  for (const stone of gameState.stones) {
    if (stone.mesh) scene.remove(stone.mesh);
    if (stone.body) Matter.Composite.remove(world, stone.body);
  }
  gameState.stones = [];

  // Show mode selection screen
  showModeSelection();
};

// Alias for settings button
window.exitToMainMenu = window.exitToMenu;

// ============================================
// GAME SETUP FLOW
// ============================================

// Show mode selection screen (first screen after splash)
function showModeSelection() {
  // Hide tutorial overlay
  const tutorialOverlay = document.getElementById('tutorial-overlay');
  if (tutorialOverlay) {
    tutorialOverlay.style.display = 'none';
    tutorialOverlay.style.visibility = 'hidden';
  }

  const screen = document.getElementById('mode-select-screen');
  if (screen) {
    screen.style.display = 'block';
    screen.style.visibility = 'visible';
  }
  // Show fixed footer
  const footer = document.getElementById('mode-select-footer');
  if (footer) {
    footer.style.display = 'flex';
  }
}

// Hide mode selection footer (call when leaving mode select screen)
function hideModeSelectFooter() {
  const footer = document.getElementById('mode-select-footer');
  if (footer) {
    footer.style.display = 'none';
  }
}

// Handle mode selection
window.selectMode = function(mode) {
  document.getElementById('mode-select-screen').style.display = 'none';
  hideModeSelectFooter();
  gameState.gameMode = '1player';
  gameState.selectedMode = mode;  // Store for later (career vs quickplay vs practice vs online)

  // Track mode selection
  analytics.trackPageView(mode + '_mode');

  if (mode === 'career') {
    // Career mode: check for existing career
    loadSeasonState();

    // If no club selected yet, show club selection (new career)
    if (!seasonState.playerTeam.club.id) {
      showClubSelection();
    } else {
      // Existing career - show Season Overview hub
      showSeasonOverview();
    }
  } else if (mode === 'practice') {
    // Practice mode: show drill selection
    loadPracticeStats();
    showPracticeDrills();
  } else if (mode === 'online') {
    // Online multiplayer: show lobby
    if (!multiplayer.isMultiplayerAvailable()) {
      alert('Online multiplayer is not available. Please check your configuration.');
      document.getElementById('mode-select-screen').style.display = 'block';
      return;
    }
    showMultiplayerLobby();
  } else {
    // Quick Play: show difficulty selection first
    showDifficultySelection();
  }
};

// ============================================
// PRACTICE MODE - UI Functions
// ============================================

// Show practice drill selection screen
window.showPracticeDrills = function() {
  const screen = document.getElementById('practice-drill-screen');
  const grid = document.getElementById('practice-drill-grid');

  if (!screen || !grid) return;

  // Track practice mode page view for analytics
  analytics.trackPageView('practice_mode');

  // Hide other screens
  document.getElementById('mode-select-screen').style.display = 'none';
  document.getElementById('practice-scenario-screen').style.display = 'none';

  // Build drill cards
  let html = Object.entries(PRACTICE_DRILLS).map(([drillId, drill]) => {
    const stats = practiceStats[drillId];
    const rate = stats.attempts > 0
      ? Math.round((stats.successes / stats.attempts) * 100)
      : null;

    return `
      <div class="practice-drill-card" onclick="window.showPracticeScenarios('${drillId}')">
        <div class="practice-drill-icon">${drill.icon}</div>
        <div class="practice-drill-name">${drill.name}</div>
        <div class="practice-drill-rate ${rate === null ? 'no-data' : ''}">
          ${rate !== null ? rate + '%' : 'No attempts'}
        </div>
      </div>
    `;
  }).join('');

  // Add Custom Scenarios card if there are any saved
  const customScenarios = getCustomScenarios();
  html += `
    <div class="practice-drill-card ${customScenarios.length === 0 ? 'no-data' : ''}" onclick="window.showCustomScenarios()" style="border-color: #3b82f6;">
      <div class="practice-drill-icon">💾</div>
      <div class="practice-drill-name">Custom</div>
      <div class="practice-drill-rate ${customScenarios.length === 0 ? 'no-data' : ''}">
        ${customScenarios.length} saved
      </div>
    </div>
  `;

  grid.innerHTML = html;
  screen.style.display = 'block';
};

// Show scenarios for a specific drill
window.showPracticeScenarios = function(drillId) {
  const screen = document.getElementById('practice-scenario-screen');
  const list = document.getElementById('practice-scenario-list');
  const drill = PRACTICE_DRILLS[drillId];
  const scenarios = PRACTICE_SCENARIOS[drillId];
  const stats = practiceStats[drillId];

  if (!screen || !list || !drill || !scenarios) return;

  // Store current drill for later
  gameState.practiceMode.currentDrill = drillId;

  // Update header
  document.getElementById('scenario-drill-title').textContent = `${drill.icon} ${drill.name}`;
  document.getElementById('scenario-drill-desc').textContent = drill.description;

  // Update stats
  const rate = stats.attempts > 0 ? Math.round((stats.successes / stats.attempts) * 100) : 0;
  document.getElementById('drill-success-rate').textContent = rate + '%';
  document.getElementById('drill-attempts').textContent = stats.attempts;

  // Count max difficulty levels
  const maxDifficulty = Math.max(...scenarios.map(s => s.difficulty));
  document.getElementById('drill-unlocked').textContent = `${stats.unlocked}/${maxDifficulty}`;

  // Build scenario cards
  list.innerHTML = scenarios.map(scenario => {
    const isLocked = scenario.difficulty > stats.unlocked;
    const scenarioStats = stats.scenarios[scenario.id] || { attempts: 0, successes: 0 };
    const scenarioRate = scenarioStats.attempts > 0
      ? Math.round((scenarioStats.successes / scenarioStats.attempts) * 100)
      : null;

    // Difficulty dots
    const dots = Array(5).fill(0).map((_, i) =>
      `<div class="dot ${i < scenario.difficulty ? 'filled' : ''}"></div>`
    ).join('');

    if (isLocked) {
      return `
        <div class="practice-scenario-card locked">
          <div class="scenario-header">
            <div class="scenario-name">${scenario.name}</div>
            <div class="scenario-difficulty">${dots}</div>
          </div>
          <div class="scenario-description">${scenario.description}</div>
          <div class="scenario-stats">
            <div class="scenario-lock">🔒 Complete easier scenarios to unlock</div>
          </div>
        </div>
      `;
    }

    return `
      <div class="practice-scenario-card" onclick="window.startPracticeScenario('${drillId}', '${scenario.id}')">
        <div class="scenario-header">
          <div class="scenario-name">${scenario.name}</div>
          <div class="scenario-difficulty">${dots}</div>
        </div>
        <div class="scenario-description">${scenario.description}</div>
        <div class="scenario-stats">
          <div class="scenario-best">
            ${scenarioRate !== null ? `Best: ${scenarioRate}%` : 'Not attempted'}
          </div>
          <button class="scenario-start-btn">START</button>
        </div>
      </div>
    `;
  }).join('');

  // Hide drill screen, show scenario screen
  document.getElementById('practice-drill-screen').style.display = 'none';
  screen.style.display = 'block';
};

// Start a practice scenario
window.startPracticeScenario = function(drillId, scenarioId) {
  const scenarios = PRACTICE_SCENARIOS[drillId];
  const scenario = scenarios.find(s => s.id === scenarioId);

  if (!scenario) return;

  // Set up practice mode state
  gameState.practiceMode.active = true;
  gameState.practiceMode.currentDrill = drillId;
  gameState.practiceMode.currentScenario = scenarioId;
  gameState.practiceMode.difficulty = scenario.difficulty;
  gameState.practiceMode.attempts = 0;
  gameState.practiceMode.successes = 0;
  gameState.practiceMode.currentStreak = 0;
  gameState.practiceMode.lastOutcome = null;

  // Hide selection screens
  document.getElementById('practice-scenario-screen').style.display = 'none';
  document.getElementById('practice-drill-screen').style.display = 'none';

  // Set up game state for practice
  gameState.setupComplete = true;
  gameState.gameMode = 'practice';  // Not '1player' - no computer opponent
  gameState.computerTeam = null;    // No computer in practice mode
  gameState.currentTeam = 'red';
  gameState.end = 1;
  gameState.scores = { red: 0, yellow: 0 };
  gameState.stonesThrown = { red: 0, yellow: 0 };

  // Load the scenario
  loadPracticeScenario(scenario);

  // Show practice UI overlay
  showPracticeOverlay(scenario);

  // Start quiet club ambience for practice (no large crowd)
  soundManager.startAmbientCrowd('club');

  // Start the game
  gameState.phase = 'aiming';
  updatePreviewStoneForTeam();
};

// Show custom scenarios list
window.showCustomScenarios = function() {
  const screen = document.getElementById('practice-scenario-screen');
  const list = document.getElementById('practice-scenario-list');
  const customScenarios = getCustomScenarios();

  if (!screen || !list) return;

  // Store that we're in custom mode
  gameState.practiceMode.currentDrill = 'custom';

  // Update header
  document.getElementById('scenario-drill-title').textContent = '💾 Custom Scenarios';
  document.getElementById('scenario-drill-desc').textContent = 'Scenarios saved from your games';

  // Update stats (hide them for custom)
  document.getElementById('drill-success-rate').textContent = '-';
  document.getElementById('drill-attempts').textContent = customScenarios.length;
  document.getElementById('drill-unlocked').textContent = 'N/A';

  if (customScenarios.length === 0) {
    list.innerHTML = `
      <div style="text-align: center; color: #64748b; padding: 40px;">
        <div style="font-size: 48px; margin-bottom: 15px;">💾</div>
        <div style="margin-bottom: 10px;">No saved scenarios yet</div>
        <div style="font-size: 12px;">During gameplay, tap the 💾 button to save the current stone positions</div>
      </div>
    `;
  } else {
    list.innerHTML = customScenarios.map(scenario => {
      const stoneCount = scenario.stones.length;
      const redCount = scenario.stones.filter(s => s.team === 'red').length;
      const yellowCount = scenario.stones.filter(s => s.team === 'yellow').length;
      const dateStr = new Date(scenario.createdAt).toLocaleDateString();

      return `
        <div class="practice-scenario-card" style="position: relative;">
          <div class="scenario-header">
            <div class="scenario-name">${scenario.name}</div>
            <button onclick="event.stopPropagation(); window.deleteCustomScenarioConfirm('${scenario.id}')" style="
              background: none;
              border: none;
              color: #ef4444;
              font-size: 16px;
              cursor: pointer;
              padding: 4px 8px;
            ">🗑️</button>
          </div>
          <div class="scenario-description" style="color: #94a3b8;">
            ${redCount} red, ${yellowCount} yellow stones • Saved ${dateStr}
          </div>
          <div class="scenario-stats">
            <div class="scenario-best">${stoneCount} stones total</div>
            <button class="scenario-start-btn" onclick="window.startCustomScenario('${scenario.id}')">START</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Hide drill screen, show scenario screen
  document.getElementById('practice-drill-screen').style.display = 'none';
  screen.style.display = 'block';
};

// Start a custom scenario
window.startCustomScenario = function(scenarioId) {
  const customScenarios = getCustomScenarios();
  const scenario = customScenarios.find(s => s.id === scenarioId);

  if (!scenario) return;

  // Set up practice mode state
  gameState.practiceMode.active = true;
  gameState.practiceMode.currentDrill = 'custom';
  gameState.practiceMode.currentScenario = scenarioId;
  gameState.practiceMode.difficulty = 0;  // No difficulty for custom
  gameState.practiceMode.attempts = 0;
  gameState.practiceMode.successes = 0;
  gameState.practiceMode.currentStreak = 0;
  gameState.practiceMode.lastOutcome = null;
  gameState.practiceMode.isCustom = true;  // Flag for custom scenarios

  // Hide selection screens
  document.getElementById('practice-scenario-screen').style.display = 'none';
  document.getElementById('practice-drill-screen').style.display = 'none';

  // Set up game state for practice
  gameState.setupComplete = true;
  gameState.gameMode = 'practice';
  gameState.computerTeam = null;
  gameState.currentTeam = 'red';
  gameState.end = 1;
  gameState.scores = { red: 0, yellow: 0 };
  gameState.stonesThrown = { red: 0, yellow: 0 };

  // Load the custom scenario
  loadPracticeScenario(scenario);

  // Show practice UI overlay (simplified for custom)
  showPracticeOverlay({
    name: scenario.name,
    hint: 'Custom scenario - practice freely!',
    target: null  // No success criteria for custom
  });

  // Start quiet club ambience for practice (no large crowd)
  soundManager.startAmbientCrowd('club');

  // Start the game
  gameState.phase = 'aiming';
  updatePreviewStoneForTeam();
};

// Confirm delete custom scenario
window.deleteCustomScenarioConfirm = function(scenarioId) {
  const scenarios = getCustomScenarios();
  const scenario = scenarios.find(s => s.id === scenarioId);
  if (!scenario) return;

  if (confirm(`Delete "${scenario.name}"?`)) {
    window.deleteCustomScenario(scenarioId);
    // Refresh the list
    window.showCustomScenarios();
  }
};

// Load a practice scenario (position stones)
function loadPracticeScenario(scenario) {
  // Clear existing stones
  for (const stone of gameState.stones) {
    if (stone.mesh) scene.remove(stone.mesh);
    if (stone.body) Matter.Composite.remove(engine.world, stone.body);
  }
  gameState.stones = [];

  // Place scenario stones
  for (const stoneData of scenario.stones) {
    const stone = createStone(stoneData.team);
    stone.mesh.position.set(stoneData.x, 0.05, stoneData.z);

    // Set physics body position
    Matter.Body.setPosition(stone.body, {
      x: stoneData.x * PHYSICS_SCALE,
      y: stoneData.z * PHYSICS_SCALE
    });
    Matter.Body.setVelocity(stone.body, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(stone.body, 0);

    gameState.stones.push(stone);
  }

  // Reset throwing state
  gameState.stonesThrown = { red: 0, yellow: 0 };
  // Use player's remembered curl preference, or default to 1 (curl right)
  gameState.curlDirection = gameState.playerCurlDirection || 1;
  gameState.handleAmount = gameState.playerHandleAmount ?? 0;

  // Reset camera to target view and lock it so READY button shows
  gameState.previewHeight = 1;
  gameState.previewLocked = true;
  updateReturnButton();

  // Update curl slider to reflect current state
  const slider = document.getElementById('curl-slider');
  if (slider) {
    slider.value = gameState.curlDirection * gameState.handleAmount;
    updateCurlDisplay();
  }

  // Enable curl controls for practice mode
  setCurlButtonsEnabled(true);
  setCurlDisplayVisible(true);
}

// Show practice overlay UI
function showPracticeOverlay(scenario) {
  let overlay = document.getElementById('practice-overlay');

  if (!overlay) {
    // Create overlay if it doesn't exist
    overlay = document.createElement('div');
    overlay.id = 'practice-overlay';
    overlay.innerHTML = `
      <div id="practice-header" style="
        position: fixed;
        top: max(20px, env(safe-area-inset-top));
        left: 0;
        right: 0;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 0 20px;
        z-index: 150;
        pointer-events: none;
      ">
        <div style="display: flex; gap: 8px; pointer-events: auto;">
          <button onclick="window.backFromPractice()" style="
            background: rgba(100, 116, 139, 0.9);
            border: none;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            font-weight: 600;
            padding: 10px 12px;
            cursor: pointer;
          ">←</button>
          <button id="practice-reset-btn" onclick="window.practiceQuickReset()" style="
            background: rgba(139, 92, 246, 0.9);
            border: none;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            font-weight: 600;
            padding: 10px 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
          ">↺ RESET</button>
          <button onclick="window.openSettings()" style="
            background: rgba(100, 116, 139, 0.9);
            border: none;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            font-weight: 600;
            padding: 10px 12px;
            cursor: pointer;
          ">⚙️</button>
        </div>

        <div style="
          background: rgba(0, 0, 0, 0.7);
          border-radius: 12px;
          padding: 12px 16px;
          text-align: right;
          pointer-events: auto;
        ">
          <div id="practice-scenario-name" style="color: white; font-size: 16px; font-weight: bold;"></div>
          <div style="display: flex; gap: 16px; margin-top: 6px;">
            <div style="color: #94a3b8; font-size: 13px;">
              Attempts: <span id="practice-attempts" style="color: white;">0</span>
            </div>
            <div style="color: #94a3b8; font-size: 13px;">
              Success: <span id="practice-successes" style="color: #4ade80;">0</span>
            </div>
          </div>
        </div>
      </div>

      <div id="practice-hint" style="
        position: fixed;
        bottom: 120px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        border: 1px solid rgba(139, 92, 246, 0.5);
        border-radius: 10px;
        padding: 12px 20px;
        color: #c4b5fd;
        font-size: 14px;
        z-index: 150;
        max-width: 300px;
        text-align: center;
        display: flex;
        align-items: center;
        gap: 8px;
      ">
        <span>💡</span>
        <span id="practice-hint-text"></span>
      </div>

      <div id="practice-result" style="
        display: none;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        border-radius: 16px;
        padding: 24px 32px;
        text-align: center;
        z-index: 200;
      ">
        <div id="practice-result-icon" style="font-size: 48px; margin-bottom: 12px;"></div>
        <div id="practice-result-text" style="color: white; font-size: 20px; font-weight: bold; margin-bottom: 16px;"></div>
        <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
          <button onclick="window.practiceQuickReset()" style="
            background: rgba(139, 92, 246, 0.8);
            border: none;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            font-weight: 600;
            padding: 10px 20px;
            cursor: pointer;
          ">Try Again</button>
          <button id="practice-next-btn" onclick="window.nextPracticeShot()" style="
            background: rgba(74, 222, 128, 0.8);
            border: none;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            font-weight: 600;
            padding: 10px 20px;
            cursor: pointer;
          ">Next Shot</button>
          <button onclick="window.exitPractice()" style="
            background: rgba(100, 116, 139, 0.8);
            border: none;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            padding: 10px 20px;
            cursor: pointer;
          ">Exit</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  // Update content
  document.getElementById('practice-scenario-name').textContent = scenario.name;
  document.getElementById('practice-hint-text').textContent = scenario.hint;
  document.getElementById('practice-attempts').textContent = '0';
  document.getElementById('practice-successes').textContent = '0';
  document.getElementById('practice-result').style.display = 'none';

  // Move curl slider down to avoid overlapping with practice buttons
  const curlDisplay = document.getElementById('curl-display');
  if (curlDisplay) {
    curlDisplay.style.top = 'max(100px, calc(env(safe-area-inset-top) + 80px))';
  }

  // Add Skip-specific UI elements
  const isSkipMode = gameState.practiceMode?.currentDrill === 'skip';
  setupSkipModeUI(isSkipMode, scenario);

  overlay.style.display = 'block';
}

// ============================================
// SKIP MODE - Strategic Decision Training
// ============================================

// Setup Skip mode UI (weight selector, context display, make call button)
function setupSkipModeUI(isSkipMode, scenario) {
  // Remove existing Skip UI if present
  const existingWeightSelector = document.getElementById('skip-weight-selector');
  const existingContext = document.getElementById('skip-context-display');
  const existingFeedback = document.getElementById('skip-feedback-overlay');
  if (existingWeightSelector) existingWeightSelector.remove();
  if (existingContext) existingContext.remove();
  if (existingFeedback) existingFeedback.remove();

  if (!isSkipMode) {
    // Reset Skip state
    gameState.skipCallWeight = null;
    return;
  }

  // Initialize Skip state
  gameState.skipCallWeight = null;
  gameState.skipCallMade = false;

  // Create weight selector
  const weightSelector = document.createElement('div');
  weightSelector.id = 'skip-weight-selector';
  weightSelector.innerHTML = `
    <div style="
      position: fixed;
      bottom: 220px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.85);
      border: 2px solid rgba(139, 92, 246, 0.6);
      border-radius: 12px;
      padding: 12px 16px;
      z-index: 160;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    ">
      <div style="color: #c4b5fd; font-size: 12px; font-weight: 600;">SELECT WEIGHT</div>
      <div style="display: flex; gap: 8px;">
        <button onclick="window.selectSkipWeight('guard')" data-weight="guard" style="
          background: rgba(74, 222, 128, 0.3);
          border: 2px solid transparent;
          border-radius: 8px;
          color: #4ade80;
          font-size: 12px;
          font-weight: 600;
          padding: 8px 12px;
          cursor: pointer;
        ">Guard</button>
        <button onclick="window.selectSkipWeight('draw')" data-weight="draw" style="
          background: rgba(59, 130, 246, 0.3);
          border: 2px solid transparent;
          border-radius: 8px;
          color: #3b82f6;
          font-size: 12px;
          font-weight: 600;
          padding: 8px 12px;
          cursor: pointer;
        ">Draw</button>
        <button onclick="window.selectSkipWeight('control')" data-weight="control" style="
          background: rgba(251, 191, 36, 0.3);
          border: 2px solid transparent;
          border-radius: 8px;
          color: #fbbf24;
          font-size: 12px;
          font-weight: 600;
          padding: 8px 12px;
          cursor: pointer;
        ">Control</button>
        <button onclick="window.selectSkipWeight('takeout')" data-weight="takeout" style="
          background: rgba(239, 68, 68, 0.3);
          border: 2px solid transparent;
          border-radius: 8px;
          color: #ef4444;
          font-size: 12px;
          font-weight: 600;
          padding: 8px 12px;
          cursor: pointer;
        ">Takeout</button>
      </div>
    </div>
  `;
  document.body.appendChild(weightSelector);

  // Create context display (score, end, hammer)
  if (scenario.context) {
    const ctx = scenario.context;
    const contextDisplay = document.createElement('div');
    contextDisplay.id = 'skip-context-display';
    const hammerText = ctx.hammer === 'red' ? 'You have hammer' : 'Opponent has hammer';
    const hammerColor = ctx.hammer === 'red' ? '#4ade80' : '#f87171';
    contextDisplay.innerHTML = `
      <div style="
        position: fixed;
        top: max(80px, calc(env(safe-area-inset-top) + 60px));
        right: max(20px, env(safe-area-inset-right));
        background: rgba(0, 0, 0, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 10px;
        padding: 10px 14px;
        z-index: 155;
        text-align: right;
      ">
        <div style="color: white; font-size: 14px; font-weight: 600;">End ${ctx.end} of ${ctx.totalEnds}</div>
        <div style="color: #94a3b8; font-size: 12px; margin-top: 4px;">
          Score: <span style="color: #ef4444;">${ctx.redScore}</span> - <span style="color: #facc15;">${ctx.yellowScore}</span>
        </div>
        <div style="color: ${hammerColor}; font-size: 12px; margin-top: 4px; font-weight: 500;">${hammerText}</div>
        <div style="color: #94a3b8; font-size: 11px; margin-top: 2px;">${ctx.stonesRemaining} stones left</div>
      </div>
    `;
    document.body.appendChild(contextDisplay);
  }

  // Create feedback overlay (hidden initially)
  const feedbackOverlay = document.createElement('div');
  feedbackOverlay.id = 'skip-feedback-overlay';
  feedbackOverlay.style.display = 'none';
  feedbackOverlay.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      z-index: 300;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    ">
      <div style="
        background: linear-gradient(135deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%);
        border: 2px solid rgba(139, 92, 246, 0.5);
        border-radius: 16px;
        padding: 24px;
        max-width: 400px;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
      ">
        <div id="skip-rating-badge" style="
          text-align: center;
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 16px;
          padding: 8px 16px;
          border-radius: 8px;
        "></div>

        <div style="margin-bottom: 16px;">
          <div style="color: #94a3b8; font-size: 12px; margin-bottom: 4px;">YOUR CALL</div>
          <div id="skip-your-call" style="color: white; font-size: 14px;"></div>
        </div>

        <div style="margin-bottom: 16px;">
          <div style="color: #94a3b8; font-size: 12px; margin-bottom: 4px;">ANALYSIS</div>
          <div id="skip-explanation" style="color: #e2e8f0; font-size: 14px; line-height: 1.5;"></div>
        </div>

        <div id="skip-optimal-section" style="margin-bottom: 20px; display: none;">
          <div style="color: #4ade80; font-size: 12px; margin-bottom: 4px;">OPTIMAL PLAY</div>
          <div id="skip-optimal-call" style="color: #4ade80; font-size: 14px;"></div>
          <div id="skip-optimal-reason" style="color: #86efac; font-size: 13px; margin-top: 4px; font-style: italic;"></div>
        </div>

        <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
          <button onclick="window.trySkipCall()" style="
            background: rgba(139, 92, 246, 0.8);
            border: none;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            font-weight: 600;
            padding: 12px 24px;
            cursor: pointer;
          ">Try It</button>
          <button onclick="window.nextSkipScenario()" style="
            background: rgba(74, 222, 128, 0.8);
            border: none;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            font-weight: 600;
            padding: 12px 24px;
            cursor: pointer;
          ">Next</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(feedbackOverlay);
}

// Select weight for Skip call
window.selectSkipWeight = function(weight) {
  gameState.skipCallWeight = weight;

  // Update button visual states
  const buttons = document.querySelectorAll('#skip-weight-selector button[data-weight]');
  buttons.forEach(btn => {
    if (btn.dataset.weight === weight) {
      btn.style.borderColor = 'white';
      btn.style.transform = 'scale(1.05)';
    } else {
      btn.style.borderColor = 'transparent';
      btn.style.transform = 'scale(1)';
    }
  });

  // Check if ready to make call (target + curl + weight)
  updateMakeCallButton();
};

// Update Make Call button state
function updateMakeCallButton() {
  const btn = document.getElementById('return-to-throw');
  if (!btn) return;

  const isSkipMode = gameState.practiceMode?.currentDrill === 'skip';
  if (!isSkipMode) return;

  const hasTarget = gameState.targetPosition !== null;
  const hasCurl = gameState.curlDirection !== null;
  const hasWeight = gameState.skipCallWeight !== null;

  const isReady = hasTarget && hasCurl && hasWeight;

  btn.textContent = 'CALL';
  btn.style.fontSize = '28px';
  btn.style.padding = '16px 40px';
  btn.style.opacity = isReady ? '1' : '0.5';
  btn.disabled = !isReady;
}

// Handle Make Call button press in Skip mode
function handleSkipMakeCall() {
  if (gameState.skipCallMade) return;

  const hasTarget = gameState.targetPosition !== null;
  const hasCurl = gameState.curlDirection !== null;
  const hasWeight = gameState.skipCallWeight !== null;

  if (!hasTarget || !hasCurl || !hasWeight) {
    console.log('[Skip] Not ready to make call');
    return false;
  }

  gameState.skipCallMade = true;
  const feedback = evaluateSkipCall();
  showSkipFeedback(feedback);
  return true;
}

// Evaluate the player's skip call
function evaluateSkipCall() {
  const scenario = PRACTICE_SCENARIOS.skip.find(s => s.id === gameState.practiceMode.currentScenario);
  if (!scenario || !scenario.solutions) {
    return { rating: 'okay', explanation: 'No evaluation available for this scenario.' };
  }

  const playerCall = {
    target: gameState.targetPosition,
    curl: gameState.curlDirection,
    weight: gameState.skipCallWeight
  };

  // Find best matching solution
  let bestMatch = null;
  let bestScore = -1;

  for (const solution of scenario.solutions) {
    let score = 0;

    // Weight match (40% of score)
    if (solution.weight === playerCall.weight) {
      score += 40;
    } else if (
      (solution.weight === 'guard' && playerCall.weight === 'draw') ||
      (solution.weight === 'draw' && playerCall.weight === 'guard') ||
      (solution.weight === 'control' && playerCall.weight === 'takeout') ||
      (solution.weight === 'takeout' && playerCall.weight === 'control')
    ) {
      score += 20; // Close but not exact
    }

    // Target proximity (30% of score) - if solution has a target
    if (solution.target && playerCall.target) {
      const dx = solution.target.x - playerCall.target.x;
      const dz = solution.target.z - playerCall.target.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 0.5) score += 30;
      else if (dist < 1.0) score += 20;
      else if (dist < 2.0) score += 10;
    } else if (!solution.target) {
      // No target required for this solution
      score += 15;
    }

    // Shot type inference (20% of score)
    const playerShotType = inferShotType(playerCall);
    if (solution.type === playerShotType) {
      score += 20;
    } else if (
      (solution.type === 'draw' && playerShotType === 'guard') ||
      (solution.type === 'guard' && playerShotType === 'draw')
    ) {
      score += 10;
    }

    // Curl direction (10% of score)
    if (solution.curl === 'either' || solution.curl === playerCall.curl ||
        (solution.curl === 'right' && playerCall.curl === 1) ||
        (solution.curl === 'left' && playerCall.curl === -1)) {
      score += 10;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = solution;
    }
  }

  // Determine rating based on best match
  let rating, ratingColor;
  if (bestMatch && bestMatch.rating === 'excellent' && bestScore >= 70) {
    rating = 'EXCELLENT CALL!';
    ratingColor = '#4ade80';
  } else if (bestMatch && (bestMatch.rating === 'excellent' || bestMatch.rating === 'good') && bestScore >= 50) {
    rating = 'GOOD CALL';
    ratingColor = '#60a5fa';
  } else if (bestScore >= 30) {
    rating = 'OKAY, BUT...';
    ratingColor = '#fbbf24';
  } else {
    rating = 'CONSIDER THIS';
    ratingColor = '#f87171';
  }

  // Get the optimal solution (first one is always optimal)
  const optimal = scenario.solutions[0];
  const isOptimal = bestMatch === optimal && bestScore >= 70;

  return {
    rating,
    ratingColor,
    playerCall: describeCall(playerCall),
    explanation: bestMatch ? bestMatch.explanation : 'Try a different approach.',
    showOptimal: !isOptimal,
    optimalCall: describeCall({
      target: optimal.target,
      curl: optimal.curl,
      weight: optimal.weight
    }),
    optimalReason: optimal.explanation
  };
}

// Infer shot type from player call
function inferShotType(call) {
  if (!call.target) return 'unknown';

  const targetZ = call.target.z;
  const inHouse = targetZ >= (TEE_LINE_FAR - RING_12FT) && targetZ <= (TEE_LINE_FAR + RING_12FT);
  const inGuardZone = targetZ >= HOG_LINE_FAR && targetZ < (TEE_LINE_FAR - RING_12FT);

  if (call.weight === 'takeout' || call.weight === 'control') {
    return 'takeout';
  } else if (call.weight === 'guard' || inGuardZone) {
    return 'guard';
  } else if (inHouse) {
    return 'draw';
  }
  return 'draw';
}

// Describe a call in human-readable terms
function describeCall(call) {
  if (!call) return 'No call';

  const weightNames = {
    'guard': 'Guard weight',
    'draw': 'Draw weight',
    'control': 'Control weight',
    'takeout': 'Takeout weight'
  };

  const curlNames = {
    1: 'clockwise',
    '-1': 'counter-clockwise',
    'right': 'clockwise',
    'left': 'counter-clockwise',
    'either': 'either turn'
  };

  const weight = weightNames[call.weight] || call.weight || 'Unknown weight';
  const curl = curlNames[call.curl] || 'unknown curl';

  let location = '';
  if (call.target) {
    const z = call.target.z;
    if (z < HOG_LINE_FAR) {
      location = 'short of hog line';
    } else if (z < TEE_LINE_FAR - RING_12FT) {
      location = 'guard position';
    } else if (z < TEE_LINE_FAR - RING_4FT) {
      location = 'front of house';
    } else if (z < TEE_LINE_FAR + BUTTON_RADIUS) {
      location = 'near button';
    } else {
      location = 'back of house';
    }
  }

  return `${weight}, ${curl}${location ? ', ' + location : ''}`;
}

// Show Skip feedback overlay
function showSkipFeedback(feedback) {
  const overlay = document.getElementById('skip-feedback-overlay');
  if (!overlay) return;

  // Update rating badge
  const badge = document.getElementById('skip-rating-badge');
  badge.textContent = feedback.rating;
  badge.style.color = feedback.ratingColor;
  badge.style.background = feedback.ratingColor + '20';
  badge.style.border = `2px solid ${feedback.ratingColor}`;

  // Update content
  document.getElementById('skip-your-call').textContent = feedback.playerCall;
  document.getElementById('skip-explanation').textContent = feedback.explanation;

  // Show optimal if different from player's choice
  const optimalSection = document.getElementById('skip-optimal-section');
  if (feedback.showOptimal) {
    optimalSection.style.display = 'block';
    document.getElementById('skip-optimal-call').textContent = feedback.optimalCall;
    document.getElementById('skip-optimal-reason').textContent = feedback.optimalReason;
  } else {
    optimalSection.style.display = 'none';
  }

  // Update stats
  gameState.practiceMode.attempts++;
  const isSuccess = feedback.rating === 'EXCELLENT CALL!' || feedback.rating === 'GOOD CALL';
  if (isSuccess) {
    gameState.practiceMode.successes++;
  }

  // Update practice stats
  const drillId = gameState.practiceMode.currentDrill;
  const scenarioId = gameState.practiceMode.currentScenario;
  practiceStats[drillId].attempts++;
  if (isSuccess) practiceStats[drillId].successes++;
  if (!practiceStats[drillId].scenarios[scenarioId]) {
    practiceStats[drillId].scenarios[scenarioId] = { attempts: 0, successes: 0 };
  }
  practiceStats[drillId].scenarios[scenarioId].attempts++;
  if (isSuccess) practiceStats[drillId].scenarios[scenarioId].successes++;
  savePracticeStats();

  // Update UI counters
  document.getElementById('practice-attempts').textContent = gameState.practiceMode.attempts;
  document.getElementById('practice-successes').textContent = gameState.practiceMode.successes;

  overlay.style.display = 'block';
}

// Try executing the Skip call
window.trySkipCall = function() {
  const overlay = document.getElementById('skip-feedback-overlay');
  if (overlay) overlay.style.display = 'none';

  // Convert weight to effort percentage
  const effortMap = {
    'guard': 40,
    'draw': 55,
    'control': 70,
    'takeout': 85
  };
  gameState.currentPower = effortMap[gameState.skipCallWeight] || 55;
  gameState.maxPower = gameState.currentPower;

  // Reset Skip call state for next attempt
  gameState.skipCallMade = false;

  // Trigger throw sequence
  gameState.phase = 'aiming';
  gameState.previewHeight = 0;  // Go to throw view
  gameState.previewLocked = false;

  // Short delay then auto-throw
  setTimeout(() => {
    // Simulate throw with player's settings
    gameState.phase = 'charging';
    startPull(window.innerWidth / 2, window.innerHeight / 2);
    updatePull(window.innerWidth / 2, window.innerHeight / 2 + gameState.currentPower * 2);
    pushOff();

    setTimeout(() => {
      if (gameState.phase === 'sliding') {
        releaseStone();
      }
    }, 800);
  }, 500);
};

// Move to next Skip scenario
window.nextSkipScenario = function() {
  const overlay = document.getElementById('skip-feedback-overlay');
  if (overlay) overlay.style.display = 'none';

  const scenarios = PRACTICE_SCENARIOS.skip;
  const currentIdx = scenarios.findIndex(s => s.id === gameState.practiceMode.currentScenario);
  const nextIdx = (currentIdx + 1) % scenarios.length;

  if (nextIdx === 0) {
    // Completed all scenarios, return to selection
    window.backFromPractice();
  } else {
    const nextScenario = scenarios[nextIdx];
    gameState.practiceMode.currentScenario = nextScenario.id;
    gameState.practiceMode.difficulty = nextScenario.difficulty;
    gameState.practiceMode.attempts = 0;
    gameState.practiceMode.successes = 0;
    gameState.skipCallWeight = null;
    gameState.skipCallMade = false;

    // Reload scenario
    loadPracticeScenario(nextScenario);
    showPracticeOverlay(nextScenario);
  }
};

// Update practice reset button state (grey out in target view before throwing)
function updatePracticeResetButton() {
  const btn = document.getElementById('practice-reset-btn');
  if (!btn || !gameState.practiceMode?.active) return;

  // Disable reset when in target view and no throw has started
  const inTargetView = gameState.previewHeight > 0.5;
  const inAiming = gameState.phase === 'aiming';
  const shouldDisable = inTargetView && inAiming;

  if (shouldDisable) {
    btn.style.opacity = '0.4';
    btn.style.cursor = 'not-allowed';
    btn.disabled = true;
  } else {
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
    btn.disabled = false;
  }
}

// Quick reset practice scenario
window.practiceQuickReset = function() {
  if (!gameState.practiceMode.active) return;

  // Don't reset if in target view during aiming
  const btn = document.getElementById('practice-reset-btn');
  if (btn && btn.disabled) return;

  const drillId = gameState.practiceMode.currentDrill;
  const scenarioId = gameState.practiceMode.currentScenario;

  let scenario;
  if (drillId === 'custom') {
    // Custom scenario
    const customScenarios = getCustomScenarios();
    scenario = customScenarios.find(s => s.id === scenarioId);
  } else {
    // Built-in scenario
    const scenarios = PRACTICE_SCENARIOS[drillId];
    scenario = scenarios?.find(s => s.id === scenarioId);
  }

  if (!scenario) return;

  // Hide result popup
  document.getElementById('practice-result').style.display = 'none';

  // Reload scenario
  loadPracticeScenario(scenario);

  // Reset game phase
  gameState.phase = 'aiming';
  updatePreviewStoneForTeam();
};

// Load next shot in the current drill category, or go to drill selection if on last shot
window.nextPracticeShot = function() {
  if (!gameState.practiceMode.active) return;

  const drillId = gameState.practiceMode.currentDrill;
  const scenarioId = gameState.practiceMode.currentScenario;

  // Custom scenarios don't have a "next" - just reset
  if (drillId === 'custom') {
    window.practiceQuickReset();
    return;
  }

  const scenarios = PRACTICE_SCENARIOS[drillId];
  if (!scenarios || scenarios.length === 0) return;

  // Find current scenario index
  const currentIndex = scenarios.findIndex(s => s.id === scenarioId);
  if (currentIndex === -1) return;

  // Check if on last shot - go to drill selection
  if (currentIndex === scenarios.length - 1) {
    window.exitPractice();
    showPracticeDrills();
    return;
  }

  // Get next scenario
  const nextIndex = currentIndex + 1;
  const nextScenario = scenarios[nextIndex];

  // Update current scenario tracking
  gameState.practiceMode.currentScenario = nextScenario.id;

  // Reset attempts and successes for this new scenario
  gameState.practiceMode.attempts = 0;
  gameState.practiceMode.successes = 0;
  gameState.practiceMode.currentStreak = 0;

  // Hide result popup
  document.getElementById('practice-result').style.display = 'none';

  // Load new scenario
  loadPracticeScenario(nextScenario);

  // Update overlay UI with new scenario info
  document.getElementById('practice-scenario-name').textContent = nextScenario.name;
  document.getElementById('practice-hint-text').textContent = nextScenario.hint;
  document.getElementById('practice-attempts').textContent = '0';
  document.getElementById('practice-successes').textContent = '0';

  // Reset game phase
  gameState.phase = 'aiming';
  updatePreviewStoneForTeam();
};

// Go back one level from practice gameplay to scenario selection
window.backFromPractice = function() {
  gameState.practiceMode.active = false;

  // Hide overlay
  const overlay = document.getElementById('practice-overlay');
  if (overlay) overlay.style.display = 'none';

  // Reset curl slider position
  const curlDisplay = document.getElementById('curl-display');
  if (curlDisplay) {
    curlDisplay.style.top = 'max(20px, env(safe-area-inset-top))';
  }

  // Hide game canvas
  const canvas = document.getElementById('game-canvas');
  if (canvas) canvas.style.display = 'none';

  // Clear stones
  for (const stone of gameState.stones) {
    if (stone.mesh) scene.remove(stone.mesh);
    if (stone.body) Matter.Composite.remove(engine.world, stone.body);
  }
  gameState.stones = [];

  // Go back to scenario selection for current drill type
  const drillType = gameState.practiceMode?.currentDrill;
  if (drillType && drillType !== 'custom') {
    showPracticeScenarios(drillType);
  } else {
    // Fallback to drill selection if custom or no drill type
    showPracticeDrills();
  }
};

// Exit practice mode completely
window.exitPractice = function() {
  gameState.practiceMode.active = false;

  // Hide overlay
  const overlay = document.getElementById('practice-overlay');
  if (overlay) overlay.style.display = 'none';

  // Reset curl slider position
  const curlDisplay = document.getElementById('curl-display');
  if (curlDisplay) {
    curlDisplay.style.top = 'max(20px, env(safe-area-inset-top))';
  }

  // Clear stones
  for (const stone of gameState.stones) {
    if (stone.mesh) scene.remove(stone.mesh);
    if (stone.body) Matter.Composite.remove(engine.world, stone.body);
  }
  gameState.stones = [];

  // Show mode select
  showModeSelect();
};

// ============================================
// ONLINE MULTIPLAYER - UI Functions
// ============================================

async function showMultiplayerLobby() {
  document.getElementById('mode-select-screen').style.display = 'none';
  hideModeSelectFooter();
  document.getElementById('multiplayer-lobby-screen').style.display = 'block';

  // Clear any previous error
  const errorEl = document.getElementById('mp-error');
  if (errorEl) errorEl.style.display = 'none';

  // Try to restore saved player name
  const savedName = localStorage.getItem('curlingpro_mp_name');
  if (savedName) {
    document.getElementById('mp-player-name').value = savedName;
  }

  // Fetch and display player's ELO rating
  const eloDisplay = document.getElementById('player-elo-display');
  const eloValue = document.getElementById('player-elo-value');
  const playerRecord = document.getElementById('player-record');

  if (eloDisplay && eloValue) {
    try {
      const playerName = savedName || 'Player';
      const rating = await multiplayer.getOrCreatePlayerRating(playerName);

      if (rating) {
        eloValue.textContent = rating.elo_rating;
        if (playerRecord && rating.games_played > 0) {
          playerRecord.textContent = `(${rating.wins}W - ${rating.losses}L)`;
        } else if (playerRecord) {
          playerRecord.textContent = '';
        }
        eloDisplay.style.display = 'block';
      }
    } catch (err) {
      console.log('Could not fetch player rating:', err);
      // Hide the ELO display if we can't fetch it
      eloDisplay.style.display = 'none';
    }
  }
}

function showMultiplayerWaiting(roomCode, isHost) {
  // Hide all other screens that might be visible
  const screens = [
    'multiplayer-lobby-screen',
    'quickmatch-searching-screen',
    'mode-select-screen',
    'tournament-bracket-screen',
    'season-screen'
  ];
  screens.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  document.getElementById('multiplayer-waiting-screen').style.display = 'block';

  // Update room code display
  document.getElementById('mp-room-code-value').textContent = roomCode;

  // Reset UI state
  document.getElementById('mp-opponent-info').style.display = 'none';
  document.getElementById('mp-start-game-btn').style.display = 'none';
  document.getElementById('mp-waiting-spinner').style.display = 'block';

  if (isHost) {
    document.getElementById('mp-waiting-title').textContent = 'Waiting for opponent...';
    document.getElementById('mp-waiting-subtitle').textContent = 'Share the room code with your friend';
    document.getElementById('mp-room-code-display').style.display = 'block';
  } else {
    document.getElementById('mp-waiting-title').textContent = 'Connecting...';
    document.getElementById('mp-waiting-subtitle').textContent = 'Joining game';
    document.getElementById('mp-room-code-display').style.display = 'block';
  }
}

function showMultiplayerError(message) {
  const errorEl = document.getElementById('mp-error');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
}

// Create online game (host)
window.createOnlineGame = async function() {
  const nameInput = document.getElementById('mp-player-name');
  const playerName = nameInput.value.trim() || 'Player';

  // Save name for next time
  localStorage.setItem('curlingpro_mp_name', playerName);

  // TODO: Get player's country from career mode or let them select
  const playerCountry = gameState.playerCountry || { code: 'UN', name: 'Player', flag: '🏳️' };

  // Show waiting screen
  showMultiplayerWaiting('------', true);

  // Set up callbacks
  multiplayer.multiplayerState.onPlayerJoined = (data) => {
    console.log('[Main] Opponent joined:', data);

    // Update UI
    document.getElementById('mp-waiting-spinner').style.display = 'none';
    document.getElementById('mp-waiting-title').textContent = 'Opponent connected!';
    document.getElementById('mp-waiting-subtitle').textContent = 'Ready to start';

    document.getElementById('mp-opponent-info').style.display = 'block';
    document.getElementById('mp-opponent-name').textContent = data.name;

    // Show start button for host
    document.getElementById('mp-start-game-btn').style.display = 'block';
  };

  multiplayer.multiplayerState.onPlayerLeft = () => {
    console.log('[Main] Opponent left');
    document.getElementById('mp-opponent-info').style.display = 'none';
    document.getElementById('mp-start-game-btn').style.display = 'none';
    document.getElementById('mp-waiting-spinner').style.display = 'block';
    document.getElementById('mp-waiting-title').textContent = 'Opponent disconnected';
    document.getElementById('mp-waiting-subtitle').textContent = 'Waiting for a new opponent...';
  };

  // Toss choice callback (when guest wins toss and makes their choice)
  multiplayer.multiplayerState.onTossChoice = (data) => {
    console.log('[Main] Toss choice received:', data);
    gameState.tossChoiceReceived = true;  // Prevent race condition with animation
    document.getElementById('coin-toss-overlay').style.display = 'none';

    if (data.choice === 'hammer') {
      // Guest chose hammer, host picks color
      gameState.coinTossHammer = data.hammer;
      gameState.isLoserPickingColor = true;
      document.getElementById('color-choice-overlay').style.display = 'flex';
    } else {
      // Guest chose color, we get hammer
      gameState.coinTossHammer = data.hammer;
      gameState.coinTossFirstThrow = data.color;
      // Our color is the opposite of what they chose
      const myColor = data.color === 'red' ? 'yellow' : 'red';
      showTeamAssignment(myColor, true);  // we have hammer
    }
  };

  // Color choice callback (when opponent picks color after we took hammer)
  multiplayer.multiplayerState.onColorChoice = (data) => {
    console.log('[Main] Color choice received from opponent:', data);
    gameState.tossChoiceReceived = true;  // Prevent race condition
    // Hide waiting overlay
    document.getElementById('coin-toss-overlay').style.display = 'none';

    // Opponent chose their color, we already have hammer
    gameState.coinTossFirstThrow = data.color;

    // Our color is the opposite of what they chose
    const myColor = data.color === 'red' ? 'yellow' : 'red';

    // Show assignment and start game
    showTeamAssignment(myColor, true);  // we have hammer
  };

  // Create the game
  const result = await multiplayer.createGame(playerName, playerCountry);

  if (result.success) {
    document.getElementById('mp-room-code-value').textContent = result.roomCode;
  } else {
    showMultiplayerLobby();
    showMultiplayerError(result.error || 'Failed to create game');
  }
};

// Join online game (guest)
window.joinOnlineGame = async function() {
  const nameInput = document.getElementById('mp-player-name');
  const codeInput = document.getElementById('mp-room-code');

  const playerName = nameInput.value.trim() || 'Player';
  const roomCode = codeInput.value.trim().toUpperCase();

  if (roomCode.length !== 6) {
    showMultiplayerError('Please enter a valid 6-character room code');
    return;
  }

  // Save name for next time
  localStorage.setItem('curlingpro_mp_name', playerName);

  // TODO: Get player's country
  const playerCountry = gameState.playerCountry || { code: 'UN', name: 'Player', flag: '🏳️' };

  // Show waiting screen
  showMultiplayerWaiting(roomCode, false);

  // Set up callbacks
  multiplayer.multiplayerState.onGameStart = (data) => {
    console.log('[Main] Game starting:', data);
    // Show coin toss with result from host
    showMultiplayerCoinToss(data.coinResult, false);
  };

  multiplayer.multiplayerState.onTossChoice = (data) => {
    console.log('[Main] Toss choice received:', data);
    gameState.tossChoiceReceived = true;  // Prevent race condition with animation
    // Hide waiting overlay
    document.getElementById('coin-toss-overlay').style.display = 'none';

    // Set up game state based on opponent's choice
    if (data.choice === 'hammer') {
      // Opponent chose hammer, we get to pick color
      gameState.coinTossHammer = data.hammer;
      // Store that we're the loser picking color
      gameState.isLoserPickingColor = true;
      // Show color selection overlay
      document.getElementById('color-choice-overlay').style.display = 'flex';
    } else {
      // Opponent chose color, we get hammer
      gameState.coinTossHammer = data.hammer;
      gameState.coinTossFirstThrow = data.color;
      // Our color is the opposite of what they chose
      const myColor = data.color === 'red' ? 'yellow' : 'red';
      showTeamAssignment(myColor, true);  // we have hammer
    }
  };

  multiplayer.multiplayerState.onColorChoice = (data) => {
    console.log('[Main] Color choice received from loser:', data);
    gameState.tossChoiceReceived = true;  // Prevent race condition
    // Hide waiting overlay
    document.getElementById('coin-toss-overlay').style.display = 'none';

    // Loser chose their color, we already have hammer
    gameState.coinTossFirstThrow = data.color;

    // Our color is the opposite of what they chose
    const myColor = data.color === 'red' ? 'yellow' : 'red';

    // Show assignment and start game
    showTeamAssignment(myColor, true);  // we have hammer
  };

  multiplayer.multiplayerState.onPlayerLeft = () => {
    console.log('[Main] Host left');
    showMultiplayerLobby();
    showMultiplayerError('Host disconnected');
  };

  // Join the game
  const result = await multiplayer.joinGame(roomCode, playerName, playerCountry);

  if (result.success) {
    // Wait for host to start the game
    document.getElementById('mp-waiting-spinner').style.display = 'none';
    document.getElementById('mp-waiting-title').textContent = 'Connected!';
    document.getElementById('mp-waiting-subtitle').textContent = 'Waiting for host to start...';

    // Show opponent info
    const opponent = multiplayer.getOpponentInfo();
    if (opponent.name) {
      document.getElementById('mp-opponent-info').style.display = 'block';
      document.getElementById('mp-opponent-name').textContent = opponent.name;
    }
  } else {
    showMultiplayerLobby();
    showMultiplayerError(result.error || 'Failed to join game');
  }
};

// ============================================
// QUICK MATCH (Ranked Matchmaking)
// ============================================

// Start quick match search
window.startQuickMatch = async function() {
  const nameInput = document.getElementById('mp-player-name');
  const playerName = nameInput.value.trim() || 'Player';

  // Save name for next time
  localStorage.setItem('curlingpro_mp_name', playerName);

  // Show searching screen (hide all other screens first)
  const lobbyScreen = document.getElementById('multiplayer-lobby-screen');
  const modeScreen = document.getElementById('mode-select-screen');
  const tournamentScreen = document.getElementById('tournament-bracket-screen');
  const seasonScreen = document.getElementById('season-screen');
  const searchScreen = document.getElementById('quickmatch-searching-screen');

  if (lobbyScreen) lobbyScreen.style.display = 'none';
  if (modeScreen) modeScreen.style.display = 'none';
  if (tournamentScreen) tournamentScreen.style.display = 'none';
  if (seasonScreen) seasonScreen.style.display = 'none';
  if (searchScreen) searchScreen.style.display = 'block';

  // Get player's rating
  const rating = await multiplayer.getOrCreatePlayerRating(playerName);
  document.getElementById('qm-player-elo').textContent = rating.elo_rating;

  // Track matchmaking state globally
  gameState.matchmakingActive = true;
  gameState.matchmakingTimeout = null;

  // Set 20-second timeout for matchmaking
  console.log('[QuickMatch] Starting 20-second timeout');
  gameState.matchmakingTimeout = setTimeout(() => {
    console.log('[QuickMatch] Timeout fired, matchmakingActive:', gameState.matchmakingActive);
    if (gameState.matchmakingActive) {
      gameState.matchmakingActive = false;
      console.log('[QuickMatch] No match found after 20 seconds - cancelling');
      multiplayer.leaveMatchmakingQueue();
      const searchScreen = document.getElementById('quickmatch-searching-screen');
      if (searchScreen) searchScreen.style.display = 'none';
      // Show modal dialog
      const modal = document.getElementById('no-opponents-modal');
      if (modal) modal.style.display = 'flex';
    }
  }, 20000);

  // Join matchmaking queue
  const result = await multiplayer.joinMatchmakingQueue(
    playerName,
    // Match found callback
    async (matchData) => {
      gameState.matchmakingActive = false;
      if (gameState.matchmakingTimeout) {
        clearTimeout(gameState.matchmakingTimeout);
        gameState.matchmakingTimeout = null;
      }
      console.log('[QuickMatch] Match found:', matchData);

      // Show match found UI
      document.getElementById('qm-status-title').textContent = 'Match Found!';
      document.getElementById('qm-status-message').textContent = 'Connecting to game...';
      document.getElementById('qm-match-found').style.display = 'block';
      document.getElementById('qm-opponent-name').textContent = matchData.opponent.name;
      document.getElementById('qm-opponent-elo').textContent = `Rating: ${matchData.opponent.elo}`;

      // Store opponent ELO for rating update after game
      gameState.rankedMatch = {
        opponentElo: matchData.opponent.elo,
        opponentName: matchData.opponent.name
      };

      // Short delay then connect to the game
      await new Promise(resolve => setTimeout(resolve, 1500));

      // DON'T hide searching screen here - let setup functions show the next screen
      // The searching screen will be hidden by showMultiplayerWaiting or showMultiplayerCoinToss

      // Connect to the game room
      const playerCountry = gameState.playerCountry || { code: 'UN', name: 'Player', flag: '🏳️' };

      if (matchData.isHost) {
        // We're the host - create the game with the assigned room code
        await setupQuickMatchAsHost(matchData.roomCode, playerName, playerCountry, matchData.opponent);
      } else {
        // We're the guest - join the game
        await setupQuickMatchAsGuest(matchData.roomCode, playerName, playerCountry, matchData.opponent);
      }
    },
    // Search update callback
    (updateData) => {
      document.getElementById('qm-status-message').textContent = updateData.status;
      document.getElementById('qm-wait-time').textContent = `${updateData.waitTime}s`;
      document.getElementById('qm-search-range').textContent = `Searching: ±${updateData.eloRange} ELO`;
    }
  );

  if (!result.success) {
    gameState.matchmakingActive = false;
    if (gameState.matchmakingTimeout) {
      clearTimeout(gameState.matchmakingTimeout);
      gameState.matchmakingTimeout = null;
    }
    document.getElementById('quickmatch-searching-screen').style.display = 'none';
    showMultiplayerLobby();
    showMultiplayerError(result.error || 'Failed to join matchmaking');
  }
};

// Setup quick match as host
async function setupQuickMatchAsHost(roomCode, playerName, playerCountry, opponent) {
  console.log('[QuickMatch Host] Setting up as host for room:', roomCode);

  // Set up host callbacks (similar to createOnlineGame)
  multiplayer.multiplayerState.onPlayerJoined = (data) => {
    console.log('[QuickMatch Host] Opponent joined:', data);
    // Update UI to show opponent connected
    document.getElementById('mp-waiting-spinner').style.display = 'none';
    document.getElementById('mp-opponent-info').style.display = 'block';
    document.getElementById('mp-opponent-name').textContent = data.name || opponent.name;

    // Auto-start the coin toss since both players are ready
    console.log('[QuickMatch Host] Will start game in 1 second...');
    setTimeout(() => {
      console.log('[QuickMatch Host] Calling startOnlineGame, isHost:', multiplayer.isHost());
      window.startOnlineGame();
    }, 1000);
  };

  multiplayer.multiplayerState.onPlayerLeft = () => {
    console.log('[QuickMatch] Opponent left');
    showMultiplayerLobby();
    showMultiplayerError('Opponent disconnected');
  };

  setupCommonMultiplayerCallbacks();

  // Create the game with the matchmaking-assigned room code
  console.log('[QuickMatch Host] Creating game with room code:', roomCode);
  const result = await multiplayer.createGame(playerName, playerCountry, roomCode);
  console.log('[QuickMatch Host] createGame result:', result.success, 'isHost:', multiplayer.isHost());

  if (result.success) {
    // Show waiting screen while guest connects
    showMultiplayerWaiting(roomCode, true);
    document.getElementById('mp-waiting-title').textContent = 'Waiting for opponent...';
    document.getElementById('mp-waiting-subtitle').textContent = `Playing against ${opponent.name}`;
    document.getElementById('mp-room-code-display').style.display = 'none';
  } else {
    showMultiplayerLobby();
    showMultiplayerError(result.error || 'Failed to create game');
  }
}

// Setup quick match as guest
async function setupQuickMatchAsGuest(roomCode, playerName, playerCountry, opponent) {
  console.log('[QuickMatch Guest] Setting up as guest for room:', roomCode);

  // Set up guest callbacks (similar to joinOnlineGame)
  multiplayer.multiplayerState.onGameStart = (data) => {
    console.log('[QuickMatch Guest] onGameStart received:', data);
    showMultiplayerCoinToss(data.coinResult, false);
  };

  multiplayer.multiplayerState.onPlayerLeft = () => {
    console.log('[QuickMatch] Host left');
    showMultiplayerLobby();
    showMultiplayerError('Opponent disconnected');
  };

  setupCommonMultiplayerCallbacks();

  // Give the host a moment to create the room before joining
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Try to join the game with retry
  let result = null;
  let retries = 3;

  while (retries > 0) {
    result = await multiplayer.joinGame(roomCode, playerName, playerCountry);
    if (result.success) break;

    retries--;
    if (retries > 0) {
      console.log('[QuickMatch] Join failed, retrying...', retries, 'attempts left');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (result && result.success) {
    // Only show waiting screen if game hasn't already started (coin toss not showing)
    const coinTossOverlay = document.getElementById('coin-toss-overlay');
    if (coinTossOverlay && coinTossOverlay.style.display === 'flex') {
      // Coin toss is already showing, don't overwrite it
      console.log('[QuickMatch Guest] Coin toss already showing, skipping waiting screen');
    } else {
      // Show waiting screen briefly while waiting for host to start
      showMultiplayerWaiting(roomCode, false);
      document.getElementById('mp-waiting-title').textContent = 'Connected!';
      document.getElementById('mp-waiting-subtitle').textContent = `Playing against ${opponent.name}`;
      document.getElementById('mp-room-code-display').style.display = 'none';
      document.getElementById('mp-waiting-spinner').style.display = 'none';
    }
  } else {
    showMultiplayerLobby();
    showMultiplayerError(result?.error || 'Failed to join game');
  }
}

// Common callbacks used by both host and guest in quick match
function setupCommonMultiplayerCallbacks() {
  multiplayer.multiplayerState.onTossChoice = (data) => {
    console.log('[QuickMatch] Toss choice received:', data);
    gameState.tossChoiceReceived = true;
    document.getElementById('coin-toss-overlay').style.display = 'none';

    if (data.choice === 'hammer') {
      gameState.coinTossHammer = data.hammer;
      gameState.isLoserPickingColor = true;
      document.getElementById('color-choice-overlay').style.display = 'flex';
    } else {
      gameState.coinTossHammer = data.hammer;
      gameState.coinTossFirstThrow = data.color;
      const myColor = data.color === 'red' ? 'yellow' : 'red';
      showTeamAssignment(myColor, true);
    }
  };

  multiplayer.multiplayerState.onColorChoice = (data) => {
    console.log('[QuickMatch] Color choice received:', data);
    gameState.tossChoiceReceived = true;
    document.getElementById('coin-toss-overlay').style.display = 'none';
    gameState.coinTossFirstThrow = data.color;
    const myColor = data.color === 'red' ? 'yellow' : 'red';
    showTeamAssignment(myColor, true);
  };
}

// Cancel quick match search
window.cancelQuickMatch = async function() {
  gameState.matchmakingActive = false;
  if (gameState.matchmakingTimeout) {
    clearTimeout(gameState.matchmakingTimeout);
    gameState.matchmakingTimeout = null;
  }
  await multiplayer.leaveMatchmakingQueue();
  document.getElementById('quickmatch-searching-screen').style.display = 'none';
  showMultiplayerLobby();
};

// Close no opponents modal and return to lobby
window.closeNoOpponentsModal = function() {
  const modal = document.getElementById('no-opponents-modal');
  if (modal) modal.style.display = 'none';
  showMultiplayerLobby();
};

// Update player rating after a ranked match ends
async function updateRankedMatchRating(won) {
  if (!gameState.rankedMatch) return null;

  const result = await multiplayer.updatePlayerRating(won, gameState.rankedMatch.opponentElo);

  if (result) {
    console.log(`[Ranked] Rating: ${result.oldElo} -> ${result.newElo} (${result.change >= 0 ? '+' : ''}${result.change})`);
  }

  gameState.rankedMatch = null;
  return result;
}

// Copy room code to clipboard
window.copyRoomCode = function() {
  const code = multiplayer.getRoomCode();
  if (code) {
    navigator.clipboard.writeText(code).then(() => {
      const btn = document.querySelector('#mp-room-code-display button');
      if (btn) {
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = originalText, 2000);
      }
    });
  }
};

// Cancel waiting and return to lobby
window.cancelOnlineGame = function() {
  multiplayer.leaveGame();
  showMultiplayerLobby();
};

// Show multiplayer coin toss animation
function showMultiplayerCoinToss(coinResult, isHost) {
  console.log('[CoinToss] showMultiplayerCoinToss called, coinResult:', coinResult, 'isHost:', isHost);

  // Set mode so button handlers know we're in multiplayer
  gameState.selectedMode = 'online';
  // Reset flag - will be set true if toss choice arrives before animation ends
  gameState.tossChoiceReceived = false;

  const overlay = document.getElementById('coin-toss-overlay');
  const coin = document.getElementById('coin');
  const result = document.getElementById('toss-result');
  const subtitle = document.getElementById('toss-subtitle');
  const title = document.getElementById('toss-title');

  // IMPORTANT: Show overlay FIRST before hiding other screens to avoid flash
  console.log('[CoinToss] Setting overlay display to flex');
  overlay.style.display = 'flex';
  result.style.display = 'none';
  title.textContent = 'Coin Toss';
  subtitle.textContent = 'Flipping...';

  // Now hide other screens (overlay is already covering them)
  document.getElementById('multiplayer-waiting-screen').style.display = 'none';
  const searchScreen = document.getElementById('quickmatch-searching-screen');
  if (searchScreen) searchScreen.style.display = 'none';

  // Start coin flip animation
  coin.classList.add('coin-flipping');

  // Determine if local player won
  const localPlayerWon = (coinResult === 'host' && isHost) || (coinResult === 'guest' && !isHost);
  const localName = multiplayer.multiplayerState.localPlayer.name || 'You';
  const remoteName = multiplayer.multiplayerState.remotePlayer.name || 'Opponent';

  // Store for later use
  gameState.multiplayerTossWinner = localPlayerWon ? 'local' : 'remote';

  // After animation, show result
  setTimeout(() => {
    coin.classList.remove('coin-flipping');

    if (localPlayerWon) {
      result.textContent = `${localName} wins!`;
      result.style.color = '#4ade80';
      subtitle.textContent = 'You get to choose...';
    } else {
      result.textContent = `${remoteName} wins!`;
      result.style.color = '#f59e0b';
      subtitle.textContent = 'Waiting for their choice...';
    }
    result.style.display = 'block';

    // After showing result, proceed
    setTimeout(() => {
      // Skip if toss choice already received (race condition prevention)
      if (gameState.tossChoiceReceived) return;

      overlay.style.display = 'none';

      if (localPlayerWon) {
        // Show choice overlay for winner
        showMultiplayerTossChoice();
      } else {
        // Wait for opponent's choice (handled by onTossChoice callback)
        showWaitingForChoice();
      }
    }, 2000);
  }, 2000);
}

// Show choice overlay for toss winner
function showMultiplayerTossChoice() {
  document.getElementById('toss-choice-overlay').style.display = 'flex';
}

// Show waiting screen while opponent chooses
function showWaitingForChoice() {
  const overlay = document.getElementById('coin-toss-overlay');
  const result = document.getElementById('toss-result');
  const subtitle = document.getElementById('toss-subtitle');
  const title = document.getElementById('toss-title');

  overlay.style.display = 'flex';
  title.textContent = 'Waiting...';
  result.style.display = 'none';
  subtitle.textContent = 'Opponent is choosing...';
}

// Handle multiplayer toss choice (from winner)
window.multiplayerChooseTossOption = function(choice) {
  document.getElementById('toss-choice-overlay').style.display = 'none';

  if (choice === 'hammer') {
    // Winner takes hammer - wait for loser to pick color
    const winnerTeam = multiplayer.multiplayerState.localPlayer.team;
    gameState.coinTossHammer = winnerTeam;

    // Broadcast choice - loser will pick color
    multiplayer.broadcastTossChoice({ choice: 'hammer', hammer: winnerTeam });

    // Show waiting message while loser picks color
    showWaitingForChoice();
  } else {
    // Winner wants to choose color - show color selection
    document.getElementById('color-choice-overlay').style.display = 'flex';
  }
};

// Handle multiplayer color choice (from winner who chose color option)
window.multiplayerChooseColor = function(color) {
  document.getElementById('color-choice-overlay').style.display = 'none';

  // Winner chose color, so opponent gets hammer
  const opponentTeam = color === 'red' ? 'yellow' : 'red';
  gameState.coinTossHammer = opponentTeam;
  gameState.coinTossFirstThrow = color;  // Winner's color throws first

  // Broadcast choice - game can start
  multiplayer.broadcastTossChoice({ choice: 'color', color: color, hammer: opponentTeam });

  // Show assignment and start game (we chose color, so we don't have hammer)
  showTeamAssignment(color, false);
};

// Handle loser's color choice (when winner took hammer)
window.multiplayerLoserChooseColor = function(color) {
  document.getElementById('color-choice-overlay').style.display = 'none';

  // Loser chose their color, winner already has hammer
  gameState.coinTossFirstThrow = color;  // Loser's color throws first (non-hammer throws first)

  // Broadcast our color choice back to winner
  multiplayer.broadcastColorChoice({ color: color });

  // Show assignment and start game
  showTeamAssignment(color, false);  // loser doesn't have hammer
};

// Show team assignment announcement before starting game
function showTeamAssignment(myColor, iHaveHammer) {
  const overlay = document.getElementById('team-assignment-overlay');
  const teamIcon = document.getElementById('assignment-your-team');
  const teamLabel = document.getElementById('assignment-your-label');
  const hammerInfo = document.getElementById('assignment-hammer-info');

  // Set team display
  if (myColor === 'red') {
    teamIcon.textContent = '🔴';
    teamLabel.textContent = 'You are playing RED';
    teamLabel.style.color = '#f87171';
  } else {
    teamIcon.textContent = '🟡';
    teamLabel.textContent = 'You are playing YELLOW';
    teamLabel.style.color = '#fde047';
  }

  // Set hammer info
  if (iHaveHammer) {
    hammerInfo.textContent = '🔨 You have the hammer (last stone advantage)';
  } else {
    hammerInfo.textContent = '🎯 You throw first this end';
  }

  overlay.style.display = 'flex';

  // Start game after showing assignment
  setTimeout(() => {
    overlay.style.display = 'none';
    startMultiplayerGame();
  }, 2500);
}

// Start the multiplayer game (host only)
window.startOnlineGame = function() {
  console.log('[startOnlineGame] Called, isHost:', multiplayer.isHost());
  if (!multiplayer.isHost()) {
    console.log('[startOnlineGame] Not host, returning');
    return;
  }

  // Do coin toss (host decides)
  const coinResult = Math.random() < 0.5 ? 'host' : 'guest';
  console.log('[startOnlineGame] Coin result:', coinResult);

  // Broadcast game start with coin toss result
  multiplayer.broadcastGameStart({
    hostCountry: multiplayer.multiplayerState.localPlayer.country,
    guestCountry: multiplayer.multiplayerState.remotePlayer.country,
    coinResult: coinResult
  });

  // Show coin toss animation
  console.log('[startOnlineGame] Showing coin toss for host');
  showMultiplayerCoinToss(coinResult, true);
};

// Initialize and start the actual multiplayer game
function startMultiplayerGame() {
  console.log('[Multiplayer] startMultiplayerGame called');
  console.trace('[Multiplayer] Stack trace:');

  // Hide multiplayer screens
  document.getElementById('multiplayer-waiting-screen').style.display = 'none';
  document.getElementById('multiplayer-lobby-screen').style.display = 'none';

  // Set game mode to 2player (no computer AI)
  gameState.gameMode = '2player';
  gameState.selectedMode = 'online';

  // Set up countries based on role
  const localTeam = multiplayer.multiplayerState.localPlayer.team;
  const remoteTeam = multiplayer.multiplayerState.remotePlayer.team;

  // Host is red, guest is yellow
  if (localTeam === 'red') {
    gameState.playerCountry = multiplayer.multiplayerState.localPlayer.country || { code: 'UN', name: 'Player 1', flag: '🔴' };
    gameState.opponentCountry = multiplayer.multiplayerState.remotePlayer.country || { code: 'UN', name: 'Player 2', flag: '🟡' };
  } else {
    gameState.playerCountry = multiplayer.multiplayerState.remotePlayer.country || { code: 'UN', name: 'Player 1', flag: '🔴' };
    gameState.opponentCountry = multiplayer.multiplayerState.localPlayer.country || { code: 'UN', name: 'Player 2', flag: '🟡' };
  }

  // Reset game state
  gameState.end = 1;
  gameState.scores = { red: 0, yellow: 0 };
  gameState.stonesThrown = { red: 0, yellow: 0 };
  gameState.endScores = { red: [], yellow: [] };
  gameState.hammer = gameState.coinTossHammer || 'red';  // Use coin toss result
  gameState.currentTeam = 'red';  // Red always throws first

  // Clear any existing stones
  for (const stone of gameState.stones) {
    if (stone.mesh) scene.remove(stone.mesh);
    if (stone.body) Matter.Composite.remove(engine.world, stone.body);
  }
  gameState.stones = [];

  // TODO: Set up multiplayer event handlers for shots, sweeping, etc.
  setupMultiplayerGameHandlers();

  // Show chat button for multiplayer
  showChatButton();

  // Start the game
  startGame();

  // Start turn timer if it's our turn (red always starts)
  if (localTeam === 'red') {
    startTurnTimer();
  }
}

// Set up event handlers for multiplayer game events
function setupMultiplayerGameHandlers() {
  // Handle opponent's shot
  multiplayer.multiplayerState.onOpponentShot = (data) => {
    console.log('[Multiplayer] Opponent shot received:', data);
    // Hide opponent's aim preview when they shoot
    hideOpponentAimPreview();
    executeOpponentShot(data);
  };

  // Handle opponent's aim state (real-time preview)
  multiplayer.multiplayerState.onOpponentAimState = (data) => {
    updateOpponentAimPreview(data);
  };

  // Handle opponent's sweeping
  multiplayer.multiplayerState.onOpponentSweep = (data) => {
    console.log('[Multiplayer] Opponent sweep:', data);
    // TODO: Show sweeping effects
  };

  // Handle chat messages
  multiplayer.multiplayerState.onChatMessage = (data) => {
    console.log('[Multiplayer] Chat message:', data);

    // Add to chat panel
    addChatMessage(data.sender, data.message, false);

    // Show toast if chat panel is closed
    const panel = document.getElementById('mp-chat-panel');
    if (panel.style.display !== 'block') {
      showChatToast(data.sender, data.message);
      chatUnreadCount++;
      updateChatBadge();
    }
  };

  // Handle stone positions during movement (for smooth interpolation)
  multiplayer.multiplayerState.onStonePositions = (data) => {
    if (multiplayer.multiplayerState.isHost) return;

    const { positions } = data;

    // Set target positions for each stone by index
    for (const pos of positions) {
      const stone = gameState.stones[pos.index];
      if (stone) {
        stone._targetPos = { x: pos.x, y: pos.y };
        stone._targetVel = { x: pos.vx, y: pos.vy };
        stone._targetAngle = pos.angle;
        stone.outOfPlay = pos.outOfPlay;
        if (pos.outOfPlay) {
          stone.mesh.visible = false;
        }
      }
    }
  };

  // Handle stones settled (authoritative from host)
  multiplayer.multiplayerState.onStonesSettled = (data) => {
    console.log('[Multiplayer] Final sync from host');
    const { positions } = data;

    // Only guest should sync (host is authoritative)
    if (multiplayer.multiplayerState.isHost) return;

    // Update each stone to match host's final positions by index
    for (const pos of positions) {
      const stone = gameState.stones[pos.index];
      if (stone) {
        // Clear interpolation target
        delete stone._targetPos;
        delete stone._targetVel;
        delete stone._targetAngle;

        // Set final position
        Matter.Body.setPosition(stone.body, { x: pos.x, y: pos.y });
        Matter.Body.setAngle(stone.body, pos.angle);
        Matter.Body.setVelocity(stone.body, { x: 0, y: 0 });

        stone.mesh.position.x = pos.x / PHYSICS_SCALE;
        stone.mesh.position.z = pos.y / PHYSICS_SCALE;
        stone.mesh.rotation.y = pos.angle;

        stone.outOfPlay = pos.outOfPlay;
        if (pos.outOfPlay) {
          stone.mesh.visible = false;
        }
      }
    }
  };

  // Handle opponent's turn timeout
  multiplayer.multiplayerState.onTurnTimeout = (data) => {
    console.log('[Multiplayer] Opponent timed out:', data);
    showToast('Opponent ran out of time!', 'info');

    // Increment their stones thrown (they lose this stone)
    gameState.stonesThrown[data.team]++;
    updateStoneCountDisplay();

    // Move to next turn after a short delay
    setTimeout(() => {
      nextTurn();
    }, 1000);
  };

  // Handle end complete
  multiplayer.multiplayerState.onEndComplete = (data) => {
    console.log('[Multiplayer] End complete:', data);
    // TODO: Update scores
  };

  // Handle game over
  multiplayer.multiplayerState.onGameOver = (data) => {
    console.log('[Multiplayer] Game over:', data);
    // TODO: Show game over screen
  };

  // Handle rematch request
  multiplayer.multiplayerState.onRematchRequest = (data) => {
    console.log('[Multiplayer] Rematch request received:', data);
    handleRematchRequest(data);
  };

  // Handle rematch accept
  multiplayer.multiplayerState.onRematchAccept = () => {
    console.log('[Multiplayer] Rematch accept received');
    handleRematchAccept();
  };
}

// Execute opponent's shot in multiplayer
function executeOpponentShot(data) {
  const { power, angle, curlDirection, handleAmount, team } = data;

  console.log('[Multiplayer] Executing opponent shot:', { power, angle, curlDirection, handleAmount, team });

  // Set up the shot parameters
  gameState.curlDirection = curlDirection;
  gameState.handleAmount = handleAmount;
  updateCurlDisplay();

  // Start charging phase
  gameState.phase = 'charging';
  gameState.maxPower = power;
  gameState.currentPower = power;
  gameState.aimAngle = angle;

  // Show power display briefly
  const shotTypeInfo = getShotType(power);
  document.getElementById('power-display').style.display = 'block';
  document.getElementById('power-bar').style.display = 'block';
  document.getElementById('power-value').textContent = Math.round(power);
  document.getElementById('power-fill').style.width = power + '%';
  document.getElementById('shot-type').style.display = 'block';
  document.getElementById('shot-type').textContent = shotTypeInfo.name;
  document.getElementById('shot-type').style.color = shotTypeInfo.color;

  // Simulate the throw sequence
  setTimeout(() => {
    // Push off
    pushOff();

    setTimeout(() => {
      // Release stone
      if (gameState.phase === 'sliding') {
        releaseStone();
      }
    }, 600);  // Release timing

  }, 800);  // Time before push off
}

// ============================================
// MULTIPLAYER CHAT
// ============================================

let chatUnreadCount = 0;

window.toggleChat = function() {
  const panel = document.getElementById('mp-chat-panel');
  const isOpen = panel.style.display === 'block';

  if (isOpen) {
    panel.style.display = 'none';
  } else {
    panel.style.display = 'block';
    // Clear unread count when opening
    chatUnreadCount = 0;
    updateChatBadge();
    // Focus input
    document.getElementById('mp-chat-input').focus();
    // Scroll to bottom
    const messages = document.getElementById('mp-chat-messages');
    messages.scrollTop = messages.scrollHeight;
  }
};

window.sendChatMessage = function() {
  const input = document.getElementById('mp-chat-input');
  const message = input.value.trim();

  if (!message) return;

  // Clear input
  input.value = '';

  // Add message locally
  addChatMessage(multiplayer.multiplayerState.localPlayer.name, message, true);

  // Broadcast to opponent
  multiplayer.broadcastChat(message);
};

// Track if chat input was focused intentionally (via direct tap)
let chatInputIntentional = false;

window.onChatInputFocus = function(event) {
  // Check if the chat panel is visible - if not, blur immediately
  const chatPanel = document.getElementById('mp-chat-panel');
  if (chatPanel && chatPanel.style.display === 'none') {
    event.target.blur();
    return;
  }

  // Mark as intentionally focused after a brief delay
  // (to distinguish from accidental focus during swipe)
  setTimeout(() => {
    chatInputIntentional = true;
  }, 100);
};

window.onChatInputBlur = function() {
  chatInputIntentional = false;
};

// Blur any focused input when tapping on the game canvas
window.blurAllInputs = function() {
  if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
    document.activeElement.blur();
  }
};

// Prevent keyboard from appearing during gameplay - blur on any touch outside input areas
document.addEventListener('touchstart', (e) => {
  // Don't interfere if touching an actual input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  // If an input is focused and we're touching elsewhere, blur it
  if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
    document.activeElement.blur();
  }
}, { passive: true });

function addChatMessage(sender, message, isLocal) {
  const container = document.getElementById('mp-chat-messages');

  const msgDiv = document.createElement('div');
  msgDiv.style.cssText = `
    margin-bottom: 8px;
    padding: 8px 12px;
    border-radius: 12px;
    max-width: 85%;
    word-wrap: break-word;
    ${isLocal
      ? 'background: #3b82f6; margin-left: auto; text-align: right;'
      : 'background: #374151; margin-right: auto;'
    }
  `;

  const nameSpan = document.createElement('div');
  nameSpan.style.cssText = 'font-size: 10px; color: rgba(255,255,255,0.6); margin-bottom: 2px;';
  nameSpan.textContent = sender;

  const textSpan = document.createElement('div');
  textSpan.style.cssText = 'font-size: 14px; color: white;';
  textSpan.textContent = message;

  msgDiv.appendChild(nameSpan);
  msgDiv.appendChild(textSpan);
  container.appendChild(msgDiv);

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function showChatToast(sender, message) {
  const container = document.getElementById('mp-chat-toasts');

  const toast = document.createElement('div');
  toast.style.cssText = `
    background: rgba(30, 30, 40, 0.95);
    border: 1px solid #444;
    border-radius: 12px;
    padding: 10px 14px;
    max-width: 250px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
    animation: fadeInUp 0.3s ease-out;
  `;

  toast.innerHTML = `
    <div style="font-size: 11px; color: #94a3b8; margin-bottom: 2px;">${sender}</div>
    <div style="font-size: 14px; color: white;">${message}</div>
  `;

  container.appendChild(toast);

  // Remove after 4 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function updateChatBadge() {
  const badge = document.getElementById('mp-chat-badge');
  if (chatUnreadCount > 0) {
    badge.style.display = 'block';
    badge.textContent = chatUnreadCount > 9 ? '9+' : chatUnreadCount;
  } else {
    badge.style.display = 'none';
  }
}

function showChatButton() {
  document.getElementById('mp-chat-container').style.display = 'block';
}

function hideChatButton() {
  document.getElementById('mp-chat-container').style.display = 'none';
  document.getElementById('mp-chat-panel').style.display = 'none';
  document.getElementById('mp-chat-messages').innerHTML = '';
  chatUnreadCount = 0;
}

// Show mode select screen
window.showModeSelect = function() {
  // Stop ambient crowd when returning to menu
  soundManager.stopAmbientCrowd();

  // Hide chat and leave any multiplayer game
  hideChatButton();
  multiplayer.leaveGame();

  // Hide all other screens
  document.getElementById('practice-drill-screen').style.display = 'none';
  document.getElementById('practice-scenario-screen').style.display = 'none';
  document.getElementById('difficulty-select-screen').style.display = 'none';
  document.getElementById('multiplayer-lobby-screen').style.display = 'none';
  document.getElementById('multiplayer-waiting-screen').style.display = 'none';

  // Show mode select
  document.getElementById('mode-select-screen').style.display = 'block';
  const footer = document.getElementById('mode-select-footer');
  if (footer) footer.style.display = 'flex';
};

// Show difficulty selection screen
function showDifficultySelection() {
  const screen = document.getElementById('difficulty-select-screen');
  if (screen) {
    screen.style.display = 'block';
  }
}

// Handle difficulty selection
window.selectDifficulty = function(difficulty) {
  // Handle Learn mode as a special difficulty
  if (difficulty === 'learn') {
    gameState.learnMode.enabled = true;
    gameState.learnMode.level = 1;  // Start at beginner level
    gameState.settings.difficulty = 'easy';  // Base difficulty is easy
    analytics.trackPageView('learn_mode');
  } else {
    gameState.learnMode.enabled = false;
    gameState.settings.difficulty = difficulty;
  }

  document.getElementById('difficulty-select-screen').style.display = 'none';

  // Quick Play: show level selection (Club, Nationals, etc.)
  // Career mode: start at Club level (or resume from saved progress)
  if (gameState.selectedMode === 'quickplay') {
    showLevelSelection();
  } else {
    // Career mode starts at club level (or saved progress)
    gameState.careerLevel = gameState.savedCareerLevel || 'club';
    showCountrySelection();
  }
};

// Show level selection screen (for Quick Play)
function showLevelSelection() {
  const screen = document.getElementById('level-select-screen');
  if (screen) {
    screen.style.display = 'block';
  }
}

// Handle level selection
window.selectLevel = function(level) {
  gameState.careerLevel = level;
  document.getElementById('level-select-screen').style.display = 'none';
  showCountrySelection();
};

// Go back to difficulty selection
window.goBackToDifficulty = function() {
  document.getElementById('level-select-screen').style.display = 'none';
  showDifficultySelection();
};

// Go back to mode selection
window.goBackToModeSelect = function() {
  document.getElementById('difficulty-select-screen').style.display = 'none';
  document.getElementById('season-overview-screen').style.display = 'none';
  document.getElementById('club-select-screen').style.display = 'none';
  showModeSelection();
};

// Show restart career confirmation
window.showRestartCareerConfirm = function() {
  const overlay = document.getElementById('restart-career-confirm');
  if (overlay) {
    overlay.style.display = 'flex';
  }
};

// Hide restart career confirmation
window.hideRestartCareerConfirm = function() {
  const overlay = document.getElementById('restart-career-confirm');
  if (overlay) {
    overlay.style.display = 'none';
  }
};

// Confirm and execute career restart
window.confirmRestartCareer = function() {
  // Clear all career-related localStorage
  localStorage.removeItem('curlingpro_season');
  localStorage.removeItem('curlingpro_tournament');
  localStorage.removeItem('curlingpro_match_progress');

  // Reset seasonState to defaults
  seasonState.currentSeason = 1;
  seasonState.seasonYear = 2026;
  seasonState.careerTier = 'club';
  seasonState.activeTournament = null;
  seasonState.qualifications = {
    regionalQualified: false,
    provincialQualified: false,
    nationalQualified: false,
    worldsQualified: false,
    olympicTrialsQualified: false,
    olympicsQualified: false
  };
  seasonState.seasonCalendar = { completed: [], available: [] };
  seasonState.stats = {
    totalWins: 0,
    totalLosses: 0,
    tournamentsWon: 0,
    tournamentsEntered: 0,
    seasonsPlayed: 0
  };
  seasonState.rivalryHistory = {};
  seasonState.playerTeam = {
    name: 'Team Player',
    ranking: 1000,
    club: {
      id: 'granite',
      name: 'Granite Curling Club',
      crest: '🪨',
      colors: { primary: '#4a5568', secondary: '#2d3748' }
    }
  };

  // Hide overlay and season overview
  window.hideRestartCareerConfirm();
  document.getElementById('season-overview-screen').style.display = 'none';

  // Show club selection to start fresh
  showClubSelection();
};

// ============================================
// CLUB SELECTION (Career Mode Start)
// ============================================

// Track selected club during setup
let selectedClubId = null;
let selectedCareerDifficulty = 'easy';
let customCrest = '🥌';  // Default custom crest
let customCrestIsImage = false;  // Track if crest is an uploaded image

// Emoji options for custom crest picker (excludes existing club crests)
const CREST_EMOJIS = [
  '🏆', '🎯', '⭐', '🌟', '💎', '👑', '🦅', '🦉',
  '🦁', '🐺', '🐻', '🦌', '🦬', '🐎', '🦊', '🐲',
  '⚡', '🔥', '❄️', '🌲', '☘️', '🦈', '🐧', '🗻',
  '🛡️', '⚔️', '🗡️', '🎖️', '🏅', '🌙', '☀️', '🔱'
];

// Show club selection screen
function showClubSelection() {
  const screen = document.getElementById('club-select-screen');
  const grid = document.getElementById('club-grid');

  if (!screen || !grid) return;

  // Reset selections
  selectedClubId = 'granite';  // Default to first club
  selectedCareerDifficulty = 'easy';

  // Populate club grid
  grid.innerHTML = CLUB_OPTIONS.map(club => `
    <div onclick="window.selectClub('${club.id}')" id="club-card-${club.id}" style="
      padding: 16px;
      background: ${club.id === selectedClubId ? `linear-gradient(135deg, ${club.colors.primary}33, ${club.colors.secondary})` : 'rgba(255, 255, 255, 0.05)'};
      border: 2px solid ${club.id === selectedClubId ? club.colors.primary : 'rgba(255, 255, 255, 0.1)'};
      border-radius: 12px;
      cursor: pointer;
      text-align: center;
      transition: all 0.2s;
    ">
      <div style="font-size: 32px; margin-bottom: 8px;">${club.crest}</div>
      <div style="color: white; font-size: 14px; font-weight: bold;">${club.name}</div>
    </div>
  `).join('');

  // Update difficulty buttons
  updateCareerDifficultyButtons();

  // Reset and populate custom crest picker
  customCrest = '🥌';
  customCrestIsImage = false;
  populateEmojiCrestGrid();
  updateCrestPreview();

  // Reset team name input
  const teamNameInput = document.getElementById('team-name-input');
  if (teamNameInput) {
    teamNameInput.value = '';
    teamNameInput.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    teamNameInput.placeholder = 'Team [Your Name]';
    // Clear error state on input
    teamNameInput.oninput = function() {
      this.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      this.placeholder = 'Team [Your Name]';
    };
  }

  screen.style.display = 'block';
}

// Populate the emoji crest picker grid
function populateEmojiCrestGrid() {
  const grid = document.getElementById('emoji-crest-grid');
  if (!grid) return;

  grid.innerHTML = CREST_EMOJIS.map(emoji => `
    <button onclick="window.selectEmojiCrest('${emoji}')" style="
      padding: 8px;
      background: ${emoji === customCrest && !customCrestIsImage ? 'rgba(74, 222, 128, 0.3)' : 'rgba(255, 255, 255, 0.05)'};
      border: 2px solid ${emoji === customCrest && !customCrestIsImage ? '#4ade80' : 'transparent'};
      border-radius: 8px;
      font-size: 20px;
      cursor: pointer;
      transition: all 0.15s;
    ">${emoji}</button>
  `).join('');
}

// Update crest preview display
function updateCrestPreview() {
  const preview = document.getElementById('custom-crest-preview');
  if (!preview) return;

  if (customCrestIsImage) {
    preview.innerHTML = `<img src="${customCrest}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 8px;">`;
  } else {
    preview.innerHTML = customCrest;
  }
}

// Select an emoji as crest
window.selectEmojiCrest = function(emoji) {
  customCrest = emoji;
  customCrestIsImage = false;
  populateEmojiCrestGrid();
  updateCrestPreview();
};

// Handle image upload for custom crest
window.handleCrestUpload = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file');
    return;
  }

  // Validate file size (max 500KB for localStorage)
  if (file.size > 500 * 1024) {
    alert('Image too large. Please use an image under 500KB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    // Resize image to reduce storage size
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const maxSize = 64;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxSize) {
          height *= maxSize / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width *= maxSize / height;
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      customCrest = canvas.toDataURL('image/png');
      customCrestIsImage = true;
      populateEmojiCrestGrid();
      updateCrestPreview();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
};

// Clear custom crest to default
window.clearCustomCrest = function() {
  customCrest = '🥌';
  customCrestIsImage = false;
  populateEmojiCrestGrid();
  updateCrestPreview();

  // Clear file input
  const fileInput = document.getElementById('custom-crest-upload');
  if (fileInput) fileInput.value = '';
}

// Handle club selection
window.selectClub = function(clubId) {
  selectedClubId = clubId;
  const club = CLUB_OPTIONS.find(c => c.id === clubId);

  // Update all club cards
  CLUB_OPTIONS.forEach(c => {
    const card = document.getElementById(`club-card-${c.id}`);
    if (card) {
      const isSelected = c.id === clubId;
      card.style.background = isSelected
        ? `linear-gradient(135deg, ${c.colors.primary}33, ${c.colors.secondary})`
        : 'rgba(255, 255, 255, 0.05)';
      card.style.borderColor = isSelected ? c.colors.primary : 'rgba(255, 255, 255, 0.1)';
    }
  });

  // Show/hide custom club name input
  const customSection = document.getElementById('custom-club-section');
  if (customSection) {
    customSection.style.display = clubId === 'custom' ? 'block' : 'none';
  }
};

// Handle difficulty selection in career setup
window.selectCareerDifficulty = function(difficulty) {
  selectedCareerDifficulty = difficulty;
  updateCareerDifficultyButtons();
};

// Update career difficulty button styles
function updateCareerDifficultyButtons() {
  const difficulties = ['easy', 'medium', 'hard'];
  const colors = {
    easy: { bg: 'rgba(74, 222, 128, 0.2)', border: '#4ade80', text: '#4ade80' },
    medium: { bg: 'rgba(251, 191, 36, 0.2)', border: '#fbbf24', text: '#fbbf24' },
    hard: { bg: 'rgba(239, 68, 68, 0.2)', border: '#ef4444', text: '#ef4444' }
  };

  difficulties.forEach(diff => {
    const btn = document.getElementById(`diff-${diff}`);
    if (btn) {
      const isSelected = diff === selectedCareerDifficulty;
      const c = colors[diff];
      btn.style.background = isSelected ? c.bg : 'rgba(255, 255, 255, 0.05)';
      btn.style.borderColor = isSelected ? c.border : 'rgba(255, 255, 255, 0.2)';
      btn.style.color = isSelected ? c.text : '#94a3b8';
    }
  });
}

// Start new career with selected club
window.startNewCareer = function() {
  const club = CLUB_OPTIONS.find(c => c.id === selectedClubId);
  if (!club) return;

  // Get team name (required)
  const teamNameInput = document.getElementById('team-name-input');
  const teamName = teamNameInput?.value?.trim();

  if (!teamName) {
    // Highlight the input field and show error
    if (teamNameInput) {
      teamNameInput.style.borderColor = '#ef4444';
      teamNameInput.focus();
      teamNameInput.placeholder = 'Team name is required';
    }
    return;
  }

  // Get custom club name and crest if applicable
  let clubName = club.name;
  let clubCrest = club.crest;
  let crestIsImage = false;
  if (selectedClubId === 'custom') {
    const customNameInput = document.getElementById('custom-club-name');
    clubName = customNameInput?.value?.trim() || 'My Curling Club';
    clubCrest = customCrest;
    crestIsImage = customCrestIsImage;
  }

  // Initialize new season with club identity
  initializeNewSeason();

  // Set club identity
  seasonState.playerTeam.name = teamName;
  seasonState.playerTeam.club = {
    id: selectedClubId,
    name: clubName,
    colors: { ...club.colors },
    crest: clubCrest,
    crestIsImage: crestIsImage
  };

  // Set difficulty
  gameState.settings.difficulty = selectedCareerDifficulty;

  // Country remains null - will be unlocked later
  seasonState.playerTeam.country = null;
  seasonState.playerTeam.countryLocked = false;
  seasonState.playerTeam.countryUnlockShown = false;
  seasonState.careerStage = 'club';

  // Save and show season overview
  saveSeasonState();

  document.getElementById('club-select-screen').style.display = 'none';
  showSeasonOverview();
};

// ============================================
// COUNTRY UNLOCK (Deferred Selection)
// ============================================

// Track selected country during unlock
let selectedUnlockCountry = null;

// Check if country unlock should be shown
function shouldShowCountryUnlock() {
  // Already has country locked
  if (seasonState.playerTeam.countryLocked) return false;

  // Already shown and dismissed
  if (seasonState.playerTeam.countryUnlockShown) return false;

  // Check if entering national or higher tier tournament
  const nationalTiers = ['national', 'international', 'olympic'];
  return nationalTiers.includes(seasonState.careerTier);
}

// Show country unlock screen
function showCountryUnlockScreen() {
  const screen = document.getElementById('country-unlock-screen');
  const grid = document.getElementById('country-unlock-grid');
  const clubNameEl = document.getElementById('unlock-club-name');

  if (!screen || !grid) return;

  // Reset selection
  selectedUnlockCountry = null;

  // Update club name in message
  if (clubNameEl) {
    clubNameEl.textContent = seasonState.playerTeam.club.name;
  }

  // Populate country grid
  grid.innerHTML = CURLING_COUNTRIES.map(country => `
    <div onclick="window.selectUnlockCountry('${country.id}')" id="unlock-country-${country.id}" style="
      padding: 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 2px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      cursor: pointer;
      text-align: center;
      transition: all 0.2s;
    ">
      <div style="font-size: 32px; margin-bottom: 8px;">${country.flag}</div>
      <div style="color: white; font-size: 14px;">${country.name}</div>
    </div>
  `).join('');

  // Disable confirm button initially
  const confirmBtn = document.getElementById('confirm-country-btn');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.style.opacity = '0.5';
    confirmBtn.style.pointerEvents = 'none';
    confirmBtn.textContent = 'Select a Country';
  }

  screen.style.display = 'block';
}

// Handle country selection during unlock
window.selectUnlockCountry = function(countryId) {
  selectedUnlockCountry = CURLING_COUNTRIES.find(c => c.id === countryId);

  // Update all country cards
  CURLING_COUNTRIES.forEach(c => {
    const card = document.getElementById(`unlock-country-${c.id}`);
    if (card) {
      const isSelected = c.id === countryId;
      card.style.background = isSelected ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255, 255, 255, 0.05)';
      card.style.borderColor = isSelected ? '#4ade80' : 'rgba(255, 255, 255, 0.1)';
    }
  });

  // Enable confirm button
  const confirmBtn = document.getElementById('confirm-country-btn');
  if (confirmBtn && selectedUnlockCountry) {
    confirmBtn.disabled = false;
    confirmBtn.style.opacity = '1';
    confirmBtn.style.pointerEvents = 'auto';
    confirmBtn.textContent = `Represent ${selectedUnlockCountry.name}`;
  }
};

// Confirm country selection (permanent)
window.confirmCountrySelection = function() {
  if (!selectedUnlockCountry) return;

  // Lock in country choice
  seasonState.playerTeam.country = selectedUnlockCountry;
  seasonState.playerTeam.countryLocked = true;
  seasonState.playerTeam.countryUnlockShown = true;
  seasonState.careerStage = 'national';

  // Save state
  saveSeasonState();

  // Hide unlock screen
  document.getElementById('country-unlock-screen').style.display = 'none';

  // Continue to wherever we were going
  showSeasonOverview();
};

// ============================================
// SEASON / TOURNAMENT UI FUNCTIONS
// ============================================

// Tier colors for badges
const TIER_COLORS = {
  club: { bg: 'linear-gradient(135deg, #6b7280, #4b5563)', border: '#9ca3af' },
  regional: { bg: 'linear-gradient(135deg, #059669, #047857)', border: '#34d399' },
  provincial: { bg: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: '#60a5fa' },
  national: { bg: 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: '#a78bfa' },
  international: { bg: 'linear-gradient(135deg, #dc2626, #b91c1c)', border: '#f87171' },
  olympic: { bg: 'linear-gradient(135deg, #d97706, #b45309)', border: '#fbbf24' }
};

// Show Season Overview screen
window.showSeasonOverview = function() {
  // Check if country unlock should be shown first
  if (shouldShowCountryUnlock()) {
    showCountryUnlockScreen();
    return;
  }

  // Hide all other screens
  document.getElementById('mode-select-screen').style.display = 'none';
  hideModeSelectFooter();
  document.getElementById('tournament-entry-screen').style.display = 'none';
  document.getElementById('bracket-screen').style.display = 'none';
  document.getElementById('pre-match-screen').style.display = 'none';
  document.getElementById('post-match-screen').style.display = 'none';
  document.getElementById('club-select-screen').style.display = 'none';
  document.getElementById('country-unlock-screen').style.display = 'none';

  const screen = document.getElementById('season-overview-screen');
  if (!screen) return;

  // Update season info
  document.getElementById('season-year').textContent =
    `Season ${seasonState.currentSeason} • ${seasonState.seasonYear}`;

  // Update tier badge
  const tierBadge = document.getElementById('tier-badge');
  const tierColors = TIER_COLORS[seasonState.careerTier] || TIER_COLORS.club;
  tierBadge.style.background = tierColors.bg;
  tierBadge.textContent = seasonState.careerTier.charAt(0).toUpperCase() + seasonState.careerTier.slice(1);

  // Update player identity (club-first, country later)
  updatePlayerIdentityDisplay();

  // Update stats
  document.getElementById('season-wins').textContent = seasonState.stats.totalWins;
  document.getElementById('season-losses').textContent = seasonState.stats.totalLosses;
  document.getElementById('season-tournaments').textContent = seasonState.stats.tournamentsWon;
  document.getElementById('player-ranking').textContent = `Ranking: ${seasonState.playerTeam.ranking}`;

  // Update qualifications section
  updateQualificationsDisplay();

  // Update available tournaments
  updateAvailableTournaments();

  // Show active tournament banner if applicable
  updateActiveTournamentBanner();

  screen.style.display = 'block';
};

// Update player identity display based on career stage
function updatePlayerIdentityDisplay() {
  const club = seasonState.playerTeam.club;
  const country = seasonState.playerTeam.country;
  const hasCountry = seasonState.playerTeam.countryLocked && country;

  // Update club crest
  const crestEl = document.getElementById('player-club-crest');
  if (crestEl && club) {
    if (club.crestIsImage) {
      crestEl.innerHTML = `<img src="${club.crest}" style="width: 36px; height: 36px; object-fit: cover; border-radius: 6px;">`;
    } else {
      crestEl.textContent = club.crest || '🥌';
    }
  }

  // Update team name
  const teamNameEl = document.getElementById('player-team-name');
  if (teamNameEl) {
    teamNameEl.textContent = seasonState.playerTeam.name || 'Team Player';
  }

  // Update club name
  const clubNameEl = document.getElementById('player-club-name');
  if (clubNameEl && club) {
    clubNameEl.textContent = club.name || 'My Club';
  }

  // Update country badge (only shown after unlock)
  const countryBadge = document.getElementById('player-country-badge');
  if (countryBadge) {
    if (hasCountry) {
      countryBadge.textContent = country.flag;
      countryBadge.style.display = 'block';
    } else {
      countryBadge.style.display = 'none';
    }
  }

  // Update identity label
  const labelEl = document.getElementById('player-identity-label');
  if (labelEl) {
    if (hasCountry) {
      labelEl.textContent = `${country.name} National Team`;
    } else {
      labelEl.textContent = 'Club Level';
    }
  }

  // Update player stats card border to match club colors
  const statsCard = document.getElementById('player-stats-card');
  if (statsCard && club && club.colors) {
    statsCard.style.borderColor = club.colors.primary + '40';  // 25% opacity
  }
}

// Update qualifications display
function updateQualificationsDisplay() {
  const section = document.getElementById('qualifications-section');
  const list = document.getElementById('qualifications-list');

  const qualifications = [];
  if (seasonState.qualifications.regionalQualified) qualifications.push('Regional');
  if (seasonState.qualifications.provincialQualified) qualifications.push('Provincial');
  if (seasonState.qualifications.nationalQualified) qualifications.push('National');
  if (seasonState.qualifications.worldsQualified) qualifications.push('Worlds');
  if (seasonState.qualifications.olympicTrialsQualified) qualifications.push('Olympic Trials');
  if (seasonState.qualifications.olympicsQualified) qualifications.push('Olympics');

  if (qualifications.length === 0) {
    section.style.display = 'none';
    return;
  }

  list.innerHTML = qualifications.map(q => `
    <span style="
      padding: 6px 12px;
      background: rgba(74, 222, 128, 0.2);
      border-radius: 16px;
      color: #4ade80;
      font-size: 12px;
    ">${q}</span>
  `).join('');

  section.style.display = 'block';
}

// Update available tournaments list
function updateAvailableTournaments() {
  const container = document.getElementById('available-tournaments');
  if (!container) return;

  // Get tournaments available for current tier
  const availableTournaments = TOURNAMENT_DEFINITIONS.filter(t => {
    const tierIndex = CAREER_TIERS.indexOf(seasonState.careerTier);
    const tournamentTierIndex = CAREER_TIERS.indexOf(t.tier);
    // Show tournaments at current tier or one above if qualified
    return tournamentTierIndex <= tierIndex + 1;
  });

  container.innerHTML = availableTournaments.map(tournament => {
    const canEnter = canEnterTournament(tournament.id);
    const tierColors = TIER_COLORS[tournament.tier] || TIER_COLORS.club;
    const isLocked = !canEnter;

    return `
      <div onclick="${isLocked ? '' : `window.showTournamentEntry('${tournament.id}')`}" style="
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid ${isLocked ? 'rgba(100, 116, 139, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
        border-radius: 12px;
        padding: 16px;
        cursor: ${isLocked ? 'not-allowed' : 'pointer'};
        opacity: ${isLocked ? '0.6' : '1'};
        transition: transform 0.2s, border-color 0.2s;
      ">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <div>
            <div style="color: white; font-size: 16px; font-weight: bold;">${tournament.name}</div>
            <div style="color: #64748b; font-size: 12px; margin-top: 4px;">
              ${tournament.format.type.replace('_', ' ')} • ${tournament.format.teams} Teams
            </div>
          </div>
          <span style="
            padding: 4px 10px;
            background: ${tierColors.bg};
            border-radius: 12px;
            color: white;
            font-size: 11px;
            text-transform: uppercase;
          ">${tournament.tier}</span>
        </div>
        <div style="display: flex; gap: 16px; margin-top: 12px;">
          <div style="color: #fbbf24; font-size: 13px;">+${tournament.rewards.points} pts</div>
          ${tournament.rewards.qualifiesFor ? `<div style="color: #4ade80; font-size: 13px;">→ ${tournament.rewards.qualifiesFor.replace('Qualified', '')}</div>` : ''}
          ${isLocked ? '<div style="color: #f87171; font-size: 13px;">🔒 Qualification needed</div>' : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Update active tournament banner
function updateActiveTournamentBanner() {
  const banner = document.getElementById('active-tournament-banner');
  const nameEl = document.getElementById('active-tournament-name');

  if (seasonState.activeTournament) {
    nameEl.textContent = seasonState.activeTournament.definition.name;
    banner.style.display = 'block';
  } else {
    banner.style.display = 'none';
  }
}

// Show tournament entry screen
window.showTournamentEntry = function(tournamentId) {
  const tournament = TOURNAMENT_DEFINITIONS.find(t => t.id === tournamentId);
  if (!tournament) return;

  // Store selected tournament
  window._selectedTournamentId = tournamentId;

  const screen = document.getElementById('tournament-entry-screen');
  const tierColors = TIER_COLORS[tournament.tier] || TIER_COLORS.club;

  // Update header
  document.getElementById('tournament-header').style.background = tierColors.bg;
  document.getElementById('tournament-tier-label').textContent = tournament.tier.toUpperCase() + ' TOURNAMENT';
  document.getElementById('tournament-name-display').textContent = tournament.name;
  document.getElementById('tournament-format').textContent =
    `${tournament.format.type.replace('_', ' ')} • ${tournament.format.teams} Teams`;

  // Update rewards
  document.getElementById('tournament-reward').textContent = `+${tournament.rewards.points} Points`;
  document.getElementById('tournament-qualification').textContent =
    tournament.rewards.qualifiesFor ? tournament.rewards.qualifiesFor.replace('Qualified', '') : '—';

  // Check requirements
  const canEnter = canEnterTournament(tournamentId);
  console.log('[Tournament] canEnter:', canEnter, 'tournamentId:', tournamentId);
  console.log('[Tournament] activeTournament:', seasonState.activeTournament);
  console.log('[Tournament] careerTier:', seasonState.careerTier);

  const reqSection = document.getElementById('tournament-requirements');
  const enterBtn = document.getElementById('enter-tournament-btn');
  const lockedBtn = document.getElementById('tournament-locked-btn');

  if (canEnter) {
    console.log('[Tournament] Showing Enter button');
    reqSection.style.display = 'none';
    enterBtn.style.display = 'block';
    lockedBtn.style.display = 'none';

    // Add click handler directly
    enterBtn.onclick = function() {
      console.log('[Tournament] Enter button clicked via onclick');
      window.enterSelectedTournament();
    };
  } else {
    console.log('[Tournament] Showing Locked button');
    document.getElementById('tournament-req-text').textContent =
      `Requires: ${tournament.requirements.requiresQualification || 'higher tier qualification'}`;
    reqSection.style.display = 'block';
    enterBtn.style.display = 'none';
    lockedBtn.style.display = 'block';
  }

  // Update field preview
  updateFieldPreview(tournament);

  // Hide other screens and show entry screen
  document.getElementById('season-overview-screen').style.display = 'none';
  screen.style.display = 'block';
};

// Update tournament field preview
function updateFieldPreview(tournament) {
  const container = document.getElementById('tournament-field-preview');
  if (!container) return;

  // Generate preview field
  const tierLevel = CAREER_TIERS.indexOf(tournament.tier);
  const previewTeams = [];

  // Add player
  previewTeams.push({ name: 'Team Player', isPlayer: true });

  // Add some rivals and generated names
  const eligibleRivals = getEligibleRivals(tierLevel).slice(0, 2);
  eligibleRivals.forEach(r => {
    previewTeams.push({ name: r.teamName, isRival: true });
  });

  // Fill remaining slots
  while (previewTeams.length < Math.min(tournament.format.teams, 6)) {
    const opponent = generateRandomOpponent(tierLevel, null);
    previewTeams.push({ name: opponent.teamName });
  }

  container.innerHTML = previewTeams.map(team => `
    <div style="
      padding: 10px 12px;
      background: ${team.isPlayer ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 255, 255, 0.03)'};
      border: 1px solid ${team.isPlayer ? 'rgba(74, 222, 128, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
      border-radius: 8px;
      color: ${team.isPlayer ? '#4ade80' : '#94a3b8'};
      font-size: 13px;
    ">
      ${team.isPlayer ? '👤 ' : ''}${team.isRival ? '🔥 ' : ''}${team.name}
    </div>
  `).join('');
}

// Enter the selected tournament
window.enterSelectedTournament = function() {
  console.log('[Tournament] enterSelectedTournament called');
  const tournamentId = window._selectedTournamentId;
  console.log('[Tournament] tournamentId:', tournamentId);
  if (!tournamentId) {
    console.error('[Tournament] No tournament selected');
    return;
  }

  // Create the tournament
  const tournament = createTournament(tournamentId);
  console.log('[Tournament] Created tournament:', tournament);

  if (!tournament) {
    console.error('[Tournament] Failed to create tournament');
    return;
  }

  // Show the bracket
  showBracket();
};

// Show bracket display screen
window.showBracket = function() {
  if (!seasonState.activeTournament) {
    showSeasonOverview();
    return;
  }

  const screen = document.getElementById('bracket-screen');
  const tournament = seasonState.activeTournament;

  // Update header
  document.getElementById('bracket-tournament-name').textContent = tournament.definition.name;
  document.getElementById('bracket-phase').textContent =
    tournament.phase.charAt(0).toUpperCase() + tournament.phase.slice(1).replace('_', ' ');

  // Render bracket
  renderBracket();

  // Simulate any pending AI matches before showing bracket
  // This ensures player's opponent is ready if they've advanced
  simulateAIMatches(tournament);

  // Update play button state
  const nextMatch = getNextPlayerMatch(tournament);
  const playBtn = document.getElementById('play-next-match-btn');

  // Helper to handle button click - use both onclick and touchend for mobile reliability
  const handlePlayClick = function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('[Bracket] Play button clicked/touched');
    window.playNextMatch();
  };

  // Remove old handlers by cloning the button
  const newBtn = playBtn.cloneNode(true);
  playBtn.parentNode.replaceChild(newBtn, playBtn);

  if (nextMatch && (nextMatch.matchup.status === 'pending' || nextMatch.matchup.status === 'ready')) {
    newBtn.style.display = 'block';
    newBtn.textContent = `Play ${nextMatch.round.name}`;
    newBtn.addEventListener('click', handlePlayClick);
    newBtn.addEventListener('touchend', handlePlayClick);
  } else if (tournament.phase === 'complete') {
    newBtn.style.display = 'none';
  } else {
    newBtn.style.display = 'block';
    newBtn.textContent = 'Play Next Match';
    newBtn.addEventListener('click', handlePlayClick);
    newBtn.addEventListener('touchend', handlePlayClick);
  }

  // Hide other screens and show bracket
  document.getElementById('season-overview-screen').style.display = 'none';
  document.getElementById('tournament-entry-screen').style.display = 'none';
  document.getElementById('pre-match-screen').style.display = 'none';
  screen.style.display = 'block';
};

// Render bracket visualization
function renderBracket() {
  const container = document.getElementById('bracket-grid');
  if (!container || !seasonState.activeTournament) return;

  const bracket = seasonState.activeTournament.bracket;
  if (!bracket || !bracket.rounds) return;

  // For proper bracket alignment, each match in a round should be centered
  // between the two matches from the previous round that feed into it
  const matchCardHeight = 90;   // Height of match card
  const baseGap = 20;           // Gap between cards in first round
  const headerHeight = 30;      // Round name header height including margin

  // Calculate first round dimensions
  const firstRoundMatches = bracket.rounds[0].matchups.length;
  const firstRoundContentHeight = (firstRoundMatches * matchCardHeight) + ((firstRoundMatches - 1) * baseGap);
  const totalColumnHeight = headerHeight + firstRoundContentHeight;

  container.innerHTML = bracket.rounds.map((round, roundIndex) => {
    const numMatchesThisRound = round.matchups.length;

    // First round: no special positioning needed
    if (roundIndex === 0) {
      return `
      <div style="display: flex; flex-direction: column; gap: ${baseGap}px; min-width: 180px;">
        <div style="
          color: #64748b;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
          text-align: center;
          height: 20px;
        ">${round.name}</div>
        ${round.matchups.map(matchup => renderMatchupCard(matchup, roundIndex)).join('')}
      </div>
    `}

    // For subsequent rounds, each match should be centered between its feeder matches
    // In a standard bracket: round N has 2^N times fewer matches than round 0
    // Each match in round N spans 2^N matches from round 0

    // Calculate the "unit height" - height of one match slot in round 0
    const unitHeight = matchCardHeight + baseGap;

    // How many round-0 matches does each match in this round span?
    const matchesPerSlot = Math.pow(2, roundIndex);

    // Height that each match in this round spans (in terms of round 0 space)
    const slotHeight = matchesPerSlot * unitHeight - baseGap;

    // Top offset to center first match of this round
    // It should be centered in the space of its feeder matches
    const topOffset = (slotHeight - matchCardHeight) / 2;

    // Gap between matches in this round
    // Each subsequent match is centered in the next "slot" of feeder matches
    const matchGap = slotHeight + baseGap - matchCardHeight;

    return `
    <div style="
      display: flex;
      flex-direction: column;
      min-width: 180px;
      height: ${totalColumnHeight}px;
    ">
      <div style="
        color: #64748b;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 8px;
        text-align: center;
        height: 20px;
      ">${round.name}</div>
      <div style="
        display: flex;
        flex-direction: column;
        gap: ${matchGap}px;
        padding-top: ${topOffset}px;
      ">
        ${round.matchups.map(matchup => renderMatchupCard(matchup, roundIndex)).join('')}
      </div>
    </div>
  `}).join('');
}

// Render a single matchup card
function renderMatchupCard(matchup, roundIndex) {
  const isPlayerMatch = matchup.team1?.isPlayer || matchup.team2?.isPlayer;
  const isCurrent = matchup.status === 'pending' && isPlayerMatch;
  const isComplete = matchup.status === 'complete';

  const borderColor = isCurrent ? '#4ade80' :
                      isPlayerMatch ? '#fbbf24' :
                      'rgba(255, 255, 255, 0.1)';

  const bgColor = isCurrent ? 'rgba(74, 222, 128, 0.1)' :
                  isComplete ? 'rgba(255, 255, 255, 0.02)' :
                  'rgba(255, 255, 255, 0.05)';

  return `
    <div style="
      background: ${bgColor};
      border: 2px solid ${borderColor};
      border-radius: 8px;
      padding: 12px;
      ${isCurrent ? 'animation: pulse 2s infinite;' : ''}
    ">
      ${renderTeamRow(matchup.team1, matchup.winner, matchup.games)}
      <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); margin: 8px 0;"></div>
      ${renderTeamRow(matchup.team2, matchup.winner, matchup.games)}
    </div>
  `;
}

// Render team row in matchup card
function renderTeamRow(team, winner, games) {
  if (!team) {
    return `<div style="color: #4b5563; font-size: 12px; padding: 4px 0;">TBD</div>`;
  }

  const isWinner = winner && winner.id === team.id;
  const isLoser = winner && winner.id !== team.id;
  const teamScore = games ? games.filter(g => g.winner === team.id).length : 0;

  // Determine team icon: player uses club crest, opponents use country flag
  let teamIcon = '';
  let isImageCrest = false;
  if (team.isPlayer) {
    // Player: show club crest if available, otherwise default curling stone
    teamIcon = team.club?.crest || '🥌';
    isImageCrest = team.club?.crestIsImage || false;
  } else if (team.country?.flag) {
    // Opponent: show country flag
    teamIcon = team.country.flag;
  }

  const iconHtml = isImageCrest
    ? `<img src="${teamIcon}" style="width: 18px; height: 18px; object-fit: cover; border-radius: 3px;">`
    : teamIcon;

  return `
    <div style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      opacity: ${isLoser ? '0.5' : '1'};
    ">
      <div style="
        display: flex;
        align-items: center;
        gap: 6px;
        color: ${team.isPlayer ? '#4ade80' : 'white'};
        font-size: 13px;
        font-weight: ${isWinner ? 'bold' : 'normal'};
      ">
        ${teamIcon ? `<span style="font-size: 14px; display: flex; align-items: center;">${iconHtml}</span>` : ''}
        <span>${team.name}</span>
      </div>
      ${games && games.length > 0 ? `
        <div style="
          color: ${isWinner ? '#4ade80' : '#64748b'};
          font-size: 12px;
          font-weight: bold;
        ">${teamScore}</div>
      ` : ''}
    </div>
  `;
}

// Play next match from bracket
window.playNextMatch = function() {
  console.log('[playNextMatch] Called');
  const nextMatch = getNextPlayerMatch();
  console.log('[playNextMatch] nextMatch:', nextMatch);
  if (!nextMatch) {
    console.log('[playNextMatch] No next match found');
    return;
  }

  showPreMatch();
};

// Go back from pre-match screen to bracket view
window.backFromPreMatch = function() {
  document.getElementById('pre-match-screen').style.display = 'none';
  document.getElementById('bracket-view').style.display = 'block';
};

// Show pre-match screen
window.showPreMatch = function() {
  const screen = document.getElementById('pre-match-screen');
  const opponent = getCurrentMatchOpponent();

  console.log('[showPreMatch] opponent:', opponent);

  if (!opponent) {
    console.error('No opponent found for pre-match screen');
    // Debug: log the current match state
    const t = seasonState.activeTournament;
    if (t) {
      console.log('[showPreMatch] currentMatchup:', t.currentMatchup);
      console.log('[showPreMatch] nextMatch:', getNextPlayerMatch());
    }
    return;
  }

  // Update match context
  const tournament = seasonState.activeTournament;
  const nextMatch = getNextPlayerMatch();
  document.getElementById('match-context').textContent =
    `${nextMatch.round.name} • ${tournament.definition.name}`;

  // Handle both opponent objects (with firstName/lastName) and team objects (with name)
  const opponentName = opponent.firstName
    ? `${opponent.firstName} ${opponent.lastName}`
    : opponent.name || 'Unknown Opponent';
  const opponentTeam = opponent.teamName || opponent.name || 'Unknown Team';

  // Update opponent card
  document.getElementById('opponent-name').textContent = opponentName;
  document.getElementById('opponent-team').textContent = opponentTeam;

  // Update opponent info
  const personality = getPersonalityType(opponent);
  document.getElementById('opponent-personality-badge').textContent = personality;
  document.getElementById('opponent-bio').textContent = opponent.bio || 'A competitive curler.';

  // Update rivalry history if applicable
  const rivalrySection = document.getElementById('rivalry-history');
  if (opponent.isRival && seasonState.rivalryHistory[opponent.id]) {
    const history = seasonState.rivalryHistory[opponent.id];
    document.getElementById('rivalry-record').textContent =
      `You: ${history.playerWins} | Them: ${history.playerLosses}`;
    rivalrySection.style.display = 'block';
  } else {
    rivalrySection.style.display = 'none';
  }

  // Update player card with club crest and team name
  const playerAvatar = document.getElementById('player-match-avatar');
  const playerName = document.getElementById('player-match-name');
  const playerTeamEl = document.getElementById('player-match-team');

  if (playerAvatar && seasonState.playerTeam) {
    const crest = seasonState.playerTeam.club?.crest || '🥌';
    const isImage = seasonState.playerTeam.club?.crestIsImage;
    if (isImage) {
      playerAvatar.innerHTML = `<img src="${crest}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 8px;">`;
    } else {
      playerAvatar.textContent = crest;
    }
  }
  if (playerName && seasonState.playerTeam?.name) {
    playerName.textContent = seasonState.playerTeam.name;
  }
  if (playerTeamEl && seasonState.playerTeam?.club?.name) {
    playerTeamEl.textContent = seasonState.playerTeam.club.name;
  }

  // Check for saved match progress (resume scenario)
  const savedProgress = loadMatchProgress();
  const resumeSummary = document.getElementById('match-resume-summary');
  const startBtn = document.getElementById('start-match-btn');

  if (savedProgress && savedProgress.end > 1) {
    // There's a match to resume
    const redScore = savedProgress.scores.red;
    const yellowScore = savedProgress.scores.yellow;
    const completedEnds = savedProgress.end - 1;
    const hammerTeam = savedProgress.hammer;

    // Determine who's leading
    let scoreText;
    if (redScore > yellowScore) {
      const playerName = seasonState.playerTeam?.name || 'You';
      scoreText = `${playerName} leads ${redScore} - ${yellowScore}`;
    } else if (yellowScore > redScore) {
      const opponentName = opponent.teamName || opponent.name || 'Opponent';
      scoreText = `${opponentName} leads ${yellowScore} - ${redScore}`;
    } else {
      scoreText = `Tied ${redScore} - ${yellowScore}`;
    }

    // Determine who has hammer
    const hammerHolder = hammerTeam === 'red'
      ? (seasonState.playerTeam?.name || 'You')
      : (opponent.teamName || opponent.name || 'Opponent');

    // Update UI
    document.getElementById('match-resume-score').textContent = scoreText;
    document.getElementById('match-resume-details').textContent =
      `After ${completedEnds} end${completedEnds > 1 ? 's' : ''}. ${hammerHolder} will have hammer in End ${savedProgress.end}.`;

    resumeSummary.style.display = 'block';
    startBtn.textContent = 'Continue Match';
  } else {
    // Fresh match
    resumeSummary.style.display = 'none';
    startBtn.textContent = 'Start Match';
  }

  // Hide bracket, show pre-match
  document.getElementById('bracket-screen').style.display = 'none';
  screen.style.display = 'block';
};

// Get personality type label from opponent
function getPersonalityType(opponent) {
  if (!opponent || !opponent.personality) return 'Balanced';

  const { aggression, patience, riskTolerance } = opponent.personality;

  if (aggression > 70) return 'Aggressive';
  if (patience > 70) return 'Patient';
  if (riskTolerance > 70) return 'Risk-Taker';
  if (aggression < 30 && patience > 50) return 'Conservative';

  return 'Balanced';
}

// Start tournament match (transition to actual game)
window.startTournamentMatch = function() {
  // Hide pre-match screen
  document.getElementById('pre-match-screen').style.display = 'none';

  // Set up game state for career tournament match
  gameState.selectedMode = 'career';
  gameState.gameMode = '1player';
  gameState.inTournamentMatch = true;
  gameState.computerTeam = 'yellow';  // Default, may be swapped by coin toss

  // Use player's selected career difficulty (set during club selection)
  // The difficulty was already set in gameState.settings.difficulty when career was created
  // Don't override it based on tier - respect the player's choice
  const tierIndex = CAREER_TIERS.indexOf(seasonState.activeTournament.definition.tier);

  // Set game length based on tier (realistic end counts)
  // Club/Regional: 6 ends, Provincial/National: 8 ends, International/Olympic: 10 ends
  const endCounts = [6, 6, 8, 8, 10, 10];
  gameState.settings.gameLength = endCounts[tierIndex] || 8;

  // Set career level for AI
  gameState.careerLevel = seasonState.activeTournament.definition.tier;

  // Check if we're resuming a match in progress (skip coin toss)
  const savedProgress = loadMatchProgress();
  const hasScores = savedProgress && (savedProgress.scores.red > 0 || savedProgress.scores.yellow > 0);
  const isResuming = savedProgress && (savedProgress.end > 1 || hasScores);

  // For club/regional tier, skip country selection - just use team names with club crests
  const tier = seasonState.activeTournament.definition.tier;
  if (tier === 'club' || tier === 'regional') {
    // Use player's team name with club crest
    const playerClub = seasonState.playerTeam.club;
    gameState.playerCountry = {
      id: playerClub?.id || 'club',
      name: seasonState.playerTeam.name || 'Team Player',
      flag: playerClub?.crest || '🥌'
    };

    // Get opponent info - use team name instead of club name
    const opponent = getCurrentMatchOpponent();
    gameState.opponentCountry = {
      id: opponent?.club?.id || 'opponent',
      name: opponent?.teamName || `Team ${opponent?.lastName || 'Opponent'}`,
      flag: opponent?.club?.crest || '🥌'
    };

    // Skip coin toss if resuming, otherwise show it
    if (isResuming) {
      console.log('[Resume] Skipping coin toss, resuming from End', savedProgress.end);
      startGame();
    } else {
      window.startCoinToss();
    }
  } else {
    // For national/international tier
    if (isResuming) {
      // Resuming - restore country info and skip to game
      console.log('[Resume] Skipping country selection, resuming from End', savedProgress.end);
      // Countries should already be set from previous session, but set defaults if not
      if (!gameState.playerCountry) {
        gameState.playerCountry = CURLING_COUNTRIES[0]; // Default to first country
      }
      if (!gameState.opponentCountry) {
        gameState.opponentCountry = CURLING_COUNTRIES[1]; // Default to second country
      }
      startGame();
    } else {
      showCountrySelection();
    }
  }
};

// Continue tournament after match ends
window.continueTournament = function() {
  // Hide post-match screen
  document.getElementById('post-match-screen').style.display = 'none';

  // Check if tournament is complete
  if (!seasonState.activeTournament || seasonState.activeTournament.phase === 'complete') {
    showSeasonOverview();
    return;
  }

  // Check for next match
  const nextMatch = getNextPlayerMatch();
  if (nextMatch) {
    showBracket();
  } else {
    showSeasonOverview();
  }
};

// Start a new season
window.startNewSeason = function() {
  initializeNewSeason();
  showSeasonOverview();
};

// Handle tournament match result
function handleTournamentMatchResult(playerWon) {
  if (!seasonState.activeTournament) return;

  // Get player and opponent scores from gameState
  const playerTeam = gameState.computerTeam === 'yellow' ? 'red' : 'yellow';
  const playerScore = gameState.scores[playerTeam];
  const opponentScore = gameState.scores[playerTeam === 'red' ? 'yellow' : 'red'];

  // Update tournament bracket
  updateBracketWithResult(playerWon, playerScore, opponentScore);

  // Update season stats
  if (playerWon) {
    seasonState.stats.totalWins++;
  } else {
    seasonState.stats.totalLosses++;
  }

  // Update rivalry history if opponent was a rival
  const opponent = getCurrentMatchOpponent();
  if (opponent && opponent.isRival && opponent.id) {
    if (!seasonState.rivalryHistory[opponent.id]) {
      seasonState.rivalryHistory[opponent.id] = { playerWins: 0, playerLosses: 0, lastMet: null };
    }
    if (playerWon) {
      seasonState.rivalryHistory[opponent.id].playerWins++;
    } else {
      seasonState.rivalryHistory[opponent.id].playerLosses++;
    }
    seasonState.rivalryHistory[opponent.id].lastMet = new Date().toISOString();
  }

  // Check tournament status
  const status = checkTournamentStatus();

  // Clear tournament match flag
  gameState.inTournamentMatch = false;

  // Save state
  saveSeasonState();

  // Store result for post-match screen
  window._lastMatchResult = {
    playerWon,
    playerScore,
    opponentScore,
    opponent,
    tournamentStatus: status
  };
}

// Show post-match screen
window.showPostMatch = function() {
  const screen = document.getElementById('post-match-screen');
  const result = window._lastMatchResult;

  // Clear the result so it doesn't persist
  window._lastMatchResult = undefined;

  if (!result) {
    showSeasonOverview();
    return;
  }

  // Update result banner
  const banner = document.getElementById('match-result-banner');
  const resultText = document.getElementById('match-result-text');
  const scoreText = document.getElementById('match-final-score');

  if (result.playerWon) {
    banner.style.background = 'linear-gradient(135deg, #1a4d2e 0%, #2d6b40 100%)';
    resultText.textContent = 'VICTORY!';
  } else {
    banner.style.background = 'linear-gradient(135deg, #4d1a1a 0%, #6b2d2d 100%)';
    resultText.textContent = 'DEFEAT';
  }

  scoreText.textContent = `${result.playerScore} - ${result.opponentScore}`;

  // Update match summary
  const opponentName = result.opponent ?
    `${result.opponent.firstName} ${result.opponent.lastName}` : 'Opponent';
  document.getElementById('match-opponent-defeated').textContent =
    result.playerWon ? `Defeated ${opponentName}` : `Lost to ${opponentName}`;

  document.getElementById('post-match-wins').textContent = seasonState.stats.totalWins;
  document.getElementById('post-match-points').textContent =
    result.playerWon ? `+${seasonState.activeTournament?.definition?.rewards?.points || 0}` : '+0';

  // Update tournament progress
  updateMiniiBracketPreview();

  // Update next action info
  const nextInfo = document.getElementById('post-match-next-info');
  const continueBtn = document.getElementById('continue-tournament-btn');
  const returnBtn = document.getElementById('return-to-season-btn');

  if (result.tournamentStatus === 'eliminated' || result.tournamentStatus === 'champion') {
    if (result.tournamentStatus === 'champion') {
      nextInfo.textContent = '🏆 Tournament Champion!';
    } else {
      nextInfo.textContent = 'Tournament ended';
    }
    continueBtn.style.display = 'none';
    returnBtn.style.display = 'block';
  } else {
    const nextMatch = getNextPlayerMatch();
    if (nextMatch) {
      const nextOpp = getCurrentMatchOpponent();
      const nextOppName = nextOpp ?
        `${nextOpp.firstName} ${nextOpp.lastName}` : 'TBD';
      nextInfo.textContent = `Next: ${nextMatch.round.name} vs. ${nextOppName}`;
    } else {
      nextInfo.textContent = 'Waiting for next round...';
    }
    continueBtn.style.display = 'block';
    returnBtn.style.display = 'none';
  }

  screen.style.display = 'block';
};

// Update mini bracket preview in post-match
function updateMiniiBracketPreview() {
  const container = document.getElementById('mini-bracket-preview');
  if (!container || !seasonState.activeTournament) {
    container.innerHTML = '<div style="color: #64748b;">Tournament complete</div>';
    return;
  }

  const bracket = seasonState.activeTournament.bracket;
  if (!bracket || !bracket.rounds) return;

  // Show simplified bracket view
  container.innerHTML = bracket.rounds.map(round => `
    <div style="margin-bottom: 8px;">
      <div style="color: #64748b; font-size: 11px; margin-bottom: 4px;">${round.name}</div>
      ${round.matchups.filter(m => m.team1?.isPlayer || m.team2?.isPlayer).map(matchup => `
        <div style="
          display: flex;
          justify-content: space-between;
          padding: 6px 8px;
          background: ${matchup.status === 'complete' ? 'rgba(255,255,255,0.03)' : 'rgba(74,222,128,0.1)'};
          border-radius: 4px;
          font-size: 12px;
        ">
          <span style="color: ${matchup.winner?.isPlayer ? '#4ade80' : '#ef4444'};">
            ${matchup.status === 'complete' ? (matchup.winner?.isPlayer ? '✓' : '✗') : '○'} You
          </span>
          <span style="color: #94a3b8;">
            ${matchup.winner ? (matchup.winner.isPlayer ? 'W' : 'L') : 'vs'} ${matchup.team1?.isPlayer ? matchup.team2?.name : matchup.team1?.name || 'TBD'}
          </span>
        </div>
      `).join('')}
    </div>
  `).join('');
}

// Show country selection screen
function showCountrySelection() {
  const screen = document.getElementById('country-select-screen');
  const grid = document.getElementById('country-grid');

  if (!screen || !grid) return;

  // Populate country grid
  grid.innerHTML = '';
  CURLING_COUNTRIES.forEach(country => {
    const btn = document.createElement('button');
    btn.className = 'country-btn';
    btn.innerHTML = `
      <div style="font-size: 36px; margin-bottom: 8px;">${country.flag}</div>
      <div style="color: white; font-size: 14px;">${country.name}</div>
    `;
    btn.onclick = () => selectCountry(country);
    grid.appendChild(btn);
  });

  screen.style.display = 'block';
}

// Handle country selection
function selectCountry(country) {
  gameState.playerCountry = country;

  // Assign a random different country to opponent
  const otherCountries = CURLING_COUNTRIES.filter(c => c.id !== country.id);
  gameState.opponentCountry = otherCountries[Math.floor(Math.random() * otherCountries.length)];

  // Hide country selection, show settings summary
  document.getElementById('country-select-screen').style.display = 'none';
  showSettingsSummary();
}

// Show settings summary screen
function showSettingsSummary() {
  const screen = document.getElementById('settings-summary-screen');

  // Update summary with selected countries
  document.getElementById('summary-player-flag').textContent = gameState.playerCountry.flag;
  document.getElementById('summary-player-name').textContent = gameState.playerCountry.name;
  document.getElementById('summary-opponent-flag').textContent = gameState.opponentCountry.flag;
  document.getElementById('summary-opponent-name').textContent = gameState.opponentCountry.name;

  // Update mode and level info
  const level = getCurrentLevel();
  const modeText = gameState.learnMode.enabled ? 'Learn Mode' :
                   gameState.gameMode === '1player' ? 'Career Mode' : 'Quick Play';
  document.getElementById('summary-mode').textContent = modeText;
  document.getElementById('summary-level').textContent = level.name + ' Level';

  screen.style.display = 'block';
}

// Pre-toss tutorials for Learn Mode (shown before coin toss)
// Note: 'welcome' is now shown to ALL new users after splash, not just Learn Mode
const PRE_TOSS_TUTORIALS = ['scoring', 'hammer'];

// Start pre-toss tutorials or coin toss
window.startCoinToss = function() {
  document.getElementById('settings-summary-screen').style.display = 'none';

  // Pre-toss tutorials are no longer needed since interactive tutorial runs at startup
  // Go directly to coin toss
  performCoinToss();
};

// Show next pre-toss tutorial in sequence
function showNextPreTossTutorial() {
  console.log('[CoinToss] showNextPreTossTutorial called');
  for (const tutorialId of PRE_TOSS_TUTORIALS) {
    console.log('[CoinToss] Checking tutorial:', tutorialId, 'shown:', gameState.learnMode.tutorialsShown[tutorialId]);
    if (showTutorial(tutorialId)) {
      console.log('[CoinToss] Showing tutorial:', tutorialId);
      return true;  // Found one to show
    }
  }
  // No more pre-toss tutorials, proceed to coin toss
  console.log('[CoinToss] No more pre-toss tutorials, calling performCoinToss');
  gameState.learnMode.preTossPhase = false;
  performCoinToss();
  return false;
}

// Perform actual coin toss animation
function performCoinToss() {
  console.log('[CoinToss] performCoinToss called');
  const overlay = document.getElementById('coin-toss-overlay');
  const coin = document.getElementById('coin');
  const result = document.getElementById('toss-result');
  const subtitle = document.getElementById('toss-subtitle');
  const title = document.getElementById('toss-title');

  if (!overlay) {
    console.error('[CoinToss] coin-toss-overlay element not found!');
    return;
  }
  console.log('[CoinToss] Showing coin toss overlay');
  overlay.style.display = 'flex';
  result.style.display = 'none';
  title.textContent = 'Coin Toss';
  subtitle.textContent = 'Flipping...';

  // Start coin flip animation
  coin.classList.add('coin-flipping');

  // Determine winner (50/50)
  const playerWins = Math.random() < 0.5;

  // After animation, show result
  setTimeout(() => {
    coin.classList.remove('coin-flipping');

    // Safety check for country data
    const playerFlag = gameState.playerCountry?.flag || '🥌';
    const playerName = gameState.playerCountry?.name || 'Player';
    const opponentFlag = gameState.opponentCountry?.flag || '🥌';
    const opponentName = gameState.opponentCountry?.name || 'Opponent';

    if (playerWins) {
      result.textContent = `${playerFlag} ${playerName} wins!`;
      result.style.color = '#4ade80';
      subtitle.textContent = 'You get to choose...';
    } else {
      result.textContent = `${opponentFlag} ${opponentName} wins!`;
      result.style.color = '#f59e0b';
      subtitle.textContent = 'They choose hammer';
    }
    result.style.display = 'block';

    // After showing result, proceed
    setTimeout(() => {
      overlay.style.display = 'none';

      if (playerWins) {
        // Show choice overlay
        document.getElementById('toss-choice-overlay').style.display = 'flex';
      } else {
        // Computer chooses hammer - player gets to choose color
        gameState.cpuTookHammer = true;
        document.getElementById('color-choice-overlay').style.display = 'flex';
      }
    }, 2000);
  }, 2000);
}

// Handle player's toss choice
window.chooseTossOption = function(choice) {
  // Check if we're in multiplayer mode
  if (gameState.selectedMode === 'online') {
    window.multiplayerChooseTossOption(choice);
    return;
  }

  document.getElementById('toss-choice-overlay').style.display = 'none';

  if (choice === 'hammer') {
    // Player takes hammer (throws last)
    gameState.hammer = 'red';
    gameState.currentTeam = 'yellow';  // Opponent throws first
    startGame();
  } else {
    // Player wants to choose color - show color selection overlay
    document.getElementById('color-choice-overlay').style.display = 'flex';
  }
};

// Handle player's color choice
window.chooseColor = function(color) {
  // Check if we're in multiplayer mode
  if (gameState.selectedMode === 'online') {
    // Check if loser is picking color (winner took hammer)
    if (gameState.isLoserPickingColor) {
      gameState.isLoserPickingColor = false;
      window.multiplayerLoserChooseColor(color);
    } else {
      window.multiplayerChooseColor(color);
    }
    return;
  }

  document.getElementById('color-choice-overlay').style.display = 'none';

  // Check if CPU won toss and took hammer (player just picking color)
  const cpuHasHammer = gameState.cpuTookHammer;
  gameState.cpuTookHammer = false;  // Reset flag

  if (color === 'red') {
    // Player keeps red, opponent stays yellow (default setup)
    if (cpuHasHammer) {
      gameState.hammer = 'yellow';  // CPU (yellow) has hammer
      gameState.currentTeam = 'red';  // Player throws first
    } else {
      gameState.hammer = 'yellow';  // Opponent gets hammer
      gameState.currentTeam = 'red';  // Player throws first
    }
  } else {
    // Player wants yellow - swap the countries and computer team
    const tempCountry = gameState.playerCountry;
    gameState.playerCountry = gameState.opponentCountry;
    gameState.opponentCountry = tempCountry;

    // Player is now yellow, computer is red
    gameState.computerTeam = 'red';
    if (cpuHasHammer) {
      gameState.hammer = 'red';  // CPU (now red) has hammer
      gameState.currentTeam = 'yellow';  // Player throws first
    } else {
      gameState.hammer = 'red';  // Computer (now red) gets hammer
      gameState.currentTeam = 'yellow';  // Player (now yellow) throws first
    }
  }

  startGame();
};

// Start the actual game after setup
function startGame() {
  gameState.setupComplete = true;
  gameState.phase = 'aiming';  // Ensure phase is reset for new game

  // Update arena for current level (Career uses career.level, Quick Play uses quickPlayLevel)
  updateArenaForLevel();

  // Track game start
  const gameMode = gameState.selectedMode || 'quickplay';
  analytics.trackGameStart(gameMode, gameState.settings.difficulty, gameState.learnMode?.enabled || false);

  // Check for saved match progress (crash recovery)
  const savedProgress = loadMatchProgress();
  if (savedProgress && seasonState.activeTournament) {
    console.log('[Recovery] Restoring match progress from End', savedProgress.end);
    gameState.end = savedProgress.end;
    gameState.scores = savedProgress.scores;
    gameState.endScores = savedProgress.endScores;
    gameState.hammer = savedProgress.hammer;
    gameState.currentTeam = savedProgress.currentTeam;
    if (savedProgress.computerTeam) {
      gameState.computerTeam = savedProgress.computerTeam;
    }
    // Restore stones thrown count
    if (savedProgress.stonesThrown) {
      gameState.stonesThrown = savedProgress.stonesThrown;
    }
    // Restore country info
    if (savedProgress.playerCountry) {
      gameState.playerCountry = savedProgress.playerCountry;
    }
    if (savedProgress.opponentCountry) {
      gameState.opponentCountry = savedProgress.opponentCountry;
    }
    // Restore stone positions (mid-end recovery)
    if (savedProgress.stonePositions && savedProgress.stonePositions.length > 0) {
      console.log('[Recovery] Restoring', savedProgress.stonePositions.length, 'stones on ice');
      // Clear any existing stones first
      for (const stone of gameState.stones) {
        scene.remove(stone.mesh);
        Matter.Composite.remove(world, stone.body);
      }
      gameState.stones = [];
      // Recreate stones at saved positions
      for (const pos of savedProgress.stonePositions) {
        const stone = createStone(pos.team);
        stone.mesh.position.set(pos.x, pos.y, pos.z);
        stone.mesh.rotation.y = pos.rotation || 0;
        // Set physics body position (scaled)
        Matter.Body.setPosition(stone.body, {
          x: pos.x * PHYSICS_SCALE,
          y: pos.z * PHYSICS_SCALE  // Z in Three.js = Y in Matter.js
        });
        Matter.Body.setVelocity(stone.body, { x: 0, y: 0 });  // Stopped
        gameState.stones.push(stone);
      }
      // Update stone count display
      updateStoneCountDisplay();
    }
  }

  // Start ambient crowd sound - ensure sound is enabled and audio context is resumed
  if (gameState.settings.soundEnabled) {
    soundManager.setEnabled(true);  // Re-enable in case it wasn't initialized
  }
  soundManager.ensureAudioResumed();
  soundManager.startAmbientCrowd();

  // Update scoreboard with flags and configure for game length
  updateScoreboardFlags();
  updateScoreboardForGameLength();

  // Hide level display for multiplayer mode
  const careerDisplay = document.getElementById('career-display');
  if (careerDisplay) {
    careerDisplay.style.display = gameState.selectedMode === 'online' ? 'none' : 'flex';
  }

  // Initialize game buttons (show pause button initially, save button shows after shots stop)
  updateGameButtons(false);

  // Update score display (important for crash recovery)
  updateScoreDisplay();

  // Update turn display
  const isComputer = gameState.gameMode === '1player' && gameState.currentTeam === gameState.computerTeam;
  let turnText;

  const totalEnds = gameState.settings.gameLength;
  if (gameState.selectedMode === 'online') {
    // Multiplayer - use player names
    const localTeam = multiplayer.multiplayerState.localPlayer.team;
    const isMyTurn = gameState.currentTeam === localTeam;
    const localName = multiplayer.multiplayerState.localPlayer.name || 'You';
    const remoteName = multiplayer.multiplayerState.remotePlayer.name || 'Opponent';

    if (isMyTurn) {
      turnText = `End ${gameState.end}/${totalEnds} - ${localName}'s Turn`;
    } else {
      turnText = `End ${gameState.end}/${totalEnds} - ${remoteName}'s Turn`;
    }
  } else {
    const teamName = gameState.currentTeam === 'red' ? gameState.playerCountry.name : gameState.opponentCountry.name;
    const teamFlag = gameState.currentTeam === 'red' ? gameState.playerCountry.flag : gameState.opponentCountry.flag;
    // Use non-breaking spaces to keep team name and "'s Turn" together
    turnText = `End ${gameState.end}/${totalEnds} - ${teamFlag}\u00A0${teamName}'s\u00A0Turn${isComputer ? ' (CPU)' : ''}`;
  }
  document.getElementById('turn').textContent = turnText;

  // Update preview stone color for the current team
  updatePreviewStoneForTeam();

  // Set camera view - target view for player, thrower view for computer
  if (isComputer) {
    // Computer's turn - go straight to thrower view
    gameState.previewHeight = 0;
    gameState.previewLocked = false;
    console.log('[COMPUTER] Computer goes first, scheduling shot...');
    scheduleComputerShot();
  } else {
    // Player's turn - start in target view
    gameState.previewHeight = 1;
    gameState.previewLocked = true;
    // Show first-run aim tutorial (skip if in interactive tutorial)
    if (gameState.selectedMode !== 'online' && !gameState.interactiveTutorialMode) {
      showFirstRunTutorial('fr_aim');
    }
  }
  gameState.targetViewZoom = 1;  // Reset pinch-to-zoom at start of game

  // Trigger coach panel/tutorials
  updateCoachPanel();

  // Update fast-forward button visibility
  updateFastForwardButton();
}

// Update scoreboard to show flags instead of RED/YELLOW
function updateScoreboardFlags() {
  const redLabel = document.querySelector('#red-score-row .team-col');
  const yellowLabel = document.querySelector('#yellow-score-row .team-col');

  // For multiplayer, show player names
  if (gameState.selectedMode === 'online') {
    const hostName = multiplayer.multiplayerState.isHost
      ? multiplayer.multiplayerState.localPlayer.name
      : multiplayer.multiplayerState.remotePlayer.name;
    const guestName = multiplayer.multiplayerState.isHost
      ? multiplayer.multiplayerState.remotePlayer.name
      : multiplayer.multiplayerState.localPlayer.name;

    if (redLabel) {
      // Red is always host
      const shortName = (hostName || 'Host').substring(0, 8);
      redLabel.innerHTML = `<span style="font-size: 11px;">${shortName}</span>`;
      redLabel.title = hostName || 'Host';
    }
    if (yellowLabel) {
      // Yellow is always guest
      const shortName = (guestName || 'Guest').substring(0, 8);
      yellowLabel.innerHTML = `<span style="font-size: 11px;">${shortName}</span>`;
      yellowLabel.title = guestName || 'Guest';
    }
    return;
  }

  if (!gameState.playerCountry || !gameState.opponentCountry) return;

  // Player is red, opponent is yellow
  if (redLabel) {
    redLabel.innerHTML = `<span style="font-size: 16px;">${gameState.playerCountry.flag}</span>`;
    redLabel.title = gameState.playerCountry.name;
  }
  if (yellowLabel) {
    yellowLabel.innerHTML = `<span style="font-size: 16px;">${gameState.opponentCountry.flag}</span>`;
    yellowLabel.title = gameState.opponentCountry.name;
  }
}

// ============================================
// FIRST-RUN INTERACTIVE TUTORIALS
// ============================================

// First-run tutorials for new users (not in Learn Mode)
const FIRST_RUN_TUTORIALS = {
  fr_welcome: {
    id: 'fr_welcome',
    icon: '🥌',
    title: 'Welcome to Curling!',
    text: `In curling, two teams take turns sliding stones toward a target called the "house". The goal is to get your stones closer to the center (the "button") than your opponent's stones.

Each "end" (like an inning) consists of 16 stones total - 8 per team, thrown alternately.`,
    hint: 'The last stone thrown in an end is called the Hammer.',
    step: 1,
    total: 5
  },
  fr_aim: {
    id: 'fr_aim',
    icon: '🎯',
    title: 'Set Your Target',
    text: `Tap anywhere on the ice to place your target marker. This is where you want your stone to stop.

The green arrow shows your aim direction. Drag left or right to fine-tune your aim.`,
    hint: 'Place your target in the house (colored rings) to score!',
    step: 2,
    total: 5
  },
  fr_curl: {
    id: 'fr_curl',
    icon: '🌀',
    title: 'Choose Your Curl',
    text: `Curling stones curve as they slow down! Tap IN or OUT (bottom left) to set the curl direction:

• IN-turn → stone curves LEFT
• OUT-turn → stone curves RIGHT`,
    hint: 'Curl helps you navigate around other stones.',
    step: 3,
    total: 5
  },
  fr_throw: {
    id: 'fr_throw',
    icon: '💪',
    title: 'Throw the Stone',
    text: `Tap and drag DOWN to set your throwing power (weight). The bar on the left shows your power level.

Release to throw! Tap again when the stone crosses the hog line to let go.`,
    hint: 'More power = stone travels farther.',
    step: 4,
    total: 5
  },
  fr_sweep: {
    id: 'fr_sweep',
    icon: '🧹',
    title: 'Sweep to Control',
    text: `While your stone is moving, swipe back and forth to SWEEP!

Sweeping makes your stone:
• Travel farther
• Stay straighter`,
    hint: 'Sweep if your stone looks light!',
    step: 5,
    total: 5,
    pausesGame: true
  }
};

// Get first-run tutorials shown from localStorage
function getFirstRunTutorialsShown() {
  const stored = localStorage.getItem('curlingpro_tutorials_shown');
  return stored ? JSON.parse(stored) : {};
}

// Save first-run tutorial as shown
function markFirstRunTutorialShown(tutorialId) {
  const shown = getFirstRunTutorialsShown();
  shown[tutorialId] = true;
  localStorage.setItem('curlingpro_tutorials_shown', JSON.stringify(shown));
}

// Check if first-run tutorials are disabled
function areFirstRunTutorialsDisabled() {
  return localStorage.getItem('curlingpro_tutorials_disabled') === 'true';
}

// Disable all first-run tutorials
function disableFirstRunTutorials() {
  localStorage.setItem('curlingpro_tutorials_disabled', 'true');
}

// Show a first-run tutorial (for regular mode, not Learn Mode)
function showFirstRunTutorial(tutorialId) {
  // Don't show in Learn Mode (it has its own tutorials)
  if (gameState.learnMode.enabled) {
    return false;
  }

  // Check if tutorials are disabled
  if (areFirstRunTutorialsDisabled()) {
    return false;
  }

  // Check if permanently dismissed (user checked "don't show again")
  const shown = getFirstRunTutorialsShown();
  if (shown[tutorialId]) {
    return false;
  }

  // Check if already shown this session (don't repeat within same game)
  if (gameState.firstRunTutorialsShownThisSession[tutorialId]) {
    return false;
  }

  const tutorial = FIRST_RUN_TUTORIALS[tutorialId];
  if (!tutorial) return false;

  // Use the same tutorial overlay as Learn Mode
  const overlay = document.getElementById('tutorial-overlay');
  const icon = document.getElementById('tutorial-icon');
  const title = document.getElementById('tutorial-title');
  const step = document.getElementById('tutorial-step');
  const text = document.getElementById('tutorial-text');
  const hintDiv = document.getElementById('tutorial-hint');
  const hintText = document.getElementById('tutorial-hint-text');

  if (!overlay) return false;

  icon.textContent = tutorial.icon;
  title.textContent = tutorial.title;
  step.textContent = `Step ${tutorial.step} of ${tutorial.total}`;
  text.innerHTML = tutorial.text.replace(/\n/g, '<br>');

  if (tutorial.hint) {
    hintDiv.style.display = 'block';
    hintText.textContent = tutorial.hint;
  } else {
    hintDiv.style.display = 'none';
  }

  // Reset checkbox
  const checkbox = document.getElementById('tutorial-dont-show');
  if (checkbox) checkbox.checked = false;

  // Update button text
  const nextBtn = document.getElementById('tutorial-next-btn');
  if (nextBtn) {
    nextBtn.textContent = tutorial.step < tutorial.total ? 'Next' : 'Got it!';
  }

  // Make sure Exit button is hidden (only for interactive tutorial)
  const exitBtn = document.getElementById('tutorial-exit-btn');
  if (exitBtn) exitBtn.style.display = 'none';

  // Make sure checkbox is visible (only hidden in interactive tutorial)
  const checkboxContainer = document.getElementById('tutorial-checkbox-container');
  if (checkboxContainer) checkboxContainer.style.display = 'flex';

  // Store current tutorial info for dismissal
  gameState.firstRunTutorial = {
    id: tutorialId,
    pausesGame: tutorial.pausesGame || false
  };

  // Pause game if needed
  if (tutorial.pausesGame) {
    gameState.learnMode.tutorialPaused = true;
  }

  overlay.style.display = 'block';

  // Track first-run tutorial shown for analytics
  analytics.trackEvent('tutorial', tutorialId, { step: tutorial.step, firstRun: true });

  return true;
}

// Dismiss first-run tutorial (called from the same button as Learn Mode)
function dismissFirstRunTutorial() {
  if (!gameState.firstRunTutorial) return;

  const tutorialId = gameState.firstRunTutorial.id;

  // Mark as shown this session (won't repeat during this game)
  gameState.firstRunTutorialsShownThisSession[tutorialId] = true;

  // If user checked "don't show again", permanently dismiss
  const checkbox = document.getElementById('tutorial-dont-show');
  if (checkbox && checkbox.checked) {
    markFirstRunTutorialShown(tutorialId);
  }

  // Unpause game if it was paused
  if (gameState.firstRunTutorial.pausesGame) {
    gameState.learnMode.tutorialPaused = false;
  }

  gameState.firstRunTutorial = null;

  const overlay = document.getElementById('tutorial-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

// Reset first-run tutorials (call from console: resetFirstRunTutorials())
window.resetFirstRunTutorials = function() {
  localStorage.removeItem('curlingpro_tutorials_shown');
  localStorage.removeItem('curlingpro_tutorials_disabled');
  gameState.firstRunTutorialsShownThisSession = {};
  console.log('[First-Run Tutorials] Reset complete - tutorials will show again');
};

// ============================================
// INTERACTIVE TUTORIAL (before mode selection)
// ============================================

const INTERACTIVE_TUTORIAL_STEPS = [
  {
    id: 'welcome',
    icon: '🥌',
    title: 'Welcome to Curling!',
    text: `In curling, two teams take turns sliding stones toward a target called the "house". The goal is to get your stones closer to the center (the "button") than your opponent's stones.`,
    hint: 'The last stone thrown in an end is called the Hammer.',
    action: 'click',  // Just click to continue
    step: 1,
    total: 6
  },
  {
    id: 'aim',
    icon: '🎯',
    title: 'Set Your Target',
    text: `First, choose where you want your stone to go. TAP on the house (the target area) to place your marker. The skip will stand where you tap to show your target.`,
    hint: 'Tap anywhere on the rings to set your target.',
    action: 'aim',  // Wait for user to place target marker
    step: 2,
    total: 6
  },
  {
    id: 'curl',
    icon: '🌀',
    title: 'Choose Your Curl',
    text: `Curling stones curve as they slow down! Use the slider to set how much your stone will curl. Try different settings to see how it affects your shot.`,
    hint: 'The stone curls opposite to the direction shown on the slider.',
    action: 'curl',  // Wait for user to select curl
    step: 3,
    total: 6
  },
  {
    id: 'ready',
    icon: '✅',
    title: 'Prepare to Throw',
    text: `Now tap the READY button to go to the throwing view.`,
    hint: 'Tap READY when you\'re happy with your target and curl.',
    action: 'ready',  // Wait for user to click READY
    step: 4,
    total: 6
  },
  {
    id: 'throw',
    icon: '💪',
    title: 'Throw the Stone',
    text: `TAP and DRAG DOWN to set your power. Release to push off, then TAP AGAIN to release the stone!`,
    hint: 'Drag down to set power, release, then tap to throw.',
    action: 'throw',  // Wait for user to throw
    step: 5,
    total: 6
  },
  {
    id: 'sweep',
    icon: '🧹',
    title: 'Sweep!',
    text: `While your stone is moving, SWIPE BACK AND FORTH on the screen to sweep! Sweeping makes your stone travel farther and straighter.`,
    hint: 'Swipe rapidly to sweep your stone toward the target!',
    action: 'sweep',  // Wait for user to sweep (or stone to stop)
    step: 6,
    total: 6
  }
];

let interactiveTutorialCallback = null;
let interactiveTutorialStep = 0;
let tutorialActionCompleted = false;

// Start interactive tutorial
function startInteractiveTutorial(onComplete) {
  interactiveTutorialCallback = onComplete;
  interactiveTutorialStep = 0;
  tutorialActionCompleted = false;
  gameState.interactiveTutorialMode = true;
  gameState.welcomeTutorialActive = true;

  // Set up tutorial game state
  setupTutorialGameState();

  // Show first step
  showInteractiveTutorialStep();
}

// Set up minimal game state for tutorial
function setupTutorialGameState() {
  // Reset game state for tutorial
  gameState.phase = 'aiming';
  gameState.currentTeam = 'red';
  gameState.computerTeam = 'yellow';
  gameState.hammer = 'red';
  gameState.end = 1;
  gameState.stonesThrown = { red: 0, yellow: 0 };
  gameState.scores = { red: 0, yellow: 0 };
  gameState.stones = [];
  gameState.curlDirection = null;
  gameState.aimAngle = 0;
  gameState.effort = 0.6;
  gameState.previewHeight = 0;
  gameState.previewLocked = false;
  gameState.targetMarker = null;

  // Set placeholder countries
  gameState.playerCountry = { id: 'tutorial', name: 'You', flag: '🥌' };
  gameState.opponentCountry = { id: 'cpu', name: 'Opponent', flag: '🎯' };

  // Update preview stone
  updatePreviewStoneForTeam();

  // Hide UI elements that shouldn't show in tutorial
  const scoreboardContainer = document.getElementById('scoreboard-container');
  if (scoreboardContainer) scoreboardContainer.style.display = 'none';

  const turnDisplay = document.getElementById('turn');
  if (turnDisplay) turnDisplay.style.display = 'none';

  const gameButtons = document.getElementById('game-buttons');
  if (gameButtons) gameButtons.style.display = 'none';

  // Show curl buttons
  const curlBtns = document.getElementById('curl-buttons');
  if (curlBtns) curlBtns.style.display = 'none';  // Hidden until curl step

  // Show effort bar
  const effortContainer = document.getElementById('effort-container');
  if (effortContainer) effortContainer.style.display = 'none';  // Hidden until throw step
}

// Show current tutorial step
function showInteractiveTutorialStep() {
  const step = INTERACTIVE_TUTORIAL_STEPS[interactiveTutorialStep];
  if (!step) {
    showTutorialCompletion();
    return;
  }

  tutorialActionCompleted = false;

  const overlay = document.getElementById('tutorial-overlay');
  const popup = document.getElementById('tutorial-popup');
  const icon = document.getElementById('tutorial-icon');
  const title = document.getElementById('tutorial-title');
  const stepEl = document.getElementById('tutorial-step');
  const text = document.getElementById('tutorial-text');
  const hintDiv = document.getElementById('tutorial-hint');
  const hintText = document.getElementById('tutorial-hint-text');
  const nextBtn = document.getElementById('tutorial-next-btn');

  if (!overlay) {
    finishInteractiveTutorial();
    return;
  }

  icon.textContent = step.icon;
  title.textContent = step.title;
  stepEl.textContent = `Step ${step.step} of ${step.total}`;
  text.innerHTML = step.text.replace(/\n/g, '<br>');

  if (step.hint) {
    hintDiv.style.display = 'block';
    hintText.textContent = step.hint;
  } else {
    hintDiv.style.display = 'none';
  }

  // Always show centered popup with dark background
  popup.style.top = '50%';
  popup.style.bottom = 'auto';  // Reset bottom positioning
  popup.style.transform = 'translate(-50%, -50%)';
  overlay.style.background = 'rgba(0, 0, 0, 0.7)';
  overlay.style.pointerEvents = 'auto';
  popup.style.pointerEvents = 'auto';
  nextBtn.style.display = 'block';

  // Button text: "Next" for welcome, "Try it!" for action steps
  nextBtn.textContent = step.action === 'click' ? 'Next' : 'Try it!';

  // Hide checkbox and show Exit button for interactive tutorial
  const checkboxContainer = document.getElementById('tutorial-checkbox-container');
  if (checkboxContainer) checkboxContainer.style.display = 'none';

  const exitBtn = document.getElementById('tutorial-exit-btn');
  if (exitBtn) exitBtn.style.display = 'block';

  overlay.style.display = 'block';

  // Track for analytics
  analytics.trackEvent('tutorial_interactive', step.id, { step: step.step });
}

// Set up UI elements for current tutorial step
function setupUIForTutorialStep(step) {
  const curlDisplay = document.getElementById('curl-display');

  switch (step.action) {
    case 'aim':
      // Put user in target view so they can see the house and place target
      gameState.previewHeight = 1;
      gameState.previewLocked = true;
      gameState.phase = 'aiming';
      // Hide curl display until target is placed
      if (curlDisplay) curlDisplay.style.display = 'none';
      // Show marker hint
      updateMarkerHint();
      break;
    case 'curl':
      // Keep in target view, curl display will show automatically when target placed
      // User should already have target placed from previous step
      break;
    case 'throw':
      // Return to throwing view
      gameState.previewHeight = 0;
      gameState.previewLocked = false;
      gameState.phase = 'aiming';
      updateReturnButton();
      break;
    case 'sweep':
      // Stone is moving, user can sweep
      // Phase should already be 'sweeping' from the throw
      break;
  }
}

// Called when user completes a tutorial action
function onTutorialActionComplete(action) {
  if (!gameState.interactiveTutorialMode) return;

  const currentStep = INTERACTIVE_TUTORIAL_STEPS[interactiveTutorialStep];
  if (!currentStep || currentStep.action !== action) return;

  if (tutorialActionCompleted) return;  // Prevent double-triggers
  tutorialActionCompleted = true;

  // Move to next step
  interactiveTutorialStep++;

  // For 'ready' action, show throw tutorial immediately after entering throw view
  if (action === 'ready') {
    setTimeout(() => {
      showInteractiveTutorialStep();
    }, 800);  // Brief delay for camera transition
    return;
  }

  // For 'throw' action, show sweep tutorial after a delay (gives time for stone to travel)
  if (action === 'throw') {
    setTimeout(() => {
      showInteractiveTutorialStep();
    }, 1500);  // 1.5 second delay after throw
    return;
  }

  // Show "Continue" button after a brief moment
  setTimeout(() => {
    showTutorialContinueButton();
  }, 500);
}

// Show a continue button after user completes an action
function showTutorialContinueButton() {
  // Create or get the standalone continue button
  let continueBtn = document.getElementById('tutorial-continue-btn');
  if (!continueBtn) {
    continueBtn = document.createElement('button');
    continueBtn.id = 'tutorial-continue-btn';
    continueBtn.textContent = 'Continue';
    continueBtn.onclick = () => window.dismissTutorial();
    continueBtn.style.cssText = `
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 32px;
      background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      z-index: 1001;
      box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
    `;
    document.body.appendChild(continueBtn);
  }
  continueBtn.style.display = 'block';
}

// Hide the standalone continue button
function hideTutorialContinueButton() {
  const continueBtn = document.getElementById('tutorial-continue-btn');
  if (continueBtn) {
    continueBtn.style.display = 'none';
  }
}

// Called when user clicks Continue after completing an action
function continueTutorial() {
  hideTutorialContinueButton();
  showInteractiveTutorialStep();
}

// Called when user clicks Next/Got it on a click-only step
function dismissInteractiveTutorialStep() {
  const currentStep = INTERACTIVE_TUTORIAL_STEPS[interactiveTutorialStep];
  if (!currentStep) return;

  const overlay = document.getElementById('tutorial-overlay');

  // Mark tutorial as shown
  if (currentStep.id === 'welcome') markFirstRunTutorialShown('fr_welcome');
  else if (currentStep.id === 'aim') markFirstRunTutorialShown('fr_aim');
  else if (currentStep.id === 'curl') markFirstRunTutorialShown('fr_curl');
  else if (currentStep.id === 'throw') markFirstRunTutorialShown('fr_throw');
  else if (currentStep.id === 'sweep') markFirstRunTutorialShown('fr_sweep');

  if (currentStep.action === 'click') {
    // Click-only step (welcome) - advance immediately
    interactiveTutorialStep++;
    showInteractiveTutorialStep();
  } else {
    // Action step - hide popup and let user try
    if (overlay) overlay.style.display = 'none';

    // Set up UI for this action
    setupUIForTutorialStep(currentStep);
  }
}

// Show tutorial completion message
function showTutorialCompletion() {
  hideTutorialContinueButton();

  // Mark tutorial as completed so it doesn't show again
  markFirstRunTutorialShown('fr_welcome');

  const overlay = document.getElementById('tutorial-overlay');
  const popup = document.getElementById('tutorial-popup');
  const icon = document.getElementById('tutorial-icon');
  const title = document.getElementById('tutorial-title');
  const stepEl = document.getElementById('tutorial-step');
  const text = document.getElementById('tutorial-text');
  const hintDiv = document.getElementById('tutorial-hint');
  const nextBtn = document.getElementById('tutorial-next-btn');

  if (!overlay || !popup) {
    finishInteractiveTutorial();
    return;
  }

  // Set completion content
  icon.textContent = '🎉';
  title.textContent = 'Tutorial Complete!';
  stepEl.textContent = '';
  text.innerHTML = `Great job! You've learned the basics of curling:<br><br>
    • Set your target on the house<br>
    • Choose your curl direction<br>
    • Throw with the right power<br>
    • Sweep to control your stone<br><br>
    Ready to play a real game?`;
  hintDiv.style.display = 'none';

  // Replace button with two options
  nextBtn.style.display = 'none';

  // Create button container if it doesn't exist
  let btnContainer = document.getElementById('tutorial-completion-btns');
  if (!btnContainer) {
    btnContainer = document.createElement('div');
    btnContainer.id = 'tutorial-completion-btns';
    btnContainer.style.cssText = 'display: flex; gap: 12px; justify-content: center; margin-top: 16px;';
    nextBtn.parentNode.appendChild(btnContainer);
  }

  btnContainer.innerHTML = `
    <button onclick="restartTutorial()" style="
      padding: 12px 24px;
      background: transparent;
      border: 2px solid #60a5fa;
      border-radius: 8px;
      color: #60a5fa;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
    ">Try Again</button>
    <button onclick="finishInteractiveTutorial()" style="
      padding: 12px 24px;
      background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
    ">Start Playing</button>
  `;
  btnContainer.style.display = 'flex';

  // Show popup
  popup.style.top = '50%';
  popup.style.bottom = 'auto';
  popup.style.transform = 'translate(-50%, -50%)';
  overlay.style.background = 'rgba(0, 0, 0, 0.7)';
  overlay.style.pointerEvents = 'auto';
  popup.style.pointerEvents = 'auto';
  overlay.style.display = 'block';
}

// Restart the tutorial from the beginning
function restartTutorial() {
  // Hide completion buttons
  const btnContainer = document.getElementById('tutorial-completion-btns');
  if (btnContainer) btnContainer.style.display = 'none';

  // Show next button again
  const nextBtn = document.getElementById('tutorial-next-btn');
  if (nextBtn) nextBtn.style.display = 'block';

  // Clear stones from previous attempt
  for (const stone of gameState.stones) {
    if (stone.mesh) scene.remove(stone.mesh);
    if (stone.body) Matter.Composite.remove(world, stone.body);
  }
  gameState.stones = [];
  gameState.stonesThrown = { red: 0, yellow: 0 };

  // Reset target marker
  if (gameState.targetMarker) {
    gameState.targetMarker.visible = false;
  }
  gameState.targetPosition = null;

  // Reset to first step
  interactiveTutorialStep = 0;
  tutorialActionCompleted = false;

  // Show first step
  showInteractiveTutorialStep();
}

// Finish interactive tutorial
function finishInteractiveTutorial() {
  hideTutorialContinueButton();

  const overlay = document.getElementById('tutorial-overlay');
  const popup = document.getElementById('tutorial-popup');

  if (overlay) {
    overlay.style.display = 'none';
    overlay.style.background = 'rgba(0, 0, 0, 0.7)';
    overlay.style.pointerEvents = 'auto';
  }
  if (popup) {
    popup.style.top = '50%';
    popup.style.bottom = 'auto';  // Reset bottom positioning
    popup.style.transform = 'translate(-50%, -50%)';
    popup.style.pointerEvents = 'auto';
  }

  // Hide completion buttons
  const btnContainer = document.getElementById('tutorial-completion-btns');
  if (btnContainer) btnContainer.style.display = 'none';

  // Show next button again for future tutorials
  const nextBtn = document.getElementById('tutorial-next-btn');
  if (nextBtn) nextBtn.style.display = 'block';

  // Hide exit button
  const exitBtn = document.getElementById('tutorial-exit-btn');
  if (exitBtn) exitBtn.style.display = 'none';

  // Show checkbox again
  const checkboxContainer = document.getElementById('tutorial-checkbox-container');
  if (checkboxContainer) checkboxContainer.style.display = 'flex';

  // Restore UI
  const scoreboardContainer = document.getElementById('scoreboard-container');
  if (scoreboardContainer) scoreboardContainer.style.display = '';

  const turnDisplay = document.getElementById('turn');
  if (turnDisplay) turnDisplay.style.display = '';

  const gameButtons = document.getElementById('game-buttons');
  if (gameButtons) gameButtons.style.display = '';

  // Clear tutorial state
  gameState.interactiveTutorialMode = false;
  gameState.welcomeTutorialActive = false;

  // Clear any stones from tutorial
  for (const stone of gameState.stones) {
    if (stone.mesh) scene.remove(stone.mesh);
    if (stone.body) Matter.Composite.remove(world, stone.body);
  }
  gameState.stones = [];

  // Reset preview stone
  if (gameState.previewStone) {
    gameState.previewStone.visible = false;
  }

  // Reset game state completely for fresh game start (match initial defaults)
  gameState.setupComplete = false;
  gameState.phase = 'aiming';
  gameState.selectedMode = null;
  gameState.gameMode = '1player';  // Default is '1player', not null
  gameState.playerCountry = null;
  gameState.opponentCountry = null;
  gameState.currentTeam = 'red';
  gameState.computerTeam = 'yellow';
  gameState.hammer = 'yellow';
  gameState.curlDirection = null;
  gameState.playerCurlDirection = null;
  gameState.targetPosition = null;
  gameState.previewHeight = 0;
  gameState.previewLocked = false;
  gameState.end = 1;
  gameState.stonesThrown = { red: 0, yellow: 0 };
  gameState.scores = { red: 0, yellow: 0 };
  gameState.learnMode.enabled = false;
  gameState.learnMode.level = 1;
  gameState.aimAngle = 0;
  gameState.baseAimAngle = 0;

  // Mark ALL first-run tutorials as shown since user completed interactive tutorial
  // Mark in localStorage (persistent)
  markFirstRunTutorialShown('fr_welcome');
  markFirstRunTutorialShown('fr_aim');
  markFirstRunTutorialShown('fr_curl');
  markFirstRunTutorialShown('fr_throw');
  markFirstRunTutorialShown('fr_sweep');

  // Also mark in session state (immediate effect, no localStorage dependency)
  gameState.firstRunTutorialsShownThisSession['fr_welcome'] = true;
  gameState.firstRunTutorialsShownThisSession['fr_aim'] = true;
  gameState.firstRunTutorialsShownThisSession['fr_curl'] = true;
  gameState.firstRunTutorialsShownThisSession['fr_throw'] = true;
  gameState.firstRunTutorialsShownThisSession['fr_sweep'] = true;

  // Also disable first-run tutorials entirely to prevent any blocking
  disableFirstRunTutorials();

  // Hide target marker if it exists
  if (gameState.targetMarker) {
    gameState.targetMarker.visible = false;
  }

  // Call callback (show mode selection)
  if (interactiveTutorialCallback) {
    const cb = interactiveTutorialCallback;
    interactiveTutorialCallback = null;
    cb();
  }
}

// Exit tutorial early (user clicked Exit button)
function exitTutorial() {
  // Mark welcome tutorial as shown so it doesn't appear again
  markFirstRunTutorialShown('fr_welcome');
  finishInteractiveTutorial();
}

// Expose tutorial functions for onclick handlers
window.restartTutorial = restartTutorial;
window.finishInteractiveTutorial = finishInteractiveTutorial;
window.exitTutorial = exitTutorial;

window.setDifficulty = function(difficulty) {
  gameState.settings.difficulty = difficulty;
  updateDifficultyButtons(difficulty);
};

function updateDifficultyButtons(difficulty) {
  const buttons = document.querySelectorAll('.difficulty-btn');
  const descriptions = {
    easy: 'Computer makes frequent mistakes',
    medium: 'Computer makes occasional mistakes',
    hard: 'Computer plays near-perfect shots'
  };

  buttons.forEach(btn => {
    const btnDifficulty = btn.getAttribute('data-difficulty');
    if (btnDifficulty === difficulty) {
      btn.style.borderColor = '#4ade80';
      btn.style.background = '#2d5a3d';
    } else {
      btn.style.borderColor = '#666';
      btn.style.background = '#333';
    }
  });

  const descEl = document.getElementById('difficulty-description');
  if (descEl) {
    descEl.textContent = descriptions[difficulty] || '';
  }
}

window.toggleSound = function(enabled) {
  gameState.settings.soundEnabled = enabled;
  soundManager.setEnabled(enabled);
};

window.setGameLength = function(ends) {
  gameState.settings.gameLength = ends;
  updateEndsButtons(ends);
  updateScoreboardColumns();
};

function updateEndsButtons(ends) {
  const buttons = document.querySelectorAll('.ends-btn');
  const descriptions = {
    4: 'Quick game',
    8: 'Standard game length',
    10: 'Full competitive game'
  };

  buttons.forEach(btn => {
    const btnEnds = parseInt(btn.getAttribute('data-ends'));
    if (btnEnds === ends) {
      btn.style.borderColor = '#4ade80';
      btn.style.background = '#2d5a3d';
    } else {
      btn.style.borderColor = '#666';
      btn.style.background = '#333';
    }
  });

  const descEl = document.getElementById('ends-description');
  if (descEl) {
    descEl.textContent = descriptions[ends] || '';
  }
}

function updateScoreboardColumns() {
  // Show/hide end columns in scoreboard based on game length
  const gameLength = gameState.settings.gameLength;
  for (let i = 1; i <= 10; i++) {
    const redCell = document.getElementById(`red-end-${i}`);
    const yellowCell = document.getElementById(`yellow-end-${i}`);
    const headerCells = document.querySelectorAll(`#score-table th`);

    // Find the header cell for this end (index i+1 because of team and hammer columns)
    if (redCell && yellowCell) {
      const display = i <= gameLength ? '' : 'none';
      redCell.style.display = display;
      yellowCell.style.display = display;
    }
    if (headerCells[i + 1]) {
      headerCells[i + 1].style.display = i <= gameLength ? '' : 'none';
    }
  }
}

window.submitFeedback = function(type) {
  const overlay = document.getElementById('feedback-overlay');
  const title = document.getElementById('feedback-title');
  const typeInput = document.getElementById('feedback-type');
  const messageInput = document.getElementById('feedback-message');
  const statusEl = document.getElementById('feedback-status');

  if (overlay) {
    // Reset form
    document.getElementById('feedback-form').reset();
    statusEl.style.display = 'none';

    // Set type
    typeInput.value = type;
    title.textContent = type === 'bug' ? 'Report Bug' : 'Request Feature';
    title.style.color = type === 'bug' ? '#fca5a5' : '#93c5fd';
    messageInput.placeholder = type === 'bug'
      ? 'Describe the bug...\n\nSteps to reproduce:\n1. \n2. \n3. '
      : 'Describe the feature you would like...';

    overlay.style.display = 'flex';
  }
};

window.closeFeedback = function() {
  const overlay = document.getElementById('feedback-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
};

// ============================================
// SUPPORT THE DEVELOPER (Tip Jar)
// ============================================

// IAP Product IDs (will be configured in App Store Connect)
const TIP_PRODUCTS = {
  small: { id: 'com.curlingpro.tip.small', price: '$0.99' },
  medium: { id: 'com.curlingpro.tip.medium', price: '$2.99' },
  large: { id: 'com.curlingpro.tip.large', price: '$4.99' }
};

window.showSupportOptions = function() {
  const overlay = document.getElementById('support-overlay');
  const statusEl = document.getElementById('support-status');
  if (overlay) {
    if (statusEl) statusEl.style.display = 'none';
    overlay.style.display = 'flex';
  }
};

window.closeSupportOptions = function() {
  const overlay = document.getElementById('support-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
};

window.purchaseTip = async function(tier) {
  const statusEl = document.getElementById('support-status');
  const product = TIP_PRODUCTS[tier];

  if (!product) {
    console.error('Invalid tip tier:', tier);
    return;
  }

  // Check if Capacitor IAP is available
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.InAppPurchase) {
    // Native IAP flow (when Capacitor is set up)
    try {
      statusEl.textContent = 'Processing...';
      statusEl.style.color = '#94a3b8';
      statusEl.style.display = 'block';

      const iap = window.Capacitor.Plugins.InAppPurchase;
      await iap.purchase({ productId: product.id });

      // Success
      statusEl.textContent = '💛 Thank you for your support!';
      statusEl.style.color = '#4ade80';

      // Track the purchase
      if (typeof analytics !== 'undefined') {
        analytics.trackEvent('tip_purchase', tier, { amount: product.price });
      }

      // Close after delay
      setTimeout(() => {
        window.closeSupportOptions();
      }, 2500);

    } catch (error) {
      if (error.code === 'USER_CANCELLED') {
        statusEl.style.display = 'none';
      } else {
        statusEl.textContent = 'Purchase failed. Please try again.';
        statusEl.style.color = '#f87171';
      }
    }
  } else {
    // Web fallback - show message that IAP requires the app
    statusEl.textContent = 'In-app purchases available in the App Store version.';
    statusEl.style.color = '#fcd34d';
    statusEl.style.display = 'block';

    // Track attempt
    if (typeof analytics !== 'undefined') {
      analytics.trackEvent('tip_attempt_web', tier);
    }
  }
};

window.showAbout = function(fromSettings = true) {
  const screen = document.getElementById('about-screen');
  if (screen) {
    screen.style.display = 'block';
    screen.dataset.fromSettings = fromSettings ? 'true' : 'false';
  }
  // Close settings modal if open
  const settingsOverlay = document.getElementById('settings-overlay');
  if (settingsOverlay && settingsOverlay.style.display !== 'none') {
    window.closeSettings();
    if (screen) screen.dataset.fromSettings = 'true';
  }
};

window.closeAbout = function() {
  const screen = document.getElementById('about-screen');
  if (screen) {
    const fromSettings = screen.dataset.fromSettings === 'true';
    screen.style.display = 'none';
    // Reopen settings only if we came from there
    if (fromSettings) {
      window.openSettings();
    }
  }
};

// ============================================
// LEADERBOARD
// ============================================

window.showLeaderboard = async function() {
  const screen = document.getElementById('leaderboard-screen');
  if (!screen) return;

  screen.style.display = 'block';

  // Show loading state
  const rowsContainer = document.getElementById('leaderboard-rows');
  if (rowsContainer) {
    rowsContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: #64748b;">Loading...</div>';
  }

  // Fetch leaderboard data
  const result = await multiplayer.getLeaderboard(100);

  if (result.success && result.data.length > 0) {
    renderLeaderboard(result.data);
  } else {
    if (rowsContainer) {
      rowsContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: #64748b;">No ranked players yet. Be the first!</div>';
    }
  }

  // Get current player's rank
  const playerId = multiplayer.getPlayerId();
  const rankResult = await multiplayer.getPlayerRank();
  const playerRankEl = document.getElementById('leaderboard-player-rank');
  const notRankedEl = document.getElementById('leaderboard-not-ranked');

  if (rankResult.success && rankResult.rank) {
    if (playerRankEl) {
      playerRankEl.textContent = `Your Rank: #${rankResult.rank}`;
      playerRankEl.style.display = 'block';
    }
    if (notRankedEl) notRankedEl.style.display = 'none';
  } else {
    if (playerRankEl) playerRankEl.style.display = 'none';
    if (notRankedEl) notRankedEl.style.display = 'block';
  }
};

function renderLeaderboard(players) {
  const container = document.getElementById('leaderboard-rows');
  if (!container) return;

  const currentPlayerId = multiplayer.getPlayerId();

  container.innerHTML = players.map(player => {
    const isCurrentPlayer = player.player_id === currentPlayerId;
    const bgColor = isCurrentPlayer ? 'rgba(251, 191, 36, 0.15)' : 'transparent';
    const borderStyle = isCurrentPlayer ? 'border-left: 3px solid #fbbf24;' : '';

    // Rank medal for top 3
    let rankDisplay = `#${player.rank}`;
    if (player.rank === 1) rankDisplay = '🥇';
    else if (player.rank === 2) rankDisplay = '🥈';
    else if (player.rank === 3) rankDisplay = '🥉';

    return `
      <div style="
        display: grid;
        grid-template-columns: 60px 1fr 80px 100px 70px;
        padding: 12px 16px;
        background: ${bgColor};
        border-bottom: 1px solid rgba(255,255,255,0.05);
        ${borderStyle}
        align-items: center;
      ">
        <div style="color: ${player.rank <= 3 ? '#fbbf24' : '#94a3b8'}; font-weight: bold;">${rankDisplay}</div>
        <div style="color: white; font-weight: ${isCurrentPlayer ? 'bold' : 'normal'};">
          ${escapeHtml(player.player_name)}${isCurrentPlayer ? ' (You)' : ''}
        </div>
        <div style="text-align: center; color: #fbbf24; font-weight: bold;">${player.elo_rating}</div>
        <div style="text-align: center; color: #94a3b8;">${player.wins}-${player.losses}</div>
        <div style="text-align: center; color: ${player.winRate >= 50 ? '#4ade80' : '#f87171'};">${player.winRate}%</div>
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

window.closeLeaderboard = function() {
  const screen = document.getElementById('leaderboard-screen');
  if (screen) {
    screen.style.display = 'none';
  }
};

// ============================================
// STATISTICS DASHBOARD
// ============================================

let currentStatsTab = 'ranked';

window.showStats = async function() {
  const screen = document.getElementById('stats-screen');
  if (!screen) return;

  screen.style.display = 'block';

  // Load both ranked and career stats
  await loadRankedStats();
  loadCareerStats();
  await loadMatchHistoryDisplay();
};

window.closeStats = function() {
  const screen = document.getElementById('stats-screen');
  if (screen) {
    screen.style.display = 'none';
  }
};

window.showStatsTab = function(tab) {
  currentStatsTab = tab;

  const rankedTab = document.getElementById('stats-tab-ranked');
  const careerTab = document.getElementById('stats-tab-career');
  const rankedPanel = document.getElementById('stats-panel-ranked');
  const careerPanel = document.getElementById('stats-panel-career');

  if (tab === 'ranked') {
    rankedTab.style.background = 'rgba(139, 92, 246, 0.3)';
    rankedTab.style.borderColor = '#8b5cf6';
    rankedTab.style.color = 'white';
    careerTab.style.background = 'rgba(59, 130, 246, 0.1)';
    careerTab.style.borderColor = 'rgba(59, 130, 246, 0.3)';
    careerTab.style.color = '#94a3b8';
    rankedPanel.style.display = 'block';
    careerPanel.style.display = 'none';
  } else {
    careerTab.style.background = 'rgba(59, 130, 246, 0.3)';
    careerTab.style.borderColor = '#3b82f6';
    careerTab.style.color = 'white';
    rankedTab.style.background = 'rgba(139, 92, 246, 0.1)';
    rankedTab.style.borderColor = 'rgba(139, 92, 246, 0.3)';
    rankedTab.style.color = '#94a3b8';
    careerPanel.style.display = 'block';
    rankedPanel.style.display = 'none';
  }

  // Reload match history for current tab
  loadMatchHistoryDisplay();
};

async function loadRankedStats() {
  const stats = await multiplayer.getPlayerStats();

  const eloEl = document.getElementById('stats-elo');
  const rankEl = document.getElementById('stats-rank');
  const gamesEl = document.getElementById('stats-ranked-games');
  const winsEl = document.getElementById('stats-ranked-wins');
  const winrateEl = document.getElementById('stats-ranked-winrate');

  if (stats) {
    if (eloEl) eloEl.textContent = stats.elo_rating || 1000;
    if (gamesEl) gamesEl.textContent = stats.games_played || 0;
    if (winsEl) winsEl.textContent = stats.wins || 0;

    const winRate = stats.games_played > 0
      ? Math.round((stats.wins / stats.games_played) * 100)
      : 0;
    if (winrateEl) winrateEl.textContent = winRate + '%';

    // Get rank
    const rankResult = await multiplayer.getPlayerRank();
    if (rankResult.success && rankResult.rank) {
      if (rankEl) rankEl.textContent = `Rank: #${rankResult.rank}`;
    } else {
      if (rankEl) rankEl.textContent = 'Rank: Unranked';
    }
  } else {
    if (eloEl) eloEl.textContent = '--';
    if (rankEl) rankEl.textContent = 'Rank: --';
    if (gamesEl) gamesEl.textContent = '0';
    if (winsEl) winsEl.textContent = '0';
    if (winrateEl) winrateEl.textContent = '0%';
  }
}

function loadCareerStats() {
  const level = getCurrentLevel();
  const localStats = getLocalMatchStats();

  const levelEl = document.getElementById('stats-career-level');
  const progressEl = document.getElementById('stats-career-progress');
  const gamesEl = document.getElementById('stats-career-games');
  const winsEl = document.getElementById('stats-career-wins');
  const winrateEl = document.getElementById('stats-career-winrate');

  if (levelEl) {
    levelEl.textContent = level.name;
    levelEl.style.color = level.color;
  }

  if (progressEl) {
    const remaining = level.winsToAdvance ? level.winsToAdvance - gameState.career.wins : 0;
    if (gameState.career.level >= 8) {
      progressEl.textContent = 'Maximum level reached!';
    } else {
      progressEl.textContent = `${gameState.career.wins}/${level.winsToAdvance} wins to advance`;
    }
  }

  if (gamesEl) gamesEl.textContent = localStats.careerGames || 0;
  if (winsEl) winsEl.textContent = localStats.careerWins || 0;

  const winRate = localStats.careerGames > 0
    ? Math.round((localStats.careerWins / localStats.careerGames) * 100)
    : 0;
  if (winrateEl) winrateEl.textContent = winRate + '%';
}

async function loadMatchHistoryDisplay() {
  const container = document.getElementById('stats-match-history');
  if (!container) return;

  let matches = [];

  if (currentStatsTab === 'ranked') {
    // Get ranked matches from Supabase
    const result = await multiplayer.getMatchHistory(20);
    if (result.success) {
      matches = result.data;
    }
  } else {
    // Get local matches (career/quickplay)
    matches = getLocalMatchHistory().slice(0, 20);
  }

  if (matches.length === 0) {
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: #64748b;">No matches yet</div>';
    return;
  }

  container.innerHTML = matches.map(match => {
    const won = match.won;
    const date = new Date(match.played_at || match.playedAt);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // For ranked matches
    const eloChange = match.elo_change || match.eloChange;
    const eloStr = eloChange != null
      ? `<span style="color: ${eloChange >= 0 ? '#4ade80' : '#f87171'};">${eloChange >= 0 ? '+' : ''}${eloChange}</span>`
      : '';

    return `
      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
      ">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: ${won ? '#4ade80' : '#f87171'};
          "></div>
          <div>
            <div style="color: white; font-size: 14px;">vs ${escapeHtml(match.opponent_name || match.opponentName || 'Unknown')}</div>
            <div style="color: #64748b; font-size: 12px;">${dateStr}</div>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="color: ${won ? '#4ade80' : '#f87171'}; font-weight: bold;">
            ${match.player_score || match.playerScore}-${match.opponent_score || match.opponentScore}
          </div>
          ${eloStr ? `<div style="font-size: 12px;">${eloStr}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ============================================
// REMATCH SYSTEM
// ============================================

let rematchState = {
  requested: false,
  waitingForResponse: false
};

window.requestRematch = function() {
  if (!multiplayer.multiplayerState.connected) {
    console.log('[Rematch] Not connected, cannot request rematch');
    return;
  }

  // Guard against double-firing from touch + click
  if (rematchState.requested || rematchState.waitingForResponse) {
    return;
  }

  rematchState.requested = true;
  rematchState.waitingForResponse = true;

  // Update UI to show waiting state
  const rematchBtn = document.getElementById('gameover-rematch');
  if (rematchBtn) {
    rematchBtn.textContent = 'Waiting...';
    rematchBtn.disabled = true;
    rematchBtn.style.opacity = '0.6';
  }

  // Send rematch request
  multiplayer.broadcastRematchRequest();
  console.log('[Rematch] Request sent');
};

window.acceptRematch = function() {
  const overlay = document.getElementById('rematch-request-overlay');
  if (overlay) overlay.style.display = 'none';

  // Send acceptance
  multiplayer.broadcastRematchAccept();

  // Start new game
  startRematchGame();
};

window.declineRematch = function() {
  const overlay = document.getElementById('rematch-request-overlay');
  if (overlay) overlay.style.display = 'none';

  // Just close the overlay - opponent will timeout or leave
  console.log('[Rematch] Declined');
};

function handleRematchRequest(data) {
  console.log('[Rematch] Request received from:', data?.from);

  // If we already requested, this means both want rematch - auto accept
  if (rematchState.requested) {
    console.log('[Rematch] Both requested, auto-accepting');
    startRematchGame();
    return;
  }

  // Show rematch request overlay
  const overlay = document.getElementById('rematch-request-overlay');
  const title = document.getElementById('rematch-title');
  const message = document.getElementById('rematch-message');
  const buttons = document.getElementById('rematch-buttons');
  const waiting = document.getElementById('rematch-waiting');

  if (title) title.textContent = 'Rematch Request';
  if (message) {
    const opponentName = multiplayer.multiplayerState.remotePlayer?.name || 'Opponent';
    message.textContent = `${opponentName} wants to play again!`;
  }
  if (buttons) buttons.style.display = 'flex';
  if (waiting) waiting.style.display = 'none';
  if (overlay) overlay.style.display = 'flex';
}

function handleRematchAccept() {
  console.log('[Rematch] Opponent accepted!');
  rematchState.waitingForResponse = false;

  // Start new game
  startRematchGame();
}

function startRematchGame() {
  console.log('[Rematch] Starting new game');

  // Reset rematch state
  rematchState.requested = false;
  rematchState.waitingForResponse = false;

  // Hide overlays
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const rematchOverlay = document.getElementById('rematch-request-overlay');
  if (gameoverOverlay) {
    gameoverOverlay.classList.remove('visible');
    gameoverOverlay.style.display = 'none';
  }
  if (rematchOverlay) rematchOverlay.style.display = 'none';

  // Clear confetti/rain
  const confettiContainer = document.getElementById('confetti-container');
  if (confettiContainer) confettiContainer.innerHTML = '';

  // Reset rematch button state
  const rematchBtn = document.getElementById('gameover-rematch');
  if (rematchBtn) {
    rematchBtn.textContent = 'Rematch';
    rematchBtn.disabled = false;
    rematchBtn.style.opacity = '1';
  }

  // Reset game state for new match
  gameState.scores = { red: 0, yellow: 0 };
  gameState.endScores = { red: [], yellow: [] };
  gameState.end = 1;
  gameState.shotNumber = 0;
  gameState.currentTeam = 'red';
  gameState.isThrown = false;
  gameState.isPaused = false;
  gameState.rankedMatch = null;  // Reset ranked match tracking

  // Reset stones
  resetAllStones();

  // Update UI
  updateScoreboard();

  // Start new coin toss (host initiates)
  if (multiplayer.multiplayerState.isHost) {
    const coinResult = Math.random() < 0.5 ? 'host' : 'guest';
    const hostWins = coinResult === 'host';

    // Broadcast game start with new coin toss
    multiplayer.broadcastGameStart({
      hostWins,
      coinResult,
      isRematch: true
    });

    showMultiplayerCoinToss(coinResult, true);
  } else {
    // Guest waits for host to broadcast game start
    console.log('[Rematch] Guest waiting for host to start new game');
  }

  // Start ambient crowd
  soundManager.startAmbientCrowd();
}

// Wire up multiplayer callbacks for rematch (called during multiplayer setup)
function setupRematchCallbacks() {
  multiplayer.multiplayerState.onRematchRequest = handleRematchRequest;
  // Note: onRematchAccept is handled via the broadcast listener in multiplayer.js
}

window.showPrivacyPolicy = function() {
  const overlay = document.getElementById('privacy-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
  }
};

window.closePrivacyPolicy = function() {
  const overlay = document.getElementById('privacy-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
};

window.showTermsOfService = function() {
  const overlay = document.getElementById('tos-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
  }
};

window.closeTermsOfService = function() {
  const overlay = document.getElementById('tos-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
};

// ============================================
// FAQ FUNCTIONS
// ============================================

window.showFAQ = function() {
  const screen = document.getElementById('faq-screen');
  if (!screen) return;

  // Close settings modal
  window.closeSettings();

  // Show FAQ screen
  screen.style.display = 'block';

  // Populate categories
  showFAQCategories();
};

window.closeFAQ = function() {
  const screen = document.getElementById('faq-screen');
  if (screen) {
    screen.style.display = 'none';
  }
};

window.showFAQCategories = function() {
  const categoriesContainer = document.getElementById('faq-categories');
  const questionsContainer = document.getElementById('faq-questions');

  if (!categoriesContainer || !questionsContainer) return;

  // Show categories, hide questions
  categoriesContainer.style.display = 'block';
  questionsContainer.style.display = 'none';

  // Populate category cards
  categoriesContainer.innerHTML = FAQ_DATA.map((cat, index) => `
    <div class="faq-category-card" onclick="window.showFAQCategory(${index})">
      <div class="faq-category-icon">${cat.icon}</div>
      <div class="faq-category-info">
        <div class="faq-category-name">${cat.category}</div>
        <div class="faq-category-count">${cat.questions.length} question${cat.questions.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="faq-category-arrow">→</div>
    </div>
  `).join('');
};

window.showFAQCategory = function(categoryIndex) {
  const categoriesContainer = document.getElementById('faq-categories');
  const questionsContainer = document.getElementById('faq-questions');
  const titleEl = document.getElementById('faq-category-title');
  const listEl = document.getElementById('faq-question-list');

  if (!categoriesContainer || !questionsContainer || !titleEl || !listEl) return;

  const category = FAQ_DATA[categoryIndex];
  if (!category) return;

  // Hide categories, show questions
  categoriesContainer.style.display = 'none';
  questionsContainer.style.display = 'block';

  // Set title
  titleEl.textContent = `${category.icon} ${category.category}`;

  // Populate questions
  listEl.innerHTML = category.questions.map((qa, index) => `
    <div class="faq-question-item" id="faq-q-${categoryIndex}-${index}">
      <div class="faq-question-header" onclick="window.toggleFAQQuestion(${categoryIndex}, ${index})">
        <div class="faq-question-text">${qa.q}</div>
        <div class="faq-question-toggle">▼</div>
      </div>
      <div class="faq-answer">
        <div class="faq-answer-content">${qa.a}</div>
      </div>
    </div>
  `).join('');
};

window.toggleFAQQuestion = function(categoryIndex, questionIndex) {
  const item = document.getElementById(`faq-q-${categoryIndex}-${questionIndex}`);
  if (!item) return;

  // Toggle open state
  item.classList.toggle('open');
};

window.sendFeedback = async function(event) {
  event.preventDefault();

  const type = document.getElementById('feedback-type').value;
  const name = document.getElementById('feedback-name').value;
  const email = document.getElementById('feedback-email').value;
  const message = document.getElementById('feedback-message').value;
  const submitBtn = document.getElementById('feedback-submit');
  const statusEl = document.getElementById('feedback-status');

  // Disable button while sending
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';
  statusEl.style.display = 'none';

  try {
    const result = await analytics.submitFeedbackToSupabase(type, name, email, message);

    if (result.success) {
      statusEl.textContent = 'Thank you! Your feedback has been sent.';
      statusEl.style.color = '#4ade80';
      statusEl.style.display = 'block';

      // Close after delay
      setTimeout(() => {
        window.closeFeedback();
      }, 2000);
    } else {
      // Supabase failed - offer email fallback
      throw new Error('service_unavailable');
    }
  } catch (error) {
    console.error('Feedback error:', error);

    // Offer email fallback
    const subject = encodeURIComponent(`[Curling Pro ${type === 'bug' ? 'Bug Report' : 'Feature Request'}]`);
    const body = encodeURIComponent(`${message}\n\n---\nFrom: ${name || 'Anonymous'}\nEmail: ${email || 'Not provided'}`);
    const mailtoLink = `mailto:feedback@curlingpro.app?subject=${subject}&body=${body}`;

    statusEl.innerHTML = `
      Unable to send automatically.<br>
      <a href="${mailtoLink}" style="color: #60a5fa; text-decoration: underline;">Tap here to send via email</a>
    `;
    statusEl.style.color = '#fcd34d';
    statusEl.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send';
  }
};

// Check if the losing team is mathematically eliminated
// This considers stones out of play - if the deficit > max possible score, game over
function checkMathematicalElimination() {
  // Only check in the last end
  if (gameState.end !== gameState.settings.gameLength) {
    return false;
  }

  // Determine the losing team
  const redScore = gameState.scores.red;
  const yellowScore = gameState.scores.yellow;

  if (redScore === yellowScore) {
    return false;  // Tied, no elimination
  }

  const losingTeam = redScore < yellowScore ? 'red' : 'yellow';
  const deficit = Math.abs(redScore - yellowScore);

  // Count losing team's stones that are out of play
  const losingTeamStonesOut = gameState.stones.filter(
    s => s.team === losingTeam && s.outOfPlay
  ).length;

  // Maximum possible score = 8 minus stones out of play
  const maxPossibleScore = 8 - losingTeamStonesOut;

  // If deficit > max possible score, losing team cannot win
  if (deficit > maxPossibleScore) {
    console.log(`[MERCY] ${losingTeam} team eliminated: deficit=${deficit}, stonesOut=${losingTeamStonesOut}, maxScore=${maxPossibleScore}`);
    return true;
  }

  return false;
}

function startNewEnd() {
  // Safety: ensure score overlay is fully hidden
  const scoreOverlay = document.getElementById('score-overlay');
  if (scoreOverlay) {
    scoreOverlay.classList.remove('visible');
    scoreOverlay.style.display = 'none';
  }

  // Clear stones
  for (const stone of gameState.stones) {
    scene.remove(stone.mesh);
    Matter.Composite.remove(world, stone.body);
  }
  gameState.stones = [];
  gameState.stonesThrown = { red: 0, yellow: 0 };
  resetOutOfPlayStones();  // Reset the out-of-play position counter
  updateStoneCountDisplay();
  gameState.end++;

  // Team without hammer throws first (hammer throws last)
  gameState.currentTeam = gameState.hammer === 'red' ? 'yellow' : 'red';

  if (gameState.end > gameState.settings.gameLength) {
    // Game over
    showGameOverOverlay();
    return;
  }

  // Check if it's mathematically impossible for the losing team to catch up
  // Max points per end = 8 (all 8 stones counting)
  const remainingEnds = gameState.settings.gameLength - gameState.end + 1;
  const maxPossiblePoints = remainingEnds * 8;
  const scoreDifference = Math.abs(gameState.scores.red - gameState.scores.yellow);

  if (scoreDifference > maxPossiblePoints) {
    // Game over - impossible to catch up
    console.log(`[MERCY] Game ending early - score difference ${scoreDifference} > max possible ${maxPossiblePoints}`);
    showGameOverOverlay();
    return;
  }

  // Additional mercy check for last end - account for stones out of play
  if (checkMathematicalElimination()) {
    console.log(`[MERCY] Losing team mathematically eliminated in last end`);
    showGameOverOverlay();
    return;
  }

  gameState.phase = 'aiming';

  // Check if it's computer's turn first (for camera view)
  const isComputer = gameState.gameMode === '1player' && gameState.currentTeam === gameState.computerTeam;

  // Set camera view - target view for player, thrower view for computer
  if (isComputer) {
    gameState.previewHeight = 0;  // Thrower view for computer
    gameState.previewLocked = false;
  } else {
    gameState.previewHeight = 1;  // Target view for player
    gameState.previewLocked = true;
  }
  gameState.targetViewZoom = 1;  // Reset pinch-to-zoom at start of each end

  clearTargetMarker();  // Remove target marker
  setCurlButtonsEnabled(true);  // Re-enable curl buttons for new end
  updatePreviewStoneForTeam();  // Update preview stone for current team

  // Save progress at start of new end (so resume works correctly)
  saveMatchProgress();
  let turnText;
  const totalEnds = gameState.settings.gameLength;

  if (gameState.selectedMode === 'online') {
    // Multiplayer - use player names
    const localTeam = multiplayer.multiplayerState.localPlayer.team;
    const isMyTurn = gameState.currentTeam === localTeam;
    const localName = multiplayer.multiplayerState.localPlayer.name || 'You';
    const remoteName = multiplayer.multiplayerState.remotePlayer.name || 'Opponent';

    if (isMyTurn) {
      turnText = `End ${gameState.end}/${totalEnds} - ${localName}'s Turn`;
    } else {
      turnText = `End ${gameState.end}/${totalEnds} - ${remoteName}'s Turn`;
    }
  } else {
    const teamName = gameState.currentTeam.charAt(0).toUpperCase() + gameState.currentTeam.slice(1);
    turnText = `End ${gameState.end}/${totalEnds} - ${teamName}'s\u00A0Turn${isComputer ? ' (Computer)' : ''}`;
  }
  document.getElementById('turn').textContent = turnText;

  // Trigger computer turn if applicable, or restore player's curl preference
  if (isComputer) {
    console.log('[COMPUTER] Scheduling computer turn in startNextEnd()...');
    scheduleComputerShot();
  } else {
    // Restore player's preferred curl direction
    gameState.curlDirection = gameState.playerCurlDirection;
    updateCurlDisplay();
    updateSkipSignalArm();
    updatePreviewStoneRotation();
  }

  // Force update button visibility after state changes
  updateReturnButton();
  updateMarkerHint();
  updateFastForwardButton();  // Show FFW button immediately when CPU throws first
}

function updateScoreDisplay() {
  // Update totals
  const redTotal = document.getElementById('red-total');
  const yellowTotal = document.getElementById('yellow-total');
  if (redTotal) redTotal.textContent = gameState.scores.red;
  if (yellowTotal) yellowTotal.textContent = gameState.scores.yellow;

  // Update end-by-end scores (support up to 10 ends)
  const maxEnds = Math.max(gameState.settings.gameLength, 10);
  for (let i = 0; i < maxEnds; i++) {
    const redCell = document.getElementById(`red-end-${i + 1}`);
    const yellowCell = document.getElementById(`yellow-end-${i + 1}`);

    if (redCell) {
      const score = gameState.endScores.red[i];
      redCell.textContent = score !== null ? score : '';
      redCell.className = '';
      if (score !== null && score > 0) {
        redCell.classList.add('scored', 'scored-red');
      }
      // Highlight current end
      if (i === gameState.end - 1 && score === null) {
        redCell.classList.add('current-end');
      }
    }

    if (yellowCell) {
      const score = gameState.endScores.yellow[i];
      yellowCell.textContent = score !== null ? score : '';
      yellowCell.className = '';
      if (score !== null && score > 0) {
        yellowCell.classList.add('scored', 'scored-yellow');
      }
      // Highlight current end
      if (i === gameState.end - 1 && score === null) {
        yellowCell.classList.add('current-end');
      }
    }
  }

  // Update hammer indicator
  const redHammer = document.getElementById('red-hammer');
  const yellowHammer = document.getElementById('yellow-hammer');
  if (redHammer) {
    redHammer.innerHTML = gameState.hammer === 'red' ? '<span class="hammer-indicator">●</span>' : '';
  }
  if (yellowHammer) {
    yellowHammer.innerHTML = gameState.hammer === 'yellow' ? '<span class="hammer-indicator">●</span>' : '';
  }
}

// Configure scoreboard to show correct number of end columns
function updateScoreboardForGameLength() {
  const gameLength = gameState.settings.gameLength;

  // Show/hide columns for ends 1-10
  for (let i = 1; i <= 10; i++) {
    const headerCell = document.getElementById(`header-end-${i}`);
    const redCell = document.getElementById(`red-end-${i}`);
    const yellowCell = document.getElementById(`yellow-end-${i}`);

    const shouldShow = i <= gameLength;
    const display = shouldShow ? '' : 'none';

    if (headerCell) headerCell.style.display = display;
    if (redCell) redCell.style.display = display;
    if (yellowCell) yellowCell.style.display = display;
  }

  console.log(`[Scoreboard] Configured for ${gameLength} ends`);
}

function updateStoneCountDisplay() {
  const redContainer = document.getElementById('red-stone-icons');
  const yellowContainer = document.getElementById('yellow-stone-icons');

  if (!redContainer || !yellowContainer) return;

  const redRemaining = 8 - gameState.stonesThrown.red;
  const yellowRemaining = 8 - gameState.stonesThrown.yellow;

  const redThrown = gameState.stonesThrown.red;
  const yellowThrown = gameState.stonesThrown.yellow;

  // Create stone icons for red (thrown stones dimmed on left, remaining on right)
  redContainer.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const isRemaining = i >= redThrown;
    const stone = document.createElement('div');
    stone.style.cssText = `
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: ${isRemaining ? '#dc2626' : '#4a1515'};
      border: 1px solid ${isRemaining ? '#fee' : '#333'};
      transition: all 0.3s;
    `;
    redContainer.appendChild(stone);
  }

  // Create stone icons for yellow (thrown stones dimmed on left, remaining on right)
  yellowContainer.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const isRemaining = i >= yellowThrown;
    const stone = document.createElement('div');
    stone.style.cssText = `
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: ${isRemaining ? '#fbbf24' : '#4a4015'};
      border: 1px solid ${isRemaining ? '#ffe' : '#333'};
      transition: all 0.3s;
    `;
    yellowContainer.appendChild(stone);
  }
}

// ============================================
// INPUT HANDLERS
// ============================================
renderer.domElement.addEventListener('mousedown', (e) => {
  // Block input during opponent's turn in multiplayer
  if (isInputBlocked()) return;

  if (gameState.phase === 'aiming') {
    // If in preview mode (camera raised), handle marker placement
    if (gameState.previewHeight > 0.3) {
      // Try to place target marker on the ice
      const markerPlaced = placeTargetMarker(e.clientX, e.clientY);
      if (markerPlaced) {
        // Marker placed - stay in preview so user can see it and adjust if needed
        return;
      }
      return;  // Don't start throw while in raised preview mode
    }
    startPull(e.clientX, e.clientY);
  } else if (gameState.phase === 'sliding') {
    releaseStone();
  }
});

// Double click to toggle between throwing view and target view
renderer.domElement.addEventListener('dblclick', (e) => {
  if (gameState.phase === 'aiming') {
    if (gameState.previewLocked) {
      // In target view (locked) - unlock to allow repositioning
      gameState.previewLocked = false;
      updateReturnButton();
      updateMarkerHint();
      // Update last mouse position to prevent sudden jump
      gameState.lastMousePos = { x: e.clientX, y: e.clientY };
    } else if (gameState.previewHeight < 0.5) {
      // In throwing view - switch to target view
      gameState.previewHeight = 1;
      gameState.previewLocked = true;
      updateReturnButton();
      updateMarkerHint();
    }
  }
});

renderer.domElement.addEventListener('mousemove', (e) => {
  updatePull(e.clientX, e.clientY);
  updateSlidingAim(e.clientX);  // Allow aiming during slide
  updatePreviewCamera(e.clientX, e.clientY);  // Preview camera during aiming
  updateSweepFromMovement(e.clientX, e.clientY);  // Sweeping via mouse drag
  dragTargetMarker(e.clientX, e.clientY);  // Drag target marker in target view
});

renderer.domElement.addEventListener('mouseup', () => {
  if (gameState.phase === 'charging') {
    pushOff();
  }
});

renderer.domElement.addEventListener('mouseleave', () => {
  if (gameState.phase === 'charging') {
    pushOff();
  }
});

// Curl direction and sweeping
document.addEventListener('keydown', (e) => {
  // Practice mode: R key for quick reset
  if (e.code === 'KeyR' && gameState.practiceMode.active) {
    e.preventDefault();
    window.practiceQuickReset();
    return;
  }

  // Curl direction - A/Left for out-turn, D/Right for in-turn
  if (gameState.phase === 'aiming' || gameState.phase === 'charging') {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
      setCurlDirection(-1); // Counter-clockwise / out-turn
    } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
      setCurlDirection(1); // Clockwise / in-turn
    }
  }

});


// Touch support
let touchStartedInAiming = false;
let lastTapTime = 0;
let lastTapPos = { x: 0, y: 0 };

// Pinch-to-zoom for target view
let pinchStartDistance = 0;
let pinchStartZoom = 1;
let isPinching = false;

function getPinchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

renderer.domElement.addEventListener('touchstart', (e) => {
  e.preventDefault();

  // Blur any focused input (dismiss keyboard) when touching the game canvas
  window.blurAllInputs();

  // Block input during opponent's turn in multiplayer
  if (isInputBlocked()) return;

  // Pinch-to-zoom detection for target view (two-finger touch)
  if (e.touches.length === 2 && gameState.phase === 'aiming' && gameState.previewHeight > 0.5) {
    isPinching = true;
    pinchStartDistance = getPinchDistance(e.touches);
    pinchStartZoom = gameState.targetViewZoom;
    return;  // Don't process as single touch
  }

  const touch = e.touches[0];
  const now = Date.now();

  // Double-tap detection for view switching (mobile equivalent of mouse dragging / double-click)
  // Check in both 'aiming' and 'charging' phases (first tap of double-tap may have started charging)
  if (gameState.phase === 'aiming' || gameState.phase === 'charging') {
    const timeSinceLastTap = now - lastTapTime;
    const distFromLastTap = Math.sqrt(
      Math.pow(touch.clientX - lastTapPos.x, 2) +
      Math.pow(touch.clientY - lastTapPos.y, 2)
    );

    // If double-tap detected (within 300ms and 50px)
    if (timeSinceLastTap < 300 && distFromLastTap < 50) {
      // Cancel any charging that started from first tap
      if (gameState.phase === 'charging') {
        gameState.phase = 'aiming';
        touchStartedInAiming = false;
        // Reset curl display position
        const curlDisplay = document.getElementById('curl-display');
        if (curlDisplay) curlDisplay.style.top = 'max(20px, env(safe-area-inset-top))';
        document.getElementById('power-display').style.display = 'none';
      }

      if (gameState.previewLocked) {
        // Already in target view - unlock for repositioning
        gameState.previewLocked = false;
        updateReturnButton();
        updateMarkerHint();
        gameState.lastMousePos = { x: touch.clientX, y: touch.clientY };
      } else if (gameState.previewHeight < 0.5) {
        // In throwing view - switch to target view
        gameState.previewHeight = 1;
        gameState.previewLocked = true;
        updateReturnButton();
        updateMarkerHint();
      }
      lastTapTime = 0;  // Reset to prevent triple-tap triggering
      return;
    }
  }

  // Track this tap for double-tap detection
  lastTapTime = now;
  lastTapPos = { x: touch.clientX, y: touch.clientY };

  if (gameState.phase === 'aiming') {
    // If in preview mode (camera raised), handle marker placement
    if (gameState.previewHeight > 0.3) {
      // Try to place target marker on the ice
      const markerPlaced = placeTargetMarker(touch.clientX, touch.clientY);
      if (markerPlaced) {
        // Marker placed - stay in preview so user can see it
        return;
      }
      return;  // Don't start throw while in raised preview mode
    }
    touchStartedInAiming = true;
    startPull(touch.clientX, touch.clientY);
  } else if (gameState.phase === 'sliding') {
    releaseStone();
  }
});

renderer.domElement.addEventListener('touchmove', (e) => {
  e.preventDefault();

  // Handle pinch-to-zoom in target view
  if (isPinching && e.touches.length === 2) {
    const currentDistance = getPinchDistance(e.touches);
    const scale = currentDistance / pinchStartDistance;
    // Zoom in when pinching out, zoom out when pinching in
    // Clamp between 0.5 (zoomed out) and 2 (zoomed in for precision)
    gameState.targetViewZoom = Math.max(0.5, Math.min(2, pinchStartZoom * scale));
    return;  // Don't process other touch actions while pinching
  }

  const touch = e.touches[0];
  updatePull(touch.clientX, touch.clientY);
  updateSlidingAim(touch.clientX);  // Allow aiming during slide
  updatePreviewCamera(touch.clientX, touch.clientY);  // Preview camera during aiming
  updateSweepFromMovement(touch.clientX, touch.clientY);  // Sweeping via touch drag
  dragTargetMarker(touch.clientX, touch.clientY);  // Drag target marker in target view
});

renderer.domElement.addEventListener('touchend', (e) => {
  e.preventDefault();

  // End pinch gesture
  if (isPinching) {
    isPinching = false;
    return;
  }

  if (gameState.phase === 'charging' && touchStartedInAiming) {
    pushOff();
    touchStartedInAiming = false;
  }
});

// Get correct viewport dimensions (handles iOS keyboard bug)
function getViewportSize() {
  // Use visualViewport if available (more reliable on iOS)
  if (window.visualViewport) {
    return {
      width: window.visualViewport.width,
      height: window.visualViewport.height
    };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
}

// Update renderer size
function updateRendererSize() {
  const { width, height } = getViewportSize();
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

// Window resize
window.addEventListener('resize', updateRendererSize);

// Visual viewport resize (iOS keyboard handling)
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', updateRendererSize);
}

// ============================================
// APP BACKGROUNDING (iOS Lifecycle)
// ============================================
// Tracked timer helper - use this instead of raw setTimeout for gameplay timers
function setTrackedTimeout(callback, delay) {
  const id = setTimeout(() => {
    // Remove from tracked list when executed
    gameState.activeTimers = gameState.activeTimers.filter(t => t !== id);
    callback();
  }, delay);
  gameState.activeTimers.push(id);
  return id;
}

// Save pre-shot state for rollback (called before each delivery)
function savePreShotState() {
  gameState.preShotState = {
    stones: gameState.stones.map(s => ({
      team: s.team,
      position: { x: s.body.position.x, y: s.body.position.y },
      velocity: { x: 0, y: 0 },
      angle: s.body.angle,
      angularVelocity: 0
    })),
    stonesThrown: { ...gameState.stonesThrown },
    currentTeam: gameState.currentTeam,
    phase: 'aiming'
  };
}

// Save full physics state (positions + velocities) for freeze/resume
function savePhysicsState() {
  return gameState.stones.map(s => ({
    team: s.team,
    position: { x: s.body.position.x, y: s.body.position.y },
    velocity: { x: s.body.velocity.x, y: s.body.velocity.y },
    angle: s.body.angle,
    angularVelocity: s.body.angularVelocity
  }));
}

// Restore physics state from saved snapshot
function restorePhysicsState(savedStones) {
  for (let i = 0; i < gameState.stones.length && i < savedStones.length; i++) {
    const stone = gameState.stones[i];
    const saved = savedStones[i];
    Matter.Body.setPosition(stone.body, saved.position);
    Matter.Body.setVelocity(stone.body, saved.velocity);
    Matter.Body.setAngle(stone.body, saved.angle);
    Matter.Body.setAngularVelocity(stone.body, saved.angularVelocity);
  }
}

function showPauseOverlay(message = '') {
  const overlay = document.getElementById('pause-overlay');
  const messageEl = document.getElementById('pause-message');
  if (overlay) {
    if (messageEl) messageEl.textContent = message;
    overlay.style.display = 'flex';
  }
}

function hidePauseOverlay() {
  const overlay = document.getElementById('pause-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

function pauseGame() {
  if (gameState.isPaused) return;

  // Don't pause if we're in menus/setup
  const activePhases = ['aiming', 'charging', 'sliding', 'throwing', 'sweeping', 'waiting'];
  if (!activePhases.includes(gameState.phase)) return;

  console.log('[PAUSE] App interrupted - pausing game');
  gameState.isPaused = true;
  gameState.pausedPhase = gameState.phase;

  // Stop all audio immediately
  soundManager.stopAllSounds();

  // Clear computer shot timer
  if (gameState._computerShotTimeout) {
    clearTimeout(gameState._computerShotTimeout);
    gameState._computerShotTimeout = null;
  }

  // Clear all tracked gameplay timers
  for (const timerId of gameState.activeTimers) {
    clearTimeout(timerId);
  }
  gameState.activeTimers = [];

  // Check if a stone is in motion
  const hasMovingStone = gameState.stones.some(s => {
    const speed = Math.sqrt(s.body.velocity.x ** 2 + s.body.velocity.y ** 2);
    return speed > 0.5;  // Meaningful motion threshold
  });

  // Save full physics state for freeze/resume
  gameState.savedPhysicsState = savePhysicsState();
  gameState.pausedWithMovingStone = hasMovingStone;

  // Save state to localStorage for crash recovery
  try {
    const saveState = {
      phase: gameState.phase,
      currentTeam: gameState.currentTeam,
      end: gameState.end,
      scores: gameState.scores,
      endScores: gameState.endScores,
      hammer: gameState.hammer,
      stonesThrown: gameState.stonesThrown,
      gameMode: gameState.gameMode,
      computerTeam: gameState.computerTeam,
      stones: gameState.savedPhysicsState,
      hadMovingStone: hasMovingStone
    };
    localStorage.setItem('curlingpro_pausestate', JSON.stringify(saveState));
  } catch (e) {
    console.warn('Could not save pause state:', e);
  }

  // Show pause overlay
  showPauseOverlay(hasMovingStone ? 'Shot in progress' : '');
}

// Legacy function - visibility now handled by updateScoreboardVisibility
function updateGameButtons(showSave = false) {
  // No-op: button visibility is now managed by updateScoreboardVisibility
}

// Manual pause (user pressed pause button)
let manualPauseGuard = false;
window.manualPause = function() {
  // Guard against double-firing from touch + click
  if (manualPauseGuard) return;
  manualPauseGuard = true;
  setTimeout(() => { manualPauseGuard = false; }, 300);

  // Don't pause if already paused
  if (gameState.isPaused) return;

  // Don't pause during menus or setup
  const activePhases = ['aiming', 'charging', 'sliding', 'throwing', 'sweeping', 'waiting'];
  if (!activePhases.includes(gameState.phase)) return;

  // Don't pause in multiplayer (opponent would wait)
  if (gameState.selectedMode === 'online') {
    console.log('[Pause] Manual pause disabled in multiplayer');
    return;
  }

  console.log('[PAUSE] Manual pause triggered');
  pauseGame();
};

// Called when user taps to resume (from pause overlay)
window.resumeFromPause = function() {
  if (!gameState.isPaused) {
    hidePauseOverlay();
    return;
  }

  console.log('[RESUME] User tapped to continue');

  // Restore physics state exactly as it was
  if (gameState.savedPhysicsState) {
    restorePhysicsState(gameState.savedPhysicsState);
    gameState.savedPhysicsState = null;
  }

  // Hide overlay first
  hidePauseOverlay();

  // Resume game state
  gameState.isPaused = false;

  // If there was a moving stone, physics will continue from frozen state
  if (gameState.pausedWithMovingStone) {
    gameState.pausedWithMovingStone = false;
    // Restart sliding sound if stone is still moving
    const stillMoving = gameState.stones.some(s => {
      const speed = Math.sqrt(s.body.velocity.x ** 2 + s.body.velocity.y ** 2);
      return speed > 0.5;
    });
    if (stillMoving && gameState.activeStone) {
      soundManager.startSliding();
    }
  }

  // Re-trigger computer turn if it was the computer's turn in aiming phase
  if (gameState.phase === 'aiming' &&
      gameState.gameMode === '1player' &&
      gameState.currentTeam === gameState.computerTeam) {
    scheduleComputerShot();
  }

  // Clear saved pause state
  try {
    localStorage.removeItem('curlingpro_pausestate');
  } catch (e) {
    // Ignore
  }
};

// Internal resume (for focus events where overlay isn't shown)
function resumeGameInternal() {
  // If pause overlay is visible, wait for user tap
  const overlay = document.getElementById('pause-overlay');
  if (overlay && overlay.style.display === 'flex') {
    return;  // User must tap to continue
  }

  if (gameState.isPaused) {
    window.resumeFromPause();
  }
}

// Visibility change handler (works on iOS Safari)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseGame();
  }
  // On visible: don't auto-resume, wait for user tap on overlay
});

// Settings button in pause overlay - needs special handling to prevent resume
const pauseSettingsBtn = document.getElementById('pause-settings-btn');
if (pauseSettingsBtn) {
  pauseSettingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    window.openSettings();
  });
  pauseSettingsBtn.addEventListener('touchstart', (e) => {
    e.stopPropagation();
  });
  pauseSettingsBtn.addEventListener('touchend', (e) => {
    e.stopPropagation();
    e.preventDefault();
    window.openSettings();
  });
}

// Page hide/show (additional iOS support)
window.addEventListener('pagehide', () => {
  pauseGame();
});

window.addEventListener('pageshow', (event) => {
  // If page was restored from bfcache, overlay should still be visible
  // User will tap to resume
  if (event.persisted && !gameState.isPaused) {
    // Edge case: page restored but game wasn't paused
    // This shouldn't happen, but handle gracefully
  }
});

// Blur/focus for when app loses focus but isn't hidden
window.addEventListener('blur', () => {
  // Only pause if we're in active gameplay
  if (gameState.phase === 'sweeping' || gameState.phase === 'sliding' || gameState.phase === 'throwing') {
    pauseGame();
  }
});

window.addEventListener('focus', () => {
  // Don't auto-resume - user taps the overlay
});

// ============================================
// GAME LOOP
// ============================================
function animate() {
  requestAnimationFrame(animate);

  try {
  // Frame-rate independent physics timing
  const now = performance.now();
  if (lastPhysicsTime === 0) {
    lastPhysicsTime = now;
  }
  const deltaTime = now - lastPhysicsTime;
  lastPhysicsTime = now;

  // Accumulate time and run physics in fixed steps
  physicsAccumulator += deltaTime;

  // Cap accumulated time to prevent spiral of death on slow frames
  const maxAccumulator = PHYSICS_TIMESTEP * MAX_PHYSICS_STEPS;
  if (physicsAccumulator > maxAccumulator) {
    physicsAccumulator = maxAccumulator;
  }

  // Run physics in fixed time steps
  while (physicsAccumulator >= PHYSICS_TIMESTEP) {
    updatePhysics();
    physicsAccumulator -= PHYSICS_TIMESTEP;
  }

  // Camera updates
  if (cameraAnimation) {
    cameraAnimation.update();
  } else if (gameState.phase === 'aiming') {
    updatePreviewCamera(undefined, undefined, false);  // Continue smooth camera interpolation
    updateReturnButton();  // Update button visibility as camera moves
    updateMarkerHint();    // Update hint visibility as camera moves
    updatePracticeResetButton();  // Update reset button state in practice mode
    // Update coach target marker animation (learn mode)
    if (gameState.learnMode.enabled && gameState.coachTargetMarker) {
      updateCoachTargetMarker();
    }
  } else {
    updateCameraFollow();  // Follow stone during sliding/throwing phase
  }

  // Update scoreboard visibility based on phase (show during non-aiming phases)
  updateScoreboardVisibility();

  // Update preview stone visibility based on phase and camera height
  updatePreviewStoneVisibility();

  // Fade skip when stones pass nearby
  updateSkipFade();

  // Update scoring indicators on stones (show which are counting)
  if (gameState.stones.length > 0 && gameState.setupComplete) {
    updateScoringIndicators();
  }

  renderer.render(scene, camera);
  } catch (err) {
    // Send diagnostic info to analytics but DON'T crash - just skip this frame
    analytics.trackError('animate_error', `${err.name}: ${err.message}`, {
      phase: gameState.phase,
      ffw: gameState.cpuFastForward,
      camAnim: !!cameraAnimation,
      end: gameState.currentEnd
    });
    // Don't re-throw - gracefully continue
  }
}

// ============================================
// DEBUG/TESTING FUNCTIONS
// ============================================

// Debug: Set up a match in the last end for testing end-of-match scenarios
// Usage: In browser console, call: debugLastEnd() or debugLastEnd(5, 4) for custom scores
window.debugLastEnd = function(playerScore = 5, opponentScore = 4) {

  // Set up career mode
  gameState.selectedMode = 'career';
  gameState.gameMode = '1player';
  gameState.computerTeam = 'yellow';

  // Set to last end
  const totalEnds = gameState.settings.gameLength || 8;
  gameState.end = totalEnds;

  // Set scores
  gameState.scores = { red: playerScore, yellow: opponentScore };

  // Set up end scores history - format is { red: [...], yellow: [...] }
  gameState.endScores = { red: [], yellow: [] };
  for (let i = 0; i < totalEnds; i++) {
    gameState.endScores.red.push(null);
    gameState.endScores.yellow.push(null);
  }

  // Fill in previous ends with scores that add up correctly
  let redRemaining = playerScore;
  let yellowRemaining = opponentScore;
  for (let i = 0; i < totalEnds - 1; i++) {
    if (i % 2 === 0 && redRemaining > 0) {
      const pts = Math.min(2, redRemaining);
      gameState.endScores.red[i] = pts;
      gameState.endScores.yellow[i] = 0;
      redRemaining -= pts;
    } else if (yellowRemaining > 0) {
      const pts = Math.min(2, yellowRemaining);
      gameState.endScores.red[i] = 0;
      gameState.endScores.yellow[i] = pts;
      yellowRemaining -= pts;
    } else if (redRemaining > 0) {
      const pts = Math.min(2, redRemaining);
      gameState.endScores.red[i] = pts;
      gameState.endScores.yellow[i] = 0;
      redRemaining -= pts;
    } else {
      gameState.endScores.red[i] = 0;
      gameState.endScores.yellow[i] = 0;
    }
  }

  // Reset stones for this end
  gameState.stonesThrown = { red: 0, yellow: 0 };
  gameState.currentTeam = 'red';
  gameState.hammer = playerScore <= opponentScore ? 'red' : 'yellow';

  // Clear any existing stones
  gameState.stones.forEach(stone => {
    if (stone.mesh) scene.remove(stone.mesh);
    if (stone.body) Matter.World.remove(engine.world, stone.body);
  });
  gameState.stones = [];

  // Start the game
  gameState.setupComplete = true;
  gameState.phase = 'aiming';

  // Update UI
  updateScoreDisplay();
  updateScoreboardFlags();
  updateStoneCountDisplay();
  updatePreviewStoneForTeam();

  // Update turn display
  document.getElementById('turn').textContent = `End ${totalEnds}/${totalEnds} - Your Turn`;

  // Hide mode selection, show game
  document.getElementById('mode-select-screen').style.display = 'none';
  hideModeSelectFooter();
  const canvas = document.getElementById('game-canvas');
  if (canvas) canvas.style.display = 'block';

};

// Debug: Skip to end of current end (all stones thrown)
window.debugEndOfEnd = function() {
  gameState.stonesThrown = { red: 8, yellow: 8 };
  gameState.phase = 'scoring';
  calculateScore();
};

// Debug: Simulate winning current match
window.debugWinMatch = function() {
  gameState.scores.red = 10;
  gameState.scores.yellow = 2;
  gameState.end = gameState.settings.gameLength || 8;
  gameState.stonesThrown = { red: 8, yellow: 8 };
  calculateScore();
};

// Debug button removed for production

// ============================================
// CPU FAST FORWARD BUTTON
// ============================================

// Set up fast-forward button event listeners
(function setupFastForwardButton() {
  const btn = document.getElementById('cpu-fastforward-btn');
  if (!btn) return;

  const startFastForward = (e) => {
    e.preventDefault();
    gameState.cpuFastForward = true;
    btn.style.background = 'rgba(34, 197, 94, 0.9)';
    btn.style.borderColor = '#4ade80';
    btn.style.transform = 'scale(1.1)';
  };

  const stopFastForward = (e) => {
    e.preventDefault();
    gameState.cpuFastForward = false;
    btn.style.background = 'rgba(59, 130, 246, 0.8)';
    btn.style.borderColor = '#60a5fa';
    btn.style.transform = 'scale(1)';
  };

  // Mouse events
  btn.addEventListener('mousedown', startFastForward);
  btn.addEventListener('mouseup', stopFastForward);
  btn.addEventListener('mouseleave', stopFastForward);

  // Touch events
  btn.addEventListener('touchstart', startFastForward, { passive: false });
  btn.addEventListener('touchend', stopFastForward, { passive: false });
  btn.addEventListener('touchcancel', stopFastForward, { passive: false });
})();

// Update fast-forward button visibility - available for all modes except online
function updateFastForwardButton() {
  const btn = document.getElementById('cpu-fastforward-btn');
  if (!btn) return;

  // Never show in Skip practice mode (player is just making strategic calls)
  if (gameState.practiceMode?.currentDrill === 'skip') {
    btn.style.display = 'none';
    return;
  }

  // Show during stone movement phases, except in online mode
  const isStoneMoving = (gameState.phase === 'throwing' || gameState.phase === 'sweeping') &&
                        gameState.selectedMode !== 'online' &&
                        gameState.setupComplete;

  // Also show during CPU turn phases (aiming, charging, sliding)
  const isCpuTurnPhase = gameState.gameMode === '1player' &&
                         gameState.currentTeam === gameState.computerTeam &&
                         gameState.selectedMode !== 'online' &&
                         gameState.setupComplete &&
                         (gameState.phase === 'aiming' || gameState.phase === 'charging' || gameState.phase === 'sliding');

  const shouldShow = isStoneMoving || isCpuTurnPhase;
  btn.style.display = shouldShow ? 'block' : 'none';

  // Reset state when hiding
  if (!shouldShow) {
    gameState.cpuFastForward = false;
  }
}

// ============================================
// INITIALIZE
// ============================================
updateLoadingProgress(50, 'Building ice sheet...');
createSheet();
updateLoadingProgress(60, 'Building arena...');
loadCareer();  // Load saved career progress first to know the level
loadTutorialPrefs();  // Load tutorial preferences
updateArenaForLevel();  // Create arena based on career level
updateLoadingProgress(70, 'Setting up UI...');
updateStoneCountDisplay();  // Initialize stone count display
updateScoreDisplay();  // Initialize scoreboard
updateCurlDisplay();  // Initialize curl display (with pulsing buttons)

// Create initial preview stone
updateLoadingProgress(90, 'Creating preview stone...');
gameState.previewStone = createPreviewStone(gameState.currentTeam);
scene.add(gameState.previewStone);
updatePreviewStoneRotation();

// Hide splash screen and start game after minimum display time
updateLoadingProgress(100, 'Ready!');

// Inject version info immediately (before splash hides)
if (typeof __APP_VERSION__ !== 'undefined') {
  const version = __APP_VERSION__;
  const buildDate = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '';

  // Update splash screen version
  const splashVersionEl = document.getElementById('splash-version');
  if (splashVersionEl) {
    splashVersionEl.textContent = `v${version}`;
  }

  // Update about screen version
  const aboutVersionEl = document.getElementById('app-version-text');
  if (aboutVersionEl) {
    aboutVersionEl.textContent = `Curling Pro v${version}${buildDate ? ` (${buildDate})` : ''} | Made with ❤️ for curlers everywhere`;
  }
}

const splashMinTime = 2000;  // Minimum 2 seconds splash display
const loadEndTime = Date.now();
const elapsed = loadEndTime - (window.splashStartTime || loadEndTime);
const remainingTime = Math.max(0, splashMinTime - elapsed);

setTimeout(() => {
  hideSplashScreen();
  animate();
  console.log('Curling game initialized!');

  // Initialize sound on first user interaction (browser autoplay policy)
  const enableSoundOnInteraction = () => {
    if (gameState.settings.soundEnabled) {
      soundManager.setEnabled(true);
    }
    document.removeEventListener('click', enableSoundOnInteraction);
    document.removeEventListener('touchstart', enableSoundOnInteraction);
  };
  document.addEventListener('click', enableSoundOnInteraction);
  document.addEventListener('touchstart', enableSoundOnInteraction);

  // Check if first-time user needs interactive tutorial
  const tutorialsShown = getFirstRunTutorialsShown();
  const disabled = areFirstRunTutorialsDisabled();
  const needsWelcomeTutorial = !tutorialsShown['fr_welcome'];
  if (needsWelcomeTutorial && !disabled) {
    // Show interactive tutorial, then mode selection
    startInteractiveTutorial(() => showModeSelection());
  } else {
    // Go directly to mode selection
    showModeSelection();
  }
}, remainingTime);
