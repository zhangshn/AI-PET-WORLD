from __future__ import annotations

from copy import deepcopy
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


def main() -> int:
    config_path = ROOT / "ml" / "ai-painter" / "config" / "complete-world-ai-assisted-cold-start-v7.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
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
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
