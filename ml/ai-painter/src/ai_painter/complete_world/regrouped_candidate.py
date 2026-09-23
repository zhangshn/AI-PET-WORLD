"""Immutable regrouping proposal, deliberately rejected by training Datasets.

Keeps source bytes and historical membership. Capacity-only solver evidence is
not a provenance, holdout, coverage, model or training qualification.
"""
from copy import deepcopy
from pathlib import Path
import json
import os

from .split_release import (COUNTS, PACKAGE_ROOT, canonical_bytes, digest,
                            project_file, bound_json, load_package, validate_groups)

SCHEMA = "ai-painter-stage4-regrouped64-review-candidate-v1"


def require(value, message):
    if not value:
        raise ValueError(message)


def build_candidate(root, parent_binding, proposal_binding):
    root = Path(root)
    parent, originals = load_package(root, parent_binding)
    proposal = bound_json(root, proposal_binding)
    schema = proposal.get("schemaVersion")
    require(schema in {"controller-observed-group-capacity-relaxation-v1",
                       "controller-stage4-mvp-split-correction-v1"},
            "unsupported regrouping proposal")
    if schema == "controller-observed-group-capacity-relaxation-v1":
        require(proposal.get("datasetManifest") == parent_binding, "proposal parent mismatch")
        require(proposal.get("fullContractFeasible") is None and proposal.get("trainingAllowed") is False,
                "capacity proposal cannot grant qualification")
        observed = bound_json(root, proposal["source"])
        require(observed.get("schemaVersion") == "controller-current64-naturalization-donor-trace-v1"
                and observed.get("datasetManifest") == parent_binding, "dependency evidence mismatch")
        witness = proposal["relaxedProblem"]["witness"]
        minimum_changes = proposal["relaxedProblem"]["minimumMembershipChanges"]
        require(proposal["relaxedProblem"]["capacities"] == COUNTS, "capacity contract changed")
        remaining = proposal["constraintsNotSolved"]
        dependency_evidence = proposal["source"]
    else:
        require(proposal.get("parentManifest") == parent_binding, "proposal parent mismatch")
        require(proposal.get("status") == "feasible_under_current_contract_for_split_membership_only"
                and proposal.get("trainingAllowed") is False, "split correction cannot grant qualification")
        contract = bound_json(root, proposal["sourceIsolationContract"])
        require(contract.get("schemaVersion") == "ai-painter-mvp-source-isolation-classification-contract-v1"
                and contract.get("policyVersion") == "AI-PAINTER-DATA-PROVENANCE-1.7",
                "source isolation contract mismatch")
        history = bound_json(root, proposal["evidence"]["historicalExposure"])
        require(history.get("schemaVersion") == "ai-painter-stage4-historical-exposure-audit-v1",
                "historical exposure evidence mismatch")
        witness = proposal["splitPlan"]["witness"]
        minimum_changes = proposal["splitPlan"]["minimumMembershipChanges"]
        require(proposal["splitPlan"]["capacities"] == COUNTS, "capacity contract changed")
        require(proposal.get("challengeIdentityPreserved") is True, "challenge identity changed")
        require(proposal["historicalUseResolution"].get("freshDenoiserAndNoParentRequired") is True
                and proposal["historicalUseResolution"].get("oldDenoiserWeightInheritanceAllowed") is False,
                "fresh model boundary missing")
        require(proposal["sourceRuleResolution"].get("blanketPublicSourceExemption") is False
                and proposal["sourceRuleResolution"].get("blanketNumericMustLink") is False,
                "source rule scope invalid")
        remaining = proposal["remainingGates"]
        dependency_evidence = proposal_binding
    original_by_id = {r["sampleId"]: r for r in originals}
    require(len(witness) == len({r["sampleId"] for r in witness}) == 64
            and set(original_by_id) == {r["sampleId"] for r in witness}, "proposal membership mismatch")
    choices = {r["sampleId"]: r for r in witness}
    rows, changes = [], []
    for old in originals:
        choice = choices[old["sampleId"]]
        require(choice["split"] == old["split"] and choice["proposedSplit"] in COUNTS,
                "historical split changed or proposed split invalid")
        row = deepcopy(old)
        row["sourceSplit"] = old["split"]
        row["split"] = choice["proposedSplit"]
        row["useQualification"] = "unverified_not_training_eligible"
        rows.append(row)
        if old["split"] != row["split"]:
            changes.append({"sampleId": row["sampleId"], "from": old["split"], "to": row["split"]})
    validate_groups(rows)
    require(len(changes) == minimum_changes, "change count mismatch")
    if schema == "controller-observed-group-capacity-relaxation-v1":
        observed_rows = observed["rows"]
        require(len(observed_rows) == len({r["sampleId"] for r in observed_rows}) == 64
                and {r["sampleId"] for r in observed_rows} == set(original_by_id), "incomplete dependency rows")
        for row in observed_rows:
            require(row["split"] == original_by_id[row["sampleId"]]["split"], "dependency source split mismatch")
            for edge in row["donorEdges"]:
                require(edge["sampleId"] in choices, "unknown donor")
                require(choices[row["sampleId"]]["proposedSplit"] == choices[edge["sampleId"]]["proposedSplit"],
                        "observed donor group split across uses")
    else:
        require([r["sampleId"] for r in rows if r["split"] == "challenge"] == proposal["challengeSampleIds"],
                "challenge identity changed")
        exposure = {r["sampleId"]: r for r in history["perSample"]}
        require(set(exposure) == set(original_by_id), "historical exposure coverage mismatch")
        for row in rows:
            item = exposure[row["sampleId"]]
            optimizer_exposed = item.get("recordedOptimizerRuns", 0) > 0 or item.get("recordedOptimizerSteps", 0) > 0
            require(not optimizer_exposed or row["split"] == "train",
                    "proven historical optimizer exposure remains outside train")
    gates = {"trainingAllowed": False, "gpuAllowed": False, "dataQualified": False,
             "historicalUseQualified": False, "challengeUnseenQualified": False,
             "coverageQualified": False, "completeSourceGraphQualified": False,
             "foundationQualified": False, "activeDatasetChanged": False}
    artifacts = {"source-index.json": canonical_bytes({
        "schemaVersion": SCHEMA + ":source-index", "sampleCount": 64, "samples": rows,
        "parentManifest": parent_binding, "sourceBytesUnchanged": True,
        "historicalUseNotResetByRegrouping": True}) + b"\n"}
    for split in COUNTS:
        artifacts[f"splits/{split}.json"] = canonical_bytes({
            "schemaVersion": SCHEMA + ":membership", "split": split,
            "sampleIds": [r["sampleId"] for r in rows if r["split"] == split],
            "trainingAllowed": False}) + b"\n"
    artifacts["review.json"] = canonical_bytes({
        "status": "indeterminate_due_to_missing_evidence", "changes": changes,
        "historyEvidence": dependency_evidence, "proposal": proposal_binding,
        "remainingRequirements": remaining,
        "qualification": gates, "optimizerOrCheckpointSelectionOccurred": False}) + b"\n"
    payload = {"schemaVersion": SCHEMA, "parentManifest": parent_binding,
               "proposal": proposal_binding, "dependencyEvidence": dependency_evidence,
               "splitCounts": COUNTS, "artifactHashes": {k: digest(v) for k, v in sorted(artifacts.items())}}
    identity = "stage4-v2-regroup64-review-" + digest(canonical_bytes(payload))
    directory = f"{PACKAGE_ROOT}/{identity}"
    bind = lambda name: {"path": directory + "/" + name, "sha256": digest(artifacts[name])}
    manifest = {"schemaVersion": SCHEMA, "packageId": identity,
                "status": "immutable_regrouped_candidate_pending_qualification", "immutable": True,
                "sampleCount": 64, "splitCounts": COUNTS, "identityPayload": payload,
                "sourceIndex": bind("source-index.json"), "review": bind("review.json"),
                "splits": {s: bind(f"splits/{s}.json") for s in COUNTS}, "qualification": gates}
    artifacts["manifest.json"] = canonical_bytes(manifest) + b"\n"
    return manifest, artifacts


