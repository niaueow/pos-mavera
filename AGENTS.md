# AGENTS.md — POS Mavera

## Project Overview
POS Mavera is a web-based food ordering and order tracking system for Ayam Geprek Mavera.

Read `docs/PRD.md` before making changes.

## Rules
1. Follow the approved PRD and `docs/TECHNICAL_DECISIONS.md`.
2. Do not invent requirements or silently change business rules.
3. Do not implement the entire application in one step.
4. Work only on the explicitly requested implementation phase.
5. Inspect existing code before modifying files.
6. Keep frontend and backend responsibilities separate.
7. Validate all incoming data on the backend.
8. Never trust prices, totals, payment status, or user roles supplied by the client.
9. Never expose secrets, JWT signing keys, or Midtrans Server Keys to the frontend.
10. Verify Midtrans notifications and handle duplicate notifications safely.
11. Use database migrations for schema changes.
12. Add appropriate automated tests for new functionality and bug fixes.
13. Do not claim a test passed unless it was actually executed.
14. Do not remove existing functionality without approval.
15. Do not install unnecessary dependencies or introduce additional frameworks without justification.

## Definition of Done
A task is complete only when:
- Its acceptance criteria are satisfied.
- Relevant tests have been executed.
- Linting and build checks pass where configured.
- Error handling and validation are implemented.
- Documentation is updated when necessary.
- Remaining limitations are explicitly reported.

## Working Protocol
Before implementing a task, summarize the intended changes and dependencies. After implementation, report changed files, commands executed, test results, and unresolved issues.