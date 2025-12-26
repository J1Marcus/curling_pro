# CurlingPro

A realistic 3D physics-based curling game built with Three.js and Matter.js.

## Features

- **Realistic Physics** - Accurate ice friction, stone collisions, and curl mechanics based on real curling measurements
- **3D Graphics** - Immersive 3D rendering with Three.js including dynamic camera angles
- **Multiple Game Modes** - Single player vs AI or local 2-player pass-and-play
- **Shot Types** - Guard, Draw, Takeout, and Peel weights with visual feedback
- **Sweeping Mechanics** - Interactive sweeping that affects stone speed and curl
- **Full Match Play** - 10-end games with authentic scoring system
- **Sound Effects** - Stone sliding, collisions, and ambient audio
- **Mobile Support** - Touch controls and PWA-ready for installation on devices

## Tech Stack

- **Build Tool**: Vite
- **3D Rendering**: Three.js
- **Physics**: Matter.js
- **Audio**: Howler.js
- **Backend**: Express (for email notifications)

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/J1Marcus/curling_pro.git
cd curling_pro

# Install dependencies
npm install

# Start development server
npm run dev
```

The game will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
npm run preview
```

## How to Play

1. **Aim** - Move your mouse/finger to aim the stone
2. **Set Power** - Click/tap and drag back to set maximum power
3. **Release** - Release to throw; hold longer for a softer shot
4. **Sweep** - During stone travel, swipe to sweep and extend the stone's path
5. **Score** - Stones closest to the button (center) score points

### Shot Types

| Power Level | Shot Type | Use Case |
|-------------|-----------|----------|
| 0-29% | Ultra Light Guard | Soft placement in front of house |
| 30-49% | Guard | Protect stones in play |
| 50-69% | Draw | Place stone in the house |
| 70-84% | Takeout | Remove opponent stones |
| 85-100% | Peel | Heavy hit to clear multiple stones |

## Controls

### Desktop
- **Mouse** - Aim direction
- **Click + Drag** - Set power (drag back to charge)
- **Spacebar / Swipe** - Sweep

### Mobile
- **Touch + Drag** - Aim and set power
- **Swipe** - Sweep during stone travel

## Project Structure

```
curling-game/
├── src/
│   ├── main.js      # Game logic, physics, and rendering
│   └── sounds.js    # Audio management
├── public/          # Static assets
├── index.html       # Main HTML with UI
├── server.js        # Express server for backend features
└── package.json
```

## License

MIT
