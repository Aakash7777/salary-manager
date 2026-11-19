# How I used AI

## Tools
- Claude Code (agentic: implementation, tests, refactors), guided by `CLAUDE.md`
- Claude chat (requirements and architecture drafting, review)

## Workflow
1. I wrote and owned the requirements and architecture. AI drafted, I edited and cut scope.
2. For each feature: I state the behaviour and test cases → the agent writes failing tests → I review them → the agent implements → I review the diff before committing.
3. The agent never commits without a green suite. I check every money and stats calculation by hand.

## Log (keep adding as you go — be honest; corrections are the valuable part)
| # | Task | Prompt (short) | What I kept | What I rejected / fixed, and why |
|---|---|---|---|---|
| 1 | Requirements draft | "Draft a one-page requirements doc for…" | Scope structure | |
