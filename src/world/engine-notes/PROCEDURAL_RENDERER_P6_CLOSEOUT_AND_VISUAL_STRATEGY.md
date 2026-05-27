# AI-PET-WORLD P6 Procedural Renderer Historical Closeout

> Status: historical phase record.
>
> This document is retained only for traceability. It must not be used as the current V2.6 product, architecture, or development source of truth.

## Current V2.6 Alignment

The P6 procedural renderer route was a historical validation route. It is no longer the formal `/world` primary surface.

Current formal `/world` route:

```txt
WorldRuntimeSaveRecord + HomeMapState + SpaceGrid + TraceField + ButlerState
-> WorldViewModel
-> PixelWorldView
-> Tile / Trace / Object / Sprite / Atmosphere Layer
```

Procedural renderer assets, draw-command diagnostics, wireframe previews, renderer summaries, manual inspection panels, and related validation UI must stay in `/world-debug` or historical validation contexts.

## Historical P6 Meaning

P6 validated that a renderer can read world facts and present a development preview without generating world facts. That historical result remains useful as a development trace, but it is not the current formal player experience.

## Current Red Lines

- Formal `/world` must not use the procedural renderer as its primary visual surface.
- Formal `/world` must not use SVG or data URI previews as its primary visual surface.
- Formal `/world` must not expose renderer summaries, draw-command summaries, audit cards, or manual tick controls.
- UI and renderer layers must not write HomeMapState or runtime save records.
- Pixel Scene Composer and procedural renderer work belong to debug or rules-lab contexts.
