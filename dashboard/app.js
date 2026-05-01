const API_URL = "http://localhost:3001/api";

async function fetchDecisions() {
    try {
        const res = await fetch(`${API_URL}/decisions`);
        if (!res.ok) throw new Error("API not responding");
        return await res.json();
    } catch (err) {
        console.error("Fetch error:", err);
        showError("Cannot connect to API. Make sure the backend is running on port 3001.");
        return [];
    }
}

async function fetchConflicts() {
    try {
        const res = await fetch(`${API_URL}/conflicts`);
        if (!res.ok) return [];
        return await res.json();
    } catch {
        return [];
    }
}

function renderDecision(decision) {
    const date = new Date(decision.timestamp).toLocaleDateString();
    const confidencePercent = Math.round((decision.confidence || 0.8) * 100);
    const statusClass = decision.status || "active";

    const alternativesHTML = decision.alternatives && decision.alternatives.length
        ? `<div class="alternatives">${decision.alternatives.map(alt => `<span class="alt-tag">${alt}</span>`).join("")}</div>`
        : "";

    return `
        <div class="card ${statusClass}">
            <div class="card-slot">${decision.slot.toUpperCase()}</div>
            <div class="card-title">${decision.decision}</div>
            
            <div class="card-content">
                <div class="card-label">Why</div>
                <div class="card-text">${decision.reasoning || "No reasoning recorded"}</div>
            </div>

            ${decision.alternatives.length > 0 ? `
            <div class="card-content">
                <div class="card-label">Considered</div>
                ${alternativesHTML}
            </div>
            ` : ""}

            <div class="card-content">
                <div class="card-label">Confidence</div>
                <div class="confidence-bar">
                    <div class="confidence-fill" style="width: ${confidencePercent}%"></div>
                </div>
                <div class="card-text">${confidencePercent}% • Impact: ${decision.impact_score || 5}/10</div>
            </div>

            <div class="card-content">
                <div class="card-label">Status</div>
                <div class="card-text" style="text-transform: capitalize;">${decision.status || "active"}</div>
            </div>

            <div class="timestamp">
                ${decision.contributors && decision.contributors.length ? `👤 ${decision.contributors.join(", ")}` : ""}
                <br>📅 ${date}
            </div>
        </div>
    `;
}

function renderConflict(conflict) {
    return `
        <div class="conflict-alert">
            ⚠️ CONFLICT DETECTED: Position A vs Position B in ${conflict.slot}
        </div>
    `;
}

function updateStats(decisions, conflicts) {
    const total = decisions.length;
    const active = decisions.filter(d => d.status === "active").length;
    const avgConf = total > 0
        ? Math.round((decisions.reduce((sum, d) => sum + (d.confidence || 0.8), 0) / total) * 100)
        : 0;

    document.getElementById("totalDecisions").textContent = total;
    document.getElementById("activeDecisions").textContent = active;
    document.getElementById("conflictCount").textContent = conflicts.length;
    document.getElementById("avgConfidence").textContent = avgConf + "%";
}

function showError(msg) {
    const errorDiv = document.getElementById("error");
    errorDiv.className = "error";
    errorDiv.textContent = msg;
}

function hideError() {
    document.getElementById("error").textContent = "";
}

async function render() {
    document.getElementById("loading").style.display = "block";

    const decisions = await fetchDecisions();
    const conflicts = await fetchConflicts();

    document.getElementById("loading").style.display = "none";

    if (decisions.length === 0 && conflicts.length === 0) {
        document.getElementById("dashboard").innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                No decisions recorded yet. Once engineering chats are monitored, decisions will appear here.
            </div>
        `;
        updateStats([], []);
        return;
    }

    hideError();

    // Render conflicts first
    const conflictHTML = conflicts.length > 0
        ? conflicts.map(renderConflict).join("")
        : "";
    document.getElementById("conflicts").innerHTML = conflictHTML;

    // Render decisions
    const decisionsHTML = decisions.map(renderDecision).join("");
    document.getElementById("dashboard").innerHTML = decisionsHTML;

    updateStats(decisions, conflicts);
    document.getElementById("lastUpdate").textContent = new Date().toLocaleTimeString();
}

// Initial render + poll every 5 seconds
render();
setInterval(render, 5000);