def materialize_candidate(root, parent_binding, proposal_binding):
    root = Path(root)
    manifest, artifacts = build_candidate(root, parent_binding, proposal_binding)
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
            require(not target.exists() or target.read_bytes() == data, "immutable candidate conflict: " + name)
        # Recheck source/selection inputs before writing the immutable commit.
        require(build_candidate(root, parent_binding, proposal_binding) == (manifest, artifacts), "candidate inputs changed")
        for name, data in artifacts.items():
            target = project_file(root, relative + "/" + name)
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                with target.open("xb") as stream:
                    stream.write(data)
                    stream.flush()
                    os.fsync(stream.fileno())
        return {"path": relative + "/manifest.json", "sha256": digest(artifacts["manifest.json"])}
    finally:
        lock.unlink()  # Only this invocation's successfully created lock.


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("parent", "parent-sha256", "proposal", "proposal-sha256"):
        parser.add_argument("--" + name, required=True)
    args = parser.parse_args()
    result = materialize_candidate(Path.cwd(), {"path": args.parent, "sha256": args.parent_sha256},
                                   {"path": args.proposal, "sha256": args.proposal_sha256})
    print(json.dumps({"manifest": result, "status": "candidate_created_not_training_qualified",
                      "trainingAllowed": False, "gpuStarted": False}))
