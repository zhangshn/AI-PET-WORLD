# Adoption Center

Status: V2.6 current route. This module represents the future town adoption center path only.

V2.6 rules:

- The initial world has no pet world fact.
- The town and adoption center are not fully open at startup.
- The adoption center can expose candidates, but candidates are not `HomeMapState` pet actors.
- The butler may wait, reject, or form adoption intent based on personality, resources, space, relationship memory, and care capacity.
- A pet can enter `HomeMapState` only after `AdoptionReview` and `AdoptionSafeApply` pass through `MapDiff` / `SafeApply` / audit.
- Player signals can bias observation, but cannot directly claim or create a pet.
