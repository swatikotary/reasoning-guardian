require("dotenv").config();
const Groq = require("groq-sdk");
const path = require("path");
const db = require(path.join(__dirname, "../../memory/memory-adapter"));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── DRIFT THRESHOLDS ─────────────────────────────────────

const DRIFT_RULES = {
  staleDays: 3,           // decision older than this is "stale"
  lowConfidence: 0.5,     // below this = drifting
  highImpactThreshold: 7, // high-impact decisions get extra scrutiny
};

// ─── ANALYSE A SINGLE DECISION FOR DRIFT ─────────────────

async function analyseDrift(decision) {
  const ageMs = Date.now() - new Date(decision.timestamp).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const isStale = ageDays > DRIFT_RULES.staleDays;
  const isLowConfidence = decision.confidence < DRIFT_RULES.lowConfidence;
  const isHighImpact = decision.impact_score >= DRIFT_RULES.highImpactThreshold;

  if (!isStale && !isLowConfidence) return null;

  const prompt = `You are a technical decision auditor.

Decision: "${decision.decision}"
Slot: ${decision.slot}
Reasoning: ${decision.reasoning}
Made: ${ageDays.toFixed(1)} days ago
Confidence: ${Math.round(decision.confidence * 100)}%
Impact score: ${decision.impact_score}/10
Alternatives rejected: ${JSON.stringify(decision.alternatives)}

This decision may be drifting (stale or low confidence).
Respond ONLY as JSON:
{
  "isDrifting": true or false,
  "riskLevel": "low" or "medium" or "high",
  "driftReason": "brief explanation",
  "recommendation": "what to do about it"
}`;

  try {
    const res = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    });

    const analysis = JSON.parse(res.choices[0].message.content.trim());

    if (analysis.isDrifting) {
      return {
        decisionId: decision.id,
        decision: decision.decision,
        slot: decision.slot,
        ageDays: ageDays.toFixed(1),
        confidence: decision.confidence,
        riskLevel: analysis.riskLevel,
        driftReason: analysis.driftReason,
        recommendation: analysis.recommendation,
      };
    }
    return null;
  } catch (err) {
    console.error("[DriftDetector] Parse error:", err.message);
    return null;
  }
}

// ─── SCAN ALL ACTIVE DECISIONS ────────────────────────────

async function runDriftScan() {
  console.log("\n[DriftDetector] Starting drift scan...");

  const decisions = db.getActiveDecisions();

  if (decisions.length === 0) {
    console.log("[DriftDetector] No active decisions to scan.");
    return [];
  }

  console.log(`[DriftDetector] Scanning ${decisions.length} active decisions...`);

  const driftReports = [];

  for (const decision of decisions) {
    const report = await analyseDrift(decision);
    if (report) {
      driftReports.push(report);
      console.log(`[DriftDetector] ⚠️  Drift detected: ${decision.decision}`);
      console.log(`   Risk: ${report.riskLevel} | Age: ${report.ageDays} days`);
      console.log(`   Reason: ${report.driftReason}`);
      console.log(`   Action: ${report.recommendation}`);
    } else {
      console.log(`[DriftDetector] ✓ OK: ${decision.decision}`);
    }
  }

  console.log(`\n[DriftDetector] Scan complete. ${driftReports.length} drifting decisions found.`);
  return driftReports;
}

module.exports = { runDriftScan, analyseDrift };