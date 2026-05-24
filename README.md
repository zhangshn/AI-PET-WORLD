# AI-PET-WORLD

AI-PET-WORLD is a V2.6 MVP project for a butler-first autonomous world simulation.

## V2.6 Current Authority

V2.6 is the current highest development basis for AI-PET-WORLD.

- Current highest product source: AI-PET-WORLD_V2.6_01 产品业务主文档 完整版 2026-05-24.
- Current highest architecture and AI source: AI-PET-WORLD_V2.6_02 系统架构与 AI 核心设计主文档 完整版 2026-05-24.
- Current highest MVP execution and acceptance source: AI-PET-WORLD_V2.6_03 MVP 执行计划与验收主文档 完整版 2026-05-24.
- Older V2.0 / V2.3 / V2.5 / V1.2 / MVP / engine-notes / .codex-doc-extract files are historical references only and must not override V2.6.
- Codex must not use old documents to restore incubator, embryo, default pet, pet_arrival, pet_rest, LifeEvent, CompanionDecision, companion-life, adoption-candidate, or candidate-pet routes.
- The current pet-entry subject is ButlerAdoptionIntent: the butler autonomously forms adoption intent.
- The town adoption center is only an observable place and information source, not a pet generator.
- Pets are not startup assets. A pet can become a HomeMapState world fact only after ButlerAdoptionIntent, AdoptionReview, and SafeApply pass.
- UI, CSS, PNG, SVG, and FormalVisualModel are read-only projections and must not generate world facts.

Useful repository references:

- V2 document index: [src/docs/v2/AI_PET_WORLD_V2_DOCUMENT_INDEX.md](src/docs/v2/AI_PET_WORLD_V2_DOCUMENT_INDEX.md)
- Active V2.6 guardrails: [src/docs/v2/V2_DEVELOPMENT_GUARDRAILS.md](src/docs/v2/V2_DEVELOPMENT_GUARDRAILS.md)
- Forbidden-token audit list: [src/docs/v2/V2_FORBIDDEN_TOKENS.md](src/docs/v2/V2_FORBIDDEN_TOKENS.md)
- Archive cleanup report: [src/docs/V2.6_ARCHIVE_CLEANUP_REPORT_2026-05-25.md](src/docs/V2.6_ARCHIVE_CLEANUP_REPORT_2026-05-25.md)

## V2.6 Product Red Lines

- The AI butler is the first protagonist.
- The player is the world source, observer, and limited responder, not a direct builder or direct adopter.
- Initial world facts only include the butler, empty land or starting biome, ecology resources, world runtime, and butler autonomous construction/maintenance/waiting/logging/explaining.
- Pets are not startup assets and are never system-default generated.
- Pets can only enter after ButlerAdoptionIntent, AdoptionReview, and SafeApply.
- The town and adoption center are not fully open at startup; they emerge with world stage, road access, resources, and home stability.
- The town adoption center may provide observable information, but it must not push pets into the world.
- UI, CSS, PNG, SVG, and FormalVisualModel are read-only projections and must not generate world facts.
- Every world fact change must be traceable through HomeMapState / MapDiff / SafeApply / audit.

## Development Commands

```bash
npm run dev
npm run lint
npx tsc --noEmit
npm run build
```

## Next.js Version Note

This project uses Next.js 16.2.4. Before changing Next.js-specific APIs, routes, layouts, or build behavior, read the relevant guide in `node_modules/next/dist/docs/` because this version may differ from older Next.js conventions.
