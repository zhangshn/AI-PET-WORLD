"""Immutable Stage4 MVP64 release for a fresh, isolated model lineage.

The release preserves the existing RGB and condition bytes and records the
approved 189/194 split correction.  It proves only the dataset-side facts that
can be recomputed from bound evidence.  Foundation, execution, GPU and training
qualification remain separate gates; this module has no training API.
"""
from __future__ import annotations

from copy import deepcopy
import json
import os
from pathlib import Path

from .split_release import (COUNTS, PACKAGE_ROOT, bound_json, canonical_bytes,
                            digest, load_package, project_file, validate_groups)

SCHEMA = "ai-painter-stage4-v2-mvp64-fresh-lineage-dataset-release-v1"
SOURCE_SCHEMA = SCHEMA + ":source-index"
MEMBERSHIP_SCHEMA = SCHEMA + ":membership"
EVIDENCE_SCHEMA = SCHEMA + ":qualification-evidence"
POLICY_VERSION = "AI-PAINTER-DATA-PROVENANCE-1.7"
SOURCE_ISOLATION_SCHEMA = "ai-painter-mvp-source-isolation-classification-contract-v1"
PAIRING_SCHEMA = "ai-painter-stage4-source-pairing-observation-v1"
SEMANTIC_SCHEMA = "controller-regrouped64-current-semantic-rights-verification-v1"
HISTORY_SCHEMA = "ai-painter-stage4-historical-exposure-audit-v1"


def require(value, message):
    if not value:
        raise ValueError(message)


def _binding(path: str, data: bytes) -> dict:
    return {"path": path, "sha256": digest(data)}


def _row_identity(rows: list[dict]) -> list[dict]:
    return [{"sampleId": row["sampleId"], "split": row["split"],
             "imageSha256": row["image"]["sha256"],
             "conditionPackSha256": row["conditionPack"]["sha256"]}
            for row in rows]


