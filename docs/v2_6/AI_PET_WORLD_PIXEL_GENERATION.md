# AI-PET-WORLD Pixel Generation

Status: Current formal pixel generation rules.

## 1. Role

Pixel generation converts world facts into visual expression.

It does not create world facts. It does not copy external images. It does not imitate another game's recognizable visual identity.

```txt
World facts
-> WorldViewModel
-> VisualGenerationPlan
-> PixelWorldRenderPlan
-> PixelWorldPixelBufferFrame
-> VisualJudgeReport
-> VisualCorrectionPlan
-> Display gate
```

## 2. Current Scope

Current pixel generation focuses on:

- Terrain.
- Ground texture.
- Trees.
- Bushes, flowers, mushrooms, stones, and ecology signals.
- Basic structures/facilities.
- Roads/traces.
- Atmosphere and ecology transition.

P-Phone, butler status UI, and management panels are deferred from the world-first screen.

## 3. Generation Rules

Pixel generation must:

- Use only current world-view input.
- Preserve source IDs and recipe IDs.
- Keep every visible cell traceable.
- Use project-owned palettes and recipes.
- Generate visual-only correction cells only inside corrected pixel buffers.

Pixel generation must not:

- Add buildings, actors, events, or roads that do not exist as world facts.
- Store or copy external reference images.
- Display debug blocks as formal art.
- Display large flat placeholder rectangles as approved world visuals.

## 4. AI Drawing Logic

AI drawing in this project is data-first:

```txt
semantic object
-> pixel recipe
-> semantic blocks
-> render command
-> pixel buffer cell
-> visual review
```

The renderer is not allowed to invent facts. It only draws approved pixel buffer frames.

## 5. Display Rule

Only a reviewed `pass` frame may be displayed.

Warn and fail frames must be blocked in test and production.
