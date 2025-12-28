# Backend Requirements Document

## Overview

This document outlines the backend requirements for CurlingPro based on the existing frontend implementation and planned future features.

---

## 1. User Management

### Authentication
- User registration (email/password or OAuth)
- Login/logout functionality
- Password reset
- Session management (JWT tokens recommended)
- Optional: Guest mode with limited features

### User Profile
```json
{
  "userId": "uuid",
  "email": "string",
  "username": "string (display name)",
  "country": "string (ISO country code, e.g., 'CA', 'SE', 'US')",
  "createdAt": "timestamp",
  "lastLoginAt": "timestamp",
  "settings": {
    "difficulty": "easy | medium | hard",
    "soundEnabled": "boolean",
    "gameLength": "number (2-10 ends)"
  }
}
```

### Country Data
Players select their country, used for representation at International level and above.
```json
{
  "code": "CA",
  "name": "Canada",
  "flagUrl": "/flags/ca.svg",
  "primaryColor": "#FF0000",
  "secondaryColor": "#FFFFFF"
}
```

Top curling nations to include:
- Canada (CA), Sweden (SE), Switzerland (CH), Norway (NO)
- Scotland (SCO), USA (US), Japan (JP), South Korea (KR)
- Great Britain (GB), China (CN), Italy (IT), Germany (DE)

---

## 2. Career Mode Data

### Career Progress (Currently in localStorage)
The frontend currently tracks:
```javascript
career: {
  level: 1,        // 1-8 (Club through Olympics)
  wins: 0,         // Wins at current level
  losses: 0        // Losses at current level
}
```

### Career Levels Reference
| Level | Name               | Wins to Advance | Difficulty |
|-------|--------------------|-----------------|-----------:|
| 1     | Club               | 2               | 0.30       |
| 2     | Regional           | 2               | 0.22       |
| 3     | Provincial         | 3               | 0.16       |
| 4     | National           | 3               | 0.12       |
| 5     | International      | 3               | 0.09       |
| 6     | World Championship | 4               | 0.06       |
| 7     | Olympic Trials     | 4               | 0.045      |
| 8     | Olympics           | N/A (final)     | 0.035      |

