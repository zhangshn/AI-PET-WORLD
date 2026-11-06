"""Re-read the frozen training selection before making a weather package visible."""
import hashlib
import io
import json
from pathlib import Path
import sys
import runpy

import torch


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    root = Path(__file__).resolve().parents[3]
    package_parent = (root / "data/world-samples/dataset-packages").resolve(strict=True)
    stage = Path(sys.argv[1]).resolve(strict=True)
    require(stage.parent == package_parent and stage.name.startswith(".stage-weather-153-"), "unexpected staging directory")
    spec = json.loads((root / "data/ai-painter/system-governance/sakaerat-weather-dataset-release-contract-v1.json").read_bytes())

    def bound(ref):
        raw = (root / ref["path"]).read_bytes()
        require(hashlib.sha256(raw).hexdigest() == ref["sha256"], "source bytes differ: " + ref["path"])
        return raw

    loader = runpy.run_path(str(root / "ml/ai-painter/scripts/world_environment_pilot.py"))
    original = spec["inputs"][0]["historicalDataset"]
    data = loader["validate_dataset"](json.loads(bound(original)), loader["CONTRACT_SHA256"])
    checkpoint = torch.load(io.BytesIO(bound(spec["checkpoint"])), weights_only=True, map_location="cpu")
    require(checkpoint["trainingDatasetSha256"] == original["sha256"], "checkpoint dataset binding")
    require(checkpoint["contractSha256"] == spec["trainingContract"]["sha256"] and checkpoint["onlyFittedColumn"] == "RH2M", "checkpoint fit identity")
    index = json.loads((stage / "source-index.json").read_bytes())
    selected = [row for row in data["windows"] if row["split"] == "train"]
    by_id = {row["sampleId"]: row for row in index["records"]}
    members = json.loads((stage / "splits/train.json").read_bytes())["sampleIds"]
    require(len(selected) == len(members) == len(set(members)) == 724, "training membership")
    for sample_id, old in zip(members, selected):
        row = by_id[sample_id]
        require(row["role"] == "train" and {k: row[k] for k in old} == old, "training selection differs")
    require(index["trainNormalization"] == {"dates": data["trainDates"], "values": data["trainDays"]}, "normalization differs")
    print(json.dumps({"trainingDatasetSha256": checkpoint["trainingDatasetSha256"], "windows": len(selected),
                      "normalizationDays": len(data["trainDates"]), "forwards": 0, "updates": 0}))


if __name__ == "__main__":
    main()
