"""Single-train replacement releases, replayed through retained source checks.

No model construction, optimizer, GPU, active-data or execution-registry writes.
Old release formats remain in their original readers.
"""
from __future__ import annotations

from copy import deepcopy
import json
import os
from pathlib import Path
import shutil
import subprocess

from .split_release import (COUNTS, PACKAGE_ROOT, bound_json, canonical_bytes,
                            digest, load_package, project_file, read_bound, validate_groups)

SCHEMA = "ai-painter-stage4-source-correction-release-v1"
CANDIDATE_SCHEMA = "source-correction-dataset-candidate-v1"
PARENT_SCHEMA = "ai-painter-stage4-v2-mvp64-denoiser-dataset-release-v1"
VERIFIER_FILES = (
    "scripts/build-ai-assisted-cold-start-dataset-package.mjs",
    "scripts/lib/ai-painter-source-correction-publication-v1.mjs",
    "scripts/lib/ai-painter-source-correction-review-v1.mjs",
    "scripts/lib/ai-painter-source-correction-intake-v1.mjs",
    "scripts/lib/ai-assisted-style-fingerprint.mjs",
    "scripts/lib/ai-assisted-condition-alignment.mjs",
    "scripts/lib/complete-map-world-frame-integrity.mjs",
    "ml/ai-painter/src/ai_painter/complete_world/source_correction_release.py",
    "ml/ai-painter/src/ai_painter/complete_world/split_release.py",
    "ml/ai-painter/src/ai_painter/complete_world/mvp_dataset_release.py",
    "ml/ai-painter/src/ai_painter/complete_world/mvp_denoiser_release.py",
    "ml/ai-painter/scripts/publish_source_correction_dataset_v1.py",
)


def require(value, message):
    if not value:
        raise ValueError(message)


def _binding(logical, data):
    return {"path": logical, "sha256": digest(data)}


def _programs(root):
    return [_binding(logical, project_file(root, logical).read_bytes()) for logical in VERIFIER_FILES]


def _node_runtime():
    executable = shutil.which("node")
    require(executable is not None, "configured Node runtime unavailable")
    actual = Path(executable).resolve()
    return {"path": str(actual), "sha256": digest(actual.read_bytes())}


def verify_with_node(root, request_binding, *, expected_programs=None, expected_runtime=None):
    programs, runtime = _programs(root), _node_runtime()
    if expected_programs is not None:
        require(programs == expected_programs, "publication verifier program bytes changed")
        require(runtime == expected_runtime, "publication Node runtime changed")
    request = bound_json(root, request_binding)
    require(request.get("schemaVersion") == "source-correction-dataset-release-request-v1"
            and request.get("operation") == "verify", "read-only publication request required")
    result = subprocess.run(
        [runtime["path"], str(project_file(root, VERIFIER_FILES[0])), "--source-correction",
         str(project_file(root, request_binding["path"]))], cwd=root, capture_output=True, text=True,
        encoding="utf-8", timeout=60, check=False,
        env={**os.environ, "UV_THREADPOOL_SIZE": "2"})
    require(result.returncode == 0, "retained source verification failed: " + result.stderr[-2000:])
    verification = json.loads(result.stdout)
    require(verification.get("schemaVersion") == "source-correction-publication-verification-v1"
            and verification.get("candidateManifest") == request["candidateManifest"]
            and verification.get("sourceReview") == request["sourceReview"], "publication verification binding differs")
    for binding in verification["inputBindings"]:
        read_bound(root, binding)
    require(_programs(root) == programs, "publication verifier changed during verification")
    return request, verification, programs, runtime


