import * as THREE from 'three';
import Matter from 'matter-js';
import { soundManager } from './sounds.js';

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
const ICE_FRICTION = 0.0015;      // Base friction (original value)
const SWEEP_FRICTION = 0.0009;    // Reduced friction when sweeping (~40% reduction)

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
  K_CURL: 0.00015,
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
  // 0 = minimum handle (~0.6 rad/s), 100 = maximum handle (~2.0 rad/s)
  HANDLE_TO_OMEGA: (handle) => 0.6 + (handle / 100) * 1.4
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
  handleAmount: 50,  // Default to middle
  playerHandleAmount: 50,  // Remember player's preference

  // Sweeping
  isSweeping: false,
  sweepEffectiveness: 0,  // 0-1 based on swipe speed/intensity
  sweepDirection: 0,      // -1 = left bias, 0 = balanced, 1 = right bias
  sweepTouches: [],       // Track recent touch positions for speed calc
  lastSweepTime: 0,
  // Angle-based sweeping (0° = aligned with stone, 90° = perpendicular)
  sweepAngle: 0,          // Current sweep angle relative to stone velocity
  sweepAngleEffectiveness: 1, // cos(angle) - multiplier for sweep effect (1 = aligned, 0 = perpendicular)
  sweepVector: { x: 0, y: 0 }, // Normalized sweep direction vector
  activeStone: null,

  // Preview stone shown during aiming
  previewStone: null,

  // Timing (for split time display)
  tLineCrossTime: null,
  splitTime: null,

  // Physics timing instrumentation (for tuning)
  nearHogCrossTime: null,
  farHogCrossTime: null,
  stoneStopTime: null,

  // Stored slide speed for consistent velocity
  slideSpeed: 0,

  // Preview camera state
  lastMousePos: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
  previewHeight: 0,  // 0 = thrower view, 1 = max height overhead
  previewLocked: false,  // When true, panning is disabled

  // Target marker
  targetMarker: null,
  targetPosition: null,

  // Aiming line
  aimLine: null,

  // Preview stone at hack (visual only)
  previewStone: null,

  // Settings
  settings: {
    difficulty: 'medium',  // easy, medium, hard
    soundEnabled: false,
    gameLength: 8,  // number of ends
    quickPlayLevel: 4  // Default to National for quick play
  },

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
    preThrowState: null       // Snapshot of stone positions before throw
  },

  // Coach target marker (Three.js mesh)
  coachTargetMarker: null,

  // First-run tutorial state (for regular mode)
  firstRunTutorial: null,  // { id, pausesGame }
  firstRunTutorialsShownThisSession: {}  // Track tutorials shown this session (resets on refresh)
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
  // PART 1: Game Basics & Rules
  welcome: {
    id: 'welcome',
    icon: '🥌',
    title: 'Welcome to Curling!',
    text: `In curling, two teams take turns sliding stones toward a target called the "house". The goal is to get your stones closer to the center (the "button") than your opponent's stones.

Each "end" (like an inning) consists of 16 stones total - 8 per team, thrown alternately.`,
    hint: 'Your stones are RED. The computer plays YELLOW.',
    step: 1,
    total: 10
  },
  scoring: {
    id: 'scoring',
    icon: '🏆',
    title: 'How Scoring Works',
    text: `Only ONE team can score per end - the team with the stone closest to the button.

You score 1 point for each of your stones that is closer to the button than the opponent's closest stone. If your two closest stones beat their closest, you score 2 points!

Stones must be touching the house (the colored rings) to count.`,
    hint: 'The team that doesn\'t score gets the "hammer" next end.',
    step: 2,
    total: 10
  },
  hammer: {
    id: 'hammer',
    icon: '🔨',
    title: 'The Hammer',
    text: `The "hammer" is the last stone of the end - a HUGE advantage! The team with hammer throws last, so they can always respond to the opponent.

The team that scores gives up the hammer. If neither team scores (a "blank end"), the hammer stays with whoever had it.

Strategy tip: Teams with hammer often try to score 2+ points. Scoring just 1 point ("getting forced") gives the opponent hammer.`,
    hint: 'Yellow (computer) has hammer in the first end.',
    step: 3,
    total: 10
  },
  freeGuardZone: {
    id: 'freeGuardZone',
    icon: '🛡️',
    title: 'Free Guard Zone Rule',
    text: `Important rule: During the first 4 stones of each end, you CANNOT remove opponent's guards from play!

Guards are stones between the hog line and the house. If you knock out a protected guard, the stones are reset and YOUR stone is removed.

This rule encourages strategic play and prevents early aggressive takeouts.`,
    hint: 'After stone 4, all stones are fair game!',
    step: 4,
    total: 10
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
    step: 5,
    total: 10
  },

  // PART 2: Controls
  aiming: {
    id: 'aiming',
    icon: '🎯',
    title: 'Aiming Your Shot',
    text: `Drag LEFT and RIGHT to aim the stone. The green arrow shows where your stone will travel.

Your Coach (the panel on the right) suggests where to aim based on the current game situation. Look for the green target marker on the ice.`,
    hint: 'Tap when the aim arrow points toward your target.',
    step: 6,
    total: 10
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
    step: 7,
    total: 10
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
    step: 8,
    total: 10
  },
  throw: {
    id: 'throw',
    icon: '🚀',
    title: 'Releasing the Stone',
    text: `Once you've set your aim, weight, and curl, RELEASE to throw the stone!

The stone will slide down the ice following the path determined by your aim. The curl effect increases as the stone slows down near the house.`,
    hint: 'Release when you\'re happy with your weight setting.',
    step: 9,
    total: 10
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
    step: 10,
    total: 10,
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
    return false;
  }

  // Check if tutorials are disabled
  if (gameState.learnMode.tutorialsDisabled) {
    return false;
  }

  // Check if already shown
  if (gameState.learnMode.tutorialsShown[tutorialId]) {
    return false;
  }

  // Filter tutorials based on level
  const level = gameState.learnMode.level;
  const ruleTutorials = ['welcome', 'scoring', 'hammer', 'freeGuardZone', 'shotTypes'];
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
  if (!tutorial) return false;

  // Update UI
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

  // Update button text - "Next" if more tutorials, "Got it!" if last one
  const nextBtn = document.getElementById('tutorial-next-btn');
  if (nextBtn) {
    nextBtn.textContent = tutorial.step < tutorial.total ? 'Next' : 'Got it!';
  }

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
    overlay.style.display = 'block';
    if (popup) {
      popup.style.transform = 'translate(-50%, -50%)';
      popup.style.opacity = '1';
    }
  }

  // Pause physics if this tutorial requires it (e.g., sweeping tutorial)
  if (tutorial.pausesGame) {
    gameState.learnMode.tutorialPaused = true;
  }

  return true;
}

