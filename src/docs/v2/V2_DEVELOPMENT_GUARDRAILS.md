# AI-PET-WORLD V2.6 Development Guardrails

> Status: V2.6 active guardrails. These rules apply to all current AI-PET-WORLD MVP code, document, and visual work.

## 1. World Facts Come Before Visuals

World facts must be created by rules, state, and auditable transitions before they are displayed.

Required chain:

```txt
Rule / State / Intent
-> HomeMapState / ResourceState / ConstructionPlan
-> MapDiff
-> SafeApply
-> EventLog
-> RenderableWorldSnapshot
-> FormalVisualModel
-> FormalWorldView
```

## 2. UI, CSS, PNG, And SVG Must Not Generate World Facts

UI and assets may express existing world facts, but they must not decide that an object exists.

Forbidden examples:

- UI directly creates a placement.
- CSS decides that a house exists.
- PNG/SVG assets imply a pet, pet bed, road, resource, or building that does not exist in world state.
- A React component bypasses `HomeMapState`, `MapDiff`, or `SafeApply` to create a formal world object.

## 3. The Player Is Not The Direct Builder

The player is the world source, observer, and limited responder. The player is not the direct builder of homes, roads, facilities, communities, or towns.

Allowed:

- Creating a world.
- Observing the world.
- Triggering a debug/manual tick in development views.
- Reading explanations and logs.

Forbidden:

- Formal gameplay buttons that directly build, place, or upgrade objects.
- Treating the butler as an NPC that simply executes player construction commands.

## 4. The Butler Is The Autonomous Builder And Maintainer

The butler is the first autonomous manager of the world. Construction and maintenance should be driven by butler personality, resources, biome constraints, world phase, maintenance pressure, and event context.

The butler may:

- Observe world state.
- Form construction intent.
- Generate or select construction plans.
- Maintain homes, roads, resources, and boundaries.
- Wait when resources or readiness are insufficient.

## 5. Pets Must Enter Only Through Town Adoption

Pets are not default starting assets. They may only enter through the town adoption chain: TownReadiness -> AdoptionCenterState -> AdoptionOpportunityObservation -> ButlerAdoptionIntent -> AdoptionReview -> AdoptionSafeApply / MapDiff / SafeApply.

Initial worlds must not default to any blocked startup pet fact. The exact blocked token list is maintained in [V2_FORBIDDEN_TOKENS.md](./V2_FORBIDDEN_TOKENS.md).

Adoption may be represented as future possibility, opportunity observation, blocker, or readiness state, but not as an established pet fact unless AdoptionReview and AdoptionSafeApply have passed.

## 6. Resources Must Not Appear From Nowhere

Resources are world state, not infinite currency.

Every resource increase must have a source, such as:

- Initialization
- Natural regeneration
- Weather or biome rules
- Maintenance behavior
- Conversion
- Trade
- Event results

Resource shortage must be able to delay, downgrade, or reject construction.

## 7. Personality Must Affect Behavior

Personality must affect more than text. It must influence:

- Layout
- Resource preferences
- Construction order
- House preferences
- Maintenance priorities
- ButlerAdoptionIntent and AdoptionReview tendencies
- Visual projection

Failure case: different personalities produce the same map and plan while only changing labels, colors, or explanation copy.

## 8. Formal UI Must Not Expose Raw Destiny Terminology

Formal UI should express the system as a life-information personality engine and autonomous world.

Formal UI may show:

- Butler personality
- Construction tendency
- Life rhythm
- Relationship tendency
- World style
- Behavior explanation

Formal UI must not expose raw destiny terminology as the primary product language. Debug pages may expose internal tags if clearly separated from formal player UI.

## 9. World Changes Must Be Traceable

Every meaningful world change must be traceable to:

- `HomeMapState`
- `MapDiff`
- `SafeApply`
- `EventLog`

Changes that cannot be audited are not valid world facts.
