# AI-PET-WORLD v2.6 Current Business Principles

Status: Current formal definition only. Old plans are not retained as active references.

## 1. Product Definition

AI-PET-WORLD is an autonomous pixel world driven by AI butlers and world rules.

The user enters by registration and birth information. Birth date and optional birth time are mapped through the life/personality system, including Zi Wei Dou Shu inspired signals, into the butler's long-term soul/personality core.

The butler is not a pet and not a command executor. The butler is an autonomous world actor.

## 2. User And Butler

The user can communicate with the butler, express preferences, ask questions, and make suggestions.

User suggestions are not commands. The butler may accept, delay, modify, or reject suggestions according to personality, memory, resources, space, rules, relationships, and current world pressure.

P-Phone is a future relationship channel, not the current world-first screen.

## 3. Autonomous World

The world is not a dashboard and not a decorative background. It has facts, resources, space, ecology, traces, events, memory, and time.

All formal world changes must pass through world rules and become traceable world facts.

The visual system may express world facts, but it must not create new world facts.

## 4. Construction And Future Towns

Construction is autonomous. It comes from butler decisions, world rules, resources, space, stage goals, traces, long-term pressure, and future multiplayer-town systems.

Future towns and cities will be built by multiple players' butlers under shared world rules.

Hospitals, parks, roads, public facilities, and city systems are future world-development results, not current web UI cards.

## 5. Current World-First Stage

Current priority:

- Draw the world.
- Build terrain readability.
- Build trees, stones, structures, roads, traces, and ecology visuals.
- Enforce visual review before display.

Deferred:

- Butler status UI.
- P-Phone full UI.
- Town/city management UI.
- Player-facing debug panels.

## 6. Formal Display Rule

The formal `/world` page is a read-only game-world renderer.

It must not:

- Advance runtime tick.
- Create a default world.
- Write runtime facts.
- Show dashboard cards.
- Show unreviewed visual frames.

Current and future display gate:

```txt
finalSeverity === "pass" -> display
finalSeverity === "warn" -> do not display
finalSeverity === "fail" -> do not display
```

No review pass means no player-visible world frame.