### Career Data Schema
```json
{
  "careerId": "uuid",
  "userId": "uuid",
  "currentLevel": "number (1-8)",
  "winsAtLevel": "number",
  "lossesAtLevel": "number",
  "totalWins": "number",
  "totalLosses": "number",
  "highestLevelReached": "number",
  "olympicWins": "number (wins at level 8)",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

---

## 3. Match History

### Match Record Schema
```json
{
  "matchId": "uuid",
  "userId": "uuid",
  "gameMode": "career | quickplay",
  "careerLevel": "number | null",
  "playerTeam": "red | yellow",
  "computerTeam": "red | yellow | null (2-player)",
  "finalScore": {
    "player": "number",
    "opponent": "number"
  },
  "endScores": {
    "player": ["number | null", ...],
    "opponent": ["number | null", ...]
  },
  "totalEnds": "number",
  "hammerStart": "red | yellow",
  "result": "win | loss | tie",
  "duration": "number (seconds)",
  "playedAt": "timestamp"
}
```

### Statistics to Track
- Total games played
- Win/loss ratio by mode
- Win/loss ratio by career level
- Average score per game
- Highest single-end score
- Total stones thrown
- Hammer conversion rate (scoring when you have last stone)
- Steal rate (scoring when opponent has last stone)

---

## 4. Learn Mode Integration

### Strategy Suggestion Engine

The frontend will request strategy advice based on current game state:

#### Request Payload
```json
{
  "stones": [
    {
      "team": "red | yellow",
      "position": { "x": "number", "z": "number" },
      "inPlay": "boolean"
    }
  ],
  "currentTeam": "red | yellow",
  "opponentTeam": "red | yellow",
  "stonesRemaining": {
    "player": "number (0-8)",
    "opponent": "number (0-8)"
  },
  "currentScore": {
    "player": "number",
    "opponent": "number"
  },
  "currentEnd": "number",
  "totalEnds": "number",
  "hammerTeam": "red | yellow"
}
```

#### Response Payload
```json
{
  "recommendedShot": {
    "type": "draw | guard | takeout | hit-and-roll | freeze | peel",
    "targetPosition": { "x": "number", "z": "number" },
    "effort": "number (0-100)",
    "curl": "in | out",
    "confidence": "number (0-1)"
  },
  "explanation": {
    "objective": "string (what this shot accomplishes)",
    "reasoning": "string (why this is the best choice)",
    "riskAssessment": "string (what could go wrong)",
    "alternativeShots": [
      {
        "type": "string",
        "description": "string"
      }
    ]
  }
}
```

### AI Tutor Chatbot

#### Chat Request
```json
{
  "userId": "uuid",
  "sessionId": "uuid",
  "message": "string",
  "gameContext": {
    "stones": [...],
    "score": {...},
    "end": "number"
  } | null
}
```

#### Chat Response
```json
{
  "response": "string",
  "sources": ["string"] | null,
  "suggestedFollowups": ["string"] | null
}
```

#### Chat Capabilities
- Answer curling rules questions
- Explain terminology (house, hog line, hammer, etc.)
- Provide strategy tips based on game context
- Explain shot types and when to use them
- Offer technique advice
- Discuss famous curling matches/players (educational)

---

## 5. Online Multiplayer

The only 2-player mode - players compete on separate devices over the internet.

### Lobby System
```json
{
  "lobbyId": "uuid",
  "hostUserId": "uuid",
  "guestUserId": "uuid | null",
  "inviteCode": "string (6 chars)",
  "status": "waiting | ready | in_progress | completed",
  "gameSettings": {
    "ends": "number",
    "timePerShot": "number (seconds) | null"
  },
  "createdAt": "timestamp"
}
```

### Game Session
```json
{
  "sessionId": "uuid",
  "lobbyId": "uuid",
  "players": {
    "red": { "userId": "uuid", "country": "string" },
    "yellow": { "userId": "uuid", "country": "string" }
  },
  "gameState": {
    "phase": "string",
    "currentTeam": "red | yellow",
    "end": "number",
    "scores": { "red": "number", "yellow": "number" },
    "stones": [
      {
        "team": "red | yellow",
        "position": { "x": "number", "z": "number" },
        "velocity": { "x": "number", "z": "number" }
      }
    ],
    "hammer": "red | yellow"
  },
  "lastUpdated": "timestamp"
}
```

### Real-time Events (WebSocket)

#### Client -> Server
| Event | Payload | Description |
|-------|---------|-------------|
| `join_lobby` | `{ lobbyId, userId }` | Join a game lobby |
| `ready` | `{ lobbyId, userId }` | Signal ready to start |
| `throw_stone` | `{ effort, curl, aimAngle }` | Execute a throw |
| `sweep` | `{ intensity, direction }` | Sweep the stone |
| `emote` | `{ emoteId }` | Send an emote |

#### Server -> Client
| Event | Payload | Description |
|-------|---------|-------------|
| `lobby_update` | `{ lobby }` | Lobby state changed |
| `game_start` | `{ session }` | Game is starting |
| `stone_thrown` | `{ stone, thrower }` | Opponent threw |
| `stone_update` | `{ stones }` | Stone positions (60fps) |
| `turn_change` | `{ currentTeam }` | Turn switched |
| `end_complete` | `{ scores, hammer }` | End finished |
| `game_over` | `{ finalScores, winner }` | Game ended |
| `opponent_emote` | `{ emoteId }` | Opponent sent emote |
| `opponent_disconnected` | `{}` | Opponent lost connection |
| `opponent_reconnected` | `{}` | Opponent reconnected |

### Matchmaking Queue
```json
{
  "queueEntry": {
    "userId": "uuid",
    "rating": "number (ELO)",
    "joinedAt": "timestamp",
    "preferences": {
      "ends": "number",
      "ranked": "boolean"
    }
  }
}
```

### Player Rating (for Ranked Matches)
```json
{
  "userId": "uuid",
  "rating": "number (starting 1200)",
  "rank": "string (Bronze, Silver, Gold, Platinum, Diamond)",
  "wins": "number",
  "losses": "number",
  "winStreak": "number",
  "highestRating": "number"
}
```

---

## 6. API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new user account |
| POST | `/api/auth/login` | Login and receive token |
| POST | `/api/auth/logout` | Invalidate session |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Complete password reset |

### User Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/profile` | Get current user profile |
| PUT | `/api/user/profile` | Update profile |
| PUT | `/api/user/settings` | Update game settings |
| DELETE | `/api/user/account` | Delete account |

