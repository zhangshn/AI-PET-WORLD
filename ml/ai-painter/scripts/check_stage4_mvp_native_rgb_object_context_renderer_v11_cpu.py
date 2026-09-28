"""V11 CPU-only qualification; never creates an optimizer or touches CUDA."""

from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys

import torch


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
for directory in (ROOT / "ml" / "ai-painter" / "src", SCRIPT_DIR):
    if str(directory) not in sys.path:
        sys.path.insert(0, str(directory))

from ai_painter.complete_world.split_release import SplitReleaseDataset  # noqa: E402
from ai_painter.complete_world.split_training import state_hash  # noqa: E402
from ai_painter_stage4_mvp_native_rgb_object_context_renderer_v11 import (  # noqa: E402
    CAPABILITY_VERSION, CONTRACT_PATH, build_renderer,
    full_frame_object_context_objective, load_contract,
)


OUTPUT = (
    ROOT / ".runtime" / "ai-painter"
    / "stage4-mvp-native-rgb-object-context-renderer-v11-qualifications"
    / "cpu-report.json"
)
PROGRAMS = (
    "ml/ai-painter/src/ai_painter/complete_world/native_rgb_object_context_renderer.py",
    "ml/ai-painter/scripts/ai_painter_stage4_mvp_native_rgb_object_context_renderer_v11.py",
    "ml/ai-painter/scripts/check_stage4_mvp_native_rgb_object_context_renderer_v11_cpu.py",
    "ml/ai-painter/tests/test_stage4_mvp_object_context_cpu_prototype.py",
    "ml/ai-painter/tests/test_stage4_mvp_object_context_v11_contract.py",
)


def run() -> dict:
    import hashlib

    contract, contract_sha = load_contract(ROOT)
    dataset = SplitReleaseDataset(ROOT, contract["datasetBinding"], "train", (256, 192))
    if len(dataset) != 48 or dataset.manifest["qualification"]["dataQualifiedForTraining"] is not True:
        raise ValueError("V11 train split or data qualification changed")
    torch.manual_seed(20260929)
    model = build_renderer(ROOT).eval()
    before_state = state_hash(model.state_dict())
    before_rng = torch.get_rng_state().clone()
    sample = dataset[0]
    if sample["split"] != "train":
        raise ValueError("V11 CPU probe selected a non-train sample")
    conditions = sample["conditions"].unsqueeze(0)
    target = sample["image"].unsqueeze(0)
    with torch.no_grad():
        prediction, evidence = model(conditions, return_evidence=True)
        repeat = model(conditions)
        loss, parts = full_frame_object_context_objective(
            prediction, target, conditions, model,
        )
    if (tuple(prediction.shape) != (1, 3, 192, 256)
            or not torch.equal(prediction, repeat)
            or not bool(torch.isfinite(loss)) or float(loss) <= 0):
        raise ValueError("V11 full-frame CPU forward/objective invalid")
    context = {}
    for identity in model.support_radii:
        mask = evidence["authoritativeMasks"][identity]
        support = evidence["visualSupports"][identity]
        contribution = evidence["contextLogitContributions"][identity]
        outside = float((contribution * (1 - support)).abs().max())
        if (int(support.count_nonzero()) <= int(mask.count_nonzero())
                or outside != 0 or not bool(torch.isfinite(contribution).all())):
            raise ValueError("V11 typed object support invalid: " + identity)
        context[identity] = {
            "authoritativeMaskPixels": int(mask.count_nonzero()),
            "visualSupportPixels": int(support.count_nonzero()),
            "outsideSupportContributionMaximum": outside,
            "trainSampleLoss": float(parts["objectSupportRgbMae"][identity]),
        }
    if (state_hash(model.state_dict()) != before_state
            or not torch.equal(torch.get_rng_state(), before_rng)):
        raise ValueError("V11 CPU probe changed model state or RNG")
    bindings = []
    for logical in PROGRAMS:
        data = ROOT.joinpath(*logical.split("/")).read_bytes()
        bindings.append({"path": logical, "sha256": hashlib.sha256(data).hexdigest()})
    return {
        "schemaVersion": "stage4-mvp-native-rgb-object-context-renderer-v11-cpu-report-v1",
        "status": "cpu_contract_passed_training_still_disabled",
        "capabilityVersion": CAPABILITY_VERSION,
        "contract": {"path": CONTRACT_PATH, "sha256": contract_sha},
        "dataset": contract["datasetBinding"],
        "sampleIdentity": {"sampleId": sample["sampleId"], "split": sample["split"]},
        "modelInitializationStateSha256": before_state,
        "programBindings": bindings,
        "outputShape": list(prediction.shape),
        "objectiveTotal": float(loss),
        "typedObjectContext": context,
        "stateUnchanged": True,
        "rngUnchanged": True,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "gpuUsed": False,
        "trainingStarted": False,
        "validationRead": False,
        "challengeRead": False,
        "regressionRead": False,
        "trainingAllowedByThisArtifact": False,
        "recordedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def main() -> int:
    try:
        torch.set_num_threads(2)
        report = run()
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        if OUTPUT.exists():
            raise FileExistsError("V11 CPU report already exists; never overwrite evidence")
        staged = OUTPUT.with_name(OUTPUT.name + f".staged-{os.getpid()}")
        staged.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        os.replace(staged, OUTPUT)
        print(json.dumps({"status": report["status"], "output": str(OUTPUT)}, ensure_ascii=False))
        return 0
    except Exception as error:
        print(json.dumps({"status": "failed_closed", "errorType": type(error).__name__,
                          "error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
