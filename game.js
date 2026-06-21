// Canvas-based rhythm game engine for Robo-Osu Rehab
// Controls beatmap playback, approach circles, collisions, and outputs metrics.

let gameLoopId = null;
let gameStartTime = 0;
let gamePaused = false;
let pauseOffset = 0;
let currentSongTime = 0;

let gameCanvas = null;
let gameCtx = null;
let activeBeatmap = null;
let activeDifficulty = 1;

let gameNotes = []; // List of active/upcoming note objects
let score = 0;
let combo = 0;
let maxCombo = 0;
let totalNotesInChart = 0;

// Sessions stats to log
const gameStats = {
    leftHits: 0,
    rightHits: 0,
    misses: 0,
    leftReactionTimes: [],
    rightReactionTimes: [],
    slidersTotal: 0,
    slidersCompleted: 0
};

// Hit Windows in ms based on difficulty
const HIT_WINDOWS = {
    1: 450, // Easy: 450ms leeway
    2: 300, // Medium: 300ms leeway
    3: 180  // Hard: 180ms leeway
};

// Callback when song completes
let onGameFinishedCallback = null;

function initGameEngine(canvasElement, onFinishedCallback) {
    gameCanvas = canvasElement;
    gameCtx = canvasElement.getContext("2d");
    onGameFinishedCallback = onFinishedCallback;
    
    // Attach mouse move events for mouse simulation fallback
    gameCanvas.addEventListener("mousemove", (e) => {
        if (inputMode === "mouse") {
            updateMouseSimulation(gameCanvas, e);
        }
    });
}

function startBeatmap(beatmap, difficulty) {
    activeBeatmap = beatmap;
    activeDifficulty = parseInt(difficulty);
    
    // Scale notes times according to difficulty
    const rawNotes = getScaleMapNotes(beatmap, activeDifficulty);
    totalNotesInChart = rawNotes.length;
    
    // Map to game structure
    gameNotes = rawNotes.map(n => {
        const mapped = {
            ...n,
            hit: false,
            missed: false,
            handUsed: null,
            approachScale: 2.5,
            reactionTimeMs: 0,
            fadeAlpha: 1.0,
            flashTime: 0,
            flashColor: null
        };
        
        if (n.type === "slider") {
            mapped.sliderProgress = 0; // 0 to 1
            mapped.lockedHand = null;
            mapped.holdingSucceeded = true;
            mapped.currentPos = { x: n.x, y: n.y };
            gameStats.slidersTotal++;
        }
        return mapped;
    });

    // Reset scores & metrics
    score = 0;
    combo = 0;
    maxCombo = 0;
    gameStats.leftHits = 0;
    gameStats.rightHits = 0;
    gameStats.misses = 0;
    gameStats.leftReactionTimes = [];
    gameStats.rightReactionTimes = [];
    gameStats.slidersTotal = gameNotes.filter(n => n.type === 'slider').length;
    gameStats.slidersCompleted = 0;
    
    updateGameplayHUD();
    
    gamePaused = false;
    pauseOffset = 0;
    gameStartTime = Date.now();
    currentSongTime = 0;
    
    // Play song start beep
    playSynthSound(580, "triangle", 0.2);
    setTimeout(() => playSynthSound(880, "triangle", 0.4), 250);

    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    gameLoopId = requestAnimationFrame(gameStep);
    
    console.log("Game started: ", beatmap.title);
}

function gameStep() {
    if (gamePaused) return;

    currentSongTime = Date.now() - gameStartTime - pauseOffset;
    
    updateGameLogic();
    drawGameScreen();
    
    // Check if song finished (last note completed and faded)
    const activeOrUpcoming = gameNotes.some(n => !n.hit && !n.missed || n.flashTime > 0);
    const durationFinished = currentSongTime > (activeBeatmap.duration * 1000);
    
    if (durationFinished && !activeOrUpcoming) {
        endGameSession();
    } else {
        gameLoopId = requestAnimationFrame(gameStep);
    }
}

