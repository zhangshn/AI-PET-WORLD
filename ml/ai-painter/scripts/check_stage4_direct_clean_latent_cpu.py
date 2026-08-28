from __future__ import annotations

import copy
import hashlib
import inspect
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "ml" / "ai-painter" / "src"
SCRIPTS = ROOT / "ml" / "ai-painter" / "scripts"
sys.path.insert(0, str(SRC))
sys.path.insert(0, str(SCRIPTS))

from ai_painter.complete_world.model import build_complete_world_system
from ai_painter.training.torch_runtime import require_torch
from ai_painter_direct_clean_latent_contract import (
    compile_direct_clean_latent_cpu_inactive_config,
    validate_direct_clean_latent_cpu_inactive_config,
)


SOURCE_CONFIG = ROOT / ".runtime" / "ai-painter" / (
    "stage4-post-decode-full-condition-responsibility-formal-stage0"
) / "stage4-post-decode-full-condition-responsibility-stage0-2026082603" / (
    "active-config.json"
)


def tensor_state_sha256(state) -> str:
    digest = hashlib.sha256()
    for name in sorted(state):
        tensor = state[name].detach().cpu().contiguous()
        digest.update(name.encode("utf-8"))
        digest.update(str(tensor.dtype).encode("ascii"))
        digest.update(str(tuple(tensor.shape)).encode("ascii"))
        digest.update(tensor.numpy().tobytes())
    return digest.hexdigest()


def main() -> int:
    torch = require_torch()
    source = json.loads(SOURCE_CONFIG.read_text(encoding="utf-8"))
    config = compile_direct_clean_latent_cpu_inactive_config(source)
    contract = validate_direct_clean_latent_cpu_inactive_config(config)
    torch.manual_seed(int(config["training"]["seed"]))
    model = build_complete_world_system(config)
    parameter_names = tuple(name for name, _ in model.denoiser.named_parameters())
    forbidden_name_tokens = ("latent_stem", "time_embedding", "time_mlp", "velocity")
    if any(token in name for name in parameter_names for token in forbidden_name_tokens):
        raise AssertionError("direct clean-latent parameters contain a diffusion identity")
    if tuple(inspect.signature(model.predict_clean_latent).parameters) != ("conditions",):
        raise AssertionError("direct clean-latent public input signature is invalid")
    conditions = torch.rand(1, 23, 192, 256, requires_grad=True)
    before = tensor_state_sha256(model.state_dict())
    clean_latent = model.predict_clean_latent(conditions)
    if tuple(clean_latent.shape) != (1, 12, 48, 64):
        raise AssertionError("direct clean-latent output shape is invalid")
    decoded_rgb = model.decode_clean_latent(clean_latent)
    if tuple(decoded_rgb.shape) != (1, 3, 192, 256):
        raise AssertionError("direct clean-latent decoded RGB shape is invalid")
    objective = clean_latent.square().mean() + decoded_rgb.abs().mean()
    gradients = torch.autograd.grad(
        objective,
        (conditions, *tuple(model.denoiser.parameters())),
        allow_unused=True,
    )
    if gradients[0] is None or not torch.isfinite(gradients[0]).all() or not torch.any(gradients[0] != 0):
        raise AssertionError("direct clean-latent condition gradient is invalid")
    parameter_gradients = gradients[1:]
    if any(gradient is None for gradient in parameter_gradients):
        raise AssertionError("a formal direct clean-latent parameter is unreachable")
    if any(not torch.isfinite(gradient).all() for gradient in parameter_gradients):
        raise AssertionError("a formal direct clean-latent parameter gradient is non-finite")
    if any(not torch.any(gradient != 0) for gradient in parameter_gradients):
        raise AssertionError("a formal direct clean-latent parameter gradient is zero")
    after = tensor_state_sha256(model.state_dict())
    if before != after:
        raise AssertionError("CPU gradient qualification changed model state")
    if any(parameter.requires_grad for parameter in model.autoencoder.parameters()):
        raise AssertionError("direct clean-latent Autoencoder is not frozen")

    negative_mutations = (
        lambda value: value.__setitem__("conditionChannels", 22),
        lambda value: value.__setitem__("latentChannels", 8),
        lambda value: value.__setitem__("latentDownsampleFactor", 8),
        lambda value: value.__setitem__("autoencoderSourceArchitectureVersion", "wrong"),
        lambda value: value.__setitem__("denoiserBaseChannels", 96),
        lambda value: value.__setitem__("diffusionSteps", 1000),
        lambda value: value.__setitem__("stage4ControlledStructureArm", "baseline_current_formal_structure"),
        lambda value: value["training"]["denoiserLossWeights"].__setitem__("velocity", 1.0),
        lambda value: value["training"]["activationGates"].__setitem__("gpuNow", True),
        lambda value: value["directCleanLatentContract"].__setitem__("freeArchitectureParameterChosen", True),
    )
    for mutate in negative_mutations:
        invalid = copy.deepcopy(config)
        mutate(invalid)
        try:
            validate_direct_clean_latent_cpu_inactive_config(invalid)
        except ValueError:
            pass
        else:
            raise AssertionError("invalid direct clean-latent contract was accepted")

    print(json.dumps({
        "status": "stage4_direct_clean_latent_cpu_support_passed",
        "positiveChecks": 18,
        "negativeChecks": len(negative_mutations),
        "modeId": contract["modeId"],
        "parameterTensorCount": len(parameter_names),
        "parameterCount": sum(parameter.numel() for parameter in model.denoiser.parameters()),
        "inputShape": [1, 23, 192, 256],
        "outputShape": list(clean_latent.shape),
        "decodedRgbShape": list(decoded_rgb.shape),
        "modelStateUnchanged": before == after,
        "autoencoderFrozen": True,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "gpuStarted": False,
        "trainingStarted": False,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
