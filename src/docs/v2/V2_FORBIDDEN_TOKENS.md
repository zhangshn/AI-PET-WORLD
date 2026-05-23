# AI-PET-WORLD V2.0 Forbidden Tokens

> Status: V2.0 active audit list. Use this list when reviewing initial world generation, formal UI, visual projection, and world-state changes.

## Forbidden In Formal Initial World

The following tokens must not appear in the formal initial world unless the context is audit, documentation, tests, or an explicitly deferred/accepted later event:

- `pet_arrival`
- `pet_rest`
- `pet_actor`
- `pet-bed`
- `pet bed`
- `incubator`
- `embryo`
- `hatching`
- `incubating`

## Sensitive In Formal UI

The following terms require caution in formal UI:

- `raw tags`
- `source diagnostics`
- `命理原始术语`
- `紫微术语裸露`
- `八字术语裸露`

Formal player UI should prefer product-facing language such as personality tendency, life-information engine, butler profile, construction preference, world rhythm, and relationship readiness.

## Forbidden World Generation Methods

The following implementation patterns are forbidden for formal world generation:

- `Math.random`
- `Date.now` directly participating in world seed decisions
- UI generating placement facts
- CSS deciding object facts
- PNG deciding object facts

## Review Rule

If a forbidden token appears in code or content, classify the context before changing it:

- Allowed: documentation, audit, tests, historical reports, explicit LifeEvent or CompanionDecision candidate handling
- Not allowed: formal initial world facts, formal UI, default actor projection, default placement generation