def verify_rows(root, candidate, parent, parent_rows, proposed_rows):
    require(candidate.get("schemaVersion") == CANDIDATE_SCHEMA
            and candidate.get("status") == "draft_not_released"
            and candidate.get("datasetReleaseIdentity") is None
            and candidate.get("sampleCount") == 64
            and candidate.get("splitCounts") == COUNTS, "unreleased correction candidate required")
    require(parent.get("schemaVersion") == PARENT_SCHEMA
            and parent.get("qualification", {}).get("dataQualifiedForTraining") is True,
            "qualified parent dataset required")
    require(len(proposed_rows) == len(parent_rows) == 64, "correction capacity differs")
    target = candidate["replacedSample"]
    changed = []
    for index, (old, new) in enumerate(zip(parent_rows, proposed_rows)):
        if old["sampleId"] != target:
            require(new == old, "one of the other 63 rows changed")
            continue
        require(old["split"] == new.get("split") == "train", "only a train source may be replaced")
        expected = {**deepcopy(old), "sampleId": candidate["replacementRecord"]["path"].split("/")[-2],
                    "image": new["image"], "sourceRecord": candidate["replacementRecord"],
                    "sourceCorrection": new["sourceCorrection"], "parentSampleId": target,
                    "parentContributionForLineageOnly": old["contribution"], "useQualification": "draft_not_released"}
        for key in ("contribution", "sourceSampleIndex", "sourceContributionIndex"):
            expected.pop(key, None)
        require(new == expected, "replacement changed its original condition, facts or lineage")
        record = bound_json(root, new["sourceRecord"])
        require(new["sampleId"] == record["recordId"]
                and new["sourceCorrection"] == record["sourceCorrection"]["intakeEvidence"]
                and record["sourceCorrection"]["parentSampleId"] == target,
                "replacement record provenance differs")
        require(new["image"] == {"path": record["relativeDirectory"] + "/" + record["originalImage"]["path"],
                                  "sha256": record["originalImage"]["sha256"]}, "replacement RGB differs")
        changed.append(index)
    require(len(changed) == 1, "exactly one original train sample must be replaced")
    validate_groups(proposed_rows)
    for split in COUNTS:
        old_ids = bound_json(root, parent["splits"][split])["sampleIds"]
        ids = bound_json(root, candidate["splits"][split])["sampleIds"]
        expected = [proposed_rows[changed[0]]["sampleId"] if key == target else key for key in old_ids]
        require(ids == expected, "original split order or membership changed")
    return changed[0]


def _verify_assets(root, rows):
    for row in rows:
        read_bound(root, row["image"])
        pack = bound_json(root, row["conditionPack"])
        for channel in pack["channels"]:
            read_bound(root, channel)


