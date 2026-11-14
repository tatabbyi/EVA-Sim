# Sharkies — Instructions for AI-assisted Team Development

**Prepared:** 2026-11-14  
**Maintainer:** Alex (engine/integration)  
**Status:** TEAM REVIEW DRAFT. Real RAW exports must be read from checked-out `src/core/*` and `src/adapters/*`; do not treat proposed types as imports.

## Purpose

Every team member uses an AI assistant as an **implementer within that member's scope**, not as an independent architect who may redefine shared physics, overwrite someone else's code, or invent interfaces. The same inputs, coordinate/units contract, and review gates must be available to every AI agent so independently generated components remain compatible.

Read the common [README.md](README.md), then your role-specific contract:

| Person | Contract | Working scope |
|---|---|---|
| **Rachel** | [RACHEL-VISUALS.md](RACHEL-VISUALS.md) | Visual-only Three.js/React: HUD, shader/sky, route visual, task animation assets |
| **Nanda** | [NANDA-ROUTING.md](NANDA-ROUTING.md) | Offline ML or classical routing provider, route validation/provenance; coordinate with Alex over science |
| **Victor** | [VICTOR-TERRAIN.md](VICTOR-TERRAIN.md) | Real terrain/height data, region metadata, optional render meshes, safe height sampling |
| **Alex** | [RAW-ENGINE-V01.md](../RAW-ENGINE-V01.md) + [RAW-V01-API-RECONCILIATION.md](RAW-V01-API-RECONCILIATION.md) | Core, Electron, app adapters, integration and final review |

**Source access:** Use this PR branch or the subsequently approved team `main`. Private fork links may be unavailable to AI agents; they must inspect their local checked-out source.

## 1. Shared AI rules — mandatory for every implementation prompt

1. **Inspect actual repository code first.** Print Git branch, HEAD SHA, remotes and status; look for recent teammate commits. Know whether you are on the shared team repo, a fork or a temporary branch. Do not override dirty worktrees, reset/force-push, or push to team main.
2. **Read the contracts in order:** common README → personal contract → relevant source signatures and tests → approved decisions. Distinguish `CONFIRMED`, `PROPOSED`, `DEMO`, `OPEN`, `SUPERSEDED`. Never implement a proposal as settled without owner review.
3. **Stay in your scope.** Edit your own modules and add new scoped modules. Preserve protected paths and external exports unless the owner approves a breaking change. **If a needed change crosses ownership, stop and report the exact file, reason, old/new signature and proposed adapter.**
4. **One coordinate frame:** metres, x east (+), z south (+), y up (+), heights relative to region `h0`; carry `regionId`, `frameId` and terrain revision as appropriate. No hidden assumption that the shuttle is at (0,0), and no assuming old 4096m Jezero is the whole Mars world.
5. **Scientific honesty:** oxygen gas inventory will be in **grams**; normal HUD eventually 0–100% based on approved capacity. No old `390 L` or `30 min` as approved physics, no arbitrary 25° hard cap, no fake trained ML, and MOXIE does not refill the astronaut's suit.
6. **State ownership:** pure TypeScript game engine, not shaders, animation frame callbacks or routing functions, decides mission task status, player position and resources. Renderers consume snapshots/events; Python is allowed for offline data preprocessing, not required per-frame at runtime.
7. **Offline Windows/Linux runtime:** any shipped data, model weights and visual assets must be bundled and locally usable. Build-time setup may use the internet; gameplay must not require NASA APIs, a CDN, hosted backend or remote Python service. macOS package is out of RAW v0.1 scope.
8. **Prove behavior:** provide a deterministic fixture, test(s) or reproducible manual steps and explicit failure/no-data behavior. Preserve Rachel `#preview` and do not break the actual Electron app.
9. **Report truthfully:** identify files changed, imported/added dependencies, exact commands run, test PASS/FAIL/NOT TESTED, OS, artifact/coordinate units, model/data provenance, unresolved questions. Don't claim Windows runtime was tested on Linux.
10. **Feature branch + reviewed PR only:** no direct upstream `main` push/merge, no stealth integration, no delete/rewrite of teammate work. **Alex coordinates final API reconciliation after RAW Codex finishes.**

## 2. Required contract exchange for any interface

Before implementing an inter-team boundary, write a short **Interface Handoff Record** in your branch or PR description:

