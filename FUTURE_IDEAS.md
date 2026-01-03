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

## Learn Mode - MOSTLY DONE

An educational mode designed to teach curling strategy and technique.

### Strategy Assistance - DONE (Coach Panel)
- Computer suggests where to aim for each shot
- Shows target marker on ice
- Explains reasoning: shot type, weight, curl direction
- 4 coaching levels: Beginner, Intermediate, Advanced, Expert

### Tutorials - DONE
- Multi-step tutorials for rules, controls, shot types
- Covers: scoring, hammer, free guard zone, shot types, aiming, curl, effort, sweeping
- Can be disabled by user
- First-run tutorials for new players (even outside Learn Mode)

### Feedback System - DONE
- Shot feedback toast messages after each throw
- Categorizes outcomes (success, near miss)
- Crowd reactions reinforce feedback

### AI Tutor Chatbot - NOT DONE
- Interactive chat interface
- User can ask questions about curling rules, strategy, technique
- Would integrate with AI API for natural conversation

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

### Save Scenario (Custom Drills)
- During gameplay, button to save current stone positions as a practice scenario
- Captures: stone positions and colors only
- Saved scenarios appear in Practice Mode under "Custom" category
- Can name/label saved scenarios
- Manage (rename/delete) saved scenarios from practice menu
- LocalStorage for persistence

---

## High-Value Features

### Leaderboard System
- Global rankings by ELO rating
- Filter by country/region
- Weekly/monthly/all-time views
- Show player's current rank and nearby competitors

### Match History
- Record of recent games (wins/losses/opponent)
- Filter by mode (ranked, private, career)
- View end scores and final stone positions
- Option to share notable matches

### Statistics Dashboard
- Win rate, average score differential
- Best/worst ends, comebacks
- Shot accuracy by type (draw, takeout, guard)
- Career progression graphs

### Rematch Button
- After multiplayer game ends, offer quick rematch
- Both players must accept
- Maintains same lobby/room for faster restart

---

## Polish & Engagement

### Achievement System
- Unlock badges for milestones (first win, 10-game streak, perfect end)
- Display on player profile
- Track progress toward incomplete achievements
- Rare achievements for exceptional plays

### Daily Challenges
- One new challenge each day
- Examples: "Win a game using only draws", "Score 3+ in one end"
- Small rewards (cosmetic unlock, XP boost)
- Streak bonuses for consecutive days

### Loading Tips
- Curling strategy tips during loading screens
- Rotate through tips library
- Tips contextual to player's recent performance

### Share Results
- Generate shareable image of final scoreboard
- Include key stats (big ends, hammer usage)
- Social media integration or copy-to-clipboard

---

## Multiplayer Enhancements

### Friend List System
- Add friends by username or invite code
- See online status
- Quick invite to match
- Recent opponents list

### Spectator Mode
- Watch live ranked matches
- Commentary-style view with delayed feed
- Learn from top players

### Private Lobbies
- Custom match settings (ends, time limits)
- Password-protected rooms
- Invite multiple spectators

---

## Accessibility & Quality of Life

### Colorblind Mode
- Alternative stone color schemes
- High-contrast options
- Pattern overlays on stones

### Shot Replay
- Review previous shot with slow-motion
- Analyze stone paths and collisions
- Available between throws

### Undo in Practice Mode
- Step back to previous state
- Experiment with different shot approaches
- Learn from mistakes without full reset

### Fast Mode
- Speed setting for casual players who prefer faster-paced games
- Time scale factor (1.5x-2x) affecting stone physics, transitions, animations
- Options: toggle (Normal/Fast) or slider (1x, 1.5x, 2x)
- Keep multiplier reasonable for physics stability
- Multiplayer: both players need same speed setting

---

## Longer-Term Ideas

### Full Tournament Mode
- Multi-day online tournaments
- Bracket progression with elimination
- Seasonal events with prizes

### Custom Team Creation
- Design team logo/crest
- Name your team
- Invite friends to form a team roster

### Seasonal Rankings
- Rating resets each season
- Placement matches at season start
- End-of-season rewards based on rank

### AI Tutor Chatbot (from Learn Mode)
- Interactive chat interface
- User can ask questions about curling rules, strategy, technique
- Would integrate with AI API for natural conversation