from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from train_ai_assisted_conditional_denoiser import validate_v7_training_authorization


CONFIG_PATH = PROJECT_ROOT / "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json"
DATASET_POINTER_PATH = PROJECT_ROOT / "data/world-samples/ai-assisted-cold-start-dataset-packages/latest.json"
OLD_DEFERRED_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-mvp64-gpu-training-activation-20260802/request.json"


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def expect_rejected(name, config, package):
    try:
        validate_v7_training_authorization(config, package, PROJECT_ROOT)
    except ValueError as error:
        return {"name": name, "passed": True, "rejectedWith": str(error)}
    raise AssertionError(f"negative authorization case was accepted: {name}")


def main():
    config = read_json(CONFIG_PATH)
    dataset_pointer = read_json(DATASET_POINTER_PATH)
    package = read_json(PROJECT_ROOT / dataset_pointer["manifestPath"])

    validate_v7_training_authorization(config, package, PROJECT_ROOT)
    results = [{"name": "current_hashed_active_authorization", "passed": True}]

    stale_top_level = deepcopy(config)
    stale_top_level["training"]["trainingAuthorizationStatus"] = "owner_approved"
    results.append(expect_rejected("stale_owner_approved_top_level_status", stale_top_level, package))

    inactive_nested = deepcopy(config)
    inactive_nested["training"]["ownerTrainingAuthorization"]["gpuTrainingAuthorizedNow"] = False
    results.append(expect_rejected("nested_gpu_training_not_authorized_now", inactive_nested, package))

    unhashed = deepcopy(config)
    unhashed["training"]["ownerTrainingAuthorization"]["authorizationSha256"] = "0" * 64
    results.append(expect_rejected("authorization_hash_mismatch", unhashed, package))

    deferred = deepcopy(config)
    deferred_authorization_path = PROJECT_ROOT / OLD_DEFERRED_AUTHORIZATION_PATH
    deferred["training"]["ownerTrainingAuthorization"]["authorizationPath"] = OLD_DEFERRED_AUTHORIZATION_PATH
    import hashlib
    deferred["training"]["ownerTrainingAuthorization"]["authorizationSha256"] = hashlib.sha256(
        deferred_authorization_path.read_bytes()
    ).hexdigest()
    results.append(expect_rejected("old_deferred_authorization_record", deferred, package))

    wrong_dataset = deepcopy(package)
    wrong_dataset["packageId"] = f'{package["packageId"]}-tampered'
    results.append(expect_rejected("authorized_dataset_identity_mismatch", config, wrong_dataset))

    print(json.dumps({
        "ok": True,
        "gate": "v7_python_hashed_owner_training_authorization",
        "positiveCasesPassed": 1,
        "negativeCasesPassed": len(results) - 1,
        "results": results,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
