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

export async function createGame(playerName, playerCountry) {
  if (!supabase) {
    console.error('[Multiplayer] Supabase not configured');
    return { success: false, error: 'Multiplayer not configured' };
  }

  const roomCode = generateRoomCode();

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
