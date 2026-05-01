require("dotenv").config();
const Groq = require("groq-sdk");
const path = require("path");
const db = require(path.join(__dirname, "../../memory/memory-adapter"));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function findRelevantDecisions(question, allDecisions) {
  if (allDecisions.length === 0) return [];

  const decisionList = allDecisions.map((d, i) =>
    `${i + 1}. "${d.decision}" (slot: ${d.slot}, status: ${d.status})`
  ).join("\n");

  const res = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content:
      `A user is asking a question about engineering decisions.

ALL DECISIONS IN THE SYSTEM:
${decisionList}

USER QUESTION: "${question}"

Which decisions from the list above are relevant to answering this question?
Return ONLY a JSON array of 1-based index numbers, e.g. [1, 3] or [2].
If none are relevant, return [].
Return ONLY the array, nothing else.`
    }],
    temperature: 0.1,
  });

  try {
    const text = res.choices[0].message.content.trim().replace(/```json|```/g, "").trim();
    const indices = JSON.parse(text);
    if (!Array.isArray(indices)) return [];
    return indices
      .filter(i => i >= 1 && i <= allDecisions.length)
      .map(i => allDecisions[i - 1]);
  } catch {
    return allDecisions.slice(0, 5);
  }
}

function isConflictQuestion(message) {
  const msg = message.toLowerCase();
  return msg.includes("conflict") || msg.includes("contradict");
}

function isRejectedQuestion(message) {
  const msg = message.toLowerCase();
  return msg.includes("reject") || msg.includes("alternative") || msg.includes("overridden") || msg.includes("what did we not");
}

function isAllQuestion(message) {
  const msg = message.toLowerCase();
  return msg.includes("list all") || msg.includes("show all") || msg.includes("all decisions");
}

async function generateAnswer(question, decisions) {
  if (!decisions || decisions.length === 0) {
    return "No decisions found matching your question. Once decisions are captured from your engineering chats, I can answer questions about them.";
  }

  const decisionData = JSON.stringify(decisions.slice(0, 8), null, 2);

  const res = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content:
      `You are answering a question about engineering decisions made in this project.

Decision records:
${decisionData}

Question: "${question}"

Answer in plain English. Be direct and confident.
Do not output JSON. Do not mention database or technical details.
Include: what was decided, why, what alternatives were rejected, current status, who decided it.
Keep it under 4 sentences.
If multiple decisions are relevant, summarise the most important one first.`
    }],
    temperature: 0.1,
  });

  return res.choices[0].message.content;
}

async function handleQuery(message, project = "default") {
  console.log("\n[QueryAgent] Question received:", message, "| Project:", project);

  if (isConflictQuestion(message)) {
    const conflicts = db.getConflicts().filter(c => (c.project || "default") === project);
    return generateAnswer(message, conflicts);
  }

  if (isRejectedQuestion(message)) {
    const rejected = db.getAllDecisionsByProject(project).filter(d =>
      d.status === "rejected" || d.status === "overridden"
    );
    return generateAnswer(message, rejected);
  }

  if (isAllQuestion(message)) {
    const all = db.getAllDecisionsByProject(project).filter(d => d.status === "active");
    return generateAnswer(message, all);
  }

  const allDecisions = db.getAllDecisionsByProject(project);
  console.log("[QueryAgent] Semantic search over", allDecisions.length, "decisions in project:", project);

  const relevant = await findRelevantDecisions(message, allDecisions);
  console.log("[QueryAgent] Relevant:", relevant.length);

  return generateAnswer(message, relevant);
}

module.exports = { handleQuery };
