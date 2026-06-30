# Robo-Osu Rehab — Upper Limb Rhythm Therapy

**Robo-Osu Rehab** is an interactive, browser-based physical therapy application designed to assist patients in upper limb rehabilitation. Combining the addictive timing mechanics of rhythm games (Osu!) with real-time **Computer Vision** (MediaPipe Hands), it tracks and analyzes bilateral arm coordination without requiring expensive specialized sensors.

---

## 🔑 Core Philosophy: Natural Bilateral Selection

Unlike traditional physical therapy systems that lock left/right exercises to rigid zones on the screen, Robo-Osu Rehab introduces the **No Pre-separated Zones** principle:
*   **Neutral Targets**: Rhythm notes spawn dynamically across the screen in a neutral slate-grey color. No target is pre-assigned to a specific hand.
*   **First-Come-First-Served**: Whichever hand moves to a note and transitions from an *Open (แบมือ)* state to a *Closed (กำมือ)* state first claims the hit.
*   **Clinical Value**: This tracks and measures a patient's **natural hand usage**. Therapists can easily see if a patient is avoiding or compensating for their weaker side (e.g. crossing their dominant hand over to hit targets that are closer to their affected side).

---

## 🎨 Visual Design Tokens & Theme

The user interface uses a sleek, premium dark glassmorphism theme designed to look clinical yet modern:
*   **Background**: `#0B1220` (Deep space blue)
*   **Surface Cards**: `#141E33` (Semi-transparent with `backdrop-filter` blur)
*   **Left Hand (Coral)**: `#FF6B6B` (Visual representation, cursor glow, skeleton lines, HUD count, and hit flashes)
*   **Right Hand (Cyan)**: `#13C2C2` (Visual representation, cursor glow, skeleton lines, HUD count, and hit flashes)
*   **Font Display**: Space Grotesk (HUD values, header titles)
*   **Font Body**: Inter (Data tables, descriptions)

---

## 📂 Project Structure

```
Container/
├── index.html       # The single-page application shell & layout tabs
├── styles.css       # Complete custom glassmorphism design system & layouts
├── app.js           # Navigation routing, database logs, and diagnostic charts
├── game.js          # Canvas game loop, score counting, and sound synthesizers
├── beatmaps.js      # Timing and path coordinate tracks
├── handtracker.js   # MediaPipe Hands CDN connection & mouse simulation keys
└── .gitignore       # Standard local system and editor exclusions
```

---

## 🎮 Input Modes & Controls

The prototype supports two interactive tracking input modes:

### 1. Web Camera Tracking (MediaPipe Hands)
*   Connects to MediaPipe Hands via CDN and processes video streams client-side.
*   *Privacy*: All coordinates are processed in-browser. Video streams are never sent to external servers.
*   *Gestures*: To register a note hit, change hand state from `OPEN` (fingers spread) to `CLOSED` (make a fist, folding 3 or more fingers below the knuckles).

### 2. Mouse & Keyboard Simulation (Developer/Fallback mode)
*   Designed for testing without a webcam.
*   **Parallel Pointer**: Moving your mouse drives two cursors side-by-side representing the Left Hand and Right Hand offset by a parallel link.
*   **Left Hand Hit (Coral)**: Position the left cursor over a note and press the **`A`** key.
*   **Right Hand Hit (Cyan)**: Position the right cursor over a note and press the **`S`** key.

---

## 📈 Diagnostic Metrics & Therapist Dashboard

At the end of a session, a post-session summary compares usage ratios and reaction times. In **Therapist Mode**, the dashboard displays:
*   **Dominance Gap**: The absolute difference in usage ratios:
    $$\text{Dominance Gap} = |\text{Usage Ratio}_{\text{Right}} - \text{Usage Ratio}_{\text{Left}}|$$
*   **Compensation Flag**: If the Dominance Gap exceeds **30%**, the patient is flagged as having a clinical compensation behavior (avoiding the affected side).
*   **Symmetry Trend Chart**: A custom HTML5 canvas graph displaying bilateral usage progress over the last 5 sessions.

---

## 🚀 How to Run Locally

1. Clone this repository locally.
2. For the best user experience (so the browser remembers your camera permissions), run a local web server:
   * **Python:** Run `python -m http.server 8000` in the project root and navigate to `http://localhost:8000`.
   * **Node.js/npm:** Run `npx serve` and navigate to the provided localhost URL.
   * **VS Code:** Install the **Live Server** extension, right-click `index.html`, and select "Open with Live Server".
3. *Fallback/Offline:* You can double-click **`index.html`** to open it directly in a web browser, but note that the browser will prompt for camera permission every time the camera restarts due to security policies for `file://` URLs.

## 🌟 Lobby1 Updates (Bilateral Prognosis & Customization)

The following features and clinical tools were introduced in the **Lobby1** development batch:

### 1. 🧠 Predictive Bilateral Prognosis & Accuracy Model
- **Forecasting Algorithm**: Combines Linear Regression Extrapolation and Exponentially Weighted Moving Average (EWMA) to predict next-session dominance gap and left/right usage ratio.
- **Deficit & Weakness Analysis**: Detects which hand is trending weak and indicates specific movements (e.g. extension, shoulder abduction) that are at risk of avoidance or decay.
- **Prediction Confidence Rating**: Dynamically grades prediction confidence based on consistency (standard deviation) and number of completed sessions.
- **Backtesting Accuracy**: Measures historical model accuracy retrospectively by testing the forecasting algorithm against previous sessions.

### 2. ⏱️ Pre-game Countdown Timer
- Launches a large **3 ➔ 2 ➔ 1 ➔ GO!** countdown overlay before the gameplay starts.
- Keeps cameras and skeletons active during the countdown so players can calibrate hand positions.
- Pauses and resumes countdown tracking cleanly if the pause button is toggled.

### 3. 🟢 Very Easy Difficulty
- A slow-paced mode with huge note targets (70px), generous hit windows (600ms), and 1.8x slower time spacing.

### 4. 🎛️ Flexible (Custom) Difficulty & Randomization
- Adds adjustable sliders in the selection card to custom-configure:
  - **Total Notes**: 10 to 100 notes (loops/offsets maps dynamically).
  - **Spawn Interval Speed**: 0.5x to 2.5x.
  - **Hit Leeway Window**: 100ms to 1000ms.
- **Randomize Notes**: Option to stochastically shift target coordinates within safe boundaries for training variety.

### 5. 📷 Persistent Camera Stream & Redundant Prompts Fix
- **Webcam Stream Reuse**: Keeps the camera stream active when switching from calibration to gameplay to prevent repeated permission prompts.
- **Redundant getUserMedia Removal**: Replaced MediaPipe's default `Camera` setup with a custom `requestAnimationFrame` frame loop. This avoids the double camera requests triggered by creating duplicate camera contexts.
- **Graceful Shutdown**: Properly terminates stream tracks and turns off the camera light when navigating back to the Home/Dashboard or upon session completion.

---

## 🌿 Branching Convention (`Lobby[Number]` & `main`)

This project implements an incremental branch-tracking strategy:
*   **Stable Production Branch (`main`)**: The source of truth for stable, fully tested, and verified code releases.
*   **Development Branches (`Lobby[Number]`)**: Every batch of features, updates, or modifications is pushed to a branch named `Lobby[Number]` (where `[Number]` increments with each update, e.g., `Lobby1`, `Lobby2`, `Lobby3`...). Once a Lobby branch is verified stable, its changes are merged or pushed into `main`, and the development branch is cleaned up.
