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
  console.log('[Analytics] Supabase client initialized');
} else {
  console.log('[Analytics] Supabase not configured (missing env vars)');
}

// Enable debug mode with ?debug_analytics=1 in URL
if (typeof window !== 'undefined') {
  window.DEBUG_ANALYTICS = new URLSearchParams(window.location.search).has('debug_analytics');
}

// ============================================
// SESSION MANAGEMENT
// ============================================

let sessionId = null;
let sessionStartTime = null;
let lastActivityTime = null;
let activityUpdateInterval = null;
let sessionReadyPromise = null;
let sessionReadyResolve = null;

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
  if (!supabase) {
    // Create resolved promise if no supabase - events will be silently skipped
    sessionReadyPromise = Promise.resolve();
    return;
  }

  // Create promise that resolves when session is ready
  sessionReadyPromise = new Promise(resolve => {
    sessionReadyResolve = resolve;
  });

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
        referrer: document.referrer || null,
        last_activity: lastActivityTime.toISOString()
      });

    if (error) {
      console.warn('[Analytics] Failed to start session:', error.message);
      if (sessionReadyResolve) sessionReadyResolve();  // Resolve anyway so events don't hang
      return;
    }

    // Session is ready - resolve the promise so queued events can proceed
    if (sessionReadyResolve) sessionReadyResolve();

    // Update activity every 30 seconds while active
    activityUpdateInterval = setInterval(updateActivity, 30000);

    // Update on page visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // End session on page unload
    window.addEventListener('beforeunload', endSession);

    console.log('[Analytics] Session started:', sessionId);
  } catch (e) {
    console.warn('[Analytics] Error starting session:', e);
    if (sessionReadyResolve) sessionReadyResolve();  // Resolve anyway so events don't hang
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

// Handle visibility change (tab switch, minimize, mobile app background)
async function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    // Update activity timestamp
    await updateActivity();

    // Also update session duration (important for mobile where beforeunload doesn't fire)
    if (supabase && sessionId && sessionStartTime) {
      try {
        const now = new Date();
        const durationSeconds = Math.floor((now - sessionStartTime) / 1000);
        await supabase
          .from('analytics_sessions')
          .update({
            duration_seconds: durationSeconds
          })
          .eq('session_id', sessionId);
        console.log('[Analytics] Duration updated on visibility hidden:', durationSeconds, 'seconds');
      } catch (e) {
        // Silently fail
      }
    }
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
  if (!supabase) {
    console.log('[Analytics] No supabase client, skipping event:', eventType, eventName);
    return;
  }

  // Wait for session to be ready before tracking events
  if (sessionReadyPromise) {
    console.log('[Analytics] Waiting for session ready...');
    await sessionReadyPromise;
    console.log('[Analytics] Session ready, sessionId:', sessionId);
  }

  if (!sessionId) {
    console.warn('[Analytics] No session ID, skipping event:', eventType, eventName);
    return;
  }

  try {
    console.log('[Analytics] Inserting event:', { session_id: sessionId, event_type: eventType, event_name: eventName, event_data: eventData });

    const { data, error } = await supabase
      .from('analytics_events')
      .insert({
        session_id: sessionId,
        event_type: eventType,
        event_name: eventName,
        event_data: eventData
      })
      .select();

    if (error) {
      console.error('[Analytics] Event insert error:', error);
      // Show visible error for debugging on mobile
      if (window.DEBUG_ANALYTICS) {
        alert(`Analytics error: ${error.message}`);
      }
      return;
    }

    console.log('[Analytics] Event tracked:', eventType, eventName, data);
  } catch (e) {
    console.error('[Analytics] Failed to track event:', e);
    // Show visible error for debugging on mobile
    if (window.DEBUG_ANALYTICS) {
      alert(`Analytics exception: ${e.message}`);
    }
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
  console.log('[Analytics] trackGameStart called:', gameMode, difficulty);
  return trackEvent('game_start', gameMode, { difficulty });
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
