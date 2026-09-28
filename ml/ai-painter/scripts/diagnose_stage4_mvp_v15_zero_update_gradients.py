"""Bound, zero-update numerical diagnosis of one failed V15 execution.

Only the bound 48 train inputs are decoded. No optimizer, checkpoint, validation
image, registry write, or formal training capability is created by this probe.
"""

from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
import time

import torch


ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))

import train_stage4_mvp_conditional_texture_v15_stage0 as failed_worker  # noqa: E402
from ai_painter.complete_world.native_rgb_conditional_texture_cpu import (  # noqa: E402
    build_conditional_texture_discriminator, discriminator_train_objective,
)
from ai_painter.complete_world.native_rgb_instance_object_prototype import (  # noqa: E402
    build_native_rgb_instance_object_prototype,
)
from ai_painter.complete_world.split_release import (  # noqa: E402
    bound_json, canonical_bytes, project_file, read_bound,
)
from ai_painter.complete_world.split_training import state_hash  # noqa: E402


CAPABILITY = "stage4_mvp_native_rgb_conditional_texture_v15"
CONTRACT = "data/ai-painter/system-governance/stage4-mvp-native-rgb-conditional-texture-v15-contract.json"
OUTPUT = ".runtime/ai-painter/stage4-mvp-v15-zero-update-gradient-diagnostics"
MAX_WALL_SECONDS = 120
MAX_MEMORY_FRACTION = 0.7
FP16_SCALE = 65536.0


def binding(path: str) -> dict:
    return {"path": path, "sha256": hashlib.sha256(
        project_file(ROOT, path).read_bytes()).hexdigest()}


def backward_finiteness(critic, predicted, sample, dtype, scale: float) -> dict:
    critic.zero_grad(set_to_none=True)
    conditions = sample["conditions"].to("cuda:0")
    bound = {**sample, "conditions": conditions, "image": sample["image"].to("cuda:0")}
    with torch.autocast("cuda", dtype=dtype):
        loss, scores = discriminator_train_objective(critic, predicted, bound)
    (loss * scale).backward()
    bad = []
    for name, parameter in critic.named_parameters():
        gradient = parameter.grad
        if gradient is None:
            bad.append({"parameter": name, "kind": "missing"})
        elif not bool(torch.isfinite(gradient).all()):
            bad.append({"parameter": name, "kind": "nonfinite",
                        "count": int((~torch.isfinite(gradient)).sum().item())})
    result = {"loss": float(loss.detach()),
              "realScore": float(scores["realScore"].detach()),
              "fakeScore": float(scores["fakeScore"].detach()),
              "nonfiniteOrMissing": bad}
    critic.zero_grad(set_to_none=True)
    return result


