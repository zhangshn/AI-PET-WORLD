# AI-PET-WORLD

AI-PET-WORLD is a V2.6 MVP project for a butler-first autonomous world simulation.

## Current V2.6 Execution Sources

V2.6 is the current highest development basis. Older V2.0 / V2.5 / MVP documents are historical references only and must not override V2.6.

- Product business source: `AI-PET-WORLD_V2.6_01_产品业务主文档_完整版_2026-05-24`
- System architecture and AI source: `AI-PET-WORLD_V2.6_02_系统架构与AI核心设计主文档_完整版_2026-05-24`
- MVP execution and acceptance source: `AI-PET-WORLD_V2.6_03_MVP执行计划与验收主文档_完整版_2026-05-24`
- Existing repository V2 documents remain useful as archive/context: [src/docs/v2/AI_PET_WORLD_V2_DOCUMENT_INDEX.md](src/docs/v2/AI_PET_WORLD_V2_DOCUMENT_INDEX.md)

## V2.6 Product Red Lines

- The AI butler is the first protagonist.
- The player is the world source, observer, and limited responder, not a direct builder or direct adopter.
- Initial world facts only include the butler, empty land or starting biome, ecology resources, world runtime, and butler autonomous construction/maintenance/waiting/logging/explaining.
- Pets are not startup assets and are never system-default generated.
- Pets can only come from the town adoption center path.
- The town and adoption center are not fully open at startup; they emerge with world stage, road access, resources, and home stability.
- Adoption center candidates are candidates only, not `HomeMapState` pet facts.
- A pet may become a world fact only after `AdoptionReview` and `AdoptionSafeApply` pass through `MapDiff` / `SafeApply` / audit.
- UI, CSS, PNG, SVG, and FormalVisualModel are read-only projections and must not generate world facts.
- Every world fact change must be traceable through `HomeMapState` / `MapDiff` / `SafeApply` / audit.

## Development Commands

```bash
npm run dev
npm run lint
npx tsc --noEmit
npm run build
```

## Next.js Version Note

This project uses Next.js 16.2.4. Before changing Next.js-specific APIs, routes, layouts, or build behavior, read the relevant guide in `node_modules/next/dist/docs/` because this version may differ from older Next.js conventions.