def _verify_evidence(root: Path, candidate_binding: dict, rows: list[dict],
                     source_pairing_binding: dict, semantic_rights_binding: dict,
                     historical_exposure_binding: dict,
                     source_isolation_contract_binding: dict,
                     data_policy_binding: dict) -> dict:
    row_ids = {row["sampleId"] for row in rows}
    by_id = {row["sampleId"]: row for row in rows}

    contract = bound_json(root, source_isolation_contract_binding)
    require(contract.get("schemaVersion") == SOURCE_ISOLATION_SCHEMA
            and contract.get("policyVersion") == POLICY_VERSION
            and contract.get("scope") == "single_primitive_natural_world_mvp",
            "source-isolation contract mismatch")
    policy_bytes = project_file(root, data_policy_binding["path"]).read_bytes()
    require(digest(policy_bytes) == data_policy_binding.get("sha256"),
            "data policy SHA-256 mismatch")
    policy_text = policy_bytes.decode("utf-8")
    require(f"文档版本：`{POLICY_VERSION}`" in policy_text
            and "### 8.2 单世界MVP的公共地理输入与样本泄漏边界" in policy_text
            and "### 9.1 单世界先行MVP的阶段隔离" in policy_text,
            "data policy scope clauses missing")

    pairing = bound_json(root, source_pairing_binding)
    require(pairing.get("schemaVersion") == PAIRING_SCHEMA
            and pairing.get("status") == "per_sample_pairing_verified_source_qualification_pending"
            and pairing.get("manifest") == candidate_binding,
            "source-pairing evidence mismatch")
    require(pairing.get("counts") == COUNTS and pairing.get("sampleCount") == 64,
            "source-pairing capacity mismatch")
    pairing_rows = pairing.get("rows", [])
    require(len(pairing_rows) == len({row.get("sampleId") for row in pairing_rows}) == 64
            and {row.get("sampleId") for row in pairing_rows} == row_ids,
            "source-pairing sample coverage mismatch")
    for row in pairing_rows:
        require(row.get("split") == by_id[row["sampleId"]]["split"],
                "source-pairing split mismatch")
        require(row.get("generationResultBound") is True
                and row.get("conditionContentMatchesPrompt") is True
                and row.get("historicalSemanticAudit", {}).get("passed") is True,
                "source-pairing row is incomplete")
    qualifications = pairing.get("qualifications", {})
    require(qualifications.get("projectControlledCrossSampleFeedbackExcluded") is True
            and qualifications.get("trainingAllowed") is False
            and qualifications.get("gpuAllowed") is False,
            "source-pairing qualification boundary mismatch")

    semantic = bound_json(root, semantic_rights_binding)
    require(semantic.get("schemaVersion") == SEMANTIC_SCHEMA
            and semantic.get("status") ==
            "current64_mvp_semantic_and_ai_assisted_rights_verified_not_data_qualification"
            and semantic.get("candidate") == candidate_binding
            and semantic.get("sourcePairing") == source_pairing_binding,
            "semantic/rights evidence mismatch")
    require(semantic.get("sampleCount") == 64 and semantic.get("splitCounts") == COUNTS,
            "semantic/rights capacity mismatch")
    semantic_rows = semantic.get("rows", [])
    require(len(semantic_rows) == len({row.get("sampleId") for row in semantic_rows}) == 64
            and {row.get("sampleId") for row in semantic_rows} == row_ids,
            "semantic/rights sample coverage mismatch")
    for row in semantic_rows:
        require(row.get("split") == by_id[row["sampleId"]]["split"]
                and row.get("aiAssistedColdStartRightsVerified") is True
                and row.get("independentTrainingClaimed") is False
                and row.get("ownerReviewVerified") is True
                and row.get("machineSemanticPassed") is True
                and row.get("all23ConditionChannelsReplayed") is True,
                "semantic/rights row is incomplete")
    conclusions = semantic.get("conclusions", {})
    required_conclusions = {
        "exactRgbAndConditionBytesVerified": True,
        "all23ConditionChannelsReplayed": True,
        "existingMachineSemanticAuditsPassed": True,
        "ownerDelegatedAiAssistedColdStartReviewsVerified": True,
        "projectControlledCrossSampleFeedbackExcluded": True,
        "independentTrainingRightsClaimed": False,
        "aiAssistedColdStartLaneOnly": True,
    }
    require(all(conclusions.get(key) is value for key, value in required_conclusions.items())
            and semantic.get("trainingAllowed") is False
            and semantic.get("dataQualified") is False,
            "semantic/rights conclusion boundary mismatch")

    history = bound_json(root, historical_exposure_binding)
    require(history.get("schemaVersion") == HISTORY_SCHEMA
            and history.get("status") == "bounded_historical_use_audited_not_qualified"
            and history.get("trainingAllowed") is False,
            "historical-exposure evidence mismatch")
    history_rows = history.get("perSample", [])
    require(len(history_rows) == len({row.get("sampleId") for row in history_rows}) == 64
            and {row.get("sampleId") for row in history_rows} == row_ids,
            "historical-exposure sample coverage mismatch")
    exposed = []
    for item in history_rows:
        row = by_id[item["sampleId"]]
        optimizer_exposed = item.get("recordedOptimizerRuns", 0) > 0 \
            or item.get("recordedOptimizerSteps", 0) > 0
        require(not optimizer_exposed or row["split"] == "train",
                "recorded optimizer exposure remains outside train")
        if optimizer_exposed:
            exposed.append(item["sampleId"])
        if row["split"] == "challenge":
            require(item.get("evaluationRuns", 0) == 0 and not optimizer_exposed,
                    "recorded challenge exposure conflicts with fresh-lineage boundary")

    challenge_ids = [row["sampleId"] for row in rows if row["split"] == "challenge"]
    require(len(challenge_ids) == 4, "challenge membership mismatch")
    return {
        "projectControlledSourcePairingVerified": True,
        "semanticAndAiAssistedRightsVerified": True,
        "recordedOptimizerExposureMovedToTrain": sorted(exposed),
        "challengeHasNoRecordedProjectUse": True,
        "challengeSampleIds": challenge_ids,
        "historicalAuditLimitationsPreserved": deepcopy(history.get("limitations", [])),
    }


