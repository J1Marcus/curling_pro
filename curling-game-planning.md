# Curling Game - Planning Document

## Overview
A physics-based curling game built with Vite.

---

## 1. Physics Engine Considerations

### Core Physics
- **Friction model**: Ice has very low friction coefficient (~0.02-0.03)
- **Stone deceleration**: Gradual slowdown over distance
- **Curl/rotation**: Stones curve based on spin direction (clockwise vs counter-clockwise)
- **Collision detection**: Stone-to-stone elastic collisions
- **Momentum transfer**: Mass and velocity calculations on impact
- **Angular velocity**: Spin affects trajectory curve

### Physics Library Options
| Library | Pros | Cons |
|---------|------|------|
| **Matter.js** | Easy to use, good docs, 2D focused | May need customization for ice physics |
| **Planck.js** | Box2D port, precise physics | Steeper learning curve |
| **Custom** | Full control over curling-specific physics | More development time |
| **p2.js** | Lightweight, good constraints | Less actively maintained |

### Sweeping Mechanics
- Sweeping reduces friction in front of the stone
- Affects both speed retention and curl amount
- Need to define "sweep zone" in front of moving stone

---

## 2. Game Rules & Mechanics

### Basic Curling Rules
- Two teams (usually red and yellow stones)
- 8 stones per team (16 total per end)
- Teams alternate throws
- Closest stone(s) to button score points
- Only one team scores per end
- Standard game: 8-10 ends

### Scoring System
- Only the team with the closest stone scores
- One point per stone closer than opponent's closest
- Need to calculate distances from button center

### Turn Structure
1. Aim/set trajectory
2. Set power/weight
3. Set rotation direction (in-turn/out-turn)
4. Release stone
5. Sweeping phase (optional)
6. Stone comes to rest
7. Next player's turn

---

## 3. Visual/UI Elements

### Playing Surface
- **Sheet dimensions**: 150ft x ~15ft (scaled appropriately)
- **House**: Target rings (button, 4ft, 8ft, 12ft circles)
- **Hack**: Foot hold at throwing end
- **Hog lines**: Two lines stones must pass
- **Tee line**: Center line through house
- **Back line**: Out of play boundary

### Game UI
- Power meter/gauge
- Aim indicator/trajectory preview
- Rotation selector
- Sweep button/control
- Current score display
- End counter
- Turn indicator (which team)
- Stone count remaining

### Visual Assets Needed
- Curling stone sprites (2 colors)
- Ice texture/sheet background
- House rings
- Broom/sweeper (if animated)
- Team indicators
- Scoreboard graphics

---

## 4. Technical Architecture

### Tech Stack
```
Vite (build tool)
├── Framework: Vanilla JS, React, Vue, or Svelte
├── Rendering: HTML5 Canvas or PixiJS/Phaser
├── Physics: Matter.js or custom
├── State: Zustand, Redux, or vanilla
└── Audio: Howler.js or Web Audio API
```

### Project Structure
```
curling-game/
├── src/
│   ├── main.js
│   ├── game/
│   │   ├── Game.js         # Main game loop
│   │   ├── Physics.js      # Physics engine wrapper
│   │   ├── Stone.js        # Stone entity
│   │   ├── Sheet.js        # Playing surface
│   │   └── Scoring.js      # Score calculations
│   ├── ui/
│   │   ├── PowerMeter.js
│   │   ├── AimControl.js
│   │   └── Scoreboard.js
│   ├── audio/
│   │   └── SoundManager.js
│   └── utils/
│       └── helpers.js
├── assets/
│   ├── images/
│   ├── sounds/
│   └── fonts/
├── index.html
├── vite.config.js
└── package.json
```

### Key Dependencies
```json
{
  "dependencies": {
    "matter-js": "^0.19.0",
    "howler": "^2.2.4"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  }
}
```

---

## 5. Controls & Input

### Desktop Controls
- **Mouse**: Aim direction, power drag
- **Click/drag**: Set power and release
- **Spacebar or hold**: Sweep
- **Arrow keys**: Fine-tune aim (optional)

