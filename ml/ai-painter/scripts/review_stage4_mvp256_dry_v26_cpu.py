"""Bounded CPU-only V26/V24 validation comparison; never trains or publishes."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import painter_stage4_v26_dry_single_world_checkpoint_worker as v26
import materialize_stage4_mvp256_dry_v24_candidate as files
import diagnose_stage4_v24_validation_shadow as metrics

base = v26.base
core = base.v24.core
SCHEMA = "ai-painter-mvp256-dry-v26-cpu-review-v1"
ROLES = tuple(base.OBJECT_CHANNELS)


def validate_completed(terminal, worker, package):
    files.require(terminal.get("status") == "training_completed_review_pending"
                  and worker.get("status") == "training_completed_review_pending"
                  and worker.get("completedEpochs") == 48
                  and worker.get("optimizerStepsGenerator") == 2304
                  and worker.get("optimizerStepsDiscriminator") == 2304
                  and worker.get("checkpointReloadVerified") is True
                  and worker.get("checkpointPromotable") is False,
                  "incomplete or publishable training cannot be reviewed")
    files.require(terminal.get("runId") == worker.get("runId") == package.get("runId")
                  and terminal.get("packageId") == worker.get("packageId") == package.get("packageId")
                  and worker.get("executionPackage") == terminal.get("executionPackage")
                  and worker.get("candidateContract") == package.get("candidateContract")
                  and terminal.get("selectedCheckpoint") == worker.get("selectedCheckpoint"),
                  "training identity differs")
    records = worker.get("checkpoints", [])
    files.require([row.get("epoch") for row in records] == [24, 36, 48],
                  "all eligible checkpoints required")
    selected = max(records, key=lambda row: base._validated_rank(row["selection"]))
    files.require(selected == worker.get("selectedCheckpointRecord")
                  and selected["epoch"] == worker.get("selectedEpoch")
                  and selected["checkpoint"] == worker.get("selectedCheckpoint")
                  and selected["selection"]["rank"] == worker.get("selectedRank"),
                  "selected checkpoint is not the frozen rank winner")
    files.require(worker.get("challengeContentRead") is False
                  and worker.get("regressionContentRead") is False,
                  "held-out content boundary differs")
    return selected


def preflight(terminal_binding):
    terminal = files.bound_json(terminal_binding)
    package = files.bound_json(terminal["executionPackage"])
    worker = files.bound_json(terminal["workerTerminal"])
    files.require(package.get("capabilityVersion") == v26.CAPABILITY
                  and terminal.get("capabilityVersion") == v26.CAPABILITY
                  and worker.get("capabilityVersion") == v26.CAPABILITY,
                  "V26 capability identity required")
    selected = validate_completed(terminal, worker, package)
    registry = json.loads(files.project_file(
        ".runtime/ai-painter/current-execution-registry/current.json").read_bytes())
    latest = registry.get("latestTrainingTerminal", {})
    files.require(registry.get("activeExecution") is None
                  and latest.get("runId") == package["runId"]
                  and {"path": latest.get("path"), "sha256": latest.get("sha256")} == terminal_binding,
                  "review requires the completed current execution")
    for binding in package["programBindings"].values():
        files.read_bound(binding)
    reader = core.cpu.BoundReader(ROOT)
    policy = reader.json(package["candidateContract"])
    proposal, parent = v26._source_candidate(reader, policy)
    files.require(package["sourceDataCandidate"] == policy["predecessorCandidate"]
                  and package["datasetManifest"] == parent["frozenBindings"]["datasetManifest"],
                  "data lineage differs")
    prior_binding = policy["baseline"]["trainingTerminal"]
    prior = files.bound_json(prior_binding)
    prior_package = files.bound_json(prior["executionPackage"])
    prior_worker = files.bound_json(prior["workerTerminal"])
    prior_selected = validate_completed(prior, prior_worker, prior_package)
    files.require(prior_package["candidateContract"] == policy["predecessorCandidate"]
                  and prior_package["datasetManifest"] == package["datasetManifest"]
                  and prior_package["validationSplit"] == package["validationSplit"],
                  "frozen V24 comparison dataset differs")
    baseline_audit = files.bound_json(policy["baseline"]["failedVisualAudit"])
    files.require(baseline_audit["selectedCheckpoint"] == prior_selected["checkpoint"],
                  "V24 audit checkpoint differs")
    for record in worker["checkpoints"]:
        files.read_bound(record["checkpoint"])
    return {"terminal": terminal, "package": package, "worker": worker,
            "selected": selected, "parent": parent, "proposal": proposal, "policy": policy,
            "prior": prior, "priorPackage": prior_package,
            "priorWorker": prior_worker, "baselineAudit": baseline_audit}


def execute(terminal_binding):
    import torch
    from ai_painter.complete_world.stage4_v17_responsibility_artifact import encode_responsibility_artifact

    torch.set_num_threads(2)
    files.require(not torch.cuda.is_initialized(), "CPU-only reviewer required")
    started = time.monotonic()
    ready = preflight(terminal_binding)
    package, parent = ready["package"], ready["parent"]
    out = package["outputRoot"] + "/dry-review"
    directory = files.project_file(out)
    files.require(not directory.exists(), "V26 review already consumed; no overwrite")
    directory.mkdir(exist_ok=False)
    reader = core.cpu.BoundReader(ROOT)
    report = {"schemaVersion": SCHEMA, "status": "cpu_comparison_completed_visual_review_pending",
              "capabilityVersion": v26.CAPABILITY, "runId": package["runId"],
              "packageId": package["packageId"], "trainingTerminal": terminal_binding,
              "executionPackage": ready["terminal"]["executionPackage"],
              "workerTerminal": ready["terminal"]["workerTerminal"],
              "candidateContract": package["candidateContract"],
              "sourceDataCandidate": package["sourceDataCandidate"],
              "baselineTrainingTerminal": ready["policy"]["baseline"]["trainingTerminal"],
              "baselineAudit": ready["policy"]["baseline"]["failedVisualAudit"],
              "program": files.bind(Path(__file__).relative_to(ROOT).as_posix()),
              "optimizerSteps": 0, "gpuStarted": False, "weightsModified": False,
              "challengeContentRead": False, "regressionContentRead": False,
              "formalStage4QualificationGranted": False, "runtimePublicationGranted": False,
              "selectedCheckpoint": ready["worker"]["selectedCheckpoint"],
              "selectedEpoch": ready["worker"]["selectedEpoch"], "measurements": {}}
    try:
        with base.v24.successor_profile(), core.fit.readonly_guard(), patch.object(
                torch.cuda, "is_available", side_effect=AssertionError("CUDA prohibited")):
            release, order, continuous, _, _ = core.cpu.select_rows(reader)
            source = reader.json(release["sourceIndex"])
            split = reader.json(package["validationSplit"])
            ids = split["sampleIds"]
            files.require(len(ids) == len(set(ids)) == 8, "exact eight validation rows required")
            by_id = {row["sampleId"]: row for row in source["samples"]}
            samples = []
            identities = []
            for sample_id in ids:
                row = by_id[sample_id]
                files.require(row["split"] == "validation", "non-validation row prohibited")
                sample, identity = core.cpu.load_sample(reader, row, order, continuous)
                samples.append(sample)
                identities.append(identity)
            report["validationSampleIds"] = ids
            subject_id = parent["scope"]["subjectSampleId"]
            files.require(ids[0] == subject_id, "preselected subject differs")
            for label, worker, execution_binding, contract_binding, factory, identity_schema in (
                    ("v24", ready["priorWorker"], ready["prior"]["executionPackage"],
                     ready["priorPackage"]["candidateContract"], base.v24.fresh_networks, base.V24_IDENTITY),
                    ("v26", ready["worker"], ready["terminal"]["executionPackage"],
                     package["candidateContract"], v26.fresh_networks, v26.IDENTITY)):
                selected = worker["selectedCheckpointRecord"]
                model, critic, states = base.reload_checkpoint_exact(
                    reader.read(selected["checkpoint"]), expected_epoch=worker["selectedEpoch"],
                    expected_selection=selected["selection"], execution_package=execution_binding,
                    candidate_contract=contract_binding, channel_order=order,
                    network_factory=factory, identity=identity_schema)
                files.require(states == selected["stateSha256"], "CPU reload state differs")
                del critic
                model.eval().requires_grad_(False)
                before = core.cpu.state_hash(model)
                rows = []
                for ordinal, sample in enumerate(samples):
                    files.require(time.monotonic() - started <= 120, "CPU review time cap exceeded")
                    with torch.inference_mode():
                        prediction, evidence = model(sample["conditions"][None],
                            sample["objectInstanceTable"], return_evidence=True)
                        observation = base.validation_observation(model, sample, order,
                                                                 epoch=worker["selectedEpoch"])
                        errors = metrics.validation_metrics(prediction, sample, order)
                        support = {}
                        for role in ROLES:
                            mask = evidence["visibleObjectSupportMasks"][role].bool()
                            support[role] = {"pixels": int(mask.sum()), "rgbMae":
                                float((prediction - sample["image"][None]).abs()[mask.expand_as(prediction)].mean())
                                if bool(mask.any()) else None}
                    image = files.write_exclusive(out + f"/{label}-validation-{ordinal:02d}.png",
                                                  core.png_bytes(prediction[0]))
                    rows.append({"sampleId": sample["sampleId"], "observation": observation,
                                 "errors": errors, "support": support, "image": image})
                    if label == "v26" and ordinal == 0:
                        subject_identity = identities[0]
                        scope = reader.json(parent["frozenBindings"]["dryScope"])["preselectedSubject"]
                        expected = {"worldId": subject_identity["worldId"], "regionId": scope["regionId"],
                            "tick": subject_identity["tick"], "factHash": subject_identity["factHash"],
                            "visualFactManifestSha256": subject_identity["visualFactManifestContentSha256"],
                            "conditionPackSha256": subject_identity["conditionPack"]["sha256"],
                            "modelStateSha256": states["Model"]}
                        interface = files.bind(files.INTERFACE)
                        interface_bytes = reader.read(interface)
                        archive, artifact = encode_responsibility_artifact(
                            {key: value.detach().float().cpu() for key, value in {
                                **evidence["terrainResponsibilityFeatures"],
                                **evidence["responsibilityFeatures"]}.items()},
                            identity=expected, archive_path=out + "/responsibilities.f32.zlib",
                            schema_bytes=interface_bytes, schema_sha256=interface["sha256"],
                            candidate_pack_schema_version=json.loads(interface_bytes)["candidatePackSchemaVersion"])
                        archive_binding = files.write_exclusive(artifact["tensorArchive"]["path"], archive)
                        report["subject"] = {**expected, "sampleId": subject_id, "split": "validation",
                            "conditionPack": subject_identity["conditionPack"],
                            "referenceRgb": by_id[subject_id]["image"]}
                        report["candidateRgb"] = image
                        report["responsibility"] = {"archive": archive_binding, "interface": interface,
                                                   "evidence": artifact}
                        report["originalRgb"] = files.write_exclusive(out + "/original-256.png",
                                                                     core.png_bytes(sample["image"]))
                files.require(core.cpu.state_hash(model) == before
                              and all(parameter.grad is None for parameter in model.parameters()),
                              "CPU inference mutated model")
                ranked = base.rank_validation_epoch([row["observation"] for row in rows], ids,
                                                   epoch=worker["selectedEpoch"])
                report["measurements"][label] = {"checkpoint": selected["checkpoint"],
                    "stateSha256": states, "selectionCpu": ranked,
                    "selectionRecorded": selected["selection"], "rows": rows}
                del model
            reader.unchanged()
        files.require(time.monotonic() - started <= 120, "CPU review time cap exceeded")
        files.require(sum(p.stat().st_size for p in directory.iterdir()) < 30 * 1024 * 1024,
                      "CPU review byte cap exceeded")
        report["modelForwardCalls"] = 32
        report["elapsedSeconds"] = time.monotonic() - started
        report["recordedAtUtc"] = datetime.now(timezone.utc).isoformat()
        return files.write_exclusive(out + "/cpu-comparison.json",
            (json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode())
    except Exception as error:
        files.write_exclusive(out + "/cpu-review-failure.json", (json.dumps({
            "status": "cpu_review_failed_closed", "runId": package["runId"], "error": str(error),
            "optimizerSteps": 0, "stage4Advanced": False,
            "recordedAtUtc": datetime.now(timezone.utc).isoformat()}, indent=2) + "\n").encode())
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--terminal", required=True)
    parser.add_argument("--sha256", required=True)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    binding = {"path": args.terminal, "sha256": args.sha256}
    result = execute(binding) if args.execute else {
        "status": "cpu_review_preflight_passed", "runId": preflight(binding)["package"]["runId"]}
    print(json.dumps(result, ensure_ascii=False))
