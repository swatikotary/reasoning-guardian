require("dotenv").config();
const Groq = require("groq-sdk");
const path = require("path");
const db = require(path.join(__dirname, "../../memory/memory-adapter"));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── CANONICAL SLOT GROUPS ────────────────────────────────
// Fixed set used for contradiction matching only
// Slot stays descriptive on dashboard, slot_group is the matching key

const CANONICAL_GROUPS = [
  "database", "auth", "architecture", "testing", "deployment",
  "api-design", "caching", "security", "infrastructure", "monitoring",
  "build-system", "state-management", "data-modeling", "versioning", "other"
];

async function assignSlotGroup(slot) {
  // If slot already exactly matches a canonical group, use it directly
  if (CANONICAL_GROUPS.includes(slot)) return slot;

  try {
    const res = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content:
        `Which of these canonical engineering categories best matches this slot?

Slot: "${slot}"

Canonical categories:
${CANONICAL_GROUPS.join(", ")}

Rules:
- Pick the single best match
- "test-runner", "unit-testing", "jest-config" → testing
- "db-choice", "database-engine", "orm" → database
- "ci", "ci-cd", "pipeline" → build-system
- "deploy-strategy", "hosting" → deployment
- "rate-limiting", "rest-api", "graphql" → api-design
- "login", "oauth", "jwt" → auth
- "frontend-framework", "backend-framework", "stack-choice", "tech-stack" → architecture
- If nothing fits well → other

Return ONLY the category name, nothing else.`
      }],
      temperature: 0.1,
    });

    const group = res.choices[0].message.content.trim().toLowerCase();
    if (CANONICAL_GROUPS.includes(group)) {
      console.log(`[DecisionExtractor] Slot group: "${slot}" → "${group}"`);
      return group;
    }
    console.log(`[DecisionExtractor] Slot group fallback to "other" for: "${slot}"`);
    return "other";
  } catch (err) {
    console.error("[DecisionExtractor] Slot group error:", err.message);
    return "other";
  }
}

// ─── PASS 1 + PASS 2 EXTRACTION ──────────────────────────

