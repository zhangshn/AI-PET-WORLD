# AI-PET-WORLD Formal / Debug View Mode｜Historical Record

> Status: historical view-mode record.
>
> This document is retained only for traceability. It must not be used as the current V2.6 product, architecture, or development source of truth.

## Current V2.6 Alignment

Historical formal/debug/both view modes were development validation tools. They are not the current formal `/world` experience.

Current formal `/world` route:

```txt
readWorldRuntimeForView
-> buildWorldViewModelForPixelWorld
-> PixelWorldView
```

Debug renderers and side-by-side comparison modes belong under `/world-debug`.

## Current Display Rule

- Formal `/world` must show the pixel main world through PixelWorldView.
- Debug renderer views must stay in `/world-debug`.
- Side-by-side renderer comparison is a development tool, not a player-facing route.
- Manual tick, manual save, audit trail, and engineering cards must not be formal `/world` surface elements.

## Current Red Lines

- UI must not write runtime save records.
- UI must not advance runtime tick.
- UI must not generate TraceField or TraceVisualProjection.
- UI must not generate pet facts.
- Debug renderer assets must not be reintroduced as the formal primary surface.
