\# Drift Detector Skill



\## What this skill does

Scans all active decisions and flags ones that are becoming stale or losing confidence.



\## Drift Signals

\- Decision older than 3 days with no reinforcement

\- Confidence score below 50%

\- High-impact decisions (7+) that haven't been reviewed



\## Output

List of drift reports with:

\- Which decision is drifting

\- Risk level (low / medium / high)

\- Why it's drifting

\- What to do about it



\## When to run

\- On a schedule (daily)

\- Before major planning sessions

\- On demand via dashboard

