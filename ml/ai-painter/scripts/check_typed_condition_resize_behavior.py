from __future__ import annotations

from copy import deepcopy
import argparse
import hashlib
import json
from pathlib import Path
import sys

import torch

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
SRC = ROOT / "ml" / "ai-painter" / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from ai_painter.complete_world import build_complete_world_system


DEFAULT_CONDITION_CONTRACT = (
    "data/ai-painter/system-governance/"
    "ai-painter-complete-map-condition-contract-v1.json"
)
MODEL_CONTRACT = (
    "data/ai-painter/system-governance/"
    "stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2.json"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--condition-contract", default=DEFAULT_CONDITION_CONTRACT)
    return parser.parse_args()


def resolve_project_path(relative_path: str) -> Path:
    resolved = (ROOT / relative_path).resolve()
    try:
        resolved.relative_to(ROOT.resolve())
    except ValueError as exc:
        raise ValueError(f"path escapes project root: {relative_path}") from exc
    return resolved


def read_json(relative_path: str) -> dict[str, object]:
    return json.loads(resolve_project_path(relative_path).read_text(encoding="utf-8"))


def build_config(condition_contract: dict[str, object]) -> dict[str, object]:
    tensor = condition_contract["tensorContract"]
    partitions = tensor["typePartitions"]
    model_contract = read_json(MODEL_CONTRACT)
    dimensions = model_contract["derivedDimensions"]
    autoencoder = model_contract["autoencoderBoundary"]
    return {
        "baseChannels": dimensions["autoencoderBaseChannels"],
        "denoiserBaseChannels": dimensions["denoiserBaseChannels"],
        "latentChannels": dimensions["latentChannels"],
        "latentDownsampleFactor": dimensions["latentDownsampleFactor"],
        "conditionChannels": tensor["channelCount"],
        "conditionChannelOrder": deepcopy(tensor["channelOrder"]),
        "conditionChannelTypes": {
            "discrete": deepcopy(partitions["discrete"]),
            "continuous": deepcopy(partitions["continuous"]),
        },
        "conditionResizeContract": tensor["resize"]["contractId"],
        "autoencoderArchitecture": autoencoder["architecture"],
        "denoiserArchitecture": model_contract["architectureId"],
    }


def main() -> int:
    args = parse_args()
    condition_contract_path = resolve_project_path(args.condition_contract)
    condition_contract_bytes = condition_contract_path.read_bytes()
    condition_contract = json.loads(condition_contract_bytes.decode("utf-8"))
    if condition_contract.get("status") != "active_current_machine_condition_contract":
        raise ValueError("current complete-map condition contract is not active")
    config = build_config(condition_contract)
    order = list(config["conditionChannelOrder"])
    discrete = list(config["conditionChannelTypes"]["discrete"])
    continuous = list(config["conditionChannelTypes"]["continuous"])
    model = build_complete_world_system(config).cpu().eval()

    conditions = torch.zeros((1, len(order), 2, 2), dtype=torch.float32)
    checkerboard = torch.tensor([[0.0, 1.0], [1.0, 0.0]], dtype=torch.float32)
    for channel_id in discrete + continuous:
        conditions[0, order.index(channel_id)] = checkerboard

    with torch.no_grad():
        resized = model.prepare_typed_conditions(conditions, (5, 5))

    discrete_values = torch.unique(resized[:, [order.index(value) for value in discrete]])
    if not all(float(value) in {0.0, 1.0} for value in discrete_values):
        raise AssertionError("discrete condition resize introduced interpolated values")

    continuous_values = torch.unique(resized[:, [order.index(value) for value in continuous]])
    if not any(0.0 < float(value) < 1.0 for value in continuous_values):
        raise AssertionError("continuous condition resize did not produce bilinear intermediate values")

    invalid = deepcopy(config)
    invalid["conditionChannelTypes"]["continuous"] = continuous + [discrete[0]]
    try:
        build_complete_world_system(invalid)
    except ValueError:
        invalid_type_partition_rejected = True
    else:
        invalid_type_partition_rejected = False
    if not invalid_type_partition_rejected:
        raise AssertionError("overlapping discrete and continuous channel types were accepted")

    print(json.dumps({
        "ok": True,
        "status": "typed_condition_resize_behavior_passed",
        "channelCount": len(order),
        "discreteChannelCount": len(discrete),
        "continuousChannelCount": len(continuous),
        "discreteIntroducedInterpolation": False,
        "continuousBilinearIntermediateObserved": True,
        "invalidTypePartitionRejected": True,
        "conditionContractIdentity": condition_contract["conditionContractIdentity"],
        "conditionContractPath": args.condition_contract.replace("\\", "/"),
        "conditionContractSha256": hashlib.sha256(condition_contract_bytes).hexdigest(),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
