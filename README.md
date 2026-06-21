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

1.  Clone this repository locally.
2.  Navigate to the `Container` directory.
3.  Double-click **`index.html`** to open it directly in a web browser.
4.  No installation or development servers are required!

## 🌿 Branching Convention (`Lobby[Number]` & `main`)

This project implements an incremental branch-tracking strategy:
*   **Stable Production Branch (`main`)**: The source of truth for stable, fully tested, and verified code releases.
*   **Development Branches (`Lobby[Number]`)**: Every batch of features, updates, or modifications is pushed to a branch named `Lobby[Number]` (where `[Number]` increments with each update, e.g., `Lobby1`, `Lobby2`, `Lobby3`...). Once a Lobby branch is verified stable, its changes are merged or pushed into `main`, and the development branch is cleaned up.
