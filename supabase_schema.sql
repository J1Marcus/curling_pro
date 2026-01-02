-- ============================================
-- RANKED MATCHMAKING SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================

-- Player ratings table
CREATE TABLE IF NOT EXISTS player_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT UNIQUE NOT NULL,  -- Browser fingerprint or auth ID
  player_name TEXT NOT NULL DEFAULT 'Player',
  elo_rating INTEGER NOT NULL DEFAULT 1000,
  games_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Matchmaking queue table
CREATE TABLE IF NOT EXISTS matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT UNIQUE NOT NULL,
  player_name TEXT NOT NULL,
  elo_rating INTEGER NOT NULL DEFAULT 1000,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  room_code TEXT,  -- Set when matched
  matched_with TEXT,  -- Player ID of opponent
  status TEXT NOT NULL DEFAULT 'waiting'  -- 'waiting', 'matched', 'expired'
);

-- Index for efficient matchmaking queries
CREATE INDEX IF NOT EXISTS idx_queue_waiting ON matchmaking_queue(status, elo_rating, joined_at)
  WHERE status = 'waiting';

-- Index for finding by player_id
CREATE INDEX IF NOT EXISTS idx_queue_player ON matchmaking_queue(player_id);

-- Auto-update updated_at on player_ratings
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER player_ratings_updated_at
  BEFORE UPDATE ON player_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Clean up old queue entries (run periodically or via cron)
-- Entries older than 2 minutes are considered expired
CREATE OR REPLACE FUNCTION cleanup_old_queue_entries()
RETURNS void AS $$
BEGIN
  DELETE FROM matchmaking_queue
  WHERE joined_at < NOW() - INTERVAL '2 minutes';
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security (optional but recommended)
ALTER TABLE player_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for the game (using anon key)
CREATE POLICY "Allow anonymous read on player_ratings"
  ON player_ratings FOR SELECT
  USING (true);

CREATE POLICY "Allow anonymous insert on player_ratings"
  ON player_ratings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update on player_ratings"
  ON player_ratings FOR UPDATE
  USING (true);

CREATE POLICY "Allow anonymous read on matchmaking_queue"
  ON matchmaking_queue FOR SELECT
  USING (true);

CREATE POLICY "Allow anonymous insert on matchmaking_queue"
  ON matchmaking_queue FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update on matchmaking_queue"
  ON matchmaking_queue FOR UPDATE
  USING (true);

CREATE POLICY "Allow anonymous delete on matchmaking_queue"
  ON matchmaking_queue FOR DELETE
  USING (true);

-- Enable realtime for the queue table
ALTER PUBLICATION supabase_realtime ADD TABLE matchmaking_queue;

-- ============================================
-- MATCH HISTORY SCHEMA
-- ============================================

-- Match history table for tracking game results
CREATE TABLE IF NOT EXISTS match_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,              -- Player who owns this record
  player_name TEXT NOT NULL,            -- Player's name at time of match
  opponent_id TEXT,                      -- Opponent's player_id (null for AI opponents)
  opponent_name TEXT NOT NULL,           -- Opponent name or AI level name
  match_type TEXT NOT NULL,              -- 'ranked', 'private', 'career', 'quickplay'
  won BOOLEAN NOT NULL,
  player_score INTEGER NOT NULL,
  opponent_score INTEGER NOT NULL,
  end_scores JSONB,                      -- Per-end breakdown: { player: [...], opponent: [...] }
  player_elo_before INTEGER,             -- ELO before match (ranked only)
  player_elo_after INTEGER,              -- ELO after match (ranked only)
  elo_change INTEGER,                    -- ELO delta (ranked only)
  game_length INTEGER NOT NULL DEFAULT 8, -- Number of ends
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient player history queries (most recent first)
CREATE INDEX IF NOT EXISTS idx_match_history_player
  ON match_history(player_id, played_at DESC);

-- Enable RLS
ALTER TABLE match_history ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access
CREATE POLICY "Allow anonymous insert on match_history"
  ON match_history FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow anonymous read on match_history"
  ON match_history FOR SELECT
  USING (true);

-- Function to enforce 50-match limit per player (deletes oldest if over limit)
CREATE OR REPLACE FUNCTION enforce_match_history_limit()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM match_history
  WHERE id IN (
    SELECT id FROM match_history
    WHERE player_id = NEW.player_id
    ORDER BY played_at DESC
    OFFSET 50
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER match_history_limit_trigger
  AFTER INSERT ON match_history
  FOR EACH ROW
  EXECUTE FUNCTION enforce_match_history_limit();
