"""Isolated differentiable 10-step endpoint for train-only experiments.

Not used by a production entrypoint. It preserves the existing DDIM equations,
never accepts target RGB/latents, and does not create an optimizer or update state.
"""
from __future__ import annotations


def phase4_residual_loss(predicted, target):
    """V4-only train residual objective; never an inference postprocessor."""
    import torch
    if not all(isinstance(x, torch.Tensor) for x in (predicted, target)):
        raise ValueError("RGB tensors required")
    if any(tuple(x.shape) != (1, 3, 192, 256) or x.dtype != torch.float32 for x in (predicted, target)):
        raise ValueError("fixed float32 RGB shape required")
    if predicted.device != target.device or target.requires_grad:
        raise ValueError("same device and detached train target required")
    if not all(bool(torch.isfinite(x).all()) for x in (predicted, target)):
        raise ValueError("finite RGB required")
    if not bool(((target >= 0) & (target <= 1)).all()):
        raise ValueError("train target range must be [0,1]")
    residual = predicted - target
    means = residual.reshape(1, 3, 48, 4, 64, 4).mean(dim=(2, 4))
    centered = means - means.mean(dim=(-2, -1), keepdim=True)
    return (centered.square().mean() + 1e-12).sqrt() - 1e-6


def isolated_phase4_gradient(produce_rgb, target, parameter):
    """Finish and discard a phase-only graph BEFORE building combined loss.

    Returns scalars only; autograd.grad does not accumulate parameter.grad.
    The caller must use a deterministic, state-preserving RGB producer.
    """
    import math
    import torch
    if not isinstance(parameter, torch.Tensor) or not parameter.requires_grad:
        raise ValueError("trainable probe parameter required")
    predicted = produce_rgb()
    loss = phase4_residual_loss(predicted, target)
    gradient = torch.autograd.grad(loss, parameter, retain_graph=False, create_graph=False)[0]
    magnitude = float(gradient.double().square().sum().sqrt())
    if not math.isfinite(magnitude) or magnitude <= 0:
        raise ValueError("phase4 gradient must be finite and nonzero")
    return {"phase4Loss": float(loss.detach()), "phase4GradientL2": magnitude}


def add_existing_objectives(full_objective, endpoint_objective=None):
    """Sum existing scalar objectives without detaching either gradient path."""
    import torch
    for value in (full_objective, endpoint_objective):
        if value is not None and (not isinstance(value, torch.Tensor) or value.ndim != 0
                                  or not bool(torch.isfinite(value))):
            raise ValueError("finite scalar existing objective required")
    if full_objective is None:
        raise ValueError("full existing objective is mandatory")
    if endpoint_objective is None:
        return full_objective
    if endpoint_objective.device != full_objective.device or endpoint_objective.dtype != full_objective.dtype:
        raise ValueError("existing objective dtype/device mismatch")
    result = full_objective + endpoint_objective
    if not bool(torch.isfinite(result)):
        raise ValueError("nonfinite combined existing objectives")
    return result


def pure_noise_endpoint(predict_velocity, conditions, alpha_bars, seed, *,
                        activation_checkpointing=True, check=lambda: None):
    import torch
    from torch.utils.checkpoint import checkpoint
    from ai_painter.complete_world.diffusion import inference_timesteps, deterministic_velocity_step

    if type(seed) is not int or not 0 <= seed < 2**63:
        raise ValueError("integer nonnegative seed required")
    if type(activation_checkpointing) is not bool:
        raise ValueError("explicit checkpointing boolean required")
    if tuple(conditions.shape) != (1, 23, 192, 256) or conditions.dtype != torch.float32:
        raise ValueError("fixed 256x192 float32 condition contract required")
    if conditions.requires_grad or tuple(alpha_bars.shape) != (1000,) or alpha_bars.requires_grad:
        raise ValueError("fixed condition and schedule tensors required")
    if alpha_bars.device != conditions.device or alpha_bars.dtype != torch.float32:
        raise ValueError("schedule device/dtype mismatch")
    if (not bool(torch.isfinite(conditions).all()) or not bool(torch.isfinite(alpha_bars).all())
            or not bool(((alpha_bars > 0) & (alpha_bars < 1)).all())
            or not bool((alpha_bars[1:] < alpha_bars[:-1]).all())):
        raise ValueError("invalid finite decreasing diffusion schedule")
    noise = torch.randn((1, 12, 48, 64), device=conditions.device,
                        generator=torch.Generator(device=conditions.device).manual_seed(seed))
    latent = noise.clone()
    timesteps = inference_timesteps(1000, 10, conditions.device).tolist()
    if timesteps != [999, 888, 777, 666, 555, 444, 333, 222, 111, 0]:
        raise ValueError("fixed full-endpoint grid changed")
    for index, value in enumerate(timesteps):
        previous = timesteps[index+1] if index+1 < len(timesteps) else -1
        timestep = torch.tensor([value], dtype=torch.long, device=conditions.device)

        # Bind previous in a new closure on EVERY iteration; backward recomputes
        # old steps after the loop and must not accidentally use its final index.
        def step(current, supplied_timestep, supplied_conditions, prior=previous):
            check()
            velocity = predict_velocity(current, supplied_timestep, supplied_conditions)
            if velocity.shape != current.shape or velocity.dtype != current.dtype or velocity.device != current.device:
                raise ValueError("velocity tensor contract changed")
            return deterministic_velocity_step(current, velocity, int(supplied_timestep.item()), prior, alpha_bars)

        if activation_checkpointing and torch.is_grad_enabled():
            latent = checkpoint(step, latent, timestep, conditions, use_reentrant=False, preserve_rng_state=True)
        else:
            latent = step(latent, timestep, conditions)
        if not bool(torch.isfinite(latent).all()):
            raise ValueError("nonfinite generated endpoint trajectory")
    return noise, latent
