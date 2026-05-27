# Ecology Object Rules Design

## Purpose

M6 deepens ecology object rules for the Scene Composer. Natural objects are no
longer pure decoration: their generation and presentation are derived from
biome, moisture, ecology influence, trace influence, health, age, and stress.

This module does not write to `HomeMapState`, create new world facts, implement
keeper behavior, implement pet behavior, or add world learning. It only derives
scene-level object presentation from existing scene facts.

## Object Rules

Trees represent canopy. Medium to high moisture improves health. Strong
movement influence reduces generated tree placement. Spatial use can slightly
reduce scale without deleting established objects. Age and health drive
`growthStage`, trunk size, crown size, and highlight density.

Bushes represent understory. They are more likely around ecology transition
areas and less likely in high movement influence. Moisture and ecology
influence improve health.

Flowers represent flower patches. They prefer healthier ecology, grassland or
oasis conditions, and lower movement pressure. Spatial use creates only light
local pressure.

Stones represent stone anchors. Dryness and pressure can increase stone
presence. Stones are comparatively tolerant of movement influence and are not
treated as fragile ecology.

Mushrooms represent fungi. They prefer high moisture, nearby canopy or
understory, and low movement influence.

`insect_signal` represents micro-life activity. It appears as small static
pixels near flowers or bushes when ecology health is high and movement pressure
is low. It is not a pet, character, or interactive life system.

## Influence Boundary

Movement influence suppresses fragile ecology objects such as flowers,
mushrooms, and micro-life signals. Ecology influence increases small ecology
objects but is capped so the scene does not become visually crowded.

Spatial use influence only creates light local pressure. It must not delete real
objects and must not become a fixed movement channel.

Fact objects are preserved. Ecology rules only affect generated objects and
generated object avoidance around fact objects.
