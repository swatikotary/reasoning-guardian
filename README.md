# 🛡️ Reasoning Guardian
### Decision Intelligence Layer for AI-Assisted Engineering Teams

> Critical engineering decisions get lost over time — buried in AI chats, Slack threads, WhatsApp messages. Documentation is manual, slow, and always out of date. There is no AI layer that automatically tracks decisions as they are made and flags contradictions before they cause damage.
>
> Reasoning Guardian fixes this. It saves hours of manual documentation and prevents engineers from unknowingly working on the wrong thing.

---

## The Magic Moment

```bash
$ git commit -m "switching to postgresql for better relational queries"

🛡  Reasoning Guardian is checking your commit...

╔══════════════════════════════════════════════════╗
║  🚨  CONTRADICTION DETECTED — Commit Blocked      ║
╚══════════════════════════════════════════════════╝

  Past decision:   "use mongodb for database storage"
  Your commit:     "switch to postgresql"

  Reason: Both decisions define the primary database.

  To resolve:
  1. Open http://localhost:3001
  2. Go to Conflicts tab and resolve the conflict
  3. Then retry your commit

  Or to force: git commit --no-verify -m "your message"

🛡  Commit blocked by Reasoning Guardian.
```

The engineer didn't open a dashboard. They didn't fill in a form. They just wrote a commit message — like always. Guardian intercepted automatically.

---

## Core Insight

**Decision = the fundamental unit of memory. Not chat. Not context. Decision.**

Current systems store raw text and re-interpret it inconsistently at retrieval time.

Reasoning Guardian interprets at commit time, stores structured decision objects, and checks every new proposal against the full decision graph in real time.

| Current Systems | Reasoning Guardian |
|---|---|
| Store raw chat text | Store structured decision objects |
| Re-interpret inconsistently | Same answer every time |
| User must search for reasoning | System intercepts proactively |
| No awareness of contradictions | Flags conflicts before they land |

---

## What It Does

1. **Extracts** decisions automatically from engineering chat and Git commits
2. **Stores** them as structured objects with slot, reasoning, alternatives, confidence, contributor
3. **Intercepts** contradictions in real time — before a commit lands or a decision takes root
4. **Answers** questions like "Why did we choose MongoDB?" or "Who made that decision?"
5. **Visualises** the full decision evolution — who decided what, when, why, and what was overridden
6. **Isolates** decisions per project — MongoDB in Project A never conflicts with Project B

---

## Quick Start

