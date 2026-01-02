// ============================================
// MULTIPLAYER - Supabase Realtime Integration
// ============================================

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

// ============================================
// MULTIPLAYER STATE
// ============================================

export const multiplayerState = {
  connected: false,
  inGame: false,
  isHost: false,
  roomCode: null,
  channel: null,

  // Player info
  localPlayer: {
    name: 'Player',
    country: null,
    team: null  // 'red' or 'yellow'
  },
  remotePlayer: {
    name: null,
    country: null,
    team: null
  },

  // Game state
  currentTurn: null,  // 'local' or 'remote'

  // Callbacks (set by main.js)
  onPlayerJoined: null,
  onPlayerLeft: null,
  onGameStart: null,
  onTossChoice: null,
  onColorChoice: null,
  onOpponentShot: null,
  onOpponentAimState: null,
  onChatMessage: null,
  onOpponentSweep: null,
  onStonePositions: null,
  onStonesSettled: null,
  onTurnTimeout: null,
  onEndComplete: null,
  onGameOver: null,
  onRematchRequest: null,
  onError: null
};

// ============================================
// ROOM CODE GENERATION
// ============================================

function generateRoomCode() {
  // 6 character alphanumeric code (uppercase, no ambiguous chars)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  // No I, O, 0, 1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================
// CONNECTION CHECK
// ============================================

export function isMultiplayerAvailable() {
  return supabase !== null;
}

// ============================================
// CREATE GAME (HOST)
// ============================================

export async function createGame(playerName, playerCountry, existingRoomCode = null) {
  if (!supabase) {
    console.error('[Multiplayer] Supabase not configured');
    return { success: false, error: 'Multiplayer not configured' };
  }

  const roomCode = existingRoomCode || generateRoomCode();

  try {
    // Create channel for this room
    const channel = supabase.channel(`game:${roomCode}`, {
      config: {
        broadcast: { self: false },  // Don't receive own broadcasts
        presence: { key: 'host' }
      }
    });

    // Set up event listeners
    setupChannelListeners(channel);

    // Subscribe to channel
    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Multiplayer] Room ${roomCode} created`);

        // Track presence
        await channel.track({
          name: playerName,
          country: playerCountry,
          role: 'host',
          status: 'waiting'
        });
      }
    });

    // Update state
    multiplayerState.connected = true;
    multiplayerState.isHost = true;
    multiplayerState.roomCode = roomCode;
    multiplayerState.channel = channel;
    multiplayerState.localPlayer = {
      name: playerName,
      country: playerCountry,
      team: 'red'  // Host is always red
    };

    return { success: true, roomCode };

  } catch (error) {
    console.error('[Multiplayer] Failed to create game:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// JOIN GAME (GUEST)
// ============================================

export async function joinGame(roomCode, playerName, playerCountry) {
  if (!supabase) {
    console.error('[Multiplayer] Supabase not configured');
    return { success: false, error: 'Multiplayer not configured' };
  }

  roomCode = roomCode.toUpperCase().trim();

  try {
    // Create channel for this room
    const channel = supabase.channel(`game:${roomCode}`, {
      config: {
        broadcast: { self: false },
        presence: { key: 'guest' }
      }
    });

    // Set up event listeners
    setupChannelListeners(channel);

    // Track when we see the host
    let hostFound = false;

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const hosts = state.host || [];

      if (hosts.length > 0 && !hostFound) {
        hostFound = true;
        const host = hosts[0];

        // Store host info
        multiplayerState.remotePlayer = {
          name: host.name,
          country: host.country,
          team: 'red'
        };

        console.log(`[Multiplayer] Found host: ${host.name}`);

        // Notify host that we joined
        channel.send({
          type: 'broadcast',
          event: 'player_joined',
          payload: {
            name: playerName,
            country: playerCountry
          }
        });
      }
    });

    // Subscribe to channel
    const subscribePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);

          // Track presence
          await channel.track({
            name: playerName,
            country: playerCountry,
            role: 'guest',
            status: 'ready'
          });

          // Wait a moment for presence sync
          setTimeout(() => {
            if (!hostFound) {
              reject(new Error('Room not found or host disconnected'));
            } else {
              resolve();
            }
          }, 2000);
        }
      });
    });

    await subscribePromise;

    // Update state
    multiplayerState.connected = true;
    multiplayerState.isHost = false;
    multiplayerState.roomCode = roomCode;
    multiplayerState.channel = channel;
    multiplayerState.localPlayer = {
      name: playerName,
      country: playerCountry,
      team: 'yellow'  // Guest is always yellow
    };

    return { success: true };

  } catch (error) {
    console.error('[Multiplayer] Failed to join game:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// CHANNEL EVENT LISTENERS
// ============================================

function setupChannelListeners(channel) {
  // Player joined (host receives this)
  channel.on('broadcast', { event: 'player_joined' }, ({ payload }) => {
    console.log('[Multiplayer] Player joined:', payload);

    multiplayerState.remotePlayer = {
      name: payload.name,
      country: payload.country,
      team: 'yellow'
    };

    if (multiplayerState.onPlayerJoined) {
      multiplayerState.onPlayerJoined(payload);
    }
  });

  // Game start
  channel.on('broadcast', { event: 'game_start' }, ({ payload }) => {
    console.log('[Multiplayer] Game starting:', payload);
    multiplayerState.inGame = true;

    if (multiplayerState.onGameStart) {
      multiplayerState.onGameStart(payload);
    }
  });

  // Toss choice (winner broadcasts their choice)
  channel.on('broadcast', { event: 'toss_choice' }, ({ payload }) => {
    console.log('[Multiplayer] Toss choice received:', payload);

    if (multiplayerState.onTossChoice) {
      multiplayerState.onTossChoice(payload);
    }
  });

  // Color choice (loser broadcasts their color when winner took hammer)
  channel.on('broadcast', { event: 'color_choice' }, ({ payload }) => {
    console.log('[Multiplayer] Color choice received:', payload);

    if (multiplayerState.onColorChoice) {
      multiplayerState.onColorChoice(payload);
    }
  });

  // Chat message
  channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
    console.log('[Multiplayer] Chat message received:', payload);

    if (multiplayerState.onChatMessage) {
      multiplayerState.onChatMessage(payload);
    }
  });

  // Opponent shot
  channel.on('broadcast', { event: 'shot' }, ({ payload }) => {
    console.log('[Multiplayer] Opponent shot:', payload);

    if (multiplayerState.onOpponentShot) {
      multiplayerState.onOpponentShot(payload);
    }
  });

  // Opponent aim state (real-time aiming preview)
  channel.on('broadcast', { event: 'aim_state' }, ({ payload }) => {
    if (multiplayerState.onOpponentAimState) {
      multiplayerState.onOpponentAimState(payload);
    }
  });

  // Opponent sweep
  channel.on('broadcast', { event: 'sweep' }, ({ payload }) => {
    if (multiplayerState.onOpponentSweep) {
      multiplayerState.onOpponentSweep(payload);
    }
  });

  // Stone positions (periodic sync during movement)
  channel.on('broadcast', { event: 'stone_positions' }, ({ payload }) => {
    if (multiplayerState.onStonePositions) {
      multiplayerState.onStonePositions(payload);
    }
  });

  // Stones settled (authoritative positions from host)
  channel.on('broadcast', { event: 'stones_settled' }, ({ payload }) => {
    console.log('[Multiplayer] Stones settled:', payload);

    if (multiplayerState.onStonesSettled) {
      multiplayerState.onStonesSettled(payload);
    }
  });

  // Turn timeout (opponent ran out of time)
  channel.on('broadcast', { event: 'turn_timeout' }, ({ payload }) => {
    console.log('[Multiplayer] Opponent timed out:', payload);

    if (multiplayerState.onTurnTimeout) {
      multiplayerState.onTurnTimeout(payload);
    }
  });

  // End complete
  channel.on('broadcast', { event: 'end_complete' }, ({ payload }) => {
    console.log('[Multiplayer] End complete:', payload);

    if (multiplayerState.onEndComplete) {
      multiplayerState.onEndComplete(payload);
    }
  });

  // Game over
  channel.on('broadcast', { event: 'game_over' }, ({ payload }) => {
    console.log('[Multiplayer] Game over:', payload);
    multiplayerState.inGame = false;

    if (multiplayerState.onGameOver) {
      multiplayerState.onGameOver(payload);
    }
  });

  // Rematch request
  channel.on('broadcast', { event: 'rematch_request' }, ({ payload }) => {
    console.log('[Multiplayer] Rematch requested');

    if (multiplayerState.onRematchRequest) {
      multiplayerState.onRematchRequest(payload);
    }
  });

  // Rematch accepted
  channel.on('broadcast', { event: 'rematch_accept' }, () => {
    console.log('[Multiplayer] Rematch accepted');
    // Trigger new game start
  });

  // Handle presence changes (disconnections)
  channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    console.log('[Multiplayer] Player left:', key, leftPresences);

    if (multiplayerState.onPlayerLeft) {
      multiplayerState.onPlayerLeft({ role: key });
    }
  });
}

// ============================================
// BROADCAST EVENTS
// ============================================

export function broadcastGameStart(payload) {
  if (!multiplayerState.channel) return;

  multiplayerState.channel.send({
    type: 'broadcast',
    event: 'game_start',
    payload
  });

  multiplayerState.inGame = true;
}

export function broadcastTossChoice(payload) {
  if (!multiplayerState.channel) return;

  // payload: { choice: 'hammer'|'color', hammer: team, color?: team }
  multiplayerState.channel.send({
    type: 'broadcast',
    event: 'toss_choice',
    payload
  });
}

export function broadcastColorChoice(payload) {
  if (!multiplayerState.channel) return;

  // payload: { color: 'red'|'yellow' } - loser's color choice when winner took hammer
  multiplayerState.channel.send({
    type: 'broadcast',
    event: 'color_choice',
    payload
  });
}

export function broadcastChat(message) {
  if (!multiplayerState.channel) return;

  multiplayerState.channel.send({
    type: 'broadcast',
    event: 'chat',
    payload: {
      sender: multiplayerState.localPlayer.name,
      message: message,
      timestamp: Date.now()
    }
  });
}

export function broadcastShot(power, angle, curlDirection, handleAmount, team) {
  if (!multiplayerState.channel) return;

  multiplayerState.channel.send({
    type: 'broadcast',
    event: 'shot',
    payload: { power, angle, curlDirection, handleAmount, team }
  });
}

export function broadcastAimState(targetX, targetZ, curlDirection, handleAmount) {
  if (!multiplayerState.channel) return;

  multiplayerState.channel.send({
    type: 'broadcast',
    event: 'aim_state',
    payload: { targetX, targetZ, curlDirection, handleAmount }
  });
}

export function broadcastSweep(active, direction) {
  if (!multiplayerState.channel) return;

  multiplayerState.channel.send({
    type: 'broadcast',
    event: 'sweep',
    payload: { active, direction }
  });
}

export function broadcastStonesSettled(positions) {
  if (!multiplayerState.channel || !multiplayerState.isHost) return;

  multiplayerState.channel.send({
    type: 'broadcast',
    event: 'stones_settled',
    payload: { positions }
  });
}

export function broadcastStonePositions(positions) {
  if (!multiplayerState.channel || !multiplayerState.isHost) return;

  multiplayerState.channel.send({
    type: 'broadcast',
    event: 'stone_positions',
    payload: { positions }
  });
}

export function broadcastEndComplete(scores, nextHammer) {
  if (!multiplayerState.channel || !multiplayerState.isHost) return;

  multiplayerState.channel.send({
    type: 'broadcast',
    event: 'end_complete',
    payload: { scores, nextHammer }
  });
}

export function broadcastGameOver(finalScores, winner) {
  if (!multiplayerState.channel || !multiplayerState.isHost) return;

  multiplayerState.channel.send({
    type: 'broadcast',
    event: 'game_over',
    payload: { finalScores, winner }
  });

  multiplayerState.inGame = false;
}

export function broadcastRematchRequest() {
  if (!multiplayerState.channel) return;

  multiplayerState.channel.send({
    type: 'broadcast',
    event: 'rematch_request',
    payload: { from: multiplayerState.isHost ? 'host' : 'guest' }
  });
}

export function broadcastRematchAccept() {
  if (!multiplayerState.channel) return;

  multiplayerState.channel.send({
    type: 'broadcast',
    event: 'rematch_accept',
    payload: {}
  });
}

// ============================================
// DISCONNECT / CLEANUP
// ============================================

export async function leaveGame() {
  if (multiplayerState.channel) {
    await multiplayerState.channel.unsubscribe();
    multiplayerState.channel = null;
  }

  // Reset state
  multiplayerState.connected = false;
  multiplayerState.inGame = false;
  multiplayerState.isHost = false;
  multiplayerState.roomCode = null;
  multiplayerState.remotePlayer = { name: null, country: null, team: null };
  multiplayerState.currentTurn = null;

  console.log('[Multiplayer] Left game');
}

// ============================================
// UTILITY
// ============================================

export function isMyTurn(currentTeam) {
  return currentTeam === multiplayerState.localPlayer.team;
}

export function getOpponentInfo() {
  return multiplayerState.remotePlayer;
}

export function getRoomCode() {
  return multiplayerState.roomCode;
}

export function isHost() {
  return multiplayerState.isHost;
}

export function isInMultiplayerGame() {
  return multiplayerState.connected && multiplayerState.inGame;
}

// ============================================
// RANKED MATCHMAKING
// ============================================

// Matchmaking state
export const matchmakingState = {
  inQueue: false,
  searchStartTime: null,
  pollInterval: null,
  playerId: null,
  playerRating: null,
  onMatchFound: null,
  onSearchUpdate: null
};

// Expanding window thresholds (max wait ~10 seconds)
const MATCHMAKING_WINDOWS = [
  { maxWait: 3000, eloRange: 200 },   // 0-3 sec: ±200 ELO
  { maxWait: 8000, eloRange: 500 },   // 3-8 sec: ±500 ELO
  { maxWait: Infinity, eloRange: 99999 }  // 8+ sec: Anyone
];

const POLL_INTERVAL = 1500;  // Check every 1.5 seconds

// Generate or retrieve persistent player ID
export function getPlayerId() {
  if (matchmakingState.playerId) return matchmakingState.playerId;

  let playerId = localStorage.getItem('curlingpro_player_id');
  if (!playerId) {
    playerId = 'player_' + Math.random().toString(36).substr(2, 12) + Date.now().toString(36);
    localStorage.setItem('curlingpro_player_id', playerId);
  }
  matchmakingState.playerId = playerId;
  return playerId;
}

// Get current ELO range based on wait time
function getCurrentEloRange() {
  if (!matchmakingState.searchStartTime) return MATCHMAKING_WINDOWS[0].eloRange;

  const waitTime = Date.now() - matchmakingState.searchStartTime;

  for (const window of MATCHMAKING_WINDOWS) {
    if (waitTime < window.maxWait) {
      return window.eloRange;
    }
  }

  return MATCHMAKING_WINDOWS[MATCHMAKING_WINDOWS.length - 1].eloRange;
}

// Get search status message based on wait time
function getSearchStatusMessage() {
  if (!matchmakingState.searchStartTime) return 'Finding opponent...';

  const waitTime = Date.now() - matchmakingState.searchStartTime;

  if (waitTime < 3000) {
    return 'Finding opponent near your skill level...';
  } else if (waitTime < 8000) {
    return 'Expanding search...';
  } else {
    return 'Matching with next available player...';
  }
}

// Initialize or get player rating
export async function getOrCreatePlayerRating(playerName) {
  if (!supabase) return { elo_rating: 1000, games_played: 0 };

  const playerId = getPlayerId();

  try {
    // Try to get existing rating
    const { data: existing, error: fetchError } = await supabase
      .from('player_ratings')
      .select('*')
      .eq('player_id', playerId)
      .single();

    if (existing) {
      // Update name if changed
      if (existing.player_name !== playerName) {
        await supabase
          .from('player_ratings')
          .update({ player_name: playerName })
          .eq('player_id', playerId);
      }
      matchmakingState.playerRating = existing;
      return existing;
    }

    // Create new rating
    const { data: newRating, error: insertError } = await supabase
      .from('player_ratings')
      .insert({
        player_id: playerId,
        player_name: playerName,
        elo_rating: 1000,
        games_played: 0,
        wins: 0,
        losses: 0
      })
      .select()
      .single();

    if (insertError) throw insertError;

    matchmakingState.playerRating = newRating;
    return newRating;
  } catch (error) {
    console.error('[Matchmaking] Error getting player rating:', error);
    return { elo_rating: 1000, games_played: 0 };
  }
}

// Join the matchmaking queue
export async function joinMatchmakingQueue(playerName, onMatchFound, onSearchUpdate) {
  if (!supabase) {
    console.error('[Matchmaking] Supabase not configured');
    return { success: false, error: 'Matchmaking not available' };
  }

  if (matchmakingState.inQueue) {
    console.warn('[Matchmaking] Already in queue');
    return { success: false, error: 'Already searching' };
  }

  const playerId = getPlayerId();
  const rating = await getOrCreatePlayerRating(playerName);

  try {
    // Remove any existing queue entry for this player
    await supabase
      .from('matchmaking_queue')
      .delete()
      .eq('player_id', playerId);

    // Add to queue
    const { error: insertError } = await supabase
      .from('matchmaking_queue')
      .insert({
        player_id: playerId,
        player_name: playerName,
        elo_rating: rating.elo_rating,
        status: 'waiting'
      });

    if (insertError) throw insertError;

    // Start matchmaking
    matchmakingState.inQueue = true;
    matchmakingState.searchStartTime = Date.now();
    matchmakingState.onMatchFound = onMatchFound;
    matchmakingState.onSearchUpdate = onSearchUpdate;

    console.log('[Matchmaking] Joined queue with ELO:', rating.elo_rating);

    // Start polling for matches
    pollForMatch(playerId, rating.elo_rating, playerName);

    return { success: true, elo: rating.elo_rating };

  } catch (error) {
    console.error('[Matchmaking] Error joining queue:', error);
    return { success: false, error: error.message };
  }
}

// Poll for available matches
async function pollForMatch(playerId, myElo, playerName) {
  if (!matchmakingState.inQueue) return;

  const eloRange = getCurrentEloRange();
  const statusMessage = getSearchStatusMessage();

  // Update UI with search status
  if (matchmakingState.onSearchUpdate) {
    const waitTime = Math.floor((Date.now() - matchmakingState.searchStartTime) / 1000);
    matchmakingState.onSearchUpdate({ status: statusMessage, waitTime, eloRange });
  }

  try {
    // First check if we've been matched by someone else
    const { data: myEntry } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .eq('player_id', playerId)
      .single();

    if (myEntry && myEntry.status === 'matched' && myEntry.room_code) {
      // We've been matched! Join the game
      console.log('[Matchmaking] Matched by opponent! Room:', myEntry.room_code);
      await handleMatchFound(myEntry.room_code, myEntry.matched_with, playerName, false);
      return;
    }

    // Look for opponents in our ELO range
    const { data: opponents, error } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .eq('status', 'waiting')
      .neq('player_id', playerId)
      .gte('elo_rating', myElo - eloRange)
      .lte('elo_rating', myElo + eloRange)
      .order('joined_at', { ascending: true })
      .limit(1);

    if (error) throw error;

    if (opponents && opponents.length > 0) {
      const opponent = opponents[0];
      console.log('[Matchmaking] Found opponent:', opponent.player_name, 'ELO:', opponent.elo_rating);

      // Create room and update both queue entries
      const roomCode = generateRoomCode();

      // Update opponent's entry
      const { error: updateError } = await supabase
        .from('matchmaking_queue')
        .update({
          status: 'matched',
          room_code: roomCode,
          matched_with: playerId
        })
        .eq('player_id', opponent.player_id)
        .eq('status', 'waiting');  // Only if still waiting

      if (updateError) {
        // Opponent might have been matched by someone else, try again
        console.log('[Matchmaking] Opponent already matched, retrying...');
        scheduleNextPoll(playerId, myElo, playerName);
        return;
      }

      // Update our entry
      await supabase
        .from('matchmaking_queue')
        .update({
          status: 'matched',
          room_code: roomCode,
          matched_with: opponent.player_id
        })
        .eq('player_id', playerId);

      // We're the host since we initiated the match
      await handleMatchFound(roomCode, opponent.player_id, playerName, true, opponent);
      return;
    }

    // No match found, schedule next poll
    scheduleNextPoll(playerId, myElo, playerName);

  } catch (error) {
    console.error('[Matchmaking] Poll error:', error);
    scheduleNextPoll(playerId, myElo, playerName);
  }
}

function scheduleNextPoll(playerId, myElo, playerName) {
  if (!matchmakingState.inQueue) return;

  matchmakingState.pollInterval = setTimeout(() => {
    pollForMatch(playerId, myElo, playerName);
  }, POLL_INTERVAL);
}

// Handle when a match is found
async function handleMatchFound(roomCode, opponentId, playerName, isHost, opponentData = null) {
  matchmakingState.inQueue = false;

  if (matchmakingState.pollInterval) {
    clearTimeout(matchmakingState.pollInterval);
    matchmakingState.pollInterval = null;
  }

  console.log('[Matchmaking] Match found! Room:', roomCode, 'isHost:', isHost);

  // Get opponent info if we don't have it
  let opponent = opponentData;
  if (!opponent && supabase) {
    const { data } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .eq('player_id', opponentId)
      .single();
    opponent = data;
  }

  // Clean up our queue entry (opponent's entry will be cleaned up by them)
  const playerId = getPlayerId();
  if (supabase) {
    supabase
      .from('matchmaking_queue')
      .delete()
      .eq('player_id', playerId)
      .then(() => console.log('[Matchmaking] Cleaned up queue entry'));
  }

  if (matchmakingState.onMatchFound) {
    matchmakingState.onMatchFound({
      roomCode,
      isHost,
      opponent: {
        id: opponentId,
        name: opponent?.player_name || 'Opponent',
        elo: opponent?.elo_rating || 1000
      }
    });
  }
}

// Leave the matchmaking queue
export async function leaveMatchmakingQueue() {
  matchmakingState.inQueue = false;
  matchmakingState.searchStartTime = null;

  if (matchmakingState.pollInterval) {
    clearTimeout(matchmakingState.pollInterval);
    matchmakingState.pollInterval = null;
  }

  if (!supabase) return;

  const playerId = getPlayerId();

  try {
    await supabase
      .from('matchmaking_queue')
      .delete()
      .eq('player_id', playerId);

    console.log('[Matchmaking] Left queue');
  } catch (error) {
    console.error('[Matchmaking] Error leaving queue:', error);
  }
}

// Calculate ELO change after a game
export function calculateEloChange(myElo, opponentElo, won) {
  const K = 32;  // K-factor (higher = more volatile ratings)
  const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - myElo) / 400));
  const actualScore = won ? 1 : 0;
  const change = Math.round(K * (actualScore - expectedScore));
  return change;
}

// Update player rating after a game
export async function updatePlayerRating(won, opponentElo) {
  if (!supabase) return null;

  const playerId = getPlayerId();
  const rating = matchmakingState.playerRating;

  if (!rating) return null;

  const eloChange = calculateEloChange(rating.elo_rating, opponentElo, won);
  const newElo = Math.max(100, rating.elo_rating + eloChange);  // Minimum 100 ELO

  try {
    const { data, error } = await supabase
      .from('player_ratings')
      .update({
        elo_rating: newElo,
        games_played: rating.games_played + 1,
        wins: won ? rating.wins + 1 : rating.wins,
        losses: won ? rating.losses : rating.losses + 1
      })
      .eq('player_id', playerId)
      .select()
      .single();

    if (error) throw error;

    matchmakingState.playerRating = data;

    console.log('[Matchmaking] Rating updated:', rating.elo_rating, '->', newElo, `(${eloChange >= 0 ? '+' : ''}${eloChange})`);

    return { oldElo: rating.elo_rating, newElo, change: eloChange };

  } catch (error) {
    console.error('[Matchmaking] Error updating rating:', error);
    return null;
  }
}

// Get player stats
export async function getPlayerStats() {
  if (!supabase) return null;

  const playerId = getPlayerId();

  try {
    const { data, error } = await supabase
      .from('player_ratings')
      .select('*')
      .eq('player_id', playerId)
      .single();

    if (error) throw error;
    return data;

  } catch (error) {
    console.error('[Matchmaking] Error getting stats:', error);
    return null;
  }
}

// Check if matchmaking is available
export function isMatchmakingAvailable() {
  return supabase !== null;
}