### Career Mode
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/career` | Get career progress |
| POST | `/api/career/match` | Record match result |
| POST | `/api/career/reset` | Reset career progress |
| GET | `/api/career/leaderboard` | Get global leaderboard |

### Match History
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/matches` | Get match history (paginated) |
| GET | `/api/matches/:id` | Get specific match details |
| POST | `/api/matches` | Record new match |
| GET | `/api/stats` | Get aggregate statistics |

### Learn Mode
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/learn/suggest` | Get strategy suggestion |
| POST | `/api/learn/analyze` | Analyze completed shot |
| POST | `/api/learn/chat` | Send chat message to AI tutor |
| GET | `/api/learn/chat/:sessionId` | Get chat history |
| DELETE | `/api/learn/chat/:sessionId` | Clear chat session |

### Multiplayer
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/multiplayer/lobby` | Create a new lobby |
| GET | `/api/multiplayer/lobby/:id` | Get lobby details |
| POST | `/api/multiplayer/lobby/:id/join` | Join lobby by ID |
| POST | `/api/multiplayer/lobby/join-code` | Join lobby by invite code |
| DELETE | `/api/multiplayer/lobby/:id` | Leave/close lobby |
| POST | `/api/multiplayer/matchmaking/join` | Join matchmaking queue |
| DELETE | `/api/multiplayer/matchmaking/leave` | Leave matchmaking queue |
| GET | `/api/multiplayer/rating` | Get player's rating/rank |
| GET | `/api/multiplayer/leaderboard` | Get ranked leaderboard |

**Note:** Real-time game communication uses WebSocket at `wss://api.example.com/ws`

---

## 7. Database Schema (PostgreSQL Recommended)

### Tables

#### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  country VARCHAR(3),  -- ISO country code (CA, SE, US, etc.)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  settings JSONB DEFAULT '{}'
);
```

#### careers
```sql
CREATE TABLE careers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  current_level INTEGER DEFAULT 1,
  wins_at_level INTEGER DEFAULT 0,
  losses_at_level INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_losses INTEGER DEFAULT 0,
  highest_level_reached INTEGER DEFAULT 1,
  olympic_wins INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);
```

#### matches
```sql
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  game_mode VARCHAR(20) NOT NULL,
  career_level INTEGER,
  player_team VARCHAR(10) NOT NULL,
  player_score INTEGER NOT NULL,
  opponent_score INTEGER NOT NULL,
  end_scores JSONB NOT NULL,
  total_ends INTEGER NOT NULL,
  hammer_start VARCHAR(10) NOT NULL,
  result VARCHAR(10) NOT NULL,
  duration_seconds INTEGER,
  played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### chat_sessions