```text
Contract ID: R-01 / N-01 / V-01 / new version
Owner + consumer: ...
Source branch + commit SHA: ...
Status: DRAFT / READY FOR REVIEW / ACCEPTED / IMPLEMENTED
Input type, field names, units, frame/version: ...
Output type, field names, units, frame/version: ...
Error/null/no-data behavior: ...
Thread/runtime: main/core/renderer/worker/preprocessor
Determinism and lifecycle/cleanup: ...
Small real or synthetic fixture: ...
Proof: test command + observed output or screenshot
Known mismatch with RAW current exports: ...
Approval needed from: ...
```

A `DRAFT` is **not** a compile-ready API. Mark a contract `ACCEPTED` only after the owning teammate and Alex reconcile the actual exported code and sign off.

## 3. Ready-to-paste AI prompts (use only with corresponding files available)

### Rachel — visual components

```text
You are working on Rachel-owned visuals in Sharkies. First inspect the repository, branch,
source files and docs/integration/README.md, docs/integration/RACHEL-VISUALS.md,
docs/integration/AI-AGENT-HANDOFF.md, and docs/FOUR-TASK-ANIMATION-BRIEF.md.

Do not change Alex's engine, Nanda's planner/controller or Victor's terrain loaders/contracts.
Preserve the existing #preview and reuse existing HelmetHud/material/routePath/sampleSite
interfaces when still current. Design visual components that accept typed read-only state,
route points and semantic task events through an adapter. Explicitly handle unknown O2
and temperature; never display 390L as production truth or silently convert grams to litres.
Never make animation completion automatically consume oxygen or mark a task successful.

Develop on your own feature branch. Return demo screenshots, exports/props/assets,
coordinates/units, lifecycle/dispose behavior, test evidence, changed files and any contract
mismatch. Stop for review before edits to other owners' modules or breaking public APIs.
```

### Nanda — offline route planning

```text
You are working on Nanda's offline route planner for Sharkies. Inspect the real repository
and docs/integration/README.md, docs/integration/NANDA-ROUTING.md,
docs/integration/AI-AGENT-HANDOFF.md, and Victor's available terrain manifest/grid.

Produce a replaceable offline planner that accepts a region/frame/terrain revision,
the current shuttle position and TWO preselected task sites inside playable bounds.
Return ordered local x/z metre waypoints or an explicit failure, with truthful planner
provenance: trained ML, classical, hybrid or DEMO. A* is not trained ML. The planned
path is guidance; it does not move the astronaut or decide mission success.

Validate no-data heights, bounds, task-site visit order and consistency of frameId.
Do not install unapproved litres-based O2 or gait formulas, change Alex core or
Rachel HUD, or assume an online model server. Supply tiny deterministic fixtures,
a real Jezero test when available, benchmarking, exact input/output schema,
dependencies, offline packaging plan, and any decision requested from Alex.
Use your own feature branch; do not push/merge upstream main.
```

### Victor — terrain/model provider

```text
You are working on Victor-owned terrain/geometry for Sharkies. First inspect the repository
and docs/integration/README.md, docs/integration/VICTOR-TERRAIN.md,
docs/integration/AI-AGENT-HANDOFF.md and the existing TEAM-PLAN.md coordinate/grid sections.

Deliver terrain assets and a manifest with real data provenance, CRS/origin/h0,
regionId/frameId, revision, bounds, resolution, file encoding/shape, no-data behavior
and render mesh format. Provide heightAt(x,z) semantics in local metres with positive x
east and positive z south; invalid/outside returns explicit null/error, never silently
clamped heights. The shuttle is mission-specific, not permanently at local (0,0).

Keep terrain geometry and the height sampler aligned, validate tile winding/normals,
and make all assets available offline on Windows/Linux. Do not rewrite Rachel shaders,
Alex engine or Nanda planner to force compatibility. Provide one tiny synthetic fixture,
one real dataset check, loader/build instructions, measured data/mesh size/performance
and a list of unresolved format or landing-site questions. Work in your own feature
branch and stop before changing other owners' public exports.
```

## 4. Team merge and ownership protocol

1. Review this PR (do not push/merge straight into team main).
2. Owners review their contract and identify exact mismatches with real exports.
3. Update a shared signature only with owner and Alex approval, using a focused PR.
4. After team merge, each AI agent works from a pinned team-main commit and the accepted contract version.
5. Do not import suggested `RouteRequest` or `RegionManifestV1` from RAW; they are not shipped exports.