function updateGameLogic() {
    const hitLeeway = HIT_WINDOWS[activeDifficulty];
    const hitRadius = activeDifficulty === 1 ? 55 : activeDifficulty === 2 ? 40 : 30;

    gameNotes.forEach(note => {
        // 1. Mark missed notes
        if (!note.hit && !note.missed) {
            const timeDiff = currentSongTime - note.time;
            
            if (note.type === "circle" && timeDiff > hitLeeway) {
                note.missed = true;
                combo = 0;
                gameStats.misses++;
                playSynthSound(150, "sawtooth", 0.15); // Miss sound
                updateGameplayHUD();
            } else if (note.type === "slider" && timeDiff > (note.duration + hitLeeway)) {
                note.missed = true;
                combo = 0;
                gameStats.misses++;
                playSynthSound(150, "sawtooth", 0.15); // Miss sound
                updateGameplayHUD();
            }
        }

        // 2. Spawn and update approach circles (start appearing 1000ms early)
        if (currentSongTime >= note.time - 1000 && !note.hit && !note.missed) {
            const totalDuration = 1000;
            const timeElapsed = currentSongTime - (note.time - 1000);
            note.approachScale = Math.max(1.0, 2.5 - (timeElapsed / totalDuration) * 1.5);
            
            // 3. Collision and Grab gesture checks (First-Come-First-Served)
            const handsToCheck = [];
            if (trackedHands.left.active) handsToCheck.push({ side: 'left', data: trackedHands.left });
            if (trackedHands.right.active) handsToCheck.push({ side: 'right', data: trackedHands.right });
            
            // Order hands randomly or by distance to prevent tie-breaking frames bias
            handsToCheck.forEach(handObj => {
                const hand = handObj.data;
                const side = handObj.side;
                
                // Dist between hand and note
                const dist = Math.hypot(hand.x - note.x, hand.y - note.y);
                const timeDiff = Math.abs(currentSongTime - note.time);
                
                if (dist <= hitRadius && timeDiff <= hitLeeway) {
                    if (note.type === "circle") {
                        // Gesture condition: Hand closed/grabbed
                        if (hand.state === "CLOSED") {
                            note.hit = true;
                            note.handUsed = side;
                            note.reactionTimeMs = timeDiff;
                            note.flashTime = 20; // 20 frames flash
                            note.flashColor = side === "left" ? "var(--left-hand)" : "var(--right-hand)";
                            
                            // Log metrics
                            combo++;
                            maxCombo = Math.max(maxCombo, combo);
                            score += Math.round(300 * (1 + combo * 0.05));
                            
                            if (side === "left") {
                                gameStats.leftHits++;
                                gameStats.leftReactionTimes.push(timeDiff);
                            } else {
                                gameStats.rightHits++;
                                gameStats.rightReactionTimes.push(timeDiff);
                            }
                            
                            playSynthSound(side === "left" ? 520 : 660, "sine", 0.12); // Hit sound
                            updateGameplayHUD();
                        }
                    } else if (note.type === "slider") {
                        // Slider start grab locking
                        if (currentSongTime >= note.time - 100 && currentSongTime <= note.time + hitLeeway) {
                            if (hand.state === "CLOSED" && !note.lockedHand) {
                                note.lockedHand = side;
                                playSynthSound(side === "left" ? 520 : 660, "sine", 0.1);
                            }
                        }
                    }
                }
            });
        }

        // 4. Update Sliders drag path progress
        if (note.type === "slider" && note.lockedHand && !note.hit && !note.missed) {
            const sliderElapsed = currentSongTime - note.time;
            
            if (sliderElapsed >= 0) {
                note.sliderProgress = Math.min(1.0, sliderElapsed / note.duration);
                
                // Interpolate position along the path
                const pathLength = note.path.length;
                const pathIndex = note.sliderProgress * (pathLength - 1);
                const baseIndex = Math.floor(pathIndex);
                const fract = pathIndex - baseIndex;
                
                let startPt = note.path[baseIndex];
                let endPt = note.path[Math.min(pathLength - 1, baseIndex + 1)];
                
                if (startPt && endPt) {
                    note.currentPos.x = startPt.x + (endPt.x - startPt.x) * fract;
                    note.currentPos.y = startPt.y + (endPt.y - startPt.y) * fract;
                }
                
                // Verify lock hand coordinates stay close to slider ball and hold closed
                const lockingHand = note.lockedHand === "left" ? trackedHands.left : trackedHands.right;
                const distToBall = Math.hypot(lockingHand.x - note.currentPos.x, lockingHand.y - note.currentPos.y);
                
                // If hand opened or drifted too far, slider break happens!
                if (distToBall > (hitRadius * 1.5) || lockingHand.state !== "CLOSED" || !lockingHand.active) {
                    note.holdingSucceeded = false;
                    note.lockedHand = null; // Break lock
                    combo = 0;
                    playSynthSound(200, "sawtooth", 0.2); // Slider break buzzer
                    updateGameplayHUD();
                }
                
                // Reached final endpoint successfully
                if (note.sliderProgress >= 1.0) {
                    note.hit = true;
                    note.handUsed = note.lockedHand;
                    note.reactionTimeMs = 50; // Sliders give minimal response delay penalty
                    note.flashTime = 20;
                    note.flashColor = note.lockedHand === "left" ? "var(--left-hand)" : "var(--right-hand)";
                    
                    combo++;
                    maxCombo = Math.max(maxCombo, combo);
                    score += Math.round(500 * (1 + combo * 0.05));
                    
                    if (note.lockedHand === "left") {
                        gameStats.leftHits++;
                        gameStats.leftReactionTimes.push(50);
                    } else {
                        gameStats.rightHits++;
                        gameStats.rightReactionTimes.push(50);
                    }
                    
                    gameStats.slidersCompleted++;
                    playSynthSound(note.lockedHand === "left" ? 700 : 880, "sine", 0.15); // Successful finish sound
                    updateGameplayHUD();
                }
            }
        }
        
        // Decrement hit flash frames
        if (note.flashTime > 0) {
            note.flashTime--;
            note.fadeAlpha = note.flashTime / 20;
        }
    });
}

