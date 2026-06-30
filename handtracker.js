// Hand Tracker Service using MediaPipe Hands
// Includes a Mouse Simulation fallback for testing without a webcam.

let handTrackerRunning = false;
let inputMode = "mediapipe"; // 'mediapipe' | 'mouse'
let activeCamera = null;
let mpHands = null;
let webcamStream = null;
let animationFrameId = null;

// Tracked hands states
const trackedHands = {
    left: { x: 200, y: 250, state: "OPEN", rawX: 0, rawY: 0, active: false, lastActiveTime: 0 },
    right: { x: 600, y: 250, state: "OPEN", rawX: 0, rawY: 0, active: false, lastActiveTime: 0 }
};

// Mouse simulation variables
const mouseState = {
    x: 400,
    y: 250,
    aPressed: false,
    sPressed: false
};

// Audio synthesis utility (using Web Audio API) to create gameplay sound effects dynamically
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSynthSound(freq, type, duration) {
    try {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
        console.warn("Audio Context error:", e);
    }
}

// Global hook for callbacks
let onHandsDetectedCallback = null;

// Initialize MediaPipe Hands
function initHandTracker(videoElement, onResultsCallback) {
    onHandsDetectedCallback = onResultsCallback;
    
    // Set up mouse simulation listeners on window
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    if (typeof Hands === "undefined") {
        console.error("MediaPipe Hands library not loaded via CDN.");
        document.getElementById("mediapipe-loading").innerHTML = `
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; color: var(--left-hand);"></i>
            <p style="margin-top: 10px;">Failed to load MediaPipe from CDN. Please check your internet connection.</p>
        `;
        return;
    }

    try {
        mpHands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        mpHands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.6
        });

        mpHands.onResults((results) => {
            processMediaPipeResults(results);
            if (onHandsDetectedCallback) {
                onHandsDetectedCallback(trackedHands);
            }
        });

        document.getElementById("mediapipe-loading").style.display = "none";
        updateChecklist("chk-hands-dll", true);
        console.log("MediaPipe Hands Initialized Successfully.");
    } catch (err) {
        console.error("Error initializing MediaPipe Hands:", err);
    }
}

// Toggle input mode
function setInputMode(mode) {
    inputMode = mode;
    console.log("Input mode changed to:", mode);
    
    if (mode === "mouse") {
        trackedHands.left.active = true;
        trackedHands.right.active = true;
        updateChecklist("chk-left-hand", true);
        updateChecklist("chk-right-hand", true);
        
        // Hide calibration loading if active
        const loading = document.getElementById("mediapipe-loading");
        if (loading) loading.style.display = "none";
    } else {
        trackedHands.left.active = false;
        trackedHands.right.active = false;
        updateChecklist("chk-left-hand", false);
        updateChecklist("chk-right-hand", false);
    }
}

