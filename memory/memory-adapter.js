const Database = require("better-sqlite3");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const db = new Database(path.join(__dirname, "decisions.db"));

// ── SAFE MIGRATIONS ───────────────────────────────────────
// Adds new columns if they don't exist — safe to run every time

const migrations = [
  `ALTER TABLE decisions ADD COLUMN slot_group TEXT`,
  `ALTER TABLE decisions ADD COLUMN project TEXT DEFAULT 'default'`,
  `ALTER TABLE conflicts ADD COLUMN project TEXT DEFAULT 'default'`,
];

migrations.forEach(sql => {
  try { db.exec(sql); } catch (e) { /* column already exists, safe to ignore */ }
});

// ── DECISIONS ─────────────────────────────────────────────

function saveDecision(decision) {
  const id = decision.id || uuidv4();
  db.prepare(`
    INSERT OR REPLACE INTO decisions
    (id, decision, slot, slot_group, scope, alternatives, reasoning, constraints,
     impact_score, status, confidence, contributors, timestamp, evolves_from, replaces, project)
    VALUES
    (@id, @decision, @slot, @slot_group, @scope, @alternatives, @reasoning, @constraints,
     @impact_score, @status, @confidence, @contributors, @timestamp, @evolves_from, @replaces, @project)
  `).run({
    id,
    decision:     decision.decision,
    slot:         decision.slot,
    slot_group:   decision.slot_group || decision.slot,
    scope:        JSON.stringify(decision.scope || {}),
    alternatives: JSON.stringify(decision.alternatives || []),
    reasoning:    decision.reasoning || "",
    constraints:  JSON.stringify(decision.constraints || []),
    impact_score: decision.impact_score || 5,
    status:       decision.status || "active",
    confidence:   decision.confidence || 0.8,
    contributors: JSON.stringify(decision.contributors || []),
    timestamp:    decision.timestamp || new Date().toISOString(),
    evolves_from: decision.evolves_from || null,
    replaces:     decision.replaces || null,
    project:      decision.project || "default",
  });
  return id;
}

// ── PROJECT-SCOPED QUERIES ────────────────────────────────

function getActiveDecisions(slot, scope, project = "default") {
  let query = `SELECT * FROM decisions WHERE status = 'active' AND (project = ? OR project IS NULL)`;
  const params = [project];

  if (slot) {
    query += ` AND slot = ?`;
    params.push(slot);
  }

  const rows = db.prepare(query).all(...params);
  const parsed = rows.map(parseDecision);

  if (scope && scope.service) {
    return parsed.filter(d =>
      !d.scope || !d.scope.service || d.scope.service === "" || d.scope.service === scope.service
    );
  }
  return parsed;
}

function getActiveDecisionsByGroup(slot_group, scope, project = "default") {
  let query = `SELECT * FROM decisions WHERE status = 'active' AND (project = ? OR project IS NULL)`;
  const params = [project];

  if (slot_group) {
    query += ` AND (slot_group = ? OR (slot_group IS NULL AND slot = ?))`;
    params.push(slot_group, slot_group);
  }

  const rows = db.prepare(query).all(...params);
  const parsed = rows.map(parseDecision);

  if (scope && scope.service) {
    return parsed.filter(d =>
      !d.scope || !d.scope.service || d.scope.service === "" || d.scope.service === scope.service
    );
  }
  return parsed;
}

function getAllDecisions() {
  // Returns all decisions — frontend filters by project
  return db.prepare(`SELECT * FROM decisions ORDER BY timestamp DESC`).all().map(parseDecision);
}

function getAllDecisionsByProject(project = "default") {
  return db.prepare(
    `SELECT * FROM decisions WHERE (project = ? OR project IS NULL) ORDER BY timestamp DESC`
  ).all(project).map(parseDecision);
}

function getDecisionById(id) {
  const row = db.prepare(`SELECT * FROM decisions WHERE id = ?`).get(id);
  return row ? parseDecision(row) : null;
}

function markOverridden(id) {
  db.prepare(`UPDATE decisions SET status = 'overridden' WHERE id = ?`).run(id);
}

function incrementConfidence(id) {
  db.prepare(`UPDATE decisions SET confidence = MIN(1.0, confidence + 0.05) WHERE id = ?`).run(id);
}

// ── CONFLICTS ─────────────────────────────────────────────

function saveConflict(conflict) {
  const id = conflict.id || uuidv4();
  db.prepare(`
    INSERT OR REPLACE INTO conflicts
    (id, slot, scope, position_a, position_b, status, resolution, timestamp, project)
    VALUES (@id, @slot, @scope, @position_a, @position_b, @status, @resolution, @timestamp, @project)
  `).run({
    id,
    slot:       conflict.slot,
    scope:      JSON.stringify(conflict.scope || {}),
    position_a: JSON.stringify(conflict.position_a),
    position_b: JSON.stringify(conflict.position_b),
    status:     conflict.status || "unresolved",
    resolution: conflict.resolution || null,
    timestamp:  conflict.timestamp || new Date().toISOString(),
    project:    conflict.project || "default",
  });
  return id;
}

function getConflicts() {
  // Returns all conflicts — frontend filters by project
  return db.prepare(`SELECT * FROM conflicts WHERE status = 'unresolved'`).all().map(r => ({
    ...r,
    scope:      JSON.parse(r.scope || "{}"),
    position_a: JSON.parse(r.position_a),
    position_b: JSON.parse(r.position_b),
  }));
}
function getAllConflicts() {
  // Returns all conflicts including resolved — for timeline
  return db.prepare(`SELECT * FROM conflicts ORDER BY timestamp DESC`).all().map(r => ({
    ...r,
    scope:      JSON.parse(r.scope || "{}"),
    position_a: JSON.parse(r.position_a),
    position_b: JSON.parse(r.position_b),
  }));
}
function resolveConflict(id, action, engineer, reason) {
  // Add resolution columns if they don't exist
  try { db.exec(`ALTER TABLE conflicts ADD COLUMN resolved_by TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE conflicts ADD COLUMN resolve_reason TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE conflicts ADD COLUMN resolved_action TEXT`); } catch(e) {}

  db.prepare(`
    UPDATE conflicts 
    SET status = 'resolved', resolution = ?, resolved_by = ?, resolve_reason = ?, resolved_action = ?
    WHERE id = ?
  `).run(action, engineer || "Engineer", reason || "", action, id);
}

// ── HELPERS ───────────────────────────────────────────────

function parseDecision(row) {
  return {
    ...row,
    scope:        JSON.parse(row.scope || "{}"),
    alternatives: JSON.parse(row.alternatives || "[]"),
    constraints:  JSON.parse(row.constraints || "[]"),
    contributors: JSON.parse(row.contributors || "[]"),
  };
}

module.exports = {
  saveDecision,
  getActiveDecisions,
  getActiveDecisionsByGroup,
  getAllDecisions,
  getAllDecisionsByProject,
  getDecisionById,
  markOverridden,
  incrementConfidence,
  saveConflict,
  getConflicts,
  getAllConflicts,     
  resolveConflict,
};
