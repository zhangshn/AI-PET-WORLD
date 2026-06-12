SAMPLE_LAYERS = {"scene", "object", "part", "material"}

SAMPLE_DOMAINS = {
    "world",
    "building",
    "character",
    "animal",
    "vegetation",
    "terrain",
    "road",
    "water",
    "material",
    "prop",
}

PRIMARY_TRAINING_LAYER = "scene"

LAYER_IMAGE_SIZES = {
    "scene": (256, 192),
    "object": (128, 128),
    "part": (64, 64),
    "material": (64, 64),
}
