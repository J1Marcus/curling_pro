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

-- ============================================
-- ANALYTICS SCHEMA
-- ============================================

-- Analytics sessions - track unique visitors and session duration
CREATE TABLE IF NOT EXISTS analytics_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,        -- Client-generated unique session ID
  player_id TEXT,                          -- Optional: linked player ID
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,                -- Calculated on session end
  device_type TEXT,                        -- 'mobile', 'tablet', 'desktop'
  browser TEXT,                            -- Browser name
  os TEXT,                                 -- Operating system
  screen_width INTEGER,
  screen_height INTEGER,
  referrer TEXT,                           -- Where they came from
  country TEXT                             -- Geo location (optional)
);

-- Analytics events - track specific user actions
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,                -- e.g., 'game_start', 'button_click', 'page_view'
  event_name TEXT NOT NULL,                -- e.g., 'career_mode', 'ready_button', 'settings'
  event_data JSONB,                        -- Additional context
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Analytics daily aggregates - for fast dashboard queries
CREATE TABLE IF NOT EXISTS analytics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  total_sessions INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  total_games_started INTEGER DEFAULT 0,
  total_games_completed INTEGER DEFAULT 0,
  career_games INTEGER DEFAULT 0,
  quick_games INTEGER DEFAULT 0,
  multiplayer_games INTEGER DEFAULT 0,
  avg_session_duration_seconds INTEGER DEFAULT 0,
  mobile_sessions INTEGER DEFAULT 0,
  desktop_sessions INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_started
  ON analytics_sessions(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_session_id
  ON analytics_sessions(session_id);

CREATE INDEX IF NOT EXISTS idx_analytics_events_session
  ON analytics_events(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type
  ON analytics_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_date
  ON analytics_daily(date DESC);

-- Enable RLS
ALTER TABLE analytics_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily ENABLE ROW LEVEL SECURITY;

-- Allow anonymous insert (for tracking)
CREATE POLICY "Allow anonymous insert on analytics_sessions"
  ON analytics_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update on analytics_sessions"
  ON analytics_sessions FOR UPDATE
  USING (true);

CREATE POLICY "Allow anonymous insert on analytics_events"
  ON analytics_events FOR INSERT
  WITH CHECK (true);

-- Read access requires service role (admin only) - no public read policy
-- The admin dashboard will use a service role key

-- Function to update daily aggregates (call from a cron job or trigger)
CREATE OR REPLACE FUNCTION update_analytics_daily(target_date DATE)
RETURNS void AS $$
BEGIN
  INSERT INTO analytics_daily (date, total_sessions, unique_visitors, avg_session_duration_seconds, mobile_sessions, desktop_sessions, updated_at)
  SELECT
    target_date,
    COUNT(*) as total_sessions,
    COUNT(DISTINCT COALESCE(player_id, session_id)) as unique_visitors,
    COALESCE(AVG(duration_seconds), 0)::INTEGER as avg_duration,
    COUNT(*) FILTER (WHERE device_type = 'mobile') as mobile,
    COUNT(*) FILTER (WHERE device_type = 'desktop') as desktop,
    NOW()
  FROM analytics_sessions
  WHERE started_at::DATE = target_date
  ON CONFLICT (date) DO UPDATE SET
    total_sessions = EXCLUDED.total_sessions,
    unique_visitors = EXCLUDED.unique_visitors,
    avg_session_duration_seconds = EXCLUDED.avg_session_duration_seconds,
    mobile_sessions = EXCLUDED.mobile_sessions,
    desktop_sessions = EXCLUDED.desktop_sessions,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Update game counts from events
CREATE OR REPLACE FUNCTION update_analytics_game_counts(target_date DATE)
RETURNS void AS $$
BEGIN
  UPDATE analytics_daily SET
    total_games_started = (
      SELECT COUNT(*) FROM analytics_events
      WHERE event_type = 'game_start' AND created_at::DATE = target_date
    ),
    total_games_completed = (
      SELECT COUNT(*) FROM analytics_events
      WHERE event_type = 'game_complete' AND created_at::DATE = target_date
    ),
    career_games = (
      SELECT COUNT(*) FROM analytics_events
      WHERE event_type = 'game_start' AND event_name = 'career' AND created_at::DATE = target_date
    ),
    quick_games = (
      SELECT COUNT(*) FROM analytics_events
      WHERE event_type = 'game_start' AND event_name = 'quickplay' AND created_at::DATE = target_date
    ),
    multiplayer_games = (
      SELECT COUNT(*) FROM analytics_events
      WHERE event_type = 'game_start' AND event_name = 'multiplayer' AND created_at::DATE = target_date
    ),
    updated_at = NOW()
  WHERE date = target_date;
END;
$$ LANGUAGE plpgsql;
