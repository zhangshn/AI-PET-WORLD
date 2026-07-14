from __future__ import annotations

from ai_painter.training.torch_runtime import require_torch


def build_schedule(diffusion_steps: int, device):
    torch = require_torch()
    betas = torch.linspace(0.0001, 0.02, diffusion_steps, device=device, dtype=torch.float32)
    alphas = 1.0 - betas
    alpha_bars = torch.cumprod(alphas, dim=0)
    return {"betas": betas, "alphas": alphas, "alphaBars": alpha_bars}


def add_noise(clean_latent, noise, timesteps, alpha_bars):
    alpha = alpha_bars[timesteps].view(-1, 1, 1, 1)
    return alpha.sqrt() * clean_latent + (1.0 - alpha).sqrt() * noise


def inference_timesteps(diffusion_steps: int, inference_steps: int, device):
    torch = require_torch()
    return torch.linspace(diffusion_steps - 1, 0, inference_steps, device=device).round().long()


def deterministic_step(noisy_latent, predicted_noise, timestep: int, previous_timestep: int, alpha_bars):
    torch = require_torch()
    alpha = alpha_bars[timestep]
    previous_alpha = alpha_bars[previous_timestep] if previous_timestep >= 0 else torch.ones((), device=noisy_latent.device)
    predicted_clean = (noisy_latent - (1.0 - alpha).sqrt() * predicted_noise) / alpha.sqrt().clamp_min(1e-6)
    return previous_alpha.sqrt() * predicted_clean + (1.0 - previous_alpha).sqrt() * predicted_noise
