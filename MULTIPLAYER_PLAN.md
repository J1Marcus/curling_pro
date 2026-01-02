# Online Multiplayer Implementation Plan

## Overview

Two players compete on separate devices over the internet using Supabase Realtime for communication.

---

## Architecture

```
Player 1 (Host)                 Supabase Realtime                 Player 2 (Guest)
     |                                |                                |
     |-- Create room "ABC123" ------->|                                |
     |                                |                                |
     |                                |<------- Join room "ABC123" ----|
     |<-- "Player 2 joined" ----------|                                |
     |                                |                                |
     |-- "Game starting" ------------>|-------- "Game starting" ------>|
     |                                |                                |
     |===== GAME LOOP =====           |          ===== GAME LOOP =====|
     |                                |                                |
     |-- Shot: {power, angle, curl} ->|----------------------------->|
     |                                |                                |
     |   [Both run physics locally]   |    [Both run physics locally] |
     |                                |                                |
     |<---------------------------- --|<-- Shot: {power, angle, curl} |
     |                                |                                |
     |-- End scores ----------------- |-------- End scores -------->  |
     |                                |                                |
     |-- Game over ----------------->|--------- Game over ---------->|
```

---

## Game Flow

### 1. Lobby Screen
- **Create Game**: Generate room code, wait for opponent
- **Join Game**: Enter room code, join existing game
- **Quick Match**: (Future) Auto-matchmaking queue

### 2. Waiting Room
- Host sees: "Waiting for opponent... Room: ABC123"
- Guest sees: "Joining game..." then "Connected!"
- Both see opponent's name/country when connected

### 3. Game Start
- Host is always RED (throws first in odd ends)
- Guest is always YELLOW
- Coin flip for first hammer shown to both

### 4. During Game
Each turn:
1. Active player aims and throws
2. Shot parameters sent to opponent: `{ power, angle, curl, sweepEvents }`
3. Both clients simulate physics locally (deterministic)
4. When stones stop, sync final positions to ensure consistency
5. Turn passes to other player

### 5. Game End
- Final scores synced
- Both see game over screen
- Option to rematch or return to lobby

---

## Supabase Realtime Events

### Channel: `game:{roomCode}`

| Event | Payload | Sender |
|-------|---------|--------|
| `player_joined` | `{ name, country }` | Guest |
| `game_start` | `{ hostCountry, guestCountry, firstHammer }` | Host |
| `shot` | `{ power, angle, curl, team }` | Active player |
| `sweep` | `{ active, direction }` | Throwing player |
| `stones_settled` | `{ positions: [...] }` | Host (authoritative) |
| `end_complete` | `{ scores, nextHammer }` | Host |
| `game_over` | `{ finalScores, winner }` | Host |
| `rematch_request` | `{ from }` | Either |
| `rematch_accept` | `{}` | Either |
| `player_left` | `{ reason }` | Either |

### Presence (who's in the room)
```js
channel.track({
  name: 'Player Name',
  country: 'CA',
  status: 'ready'  // or 'playing', 'disconnected'
})
```

---

## Client State Machine

```
[MODE_SELECT]
    |
    v
[MULTIPLAYER_LOBBY]
    |
    +--> Create Game --> [WAITING_FOR_OPPONENT]
    |                           |
    +--> Join Game ------------>+
                                |
                                v
                        [GAME_STARTING]
                                |
                                v
                          [IN_GAME]
                           /     \
                    (my turn)   (opponent turn)
                         |           |
                     [AIMING]   [WATCHING]
                         |           |
                     [THROWING] [WATCHING]
                         |           |
                     [SETTLING] [SETTLING]
                           \     /
                             v
                        [END_SCORED]
                             |
                   (more ends? / game over?)
                            / \
                           v   v
                    [IN_GAME] [GAME_OVER]
                                 |
                                 v
                        [REMATCH_PROMPT]
                              / \
                             v   v
                    [IN_GAME] [MULTIPLAYER_LOBBY]
```

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `src/multiplayer.js` | Supabase connection, room management, event handlers |

### Modified Files
| File | Changes |
|------|---------|
| `index.html` | Add lobby UI, waiting screen, opponent indicator |
| `src/main.js` | Integrate multiplayer state, handle remote shots |
| `package.json` | Add `@supabase/supabase-js` dependency |
| `.env.example` | Add Supabase URL and anon key |

---

## Implementation Phases

### Phase 1: Setup & Lobby
- [ ] Install Supabase client
- [ ] Create multiplayer.js with connection logic
- [ ] Build lobby UI (create/join game)
- [ ] Implement room creation with codes
- [ ] Implement room joining
- [ ] Add presence tracking

### Phase 2: Game Sync
- [ ] Send shot parameters on throw
- [ ] Receive and replay opponent shots
- [ ] Sync stone positions after settling
- [ ] Handle turn transitions
- [ ] Sync end scoring

### Phase 3: Polish
- [ ] Handle disconnections gracefully
- [ ] Add reconnection support
- [ ] Implement rematch flow
- [ ] Add opponent name/country display during game
- [ ] Test latency edge cases

---

## Supabase Project Setup

### Required
1. Create Supabase project (or use existing)
2. Enable Realtime on the project
3. Get project URL and anon key
4. Add to `.env`:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### No Database Tables Needed
We're only using Realtime Broadcast and Presence - no persistent storage required for the basic implementation.

---

## Security Considerations

- Room codes should be short but unguessable (6 chars, alphanumeric)
- No sensitive data in broadcast messages
- Anon key is safe to expose (it's designed for client-side use)
- Consider rate limiting room creation to prevent abuse

---

## Future Enhancements

- **Ranked Matchmaking**: Database tables for player stats, ELO ratings
- **Spectator Mode**: Additional channel subscribers who only receive events
- **Chat/Emotes**: Simple predefined messages between players
- **Rematch History**: Track games between same players
