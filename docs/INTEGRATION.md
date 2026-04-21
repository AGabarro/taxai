# INTEGRATION.md — Agent Coordination Reference

> This file lives on `master` and is readable by both agents.
> It defines the handshake protocol between Agent A (backend) and Agent B (frontend).

---

## Port Map

| Service | Port | Command |
|---|---|---|
| API server (Agent A) | `:3000` | `pnpm dev:api` from monorepo root |
| Frontend (Agent B) | `:5173` | `pnpm --filter @taxai/frontend dev` |

CORS is pre-configured in `apps/api/src/server.ts` to allow `http://localhost:5173`.

---

## Signal Commit Convention

Agents communicate readiness by embedding tags in commit messages:

```
feat(scope): description [SIGNAL: <signal-name>]
```

### Published signals

| Signal name | Branch | Sender | Consumer |
|---|---|---|---|
| `shared-types-ready` | feature/backend | Agent A | Agent B |
| `calculate-ready` | feature/backend | Agent A | Agent B |
| `extract-ready` | feature/backend | Agent A | Agent B |
| `explain-ready` | feature/backend | Agent A | Agent B |
| `dashboard-ready` | feature/frontend | Agent B | Agent A |

### How to check for signals

```bash
# Check all signals Agent A has sent
git fetch origin
git log origin/feature/backend --oneline | grep SIGNAL

# Check all signals Agent B has sent
git log origin/feature/frontend --oneline | grep SIGNAL
```

### How to pull the other agent's work

```bash
# Agent B pulling Agent A's latest (most common)
git merge origin/feature/backend --no-edit

# Agent A pulling Agent B's latest (for integration testing)
git merge origin/feature/frontend --no-edit
```

---

## Integration Milestones

| Milestone | Required signals | Integration action |
|---|---|---|
| **Shared types** | `shared-types-ready` | Agent B: replace local `types.ts` with `import from '@taxai/shared'` |
| **Live calculation** | `calculate-ready` + `dashboard-ready` | Agent B: swap MOCK_RESULT for live API call |
| **Chat input** | `extract-ready` | Agent B: build ChatInput.tsx |
| **AI explanations** | `explain-ready` | Agent B: build ExplanationPanel.tsx |
| **Full integration test** | All Phase 1 signals | Human: run verification checklist below |

---

## End-to-End Verification Checklist

Run this after both agents complete Phase 1:

```bash
# Terminal 1 — start API
cd /Users/adria.gabarro/Documents/Taxai/worktrees/agent-a
pnpm dev:api

# Terminal 2 — start frontend
cd /Users/adria.gabarro/Documents/Taxai/worktrees/agent-b
pnpm --filter @taxai/frontend dev
```

Then open `http://localhost:5173` and verify:

- [ ] Form renders with all fields labeled in Spanish
- [ ] Submit with: Madrid, age 35, salary €40,000, retenciones €5,200, single, no dependents
- [ ] ResultDashboard appears with a result amount (positive or negative)
- [ ] WaterfallChart renders all steps with correct colors (green = reduction, red = tax charge)
- [ ] Manually verify result against [Agencia Tributaria simulator](https://sede.agenciatributaria.gob.es)
- [ ] Ask a question in ExplanationPanel — response is in Spanish and references only displayed numbers
- [ ] Test on mobile width (375px) — dashboard is readable in 5 seconds

---

## Merging Back to Master

When both agents complete a phase, merge to master in this order:

```bash
# From the main Taxai directory (master branch)
git merge feature/backend --no-edit
git merge feature/frontend --no-edit
git push origin master  # only when explicitly requested
```
