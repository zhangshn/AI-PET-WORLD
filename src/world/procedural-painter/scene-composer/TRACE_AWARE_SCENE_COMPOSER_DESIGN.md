# Trace-aware Scene Composer Design

## Purpose

Scene Composer now uses `traceFacts`, `traceShape`, and `traceDensity` together when composing a scene.

`traceFacts` are compressed inputs from the formal world trace model. They are not full `TraceFact` records and are not persisted by Scene Composer.

## Composition Effects

Trace influence affects:

- long-used area tiles
- trace edge / ecology transition tiles
- grass density and grass tuft height
- decorative generated-object avoidance

Fact-bound objects are not deleted by trace influence. Only generated decorative objects may be avoided.

## Compatibility

The renderer still receives legacy visual tile kinds:

- `"path"` means deprecated renderer compatibility for long-used area tile.
- `"edge"` means deprecated renderer compatibility for trace edge / ecology transition tile.

These names are not formal business concepts and must not be expanded into a fixed movement network.

## Boundary

M4 only changes scene composition. It does not implement final trace visuals. M5 can express trampling, exposed soil, recovery, and other visual details.
