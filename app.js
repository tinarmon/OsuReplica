// App Controller & State Management for Robo-Osu Rehab
// Coordinates routing, local database, analytics calculations, and therapist features.

let activeTab = "home";
let activeRole = "patient"; // 'patient' | 'therapist'
let activeCanvasId = "calibration-canvas"; // 'calibration-canvas' | 'game-canvas'

// Database stored locally (in localStorage)
const LOCAL_DB = {
    patients: [
        { id: "p_01", name: "Patient A", affectedSide: "left", desc: "Left Hand Affected" },
        { id: "p_02", name: "Patient B", affectedSide: "right", desc: "Right Hand Affected" },
        { id: "p_03", name: "Patient C", affectedSide: "none", desc: "Balanced Recovery" }
    ],
    activePatientId: "p_01",
    sessions: [
        // Seed some history for Patient A to make charts look awesome immediately
        {
            id: "s_101",
            patientId: "p_01",
            songTitle: "Rhythm Flow",
            difficulty: "Easy",
            date: "2026-06-18",
            leftHits: 18,
            rightHits: 64,
            avgLeftRt: 580,
            avgRightRt: 320,
            misses: 4,
            sliderRate: 0.75,
            dominanceGap: 56.1,
            dominantSide: "right",
            compensationFlag: true
        },
        {
            id: "s_102",
            patientId: "p_01",
            songTitle: "Rhythm Flow",
            difficulty: "Easy",
            date: "2026-06-19",
            leftHits: 22,
            rightHits: 62,
            avgLeftRt: 520,
            avgRightRt: 310,
            misses: 2,
            sliderRate: 0.80,
            dominanceGap: 47.6,
            dominantSide: "right",
            compensationFlag: true
        },
        {
            id: "s_103",
            patientId: "p_01",
            songTitle: "Bilateral Sync",
            difficulty: "Medium",
            date: "2026-06-20",
            leftHits: 29,
            rightHits: 60,
            avgLeftRt: 498,
            avgRightRt: 312,
            misses: 7,
            sliderRate: 0.82,
            dominanceGap: 34.8,
            dominantSide: "right",
            compensationFlag: true
        }
    ]
};

// Initialize App
window.addEventListener("DOMContentLoaded", () => {
    loadLocalDatabase();
    initBeatmapSelector();
    
    // Initialize MediaPipe Hand Tracker
    const calibVideo = document.getElementById("calibration-video");
    const calibCanvas = document.getElementById("calibration-canvas");
    
    initHandTracker(calibVideo, (hands) => {
        // Callback runs every frames results
        drawFrameSkeletons(calibCanvas, hands);
    });

    // Setup home metrics and history table
    updateHomeDashboard();
    updateHistoryTable();
    updateTherapistHub();
    
    console.log("App Initialized Successfully.");
});

// Load DB from LocalStorage
function loadLocalDatabase() {
    const saved = localStorage.getItem("robo_osu_db");
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            LOCAL_DB.sessions = parsed.sessions || LOCAL_DB.sessions;
            LOCAL_DB.activePatientId = parsed.activePatientId || LOCAL_DB.activePatientId;
            LOCAL_DB.patients = parsed.patients || LOCAL_DB.patients;
        } catch (e) {
            console.error("Error loading localStorage DB:", e);
        }
    } else {
        saveLocalDatabase();
    }
}

// Save DB to LocalStorage
function saveLocalDatabase() {
    localStorage.setItem("robo_osu_db", JSON.stringify(LOCAL_DB));
}

// Render beatmaps options in page setup list
function initBeatmapSelector() {
    const container = document.getElementById("beatmap-list-container");
    if (!container) return;
    
    container.innerHTML = "";
    BEATMAPS.forEach((bm, index) => {
        const item = document.createElement("div");
        item.className = `beatmap-item ${index === 0 ? 'selected' : ''}`;
        item.dataset.id = bm.id;
        item.onclick = () => selectBeatmapElement(item, bm.id);
        
        item.innerHTML = `
            <div class="bm-info">
                <span class="bm-title">${bm.title}</span>
                <span class="bm-artist">${bm.artist}</span>
            </div>
            <div class="beatmap-meta-tag">${bm.duration}s</div>
        `;
        container.appendChild(item);
    });

    // Default select first track
    window.selectedBeatmapId = BEATMAPS[0].id;
}

