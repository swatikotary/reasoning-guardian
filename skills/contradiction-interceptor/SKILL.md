\# Contradiction Interceptor Skill



\## What this skill does

Intercepts new engineering proposals and checks if they contradict past decisions.

Fires an alert BEFORE a contradicting decision is implemented.



\## The "Oh Damn" Moment

Engineer proposes: "Let's switch from PostgreSQL to MongoDB"

System: "Wait — we JUST decided on PostgreSQL for ACID guarantees. Contradiction!"



\## Input

New decision object (from Decision Extractor)



\## Output

Either:

\- ✓ "No contradiction, safe to proceed"

\- 🚨 Alert with conflict details (past decision, new proposal, severity)



\## Alert Levels

\- `critical` — Direct contradiction of same slot decision

\- `warning` — Potentially conflicting constraints

\- `none` — Safe to proceed



\## Process

1\. Get all active decisions in the new decision's slot

2\. Compare new decision against each using Groq

3\. If contradiction found: save to conflicts table, fire alert

4\. Return alert object for display/logging

