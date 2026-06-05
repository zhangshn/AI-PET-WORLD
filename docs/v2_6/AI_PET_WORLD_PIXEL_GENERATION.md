# AI-PET-WORLD AI Painter Generation

Status: Current formal visual generation rules.

## 1. Role

AI Painter converts world facts into approved visual expression.

It does not create world facts. It does not copy external images. It does not imitate another game's recognizable visual identity.

```txt
World Facts
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

## 2. Current Scope

The MVP target is a bright, healing, detailed, top-down pixel-art static world image.

Allowed static content:

- Natural clearing.
- Grassland and layered ground texture.
- Trees, bushes, flowers, mushrooms, stones, and ecology signals.
- Water edge or shoreline when supported by world facts.
- Paths that connect real scene purposes.
- Material piles and temporary shelter when supported by world facts.
- Construction traces that represent existing world facts.

Deferred content:

- Character animation.
- Animal animation.
- Butler state UI.
- P-Phone UI.
- City and multi-player construction systems.

## 3. Data Rule

Training or rule data must be registered in `AuthorizedDataManifest`.

Allowed data:

- Self-owned images or notes.
- CC0 images.
- Commercially licensed images.
- Public abstract design principles used only for rule extraction.

Blocked data:

- Unknown-license images.
- Unlicensed third-party artwork.
- Direct copies of external compositions, characters, buildings, sprites, or pixel clusters.

## 4. Drawing Rule

Programmatic SVG, Canvas, primitive maps, and direct object-to-block drawings are removed from the formal visual chain.

They are not internal previews, not fallback art, not approval candidates, and not player-visible output.

The formal visual result must be an AI-generated bitmap candidate, such as PNG, WebP, or JPG, with source facts, prompt package, rule-data lineage, and license/originality metadata.

## 5. Display Rule

Only `ApprovedFrame` may be displayed.

If no reviewed ApprovedFrame exists, `/world` must show the Chinese blocked state and keep the world image hidden.