function drawGameScreen() {
    gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
    
    // Draw Background Grid (since video background is transparency overlay)
    gameCtx.save();
    gameCtx.fillStyle = "#050811";
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    
    gameCtx.strokeStyle = "rgba(122, 92, 255, 0.03)";
    gameCtx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < gameCanvas.width; x += gridSize) {
        gameCtx.beginPath();
        gameCtx.moveTo(x, 0);
        gameCtx.lineTo(x, gameCanvas.height);
        ctx = gameCtx.stroke();
    }
    for (let y = 0; y < gameCanvas.height; y += gridSize) {
        gameCtx.beginPath();
        gameCtx.moveTo(0, y);
        gameCtx.lineTo(gameCanvas.width, y);
        gameCtx.stroke();
    }
    gameCtx.restore();

    const hitRadius = activeDifficulty === 1 ? 55 : activeDifficulty === 2 ? 40 : 30;

    // Draw game notes
    gameNotes.forEach(note => {
        const timeDiff = note.time - currentSongTime;
        
        // Render window: show notes appearing 1000ms early, or currently flashing on hit
        if ((timeDiff <= 1000 && !note.hit && !note.missed) || note.flashTime > 0) {
            
            // Slider Draw Path
            if (note.type === "slider") {
                gameCtx.save();
                gameCtx.beginPath();
                gameCtx.moveTo(note.path[0].x, note.path[0].y);
                for (let i = 1; i < note.path.length; i++) {
                    gameCtx.lineTo(note.path[i].x, note.path[i].y);
                }
                gameCtx.strokeStyle = note.lockedHand 
                    ? (note.lockedHand === "left" ? "rgba(255, 107, 107, 0.3)" : "rgba(19, 194, 194, 0.3)")
                    : "rgba(124, 141, 166, 0.2)";
                gameCtx.lineWidth = hitRadius * 1.5;
                gameCtx.lineCap = "round";
                gameCtx.lineJoin = "round";
                gameCtx.stroke();
                
                // Outer path track highlight border
                gameCtx.strokeStyle = note.lockedHand 
                    ? (note.lockedHand === "left" ? "rgba(255, 107, 107, 0.6)" : "rgba(19, 194, 194, 0.6)")
                    : "rgba(255, 255, 255, 0.1)";
                gameCtx.lineWidth = hitRadius * 1.5 + 4;
                gameCtx.stroke();
                gameCtx.restore();

                // Draw Slider End Circle
                const lastPt = note.path[note.path.length - 1];
                drawCircleNote(lastPt.x, lastPt.y, hitRadius, "rgba(20, 30, 51, 0.8)", "rgba(255, 255, 255, 0.2)");
            }

            // Draw Base Hit Circle
            let baseColor = "rgba(20, 30, 51, 0.8)";
            let strokeColor = "rgba(255, 255, 255, 0.4)";
            
            if (note.flashTime > 0) {
                baseColor = note.flashColor;
                strokeColor = "#FFFFFF";
            }
            
            const targetX = note.type === "slider" ? note.currentPos.x : note.x;
            const targetY = note.type === "slider" ? note.currentPos.y : note.y;
            
            drawCircleNote(targetX, targetY, hitRadius, baseColor, strokeColor, note.fadeAlpha);

            // Draw Approach Ring (shrinks down to perfect size)
            if (timeDiff > 0 && !note.hit) {
                gameCtx.save();
                gameCtx.beginPath();
                gameCtx.arc(targetX, targetY, hitRadius * note.approachScale, 0, 2 * Math.PI);
                gameCtx.strokeStyle = "rgba(255, 255, 255, 0.5)";
                gameCtx.lineWidth = 2;
                gameCtx.stroke();
                gameCtx.restore();
            }
            
            // Draw numerical score popup if hit
            if (note.hit && note.flashTime > 0) {
                gameCtx.save();
                gameCtx.font = "bold 14px 'Space Grotesk'";
                gameCtx.fillStyle = "rgba(255,255,255," + note.fadeAlpha + ")";
                gameCtx.textAlign = "center";
                gameCtx.fillText(note.type === "slider" ? "+500" : "+300", targetX, targetY - hitRadius - 10);
                gameCtx.restore();
            }
        }
    });

    // Draw hands indicators
    drawPlayerCursors();
}