```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### chat_messages
```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  game_context JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### lobbies (Multiplayer)
```sql
CREATE TABLE lobbies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  guest_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  invite_code VARCHAR(6) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'waiting',  -- waiting, ready, in_progress, completed
  game_settings JSONB DEFAULT '{"ends": 8}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### multiplayer_games
```sql
CREATE TABLE multiplayer_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id UUID REFERENCES lobbies(id) ON DELETE CASCADE,
  red_user_id UUID REFERENCES users(id),
  yellow_user_id UUID REFERENCES users(id),
  red_country VARCHAR(3),
  yellow_country VARCHAR(3),
  game_state JSONB NOT NULL,  -- Current state for reconnection
  red_score INTEGER DEFAULT 0,
  yellow_score INTEGER DEFAULT 0,
  winner_user_id UUID REFERENCES users(id),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP
);
```

#### player_ratings (Ranked Multiplayer)
```sql
CREATE TABLE player_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER DEFAULT 1200,  -- ELO rating
  rank VARCHAR(20) DEFAULT 'Bronze',
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  win_streak INTEGER DEFAULT 0,
  highest_rating INTEGER DEFAULT 1200,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### countries (Reference Data)
```sql
CREATE TABLE countries (
  code VARCHAR(3) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  flag_url VARCHAR(255),
  primary_color VARCHAR(7),    -- Hex color
  secondary_color VARCHAR(7)
);

-- Seed data for top curling nations
INSERT INTO countries (code, name, primary_color, secondary_color) VALUES
  ('CA', 'Canada', '#FF0000', '#FFFFFF'),
  ('SE', 'Sweden', '#006AA7', '#FECC00'),
  ('CH', 'Switzerland', '#FF0000', '#FFFFFF'),
  ('NO', 'Norway', '#BA0C2F', '#00205B'),
  ('GB', 'Great Britain', '#012169', '#FFFFFF'),
  ('US', 'United States', '#002868', '#BF0A30'),
  ('JP', 'Japan', '#FFFFFF', '#BC002D'),
  ('KR', 'South Korea', '#FFFFFF', '#0047A0'),
  ('CN', 'China', '#DE2910', '#FFDE00'),
  ('IT', 'Italy', '#009246', '#CE2B37'),
  ('DE', 'Germany', '#000000', '#DD0000'),
  ('SCO', 'Scotland', '#0065BD', '#FFFFFF');
```

---

## 8. Technical Recommendations

### Stack Suggestions
- **Runtime**: Node.js with Express or Fastify
- **Database**: PostgreSQL (relational data, JSONB for flexible fields)
- **Cache**: Redis (session storage, rate limiting)
- **AI Integration**: OpenAI API or Claude API for chat/strategy
- **Authentication**: JWT with refresh tokens
- **Hosting**: Vercel, Railway, or AWS

### Security Considerations
- Rate limiting on all endpoints
- Input validation and sanitization
- CORS configuration for frontend domain
- Secure password hashing (bcrypt)
- HTTPS only
- SQL injection prevention (parameterized queries)

### Performance Considerations
- Database indexing on user_id, played_at
- Pagination for match history
- Caching for leaderboards
- Connection pooling for database

### Offline Support
- Frontend should gracefully handle offline state
- Queue match results to sync when connection restored
- Local storage as fallback for career progress

---

## 9. Migration Path

### Phase 1: Core Backend
1. Set up database and user authentication
2. Implement career save/load endpoints
3. Replace localStorage with API calls (with fallback)
4. Add country selection to user profile

### Phase 2: Match History & Country Representation
1. Add match recording endpoint
2. Implement statistics aggregation
3. Build match history UI
4. Add country flags and colors to frontend
5. Display country representation at International+ levels

### Phase 3: Learn Mode
1. Integrate AI API for strategy suggestions
2. Build chatbot interface
3. Implement shot analysis feedback

### Phase 4: Online Multiplayer
1. Set up WebSocket server infrastructure
2. Implement lobby system (create, join, invite codes)
3. Build game state synchronization
4. Add matchmaking queue
5. Implement ranked system with ELO ratings
6. Add reconnection handling
7. Build multiplayer UI (lobby, waiting room, in-game)

### Phase 5: Polish & Social Features
- Global leaderboards (career + ranked)
- Player profiles with stats
- Match sharing/replays
- Emotes and quick chat
