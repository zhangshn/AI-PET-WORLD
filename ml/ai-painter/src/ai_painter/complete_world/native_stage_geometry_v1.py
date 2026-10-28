"""Registered native canvases; geometry is not execution qualification."""
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class NativeStageGeometry:
    stage: int

    def __post_init__(self):
        validate_geometry(self)

    @property
    def scale(self):
        return (1, 2, 4)[self.stage]

    @property
    def width(self):
        return 256 * self.scale

    @property
    def height(self):
        return 192 * self.scale

    @property
    def patch_size(self):
        return 32 * self.scale

    @property
    def background_ring_radius(self):
        return 2 * self.scale

    @property
    def native_coordinate_step(self):
        return 4.0 / self.scale

    @property
    def native_half_pixel_tolerance(self):
        return self.native_coordinate_step / 2

    @property
    def spatial_shape(self):
        return self.height, self.width

    def support_radius(self, role):
        return {"object_tree": 8, "object_rock": 4,
                "object_vegetation": 6}[role] * self.scale

    def native_pixel_centers(self, indices):
        # Preserve the original integer expression at q=1, including its dtype.
        if self.stage == 0:
            return indices * 4 + 2
        return (indices + 0.5) * self.native_coordinate_step

    def identity(self):
        validate_geometry(self)
        return (self.stage, self.width, self.height, self.patch_size,
                *(self.support_radius(role) for role in
                  ("object_tree", "object_rock", "object_vegetation")),
                self.background_ring_radius, self.native_coordinate_step,
                self.native_half_pixel_tolerance)


def validate_geometry(geometry):
    if (type(geometry) is not NativeStageGeometry
            or type(geometry.stage) is not int or geometry.stage not in (0, 1, 2)):
        raise ValueError("exact registered native stage geometry required")
    return geometry


def spatial_geometry(geometry=None):
    """None keeps the original implementation's fixed default canvas."""
    if geometry is None:
        return 192, 256, 32
    validate_geometry(geometry)
    return geometry.height, geometry.width, geometry.patch_size
