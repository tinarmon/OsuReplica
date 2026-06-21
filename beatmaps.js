// Beatmaps definition for Robo-Osu Rehab
// Note types: 'circle' | 'slider'
// Positions coordinates map to Canvas width=800, height=500
// Beatmaps DO NOT specify which hand should hit them. Hands are evaluated first-come-first-served.

const BEATMAPS = [
    {
        id: "bm_rhythm_flow",
        title: "Rhythm Flow (Gentle Warmup)",
        artist: "Therapy Tunes",
        duration: 35, // seconds
        notesCount: 22,
        notes: [
            { time: 2000, type: "circle", x: 200, y: 250 },
            { time: 3500, type: "circle", x: 600, y: 250 },
            { time: 5000, type: "circle", x: 400, y: 150 },
            { time: 6500, type: "circle", x: 400, y: 350 },
            
            // Slider 1: Horizontal Left to Right
            { 
                time: 8000, 
                type: "slider", 
                x: 250, 
                y: 200, 
                duration: 2000, 
                path: [
                    { x: 250, y: 200 },
                    { x: 350, y: 200 },
                    { x: 450, y: 200 },
                    { x: 550, y: 200 }
                ] 
            },
            
            { time: 11000, type: "circle", x: 200, y: 150 },
            { time: 12200, type: "circle", x: 600, y: 150 },
            { time: 13500, type: "circle", x: 200, y: 350 },
            { time: 14700, type: "circle", x: 600, y: 350 },
            
            // Slider 2: Vertical Downward
            { 
                time: 16500, 
                type: "slider", 
                x: 400, 
                y: 100, 
                duration: 2500, 
                path: [
                    { x: 400, y: 100 },
                    { x: 400, y: 200 },
                    { x: 400, y: 300 },
                    { x: 400, y: 400 }
                ] 
            },
            
            { time: 20000, type: "circle", x: 300, y: 250 },
            { time: 21200, type: "circle", x: 500, y: 250 },
            { time: 22400, type: "circle", x: 300, y: 150 },
            { time: 23600, type: "circle", x: 500, y: 350 },
            
            // Slider 3: Arc Path
            { 
                time: 25000, 
                type: "slider", 
                x: 150, 
                y: 250, 
                duration: 3000, 
                path: [
                    { x: 150, y: 250 },
                    { x: 280, y: 150 },
                    { x: 400, y: 150 },
                    { x: 520, y: 150 },
                    { x: 650, y: 250 }
                ] 
            },
            
            { time: 29500, type: "circle", x: 400, y: 250 },
            { time: 30500, type: "circle", x: 250, y: 200 },
            { time: 31500, type: "circle", x: 550, y: 200 },
            { time: 33000, type: "circle", x: 400, y: 300 }
        ]
    },
    {
        id: "bm_bilateral_dance",
        title: "Bilateral Sync (Stamina Build)",
        artist: "NeuroBeat",
        duration: 40,
        notesCount: 30,
        notes: [
            { time: 1500, type: "circle", x: 150, y: 150 },
            { time: 2500, type: "circle", x: 650, y: 150 },
            { time: 3500, type: "circle", x: 150, y: 350 },
            { time: 4500, type: "circle", x: 650, y: 350 },
            
            { time: 6000, type: "circle", x: 300, y: 250 },
            { time: 7000, type: "circle", x: 500, y: 250 },
            
            // Slider Left Focus
            { 
                time: 8500, 
                type: "slider", 
                x: 200, 
                y: 350, 
                duration: 2000, 
                path: [
                    { x: 200, y: 350 },
                    { x: 200, y: 150 }
                ] 
            },
            // Slider Right Focus
            { 
                time: 11000, 
                type: "slider", 
                x: 600, 
                y: 350, 
                duration: 2000, 
                path: [
                    { x: 600, y: 350 },
                    { x: 600, y: 150 }
                ] 
            },
            
            { time: 14000, type: "circle", x: 400, y: 250 },
            { time: 15000, type: "circle", x: 250, y: 150 },
            { time: 16000, type: "circle", x: 550, y: 150 },
            { time: 17000, type: "circle", x: 250, y: 350 },
            { time: 18000, type: "circle", x: 550, y: 350 },
            
            // Alternate circles rapidly
            { time: 20000, type: "circle", x: 200, y: 200 },
            { time: 21000, type: "circle", x: 600, y: 200 },
            { time: 22000, type: "circle", x: 200, y: 300 },
            { time: 23000, type: "circle", x: 600, y: 300 },
            
            // Long diagonal slider
            { 
                time: 24500, 
                type: "slider", 
                x: 150, 
                y: 150, 
                duration: 3500, 
                path: [
                    { x: 150, y: 150 },
                    { x: 300, y: 230 },
                    { x: 450, y: 230 },
                    { x: 650, y: 350 }
                ] 
            },
            
            { time: 29000, type: "circle", x: 400, y: 120 },
            { time: 30000, type: "circle", x: 400, y: 380 },
            { time: 31200, type: "circle", x: 200, y: 250 },
            { time: 32400, type: "circle", x: 600, y: 250 },
            
            { time: 34000, type: "circle", x: 300, y: 150 },
            { time: 35000, type: "circle", x: 500, y: 350 },
            { time: 36000, type: "circle", x: 300, y: 350 },
            { time: 37000, type: "circle", x: 500, y: 150 },
            { time: 38500, type: "circle", x: 400, y: 250 }
        ]
    }
];

// Helper to scale beatmap note timestamps based on difficulty multipliers
function getScaleMapNotes(beatmap, difficultyVal) {
    // difficultyVal: 1 = Easy (slow), 2 = Medium (normal), 3 = Hard (fast)
    let speedMultiplier = 1.0;
    if (difficultyVal === 1) speedMultiplier = 1.4; // 40% slower timeline spacing
    if (difficultyVal === 3) speedMultiplier = 0.75; // 25% faster timeline spacing
    
    return beatmap.notes.map(note => {
        const scaledNote = {
            ...note,
            time: Math.round(note.time * speedMultiplier)
        };
        if (note.type === "slider") {
            scaledNote.duration = Math.round(note.duration * speedMultiplier);
        }
        return scaledNote;
    });
}