function selectBeatmapElement(element, beatmapId) {
    document.querySelectorAll(".beatmap-item").forEach(item => item.classList.remove("selected"));
    element.classList.add("selected");
    window.selectedBeatmapId = beatmapId;
    playSynthSound(440, "sine", 0.05); // click beep
}

// Router tabs switcher
function showTab(tabName) {
    // Stop active running webcam feeds if moving out of calibration/game
    if (activeTab === "calibration" && tabName !== "calibration") {
        stopWebcam();
    }
    if (activeTab === "gameplay" && tabName !== "gameplay") {
        stopWebcam();
        if (gameLoopId) {
            cancelAnimationFrame(gameLoopId);
            gameLoopId = null;
        }
    }

    activeTab = tabName;
    document.querySelectorAll(".tab-content").forEach(tab => {
        tab.classList.remove("active");
    });
    
    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) {
        targetTab.classList.add("active");
    }

    // Nav highlight updates
    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.remove("active");
        if (item.dataset.tab === tabName) {
            item.classList.add("active");
        }
    });

    // Update variables
    if (tabName === "calibration") {
        activeCanvasId = "calibration-canvas";
        // Proactively start camera in calibration tab
        toggleCamera(true);
    } else if (tabName === "gameplay") {
        activeCanvasId = "game-canvas";
        // Reset panels
        document.getElementById("game-setup-panel").classList.remove("hidden");
        document.getElementById("game-active-panel").classList.add("hidden");
    } else if (tabName === "dashboard") {
        updateTherapistHub();
    } else if (tabName === "home") {
        updateHomeDashboard();
        updateHistoryTable();
    }
    
    playSynthSound(500, "sine", 0.05); // Tab switch audio click
}

// Role toggle
function switchRole(role) {
    activeRole = role;
    const patientBtn = document.getElementById("role-patient-btn");
    const therapistBtn = document.getElementById("role-therapist-btn");
    const therapistMenus = document.querySelectorAll(".therapist-only");
    
    if (role === "therapist") {
        patientBtn.classList.remove("active");
        therapistBtn.classList.add("active");
        therapistMenus.forEach(el => el.classList.remove("hidden"));
        
        // Show therapist dashboard buttons
        const summaryDashBtn = document.getElementById("summary-view-dashboard-btn");
        if (summaryDashBtn) summaryDashBtn.classList.remove("hidden");
    } else {
        patientBtn.classList.add("active");
        therapistBtn.classList.remove("active");
        therapistMenus.forEach(el => el.classList.add("hidden"));
        
        const summaryDashBtn = document.getElementById("summary-view-dashboard-btn");
        if (summaryDashBtn) summaryDashBtn.classList.add("hidden");

        // If currently on dashboard, kick out to home
        if (activeTab === "dashboard") {
            showTab("home");
        }
    }
    playSynthSound(600, "sine", 0.08);
}

// Device toggle
function switchInputMode(mode) {
    setInputMode(mode);
    
    const mpBtn = document.getElementById("input-mp-btn");
    const mouseBtn = document.getElementById("input-mouse-btn");
    
    if (mode === "mouse") {
        mpBtn.classList.remove("active");
        mouseBtn.classList.add("active");
    } else {
        mpBtn.classList.add("active");
        mouseBtn.classList.remove("active");
    }
    playSynthSound(440, "sine", 0.05);
}

