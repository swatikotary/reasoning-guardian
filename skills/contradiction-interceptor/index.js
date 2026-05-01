require("dotenv").config();
const Groq = require("groq-sdk");
const path = require("path");
const db = require(path.join(__dirname, "../../memory/memory-adapter"));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function detectContradiction(newDecision, project = "default") {
  console.log("\n[ContradictionInterceptor] Checking:", newDecision.decision, "| Project:", project);

  // Only compare against decisions in the SAME project
  const allActive = db.getAllDecisionsByProject(project).filter(d => d.status === "active");

  if (allActive.length === 0) {
    console.log("[ContradictionInterceptor] ✓ No past decisions in this project");
    return null;
  }

  const candidates = allActive.filter(
    d => d.decision.toLowerCase() !== newDecision.decision.toLowerCase()
  );

  if (candidates.length === 0) return null;

  console.log(`[ContradictionInterceptor] Checking against ${candidates.length} decision(s) in project "${project}"`);

  return await fullContextCheck(newDecision, candidates, project);
}

async function fullContextCheck(newDecision, pastDecisions, project) {
  const decisionList = pastDecisions.map((d, i) =>
    `${i + 1}. "${d.decision}" (reasoning: ${d.reasoning || "not recorded"}, slot: ${d.slot})`
  ).join("\n");

  const prompt = `You are a senior engineering advisor reviewing a new proposal against past decisions.

ACTIVE ENGINEERING DECISIONS IN THIS PROJECT:
${decisionList}

NEW PROPOSAL:
"${newDecision.decision}"
Reasoning: ${newDecision.reasoning || "not provided"}

Does the new proposal STRUCTURALLY CONFLICT with any of the active decisions above?

A structural conflict means both decisions cannot be true at the same time in the same system.
Examples of real conflicts:
- "use SpringBoot backend" conflicts with "use MERN stack" — both define the backend/stack technology
- "use MongoDB" conflicts with "use PostgreSQL" — both define the primary database
- "use trunk-based development" conflicts with "use gitflow" — both define the branching strategy
- "use REST API" conflicts with "use GraphQL" — both define the API communication style

Examples of NON-conflicts:
- Different services can use different databases
- A frontend decision does not conflict with a backend decision unless they overlap
- Adding a monitoring tool does not conflict with choosing a framework
- "use mongodb" and "use mongo db" are the SAME decision — not a conflict
- If two decisions refer to the same technology with different spelling or spacing, return conflicts: false
Return ONLY valid JSON:
{
  "conflicts": true or false,
  "conflicting_decision_index": number or null (1-based index from the list above),
  "severity": "critical" or "warning" or "none",
  "explanation": "one clear sentence explaining exactly why they conflict"
}

If no conflict:
{
  "conflicts": false,
  "conflicting_decision_index": null,
  "severity": "none",
  "explanation": "no structural conflict found"
}`;

  try {
    const res = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    });

    const text = res.choices[0].message.content.trim().replace(/```json|```/g, "").trim();
    const analysis = JSON.parse(text);

    if (!analysis.conflicts || analysis.severity === "none") return null;

    const conflictingIndex = analysis.conflicting_decision_index - 1;
    const pastDecision = pastDecisions[conflictingIndex];
    if (!pastDecision) return null;

    const conflictId = db.saveConflict({
      slot:      newDecision.slot,
      scope:     newDecision.scope,
      position_a: {
        engineer:  pastDecision.contributors?.[0] || "Engineer",
        decision:  pastDecision.decision,
        reasoning: pastDecision.reasoning,
      },
      position_b: {
        engineer:  process.env.CONTRIBUTOR_NAME || "Engineer",
        decision:  newDecision.decision,
        reasoning: newDecision.reasoning,
      },
      status:    "unresolved",
      timestamp: new Date().toISOString(),
      project,
    });

    return {
      conflictId,
      severity:     analysis.severity,
      pastDecision: pastDecision.decision,
      newProposal:  newDecision.decision,
      explanation:  analysis.explanation,
      pastId:       pastDecision.id,
    };

  } catch (err) {
    console.error("[ContradictionInterceptor] Error:", err.message);
    return null;
  }
}

function fireAlert(contradiction) {
  const alert = {
    timestamp: new Date().toISOString(),
    severity:  contradiction.severity,
    message:   `⚠️ ${contradiction.severity.toUpperCase()}: DECISION CONFLICT`,
    details: {
      conflictId: contradiction.conflictId,
      past:       contradiction.pastDecision,
      proposed:   contradiction.newProposal,
      reason:     contradiction.explanation,
    },
  };

  console.log("\n╔════════════════════════════════════════╗");
  console.log("║  🚨 CONTRADICTION ALERT                ║");
  console.log("╚════════════════════════════════════════╝");
  console.log(`Severity: ${alert.severity.toUpperCase()}`);
  console.log(`\nPast:     "${alert.details.past}"`);
  console.log(`Proposed: "${alert.details.proposed}"`);
  console.log(`Reason:   ${alert.details.reason}`);
  console.log("════════════════════════════════════════\n");

  return alert;
}

async function handleContradictionCheck(newDecision, project = "default") {
  const contradiction = await detectContradiction(newDecision, project);
  if (contradiction) return fireAlert(contradiction);
  return { status: "no_contradiction", decision: newDecision.decision };
}

module.exports = { detectContradiction, fireAlert, handleContradictionCheck };
