"""Independent read-only CPU compatibility probe; no training or release grant."""
from __future__ import annotations

import hashlib
import io
import json
import os
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[3]
POLICY_PATH = "data/ai-painter/system-governance/ai-painter-foundation-cpu-load-probe-policy-v1.json"
POLICY_SHA = "e01ada89734708bd3bca15b52b2fec9954a7d87e913da9b30f93a63f9c8ab46c"
PROGRAMS = (
    "ml/ai-painter/scripts/probe_foundation_cpu_load.py",
    "ml/ai-painter/tests/test_foundation_cpu_load_probe.py",
    "ml/ai-painter/scripts/ai_painter_stage4_semantic_transport_v2_trainer_support.py",
    "ml/ai-painter/src/ai_painter/__init__.py",
    "ml/ai-painter/src/ai_painter/complete_world/__init__.py",
    "ml/ai-painter/src/ai_painter/complete_world/model.py",
    "ml/ai-painter/src/ai_painter/complete_world/stage4_semantic_transport_v2.py",
    "ml/ai-painter/src/ai_painter/complete_world/diffusion.py",
    "ml/ai-painter/src/ai_painter/training/__init__.py",
    "ml/ai-painter/src/ai_painter/training/torch_runtime.py",
    "data/ai-painter/system-governance/stage4-semantic-transport-v2-trainer-loss-support-contract-v1.json",
    "data/ai-painter/system-governance/stage4-formal-diffusion-objective-and-checkpoint-contract-v1.json",
    "scripts/check-ai-painter-foundation-cpu-load.mjs",
    "scripts/lib/ai-painter-cpu-checkpoint-worker.mjs",
    "scripts/lib/ai-painter-owned-worker-v1.mjs",
    "scripts/lib/ai-painter-owned-worker-native-v1.mjs",
    "scripts/windows/ai-painter-owned-worker-owner.cs",
)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def require(value, message):
    if not value:
        raise ValueError(message)


def read_binding(binding, max_bytes=16 * 1024 * 1024):
    logical = binding["path"]
    require(isinstance(logical, str) and "\\" not in logical and ":" not in logical
            and not logical.startswith("/") and not any(p in {"", ".", "..", "latest", "latest.json"}
            for p in logical.split("/")), "explicit relative path required")
    target = ROOT / logical
    allowed = (ROOT / ".runtime").resolve() if logical.startswith(".runtime/") else ROOT.resolve()
    require(target.resolve().is_relative_to(allowed), "path escaped project storage")
    with target.open("rb") as stream:
        data = stream.read(max_bytes + 1)
    require(len(data) <= max_bytes, "bound file exceeds byte limit")
    require(digest(data) == binding["sha256"], "bound file hash mismatch")
    return data


def verify_request(request):
    require(set(request) == {"schemaVersion", "runId", "policy", "programBindings"}, "request fields invalid")
    require(request["schemaVersion"] == "foundation-cpu-load-probe-request-v1", "request schema invalid")
    require(re.fullmatch(r"foundation-cpu-probe-[a-f0-9-]{36}", request["runId"]) is not None, "run identity invalid")
    require(request["policy"] == {"path": POLICY_PATH, "sha256": POLICY_SHA}, "probe policy binding invalid")
    policy = json.loads(read_binding(request["policy"]))
    bindings = request["programBindings"]
    require(isinstance(bindings, list) and len(bindings) == len(PROGRAMS)
            and {b["path"] for b in bindings} == set(PROGRAMS), "program lineage incomplete")
    for binding in bindings:
        require(set(binding) == {"path", "sha256"}, "program binding fields invalid")
        read_binding(binding)
    contract = json.loads(read_binding(policy["foundationContract"]))
    require(contract["activation"]["checkpointDeserializationAllowedDuringCpuValidation"] is False,
            "legacy static policy unexpectedly changed")
    require(contract["assetRole"] == "project_owned_cross_candidate_frozen_foundation_capability",
            "foundation role invalid")
    manifest = json.loads(read_binding(contract["sourceManifest"]))
    require(manifest["checkpointPath"] == contract["checkpoint"]["path"]
            and manifest["checkpointSha256"] == contract["checkpoint"]["sha256"], "asset manifest binding mismatch")
    return policy, contract


def decode_bound_autoencoder(data, expected_sha, expected_bytes, expected_metadata):
    # Check immutable bytes BEFORE restricted pickle parsing; no unsafe fallback.
    require(len(data) == expected_bytes and digest(data) == expected_sha, "checkpoint bytes mismatch")
    import torch
    value = torch.load(io.BytesIO(data), map_location="cpu", weights_only=True)
    require(isinstance(value, dict), "checkpoint mapping required")
    for key in ("schemaVersion", "ownership", "trainingLane", "modelId", "architectureVersion", "trainingStage", "denoiserTrained"):
        require(type(value.get(key)) is type(expected_metadata[key]) and value[key] == expected_metadata[key],
                "checkpoint metadata mismatch: " + key)
    require(value.get("thirdPartyWeightsLoaded") is False and value.get("upstreamModelIds") == [], "upstream weights forbidden")
    require("denoiserState" not in value, "denoiser state forbidden")
    state = value.get("autoencoderState")
    require(isinstance(state, dict) and bool(state), "autoencoder state missing")
    require(all(isinstance(k, str) and isinstance(t, torch.Tensor) and t.device.type == "cpu"
                and torch.isfinite(t).all().item() for k, t in state.items()), "invalid autoencoder tensor state")
    return state


