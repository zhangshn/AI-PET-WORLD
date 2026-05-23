# AI-PET-WORLD

AI-PET-WORLD is a V2.0 MVP project for a personality-driven autonomous world simulation.

The current development direction is no longer the default create-next-app starter flow. Future work must follow the V2.0 execution plan and guardrails below.

## Current V2.0 Execution Sources

- Main execution plan: [src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md](src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md)
- V2.0 document index: [src/docs/v2/AI_PET_WORLD_V2_DOCUMENT_INDEX.md](src/docs/v2/AI_PET_WORLD_V2_DOCUMENT_INDEX.md)
- Development guardrails: [src/docs/v2/V2_DEVELOPMENT_GUARDRAILS.md](src/docs/v2/V2_DEVELOPMENT_GUARDRAILS.md)
- Forbidden tokens: [src/docs/v2/V2_FORBIDDEN_TOKENS.md](src/docs/v2/V2_FORBIDDEN_TOKENS.md)
- Module execution template: [src/docs/v2/V2_MODULE_EXECUTION_TEMPLATE.md](src/docs/v2/V2_MODULE_EXECUTION_TEMPLATE.md)

## Product Red Lines

- World facts must come before visuals.
- UI, CSS, PNG, and SVG must not generate world facts.
- The player is not the direct builder.
- The butler is the autonomous builder and maintainer.
- Pets and companion life are deferred LifeEvent/CompanionDecision outcomes.
- Initial worlds must not default to pet actor, pet bed, pet_arrival, or pet_rest.
- Resources must not appear from nowhere.
- Personality must affect layout, resource preferences, construction order, house preferences, maintenance priorities, and LifeEvent tendencies.
- Formal UI must not expose raw destiny terminology.
- World changes must be traceable to HomeMapState / MapDiff / SafeApply / EventLog.

## Development Commands

```bash
npm run dev
npm run lint
npx tsc --noEmit
npm run build
```

## Next.js Version Note

This project uses Next.js 16.2.4. Before changing Next.js-specific APIs, routes, layouts, or build behavior, read the relevant guide in `node_modules/next/dist/docs/` because this version may differ from older Next.js conventions.