// Dismiss current tutorial with slide animation
window.dismissTutorial = function() {
  const overlay = document.getElementById('tutorial-overlay');
  const popup = document.getElementById('tutorial-popup');

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

// FGZ boundaries: between far hog line and the house (12-foot ring edge)
const FGZ_START = HOG_LINE_FAR;  // ~34.67m
const FGZ_END = TEE_LINE_FAR - RING_12FT;  // ~39.24m (tee - 12ft radius)

// State for FGZ tracking
let fgzPreThrowGuards = [];  // Guards in FGZ before each throw
let fgzThrownStone = null;   // Reference to the stone just thrown

// Check if a stone position is in the Free Guard Zone
function isInFGZ(z) {
  return z >= FGZ_START && z < FGZ_END;
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

  // Find opponent guards in the FGZ (guards that are protected)
  fgzPreThrowGuards = [];
  for (const stone of gameState.stones) {
    if (stone.team === opponentTeam && !stone.outOfPlay) {
      const z = stone.mesh.position.z;
      if (isInFGZ(z)) {
        fgzPreThrowGuards.push({
          stone: stone,
          originalX: stone.mesh.position.x,
          originalZ: z,
          bodyX: stone.body.position.x,
          bodyY: stone.body.position.y
        });
      }
    }
  }

  console.log(`[FGZ] Stone ${totalThrown + 1} of end - ${fgzPreThrowGuards.length} protected guards in FGZ`);
}

// Check for FGZ violation after stones stop
function checkFGZViolation() {
  const totalThrown = gameState.stonesThrown.red + gameState.stonesThrown.yellow;

  // FGZ only applies during stones 1-4
  if (totalThrown > 4) {
    return false;
  }

  // No guards were protected
  if (fgzPreThrowGuards.length === 0) {
    return false;
  }

  // Check if any protected guard was removed from play
  for (const guardInfo of fgzPreThrowGuards) {
    if (guardInfo.stone.outOfPlay) {
      console.log('[FGZ] VIOLATION: Protected guard was removed from play!');
      return true;
    }
  }

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

  // Update main display
  const levelDisplay = document.getElementById('career-level');
  const progressDisplay = document.getElementById('career-progress');
  const difficultyDisplay = document.getElementById('career-difficulty');

  if (levelDisplay) {
    levelDisplay.textContent = level.name;
    levelDisplay.style.color = level.color;
  }

  if (difficultyDisplay) {
    difficultyDisplay.textContent = `(${level.difficultyLabel})`;
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
    settingsDifficulty.textContent = `(${level.difficultyLabel})`;
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

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(THROWER_CAM.x, THROWER_CAM.y, THROWER_CAM.z);
camera.lookAt(THROWER_CAM.lookAt.x, THROWER_CAM.lookAt.y, THROWER_CAM.lookAt.z);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
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
  const level = gameState.gameMode === '1player'
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
  leftShadow.position.set(-SHEET_WIDTH / 2 + shadowWidth / 2, 0.005, SHEET_LENGTH / 2);
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
  rightShadow.position.set(SHEET_WIDTH / 2 - shadowWidth / 2, 0.005, SHEET_LENGTH / 2);
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

  // Curl direction: 1 = IN (clockwise) -> handle at 2:00 position
  //                -1 = OUT (counter-clockwise) -> handle at 10:00 position
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

  // Materials
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });  // Dark jacket
  const pantsMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8 });  // Dark pants
  const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xe0b090, roughness: 0.6 });  // Skin tone
  const broomMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5 });  // Dark gray handle
  const padMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });  // Bright green broom pad (unlit for visibility)
  const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });  // Bright green beacon (unlit)

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
  arrow.name = 'beacon';
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

  // Update beacon arrow direction
  if (curlArrow) {
    curlArrow.visible = true;
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

function placeTargetMarker(screenX, screenY) {
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

      // Position and show the marker (restore all parts including beacon)
      gameState.targetMarker.position.x = intersection.x;
      gameState.targetMarker.position.z = intersection.z;
      gameState.targetMarker.visible = true;
      gameState.targetMarker.traverse((child) => {
        child.visible = true;
      });
      gameState.targetPosition = { x: intersection.x, z: intersection.z };

      // Skip faces toward the thrower (hack end at z=0)
      // No rotation needed - skip is set up facing negative Z (toward thrower)
      gameState.targetMarker.rotation.y = 0;

      // Update signal arm for current curl direction
      updateSkipSignalArm();

      updateReturnButton();  // Show the return button
      updateMarkerHint();    // Hide the marker hint
      setCurlDisplayVisible(true);  // Show curl selection

      // Show curl tutorial after target is selected (Learn Mode)
      if (gameState.learnMode.enabled) {
        showTutorial('curl');
      } else {
        // First-run tutorial for regular mode
        showFirstRunTutorial('fr_curl');
      }

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

// ============================================
// AIMING LINE
// ============================================
function createAimLine() {
  // Create a thick line using a thin box geometry
  // This works better than Line which doesn't support linewidth in WebGL
  const lineWidth = 0.06;  // 6cm wide - visible on mobile
  const lineHeight = 0.02; // 2cm tall
  const lineLength = 1;    // Will be scaled dynamically

  const geometry = new THREE.BoxGeometry(lineWidth, lineHeight, lineLength);
  // Move origin to one end of the box (so it extends from 0 to length)
  geometry.translate(0, 0, lineLength / 2);

  const material = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.8
  });

  const line = new THREE.Mesh(geometry, material);
  line.position.y = 0.03;  // Slightly above ice
  line.visible = false;

  scene.add(line);
  return line;
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

  // Scale to desired length
  line.scale.z = distance;

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
  if (isMouseMove && y !== undefined && !gameState.previewLocked) {
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
  const targetHeight = minHeight + t * (maxHeight - minHeight);

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

  // Show tutorials before starting throw (Learn Mode)
  if (gameState.learnMode.enabled) {
    // Show effort and throw tutorials (curl was already shown before they could click)
    if (showTutorial('effort')) {
      return;  // Wait for user to dismiss tutorial before proceeding
    }
    if (showTutorial('throw')) {
      return;
    }
  } else {
    // First-run tutorial for regular mode
    if (showFirstRunTutorial('fr_throw')) {
      return;  // Wait for user to dismiss tutorial
    }
  }

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

  document.getElementById('power-display').style.display = 'block';
  document.getElementById('power-bar').style.display = 'block';
  document.getElementById('phase-text').style.color = '#4ade80';
  document.getElementById('phase-text').textContent = 'Pull back to set effort...';

  // Hide shot type on hard difficulty
  const isHard = gameState.settings.difficulty === 'hard';
  document.getElementById('shot-type').style.display = isHard ? 'none' : 'block';
  document.getElementById('shot-type').textContent = 'Ultra Light Guard';
  document.getElementById('shot-type').style.color = '#60a5fa';
}

// Update aim and power during drag
function updatePull(x, y) {
  if (gameState.phase !== 'charging') return;

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
    return;
  }

  hideAimLine();  // Hide aiming line on push off
  gameState.phase = 'sliding';
  setCurlButtonsEnabled(false);  // Disable curl buttons during throw
  gameState.slideStartTime = Date.now();

  // Play throw sound
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
  const isComputer = gameState.gameMode === '1player' && gameState.currentTeam === gameState.computerTeam;
  if (isComputer) {
    // Computer already set aimAngle in executeComputerShot - preserve it
    gameState.baseAimAngle = gameState.aimAngle;
  } else if (gameState.targetPosition) {
    gameState.baseAimAngle = Math.atan2(gameState.targetPosition.x, gameState.targetPosition.z - HACK_Z);
  } else {
    // Fallback for human - use existing aimAngle if set, otherwise straight
    gameState.baseAimAngle = gameState.aimAngle || 0;
  }
  gameState.aimAngle = gameState.baseAimAngle;

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

  // Show violation message briefly then next turn
  setTimeout(() => {
    nextTurn();
  }, 2000);
}

