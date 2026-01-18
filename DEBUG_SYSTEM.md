# Debug System Documentation

## Overview
The debug system provides development/testing tools for quickly jumping to specific game scenarios.

## Components

### 1. Debug Button (index.html, line ~687)
- Location: Fixed position, bottom-right corner
- Appearance: Red button with "DEBUG" text
- Action: Calls `window.toggleDebugPanel()`
- **TO RE-ENABLE**: Remove `display: none;` from the button's style

### 2. Debug Panel (src/main.js, line ~20529)
- Created dynamically by `initDebugPanel()` function
- Panel ID: `debug-panel`
- Contains scenario buttons, tier selector, and state display

### 3. Debug Functions (src/main.js)

| Function | Line | Description |
|----------|------|-------------|
| `window.toggleDebugPanel()` | ~20522 | Shows/hides debug panel |
| `window.debugOlympicsFinal()` | ~20884 | Sets up Olympics gold medal match, last end |
| `window.debugTournamentFinal(tournamentId, autoStart)` | ~20095 | Sets up any tournament final |
| `window.debugStartFinalMatch(playerScore, opponentScore)` | ~20188 | Starts match in last end |
| `window.debugSetScenario(scenario)` | ~20613 | Sets up predefined scenarios |
| `window.debugSetTier()` | ~20801 | Changes career tier |
| `window.debugWinCurrentMatch()` | ~20814 | Instantly wins current match |
| `window.debugAdvanceEnd()` | ~20825 | Advances to next end with +2 points |
| `window.debugResetCareer()` | ~20841 | Resets all career data |
| `window.debugOlympicsCeremony()` | ~20851 | Shows Olympics ceremony UI only |
| `window.debugRefreshState()` | ~20596 | Refreshes state display |

### 4. Debug Panel Scenarios
- **Olympics Finals - LAST END**: Gold medal match, final end, winning 7-2
- **Finals - LAST END (6-4)**: Tournament final, last end
- **Finals (End 5, 6-2)**: Tournament final, mid-game winning
- **Finals (End 5, Tied 4-4)**: Tournament final, close game
- **Semis (End 4, 5-2)**: Semifinal match

## How to Re-Enable

In `index.html`, find the DEBUG BUTTON section (around line 687) and remove `display: none;` from the style:

```html
<!-- DISABLED - Remove "display: none;" to re-enable -->
<button onclick="window.toggleDebugPanel()" style="
  display: none;  <!-- REMOVE THIS LINE TO RE-ENABLE -->
  position: fixed;
  ...
```

All debug functions remain available in browser console even when button is hidden.
