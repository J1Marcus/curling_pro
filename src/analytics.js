// ============================================
// ANALYTICS - User Interaction Tracking
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
// SESSION MANAGEMENT
// ============================================

let sessionId = null;
let sessionStartTime = null;
let lastActivityTime = null;
let activityUpdateInterval = null;

// Generate unique session ID
function generateSessionId() {
  return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
}

// Get device info
function getDeviceInfo() {
  const ua = navigator.userAgent;
  let deviceType = 'desktop';
  let browser = 'unknown';
  let os = 'unknown';

  // Detect device type
  if (/Mobi|Android/i.test(ua)) {
    deviceType = /Tablet|iPad/i.test(ua) ? 'tablet' : 'mobile';
  }

  // Detect browser
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';

  // Detect OS
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return {
    deviceType,
    browser,
    os,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height
  };
}

// Start a new analytics session
export async function startSession() {
  if (!supabase) return;

  try {
    sessionId = generateSessionId();
    sessionStartTime = new Date();
    lastActivityTime = new Date();

    const deviceInfo = getDeviceInfo();
    const playerId = localStorage.getItem('curlingpro_player_id') || null;

    const { error } = await supabase
      .from('analytics_sessions')
      .insert({
        session_id: sessionId,
        player_id: playerId,
        device_type: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        screen_width: deviceInfo.screenWidth,
        screen_height: deviceInfo.screenHeight,
        referrer: document.referrer || null
      });

    if (error) {
      console.warn('[Analytics] Failed to start session:', error.message);
      return;
    }

    // Update activity every 30 seconds while active
    activityUpdateInterval = setInterval(updateActivity, 30000);

    // Update on page visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // End session on page unload
    window.addEventListener('beforeunload', endSession);

    console.log('[Analytics] Session started:', sessionId);
  } catch (e) {
    console.warn('[Analytics] Error starting session:', e);
  }
}

// Update last activity timestamp
async function updateActivity() {
  if (!supabase || !sessionId) return;

  try {
    lastActivityTime = new Date();
    await supabase
      .from('analytics_sessions')
      .update({ last_activity: lastActivityTime.toISOString() })
      .eq('session_id', sessionId);
  } catch (e) {
    // Silently fail - not critical
  }
}

// Handle visibility change (tab switch, minimize)
function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    updateActivity();
  }
}

// End the session
export async function endSession() {
  if (!supabase || !sessionId) return;

  try {
    clearInterval(activityUpdateInterval);

    const endTime = new Date();
    const durationSeconds = Math.floor((endTime - sessionStartTime) / 1000);

    await supabase
      .from('analytics_sessions')
      .update({
        ended_at: endTime.toISOString(),
        duration_seconds: durationSeconds
      })
      .eq('session_id', sessionId);

    console.log('[Analytics] Session ended, duration:', durationSeconds, 'seconds');
  } catch (e) {
    // Silently fail - page is unloading
  }
}

// ============================================
// EVENT TRACKING
// ============================================

// Track a custom event
export async function trackEvent(eventType, eventName, eventData = null) {
  if (!supabase || !sessionId) return;

  try {
    await supabase
      .from('analytics_events')
      .insert({
        session_id: sessionId,
        event_type: eventType,
        event_name: eventName,
        event_data: eventData
      });

    console.log('[Analytics] Event tracked:', eventType, eventName);
  } catch (e) {
    console.warn('[Analytics] Failed to track event:', e);
  }
}

// ============================================
// CONVENIENCE METHODS
// ============================================

// Track page/screen view
export function trackPageView(pageName) {
  trackEvent('page_view', pageName);
}

// Track button click
export function trackButtonClick(buttonName) {
  trackEvent('button_click', buttonName);
}

// Track game start
export function trackGameStart(gameMode, difficulty = null) {
  trackEvent('game_start', gameMode, { difficulty });
}

// Track game complete
export function trackGameComplete(gameMode, won, playerScore, opponentScore, endsPlayed) {
  trackEvent('game_complete', gameMode, {
    won,
    playerScore,
    opponentScore,
    endsPlayed,
    scoreDiff: playerScore - opponentScore
  });
}

// Track feature usage
export function trackFeatureUsage(featureName) {
  trackEvent('feature_use', featureName);
}

// Track error
export function trackError(errorType, errorMessage, details = {}) {
  trackEvent('error', errorType, { message: errorMessage, ...details });
}

// ============================================
// AUTOMATIC ERROR TRACKING
// ============================================

// Catch JavaScript errors
window.onerror = function(message, source, lineno, colno, error) {
  trackError('js_error', message, {
    source: source?.split('/').pop() || 'unknown',  // Just filename
    line: lineno,
    column: colno,
    stack: error?.stack?.slice(0, 500) || null  // Limit stack trace size
  });
  return false;  // Don't suppress the error
};

// Catch unhandled promise rejections
window.addEventListener('unhandledrejection', function(event) {
  const reason = event.reason;
  trackError('promise_rejection', reason?.message || String(reason), {
    stack: reason?.stack?.slice(0, 500) || null
  });
});

// ============================================
// INITIALIZATION
// ============================================

// Auto-start session when module loads
if (typeof window !== 'undefined') {
  // Delay to ensure page is ready
  if (document.readyState === 'complete') {
    startSession();
  } else {
    window.addEventListener('load', startSession);
  }
}

// Export for use in other modules
export default {
  startSession,
  endSession,
  trackEvent,
  trackPageView,
  trackButtonClick,
  trackGameStart,
  trackGameComplete,
  trackFeatureUsage,
  trackError
};