// Phase 3: Click again = release the stone (continues at same speed)
function releaseStone() {
  if (gameState.phase !== 'sliding') return;

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

  gameState.phase = 'throwing';
  document.getElementById('hold-warning').style.display = 'none';
  document.getElementById('power-display').style.display = 'none';
  document.getElementById('phase-text').style.color = '#4ade80';
  document.getElementById('phase-text').textContent = 'Released!';

  // Hide green beacon parts but keep the skip visible
  if (gameState.targetMarker) {
    gameState.targetMarker.traverse((child) => {
      if (child.name === 'beacon') {
        child.visible = false;
      }
    });
  }

  // Play release sound and start sliding sound
  soundManager.playRelease();
  soundManager.startSliding();

  // Stone continues at current velocity - NO speed change
  // Set angular velocity based on handle amount
  // More handle = more rotation (rad/s) = straighter path
  const omega = CURL_PHYSICS.HANDLE_TO_OMEGA(gameState.handleAmount);
  // Direction: positive for IN (clockwise), negative for OUT (counter-clockwise)
  Matter.Body.setAngularVelocity(gameState.activeStone.body, gameState.curlDirection * omega);

  // Now apply ice friction since thrower released
  gameState.activeStone.body.frictionAir = ICE_FRICTION;

  gameState.stonesThrown[gameState.currentTeam]++;
  updateStoneCountDisplay();

  // Camera will smoothly follow stone via updateCameraFollow()
  // Transition to sweeping phase after a brief moment
  setTimeout(() => {
    if (gameState.phase === 'throwing') {
      gameState.phase = 'sweeping';

      // Show sweeping tutorial (Learn Mode, player's throw only)
      const isPlayerThrow = gameState.activeStone && gameState.activeStone.team === 'red';
      if (gameState.learnMode.enabled && isPlayerThrow) {
        // Level 3 (Intermediate) gets advanced directional sweeping tutorial
        const tutorialId = gameState.learnMode.level === 3 ? 'sweepingAdvanced' : 'sweeping';
        showTutorial(tutorialId);
      } else if (isPlayerThrow) {
        // First-run tutorial for regular mode
        showFirstRunTutorial('fr_sweep');
      }
    }
  }, 500);
}

// Update curl from slider value (-100 to +100)
// Negative = OUT turn, Positive = IN turn
// Absolute value determines handle amount (rotation rate)
window.updateCurlSlider = function(value) {
  const sliderValue = parseInt(value);

  // Determine direction from sign
  if (sliderValue < 0) {
    gameState.curlDirection = -1;  // OUT
  } else if (sliderValue > 0) {
    gameState.curlDirection = 1;   // IN
  } else {
    // At exactly 0, keep previous direction or default to IN
    if (gameState.curlDirection === null) {
      gameState.curlDirection = 1;
    }
  }

  // Handle amount is the absolute value (0-100)
  gameState.handleAmount = Math.abs(sliderValue);

  // Remember player's preferences
  gameState.playerCurlDirection = gameState.curlDirection;
  gameState.playerHandleAmount = gameState.handleAmount;

  updateCurlDisplay();
  updateSkipSignalArm();
  updatePreviewStoneRotation();
};

// Legacy function for compatibility (used by computer shots)
function setCurlDirection(direction) {
  gameState.curlDirection = direction;
  gameState.playerCurlDirection = direction;

  // Set slider to match direction with current handle amount
  const slider = document.getElementById('curl-slider');
  if (slider) {
    const signedValue = direction * gameState.handleAmount;
    slider.value = signedValue;
  }

  updateCurlDisplay();
  updateSkipSignalArm();
  updatePreviewStoneRotation();
}

