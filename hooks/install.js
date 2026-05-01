#!/usr/bin/env node

/**
 * Reasoning Guardian — hook installer
 * Run: node hooks/install.js
 */

const fs = require("fs");
const path = require("path");

const hookSource = path.join(__dirname, "commit-msg.js");
const gitHooksDir = path.join(process.cwd(), ".git", "hooks");
const hookDest = path.join(gitHooksDir, "commit-msg");

// Check .git exists
if (!fs.existsSync(gitHooksDir)) {
  console.error("❌ No .git folder found. Run this from your repo root.");
  process.exit(1);
}

// Write hook wrapper that calls our Node script
const hookContent = `#!/bin/sh
node "${hookSource.replace(/\\/g, "/")}" "$1"
`;

fs.writeFileSync(hookDest, hookContent);

// Make executable (Linux/Mac — no-op on Windows but harmless)
try {
  fs.chmodSync(hookDest, "755");
} catch {}

console.log(`\n🛡  Reasoning Guardian hook installed successfully.`);
console.log(`   Every commit will now be checked for decision contradictions.\n`);
console.log(`   Make sure your .guardian file exists with your project ID:`);
console.log(`   echo "project=YOUR_PROJECT_ID" > .guardian\n`);
