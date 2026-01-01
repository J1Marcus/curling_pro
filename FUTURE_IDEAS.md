# Future Ideas & Features

## Arena Improvements
- Add bleachers with spectators on the back wall
- Continue improving overall arena aesthetics and realism

---

## Game Modes

### 1. Career Mode - DONE
- Player starts at **club level** and works their way up through competitive tiers
- Progress is saved between sessions (localStorage)
- Tournament system with brackets
- Club identity with custom crests
- Country representation unlocks at National tier and above

### 2. Quick Play Mode - DONE
- Player can select any difficulty directly
- No progression tracking
- Good for casual play

---

## Learn Mode

An educational mode designed to teach curling strategy and technique.

### Strategy Assistance
- Computer suggests where to aim for each shot
- Explains the reasoning behind the suggestion:
  - What the objective is (guard, draw, takeout, etc.)
  - Recommended weight/effort level
  - Recommended curl direction
  - Why this shot is strategically sound given the current stone positions

### Feedback System
- After each throw, provide feedback on execution
- Compare intended vs actual result
- Tips for improvement

### AI Tutor Chatbot
- Interactive chat interface
- User can ask questions about:
  - Curling rules and terminology
  - Strategy in specific situations
  - Technique tips
  - General curling knowledge
- Responses should feel like they're coming from a professional curling coach/tutor
- Could integrate with an AI API for natural conversation

---

## Online Multiplayer (2-Player Mode)

The only way to play against another human - no local 2-player on same device.
Players compete against each other on separate devices over the internet.

### Matchmaking
- Quick match: Automatically find an opponent
- Private match: Create/join a game with a code or invite link
- Ranked matches: Compete for leaderboard position

### Game Synchronization
- Real-time sync of stone positions and game state
- Handle network latency gracefully
- Reconnection support if connection drops mid-game

### Communication
- Simple emotes or quick chat options
- Optional voice chat integration
- Spectator mode for watching live matches

### Technical Requirements
- WebSocket server for real-time communication
- Game state authority on server to prevent cheating
- Lobby system for matchmaking
- Player presence (online/offline/in-game status)

---

## Technical Considerations

### Backend Requirements (Career Mode)
- User authentication (optional - could use local storage initially)
- Database to store:
  - Player profiles
  - Career progression
  - Match history
- API endpoints for save/load operations

### AI Integration (Learn Mode)
- Strategy suggestion engine (could be rule-based or AI-powered)
- Chat API integration for tutor functionality
- Context-aware responses based on current game state

### Sound Enhancements - DONE
- Procedural ambient crowd murmur during gameplay
- Crowd cheers for good shots (intensity varies by shot quality)
- Sympathetic "ooh" for near misses
- Applause for scoring (duration scales with points)
- Victory cheers and defeat groans

---

## Settings Improvements

### FAQ Section - DONE
- 7 categories covering gameplay, rules, career mode, etc.
- Accordion-style navigation
- Accessible from settings menu

---

## Practice Mode - DONE

A dedicated training mode for skill development.

### Shot Drills
- 6 drill types: Takeouts, Bumps, Draws, Guards, Freezes, Hit & Roll
- 24 scenarios across difficulty levels (1-5)
- Success detection for each shot type

### Progressive Difficulty
- Scenarios unlock as player improves
- Track success rate per drill and scenario
- Streak bonuses for consecutive successes

### Instant Reset
- R key for quick reset
- Reset button in practice overlay
- No full game progression - just focused practice