function drawCircleNote(x, y, r, fill, stroke, alpha) {
    gameCtx.save();
    gameCtx.globalAlpha = alpha || 1.0;
    
    // Outer glow
    gameCtx.shadowBlur = 12;
    gameCtx.shadowColor = fill;
    
    // Core Fill
    gameCtx.beginPath();
    gameCtx.arc(x, y, r, 0, 2 * Math.PI);
    gameCtx.fillStyle = fill;
    gameCtx.fill();
    
    // Ring Border
    gameCtx.shadowBlur = 0;
    gameCtx.strokeStyle = stroke;
    gameCtx.lineWidth = 3;
    gameCtx.stroke();
    
    // Core center dot
    gameCtx.beginPath();
    gameCtx.arc(x, y, 6, 0, 2 * Math.PI);
    gameCtx.fillStyle = "#FFFFFF";
    gameCtx.fill();
    
    gameCtx.restore();
}

function drawPlayerCursors() {
    const cursorRadius = 25;
    
    // If MediaPipe is on, draw bones skeletons inside the canvas coordinates
    // (Hand tracker skeleton points are drawn directly by onHandsDetectedCallback calling drawHandSkeleton)
    
    const sides = ['left', 'right'];
    sides.forEach(side => {
        const hand = trackedHands[side];
        if (hand.active) {
            gameCtx.save();
            gameCtx.beginPath();
            gameCtx.arc(hand.x, hand.y, cursorRadius, 0, 2 * Math.PI);
            
            const color = side === "left" ? "var(--left-hand)" : "var(--right-hand)";
            const glow = side === "left" ? "var(--left-glow)" : "var(--right-glow)";
            
            gameCtx.shadowBlur = 10;
            gameCtx.shadowColor = glow;
            gameCtx.strokeStyle = color;
            gameCtx.lineWidth = hand.state === "CLOSED" ? 5 : 2;
            
            // Draw filled cursor (always visible, darker when hand is CLOSED)
            if (hand.state === "OPEN") {
                gameCtx.setLineDash([4, 4]);
                gameCtx.fillStyle = side === "left" ? "rgba(255, 107, 107, 0.08)" : "rgba(19, 194, 194, 0.08)";
            } else {
                gameCtx.fillStyle = side === "left" ? "rgba(255, 107, 107, 0.35)" : "rgba(19, 194, 194, 0.35)";
            }
            gameCtx.fill();
            
            gameCtx.stroke();
            
            // Label inside hand circle
            gameCtx.shadowBlur = 0;
            gameCtx.font = "bold 12px 'Space Grotesk'";
            gameCtx.fillStyle = color;
            gameCtx.textAlign = "center";
            gameCtx.textBaseline = "middle";
            gameCtx.fillText(side === "left" ? "L" : "R", hand.x, hand.y);
            
            gameCtx.restore();
        }
    });
}