async function extractDecision(message) {
  console.log("\n[DecisionExtractor] Processing:", message.substring(0, 80) + "...");

  // ── PASS 1: commit signal detection ──
  const pass1 = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content:
      `Does this message contain a COMMITTED engineering choice? Not tentative, not exploratory.

Commit signals (any of these count):
- "we will use", "let's go with", "decided to", "going with"
- "switch to", "switching to", "let's switch", "moving to"
- "replace X with Y", "drop X", "won't use X", "removing X"
- "we're using", "use X instead of Y", "going with X over Y"
- "let's use", "we should use", "we'll go with", "use X"
- "dropping X", "migrating to", "adopting X", "we've chosen"
- "we'll do", "we're doing", "we decided", "final decision"

Exploratory (NOT a commit): "maybe", "could", "try", "let's test",
"what if", "thinking about", "considering", "should we", "what about",
"any thoughts on", "exploring", "looking into"

Return ONLY one word: YES | NO | MAYBE
Message: "${message}"`
    }],
    temperature: 0.1,
  });

  const signal = pass1.choices[0].message.content.trim().toUpperCase();
  console.log("[DecisionExtractor] Pass 1 signal:", signal);

  if (signal === "NO") {
    console.log("[DecisionExtractor] ⊘ No commit signal, skipping");
    return null;
  }

  // ── PASS 2: full structured extraction with free slot inference ──
  const pass2 = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content:
      `Extract the committed engineering decision from this message.
Return ONLY valid JSON or the exact string NONE — nothing else, no markdown, no explanation.

Rules:
- decision_score: 0.0 to 1.0 — how confident this is a real committed decision
- If score is below 0.75, return NONE
- constraints: ONLY direct structural constraints, not downstream implications
- slot: infer the best 1-3 word category from the decision itself.
  Examples spanning common engineering concerns:
  database, auth, architecture, testing, deployment,
  api-design, rate-limiting, caching, state-management,
  monorepo, versioning, logging, monitoring, error-handling,
  security, infrastructure, frontend-framework, build-system,
  data-modeling, service-communication, queue-system,
  ci-cd, containerisation, search, storage, realtime
  Be specific but not overly narrow. Use lowercase with hyphens.
  Two decisions about the same concern must get the same slot.
  Consistency is more important than perfect categorisation.
- alternatives: ONLY include options explicitly mentioned in this message.
  If none mentioned, return []. Never infer alternatives from general knowledge.
- Keep reasoning to 1-2 sentences max
- If genuinely not a decision, return NONE

JSON schema:
{
  "isDecision": true,
  "decision_score": number,
  "decision": "short clear statement of what was decided",
  "slot": "inferred category",
  "reasoning": "why this was decided",
  "alternatives": ["only explicitly mentioned options"],
  "constraints": ["direct structural constraints only"],
  "impact_score": number between 1 and 10,
  "scope": { "service": "if mentioned or empty string", "component": "if mentioned or empty string" }
}

Message: "${message}"`
    }],
    temperature: 0.1,
  });

  try {
    const text = pass2.choices[0].message.content.trim();

    if (text === "NONE") {
      console.log("[DecisionExtractor] ⊘ LLM returned NONE");
      return null;
    }

    const clean = text.replace(/```json|```/g, "").trim();
    const extracted = JSON.parse(clean);

    if (!extracted.isDecision || extracted.decision_score < 0.75) {
      console.log("[DecisionExtractor] ⊘ Score too low:", extracted.decision_score);
      return null;
    }

    if (!extracted.slot || !extracted.reasoning) {
      console.log("[DecisionExtractor] ⊘ Failed rule gate — missing slot or reasoning");
      return null;
    }

    console.log("[DecisionExtractor] ✅ Decision confirmed:", extracted.decision, "| Slot:", extracted.slot, "| Score:", extracted.decision_score);
    return extracted;

  } catch (err) {
    console.error("[DecisionExtractor] Parse error:", err.message);
    return null;
  }
}

// ─── SAVE DECISION IF NEW ────────────────────────────────
// ONLY CHANGE FROM sg1: added project parameter

async function saveIfNew(extractedDecision, project = "default") {
  const slot_group = await assignSlotGroup(extractedDecision.slot);

  const existing = db.getActiveDecisionsByGroup(slot_group);

  const isDuplicate = existing.some(
    d => d.decision.toLowerCase() === extractedDecision.decision.toLowerCase()
  );

  if (isDuplicate) {
    console.log("[DecisionExtractor] ℹ️  Decision already recorded, skipping duplicate");
    return null;
  }

  const id = db.saveDecision({
    decision:     extractedDecision.decision,
    slot:         extractedDecision.slot,
    slot_group,
    scope:        extractedDecision.scope,
    alternatives: extractedDecision.alternatives,
    reasoning:    extractedDecision.reasoning,
    constraints:  extractedDecision.constraints,
    impact_score: extractedDecision.impact_score,
    confidence:   extractedDecision.decision_score || 0.85,
    contributors: [process.env.CONTRIBUTOR_NAME || "Engineer"],
    timestamp:    new Date().toISOString(),
    project,                                          // ← only new line
  });

  console.log("[DecisionExtractor] 💾 Saved decision ID:", id, "| Group:", slot_group, "| Project:", project);
  return id;
}

// ─── MAIN HANDLER ────────────────────────────────────────
// ONLY CHANGE FROM sg1: added project parameter passed through

async function handleDecisionExtraction(chatMessage, project = "default") {
  const extracted = await extractDecision(chatMessage);
  if (!extracted) return null;

  const id = await saveIfNew(extracted, project);
  return { id, extracted };
}

module.exports = { extractDecision, saveIfNew, handleDecisionExtraction };
