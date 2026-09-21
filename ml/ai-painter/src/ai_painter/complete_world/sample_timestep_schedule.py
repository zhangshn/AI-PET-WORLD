"""Explicit per-sample schedule proposal; no automatic trainer/config adoption.

The caller owns stable sample ordinals and per-sample presentation counters.
Changing batch order must not change either identity. This module does not read
images, update weights, select checkpoints or grant any training qualification.
"""
from __future__ import annotations

import math

SCHEMA = "per_sample_presentation_coprime_v1"


def sample_timestep(*, sample_ordinal, sample_count, presentation_index,
                    diffusion_steps, stride, seed):
    values = (sample_ordinal, sample_count, presentation_index, diffusion_steps, stride, seed)
    if any(type(v) is not int for v in values):
        raise ValueError("integer schedule coordinates required")
    if not (diffusion_steps > 1 and 1 <= sample_count <= diffusion_steps
            and 0 <= sample_ordinal < sample_count and presentation_index >= 0
            and 0 < stride < diffusion_steps and math.gcd(stride, diffusion_steps) == 1):
        raise ValueError("invalid sample identity, presentation counter or coprime stride")
    phase = (sample_ordinal * diffusion_steps) // sample_count
    return (seed + (phase + presentation_index) * stride) % diffusion_steps


def coverage_by_sample(sequences, *, diffusion_steps, inference_timesteps):
    """Global union and individual coverage are deliberately different fields."""
    if type(diffusion_steps) is not int or diffusion_steps < 2 or not sequences:
        raise ValueError("nonempty sample sequences and valid diffusion steps required")
    def validate(values):
        if not values or any(type(v) is not int or not 0 <= v < diffusion_steps for v in values):
            raise ValueError("nonempty bounded integer timesteps required")
    validate(inference_timesteps)
    union, rows = set(), {}
    for sample, sequence in sequences.items():
        if not isinstance(sample, str) or not sample:
            raise ValueError("stable sample identity required")
        validate(sequence)
        unique = set(sequence)
        union.update(unique)
        rows[sample] = {"presentationCount": len(sequence), "uniqueTimestepCount": len(unique),
            "coverageRatio": len(unique) / diffusion_steps,
            "evenPresentations": sum(t % 2 == 0 for t in sequence),
            "oddPresentations": sum(t % 2 == 1 for t in sequence),
            "exactInferenceOverlapCount": len(unique.intersection(inference_timesteps)),
            "fullScheduleCovered": len(unique) == diffusion_steps}
    return {"globalUnionTimestepCount": len(union), "globalUnionFullScheduleCovered": len(union) == diffusion_steps,
        "everySampleFullScheduleCovered": all(r["fullScheduleCovered"] for r in rows.values()), "samples": rows}
