"""Immutable MVP64 release after fresh foundation qualification.

This release changes no sample, split, RGB byte or condition byte.  It binds a
verified fresh Autoencoder to the already source-isolated release so the
Denoiser data/model preflight can proceed.  Execution and GPU gates remain
separate and false.
"""
from __future__ import annotations

from copy import deepcopy
import os
from pathlib import Path

import torch

from .split_release import (
    COUNTS,
    PACKAGE_ROOT,
    _binding,
    bound_json,
    canonical_bytes,
    digest,
    load_package,
    project_file,
    read_bound,
)
from .split_training import state_hash


SCHEMA = "ai-painter-stage4-v2-mvp64-denoiser-dataset-release-v1"
PARENT_SCHEMA = "ai-painter-stage4-v2-mvp64-fresh-lineage-dataset-release-v1"
FOUNDATION_SCHEMA = "ai-painter-stage4-mvp-fresh-foundation-qualification-v1"


def require(value, message):
    if not value:
        raise ValueError(message)


def build_release(root: Path, *, parent_binding: dict, foundation_qualification_binding: dict):
    root = Path(root).resolve()
    parent, rows = load_package(root, parent_binding)
    require(parent.get("schemaVersion") == PARENT_SCHEMA and parent.get("immutable") is True,
            "MVP64 parent release invalid")
    require(parent.get("splitCounts") == COUNTS and len(rows) == 64,
            "MVP64 parent capacity changed")
    parent_qualification = parent.get("qualification", {})
    for key in ("datasetIdentityAndAssetsVerified", "splitMembershipVerified",
                "projectControlledSourceIsolationVerified", "aiAssistedColdStartRightsVerified",
                "recordedHistoricalOptimizerExposureResolvedBySplit"):
        require(parent_qualification.get(key) is True, "parent data gate missing: " + key)
    require(parent_qualification.get("fullHistoryCreativeNovelty")
            == "deferred_out_of_current_mvp_scope", "MVP history scope changed")
    require(parent_qualification.get("foundationTrainingAllowed") is True
            and parent_qualification.get("denoiserTrainingAllowed") is False,
            "parent release role changed")

    foundation = bound_json(root, foundation_qualification_binding)
    require(foundation.get("schemaVersion") == FOUNDATION_SCHEMA
            and foundation.get("status") == "foundation_qualified_for_fresh_stage0_denoiser_preflight"
            and foundation.get("foundationQualified") is True,
            "fresh foundation qualification invalid")
    require(foundation.get("datasetManifest") == parent_binding,
            "foundation was trained from another dataset release")
    require(foundation.get("initialization") == "random_initialization_only"
            and foundation.get("upstreamCheckpoints") == []
            and foundation.get("thirdPartyWeightsLoaded") is False,
            "foundation lineage is not isolated")
    require(foundation.get("trainOptimizerSteps") == 960
            and foundation.get("nonTrainOptimizerSteps") == 0
            and foundation.get("challengeRead") is False
            and foundation.get("regressionRead") is False
            and foundation.get("checkpointReloadVerified") is True,
            "foundation training boundary incomplete")
    checkpoint_binding = foundation.get("checkpoint")
    checkpoint_bytes = read_bound(root, checkpoint_binding)
    payload = torch.load(__import__("io").BytesIO(checkpoint_bytes), map_location="cpu", weights_only=True)
    require(payload.get("schemaVersion") == "ai-painter-stage4-mvp-fresh-foundation-checkpoint-v1"
            and payload.get("runId") == foundation.get("runId")
            and payload.get("datasetManifest") == parent_binding,
            "foundation checkpoint binding invalid")
    require(payload.get("denoiserTrained") is False and payload.get("denoiserState") is None
            and payload.get("optimizerSteps") == 960 and payload.get("nonTrainOptimizerSteps") == 0,
            "foundation checkpoint role invalid")
    foundation_state = payload.get("autoencoderState")
    require(isinstance(foundation_state, dict)
            and state_hash(foundation_state) == payload.get("autoencoderStateSha256")
            == foundation.get("foundationStateSha256"), "foundation tensor identity invalid")

    payload_identity = {
        "schemaVersion": SCHEMA,
        "parentDatasetRelease": deepcopy(parent_binding),
        "foundationQualification": deepcopy(foundation_qualification_binding),
        "foundationCheckpoint": deepcopy(checkpoint_binding),
        "foundationStateSha256": foundation["foundationStateSha256"],
        "splitCounts": deepcopy(COUNTS),
        "channelOrder": deepcopy(parent["identityPayload"]["channelOrder"]),
        "continuousChannelIds": deepcopy(parent["identityPayload"]["continuousChannelIds"]),
        "selectionReproductionSha256": parent["identityPayload"]["selectionReproductionSha256"],
    }
    identity = "stage4-v2-mvp64-denoiser-qualified-" + digest(canonical_bytes(payload_identity))
    manifest = {
        "schemaVersion": SCHEMA,
        "packageId": identity,
        "datasetReleaseIdentity": identity,
        "status": "immutable_denoiser_data_and_foundation_qualified_execution_pending",
        "immutable": True,
        "requirements": deepcopy(parent["requirements"]),
        "sampleCount": 64,
        "splitCounts": deepcopy(COUNTS),
        "identityPayload": payload_identity,
        "sourceIndex": deepcopy(parent["sourceIndex"]),
        "splits": deepcopy(parent["splits"]),
        "qualificationEvidence": deepcopy(parent["qualificationEvidence"]),
        "foundationQualification": deepcopy(foundation_qualification_binding),
        "foundationCheckpoint": deepcopy(checkpoint_binding),
        "qualification": {
            **deepcopy(parent_qualification),
            "foundationTrainingAllowed": False,
            "foundationTrainingRole": "completed_frozen_foundation",
            "foundationQualified": True,
            "dataQualifiedForTraining": True,
            "denoiserTrainingAllowed": True,
            "executionQualified": False,
            "gpuQualified": False,
            "trainingAllowed": False,
        },
    }
    return manifest, rows


def reproduce_release(root: Path, manifest: dict):
    require(manifest.get("schemaVersion") == SCHEMA, "Denoiser release schema mismatch")
    expected, rows = build_release(
        root,
        parent_binding=manifest.get("identityPayload", {}).get("parentDatasetRelease"),
        foundation_qualification_binding=manifest.get("foundationQualification"),
    )
    require(expected == manifest, "Denoiser release does not reproduce its evidence")
    return expected, rows


def materialize_release(root: Path, *, parent_binding: dict, foundation_qualification_binding: dict):
    root = Path(root).resolve()
    manifest, _ = build_release(
        root, parent_binding=parent_binding,
        foundation_qualification_binding=foundation_qualification_binding)
    relative = f"{PACKAGE_ROOT}/{manifest['packageId']}"
    directory = project_file(root, relative)
    directory.mkdir(parents=True, exist_ok=True)
    lock = directory / ".materialization.lock"
    with lock.open("x", encoding="utf-8") as stream:
        stream.write(str(os.getpid()))
        stream.flush()
        os.fsync(stream.fileno())
    try:
        data = canonical_bytes(manifest) + b"\n"
        target = project_file(root, relative + "/manifest.json")
        require(not target.exists() or target.read_bytes() == data,
                "immutable Denoiser release conflict")
        require(build_release(
            root, parent_binding=parent_binding,
            foundation_qualification_binding=foundation_qualification_binding)[0] == manifest,
            "Denoiser release inputs changed during materialization")
        if not target.exists():
            with target.open("xb") as stream:
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
        return _binding(relative + "/manifest.json", data)
    finally:
        lock.unlink(missing_ok=True)
