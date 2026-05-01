require("dotenv").config();
const http = require("http");
const path = require("path");
const fs = require("fs");
const db = require("../memory/memory-adapter");
const { handleDecisionExtraction } = require("../skills/decision-extractor/index");
const { handleContradictionCheck } = require("../skills/contradiction-interceptor/index");
const { handleQuery } = require("../skills/query-agent/index");
const { runDriftScan } = require("../skills/drift-detector/index");

const PORT = 3001;

function serveFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    const ext = path.extname(filePath);
    const types = { ".html": "text/html", ".js": "application/javascript" };
    res.writeHead(200, { "Content-Type": types[ext] || "text/plain" });
    res.end(data);
  });
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  const json = (data) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };

  // ── GET /api/decisions — returns all decisions (frontend filters by project)
  if (req.url === "/api/decisions" && req.method === "GET") {
    return json(db.getAllDecisions());
  }

  // ── GET /api/conflicts
  if (req.url === "/api/conflicts" && req.method === "GET") {
    return json(db.getAllConflicts());
  }

  // ── GET /api/drift
  if (req.url === "/api/drift" && req.method === "GET") {
    try {
      const reports = await runDriftScan();
      return json({ reports });
    } catch (err) {
      console.error("[Drift] Error:", err.message);
      return json({ reports: [], error: err.message });
    }
  }

  // ── POST /api/chat — live message with project scoping
  if (req.url === "/api/chat" && req.method === "POST") {
    const { message, project = "default" } = await parseBody(req);

    const isQuestion = message.includes("?") ||
      /^(why|what|how|show|list|who)/i.test(message);

    if (isQuestion) {
      const answer = await handleQuery(message, project);
      return json({ type: "question", answer });
    }

    const result = await handleDecisionExtraction(message, project);
    if (!result || !result.extracted) {
      return json({ type: "none" });
    }

    const contradiction = await handleContradictionCheck(result.extracted, project);
    if (contradiction && contradiction.severity) {
      return json({
        type:         "conflict",
        conflictId:   contradiction.details?.conflictId || "",
        pastDecision: contradiction.details?.past || "",
        newProposal:  contradiction.details?.proposed || "",
        explanation:  contradiction.details?.reason || "",
        severity:     contradiction.severity,
      });
    }

    return json({ type: "decision", decision: result.extracted.decision });
  }

  // ── POST /api/analyse — paste history with project scoping
  if (req.url === "/api/analyse" && req.method === "POST") {
    const { text, project = "default" } = await parseBody(req);
    const lines = text.split(/[\n.!]+/).filter(l => l.trim().length > 20);
    const saved = [];

    for (const line of lines) {
      const result = await handleDecisionExtraction(line.trim(), project);
      if (result && result.extracted) saved.push(result.extracted.decision);
    }

    return json({ decisions: saved });
  }

  // ── POST /api/resolve
  if (req.url === "/api/resolve" && req.method === "POST") {
  const { action, conflictId, engineer, reason } = await parseBody(req);
  db.resolveConflict(conflictId, action, engineer, reason);
  return json({ status: "ok" });
}

  // ── Static files
  if (req.url === "/" || req.url === "/index.html") return serveFile(path.join(__dirname, "index.html"), res);
  if (req.url === "/app.js") return serveFile(path.join(__dirname, "app.js"), res);

  res.writeHead(404); res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`\n🛡️  Reasoning Guardian`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`👤 Engineer: ${process.env.CONTRIBUTOR_NAME || "Engineer"}`);
  console.log(`✅ All systems live\n`);
});
