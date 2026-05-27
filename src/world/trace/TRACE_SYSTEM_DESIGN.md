# AI-PET-WORLD Trace System v0

## Purpose

Trace System v0 is the formal world-memory fact layer for traces. It reads `HomeMapState` and `SpaceGrid`, then derives `TraceFact` and `TraceField` as a stable read-only projection.

M2 `traceStrength` is a spatial hint. M3 `TraceFact` is the formal trace fact model. In v0 it is still derived and not the final persisted trace store.

## Trace Field

`TraceField` aggregates `TraceFact` records for World Painter and future systems. It exposes summary counts and projected cell ids without pushing full trace data into renderer-facing summaries.

The first version derives:

- `spatial_use`
- `movement`
- `ecology_change`

Other trace types are reserved for later modules and are not forced into the current projection.

## Lifecycle

`TraceLifecycle` describes generated, accumulating, strengthened, decaying, covered, repaired, and deposited phases. The current rules are pure functions over strength, age, source kind, and ecology-health hints.

## Boundaries

This module does not render traces.

This module does not implement steward behavior.

This module does not implement pet behavior.

This module does not implement world learning.

This module does not create a formal fixed movement network.

This module does not mutate `HomeMapState`.

Future M4/M5 work can connect `TraceField` into Scene Composer and visual presentation.
