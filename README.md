# AI-PET-WORLD

AI-PET-WORLD is an autonomous world game driven by an AI butler, world rules, and an AI visual pipeline.

The user enters birth data during registration. The project maps the birth data through Zi Wei Dou Shu and related destiny/personality logic into the butler's long-term personality, communication style, construction preference, and decision bias.

The butler is not a directly controlled unit. The butler is an autonomous actor inside the world.

## Current Main Chain

```txt
User registration
-> Birth data
-> Destiny/personality mapping
-> Butler soul/personality
-> Personal world creation
-> Autonomous runtime world facts
-> AI Painter visual generation
-> VisualJudge
-> ApprovedFrame
-> Player world view
```

## Visual Rule

The world page can only show `ApprovedFrame`.

No candidate image, sketch, debug view, or programmatic drawing may be shown to the player.

Current formal architecture documents:

```txt
docs/AI_PET_WORLD_MASTER_ARCHITECTURE.md
```

## Current API

```txt
POST /api/world/create
POST /api/world/tick
GET  /api/world/visual/condition
POST /api/world/visual/generate
GET  /api/world/visual/candidate
POST /api/world/visual/judge
GET  /world
```

## Local MVP Persistence

```txt
data/world-runtime/
data/world-visual-candidates/
data/world-approved-frames/
```

Local file persistence is for MVP development only. Production needs a database adapter.
