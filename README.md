\# Reasoning Guardian 🛡️



An AI system that intercepts bad engineering decisions before they happen.



\## What It Does

1\. \*\*Extracts\*\* decisions from engineering chat messages

2\. \*\*Stores\*\* them in SQLite (decisions.db)

3\. \*\*Fires alerts\*\* when a new proposal contradicts a past decision

4\. \*\*Answers questions\*\* like "Why did we choose PostgreSQL?"

5\. \*\*Detects drift\*\* — flags stale or low-confidence decisions

6\. \*\*Visualizes\*\* everything on a live dashboard



\## Quick Start



\### Prerequisites

\- Node.js v18+

\- Groq API key — get free at console.groq.com



\### Setup

```bash

npm install

Create a .env file manually and add: GROQ_API_KEY=your_key_here

./sqlite3 memory/decisions.db < memory/schema.sql

```



\### Run Dashboard

```bash

node dashboard/server.js

\# Open http://localhost:3001

```



\### Run with Docker

### Run with Docker (Optional)
Docker support is included via `Dockerfile` and `docker-compose.yml`.
To use, install Docker Desktop from https://www.docker.com/products/docker-desktop/
then run:



\## Architecture

Chat Message

↓

Decision Extractor  →  decisions.db  →  Dashboard

↓                      ↑

Contradiction Interceptor    Query Agent

↓

🚨 ALERT



\## Team

\- Harsh: Decision Extractor, Contradiction Interceptor, Drift Detector

\- Swati: Query Agent, Dashboard, Docker, README



\## Tech Stack

\- Runtime: Node.js + OpenClaw

\- AI: Groq (llama-3.3-70b-versatile)

\- Database: SQLite (better-sqlite3)

\- Dashboard: Vanilla HTML/JS

\- Container: Docker



