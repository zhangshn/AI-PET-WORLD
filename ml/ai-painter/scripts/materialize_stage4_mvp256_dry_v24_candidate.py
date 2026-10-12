"""Materialize one immutable native-256 dry-world candidate from a selected checkpoint.

CPU-only. This is a visual-review input, not model publication or Stage4 credit.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))

import painter_stage4_v24_object_head_core_priority_probe as profile  # noqa: E402
import painter_stage4_v24_dry_single_world_checkpoint_worker as worker  # noqa: E402
from ai_painter_authorization_policy import REGISTERED_HOT_RUNTIME_ROOT  # noqa: E402

core = profile.core
SCHEMA = "ai-painter-mvp256-dry-v24-candidate-manifest-v1"
REQUEST_SCHEMA = "ai-painter-mvp256-dry-v24-materialization-request-v1"
CAPABILITY = worker.CAPABILITY
SUBJECT_ID = worker.SUBJECT_ID
INTERFACE = "data/ai-painter/system-governance/stage4-mvp-structured-object-v17-review-pack-schema-v1.json"
MAX_SECONDS = 120
MAX_OUTPUT_BYTES = 32 * 1024 * 1024


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def project_file(logical: str) -> Path:
    require(isinstance(logical, str) and logical and "\\" not in logical
            and not logical.startswith("/") and ":" not in logical
            and all(part not in ("", ".", "..", "latest", "latest.json")
                    for part in logical.split("/")), "unsafe project-relative path")
    target = (ROOT / logical).resolve(strict=False)
    if logical.startswith(".runtime/"):
        runtime_root = (ROOT / ".runtime").resolve()
        registered_root = REGISTERED_HOT_RUNTIME_ROOT.resolve()
        require(runtime_root == registered_root and target.is_relative_to(registered_root),
                "path escapes registered runtime")
    else:
        require(target.is_relative_to(ROOT), "path escapes project")
    return target


def bind(logical: str) -> dict[str, str]:
    return {"path": logical, "sha256": sha(project_file(logical).read_bytes())}


def read_bound(binding: dict[str, str]) -> bytes:
    require(isinstance(binding, dict) and set(binding) == {"path", "sha256"}
            and isinstance(binding["sha256"], str)
            and len(binding["sha256"]) == 64, "invalid file binding")
    payload = project_file(binding["path"]).read_bytes()
    require(sha(payload) == binding["sha256"], "file binding changed: " + binding["path"])
    return payload


def bound_json(binding: dict[str, str]) -> dict:
    return json.loads(read_bound(binding))


def write_exclusive(logical: str, payload: bytes) -> dict[str, str]:
    require(len(payload) <= MAX_OUTPUT_BYTES, "candidate artifact exceeds cap")
    target = project_file(logical)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("xb") as stream:
        stream.write(payload)
        stream.flush()
        os.fsync(stream.fileno())
    return {"path": logical, "sha256": sha(payload)}


def check_request(binding: dict[str, str]) -> tuple[dict, dict, dict, dict, dict]:
    request = bound_json(binding)
    require(request.get("schemaVersion") == REQUEST_SCHEMA
            and request.get("capabilityVersion") == CAPABILITY
            and request.get("status") == "issued_single_candidate_materialization",
            "materialization request differs")
    package = bound_json(request["executionPackage"])
    terminal = bound_json(request["trainingTerminal"])
    result = bound_json(request["workerTerminal"])
    candidate = bound_json(request["candidateContract"])
    worker.validate_candidate_contract(candidate)
    require(package.get("capabilityVersion") == CAPABILITY
            and package.get("runId") == request.get("runId")
            and package.get("packageId") == request.get("packageId")
            and package.get("candidateContract") == request["candidateContract"],
            "candidate package differs")
    require(terminal.get("runId") == request["runId"]
            and terminal.get("status") == "training_completed_review_pending"
            and terminal.get("workerTerminal") == request["workerTerminal"],
            "training terminal differs")
    require(result.get("runId") == request["runId"]
            and result.get("packageId") == request["packageId"]
            and result.get("status") == "training_completed_review_pending"
            and result.get("checkpointReloadVerified") is True
            and result.get("checkpointPromotable") is False
            and result.get("selectedEpoch") in worker.ELIGIBLE_EPOCHS
            and result.get("selectedCheckpoint") == request["selectedCheckpoint"],
            "selected worker checkpoint differs")
    require(request.get("outputRoot") == package.get("outputRoot") + "/dry-review"
            and project_file(request["outputRoot"]).is_dir(),
            "candidate output directory differs")
    require(candidate["scope"]["subjectSampleId"] == SUBJECT_ID
            and request.get("subjectSampleId") == SUBJECT_ID,
            "dry subject differs")
    registry = json.loads(project_file(
        ".runtime/ai-painter/current-execution-registry/current.json").read_bytes())
    require(registry.get("activeExecution") is None
            and registry.get("latestTrainingTerminal", {}).get("runId") == request["runId"]
            and registry["latestTrainingTerminal"]["path"] == request["trainingTerminal"]["path"]
            and registry["latestTrainingTerminal"]["sha256"] == request["trainingTerminal"]["sha256"],
            "current registry does not bind completed candidate")
    return request, package, terminal, result, candidate


def materialize(request_binding: dict[str, str]) -> dict:
    import torch
    from ai_painter.complete_world.stage4_v17_responsibility_artifact import (  # noqa: E402
        encode_responsibility_artifact, decode_responsibility_artifact)

    torch.set_num_threads(2)
    require(not torch.cuda.is_initialized(), "candidate materialization must be CPU-only")
    started = time.monotonic()
    request, package, _, result, candidate = check_request(request_binding)
    out = request["outputRoot"]
    require(not any(project_file(out + "/" + name).exists() for name in
                    ("candidate-manifest.json", "generated.png", "responsibilities.f32.zlib")),
            "candidate materialization already consumed")
    try:
        with profile.successor_profile(), core.fit.readonly_guard(), \
                patch.object(torch.cuda, "is_available", side_effect=AssertionError("CUDA query prohibited")):
            reader = core.cpu.BoundReader()
            release, order, continuous, rows, memberships = core.cpu.select_rows(reader)
            require(release["datasetReleaseIdentity"]
                    == bound_json(candidate["frozenBindings"]["datasetManifest"])["datasetReleaseIdentity"],
                    "dataset identity differs")
            require(memberships["train"]["selectionSha256"]
                    == bound_json(candidate["frozenBindings"]["sourcePolicy"])["inputs"]["trainSelectionSha256"],
                    "train selection differs")
            row = rows["validation"]
            require(row["sampleId"] == SUBJECT_ID and row["split"] == "validation",
                    "preselected validation row differs")
            sample, identity = core.cpu.load_sample(reader, row, order, continuous)
            selected = result["selectedCheckpointRecord"]
            require(selected["checkpoint"] == request["selectedCheckpoint"]
                    and selected["epoch"] == result["selectedEpoch"]
                    and selected["selection"]["rank"] == result["selectedRank"],
                    "selected record differs")
            payload = read_bound(request["selectedCheckpoint"])
            model, critic, observed = worker.reload_checkpoint_exact(
                payload, expected_epoch=result["selectedEpoch"],
                expected_selection=selected["selection"],
                execution_package=request["executionPackage"],
                candidate_contract=request["candidateContract"],
                channel_order=order)
            require(observed == selected["stateSha256"], "selected CPU state differs")
            del critic, payload
            model.eval().requires_grad_(False)
            before = worker.nested_state_hash(model.state_dict())
            require(before == result["selectedModelStateSha256"],
                    "selected model hash differs")
            with torch.inference_mode():
                prediction, evidence = model(sample["conditions"][None],
                                             sample["objectInstanceTable"], return_evidence=True)
            require(prediction.shape == (1, 3, 192, 256)
                    and bool(torch.isfinite(prediction).all())
                    and worker.nested_state_hash(model.state_dict()) == before
                    and all(parameter.grad is None for parameter in model.parameters()),
                    "model output or state invalid")
            features = {**evidence["terrainResponsibilityFeatures"],
                        **evidence["responsibilityFeatures"]}
            expected = {"worldId": identity["worldId"],
                        "regionId": bound_json(candidate["frozenBindings"]["dryScope"])["preselectedSubject"]["regionId"],
                        "tick": identity["tick"], "factHash": identity["factHash"],
                        "visualFactManifestSha256": identity["visualFactManifestContentSha256"],
                        "conditionPackSha256": identity["conditionPack"]["sha256"],
                        "modelStateSha256": before}
            interface_bytes = read_bound(bind(INTERFACE))
            interface_schema = json.loads(interface_bytes)
            codec_args = {"schema_bytes": interface_bytes,
                          "schema_sha256": sha(interface_bytes),
                          "candidate_pack_schema_version": interface_schema["candidatePackSchemaVersion"]}
            archive, responsibility = encode_responsibility_artifact(
                {key: value.detach().float().cpu() for key, value in features.items()},
                identity=expected, archive_path=out + "/responsibilities.f32.zlib",
                **codec_args)
            decode_responsibility_artifact(archive, responsibility,
                                           expected_identity=expected, **codec_args)
            image_bytes = core.png_bytes(prediction[0])
            reader.unchanged()
        require(time.monotonic() - started <= MAX_SECONDS, "candidate materialization timed out")
        rgb_binding = write_exclusive(out + "/generated.png", image_bytes)
        archive_binding = write_exclusive(out + "/responsibilities.f32.zlib", archive)
        require(archive_binding == responsibility["tensorArchive"], "archive identity differs")
        subject = {"sampleId": SUBJECT_ID, "split": "validation",
                   "worldId": identity["worldId"], "regionId": expected["regionId"],
                   "tick": identity["tick"], "factHash": identity["factHash"],
                   "visualFactManifestSha256": identity["visualFactManifestContentSha256"],
                   "conditionPack": identity["conditionPack"],
                   "referenceRgb": row["image"]}
        manifest = {"schemaVersion": SCHEMA,
                    "status": "candidate_materialized_review_pending",
                    "capabilityVersion": CAPABILITY,
                    "inputPath": out + "/candidate-manifest.json",
                    "runId": request["runId"], "packageId": request["packageId"],
                    "candidateContract": request["candidateContract"],
                    "executionPackage": request["executionPackage"],
                    "trainingTerminal": request["trainingTerminal"],
                    "workerTerminal": request["workerTerminal"],
                    "datasetManifest": candidate["frozenBindings"]["datasetManifest"],
                    "selectedCheckpoint": request["selectedCheckpoint"],
                    "selectedEpoch": result["selectedEpoch"],
                    "selectedRank": result["selectedRank"],
                    "subject": subject,
                    "candidate": {"sampleId": SUBJECT_ID, "split": "validation",
                                  "resolution": [256, 192], "rgb": rgb_binding,
                                  "sourceCheckpointSha256": request["selectedCheckpoint"]["sha256"]},
                    "responsibility": {"archive": archive_binding,
                                       "interface": bind(INTERFACE),
                                       "evidence": responsibility},
                    "modelStateSha256Before": before,
                    "modelStateSha256After": worker.nested_state_hash(model.state_dict()),
                    "formalStage4QualificationGranted": False,
                    "runtimePublicationGranted": False,
                    "challengeContentRead": False, "regressionContentRead": False,
                    "recordedAtUtc": datetime.now(timezone.utc).isoformat()}
        encoded = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()
        require(len(encoded) + len(image_bytes) + len(archive) <= MAX_OUTPUT_BYTES,
                "candidate output exceeds cap")
        report_binding = write_exclusive(out + "/candidate-manifest.json", encoded)
        return {"status": manifest["status"], "manifest": report_binding,
                "candidateRgb": rgb_binding, "gpuStarted": False,
                "stage4Advanced": False}
    except Exception as error:
        failure = out + "/materialization-failure.json"
        if not project_file(failure).exists():
            write_exclusive(failure, (json.dumps({
                "status": "candidate_materialization_failed_closed",
                "runId": request["runId"], "error": str(error),
                "optimizerSteps": 0, "stage4Advanced": False,
                "recordedAtUtc": datetime.now(timezone.utc).isoformat()},
                ensure_ascii=False, indent=2) + "\n").encode())
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request", required=True)
    parser.add_argument("--sha256", required=True)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    binding = {"path": args.request, "sha256": args.sha256}
    if args.execute:
        print(json.dumps(materialize(binding), ensure_ascii=False))
    else:
        request, _, _, result, _ = check_request(binding)
        print(json.dumps({"status": "candidate_preflight_passed_not_executed",
                          "runId": request["runId"],
                          "selectedEpoch": result["selectedEpoch"],
                          "gpuStarted": False, "stage4Advanced": False}, ensure_ascii=False))


if __name__ == "__main__":
    main()