// Process coordinates from MediaPipe landmarks
function processMediaPipeResults(results) {
    // Reset active flags
    trackedHands.left.active = false;
    trackedHands.right.active = false;

    if (results.multiHandLandmarks && results.multiHandedness) {
        const currentTime = Date.now();
        
        for (let index = 0; index < results.multiHandLandmarks.length; index++) {
            const landmarks = results.multiHandLandmarks[index];
            const handedness = results.multiHandedness[index];
            
            // MediaPipe classification is mirrored relative to video:
            // "Left" label represents the player's physical right hand, "Right" represents physical left.
            // We want screen coordinates matching physical side.
            const isLeftHand = handedness.label === "Right"; 
            const side = isLeftHand ? "left" : "right";
            
            // Mirror coordinate x for camera mirroring
            const rawX = landmarks[9].x; // Using middle finger MCP as hand center
            const rawY = landmarks[9].y;
            
            // Convert to canvas coordinates (800x500 gameplay or 640x480 calibration)
            const targetWidth = activeCanvasId === "game-canvas" ? 800 : 640;
            const targetHeight = activeCanvasId === "game-canvas" ? 500 : 480;
            
            trackedHands[side].rawX = rawX;
            trackedHands[side].rawY = rawY;
            trackedHands[side].x = (1 - rawX) * targetWidth; // Mirror horizontally
            trackedHands[side].y = rawY * targetHeight;
            trackedHands[side].active = true;
            trackedHands[side].lastActiveTime = currentTime;

            // Gesture logic: Tips below Knuckles (MCP)
            const tips = [8, 12, 16, 20];
            const mcps = [5, 9, 13, 17];
            let fingersFolded = 0;
            
            for (let i = 0; i < 4; i++) {
                if (landmarks[tips[i]].y > landmarks[mcps[i]].y) {
                    fingersFolded++;
                }
            }
            
            const oldState = trackedHands[side].state;
            const newState = fingersFolded >= 3 ? "CLOSED" : "OPEN";
            trackedHands[side].state = newState;

            // Synthesize grab click sound feedback on state change
            if (oldState === "OPEN" && newState === "CLOSED") {
                playSynthSound(side === "left" ? 380 : 450, "sine", 0.08);
            }
            
            // Update checklist flags during calibration
            if (activeTab === "calibration") {
                updateChecklist(side === "left" ? "chk-left-hand" : "chk-right-hand", true);
            }
        }
    }
    
    // Check if hands lost tracking
    const threshold = 1500; // ms
    const now = Date.now();
    if (activeTab === "calibration") {
        if (!trackedHands.left.active && (now - trackedHands.left.lastActiveTime > threshold)) {
            updateChecklist("chk-left-hand", false);
        }
        if (!trackedHands.right.active && (now - trackedHands.right.lastActiveTime > threshold)) {
            updateChecklist("chk-right-hand", false);
        }
    }
}

// Start Web Camera feed
async function startWebcam(videoElement) {
    // Stop any existing animation frame loop
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    try {
        // Only request user media if we don't already have an active stream
        if (!webcamStream || !webcamStream.active || webcamStream.getVideoTracks().length === 0 || webcamStream.getVideoTracks()[0].readyState === 'ended') {
            console.log("Requesting new webcam stream...");
            webcamStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, frameRate: { ideal: 30 } }
            });
        } else {
            console.log("Reusing existing webcam stream.");
        }

        // Assign the stream to the new video element
        videoElement.srcObject = webcamStream;
        
        // Ensure video plays
        await videoElement.play().catch(e => console.warn("Video play interrupted/delayed:", e));
        
        updateChecklist("chk-webcam", true);
        handTrackerRunning = true;

        if (inputMode === "mediapipe" && mpHands) {
            const processFrame = async () => {
                if (!handTrackerRunning || inputMode !== "mediapipe") {
                    return;
                }
                
                // Ensure the video element has valid data before sending it to MediaPipe
                if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA or higher
                    try {
                        await mpHands.send({ image: videoElement });
                    } catch (e) {
                        console.error("Error sending frame to MediaPipe:", e);
                    }
                }
                
                if (handTrackerRunning && inputMode === "mediapipe") {
                    animationFrameId = requestAnimationFrame(processFrame);
                }
            };
            animationFrameId = requestAnimationFrame(processFrame);
        }
    } catch (err) {
        console.error("Error accessing webcam:", err);
        updateChecklist("chk-webcam", false);
        alert("Camera access denied or unavailable. You can use 'Mouse Simulation' mode in game selection to test.");
    }
}

// Stop Web Camera feed
async function stopWebcam(forceClose = false) {
    handTrackerRunning = false;
    
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    // If forceClose is true, or if we want to release the camera completely
    if (forceClose && webcamStream) {
        webcamStream.getTracks().forEach(track => {
            track.stop();
            console.log("Camera track stopped:", track.label);
        });
        webcamStream = null;
    }
    
    console.log(`Webcam frame processing stopped (forceClose: ${forceClose}).`);
}