def run(terminal_binding: dict) -> dict:
    started = time.monotonic()
    terminal = bound_json(ROOT, terminal_binding)
    failed_worker.require(terminal.get("status") == "failed_closed"
                          and terminal.get("capabilityVersion") == CAPABILITY
                          and terminal.get("optimizerStepsGenerator") == 95
                          and terminal.get("optimizerStepsDiscriminator") == 95,
                          "probe requires exact failed V15 95-step terminal")
    package = bound_json(ROOT, terminal["executionPackage"])
    failed_worker.require(package.get("candidateContract") == binding(CONTRACT),
                          "failed package candidate contract changed")
    contract = bound_json(ROOT, package["candidateContract"])
    manifest = bound_json(ROOT, package["datasetManifest"])
    failed_worker.require(contract["datasetBinding"]["manifest"] ==
                          package["datasetManifest"], "dataset binding changed")
    train, selection = failed_worker._load_bound_split(contract, manifest, "train")
    failed_worker.require(len(train) == 48 and selection ==
                          contract["datasetBinding"]["trainSelectionSha256"],
                          "train selection changed")
    failed_worker.require(torch.cuda.is_available(), "CUDA unavailable")
    device = torch.device("cuda:0")
    torch.cuda.set_device(device)
    torch.cuda.set_per_process_memory_fraction(MAX_MEMORY_FRACTION, device)
    torch.cuda.reset_peak_memory_stats(device)
    torch.manual_seed(failed_worker.MODEL_PLAN["freshInitializationSeed"])
    model = build_native_rgb_instance_object_prototype(
        condition_channel_order=tuple(manifest["identityPayload"]["channelOrder"]),
        base_channels=failed_worker.MODEL_PLAN["generatorBaseChannels"],
        patch_channels=failed_worker.MODEL_PLAN["generatorPatchChannels"],
    )
    critic = build_conditional_texture_discriminator()
    before_model, before_critic = state_hash(model.state_dict()), state_hash(critic.state_dict())
    cpu = bound_json(ROOT, package["cpuQualification"])
    failed_worker.require(before_model == cpu["initialModelStateSha256"]
                          and before_critic == cpu["initialDiscriminatorStateSha256"],
                          "fresh initialization changed")
    model.to(device).eval()
    critic.to(device).train()
    results = []
    for sample in train:
        failed_worker.require(time.monotonic() - started < MAX_WALL_SECONDS,
                              "zero-update diagnostic timeout")
        conditions = sample["conditions"].unsqueeze(0).to(device)
        with torch.no_grad(), torch.autocast("cuda", dtype=torch.float16):
            predicted_fp16 = model(conditions, sample["objectInstanceTable"])
        fp16 = backward_finiteness(critic, predicted_fp16, sample,
                                   torch.float16, FP16_SCALE)
        with torch.no_grad(), torch.autocast("cuda", dtype=torch.bfloat16):
            predicted_bf16 = model(conditions, sample["objectInstanceTable"])
        bf16 = backward_finiteness(critic, predicted_bf16, sample,
                                   torch.bfloat16, 1.0)
        results.append({"sampleId": sample["sampleId"],
                        "fp16AtV15InitialScale": fp16,
                        "bf16WithoutScale": bf16})
    after_model = state_hash({name: value.detach().cpu()
                              for name, value in model.state_dict().items()})
    after_critic = state_hash({name: value.detach().cpu()
                               for name, value in critic.state_dict().items()})
    failed_worker.require(after_model == before_model and after_critic == before_critic,
                          "zero-update diagnostic modified model state")
    total_bytes = torch.cuda.get_device_properties(device).total_memory
    peak_bytes = torch.cuda.max_memory_reserved(device)
    failed_worker.require(peak_bytes / total_bytes <= MAX_MEMORY_FRACTION,
                          "zero-update diagnostic memory cap exceeded")
    failed_worker.require(binding(CONTRACT) == package["candidateContract"]
                          and binding(terminal_binding["path"]) == terminal_binding,
                          "bound evidence changed during diagnostic")
    return {
        "schemaVersion": "stage4-mvp-v15-zero-update-gradient-diagnostic-v1",
        "status": "completed_diagnostic_only_no_training_authority",
        "failedTerminal": terminal_binding,
        "candidateContract": package["candidateContract"],
        "program": binding("ml/ai-painter/scripts/diagnose_stage4_mvp_v15_zero_update_gradients.py"),
        "trainSelectionSha256": selection,
        "sampleCount": len(results), "fp16Scale": FP16_SCALE,
        "fp16NonfiniteSampleCount": sum(bool(row["fp16AtV15InitialScale"]["nonfiniteOrMissing"])
                                           for row in results),
        "bf16NonfiniteSampleCount": sum(bool(row["bf16WithoutScale"]["nonfiniteOrMissing"])
                                           for row in results),
        "samples": results,
        "optimizerCreated": False, "optimizerSteps": 0,
        "validationContentRead": False, "challengeRead": False,
        "regressionRead": False, "weightsModified": False,
        "peakGpuReservedBytes": peak_bytes,
        "gpuTotalBytes": total_bytes,
        "recordedAtUtc": datetime.now(timezone.utc).isoformat(),
    }


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--failed-terminal", required=True)
    parser.add_argument("--failed-terminal-sha256", required=True)
    args = parser.parse_args()
    terminal = {"path": args.failed_terminal, "sha256": args.failed_terminal_sha256}
    report = run(terminal)
    identity = hashlib.sha256(canonical_bytes({
        "terminal": terminal, "program": report["program"],
    })).hexdigest()[:48]
    destination = project_file(ROOT, f"{OUTPUT}/diagnostic-{identity}.json")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")
        stream.flush()
    print(json.dumps({"status": report["status"], "report": binding(
        destination.relative_to(ROOT).as_posix()),
        "fp16NonfiniteSampleCount": report["fp16NonfiniteSampleCount"],
        "bf16NonfiniteSampleCount": report["bf16NonfiniteSampleCount"]},
        ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
