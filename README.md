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

## AI Painter Hard Boundary

Local AI Painter training trains local model weights. It does not train a drawing program.

The formal route is:

```txt
project-owned training images
-> Blueprint / Mask / rights records
-> local PyTorch model training
-> local model inference PNG
-> VisualJudge
-> ApprovedFrame
```

The following are not allowed as MVP world output, training conclusions, or `/world` display sources:

```txt
programmatic drawing
SVG / Canvas / HTML / CSS render
template image
structure-fit debug preview
fixed asset composition
placeholder image
```

If a generated image does not come from the local model and pass VisualJudge, it must stay hidden.

## Training Data Chain

```txt
Original training PNG
-> project-owned automatic visual annotation
-> Blueprint v1 + 14 channel masks
-> automatic annotation judge and correction
-> accepted training pair
-> internal AI Painter training
```

The existing 20 images are immutable source materials, not trusted ground-truth annotations. Old coarse annotations and manual per-object approval are not part of the formal training-data chain. Samples that cannot pass automatic semantic and geometric checks must be quarantined instead of being sent to the user for manual approval.

Current formal architecture documents:

```txt
docs/AI_PET_WORLD_MASTER_ARCHITECTURE.md
```

## Current Execution Plan

The current main task is local model quality improvement for `natural-home RGB Refiner`.

This stage only trains pure natural home scenes:

- Allowed: grass, water, shoreline, natural paths, trees, rocks, flowers, shrubs, depth.
- Forbidden: buildings, houses, construction sites, construction materials, characters, animals, insects, butler.
- The output is only a local model candidate. It cannot be shown in `/world` unless it passes VisualJudge and becomes an `ApprovedFrame`.

Current status:

- Two local GPU training rounds have been diagnosed.
- The first round is the known best result so far.
- The second round regressed after stronger edge/texture weights.
- The formal config has been restored to the known-best setup.
- The next step is data improvement or model-capacity improvement, not more program drawing and not blind loss-weight escalation.

Backup plans are documented but must not interrupt the current main task:

- Training Result Diagnoser: explain why a local model output failed.
- Next Training Planner: decide whether to add data, change loss weights, change training config, or retry inference.
- Autonomous Training Loop: inference -> judge -> diagnose -> plan -> retrain.

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
