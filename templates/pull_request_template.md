### Summary

Brief description of what this PR accomplishes.

### Plan

- **Intent**: What are we changing and why?
- **Scope**: Files to touch (≤8 preferred)
- **Risks**: Breakages, state, migrations, security
- **Test Plan**: Pre-checks, unit/integration, e2e
- **Rollback**: How to revert quickly
- **Acceptance Criteria (DoD)**: What proves this is done

### Agent Information

- **Agent**: `lead, fe, be, db, ops, test` (choose one)
- **Pattern**: `lead_specialists, peer_to_peer, single_agent, pipeline, swarm` (choose one)
- **Target Branch**: `feature/*, dev, main` (choose one)

### Checklists

#### Core Requirements

- [ ] CI green (lint, typecheck, build, tests)
- [ ] Tests added/updated; coverage not reduced
- [ ] Docs updated (README/docs/comments/claude.md if process changes)
- [ ] Rollback path proven (revert PR or feature toggle)
- [ ] Security review complete for secrets, PII, and permissions

#### Specialist Checklists (check applicable)

**Frontend Expert** (for UI/React/Next.js changes):

- [ ] Updated/added stories & visual tests
- [ ] Lighthouse/perf check ≥ target
- [ ] A11y pass (labels, roles, focus)
- [ ] API types synced from OpenAPI client

**Backend Expert** (for Node.js/Express/API changes):

- [ ] OpenAPI spec changed & versioned
- [ ] Integration tests for endpoints
- [ ] Logs: trace id + severity + context
- [ ] Rate limits/authz considered

**Database Expert** (for schema/migration changes):

- [ ] Zero‑downtime migration plan
- [ ] Index/EXPLAIN reviewed
- [ ] Rollback migration present (if feasible)
- [ ] Data retention/privacy checked

**Infrastructure Expert** (for Docker/Traefik/AWS changes):

- [ ] Compose/Traefik linted; ports & TLS correct
- [ ] Healthcheck & rollback documented
- [ ] Secrets via provider, not env files in repo
- [ ] Monitoring/alerts updated

**Test Agent** (for test changes):

- [ ] Repro test first (red) then fix (green)
- [ ] Mutation/coverage threshold maintained
- [ ] E2E happy path + one failure path

### Additional Notes

Any context, decisions, or follow-up work needed.
