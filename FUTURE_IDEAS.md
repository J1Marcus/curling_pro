# Future Ideas & Features

## Arena Improvements
- Add bleachers with spectators on the back wall
- Continue improving overall arena aesthetics and realism

---

## Game Modes

### 1. Career Mode
- Player starts at **club level** and works their way up through competitive tiers
- Progress is saved between sessions
- **Requires backend integration** to persist user data:
  - Current level/tier
  - Win/loss record
  - Unlocked achievements or content
  - Player statistics

#### Country Representation
- At higher career levels (International and above), player represents their country
- Replace generic red/yellow team colors with country flags
- Player selects their country at career start or when reaching International level
- Opponent countries vary based on level:
  - **International**: Various countries
  - **World Championship**: Top curling nations
  - **Olympic Trials**: Domestic teams competing for Olympic spot
  - **Olympics**: Elite nations (Canada, Sweden, Switzerland, Norway, etc.)
- Visual elements:
  - Flags displayed on scoreboard
  - Country colors on stones or uniforms
  - National team jerseys on skip/players

### 2. Quick Play Mode (name TBD)
Possible names:
- Quick Play
- Exhibition
- Friendly Match
- Practice
- Open Play
- Freeplay

Features:
- Player can select any level/difficulty directly
- No progression tracking required
- No backend needed - purely client-side
- Good for casual play or practicing specific scenarios

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