### Mobile Controls (if supporting)
- Touch drag for aim/power
- Touch hold zones for sweeping
- Gesture-based rotation selection

### Control Flow
1. Player positions behind stone (thrower's perspective - looking down the ice)
2. Drag/pull back to set MAX potential power
3. Hold duration REDUCES power (quick release = full power, long hold = soft touch)
4. Release to throw
5. **Camera transition**: Animated zoom out to overhead/bird's eye view
6. Sweeping phase with overhead perspective
7. Stone comes to rest

### Camera System
- **Throwing phase**: Low angle behind thrower, looking down the sheet
- **Transition**: Smooth animated pull-up after release (~1 second)
- **Sweeping phase**: High overhead view to see full house and stone path
- **Scoring**: May zoom to house for point calculation

---

## 6. Game Modes

### Single Player
- Practice mode (free play)
- vs AI (difficulty levels)
- Challenge modes (hit specific targets)

### Multiplayer
- **Local**: Pass-and-play on same device
- **Online**: WebSocket/WebRTC for real-time (stretch goal)

### AI Considerations
- Shot selection logic
- Accuracy variance by difficulty
- Strategic decision making (guard, draw, takeout)

---

## 7. Audio

### Sound Effects Needed
- Stone release/throw
- Stone sliding on ice
- Stone collision (varying intensity)
- Sweeping sounds
- Stone stopping
- Scoring celebration
- UI clicks/feedback

### Music (Optional)
- Menu music
- In-game ambient
- Victory/defeat themes

---

## 8. Shot Types to Support

| Shot Type | Description |
|-----------|-------------|
| **Draw** | Place stone in house |
| **Takeout** | Remove opponent stone |
| **Guard** | Protect stone in front of house |
| **Raise** | Push own stone further |
| **Hit and roll** | Remove stone and position |
| **Freeze** | Stop touching another stone |
| **Peel** | Remove guard stone |

---

## 9. Development Phases

### Phase 1: Core Mechanics
- [ ] Set up Vite project
- [ ] Implement basic rendering (sheet, stones)
- [ ] Basic physics (sliding, stopping)
- [ ] Throwing mechanic
- [ ] Stone collisions

### Phase 2: Game Logic
- [ ] Turn system
- [ ] Scoring calculation
- [ ] End management
- [ ] Basic UI (score, turns)

### Phase 3: Polish
- [ ] Sweeping mechanic
- [ ] Curl/rotation physics
- [ ] Sound effects
- [ ] Visual polish
- [ ] Power meter refinement

### Phase 4: Extended Features
- [ ] AI opponent
- [ ] Multiple game modes
- [ ] Settings/options
- [ ] Mobile support
- [ ] Online multiplayer (optional)

---

## 10. Challenges to Anticipate

### Physics Challenges
- Realistic curl behavior is complex
- Balancing friction for fun vs realism
- Precise collision response
- Sweeping effect calibration

### UX Challenges
- Intuitive power/aim controls
- Camera positioning (zoomed out vs focused)
- Feedback for shot quality
- Mobile touch accuracy

### Performance
- Smooth animations at 60fps
- Physics step timing
- Asset loading/optimization

---

## 11. Reference & Inspiration

### Study These
- Real curling physics videos
- Existing curling games (for UX ideas)
- Matter.js examples for friction/collision

### Key Measurements (Real World)
- Stone weight: ~44 lbs (20 kg)
- Stone diameter: ~11 inches (28 cm)
- Sheet length: 150 ft (45.7 m)
- House diameter: 12 ft (3.66 m)

---

## 12. Questions to Decide

1. **2D top-down or isometric view?**
2. **Realistic physics or arcade-style?**
3. **Full match or quick-play focused?**
4. **Art style: realistic, cartoonish, minimalist?**
5. **Target platforms: desktop only or mobile too?**
6. **Multiplayer priority level?**

---

## Next Steps

1. Decide on framework (vanilla JS, React, etc.)
2. Prototype basic stone throwing physics
3. Get sheet and stone rendering working
4. Iterate on controls feel
5. Build out from there