function updateGameplayHUD() {
    const comboVal = document.getElementById("hud-combo-val");
    const scoreVal = document.getElementById("hud-score-val");
    const leftHitsVal = document.getElementById("hud-left-hits");
    const rightHitsVal = document.getElementById("hud-right-hits");
    
    if (comboVal) comboVal.innerText = combo;
    if (scoreVal) scoreVal.innerText = String(score).padStart(5, '0');
    if (leftHitsVal) leftHitsVal.innerText = gameStats.leftHits;
    if (rightHitsVal) rightHitsVal.innerText = gameStats.rightHits;
    
    // Update live Timer HUD (formatted min:sec)
    const timeVal = document.getElementById("hud-time-val");
    if (timeVal) {
        const secs = Math.floor(currentSongTime / 1000);
        const mins = Math.floor(secs / 60);
        const remSecs = secs % 60;
        timeVal.innerText = `${String(mins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`;
    }
}

function pauseGame() {
    if (!gamePaused) {
        gamePaused = true;
        this.pauseTime = Date.now();
        document.querySelector(".btn-hud-pause").innerHTML = `<i class="fa-solid fa-play"></i> Resume`;
    } else {
        gamePaused = false;
        pauseOffset += Date.now() - this.pauseTime;
        document.querySelector(".btn-hud-pause").innerHTML = `<i class="fa-solid fa-pause"></i> Pause`;
        gameLoopId = requestAnimationFrame(gameStep);
    }
}

function endGameSession() {
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null;
    }
    
    // Synthesize final victory trumpet chime
    playSynthSound(520, "triangle", 0.15);
    setTimeout(() => playSynthSound(660, "triangle", 0.15), 150);
    setTimeout(() => playSynthSound(880, "sine", 0.5), 300);

    // Calculate session averages
    const avgLeftRt = gameStats.leftReactionTimes.length > 0 
        ? Math.round(gameStats.leftReactionTimes.reduce((a,b) => a+b, 0) / gameStats.leftReactionTimes.length)
        : 0;
    const avgRightRt = gameStats.rightReactionTimes.length > 0 
        ? Math.round(gameStats.rightReactionTimes.reduce((a,b) => a+b, 0) / gameStats.rightReactionTimes.length)
        : 0;
        
    const sliderRate = gameStats.slidersTotal > 0
        ? gameStats.slidersCompleted / gameStats.slidersTotal
        : 1.0; // Default success rate

    const finalMetrics = {
        beatmapId: activeBeatmap.id,
        difficulty: activeDifficulty,
        totalNotes: totalNotesInChart,
        leftHits: gameStats.leftHits,
        rightHits: gameStats.rightHits,
        avgLeftRt: avgLeftRt,
        avgRightRt: avgRightRt,
        misses: gameStats.misses,
        sliderRate: sliderRate,
        score: score,
        maxCombo: maxCombo
    };

    if (onGameFinishedCallback) {
        onGameFinishedCallback(finalMetrics);
    }
}
