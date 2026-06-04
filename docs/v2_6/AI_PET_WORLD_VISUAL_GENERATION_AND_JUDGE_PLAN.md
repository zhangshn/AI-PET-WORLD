# AI-PET-WORLD Visual Generation And Judge Plan

Status: Current formal visual plan.

## 1. Purpose

The visual system converts autonomous world facts into player-visible frames.

It is not a world-fact generator and not a dashboard generator.

## 2. Autonomous Generation Entry

All autonomous world generation paths must use the same visual chain:

```txt
Butler autonomous construction
World rules generating terrain/ecology
Town/city systems generating buildings and roads
Event systems generating traces/changes
Future multiplayer-butler generation
        ↓
World facts
        ↓
Visual generation
        ↓
Visual review
        ↓
Visual correction plan if needed
        ↓
Visual-only correction, no runtime fact changes
        ↓
Post-correction review
        ↓
Display only if pass
```

## 3. Visual Judge Categories

Current review categories:

- `world_fact_consistency`
- `semantic`
- `illegal_debug_visual`
- `composition`
- `readability`
- `density`
- `structure_logic`
- `construction_stage`
- `access_readability`
- `path_connectivity`
- `ecology_coherence`
- `player_focus`
- `business_rule`
- `style_safety`

AI visual standard failures such as oversized trace blocks, dead empty world areas, debug-like flat blocks, and unreadable composition must block display.

## 4. Visual Correction

Correction is visual-only.

Allowed:

- Move visual cells.
- Resize visual objects.
- Reduce opacity/density.
- Replace visual recipes.
- Add visual-only cues such as access traces, path connectors, ecology tint, or construction cues.

Forbidden:

- Add runtime facts.
- Add nonexistent buildings or actors.
- Rewrite butler decisions.
- Rewrite resources, events, memory, or world state.

## 5. Display Gate

Current and future rule:

```txt
finalSeverity === "pass" -> display
finalSeverity === "warn" -> block
finalSeverity === "fail" -> block
```

No exception for test stage. No exception for production.

## 6. Public Reference Safety

The visual system may use public references only as abstract principle input.

It must not copy screenshots, UI layouts, logos, characters, proprietary assets, named-game styles, or identifiable IP.

Formal rule source:

`AI_VISUAL_STANDARD_FROM_PUBLIC_REFERENCES.md`