def build_release(root: Path, *, candidate_binding: dict,
                  source_pairing_binding: dict, semantic_rights_binding: dict,
                  historical_exposure_binding: dict,
                  source_isolation_contract_binding: dict,
                  data_policy_binding: dict) -> tuple[dict, dict[str, bytes]]:
    root = Path(root)
    candidate, rows = load_package(root, candidate_binding)
    require(candidate.get("schemaVersion") == "ai-painter-stage4-regrouped64-review-candidate-v1"
            and candidate.get("status") == "immutable_regrouped_candidate_pending_qualification"
            and candidate.get("qualification", {}).get("trainingAllowed") is False,
            "regrouped candidate boundary mismatch")
    channel_order = candidate.get("identityPayload", {}).get("channelOrder")
    continuous_channel_ids = candidate.get("identityPayload", {}).get("continuousChannelIds")
    require(isinstance(channel_order, list) and len(channel_order) == len(set(channel_order)) == 23
            and isinstance(continuous_channel_ids, list)
            and set(continuous_channel_ids).issubset(set(channel_order)),
            "candidate condition-channel contract missing")
    validate_groups(rows)
    require({row["capacitySlotId"]: row["split"] for row in rows}.get("v7-capacity-slot-189")
            == "validation", "capacity slot 189 must be validation")
    require({row["capacitySlotId"]: row["split"] for row in rows}.get("v7-capacity-slot-194")
            == "train", "capacity slot 194 must be train")
    evidence = _verify_evidence(root, candidate_binding, rows, source_pairing_binding,
                                semantic_rights_binding, historical_exposure_binding,
                                source_isolation_contract_binding, data_policy_binding)

    source_payload = {
        "schemaVersion": SOURCE_SCHEMA,
        "sampleCount": 64,
        "samples": deepcopy(rows),
        "candidateMembershipSource": candidate_binding,
        "sourceBytesUnchanged": True,
        "reviewCandidateQualificationNotInherited": True,
    }
    artifacts = {"source-index.json": canonical_bytes(source_payload) + b"\n"}
    for split in COUNTS:
        artifacts[f"splits/{split}.json"] = canonical_bytes({
            "schemaVersion": MEMBERSHIP_SCHEMA,
            "split": split,
            "sampleIds": [row["sampleId"] for row in rows if row["split"] == split],
        }) + b"\n"
    qualification_evidence = {
        "schemaVersion": EVIDENCE_SCHEMA,
        "status": "dataset_scope_verified_fresh_lineage_prerequisites_pending",
        "candidate": candidate_binding,
        "evidence": {
            "sourcePairing": source_pairing_binding,
            "semanticAndRights": semantic_rights_binding,
            "historicalExposure": historical_exposure_binding,
            "sourceIsolationContract": source_isolation_contract_binding,
            "dataPolicy": data_policy_binding,
        },
        "verified": evidence,
        "mvpScope": {
            "worldCount": 1,
            "regionCount": 1,
            "primitiveNaturalWorldOnly": True,
            "buildings": False,
            "artificialRoadNetwork": False,
            "personality": False,
            "fullHistoryCreativeNovelty": "deferred_out_of_current_mvp_scope",
            "deferredRequirementIds": ["MAP-023", "MAP-024"],
        },
        "lineageBoundary": {
            "lineage": "ai_assisted_cold_start",
            "independentTrainingEligible": False,
            "requiresFreshDenoiser": True,
            "oldDenoiserWeightInheritanceAllowed": False,
            "requiresQualifiedFoundationWithNoCurrent64TrainingOrSelectionUse": True,
            "challengeUnseenClaimActivatesOnlyForQualifiedFreshLineage": True,
        },
        "remainingGates": [
            "fresh_foundation_training_and_qualification",
            "formal_execution_binding",
            "current_candidate_cpu_qualification",
            "current_candidate_readonly_gpu_qualification",
        ],
        "foundationTrainingBoundary": {
            "allowed": True,
            "role": "fresh_foundation_autoencoder_only",
            "optimizerSplit": "train",
            "selectionSplit": "validation",
            "challengeReadAllowed": False,
            "regressionReadAllowed": False,
            "oldFoundationInitializationAllowed": False,
            "oldDenoiserInitializationAllowed": False,
        },
        "dataQualifiedForTraining": False,
        "trainingAllowed": False,
        "gpuAllowed": False,
    }
    artifacts["qualification-evidence.json"] = canonical_bytes(qualification_evidence) + b"\n"
    payload = {
        "schemaVersion": SCHEMA,
        "candidateMembershipSource": candidate_binding,
        "sourcePairingEvidence": source_pairing_binding,
        "semanticRightsEvidence": semantic_rights_binding,
        "historicalExposureEvidence": historical_exposure_binding,
        "sourceIsolationContract": source_isolation_contract_binding,
        "dataPolicy": data_policy_binding,
        "splitCounts": COUNTS,
        "channelOrder": deepcopy(channel_order),
        "continuousChannelIds": deepcopy(continuous_channel_ids),
        "selectionReproductionSha256": digest(canonical_bytes(_row_identity(rows))),
        "artifactHashes": {name: digest(data) for name, data in sorted(artifacts.items())},
    }
    identity = "stage4-v2-mvp64-fresh-lineage-" + digest(canonical_bytes(payload))
    directory = f"{PACKAGE_ROOT}/{identity}"
    bind = lambda name: _binding(f"{directory}/{name}", artifacts[name])
    manifest = {
        "schemaVersion": SCHEMA,
        "packageId": identity,
        "datasetReleaseIdentity": identity,
        "status": "immutable_dataset_release_foundation_and_execution_qualification_pending",
        "immutable": True,
        "requirements": ["AP-TRAIN-001", "AP-TRAIN-002", "AP-CHANGE-004"],
        "sampleCount": 64,
        "splitCounts": COUNTS,
        "identityPayload": payload,
        "sourceIndex": bind("source-index.json"),
        "splits": {split: bind(f"splits/{split}.json") for split in COUNTS},
        "qualificationEvidence": bind("qualification-evidence.json"),
        "qualification": {
            "datasetIdentityAndAssetsVerified": True,
            "splitMembershipVerified": True,
            "projectControlledSourceIsolationVerified": True,
            "aiAssistedColdStartRightsVerified": True,
            "recordedHistoricalOptimizerExposureResolvedBySplit": True,
            "fullHistoryCreativeNovelty": "deferred_out_of_current_mvp_scope",
            "foundationTrainingAllowed": True,
            "foundationTrainingRole": "fresh_foundation_autoencoder_only",
            "denoiserTrainingAllowed": False,
            "dataQualifiedForTraining": False,
            "foundationQualified": False,
            "executionQualified": False,
            "gpuQualified": False,
            "trainingAllowed": False,
        },
    }
    artifacts["manifest.json"] = canonical_bytes(manifest) + b"\n"
    return manifest, artifacts


def materialize_release(root: Path, **bindings) -> dict:
    root = Path(root)
    manifest, artifacts = build_release(root, **bindings)
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
            require(not target.exists() or target.read_bytes() == data,
                    "immutable release conflict: " + name)
        require(build_release(root, **bindings) == (manifest, artifacts),
                "release inputs changed during materialization")
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


def reproduce_release(root: Path, manifest: dict) -> tuple[dict, dict[str, bytes]]:
    payload = manifest.get("identityPayload", {})
    required = {
        "candidate_binding": "candidateMembershipSource",
        "source_pairing_binding": "sourcePairingEvidence",
        "semantic_rights_binding": "semanticRightsEvidence",
        "historical_exposure_binding": "historicalExposureEvidence",
        "source_isolation_contract_binding": "sourceIsolationContract",
        "data_policy_binding": "dataPolicy",
    }
    require(all(payload.get(field) is not None for field in required.values()),
            "dataset release evidence binding missing")
    return build_release(root, **{argument: payload[field] for argument, field in required.items()})