def build_release(root, request_binding, *, expected_programs=None, expected_runtime=None):
    root = Path(root).resolve()
    request, verification, programs, runtime = verify_with_node(
        root, request_binding, expected_programs=expected_programs, expected_runtime=expected_runtime)
    candidate = bound_json(root, request["candidateManifest"])
    parent, old_rows = load_package(root, candidate["parentDataset"])
    proposed = bound_json(root, candidate["sourceIndex"])["samples"]
    replaced_index = verify_rows(root, candidate, parent, old_rows, proposed)
    require(verification["parentDataset"] == candidate["parentDataset"]
            and verification["replacementRecord"] == candidate["replacementRecord"]
            and verification["imageSha256"] == proposed[replaced_index]["image"]["sha256"],
            "verified source differs from replacement")
    rows = deepcopy(proposed)
    rows[replaced_index]["sourceReview"] = deepcopy(request["sourceReview"])
    rows[replaced_index]["useQualification"] = "retained_mvp_source_components_verified"
    _verify_assets(root, rows)
    artifacts = {"source-index.json": canonical_bytes({"schemaVersion": SCHEMA + ":source-index",
                 "sampleCount": 64, "samples": rows, "parentSourceIndex": parent["sourceIndex"]}) + b"\n"}
    for split in COUNTS:
        artifacts[f"splits/{split}.json"] = canonical_bytes({"schemaVersion": SCHEMA + ":membership",
            "split": split, "sampleIds": [row["sampleId"] for row in rows if row["split"] == split]}) + b"\n"
    payload = {"schemaVersion": SCHEMA, "verificationRequest": deepcopy(request_binding),
        "candidateManifest": request["candidateManifest"], "parentDatasetRelease": candidate["parentDataset"],
        "sourceReview": request["sourceReview"], "verification": verification,
        "verifierPrograms": programs, "nodeRuntime": runtime,
        "channelOrder": deepcopy(parent["identityPayload"]["channelOrder"]),
        "continuousChannelIds": deepcopy(parent["identityPayload"]["continuousChannelIds"]),
        "splitCounts": COUNTS, "selectionReproductionSha256": digest(canonical_bytes(rows)),
        "artifactHashes": {key: digest(value) for key, value in sorted(artifacts.items())}}
    identity = "stage4-src64-" + digest(canonical_bytes(payload))
    directory = f"{PACKAGE_ROOT}/{identity}"
    bind = lambda name: _binding(directory + "/" + name, artifacts[name])
    manifest = {"schemaVersion": SCHEMA, "packageId": identity, "datasetReleaseIdentity": identity,
        "status": "immutable_corrected_data_release_execution_pending", "immutable": True,
        "sampleCount": 64, "splitCounts": COUNTS, "requirements": deepcopy(parent["requirements"]),
        "identityPayload": payload, "sourceIndex": bind("source-index.json"),
        "splits": {split: bind(f"splits/{split}.json") for split in COUNTS},
        "foundationQualification": deepcopy(parent["foundationQualification"]),
        "foundationCheckpoint": deepcopy(parent["foundationCheckpoint"]),
        "foundationQualificationOrigin": candidate["parentDataset"],
        "qualification": {"datasetIdentityAndAssetsVerified": True, "splitMembershipVerified": True,
            "singleTrainReplacementVerified": True, "retainedMvpSourceComponentsRecomputed": True,
            "dataQualifiedForTraining": True, "denoiserTrainingAllowed": True,
            "foundationQualified": parent["qualification"]["foundationQualified"],
            "foundationRetrainedOnCorrection": False, "oldDenoiserWeightInheritanceAllowed": False,
            "executionQualified": False, "gpuQualified": False, "trainingAllowed": False}}
    artifacts["manifest.json"] = canonical_bytes(manifest) + b"\n"
    return manifest, artifacts, rows


def reproduce_release(root, manifest):
    require(manifest.get("schemaVersion") == SCHEMA, "corrected release schema differs")
    payload = manifest["identityPayload"]
    return build_release(root, payload["verificationRequest"], expected_programs=payload["verifierPrograms"],
                         expected_runtime=payload["nodeRuntime"])


def materialize_release(root, request_binding):
    root = Path(root).resolve()
    manifest, artifacts, rows = build_release(root, request_binding)
    relative = f"{PACKAGE_ROOT}/{manifest['packageId']}"
    directory = project_file(root, relative)
    directory.mkdir(parents=True, exist_ok=True)
    lock = directory / ".materialization.lock"
    with lock.open("x", encoding="utf-8") as stream:
        stream.write(str(os.getpid()))
        stream.flush()
        os.fsync(stream.fileno())
    try:
        for name, data in artifacts.items():
            target = project_file(root, relative + "/" + name)
            require(not target.exists() or target.read_bytes() == data, "immutable correction release conflict")
        _verify_assets(root, rows)
        for binding in manifest["identityPayload"]["verification"]["inputBindings"]:
            read_bound(root, binding)
        require(_programs(root) == manifest["identityPayload"]["verifierPrograms"], "publication program changed before commit")
        for name, data in artifacts.items():
            target = project_file(root, relative + "/" + name)
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                with target.open("xb") as stream:
                    stream.write(data)
                    stream.flush()
                    os.fsync(stream.fileno())
        return _binding(relative + "/manifest.json", artifacts["manifest.json"])
    finally:
        lock.unlink()
