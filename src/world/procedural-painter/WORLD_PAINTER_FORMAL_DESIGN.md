# AI-PET-WORLD World Painter Formal Design

## 1. Formal Positioning

World Painter is the read-only visual projection layer for AI-PET-WORLD. It does not create world facts, does not mutate `HomeMapState`, and does not decide what formally exists in the world.

The V2.6 formal visual chain is:

```text
World Facts
-> Space Facts
-> Ecology Facts
-> Trace Facts
-> Scene Composition
-> Pixel Painter Modules
-> Layer / Y-sort
-> Renderer
-> 主世界视觉呈现
```

World Painter translates persisted world facts into a renderable scene plan, then lets painter modules and the renderer present that plan. The same world facts may be projected differently as weather, ecology state, resource state, trace sediment, or visual style changes, but the painter must not invent formal world objects for convenience.

## 2. World Fact Boundaries

World Facts answer what formally exists or has formally happened. World Painter reads them; it does not author them.

Formal fact groups include:

- Space Facts: 2D/3D coordinates, regions, land parcel attributes, object occupancy, boundaries, passability, and movement cost.
- Ecology Facts: biome, moisture, growth, ground health, vegetation state, and environment pressure.
- Trace Facts: long-term sediment left by repeated world activity, including movement trace.
- Object Facts: persistent objects such as long-term trees, structures, care objects, and other saved placements.
- Runtime Snapshot Facts: temporary read-only projection inputs such as current visual state, time state, or weather state.

Coordinates are the positioning base. Coordinates are not the generation algorithm. A coordinate tells the painter where a fact is anchored or where a space rule applies; it does not by itself generate a complete world image.

The complete world image is generated jointly by world seed, world facts, world rules, spatial layout, ecology distribution, object generation, trace sediment, visual presentation, and layer composition. It is not generated directly from coordinates alone.

## 3. Space Facts

The world space base is responsible for:

- 2D/3D coordinate systems.
- Regions and land parcels.
- Parcel attributes.
- Object occupancy.
- Boundaries.
- Passability.
- Movement cost.

AI-PET-WORLD V2.6 does not define an independent formal road/path business architecture. Passability and movement cost belong to the space base. Long-term results of repeated movement belong to the trace system.

## 4. Trace Facts

Trace Facts describe long-term sediment left by repeated events in the world. Movement trace is one kind of trace fact.

Movement trace means an area has been used or crossed enough over time to leave a visual or spatial trace. It is not a world generation prerequisite, not a character action trajectory, and not the core map model.

The current World Painter contract exposes movement trace with:

- `traceShape`: a stable visual shaping signal for movement trace.
- `traceDensity`: a stable density/intensity signal for movement trace.
- `hasTraceFact`: whether trace facts are present for this scene.
- `traceFacts`: trace fact records available to the composer.
- `traceSamples` / `traceField`: renderable movement-trace samples prepared for internal composition.

Trace data can influence terrain transition, long-used area visuals, grass distribution, small-object placement, and painter layering. It must not be expanded into a separate road system.

## 5. Scene Composition

Scene Composer translates formal input facts into a `SceneCompositionPlan`. It can decide:

- Which visual tiles represent base terrain, long-used areas, and transition edges.
- Which generated visual decorations are allowed by ecology and trace state.
- Which fact-bound objects should be included.
- Which generated objects should be suppressed near fact-bound objects.
- Which visual objects participate in layer sorting.

Scene Composer cannot create formal world facts. If a tree, structure, pet, steward, or persistent object is not present in the upstream facts, the composer may only create a visual decoration or placeholder explicitly scoped as visual output.

`/world-debug/pixel-scene-composer` may expose test controls for `biome`, `moisture`, `decorationDensity`, and `traceShape` to validate visual composition. Those controls must not write back to `HomeMapState`, and they must not be shown as formal controls on `/world`.

## 6. Pixel Painter Modules

Pixel Painter modules draw local visual structures from the scene plan. Suggested responsibilities:

- terrain painter
- grass painter
- movement trace / trace field painter
- stone painter
- flower painter
- bush painter
- tree painter
- object placeholder painter

Painter modules decide how to draw. They do not decide whether a formal object exists.

## 7. Layer / Y-sort

Layering and y-sort are rendering rules over the scene plan. They help visual objects read correctly in a 2D pixel scene. They are not world simulation rules and must not mutate saved facts.

## 8. Renderer

Renderer converts `SceneCompositionPlan` into SVG, Canvas, Pixi, or another visual backend. It must remain read-only:

- It must not create world facts.
- It must not mutate `HomeMapState`.
- It must not treat debug controls as formal world rules.
- It must not introduce pets, stewards, incubators, or new gameplay concepts.

## 9. Compatibility / Technical Debt

Earlier visual tests used road/path wording and fields such as `roadShape`, `hasRoadFact`, visual tile kind `"path"`, and helper names in `road-composer.ts`.

Those names are historical test semantics only. They are not formal V2.6 business concepts and must not be extended as a road/path architecture.

Temporary compatibility rules:

- External formal inputs should use `traceShape`, `traceDensity`, `hasTraceFact`, and `traceFacts`.
- Legacy `roadShape` may be read only to fill missing `traceShape`.
- Legacy `hasRoadFact` may be read only to fill missing `hasTraceFact`.
- Legacy HomeMapState placement layer/tag `"path"` may be read as movement trace input during migration.
- Compatibility outputs may backfill deprecated `roadShape` and `hasRoadFact` only for old callers.
- `road-composer.ts` may remain as an internal implementation detail until all rendering helpers are renamed.

No new formal code should describe movement trace as a road system.

## 10. Acceptance Rules

This module is a contract migration and documentation alignment module. It is not the full Trace System.

Acceptance requires:

1. Formal business documentation no longer treats road/path as architecture.
2. Public scene composer contracts expose `traceShape`, `traceDensity`, `hasTraceFact`, and `traceFacts`.
3. Deprecated `roadShape` and `hasRoadFact` remain only as compatibility fields.
4. `/world` remains read-only and runnable.
5. `/world-debug/pixel-scene-composer` remains runnable.
6. UI copy describes movement trace, trace shape, trace density, long-used area, or trace field instead of a road system.
7. `npm run lint`, `npx tsc --noEmit`, and `npm run build` pass.