### Prerequisites
- Node.js v18+
- Groq API key — free at [console.groq.com](https://console.groq.com)
- Git

### 1. Clone and Install
```bash
git clone https://github.com/swatikotary/reasoning-guardian.git
cd reasoning-guardian
npm install
```

### 2. Create .env
Create a file called `.env` in the project root:
```
GROQ_API_KEY=your_groq_key_here
CONTRIBUTOR_NAME=YourName
```

### 3. Create the Database
```bash
node -e "const Database = require('better-sqlite3'); const db = new Database('memory/decisions.db'); db.exec(require('fs').readFileSync('memory/schema.sql', 'utf8')); console.log('Database created');"
```

### 4. Run the Server
```bash
# Mac/Linux
GROQ_API_KEY=your_key CONTRIBUTOR_NAME=YourName node dashboard/server.js

# Windows PowerShell
$env:GROQ_API_KEY="your_key"
$env:CONTRIBUTOR_NAME="YourName"
node dashboard/server.js
```

Open [http://localhost:3001](http://localhost:3001)

### 5. Install the Git Hook
```bash
git init
node hooks/install.js
echo "project=default" > .guardian
```

---

## Usage

### Chat Interface
Type any engineering decision in the chat panel:
```
we will use MongoDB for the database, schema flexibility is key
```
Guardian extracts it, stores it, and monitors all future decisions against it.

Ask questions about past decisions:
```
why did we choose MongoDB?
who made the database decision?
what decisions have been made?
```

### Git Hook
Just commit normally. Guardian runs automatically:
```bash
git commit -m "we will use jest for testing"
# → Decision captured silently, commit goes through

git commit -m "switching to vitest for our test runner"  
# → BLOCKED — contradicts jest decision
```

### Dashboard
- **Active tab** — all current decisions with confidence scores
- **Timeline tab** — full decision evolution: what was decided, challenged, overridden, and by whom
- **Conflicts tab** — unresolved conflicts with Override/Reconfirm buttons
- **Chat** — ask questions, type decisions, query the decision graph

### Projects
Each project has its own isolated decision graph. Decisions from different projects never conflict. Create projects from the sidebar, manage team members per project.

---

## Architecture

```
Chat Message / Git Commit
        ↓
  Decision Extractor
  (Two-pass Groq pipeline)
  Pass 1: commit signal detection
  Pass 2: structured extraction + scoring
        ↓
   Decision Store
   (SQLite — decisions.db)
        ↓
  Contradiction Interceptor
  (Full-context LLM — sees all active decisions)
        ↓
  Alert / Block / Capture
        ↓
   Query Agent
   (Semantic Groq search)
        ↓
  Dashboard + Git Hook
```

---

## OpenClaw Integration

This project's skills are built to the [AgentSkills spec](https://clawhub.ai) and are installed in the OpenClaw workspace.

```bash
npm install -g openclaw
openclaw --version

# Copy skills to OpenClaw workspace (Mac/Linux)
mkdir -p ~/.openclaw/workspace/skills
cp -r skills/decision-extractor ~/.openclaw/workspace/skills/
cp -r skills/contradiction-interceptor ~/.openclaw/workspace/skills/
cp -r skills/drift-detector ~/.openclaw/workspace/skills/
cp -r skills/query-agent ~/.openclaw/workspace/skills/
cp SOUL.md MEMORY.md ~/.openclaw/workspace/

# Verify
ls ~/.openclaw/workspace/skills
# → decision-extractor  contradiction-interceptor  drift-detector  query-agent
```

> **Note:** There is a known OpenClaw bug ([GitHub #49873](https://github.com)) where workspace skills don't appear in `openclaw skills list` even when correctly installed. The skills are confirmed physically present and loaded by the agent runtime. This is a display-only issue.

---

## Project Structure

```
reasoning-guardian/
├── skills/
│   ├── decision-extractor/       Two-pass Groq extraction pipeline
│   ├── contradiction-interceptor/ Full-context LLM contradiction check
│   ├── drift-detector/           Stale and low-confidence detection
│   └── query-agent/              Semantic Groq search
├── memory/
│   ├── decisions.db              SQLite decision store
│   └── memory-adapter.js         All database operations
├── dashboard/
│   ├── index.html                Full dashboard UI
│   └── server.js                 API server (port 3001)
├── hooks/
│   ├── commit-msg.js             Git hook — intercepts commits
│   └── install.js                One-command hook installer
├── SOUL.md                       OpenClaw agent personality
├── MEMORY.md                     OpenClaw memory configuration
├── openclaw.json                 OpenClaw skill configuration
└── .guardian                     Project ID for Git hook
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Agent Runtime | OpenClaw |
| LLM | Groq (llama-3.3-70b-versatile) |
| Database | SQLite via better-sqlite3 |
| Runtime | Node.js |
| Dashboard | Vanilla HTML/CSS/JS |
| Container | Docker + docker-compose |

---

## AI Disclosure

This project was built with significant AI assistance as part of an AI-native development workflow — which is itself a demonstration of the problem we are solving.

| Component | How AI Was Used |
|---|---|
| Architecture design | Claude (Anthropic) — iterative design sessions, architectural decisions, tradeoff analysis |
| Core skill prompts | Claude — prompt engineering for two-pass extraction, contradiction detection, semantic search |
| Dashboard UI | Claude — component design, CSS, JavaScript logic |
| Git hook | Claude — hook logic, Windows compatibility |
| All LLM inference at runtime | Groq API (llama-3.3-70b-versatile) — decision extraction, contradiction checking, query answering |
| Agent runtime | OpenClaw — skill orchestration |

**Original contributions by the team:**
- Problem identification and framing — decisions as unit of memory, not text
- Architectural insight — interpret-before-store inversion
- Product decisions — what to build, what not to build, demo design
- System integration and debugging
- All ideation, validation, and direction

---

## Team

**Team Axiom — Ramaiah Institute of Technology, Bangalore**

| Name | USN | Role |
|---|---|---|
| Harsh Raj | 1MS24CS064 | Architecture, Decision Extractor, Contradiction Interceptor, Git Hook |
| Swati Jayaram Kotary | 1MS24CS226 | Query Agent, Dashboard, Docker, README |

**PRISM Hackathon 2026 — Samsung**

---

*"There's still a cost to looking it up and finding the right thing that's actually relevant for the specific decision you've got to make right now. And that's non-trivial."*
*— Demis Hassabis*
