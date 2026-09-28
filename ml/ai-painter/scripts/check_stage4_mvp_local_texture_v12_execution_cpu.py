"""Independent V12 execution preflight on train only; no optimizer or GPU."""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
import time

import torch


ROOT = Path(__file__).resolve().parents[3]
for directory in (ROOT / "ml/ai-painter/src", ROOT / "ml/ai-painter/scripts"):
    if str(directory) not in sys.path:
        sys.path.insert(0, str(directory))

from ai_painter.complete_world.native_rgb_local_texture_objective_v12 import (  # noqa: E402
    TEXTURE_WEIGHT, full_frame_local_texture_objective,
)
from ai_painter.complete_world.split_release import (  # noqa: E402
    SplitReleaseDataset, bound_json, project_file,
)
from ai_painter.complete_world.split_training import state_hash  # noqa: E402
from ai_painter_stage4_mvp_native_rgb_object_context_renderer_v11 import (  # noqa: E402
    build_renderer,
)
from check_stage4_mvp_local_texture_v12_cpu import verify_contract  # noqa: E402


FEASIBILITY = (
    ".runtime/ai-painter/stage4-mvp-local-texture-v12-cpu-qualifications/"
    "cpu-v12-e143ad7badd5bdaea1b948346b28e11392f36a355aa00608/report.json"
)
PROGRAM = "ml/ai-painter/scripts/check_stage4_mvp_local_texture_v12_execution_cpu.py"
OUTPUT_PARENT = ".runtime/ai-painter/stage4-mvp-local-texture-v12-execution-qualifications"
SEED = 20260929


def bind(path: str) -> dict:
    return {"path": path, "sha256": hashlib.sha256(project_file(ROOT, path).read_bytes()).hexdigest()}


def require(value: bool, message: str) -> None:
    if not value:
        raise ValueError(message)


def run() -> dict:
    started = time.monotonic()
    torch.set_num_threads(4)
    contract, _, _, _ = verify_contract()
    feasibility = bound_json(ROOT, bind(FEASIBILITY))
    require(feasibility.get("status") == "cpu_feasibility_passed_not_gpu_or_training_qualified"
            and feasibility.get("contract") == bind(
                "data/ai-painter/system-governance/stage4-mvp-native-rgb-local-texture-v12-contract.json"
            ) and len(feasibility.get("rows", [])) == 8
            and feasibility.get("trainOnly") is True
            and feasibility.get("validationRead") is False
            and feasibility.get("gpuStarted") is False,
            "V12 prior train-only CPU feasibility evidence invalid")
    dataset = SplitReleaseDataset(ROOT, contract["datasetManifest"], "train", (256, 192))
    require(len(dataset) == 48 and dataset.manifest["qualification"]["dataQualifiedForTraining"] is True,
            "V12 execution CPU train release invalid")
    sample = dataset[0]
    require(sample["split"] == "train", "V12 CPU selected a non-train sample")
    torch.manual_seed(SEED)
    model = build_renderer(ROOT).eval()
    initial = state_hash(model.state_dict())
    conditions = sample["conditions"].unsqueeze(0)
    target = sample["image"].unsqueeze(0)
    predicted = model(conditions)
    total, parts = full_frame_local_texture_objective(predicted, target, conditions, model)
    require(tuple(predicted.shape) == (1, 3, 192, 256)
            and bool(torch.isfinite(total)) and float(total.detach()) > 0
            and torch.allclose(total, parts["v11Total"].float()
                               + TEXTURE_WEIGHT * parts["localTextureMoments"], atol=1e-6),
            "V12 combined full-frame objective invalid")
    parameters = tuple(model.context_heads["object_tree"].parameters())
    gradients = torch.autograd.grad(total, parameters, allow_unused=False)
    require(all(bool(torch.isfinite(gradient).all()) for gradient in gradients)
            and sum(float(gradient.abs().sum()) for gradient in gradients) > 0,
            "V12 CPU objective has no finite object-context gradient")
    require(state_hash(model.state_dict()) == initial
            and all(parameter.grad is None for parameter in model.parameters()),
            "V12 CPU preflight modified model state or stored gradients")
    require(time.monotonic() - started < 120, "V12 CPU execution preflight exceeded time bound")
    program = bind(PROGRAM)
    contract_binding = bind(
        "data/ai-painter/system-governance/stage4-mvp-native-rgb-local-texture-v12-contract.json"
    )
    prior_binding = bind(FEASIBILITY)
    identity = "execution-cpu-v12-" + hashlib.sha256((
        program["sha256"] + contract_binding["sha256"] + prior_binding["sha256"]
    ).encode()).hexdigest()[:48]
    report = {
        "schemaVersion": "stage4-mvp-local-texture-v12-execution-cpu-v1",
        "status": "cpu_execution_preflight_passed_training_still_disabled",
        "capabilityVersion": contract["capabilityVersion"],
        "identity": identity,
        "contract": contract_binding,
        "feasibility": prior_binding,
        "program": program,
        "datasetManifest": contract["datasetManifest"],
        "sampleIdentity": {"sampleId": sample["sampleId"], "split": sample["split"]},
        "initialModelStateSha256": initial,
        "outputShape": list(predicted.shape),
        "objectiveTotal": float(total.detach()),
        "v11Objective": float(parts["v11Total"].detach()),
        "localTextureMoments": float(parts["localTextureMoments"].detach()),
        "objectContextGradientAbsoluteSum": sum(float(value.abs().sum()) for value in gradients),
        "modelStateUnchanged": True,
        "optimizerCreated": False, "optimizerSteps": 0,
        "gpuStarted": False, "trainingStarted": False,
        "validationRead": False, "challengeRead": False, "regressionRead": False,
        "trainingAllowedByThisArtifact": False,
        "elapsedSeconds": time.monotonic() - started,
        "recordedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    output = project_file(ROOT, f"{OUTPUT_PARENT}/{identity}/report.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")
        stream.flush()
    return {"status": report["status"], "report": bind(output.relative_to(ROOT).as_posix())}


if __name__ == "__main__":
    try:
        print(json.dumps(run(), ensure_ascii=False))
    except Exception as error:
        print(json.dumps({"status": "failed_closed", "errorType": type(error).__name__,
                          "error": str(error)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(1)
