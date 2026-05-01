\# Decision Extractor Skill



\## What this skill does

Monitors engineering chat messages and extracts structured decisions using Groq.

Parses: what was decided, why, alternatives rejected, constraints, impact score.



\## Input

Raw chat message, e.g.:

"Let's use MongoDB for the auth service because we need schema flexibility"



\## Output

Structured decision object saved to decisions.db:

\- decision (string)

\- slot (database, framework, deployment, etc)

\- reasoning (why)

\- alternatives (rejected options)

\- constraints (limitations)

\- impact\_score (1-10)

\- scope (service, component)



\## Example

Input: "MongoDB for auth service instead of PostgreSQL"

→ Saves to decisions table with all metadata

→ Skips if duplicate already exists



\## Key Features

\- Two-pass Groq pipeline for high accuracy

\- Duplicate detection (same slot + decision = skip)

\- Confidence scoring

\- Contributor tracking

