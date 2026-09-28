"""CPU-only successor objective prototype; no V12 execution or release authority.

The existing V11 RGB/gradient/object-support terms retain exact spatial facts.
The auxiliary term compares *target-conditioned local* multiscale moments, not
unlocalized gradient energy: arbitrary high-frequency noise is not a success.
This module never supplies target RGB to the renderer at inference time.
"""

from __future__ import annotations

from ai_painter.complete_world.native_rgb_object_context_renderer import (
    full_frame_object_context_objective,
)


TEXTURE_SCALES = (1, 2, 4)
LOCAL_WINDOW = 9
NORMALIZATION_FLOOR = 1e-5
TEXTURE_WEIGHT = 0.1


def local_target_texture_moments_loss(predicted, target):
    """Match nine spatial maps of highpass energy and neighbor correlation.

    Each of three scales contributes an energy, horizontal autocorrelation,
    and vertical autocorrelation map. A 9x9 local mean keeps the comparison
    near the supervised terrain/object position while allowing fine texture
    phase to differ from an independently generated training original.
    """
    import torch
    from torch.nn import functional as functional

    if (predicted.shape != target.shape or predicted.ndim != 4
            or predicted.shape[1:] != (3, 192, 256)
            or not bool(torch.isfinite(predicted).all() and torch.isfinite(target).all())
            or not bool(((predicted >= 0) & (predicted <= 1)).all())
            or not bool(((target >= 0) & (target <= 1)).all())):
        raise ValueError("V12 local texture requires finite aligned 256x192 RGB in [0,1]")

    def moments(rgb):
        result = []
        for scale in TEXTURE_SCALES:
            value = functional.avg_pool2d(rgb, scale) if scale != 1 else rgb
            highpass = value - functional.avg_pool2d(
                value, 3, stride=1, padding=1, count_include_pad=False,
            )

            def local_mean(field):
                return functional.avg_pool2d(
                    field, LOCAL_WINDOW, stride=1, padding=LOCAL_WINDOW // 2,
                    count_include_pad=False,
                )

            result.extend((
                local_mean(highpass.square()),
                local_mean(highpass[..., 1:] * highpass[..., :-1]),
                local_mean(highpass[..., 1:, :] * highpass[..., :-1, :]),
            ))
        return result

    # Keep the local statistics in float32 during mixed-precision training.
    with torch.autocast(device_type=predicted.device.type, enabled=False):
        source = moments(predicted.float())
        reference = moments(target.float())
        terms = [
            (actual - expected).abs().mean()
            / expected.detach().abs().mean().clamp_min(NORMALIZATION_FLOOR)
            for actual, expected in zip(source, reference, strict=True)
        ]
        value = sum(terms) / len(terms)
    if not bool(torch.isfinite(value)):
        raise ValueError("V12 local texture objective became non-finite")
    return value


def full_frame_local_texture_objective(predicted, target, conditions, model):
    """Preserve V11 factual alignment and add only one bounded texture term."""
    base, parts = full_frame_object_context_objective(
        predicted, target, conditions, model,
    )
    texture = local_target_texture_moments_loss(predicted, target)
    total = base.float() + TEXTURE_WEIGHT * texture
    if not bool(total.isfinite()):
        raise ValueError("V12 combined objective became non-finite")
    return total, {**parts, "v11Total": base, "localTextureMoments": texture,
                   "localTextureWeight": TEXTURE_WEIGHT, "total": total}
