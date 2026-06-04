# AI-PET-WORLD Current Architecture

Status: Current formal architecture only.

## 1. Main Chain

```txt
Registration and birth information
-> Life/personality mapping
-> Butler soul/personality core
-> World creation
-> Runtime save record
-> World rules and autonomous decisions
-> World facts, traces, ecology, construction
-> World view model
-> Visual generation
-> Visual review
-> Display gate
-> PixiJS world renderer
```

## 2. Runtime Boundary

The formal runtime save is `WorldRuntimeSaveRecord`.

Runtime writes may only happen through validated runtime/world-rule paths.

The `/world` page is read-only. It must not write runtime, create a default world, or advance tick.

## 3. Visual Chain

```txt
WorldRuntimeSaveRecord
-> WorldViewModel
-> VisualFactManifest
-> VisualGenerationPlan
-> PixelWorldRenderPlan
-> PixelWorldPixelBufferFrame
-> VisualJudgeReport
-> VisualCorrectionPlan
-> post-correction review
-> Player Display Gate
-> PixiJS
```

## 4. Visual Review Boundary

Visual review checks expression quality and fact consistency. It may generate visual-only correction plans.

Visual review must not:

- Modify runtime facts.
- Add nonexistent buildings, actors, roads, resources, or events.
- Display unapproved frames.

Current display gate:

```txt
pass -> display
warn -> block
fail -> block
```

## 5. Current UI Boundary

The current formal `/world` screen is world-first:

- No dashboard.
- No right-side cards.
- No butler status UI.
- No P-Phone UI.
- No debug panel after pass.

Debug routes may contain cards and diagnostic panels, but formal `/world` may not.

## 6. Development Entrypoints

- `/world`: formal read-only world display.
- `/create-world`: world creation.
- `/api/world/tick`: explicit runtime tick.
- `/world-debug/*`: debug-only tools.
