from __future__ import annotations

"""Emit read-only validation reconstructions from the frozen MVP foundation."""

from argparse import ArgumentParser
from datetime import datetime, timezone
import io
import json
import os
from pathlib import Path
import sys

import torch


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
for value in (ROOT / "ml" / "ai-painter" / "src", SCRIPT_DIR):
    if str(value) not in sys.path:
        sys.path.insert(0, str(value))

from ai_painter.complete_world.model import build_complete_world_system  # noqa: E402
from ai_painter.complete_world.split_release import (  # noqa: E402
    SplitReleaseDataset, bound_json, digest, project_file, read_bound,
)
from ai_painter.complete_world.split_training import state_hash  # noqa: E402
from stage4_formal_stage_execution import build_formal_stage_component_config  # noqa: E402
from train_ai_assisted_conditional_denoiser import save_tensor_png  # noqa: E402


def require(value, message):
    if not value:
        raise ValueError(message)


def bind(logical):
    return {"path": logical, "sha256": digest(project_file(ROOT, logical).read_bytes())}


def main():
    parser = ArgumentParser()
    parser.add_argument("--dataset-manifest", required=True)
    parser.add_argument("--dataset-manifest-sha256", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()
    dataset_binding = {"path": args.dataset_manifest.replace("\\", "/"),
                       "sha256": args.dataset_manifest_sha256}
    output_dir = args.output_dir.replace("\\", "/").rstrip("/")
    output_root = project_file(ROOT, output_dir)
    require(not (output_root / "manifest.json").exists(), "reconstruction manifest exists")
    validation = SplitReleaseDataset(ROOT, dataset_binding, "validation", (256, 192))
    manifest = bound_json(ROOT, dataset_binding)
    checkpoint_binding = manifest["foundationCheckpoint"]
    checkpoint = torch.load(io.BytesIO(read_bound(ROOT, checkpoint_binding)),
                            map_location="cpu", weights_only=True)
    state = checkpoint["autoencoderState"]
    expected_state = manifest["identityPayload"]["foundationStateSha256"]
    require(state_hash(state) == expected_state, "foundation state mismatch")
    config = build_formal_stage_component_config(ROOT)
    torch.random.default_generator.manual_seed(20260721)
    model = build_complete_world_system(config).autoencoder
    model.load_state_dict(state, strict=True)
    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    model.to(device).eval()
    before = state_hash(model.state_dict())
    rows = validation.rows
    records = []
    with torch.no_grad():
        for index in range(len(validation)):
            item = validation[index]
            image = item["image"].unsqueeze(0).to(device)
            reconstruction = model.decode(model.encode(image)).clamp(0, 1)
            logical = f"{output_dir}/images/validation-{index:02d}.png"
            target = project_file(ROOT, logical)
            target.parent.mkdir(parents=True, exist_ok=True)
            require(not target.exists(), "reconstruction image exists")
            save_tensor_png(reconstruction[0], target)
            records.append({
                "sampleIndex": index,
                "sampleId": item["sampleId"],
                "reconstruction": bind(logical),
                "referenceRgb": rows[index]["image"],
                "conditionPack": rows[index]["conditionPack"],
                "rgbMae": float(torch.nn.functional.l1_loss(reconstruction, image)),
            })
    after = state_hash(model.state_dict())
    require(before == after == expected_state, "foundation reconstruction mutated weights")
    result = {
        "schemaVersion": "ai-painter-stage4-mvp-foundation-reconstruction-diagnostic-v1",
        "status": "foundation_reconstruction_diagnostic_completed",
        "datasetManifest": dataset_binding,
        "foundationCheckpoint": checkpoint_binding,
        "foundationStateSha256": expected_state,
        "resolution": {"width": 256, "height": 192},
        "recordCount": len(records),
        "records": records,
        "executionBoundary": {"optimizerCreated": False, "weightsModified": False,
                              "challengeRead": False, "regressionRead": False,
                              "qualificationGranted": False},
        "recordedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    output_root.mkdir(parents=True, exist_ok=True)
    with (output_root / "manifest.json").open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    logical_manifest = f"{output_dir}/manifest.json"
    print(json.dumps({"status": result["status"], "manifest": bind(logical_manifest),
                      "recordCount": len(records)}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
