from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath, PureWindowsPath

import torch

from ai_painter.complete_world.split_release import (
    SplitReleaseDataset,
    canonical_bytes,
    digest,
)
from ai_painter.complete_world.split_training import state_hash
from stage4_formal_stage_execution import (
    build_formal_stage_component_config,
    initialize_formal_stage0_cpu,
)


def require(value, message):
    if not value:
        raise ValueError(message)


def project_file(root: Path, logical: str) -> Path:
    require(isinstance(logical, str) and logical and "\\" not in logical
            and not PureWindowsPath(logical).drive and not PurePosixPath(logical).is_absolute()
            and all(part not in {"", ".", "..", "latest", "latest.json"}
                    for part in logical.split("/")), "invalid project path")
    target = root.joinpath(*logical.split("/"))
    allowed = (root / ".runtime").resolve() if logical.startswith(".runtime/") else root.resolve()
    require(target.resolve().is_relative_to(allowed), "path escapes declared storage root")
    return target


def hash_file(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            value.update(chunk)
    return value.hexdigest()


def bound(root: Path, binding: dict) -> Path:
    require(isinstance(binding, dict) and set(binding) == {"path", "sha256"}, "invalid binding")
    target = project_file(root, binding["path"])
    require(hash_file(target) == binding["sha256"], "bound file changed: " + binding["path"])
    return target


def read_json(root: Path, binding: dict) -> dict:
    value = json.loads(bound(root, binding).read_bytes())
    require(isinstance(value, dict), "bound JSON must be an object")
    return value


def write_atomic(path: Path, value: dict) -> None:
    require(not path.exists(), "qualification output already exists")
    path.parent.mkdir(parents=True, exist_ok=True)
    staged = path.with_name(path.name + ".staged")
    staged.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(staged, path)


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--terminal", required=True)
    parser.add_argument("--terminal-sha256", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    root = Path.cwd().resolve()
    terminal_binding = {"path": args.terminal.replace("\\", "/"), "sha256": args.terminal_sha256}
    terminal = read_json(root, terminal_binding)
    require(terminal.get("schemaVersion") == "ai-painter-stage4-mvp-fresh-foundation-training-terminal-v1"
            and terminal.get("status") == "completed_foundation_checkpoint_pending_denoiser_qualification"
            and terminal.get("executionState") == "completed", "foundation terminal did not complete")
    require(terminal.get("epochsCompleted") == 20 and terminal.get("optimizerSteps") == 960
            and terminal.get("nonTrainOptimizerSteps") == 0, "foundation schedule is incomplete")
    require(terminal.get("challengeRead") is False and terminal.get("regressionRead") is False
            and terminal.get("denoiserTrained") is False, "foundation split/model boundary failed")
    checkpoint_path = bound(root, terminal["checkpoint"])
    payload = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
    require(payload.get("schemaVersion") == "ai-painter-stage4-mvp-fresh-foundation-checkpoint-v1"
            and payload.get("runId") == terminal["runId"], "foundation checkpoint identity mismatch")
    require(payload.get("initialization") == "random_initialization_only"
            and payload.get("upstreamCheckpoints") == []
            and payload.get("thirdPartyWeightsLoaded") is False, "foundation is not isolated")
    require(payload.get("optimizerSteps") == 960 and payload.get("nonTrainOptimizerSteps") == 0
            and payload.get("denoiserState") is None and payload.get("denoiserTrained") is False,
            "foundation checkpoint role mismatch")
    foundation_state = payload.get("autoencoderState")
    require(isinstance(foundation_state, dict) and state_hash(foundation_state) == payload["autoencoderStateSha256"]
            == terminal["selectedStateSha256"], "foundation tensor identity mismatch")

    data_binding = terminal["datasetManifest"]
    train = SplitReleaseDataset(root, data_binding, "train", (256, 192))
    validation = SplitReleaseDataset(root, data_binding, "validation", (256, 192))
    config = build_formal_stage_component_config(root)
    seed = int(config["training"].get("seed", 20260721))
    initialization = {
        "schemaVersion": "ai-painter-formal-stage0-initialization-input-v1",
        "stage": {"stage": 0, "width": 256, "height": 192, "epochCount": 40},
        "datasetManifest": data_binding,
        "configSha256": digest(canonical_bytes(config)),
        "seed": seed,
        "foundationStateSha256": payload["autoencoderStateSha256"],
    }
    _, _, cpu = initialize_formal_stage0_cpu(
        root=root, initialization=initialization, foundation_state=foundation_state,
        train_dataset=train, validation_dataset=validation)
    require(cpu["foundationStateSha256"] == payload["autoencoderStateSha256"]
            and cpu["historicalDenoiserLoaded"] is False and cpu["gpuStarted"] is False,
            "formal Stage0 CPU compatibility failed")
    result = {
        "schemaVersion": "ai-painter-stage4-mvp-fresh-foundation-qualification-v1",
        "status": "foundation_qualified_for_fresh_stage0_denoiser_preflight",
        "runId": terminal["runId"],
        "terminal": terminal_binding,
        "checkpoint": terminal["checkpoint"],
        "datasetManifest": data_binding,
        "foundationStateSha256": payload["autoencoderStateSha256"],
        "initialization": "random_initialization_only",
        "upstreamCheckpoints": [],
        "thirdPartyWeightsLoaded": False,
        "trainOptimizerSteps": 960,
        "nonTrainOptimizerSteps": 0,
        "challengeRead": False,
        "regressionRead": False,
        "checkpointReloadVerified": terminal["reloadValidationLoss"] == terminal["selectedValidationLoss"],
        "formalStage0CpuCompatibility": cpu,
        "foundationQualified": True,
        "dataQualifiedByThisArtifact": False,
        "gpuQualifiedByThisArtifact": False,
        "denoiserTrainingAllowedByThisArtifact": False,
        "stage4ProgressRaised": False,
        "qualifiedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    write_atomic(project_file(root, args.output.replace("\\", "/")), result)
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