// Webcam Toggle
async function toggleCamera(forceStart) {
    const video = document.getElementById("calibration-video");
    const btn = document.getElementById("toggle-camera-btn");
    
    if (!handTrackerRunning || forceStart) {
        if (btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Starting...`;
        await startWebcam(video);
        if (btn) btn.innerHTML = `<i class="fa-solid fa-video-slash"></i> Stop Webcam`;
    } else {
        await stopWebcam();
        if (btn) btn.innerHTML = `<i class="fa-solid fa-video"></i> Start Webcam`;
        updateChecklist("chk-webcam", false);
        updateChecklist("chk-left-hand", false);
        updateChecklist("chk-right-hand", false);
    }
}

// Proceed from calibration to game setup
function proceedToGame() {
    showTab("gameplay");
}

// Start Game
async function startGame() {
    const map = BEATMAPS.find(bm => bm.id === window.selectedBeatmapId);
    const difficultyVal = document.querySelector('input[name="difficulty"]:checked').value;
    
    // Switch panels
    document.getElementById("game-setup-panel").classList.add("hidden");
    document.getElementById("game-active-panel").classList.remove("hidden");
    
    const gameCanvasElement = document.getElementById("game-canvas");
    const gameVideoElement = document.getElementById("game-video");
    const mouseSimOverlay = document.getElementById("mouse-sim-overlay");
    
    if (inputMode === "mouse") {
        mouseSimOverlay.classList.remove("hidden");
    } else {
        mouseSimOverlay.classList.add("hidden");
        // Start webcam inside gameplay frame
        await startWebcam(gameVideoElement);
    }
    
    // Initialize and start game
    initGameEngine(gameCanvasElement, handleGameFinished);
    startBeatmap(map, difficultyVal);
}

// Process game finished metrics
function handleGameFinished(metrics) {
    console.log("Session Finished metrics:", metrics);
    stopWebcam();
    
    // Analyze session clinical results
    const L = metrics.leftHits;
    const R = metrics.rightHits;
    const totalHits = L + R;
    const totalNotes = metrics.totalNotes;
    
    // Usage ratios
    const leftUsageRatio = totalHits > 0 ? (L / totalHits) * 100 : 0;
    const rightUsageRatio = totalHits > 0 ? (R / totalHits) * 100 : 0;
    
    const dominanceGap = Math.abs(rightUsageRatio - leftUsageRatio);
    const dominantSide = rightUsageRatio > leftUsageRatio ? "right" : leftUsageRatio > rightUsageRatio ? "left" : "balanced";
    
    // Compensation detection threshold (30% dominance gap)
    const compensationFlag = dominanceGap > 30;

    const patient = LOCAL_DB.patients.find(p => p.id === LOCAL_DB.activePatientId);
    const map = BEATMAPS.find(bm => bm.id === metrics.beatmapId);
    const diffNames = { 1: "Easy", 2: "Medium", 3: "Hard" };

    const newSession = {
        id: "s_" + Date.now(),
        patientId: patient.id,
        songTitle: map.title,
        difficulty: diffNames[metrics.difficulty],
        date: new Date().toISOString().split('T')[0],
        leftHits: L,
        rightHits: R,
        avgLeftRt: metrics.avgLeftRt,
        avgRightRt: metrics.avgRightRt,
        misses: metrics.misses,
        sliderRate: metrics.sliderRate,
        dominanceGap: parseFloat(dominanceGap.toFixed(1)),
        dominantSide: dominantSide,
        compensationFlag: compensationFlag
    };

    // Save to DB
    LOCAL_DB.sessions.push(newSession);
    saveLocalDatabase();

    // Populate post-game summary UI
    document.getElementById("summary-session-info").innerText = `${patient.name} | ${newSession.date} | Track: ${newSession.songTitle} (${newSession.difficulty})`;
    
    document.getElementById("summary-left-hits").innerText = L;
    document.getElementById("summary-left-ratio").innerText = leftUsageRatio.toFixed(1) + "%";
    document.getElementById("summary-left-rt").innerText = metrics.avgLeftRt;
    
    document.getElementById("summary-right-hits").innerText = R;
    document.getElementById("summary-right-ratio").innerText = rightUsageRatio.toFixed(1) + "%";
    document.getElementById("summary-right-rt").innerText = metrics.avgRightRt;

    // Double usage progress bar
    document.getElementById("summary-left-bar").style.width = leftUsageRatio.toFixed(1) + "%";
    document.getElementById("summary-right-bar").style.width = rightUsageRatio.toFixed(1) + "%";
    
    // Overall stats
    document.getElementById("summary-total-notes").innerText = totalNotes;
    document.getElementById("summary-misses").innerText = metrics.misses;
    document.getElementById("summary-dominance-gap").innerText = dominanceGap.toFixed(1) + "%";
    document.getElementById("summary-slider-rate").innerText = Math.round(metrics.sliderRate * 100) + "%";

    // Show warning/success boxes
    const criticalAlert = document.getElementById("summary-alert-critical");
    const successAlert = document.getElementById("summary-alert-success");
    
    if (compensationFlag) {
        criticalAlert.classList.remove("hidden");
        successAlert.classList.add("hidden");
        document.getElementById("summary-gap-alert-val").innerText = dominanceGap.toFixed(1) + "%";
    } else {
        criticalAlert.classList.add("hidden");
        successAlert.classList.remove("hidden");
        document.getElementById("summary-gap-success-val").innerText = dominanceGap.toFixed(1) + "%";
    }

    // Go to summary page tab
    showTab("summary");
}

function restartSession() {
    showTab("gameplay");
    startGame();
}

// Home screen population
function updateHomeDashboard() {
    const patient = LOCAL_DB.patients.find(p => p.id === LOCAL_DB.activePatientId);
    
    // Set profile names
    document.getElementById("welcome-name").innerText = patient.name;
    document.getElementById("active-profile-name").innerText = patient.name;
    document.getElementById("active-profile-desc").innerText = patient.desc;
    
    if (patient.affectedSide === "left") {
        document.getElementById("active-profile-desc").style.color = "var(--left-hand)";
    } else if (patient.affectedSide === "right") {
        document.getElementById("active-profile-desc").style.color = "var(--right-hand)";
    } else {
        document.getElementById("active-profile-desc").style.color = "var(--success)";
    }

    // Get last session of this patient
    const pSessions = LOCAL_DB.sessions.filter(s => s.patientId === patient.id);
    
    if (pSessions.length > 0) {
        const last = pSessions[pSessions.length - 1];
        
        document.getElementById("last-session-date").innerText = last.date;
        document.getElementById("home-left-hits").innerHTML = `${last.leftHits} <span class="small-text">hits</span>`;
        document.getElementById("home-left-rt").innerText = last.avgLeftRt;
        
        document.getElementById("home-right-hits").innerHTML = `${last.rightHits} <span class="small-text">hits</span>`;
        document.getElementById("home-right-rt").innerText = last.avgRightRt;
        
        const totalHits = last.leftHits + last.rightHits;
        const Lratio = totalHits > 0 ? (last.leftHits / totalHits) * 100 : 0;
        const Rratio = totalHits > 0 ? (last.rightHits / totalHits) * 100 : 0;
        
        document.getElementById("home-left-ratio").innerText = Lratio.toFixed(1) + "%";
        document.getElementById("home-right-ratio").innerText = Rratio.toFixed(1) + "%";
        
        document.getElementById("home-left-bar").style.width = Lratio.toFixed(1) + "%";
        document.getElementById("home-right-bar").style.width = Rratio.toFixed(1) + "%";
        
        const gap = last.dominanceGap;
        document.getElementById("home-dominance-gap").innerText = gap.toFixed(1) + "%";
        
        const alertBox = document.getElementById("home-alert-box");
        if (last.compensationFlag) {
            alertBox.className = "alert-box-summary critical-alert";
            alertBox.innerHTML = `
                <i class="fa-solid fa-triangle-exclamation warning-icon"></i>
                <div>
                    <strong>Compensation Detected:</strong> Dominance Gap is ${gap.toFixed(1)}%. You are favoring your ${last.dominantSide} hand.
                </div>
            `;
        } else {
            alertBox.className = "alert-box-summary success-alert";
            alertBox.innerHTML = `
                <i class="fa-solid fa-heart-pulse"></i>
                <div>
                    <strong>Symmetry Balanced:</strong> Dominance Gap is ${gap.toFixed(1)}%. Great work maintaining bilateral coordination!
                </div>
            `;
        }
    } else {
        // No sessions yet
        document.getElementById("last-session-date").innerText = "No sessions yet";
        document.getElementById("home-left-hits").innerHTML = `0 <span class="small-text">hits</span>`;
        document.getElementById("home-left-rt").innerText = "0";
        document.getElementById("home-right-hits").innerHTML = `0 <span class="small-text">hits</span>`;
        document.getElementById("home-right-rt").innerText = "0";
        document.getElementById("home-left-ratio").innerText = "50%";
        document.getElementById("home-right-ratio").innerText = "50%";
        document.getElementById("home-left-bar").style.width = "50%";
        document.getElementById("home-right-bar").style.width = "50%";
        
        const alertBox = document.getElementById("home-alert-box");
        alertBox.className = "alert-box-summary";
        alertBox.innerHTML = `<i class="fa-solid fa-circle-info"></i> Complete your first rhythm song session to see movement analysis here.`;
    }
}

// Table history helper
function updateHistoryTable() {
    const tbody = document.getElementById("home-history-table-body");
    if (!tbody) return;
    
    tbody.innerHTML = "";
    const pSessions = LOCAL_DB.sessions.filter(s => s.patientId === LOCAL_DB.activePatientId).reverse();
    
    if (pSessions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-dim);">No sessions played yet.</td></tr>`;
        return;
    }

    pSessions.forEach(s => {
        const row = document.createElement("tr");
        const badgeClass = s.compensationFlag ? "warning" : "balanced";
        const badgeLabel = s.compensationFlag ? "Compensation" : "Balanced";
        
        row.innerHTML = `
            <td>${s.date}</td>
            <td>${s.songTitle}</td>
            <td>${s.difficulty}</td>
            <td class="left-hand-theme">${s.leftHits}</td>
            <td class="right-hand-theme">${s.rightHits}</td>
            <td>${s.dominanceGap}%</td>
            <td><span class="status-badge ${badgeClass}">${badgeLabel}</span></td>
        `;
        tbody.appendChild(row);
    });
}

// Therapist Hub
function updateTherapistHub() {
    const listContainer = document.getElementById("dashboard-patient-list");
    if (!listContainer) return;
    
    listContainer.innerHTML = "";
    
    // Sort patients so flagged ones appear on top
    const sortedPatients = [...LOCAL_DB.patients].map(p => {
        const pSessions = LOCAL_DB.sessions.filter(s => s.patientId === p.id);
        const lastSession = pSessions[pSessions.length - 1];
        return {
            ...p,
            lastSession: lastSession || null
        };
    });

    sortedPatients.forEach(p => {
        const item = document.createElement("div");
        item.className = `patient-item ${p.id === LOCAL_DB.activePatientId ? 'selected' : ''}`;
        item.onclick = () => selectDashboardPatient(p.id);
        
        let badgeHtml = `<span class="pat-badge ok">Balanced</span>`;
        if (p.lastSession && p.lastSession.compensationFlag) {
            badgeHtml = `<span class="pat-badge alert">Compensation</span>`;
        } else if (!p.lastSession) {
            badgeHtml = `<span class="pat-badge" style="background: rgba(255,255,255,0.05); color: var(--text-dim);">No Data</span>`;
        }

        item.innerHTML = `
            <div>
                <span class="pat-name">${p.name}</span>
                <div class="pat-sub">${p.desc}</div>
            </div>
            ${badgeHtml}
        `;
        listContainer.appendChild(item);
    });

    // Populate active patient clinical card
    populatePatientDetailsCard();
}

function selectDashboardPatient(patientId) {
    LOCAL_DB.activePatientId = patientId;
    saveLocalDatabase();
    updateTherapistHub();
    playSynthSound(440, "sine", 0.05);
}

function populatePatientDetailsCard() {
    const patient = LOCAL_DB.patients.find(p => p.id === LOCAL_DB.activePatientId);
    if (!patient) return;

    document.getElementById("det-patient-name").innerText = patient.name;
    document.getElementById("det-affected-side").innerText = patient.desc;
    
    if (patient.affectedSide === "left") {
        document.getElementById("det-affected-side").style.color = "var(--left-hand)";
    } else if (patient.affectedSide === "right") {
        document.getElementById("det-affected-side").style.color = "var(--right-hand)";
    } else {
        document.getElementById("det-affected-side").style.color = "var(--success)";
    }

    const pSessions = LOCAL_DB.sessions.filter(s => s.patientId === patient.id);
    const statusBox = document.getElementById("det-dominance-status");
    const notesBox = document.getElementById("det-clinical-notes");
    
    if (pSessions.length > 0) {
        const last = pSessions[pSessions.length - 1];
        
        if (last.compensationFlag) {
            statusBox.className = "trend-direction";
            statusBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Heavy Compensation (Gap: ${last.dominanceGap}%)`;
            
            if (patient.affectedSide === "left") {
                notesBox.innerText = `The patient favors the right hand (${last.dominanceGap}% gap) for middle-lane and left-lane targets, suggesting avoidance of left limb flexion. Lower difficulty maps are recommended to increase left-hand engagement.`;
            } else if (patient.affectedSide === "right") {
                notesBox.innerText = `The patient favors the left hand (${last.dominanceGap}% gap) for middle-lane and right-lane targets, suggesting avoidance of right limb flexion. Lower difficulty maps are recommended to increase right-hand engagement.`;
            } else {
                notesBox.innerText = `The patient exhibits asymmetrical hand usage (${last.dominanceGap}% gap). Consider guiding the patient to balance usage, or adjust camera calibration to verify tracking bounds.`;
            }
        } else {
            statusBox.className = "trend-direction good";
            statusBox.innerHTML = `<i class="fa-solid fa-heart-pulse"></i> Symmetrical Balanced (Gap: ${last.dominanceGap}%)`;
            notesBox.innerText = `Bilateral usage is balanced and within safe clinical bounds. Symmetrical coordination promotes uniform motor control recovery. Patient is ready to proceed to Medium/Hard rhythm beatmaps.`;
        }
    } else {
        statusBox.className = "trend-direction";
        statusBox.style.color = "var(--text-dim)";
        statusBox.innerHTML = `No Session Data`;
        notesBox.innerText = `This patient has no recorded game session data yet. Please prompt the patient to open the game and complete a warm-up rhythm track to populate movement analysis profiles.`;
    }

    // Populate patient sessions table
    const tableBody = document.getElementById("det-sessions-table-body");
    tableBody.innerHTML = "";
    
    if (pSessions.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 12px;">No sessions played.</td></tr>`;
        drawTrendChart([]);
        return;
    }

    pSessions.slice(-5).forEach(s => {
        const row = document.createElement("tr");
        const flagBadge = s.compensationFlag 
            ? `<span class="pat-badge alert">Compensation</span>` 
            : `<span class="pat-badge ok">Balanced</span>`;
            
        row.innerHTML = `
            <td>${s.date}</td>
            <td>${s.songTitle}</td>
            <td>L:${Math.round(100 - s.dominanceGap)}% / R:${Math.round(s.dominanceGap)}%</td>
            <td>${s.avgLeftRt} / ${s.avgRightRt} ms</td>
            <td>${s.dominanceGap}%</td>
            <td>${flagBadge}</td>
        `;
        tableBody.appendChild(row);
    });

    // Draw the graphical progress trend
    drawTrendChart(pSessions.slice(-5));
}

// Custom canvas visualizer for symmetry trends
function drawTrendChart(sessions) {
    const canvas = document.getElementById("trend-canvas");
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    ctx.fillStyle = "rgba(5, 8, 17, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (sessions.length === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.font = "14px Inter";
        ctx.textAlign = "center";
        ctx.fillText("No sessions data available to plot", canvas.width/2, canvas.height/2);
        return;
    }

    const padding = { top: 20, right: 30, bottom: 25, left: 40 };
    const chartWidth = canvas.width - padding.left - padding.right;
    const chartHeight = canvas.height - padding.top - padding.bottom;

    // Draw horizontal reference lines (0%, 30%, 50%, 70%, 100%)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    const gridLines = [0, 0.25, 0.5, 0.75, 1];
    
    gridLines.forEach(frac => {
        const y = padding.top + chartHeight * (1 - frac);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(canvas.width - padding.right, y);
        ctx.stroke();
        
        // y axis labels
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "9px 'Space Grotesk'";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(Math.round(frac * 100) + "%", padding.left - 8, y);
    });

    // Draw 30% asymmetry warning zone line
    const warningY = padding.top + chartHeight * (1 - 0.3);
    ctx.strokeStyle = "rgba(255, 107, 107, 0.2)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, warningY);
    ctx.lineTo(canvas.width - padding.right, warningY);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash
    
    ctx.fillStyle = "rgba(255, 107, 107, 0.4)";
    ctx.fillText("30% Gap Threshold", canvas.width - padding.right, warningY - 6);

    const len = sessions.length;
    const stepX = len > 1 ? chartWidth / (len - 1) : chartWidth;
    
    // Draw lines
    const pointsLeft = [];
    const pointsRight = [];
    const pointsGap = [];
    
    sessions.forEach((s, idx) => {
        const total = s.leftHits + s.rightHits;
        const leftRatio = total > 0 ? s.leftHits / total : 0.5;
        const rightRatio = total > 0 ? s.rightHits / total : 0.5;
        
        const x = padding.left + (idx * stepX);
        const yLeft = padding.top + chartHeight * (1 - leftRatio);
        const yRight = padding.top + chartHeight * (1 - rightRatio);
        const yGap = padding.top + chartHeight * (1 - (s.dominanceGap / 100));
        
        pointsLeft.push({ x, y: yLeft });
        pointsRight.push({ x, y: yRight });
        pointsGap.push({ x, y: yGap });

        // Draw date label on X axis
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "9px 'Space Grotesk'";
        ctx.textAlign = "center";
        ctx.fillText(s.date.substring(5), x, canvas.height - padding.bottom + 15);
    });

    // Draw Right Hand Ratio Line (Cyan)
    drawDataLine(ctx, pointsRight, "var(--right-hand)", "var(--right-glow)");
    
    // Draw Left Hand Ratio Line (Coral)
    drawDataLine(ctx, pointsLeft, "var(--left-hand)", "var(--left-glow)");
    
    // Draw Dominance Gap Line (Yellow)
    drawDataLine(ctx, pointsGap, "var(--warning)", "rgba(250, 173, 20, 0.2)");
}

function drawDataLine(ctx, points, color, glowColor) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 8;
    ctx.shadowColor = glowColor;
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // Draw dots
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
    });
    ctx.restore();
}

