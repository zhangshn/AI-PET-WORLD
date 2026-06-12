from __future__ import annotations

CANVAS_WIDTH = 256
CANVAS_HEIGHT = 192

V0_MASK_CHANNELS = (
    "grass",
    "water",
    "road",
    "tree",
    "rock",
    "shelter",
    "walkable",
    "depth",
)

V1_CONDITION_CHANNELS = (
    "grass",
    "water_body",
    "shoreline",
    "road_center",
    "road_edge",
    "tree_trunk",
    "tree_crown",
    "rock",
    "shelter_foundation",
    "shelter_wall",
    "shelter_roof",
    "construction_material",
    "walkable",
    "depth",
)

V1_STRUCTURE_TYPES = frozenset(V1_CONDITION_CHANNELS)
V1_SCHEMA_VERSION = "world-blueprint-v1"
V0_SCHEMA_VERSION = "world-blueprint-v0"