// Keyboard input listeners for mouse simulation:
// Mouse controls general pointer. 'A' key grabs left, 'S' key grabs right.
function handleKeyDown(e) {
    if (inputMode !== "mouse") return;
    
    const key = e.key.toLowerCase();
    if (key === "a" && !mouseState.aPressed) {
        mouseState.aPressed = true;
        const oldState = trackedHands.left.state;
        trackedHands.left.state = "CLOSED";
        if (oldState === "OPEN") playSynthSound(380, "sine", 0.08);
    } else if (key === "s" && !mouseState.sPressed) {
        mouseState.sPressed = true;
        const oldState = trackedHands.right.state;
        trackedHands.right.state = "CLOSED";
        if (oldState === "OPEN") playSynthSound(450, "sine", 0.08);
    }
}

function handleKeyUp(e) {
    if (inputMode !== "mouse") return;
    
    const key = e.key.toLowerCase();
    if (key === "a") {
        mouseState.aPressed = false;
        trackedHands.left.state = "OPEN";
    } else if (key === "s") {
        mouseState.sPressed = false;
        trackedHands.right.state = "OPEN";
    }
}

// Mouse movement listener attached to canvas
function updateMouseSimulation(canvasElement, event) {
    if (inputMode !== "mouse") return;

    const rect = canvasElement.getBoundingClientRect();
    // Normalize mouse coordinates to match canvas coordinate aspect
    const scaleX = canvasElement.width / rect.width;
    const scaleY = canvasElement.height / rect.height;
    
    const mouseX = (event.clientX - rect.left) * scaleX;
    const mouseY = (event.clientY - rect.top) * scaleY;
    
    mouseState.x = mouseX;
    mouseState.y = mouseY;
    
    // Dumbbell positioning offsets (Left Offset, Right Offset)
    const offset = 90;
    
    trackedHands.left.x = mouseX - offset;
    trackedHands.left.y = mouseY;
    trackedHands.left.active = true;
    
    trackedHands.right.x = mouseX + offset;
    trackedHands.right.y = mouseY;
    trackedHands.right.active = true;

    if (onHandsDetectedCallback) {
        onHandsDetectedCallback(trackedHands);
    }
}

// Checklist UI Helper
function updateChecklist(elementId, isSuccess) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    if (isSuccess) {
        el.className = "completed";
    } else {
        el.className = "";
    }

    // Enable/disable proceed button based on requirements
    const webCamOk = document.getElementById("chk-webcam").classList.contains("completed");
    const mpOk = document.getElementById("chk-hands-dll").classList.contains("completed");
    const leftOk = document.getElementById("chk-left-hand").classList.contains("completed");
    const rightOk = document.getElementById("chk-right-hand").classList.contains("completed");
    
    const proceedBtn = document.getElementById("proceed-to-game-btn");
    if (proceedBtn) {
        // Allow proceeding if both hands are detected, OR if we are in mouse simulation mode
        if (inputMode === "mouse" || (webCamOk && mpOk && leftOk && rightOk)) {
            proceedBtn.disabled = false;
        } else {
            proceedBtn.disabled = true;
        }
    }
}

// Draw skeletons on canvas helper
function drawHandSkeleton(ctx, landmarks, colorGlow, colorBase) {
    if (!landmarks) return;
    
    const targetWidth = ctx.canvas.width;
    const targetHeight = ctx.canvas.height;
    
    // Convert 21 landmark points
    const points = landmarks.map(lm => ({
        x: (1 - lm.x) * targetWidth,
        y: lm.y * targetHeight
    }));

    ctx.save();
    
    // Draw bones connection lines
    ctx.lineWidth = 3;
    ctx.strokeStyle = colorBase;
    ctx.shadowBlur = 10;
    ctx.shadowColor = colorGlow;
    
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8], // Index
        [9, 10], [10, 11], [11, 12], // Middle
        [13, 14], [14, 15], [15, 16], // Ring
        [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
        [5, 9], [9, 13], [13, 17] // Palm Base
    ];

    connections.forEach(([start, end]) => {
        ctx.beginPath();
        ctx.moveTo(points[start].x, points[start].y);
        ctx.lineTo(points[end].x, points[end].y);
        ctx.stroke();
    });

    // Draw joints
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#FFFFFF";
    points.forEach((p, idx) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20 ? 6 : 4, 0, 2 * Math.PI);
        ctx.fill();
    });

    ctx.restore();
}