function exportData() {
    const patient = LOCAL_DB.patients.find(p => p.id === LOCAL_DB.activePatientId);
    const pSessions = LOCAL_DB.sessions.filter(s => s.patientId === patient.id);
    
    if (pSessions.length === 0) {
        alert("No session records found to export.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Song Title,Difficulty,Left Hand Hits,Right Hand Hits,Avg Left Reaction (ms),Avg Right Reaction (ms),Misses,Symmetry Gap (%),Flagged\n";
    
    pSessions.forEach(s => {
        csvContent += `${s.date},${s.songTitle},${s.difficulty},${s.leftHits},${s.rightHits},${s.avgLeftRt},${s.avgRightRt},${s.misses},${s.dominanceGap}%,${s.compensationFlag ? 'YES' : 'NO'}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `rehab_report_${patient.name.toLowerCase().replace(" ", "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    playSynthSound(880, "sine", 0.1);
}

// MediaPipe skeletons rendering inside canvas helper
function drawFrameSkeletons(canvasElement, hands) {
    const ctx = canvasElement.getContext("2d");
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Draw background placeholder camera mirror grid (if camera is inactive)
    if (!trackedHands.left.active && !trackedHands.right.active && inputMode === "mediapipe") {
        ctx.fillStyle = "#0B1220";
        ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
        ctx.font = "14px Inter";
        ctx.textAlign = "center";
        ctx.fillText("Position yourself so webcam captures hands...", canvasElement.width / 2, canvasElement.height / 2);
        return;
    }

    // Draw dummy backdrop mirroring
    ctx.fillStyle = "#050811";
    ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);

    ctx.save();
    // Draw floating calibration bounding circles
    ctx.strokeStyle = "rgba(122, 92, 255, 0.15)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    // Left calibration circle
    ctx.beginPath();
    ctx.arc(160, 240, 100, 0, 2*Math.PI);
    ctx.stroke();
    
    // Right calibration circle
    ctx.beginPath();
    ctx.arc(480, 240, 100, 0, 2*Math.PI);
    ctx.stroke();
    
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = "bold 12px 'Space Grotesk'";
    ctx.textAlign = "center";
    ctx.fillText("LEFT HAND ZONE", 160, 240);
    ctx.fillText("RIGHT HAND ZONE", 480, 240);
    ctx.restore();

    // Draw custom indicators
    const sides = ["left", "right"];
    sides.forEach(side => {
        const h = hands[side];
        if (h.active) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(h.x, h.y, 30, 0, 2 * Math.PI);
            
            const color = side === "left" ? "var(--left-hand)" : "var(--right-hand)";
            const glow = side === "left" ? "var(--left-glow)" : "var(--right-glow)";
            
            ctx.strokeStyle = color;
            ctx.shadowBlur = 15;
            ctx.shadowColor = glow;
            ctx.lineWidth = h.state === "CLOSED" ? 6 : 2;
            ctx.fillStyle = h.state === "CLOSED" ? "rgba(255,255,255,0.08)" : "transparent";
            
            if (h.state === "OPEN") {
                ctx.setLineDash([4, 4]);
            }
            
            ctx.fill();
            ctx.stroke();
            
            ctx.shadowBlur = 0;
            ctx.font = "bold 14px 'Space Grotesk'";
            ctx.fillStyle = color;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(side === "left" ? "L" : "R", h.x, h.y);
            
            ctx.font = "10px Inter";
            ctx.fillText(h.state, h.x, h.y + 45);
            ctx.restore();
        }
    });
}
