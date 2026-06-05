# AI-PET-WORLD GPT Handoff

Last updated: 2026-06-06

## 1. Product Definition

AI-PET-WORLD is an autonomous world game.

The user registers and enters birth data. The project maps birth data through Zi Wei Dou Shu and related destiny/personality logic into the butler's personality and soul.

The butler is autonomous. The world is autonomous. The user can communicate with the butler through an in-game phone in the future, but the butler does not have to obey user suggestions.

Future scope includes towns, cities, and multi-player butlers jointly generating and constructing the world. MVP focuses on the first static world image.

## 2. Current Formal Visual Goal

MVP first image target:

- Bright.
- Healing.
- Detailed.
- Top-down pixel-art feeling.
- Static world image first.
- Quality target should approach the approved reference direction, but must not copy unlicensed artwork.

Allowed MVP content:

- Natural clearing.
- Water edge or shoreline.
- Grassland.
- Trees.
- Stones.
- Flowers.
- Paths.
- Materials.
- Temporary shelter or construction facts when supported by world facts.

## 3. Formal Visual Chain

```txt
WorldRuntimeSaveRecord
-> VisualFactManifest
-> SceneIntent
-> AI Painter Director
-> CompositionPlan
-> TerrainPlan
-> AssetPlan
-> MotionPlan
-> PromptPackage
-> AI Image Generation Model
-> AiImageCandidate
-> VisualJudge
-> VisualFix
-> ApprovedFrame
-> Runtime Render
-> Player View
```

Only AI-generated bitmap candidates and persisted ApprovedFrame records are part of the formal visual chain.

No ApprovedFrame means no world image is shown.

## 4. Current Directory Structure

Formal visual code lives in:

```txt
src/world/world-visual-painter/
  authorized-data/
  visual-fact-manifest/
  scene-intent/
  composition-plan/
  terrain-plan/
  asset-plan/
  motion-plan/
  prompt-package/
  ai-image-provider/
  ai-image-candidate/
  visual-review/
  visual-fix/
  approved-frame/
  visual-rule-dataset/
  visual-target-policy/
  world-visual-painter-gateway.ts
  world-visual-painter-schema.ts
```

Important app routes:

```txt
POST /api/world/visual/generate
GET  /api/world/visual/candidate
POST /api/world/visual/judge
GET  /world
```

## 5. Data And Copyright Rule

Only these can be used as training or image data:

- Self-owned data.
- CC0 data.
- Explicit commercial-license data.

Public internet examples may be used only for abstract rule extraction unless license explicitly allows image training or asset use.

Unlicensed third-party artwork must not be imported, trained on, copied, or used as an asset library.

Current `AuthorizedDataManifest` has:

- Trainable image data: 0.
- Rule-only data: 1.
- Blocked data: 0.

## 6. Current Implementation Status

Completed:

- Removed non-AI formal image output from the AI Painter chain.
- Built PromptPackage from world facts and rule data.
- Added AI image provider request builder.
- Added `POST /api/world/visual/generate`.
- Added hidden AiImageCandidate persistence.
- Added `GET /api/world/visual/candidate`.
- Added VisualJudge API: `POST /api/world/visual/judge`.
- Added ApprovedFrame persistence.
- `/world` reads latest persisted ApprovedFrame and only displays if it exists.
- If no ApprovedFrame exists, `/world` shows blocked state.

Current local persistence:

```txt
data/world-runtime/
data/world-visual-candidates/
data/world-approved-frames/
```

This is local MVP persistence only. Future deployment needs a database adapter.

## 7. Current Gate Rules

AiImageCandidate:

- Hidden.
- `canShowToPlayer: false`.
- Must contain image URL, dimensions, format, license, originality confirmation, prompt package id, and source fact ids.

VisualJudge:

- Requires a real PNG/WebP/JPG candidate.
- Requires allowed license and originality confirmation.
- Requires source fact link and prompt package link.

ApprovedFrame:

- Created only after VisualJudge passes.
- `canShowToPlayer: true`.
- Only ApprovedFrame can be shown on `/world`.

## 8. Next Work

Next stage:

1. Connect a real image provider or local image model.
2. Confirm provider response shape:
   - `imageUrl`
   - `imageFormat`
   - `width`
   - `height`
   - `license`
   - `originalityConfirmed`
3. Run generate -> candidate -> judge -> approved frame.
4. Verify `/world` shows only the persisted ApprovedFrame.
5. Improve VisualJudge from metadata-only review to real image quality review.

Do not introduce any non-AI direct drawing output as a formal player-visible world image.