def run_probe(request):
    policy, contract = verify_request(request)
    require(os.environ.get("CUDA_VISIBLE_DEVICES") == "", "CPU-only environment required")
    import torch
    from ai_painter.complete_world.model import build_complete_world_system
    from ai_painter_stage4_semantic_transport_v2_trainer_support import (
        build_stage4_semantic_transport_v2_cpu_inactive_config, state_dict_sha256,
        validate_stage4_semantic_transport_v2_autoencoder_boundary,
        stage4_semantic_transport_v2_optimizer_parameters,
    )
    torch.set_num_threads(policy["resources"]["threads"])
    torch.manual_seed(policy["probe"]["seed"])
    binding = contract["checkpoint"]
    data = read_binding(binding, policy["resources"]["maxCheckpointBytes"])
    state = decode_bound_autoencoder(data, binding["sha256"], binding["bytes"], contract["sourceManifest"])
    config = build_stage4_semantic_transport_v2_cpu_inactive_config(ROOT)
    model = build_complete_world_system(config).cpu()
    model.autoencoder.load_state_dict(state, strict=True)
    loaded = validate_stage4_semantic_transport_v2_autoencoder_boundary(model, phase="loaded")
    require(loaded["stateSha256"] == state_dict_sha256(state), "loaded state differs from checkpoint")
    denoiser_before = state_dict_sha256(model.denoiser.state_dict())
    model.train()
    mode_checked = validate_stage4_semantic_transport_v2_autoencoder_boundary(model, phase="loaded")
    selected = stage4_semantic_transport_v2_optimizer_parameters(model)
    require(not ({id(p) for p in selected} & {id(p) for p in model.autoencoder.parameters()}), "foundation parameter selection contaminated")
    x = torch.linspace(0, 1, 3 * 16 * 16, device="cpu").reshape(*policy["probe"]["inputShape"]).requires_grad_(True)
    latent = model.autoencoder.encode(x)
    rgb = model.autoencoder.decode(latent)
    require(tuple(latent.shape) == (1, 12, 4, 4) and tuple(rgb.shape) == (1, 3, 16, 16), "probe shapes invalid")
    require(torch.isfinite(rgb).all().item(), "probe output nonfinite")
    rgb.mean().backward()
    require(x.grad is not None and torch.isfinite(x.grad).all().item(), "input gradient invalid")
    require(all(p.grad is None for p in model.parameters()), "probe produced model parameter gradients")
    after = validate_stage4_semantic_transport_v2_autoencoder_boundary(model, phase="loaded")
    require(loaded["stateSha256"] == mode_checked["stateSha256"] == after["stateSha256"], "foundation state changed")
    require(denoiser_before == state_dict_sha256(model.denoiser.state_dict()), "denoiser state changed")
    verify_request(request)
    read_binding(binding)
    return {"schemaVersion": "foundation-cpu-load-probe-result-v1", "runId": request["runId"],
            "status": "cpu_load_and_probe_freeze_verified_not_training_qualified", "pid": os.getpid(),
            "policy": request["policy"], "checkpoint": {"path": binding["path"], "sha256": binding["sha256"]},
            "torchVersion": str(torch.__version__), "device": "cpu", "checkpointDeserialized": True,
            "restrictedWeightsOnly": True, "loadedStateSha256": loaded["stateSha256"],
            "afterModeSwitchStateSha256": mode_checked["stateSha256"], "afterProbeStateSha256": after["stateSha256"],
            "parameterSelectionExcludesFoundation": True, "inputGradientFinite": True,
            "optimizerCreated": False, "optimizerSteps": 0, "parameterGradientsCreated": False,
            "probeInputShape": list(x.shape), "probeLatentShape": list(latent.shape),
            "gpuStarted": False, "realDatasetRead": False, "checkpointWritten": False,
            "trainingFreezeProven": False, "historicalIsolationQualified": False,
            "trainingAllowed": False, "capabilityReleased": False}


if __name__ == "__main__":
    from argparse import ArgumentParser
    parser = ArgumentParser()
    parser.add_argument("--request", required=True)
    parser.add_argument("--request-sha256", required=True)
    args = parser.parse_args()
    require(args.request.startswith(".runtime/ai-painter/foundation-cpu-load-probes/"), "request namespace invalid")
    request = json.loads(read_binding({"path": args.request, "sha256": args.request_sha256}))
    print(json.dumps(run_probe(request)))