function updateCurlDisplay() {
  const handleValue = document.getElementById('handle-value');
  if (!handleValue) return;

  // Show direction and handle amount
  const direction = gameState.curlDirection === 1 ? 'IN' :
                    gameState.curlDirection === -1 ? 'OUT' : '—';
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
      curlDisplay.style.color = '#22c55e';  // Green for IN
    } else if (gameState.curlDirection === -1) {
      curlDisplay.style.color = '#3b82f6';  // Blue for OUT
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
      const direction = gameState.playerCurlDirection || 1;  // Default to IN
      const handle = gameState.playerHandleAmount || 50;     // Default to 50%
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
  // Handle learn mode specially - it's a modifier on 1player mode
  if (mode === 'learn') {
    gameState.gameMode = '1player';
    gameState.learnMode.enabled = true;
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

    // Show tutorials (only on first stone of first end, and only when settings menu is closed)
    const settingsOverlay = document.getElementById('settings-overlay');
    const menuOpen = settingsOverlay && settingsOverlay.style.display !== 'none';
    if (gameState.learnMode.enabled && gameState.end === 1 && gameState.stonesThrown.red === 0 && !menuOpen) {
      // Show rules/terminology tutorials first, then control tutorials
      // Each tutorial only shows once (tracked in tutorialsShown)
      const tutorialSequence = [
        'welcome',        // 1. Basic intro
        'scoring',        // 2. How scoring works
        'hammer',         // 3. What hammer is
        'freeGuardZone',  // 4. FGZ rule
        'shotTypes',      // 5. Types of shots
        'aiming'          // 6. How to aim
        // curl tutorial is shown after selecting target (in placeTargetMarker)
      ];

      for (const tutorialId of tutorialSequence) {
        if (showTutorial(tutorialId)) {
          break;  // Show one at a time
        }
      }
    }
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

// Return to throw view button
window.returnToThrowView = function() {
  if (gameState.phase === 'aiming' && gameState.previewLocked) {
    gameState.previewHeight = 0;  // Animate to thrower view
    updateReturnButton();
    updateMarkerHint();
  }
};

function updateReturnButton() {
  const btn = document.getElementById('return-to-throw');
  if (!btn) return;

  // Show button when locked at far view (marker optional), but NOT for computer's turn
  const isComputerTurn = gameState.gameMode === '1player' && gameState.currentTeam === gameState.computerTeam;
  if (gameState.phase === 'aiming' && gameState.previewLocked && gameState.previewHeight > 0.5 && !isComputerTurn) {
    btn.style.display = 'block';
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
  // - No marker currently placed
  // - Not computer's turn
  const isComputerTurn = gameState.gameMode === '1player' && gameState.currentTeam === gameState.computerTeam;
  const shouldShow = gameState.phase === 'aiming' &&
                     gameState.previewHeight > 0.5 &&
                     !gameState.targetMarker &&
                     !isComputerTurn;

  hint.style.display = shouldShow ? 'block' : 'none';
}

// ============================================
// SPLIT TIME DISPLAY
// ============================================
function displaySplitTime(time) {
  const splitDisplay = document.getElementById('split-time');
  if (!splitDisplay) return;

  // Determine weight category based on timing
  let category, color;
  if (time >= 4.3) {
    category = 'GUARD';
    color = '#34d399';
  } else if (time >= 3.6) {
    category = 'DRAW';
    color = '#fbbf24';
  } else if (time >= 2.9) {
    category = 'TAKEOUT';
    color = '#f97316';
  } else {
    category = 'PEEL';
    color = '#ef4444';
  }

  splitDisplay.innerHTML = `<span style="color:${color}">${time.toFixed(1)}s - ${category}</span>`;
  splitDisplay.style.display = 'block';

  // Hide after 3 seconds
  setTimeout(() => {
    splitDisplay.style.display = 'none';
  }, 3000);
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
  const isOpponentStone = gameState.gameMode === '1player' &&
                          gameState.activeStone.team === gameState.computerTeam;

  // Defensive sweeping only allowed after stone passes the T-line
  if (isOpponentStone) {
    const stoneZ = gameState.activeStone.body.position.y / PHYSICS_SCALE;
    if (stoneZ < TEE_LINE_FAR) {
      return;
    }
    // Debug: log when defensive sweep is allowed
    if (!gameState._debugDefensiveSweepLogged) {
      console.log(`[DEBUG] Defensive sweep allowed - stone at ${stoneZ.toFixed(2)}m, T-line at ${TEE_LINE_FAR}m`);
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

    // Map speed to base effectiveness (0-1)
    const baseEffectiveness = Math.min(1, speed / 1.5);

    // Calculate sweep vector (normalized direction of swipe)
    const sweepMagnitude = Math.sqrt(totalDx * totalDx + totalDy * totalDy);
    if (sweepMagnitude > 5) {
      gameState.sweepVector = {
        x: totalDx / sweepMagnitude,
        y: totalDy / sweepMagnitude
      };

      // Get stone velocity vector
      const stoneVel = gameState.activeStone.body.velocity;
      const stoneSpeed = Math.sqrt(stoneVel.x * stoneVel.x + stoneVel.y * stoneVel.y);

      if (stoneSpeed > 0.01) {
        // Normalize stone velocity
        const stoneDir = {
          x: stoneVel.x / stoneSpeed,
          y: stoneVel.y / stoneSpeed
        };

        // Calculate angle between sweep direction and stone velocity
        // Using dot product: cos(angle) = (sweep · stoneVel) / (|sweep| * |stoneVel|)
        // Since both are normalized, just dot product
        // Note: screen Y is inverted from physics Y, and we want forward sweep to match stone direction
        // Sweep up on screen (-Y in screen coords) should align with stone moving forward (+Y in physics)
        const dotProduct = gameState.sweepVector.x * stoneDir.x - gameState.sweepVector.y * stoneDir.y;

        // Angle effectiveness: |cos(angle)|
        // 0° or 180° sweep = 1.0 (aligned with or against stone motion)
        // 90° sweep = 0.0 (perpendicular)
        // We use absolute value because sweeping forward OR backward along the line is effective
        gameState.sweepAngleEffectiveness = Math.abs(dotProduct);

        // Calculate actual angle in degrees for display
        gameState.sweepAngle = Math.acos(Math.abs(dotProduct)) * (180 / Math.PI);
      }
    }

    // Final sweep effectiveness = base (speed) × angle factor
    gameState.sweepEffectiveness = baseEffectiveness * gameState.sweepAngleEffectiveness;

    const wasSweeping = gameState.isSweeping;
    gameState.isSweeping = gameState.sweepEffectiveness > 0.1;
    gameState.lastSweepTime = now;

    // Debug: log sweep detection with angle info
    if (gameState.isSweeping && !wasSweeping) {
      console.log(`[DEBUG] Sweep started - base: ${(baseEffectiveness * 100).toFixed(0)}%, angle: ${gameState.sweepAngle.toFixed(0)}°, effective: ${(gameState.sweepEffectiveness * 100).toFixed(0)}%`);
    }

    // Start/stop sweeping sound
    if (gameState.isSweeping && !wasSweeping) {
      soundManager.startSweeping();
    }

    // Calculate sweep direction bias (-1 to 1) for lateral effect
    // Positive = sweeping more to the right, Negative = sweeping more to the left
    if (totalDistance > 20) {
      const directionBias = totalDx / totalDistance;
      // Smooth the direction value
      gameState.sweepDirection = gameState.sweepDirection * 0.7 + directionBias * 0.3;
      // Clamp to -1 to 1
      gameState.sweepDirection = Math.max(-1, Math.min(1, gameState.sweepDirection));
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
  const skillFactor = 1 - level.difficulty; // Higher skill = lower difficulty value

  // Defensive sweeping: Player's stone, after T-line
  if (isPlayerStone && stoneZ >= TEE_LINE_FAR) {
    // Computer can defensively sweep player's stone to make it go too far
    // Sweep if the stone looks like it will stop in a good position
    const distanceToBack = BACK_LINE - stoneZ;
    const estimatedTravel = speed * 15; // Rough estimate of remaining distance

    // If stone will stop in the house (good for player), sweep it out
    const willStopInHouse = estimatedTravel < distanceToBack && estimatedTravel > 0.5;
    const stoneNearButton = Math.abs(stoneX) < 1.5 && stoneZ < BACK_LINE - 1;

    // Higher skill = more likely to defensively sweep at the right time
    const shouldDefensiveSweep = willStopInHouse && stoneNearButton && Math.random() < skillFactor * 0.8;

    if (shouldDefensiveSweep && speed > 0.5) {
      // Computer sweeps to push stone through
      gameState.isSweeping = true;
      gameState.sweepEffectiveness = 0.7 + Math.random() * 0.3; // 70-100%
      gameState.sweepAngleEffectiveness = 0.9; // Computer sweeps at good angle
      gameState.sweepAngle = 10;
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
      // Computer sweeps its own stone
      gameState.isSweeping = true;
      gameState.sweepEffectiveness = 0.6 + skillFactor * 0.4; // Better at higher levels
      gameState.sweepAngleEffectiveness = 0.85 + skillFactor * 0.15; // Good angle
      gameState.sweepAngle = 15 - skillFactor * 10; // Better angle at higher skill
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
  const friction = ICE_FRICTION - (gameState.sweepEffectiveness * (ICE_FRICTION - SWEEP_FRICTION));
  gameState.activeStone.body.frictionAir = friction;

  // Update sweep indicator
  const indicator = document.getElementById('sweep-indicator');
  if (indicator && gameState.phase === 'sweeping') {
    const stoneZ = gameState.activeStone.body.position.y / PHYSICS_SCALE;
    // In 1-player mode, check stone ownership
    const isComputerStone = gameState.gameMode === '1player' &&
                            gameState.activeStone.team === gameState.computerTeam;
    const isPlayerStone = gameState.gameMode === '1player' && !isComputerStone;
    const canPlayerSweep = !isComputerStone || stoneZ >= TEE_LINE_FAR;

    // Check if computer is currently sweeping
    const computerIsSweeping = gameState._computerSweepSoundStarted;

    if (computerIsSweeping && gameState.isSweeping) {
      // Computer is sweeping - show what it's doing
      indicator.style.display = 'block';
      const intensity = Math.round(gameState.sweepEffectiveness * 100);
      if (isComputerStone) {
        indicator.textContent = `🖥️ CPU SWEEPING ${intensity}%`;
        indicator.style.color = '#fbbf24'; // Yellow for computer
      } else {
        indicator.textContent = `🖥️ CPU DEFENSE ${intensity}%`;
        indicator.style.color = '#ef4444'; // Red for defensive sweep
      }
    } else if (!canPlayerSweep) {
      // Computer's stone - player waiting for T-line
      indicator.style.display = 'block';
      indicator.textContent = 'Sweep after T-line...';
      indicator.style.color = '#888';
    } else if (gameState.isSweeping && !computerIsSweeping) {
      indicator.style.display = 'block';
      // Player is sweeping - show effectiveness with angle info
      const intensity = Math.round(gameState.sweepEffectiveness * 100);
      const angle = Math.round(gameState.sweepAngle);
      const angleEff = Math.round(gameState.sweepAngleEffectiveness * 100);

      // Angle quality indicator
      let angleIndicator = '';
      if (angle <= 20) {
        angleIndicator = '▲'; // Great - nearly aligned
      } else if (angle <= 45) {
        angleIndicator = '◢'; // Good - diagonal
      } else {
        angleIndicator = '►'; // Poor - too perpendicular
      }

      // Color based on effectiveness (green = good, yellow = ok, red = poor)
      let color;
      if (angleEff >= 70) {
        color = `rgb(${74 + intensity}, 222, 128)`; // Green
      } else if (angleEff >= 40) {
        color = `rgb(255, ${180 + angleEff * 0.5}, 50)`; // Yellow-orange
      } else {
        color = `rgb(255, ${100 + angleEff}, ${100 + angleEff})`; // Red-ish
      }

      indicator.textContent = `${angleIndicator} ${intensity}% (${angle}°)`;
      indicator.style.color = color;
    } else {
      // No one is sweeping - show ready message
      indicator.style.display = 'block';
      if (isComputerStone) {
        indicator.textContent = canPlayerSweep ? 'SWEEP NOW!' : 'Waiting...';
      } else {
        indicator.textContent = 'SWIPE to sweep';
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

function getComputerShot() {
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

  // Strategic decision making
  if (isLastStone && hasHammer) {
    // Last stone with hammer - maximize score or steal prevention
    if (playerHasShot) {
      // Must hit their shot stone
      shotType = 'takeout';
      targetX = houseStonesPlayer[0].x;
      targetZ = houseStonesPlayer[0].z;
      effort = 72 + Math.random() * 8;
    } else {
      // Draw for more points or to button
      shotType = 'draw';
      targetX = 0;
      targetZ = TEE_LINE_FAR;
      effort = 52 + Math.random() * 6;
    }
  } else if (playerHasShot && playerPoints >= 2) {
    // Player scoring multiple - aggressive takeout
    shotType = 'takeout';
    targetX = houseStonesPlayer[0].x;
    targetZ = houseStonesPlayer[0].z;
    effort = 78 + Math.random() * 8;
  } else if (playerHasShot) {
    // Player has shot - decide between takeout and other options
    const shotStoneDistance = houseStonesPlayer[0].distance;

    if (shotStoneDistance < 0.3) {
      // Very close to button - must remove
      shotType = 'takeout';
      targetX = houseStonesPlayer[0].x;
      targetZ = houseStonesPlayer[0].z;
      effort = 75 + Math.random() * 8;
    } else if (earlyEnd && guardsComputer.length < 2) {
      // Early in end, try to set up guards first
      shotType = 'guard';
      targetX = (Math.random() - 0.5) * 2;
      targetZ = HOG_LINE_FAR + 2 + Math.random() * 2;  // Guards go AFTER far hog line
      effort = 56 + Math.random() * 8;  // ~56-64% for guard weight
    } else {
      // Standard takeout
      shotType = 'takeout';
      targetX = houseStonesPlayer[0].x;
      targetZ = houseStonesPlayer[0].z;
      effort = 73 + Math.random() * 8;
    }
  } else if (computerHasShot && computerPoints >= 2) {
    // We're scoring multiple - protect with guard or add more
    if (guardsComputer.length < 2 && Math.random() > 0.3) {
      shotType = 'guard';
      // Place guard in front of scoring stones
      targetX = houseStonesComputer[0].x * 0.5;
      targetZ = HOG_LINE_FAR + 1.5 + Math.random() * 2;  // Guards go AFTER far hog line
      effort = 56 + Math.random() * 8;  // ~56-64% for guard weight
    } else {
      // Draw for more points
      shotType = 'draw';
      targetX = (Math.random() - 0.5) * 0.8;
      targetZ = TEE_LINE_FAR + (Math.random() - 0.5) * 0.5;
      effort = 54 + Math.random() * 6;
    }
  } else if (computerHasShot) {
    // We have shot - protect or add
    if (Math.random() > 0.5 && guardsComputer.length < 2) {
      // Throw a guard
      shotType = 'guard';
      targetX = houseStonesComputer[0].x * 0.3 + (Math.random() - 0.5) * 1;
      targetZ = HOG_LINE_FAR + 2 + Math.random() * 2;  // Guards go AFTER far hog line
      effort = 56 + Math.random() * 8;  // ~56-64% for guard weight
    } else {
      // Freeze to our stone
      shotType = 'freeze';
      targetX = houseStonesComputer[0].x + (Math.random() - 0.5) * 0.3;
      targetZ = houseStonesComputer[0].z - STONE_RADIUS * 2.2;
      effort = 53 + Math.random() * 5;
    }
  } else if (houseStonesComputer.length === 0 && houseStonesPlayer.length === 0) {
    // Empty house
    if (earlyEnd && hasHammer) {
      // Early with hammer - place guards
      shotType = 'guard';
      targetX = (Math.random() - 0.5) * 1.5;
      targetZ = HOG_LINE_FAR + 2 + Math.random() * 3;  // Guards go AFTER far hog line
      effort = 56 + Math.random() * 8;  // ~56-64% for guard weight
    } else if (earlyEnd && !hasHammer) {
      // Early without hammer - draw to top of house
      shotType = 'draw';
      targetX = (Math.random() - 0.5) * 1;
      targetZ = TEE_LINE_FAR - 1;
      effort = 60 + Math.random() * 6;  // ~60-66% for draw to top of house
    } else {
      // Draw to button
      shotType = 'draw';
      targetX = (Math.random() - 0.5) * 0.3;
      targetZ = TEE_LINE_FAR;
      effort = 54 + Math.random() * 6;
    }
  } else if (guardsPlayer.length > 0 && !computerHasShot) {
    // Player has guards blocking - try to peel or come around
    // Check if FGZ rule applies (stones 1-4, guards in FGZ are protected)
    const totalThrown = gameState.stonesThrown.red + gameState.stonesThrown.yellow;
    const fgzActive = totalThrown < 4;
    const targetGuard = guardsPlayer[0];
    const guardInFGZ = isInFGZ(targetGuard.z);

    if (fgzActive && guardInFGZ) {
      // Can't peel FGZ-protected guard - must come around or draw
      console.log('[FGZ] Computer avoiding protected guard, playing around it');
      shotType = 'come-around';
      targetX = targetGuard.x > 0 ? -0.8 : 0.8;
      targetZ = TEE_LINE_FAR;
      effort = 52 + Math.random() * 6;
    } else if (Math.random() > 0.4) {
      // Peel the guard (FGZ not active or guard not in FGZ)
      shotType = 'peel';
      targetX = targetGuard.x;
      targetZ = targetGuard.z;
      effort = 85 + Math.random() * 10;
    } else {
      // Try to come around
      shotType = 'come-around';
      targetX = guardsPlayer[0].x > 0 ? -0.8 : 0.8;
      targetZ = TEE_LINE_FAR;
      effort = 52 + Math.random() * 6;
    }
  } else {
    // Default - draw to button area
    shotType = 'draw';
    targetX = (Math.random() - 0.5) * 0.6;
    targetZ = TEE_LINE_FAR + (Math.random() - 0.5) * 0.8;
    effort = 53 + Math.random() * 7;
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
  // At effort 50 (draw): ~2m drift, at effort 80 (takeout): ~0.8m drift
  const estimatedCurlDrift = (1.0 - normalizedEffort * 0.7) * 2.5;

  // Compensate for curl:
  // IN-turn (curl=1) curls left, so aim RIGHT (+compensation)
  // OUT-turn (curl=-1) curls right, so aim LEFT (-compensation)
  const curlCompensation = curl * estimatedCurlDrift * 0.6; // 60% compensation

  // Adjust aim: compensate for curl
  const aimX = targetX + curlCompensation;
  const aimAngle = Math.atan2(aimX, TEE_LINE_FAR - HACK_Z);

  // Add randomness based on career level (in 1-player mode) or difficulty setting
  let variance;
  if (gameState.gameMode === '1player') {
    const level = getCurrentLevel();
    variance = level.difficulty;
  } else {
    const difficultyVariance = {
      easy: 0.25,
      medium: 0.12,
      hard: 0.04
    };
    variance = difficultyVariance[gameState.settings.difficulty] || difficultyVariance.medium;
  }

  // Apply variance (reduced for higher skill levels)
  const accuracyVariance = (Math.random() - 0.5) * variance;
  const effortVariance = (Math.random() - 0.5) * variance * 25;

  return {
    shotType,
    targetX,
    targetZ,
    effort: Math.min(100, Math.max(0, effort + effortVariance)),
    aimAngle: aimAngle + accuracyVariance,
    curl
  };
}

function executeComputerShot() {
  if (!isComputerTurn()) return;

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

  // Simulate the throw sequence with delays
  setTimeout(() => {
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
    document.getElementById('shot-type').textContent = shotTypeInfo.name;
    document.getElementById('shot-type').style.color = shotTypeInfo.color;

    updateAimLine(shot.aimAngle);

    setTimeout(() => {
      // Push off
      hideAimLine();
      pushOff();

      setTimeout(() => {
        // Release stone
        if (gameState.phase === 'sliding') {
          releaseStone();
        }
      }, 800);  // Release timing

    }, 1000);  // Time before push off

  }, 1500);  // Initial delay before computer starts
}

// ============================================
// PHYSICS UPDATE
// ============================================
function updatePhysics() {
  // Skip physics if tutorial is pausing the game
  if (gameState.learnMode.tutorialPaused) {
    return;
  }

  Matter.Engine.update(engine, 1000 / 60);

  // Update sliding phase
  updateSliding();

  // Sync 3D meshes with physics bodies
  for (const stone of gameState.stones) {
    stone.mesh.position.x = stone.body.position.x / PHYSICS_SCALE;
    stone.mesh.position.z = stone.body.position.y / PHYSICS_SCALE;
    stone.mesh.rotation.y = stone.body.angle;
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

    // Track near hog line crossing
    if (!gameState.nearHogCrossTime && stoneZ >= HOG_LINE_NEAR) {
      gameState.nearHogCrossTime = Date.now();
      console.log(`[TIMING] Near hog crossed at ${stoneZ.toFixed(2)}m`);
    }

    // Track far hog line crossing
    if (gameState.nearHogCrossTime && !gameState.farHogCrossTime && stoneZ >= HOG_LINE_FAR) {
      gameState.farHogCrossTime = Date.now();
      const hogToHog = (gameState.farHogCrossTime - gameState.nearHogCrossTime) / 1000;
      const vel = gameState.activeStone.body.velocity;
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      console.log(`[TIMING] Far hog crossed - Hog-to-hog: ${hogToHog.toFixed(2)}s (target: ~14s for draw)`);
      console.log(`[TIMING] Speed at far hog: ${speed.toFixed(3)} (cliff kicks in at < 1.0)`);
    }
  }

  // Apply curl effect during movement (stone curves based on rotation)
  // Ice condition variability based on level
  // Beginners get very consistent ice, higher levels have more realistic variation
  const levelId = gameState.gameMode === '1player' ? gameState.career.level : 4;
  // Level 1: 0% variation (perfectly consistent ice)
  // Level 8: 15% variation (realistic ice conditions that vary)
  const iceVariability = (levelId - 1) * 0.02;  // 0 to 0.14

  // Rotation-based curl physics
  // Real curling: MORE rotation = LESS curl (straighter path)
  // Curl is caused by friction asymmetry, rotation averages out the effect
  if (gameState.activeStone && (gameState.phase === 'throwing' || gameState.phase === 'sweeping')) {
    const body = gameState.activeStone.body;
    const vel = body.velocity;
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

    // Apply angular velocity damping (stone loses spin over time)
    const currentOmega = Math.abs(body.angularVelocity);
    if (currentOmega > 0.01) {
      const dampedOmega = body.angularVelocity * (1 - CURL_PHYSICS.SPIN_DAMP);
      Matter.Body.setAngularVelocity(body, dampedOmega);
    }

    if (speed > 0.3) {
      // Get forward speed in m/s (Matter.js units / scale / 60fps)
      const speedMs = speed / PHYSICS_SCALE * 60;
      const omega = Math.max(Math.abs(body.angularVelocity), CURL_PHYSICS.OMEGA_MIN);

      // Curl strength formula: more rotation = less curl
      // curlStrength = K * (1/speed)^P_SPEED * (omega_ref/omega)^P_ROTATION
      const speedFactor = Math.pow(1 / Math.max(speedMs, CURL_PHYSICS.V_MIN), CURL_PHYSICS.P_SPEED);
      const rotationFactor = Math.pow(CURL_PHYSICS.OMEGA_REF / omega, CURL_PHYSICS.P_ROTATION);

      // Ice variability - slight random variation in curl (more at higher levels)
      const iceRandomness = 1 + (Math.random() - 0.5) * iceVariability;

      // Calculate curl force
      // Direction: positive angularVelocity (IN turn) curls RIGHT (+X)
      // Negative angularVelocity (OUT turn) curls LEFT (-X)
      const direction = body.angularVelocity > 0 ? 1 : -1;
      let curlForce = direction * CURL_PHYSICS.K_CURL * speedFactor * rotationFactor * iceRandomness;

      // Low rotation "dumping" effect - add unpredictability when handle is too light
      if (omega < CURL_PHYSICS.OMEGA_MIN * 1.5) {
        // Add random jitter for "dumpy" behavior
        const dumpFactor = 1 - (omega / (CURL_PHYSICS.OMEGA_MIN * 1.5));
        curlForce += (Math.random() - 0.5) * curlForce * dumpFactor * 0.5;
      }

      // Cap max lateral force
      curlForce = Math.max(-0.0004, Math.min(0.0004, curlForce));

      // Directional sweeping effect
      if (gameState.isSweeping && gameState.sweepEffectiveness > 0.2) {
        const normalizedSpeed = Math.min(speed, 5) / 5;
        const curlMultiplier = 1 + Math.pow(1 - normalizedSpeed, 2) * 2.5;
        const directionalForce = -gameState.sweepDirection * gameState.sweepEffectiveness * 0.00006 * curlMultiplier;
        curlForce += directionalForce;
      }

      // Final cap on total lateral force
      curlForce = Math.max(-0.0005, Math.min(0.0005, curlForce));
      Matter.Body.applyForce(body, body.position, { x: curlForce, y: 0 });

      // Update sliding sound volume based on speed
      const normalizedSpeed = Math.min(speed, 5) / 5;
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
      let friction = ICE_FRICTION;

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

    const activeVel = gameState.activeStone.body.velocity;
    const activeSpeed = Math.sqrt(activeVel.x * activeVel.x + activeVel.y * activeVel.y);
    const stoneZ = gameState.activeStone.body.position.y / PHYSICS_SCALE;

    // Only end turn when ALL stones have stopped
    if (activeSpeed < 0.1 && !anyStoneMoving) {
      // Log physics timing when stone stops
      if (gameState.farHogCrossTime && !gameState.stoneStopTime) {
        gameState.stoneStopTime = Date.now();
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
      gameState.activeStone = null;
      gameState.isSweeping = false;
      gameState.sweepEffectiveness = 0;
      gameState.sweepDirection = 0;
      gameState.sweepTouches = [];
      gameState.sweepAngle = 0;
      gameState.sweepAngleEffectiveness = 1;
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

      // Show post-shot feedback in learn mode (player's shots only)
      const wasPlayerShot = gameState.currentTeam === 'red';
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
}

// ============================================
// GAME FLOW
// ============================================
function nextTurn() {
  const totalThrown = gameState.stonesThrown.red + gameState.stonesThrown.yellow;

  if (totalThrown >= 16) {
    // End complete - calculate score
    calculateScore();
    return;
  }

  // Switch teams
  gameState.currentTeam = gameState.currentTeam === 'red' ? 'yellow' : 'red';
  gameState.phase = 'aiming';
  gameState.previewHeight = 1;  // Start in target view
  gameState.previewLocked = true;
  clearTargetMarker();  // Remove target marker from previous turn
  setCurlButtonsEnabled(true);  // Re-enable curl buttons for next turn
  updatePreviewStoneForTeam();  // Update preview stone color for new team

  // Update UI
  const isComputer = gameState.gameMode === '1player' && gameState.currentTeam === gameState.computerTeam;
  let turnText;
  if (gameState.playerCountry && gameState.opponentCountry) {
    const country = gameState.currentTeam === 'red' ? gameState.playerCountry : gameState.opponentCountry;
    turnText = `End ${gameState.end} - ${country.flag} ${country.name}'s Turn${isComputer ? ' (CPU)' : ''}`;
  } else {
    const teamName = gameState.currentTeam.charAt(0).toUpperCase() + gameState.currentTeam.slice(1);
    turnText = `End ${gameState.end} - ${teamName}'s Turn${isComputer ? ' (Computer)' : ''}`;
  }
  document.getElementById('turn').textContent = turnText;

  // Camera will update via animation loop to target view

  // Trigger computer turn if applicable, or restore player's curl preference
  if (isComputer) {
    setTimeout(() => executeComputerShot(), 1000);
  } else {
    // Restore player's preferred curl direction
    gameState.curlDirection = gameState.playerCurlDirection;
    updateCurlDisplay();
    updateSkipSignalArm();
    updatePreviewStoneRotation();
  }

  // Update coach panel for learn mode
  updateCoachPanel();
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
  showScoreOverlay(scoringTeam, points, gameState.end);
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

  // Play score sound
  if (points > 0) {
    soundManager.playScore(points);
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
  if (overlay) {
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

  if (winnerClass !== 'tie') {
    if (gameState.gameMode === '2player') {
      // 2-player: confetti for winner
      launchConfetti(winnerClass);
      soundManager.playVictory();
    } else if (winnerClass === userTeam) {
      // User wins: confetti!
      launchConfetti(winnerClass);
      soundManager.playVictory();
    } else {
      // User loses: rain
      launchRaindrops();
      soundManager.playDefeat();
    }
  }

  winnerDisplay.textContent = winner;
  winnerDisplay.className = winnerClass;
  redScore.textContent = gameState.scores.red;
  yellowScore.textContent = gameState.scores.yellow;

  // Handle career progression (1-player mode only)
  const careerMessageEl = document.getElementById('gameover-career-message');
  if (gameState.gameMode === '1player' && winnerClass !== 'tie') {
    const userWon = winnerClass === userTeam;
    const careerResult = handleCareerResult(userWon);

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
  } else if (careerMessageEl) {
    careerMessageEl.style.display = 'none';
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
  // Clear confetti/rain if any
  const confettiContainer = document.getElementById('confetti-container');
  if (confettiContainer) confettiContainer.innerHTML = '';

  const overlay = document.getElementById('gameover-overlay');
  if (overlay) {
    overlay.classList.remove('visible');
    setTimeout(() => {
      overlay.style.display = 'none';

      // Reset game state
      gameState.end = 1;
      gameState.scores = { red: 0, yellow: 0 };
      gameState.endScores = { red: [null, null, null, null, null, null, null, null, null, null], yellow: [null, null, null, null, null, null, null, null, null, null] };
      gameState.hammer = 'yellow';  // Reset hammer
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

      // Show country selection to start new game setup
      showCountrySelection();
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
  }
};

window.closeSettings = function() {
  const overlay = document.getElementById('settings-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
  // Trigger coach panel/tutorials now that menu is closed
  updateCoachPanel();
};

// ============================================
// GAME SETUP FLOW
// ============================================

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

// Start coin toss animation
window.startCoinToss = function() {
  document.getElementById('settings-summary-screen').style.display = 'none';

  const overlay = document.getElementById('coin-toss-overlay');
  const coin = document.getElementById('coin');
  const result = document.getElementById('toss-result');
  const subtitle = document.getElementById('toss-subtitle');
  const title = document.getElementById('toss-title');

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

    if (playerWins) {
      result.textContent = `${gameState.playerCountry.flag} ${gameState.playerCountry.name} wins!`;
      result.style.color = '#4ade80';
      subtitle.textContent = 'You get to choose...';
    } else {
      result.textContent = `${gameState.opponentCountry.flag} ${gameState.opponentCountry.name} wins!`;
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
        // Computer chooses hammer
        gameState.hammer = 'yellow';
        gameState.currentTeam = 'red';  // Player throws first
        startGame();
      }
    }, 2000);
  }, 2000);
};

// Handle player's toss choice
window.chooseTossOption = function(choice) {
  document.getElementById('toss-choice-overlay').style.display = 'none';

  if (choice === 'hammer') {
    // Player takes hammer (throws last)
    gameState.hammer = 'red';
    gameState.currentTeam = 'yellow';  // Opponent throws first
  } else {
    // Player chooses color (throws first)
    gameState.hammer = 'yellow';
    gameState.currentTeam = 'red';  // Player throws first
  }

  startGame();
};

// Start the actual game after setup
function startGame() {
  gameState.setupComplete = true;

  // Update scoreboard with flags
  updateScoreboardFlags();

  // Update turn display
  const isComputer = gameState.gameMode === '1player' && gameState.currentTeam === gameState.computerTeam;
  const teamName = gameState.currentTeam === 'red' ? gameState.playerCountry.name : gameState.opponentCountry.name;
  const teamFlag = gameState.currentTeam === 'red' ? gameState.playerCountry.flag : gameState.opponentCountry.flag;
  document.getElementById('turn').textContent = `End 1 - ${teamFlag} ${teamName}'s Turn${isComputer ? ' (CPU)' : ''}`;

  // Set camera to target view
  gameState.previewHeight = 1;
  gameState.previewLocked = true;

  // Show first-run aim tutorial (if it's player's turn)
  if (!isComputer) {
    showFirstRunTutorial('fr_aim');
  }

  // If computer goes first, trigger their turn
  if (isComputer) {
    setTimeout(() => executeComputerShot(), 1500);
  }

  // Trigger coach panel/tutorials
  updateCoachPanel();
}

// Update scoreboard to show flags instead of RED/YELLOW
function updateScoreboardFlags() {
  if (!gameState.playerCountry || !gameState.opponentCountry) return;

  // Player is red, opponent is yellow
  const redLabel = document.querySelector('#red-score-row .team-col');
  const yellowLabel = document.querySelector('#yellow-score-row .team-col');

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
  fr_aim: {
    id: 'fr_aim',
    icon: '🎯',
    title: 'Set Your Target',
    text: `Tap anywhere on the ice to place your target marker. This is where you want your stone to stop.

The green arrow shows your aim direction. Drag left or right to fine-tune your aim.`,
    hint: 'Place your target in the house (colored rings) to score!',
    step: 1,
    total: 4
  },
  fr_curl: {
    id: 'fr_curl',
    icon: '🌀',
    title: 'Choose Your Curl',
    text: `Curling stones curve as they slow down! Tap IN or OUT (bottom left) to set the curl direction:

• IN-turn → stone curves LEFT
• OUT-turn → stone curves RIGHT`,
    hint: 'Curl helps you navigate around other stones.',
    step: 2,
    total: 4
  },
  fr_throw: {
    id: 'fr_throw',
    icon: '💪',
    title: 'Throw the Stone',
    text: `Tap and drag DOWN to set your throwing power (weight). The bar on the left shows your power level.

Release to throw! Tap again when the stone crosses the hog line to let go.`,
    hint: 'More power = stone travels farther.',
    step: 3,
    total: 4
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
    step: 4,
    total: 4,
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
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, name, email, message })
    });

    const data = await response.json();

    if (response.ok) {
      statusEl.textContent = 'Thank you! Your feedback has been sent.';
      statusEl.style.color = '#4ade80';
      statusEl.style.display = 'block';

      // Close after delay
      setTimeout(() => {
        window.closeFeedback();
      }, 2000);
    } else {
      throw new Error(data.error || 'Failed to send');
    }
  } catch (error) {
    console.error('Feedback error:', error);
    statusEl.textContent = error.message || 'Failed to send. Please try again.';
    statusEl.style.color = '#f87171';
    statusEl.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send';
  }
};

function startNewEnd() {
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

  if (gameState.end > gameState.settings.gameLength) {
    // Game over
    showGameOverOverlay();
    return;
  }

  gameState.phase = 'aiming';
  gameState.previewHeight = 0;  // Reset to thrower's view
  gameState.previewLocked = false;  // Reset pan mode
  clearTargetMarker();  // Remove target marker
  setCurlButtonsEnabled(true);  // Re-enable curl buttons for new end
  updatePreviewStoneForTeam();  // Update preview stone for current team

  const teamName = gameState.currentTeam.charAt(0).toUpperCase() + gameState.currentTeam.slice(1);
  const isComputer = gameState.gameMode === '1player' && gameState.currentTeam === gameState.computerTeam;
  document.getElementById('turn').textContent =
    `End ${gameState.end} - ${teamName}'s Turn${isComputer ? ' (Computer)' : ''}`;
  resetCameraToThrower();

  // Trigger computer turn if applicable, or restore player's curl preference
  if (isComputer) {
    setTimeout(() => executeComputerShot(), 1000);
  } else {
    // Restore player's preferred curl direction
    gameState.curlDirection = gameState.playerCurlDirection;
    updateCurlDisplay();
    updateSkipSignalArm();
    updatePreviewStoneRotation();
  }
}

function updateScoreDisplay() {
  // Update totals
  const redTotal = document.getElementById('red-total');
  const yellowTotal = document.getElementById('yellow-total');
  if (redTotal) redTotal.textContent = gameState.scores.red;
  if (yellowTotal) yellowTotal.textContent = gameState.scores.yellow;

  // Update end-by-end scores
  for (let i = 0; i < 8; i++) {
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

// Double click to unlock preview and allow repositioning
renderer.domElement.addEventListener('dblclick', (e) => {
  if (gameState.phase === 'aiming' && gameState.previewLocked) {
    // Unlock to allow repositioning marker (keep existing marker visible)
    gameState.previewLocked = false;
    updateReturnButton();
    updateMarkerHint();
    // Update last mouse position to prevent sudden jump
    gameState.lastMousePos = { x: e.clientX, y: e.clientY };
  }
});

renderer.domElement.addEventListener('mousemove', (e) => {
  updatePull(e.clientX, e.clientY);
  updateSlidingAim(e.clientX);  // Allow aiming during slide
  updatePreviewCamera(e.clientX, e.clientY);  // Preview camera during aiming
  updateSweepFromMovement(e.clientX, e.clientY);  // Sweeping via mouse drag
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

renderer.domElement.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
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
  const touch = e.touches[0];
  updatePull(touch.clientX, touch.clientY);
  updateSlidingAim(touch.clientX);  // Allow aiming during slide
  updatePreviewCamera(touch.clientX, touch.clientY);  // Preview camera during aiming
  updateSweepFromMovement(touch.clientX, touch.clientY);  // Sweeping via touch drag
});

renderer.domElement.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (gameState.phase === 'charging' && touchStartedInAiming) {
    pushOff();
    touchStartedInAiming = false;
  }
});

// Window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================
// GAME LOOP
// ============================================
function animate() {
  requestAnimationFrame(animate);

  updatePhysics();

  // Camera updates
  if (cameraAnimation) {
    cameraAnimation.update();
  } else if (gameState.phase === 'aiming') {
    updatePreviewCamera(undefined, undefined, false);  // Continue smooth camera interpolation
    updateReturnButton();  // Update button visibility as camera moves
    updateMarkerHint();    // Update hint visibility as camera moves
    // Update coach target marker animation (learn mode)
    if (gameState.learnMode.enabled && gameState.coachTargetMarker) {
      updateCoachTargetMarker();
    }
  } else {
    updateCameraFollow();  // Follow stone during sliding/throwing phase
  }

  // Update preview stone visibility based on phase and camera height
  updatePreviewStoneVisibility();

  renderer.render(scene, camera);
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
const splashMinTime = 2000;  // Minimum 2 seconds splash display
const loadEndTime = Date.now();
const elapsed = loadEndTime - (window.splashStartTime || loadEndTime);
const remainingTime = Math.max(0, splashMinTime - elapsed);

setTimeout(() => {
  hideSplashScreen();
  animate();
  console.log('Curling game initialized!');

  // Go to country selection
  showCountrySelection();
}, remainingTime);
