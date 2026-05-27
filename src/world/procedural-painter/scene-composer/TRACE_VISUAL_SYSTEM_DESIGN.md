# Trace Visual System Design

## Purpose

M5 only expresses trace visuals. It does not create new world facts, rewrite
SpaceGrid, or change TraceFact lifecycle rules. The renderer reads M4 trace
influence through tile visual semantics and turns it into natural pixel details.

## Tile Visual Semantics

`SceneTile.visualKind` is the formal visual contract after M5:

- `grass` keeps the baseline ground visual.
- `pressed_grass` shows light local pressure from movement or spatial use.
- `worn_grass` shows medium movement use without becoming a fixed channel.
- `exposed_soil` shows scattered soil exposure from strong movement trace.
- `ecology_transition` shows grass color and moisture variation from ecology trace.
- `recovery_growth` is reserved for recovery and new-growth details.

`kind === "path"` and `kind === "edge"` remain deprecated renderer
compatibility names only. They are not formal business concepts and must not be
expanded into a path or road system.

## Trace Source Rules

Movement trace can produce `pressed_grass`, `worn_grass`, or `exposed_soil`.
Even exposed soil must stay fragmented and mixed with grass; it is not a road.

Spatial use trace can produce light `pressed_grass` or local use pressure. It
must not become a long-used movement area.

Ecology trace can produce `ecology_transition` or later `recovery_growth`. It
must not become long-used area.

If there is no movement trace fact, Scene Composer must not produce long-used
area tiles, and the renderer must not show old broad soil bands.

## Renderer Boundary

The SVG renderer prioritizes `visualKind` over the deprecated tile `kind`.
Fallback rendering for old `path` and `edge` tile kinds is intentionally
weakened into natural worn grass and ecology transition visuals.

M5 does not implement keeper behavior, pet behavior, world learning, or a fixed
movement network. M6 can deepen ecology object rules, but this module stays in
trace visual presentation.
