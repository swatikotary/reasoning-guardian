#!/usr/bin/env node

/**
 * Reasoning Guardian — commit-msg hook
 * Intercepts commits and checks for decision contradictions
 * before the commit goes through.
 *
 * Install: node hooks/install.js
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const readline = require("readline");

const BACKEND = "http://localhost:3001";
const GUARDIAN_CONFIG = ".guardian";

// ── READ COMMIT MESSAGE ───────────────────────────────────

const commitMsgFile = process.argv[2];
if (!commitMsgFile) {
  process.exit(0); // No file provided, skip
}

const commitMsg = fs.readFileSync(commitMsgFile, "utf8").trim();

// Skip merge commits and empty messages
if (!commitMsg || commitMsg.startsWith("Merge")) {
  process.exit(0);
}

// ── READ PROJECT CONFIG ───────────────────────────────────

function getProject() {
  try {
    const configPath = path.join(process.cwd(), GUARDIAN_CONFIG);
    const config = fs.readFileSync(configPath, "utf8");
    const match = config.match(/project=(.+)/);
    return match ? match[1].trim() : "default";
  } catch {
    return "default";
  }
}

// ── HTTP HELPER ───────────────────────────────────────────

function post(endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: "localhost",
      port: 3001,
      path: endpoint,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    };

    const req = http.request(options, (res) => {
      let raw = "";
      res.on("data", chunk => raw += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(raw)); }
        catch { resolve(null); }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// ── ASK ENGINEER ─────────────────────────────────────────

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// ── MAIN ─────────────────────────────────────────────────

async function main() {
  const project = getProject();

  console.log(`\n🛡  Reasoning Guardian is checking your commit...`);

  let result;
  try {
    result = await post("/api/chat", {
      message: commitMsg,
      project,
    });
  } catch (err) {
    // Backend not running — let commit through silently
    console.log(`⚡ Guardian offline — commit proceeding.\n`);
    process.exit(0);
  }

  if (!result) {
    process.exit(0);
  }

  // ── Decision captured — no conflict ──
  if (result.type === "decision") {
    console.log(`✅ Decision captured: "${result.decision}"`);
    console.log(`   Stored in decision memory for project.\n`);
    process.exit(0);
  }

  // ── Contradiction detected ──
  if (result.type === "conflict") {
    console.log(`\n╔══════════════════════════════════════════════════╗`);
    console.log(`║  🚨  CONTRADICTION DETECTED — Commit Blocked      ║`);
    console.log(`╚══════════════════════════════════════════════════╝`);
    console.log(`\n  Past decision:   "${result.pastDecision}"`);
    console.log(`  Your commit:     "${result.newProposal}"`);
    console.log(`\n  Reason: ${result.explanation}`);
    console.log(`\n  View full decision graph: http://localhost:3001`);
    console.log(`\n──────────────────────────────────────────────────`);

    const answer = await ask(`\n  Override and commit anyway? (y/n): `);

    if (answer === "y" || answer === "yes") {
      // Resolve as override
      if (result.conflictId) {
        try {
          await post("/api/resolve", {
            action: "override",
            conflictId: result.conflictId,
            engineer: process.env.CONTRIBUTOR_NAME || "Engineer",
            reason: "Overridden via commit",
          });
        } catch {}
      }
      console.log(`\n⚠️  Override accepted. Committing with conflict recorded.\n`);
      process.exit(0); // Allow commit
    } else {
      console.log(`\n🛡  Commit cancelled. Resolve the conflict before committing.\n`);
      process.exit(1); // Block commit
    }
  }

  // ── No decision detected ──
  process.exit(0);
}

main().catch(() => process.exit(0));
