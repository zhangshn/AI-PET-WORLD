"""Fixed eight-row ecology CPU review; artifacts never grant qualification.

The caller's existing owned CPU process enforces the 120-second hard deadline.
This adapter checks the same deadline cooperatively, with two CPU threads and
16 MiB of exclusive output. There is no recovery entry, retry or old worker gate.
"""
import argparse
import hashlib
import importlib
import json
from pathlib import Path
import stat
import sys
import time

ROOT = Path(__file__).absolute().parents[3]
SELF = "ml/ai-painter/scripts/review_stage4_ecology_quality_cpu_v1.py"
for directory in (ROOT / "ml/ai-painter/scripts", ROOT / "ml/ai-painter/src"):
    if str(directory) not in sys.path:
        sys.path.insert(0, str(directory))
from ai_painter.complete_world import ecology_quality_checkpoint_v1 as checkpoint
import ecology_quality_ranking_v1 as ranking
from ecology_quality_auth_v1 import decode, exact_binding, require, same_json

CAPABILITY = "stage4_mvp256_dry_factorized_ecology_quality_v1"
EXECUTION_PROFILE = "factorized_ecology_quality_execution_v1"
TERMINAL_SCHEMA = "ecology-regime-quality-worker-terminal-v1"
SUBJECT_ID = "ai-cold-start-v7-v7-capacity-slot-189-bamboo-grove-v2"
REGISTRY = ".runtime/ai-painter/current-execution-registry/current.json"
MAX_OUTPUT = 16 * 1024**2
FAILURE_RESERVE = 65536
worker = None  # Explicitly injectable in isolation; no predecessor fallback.

BASELINE_TERMINAL = {"path": ".runtime/ai-painter/stage4-mvp256-dry-v24-recovery-v2-executions/mvp256-dry-v24-9056e7f9a7eb9ba8bf8fbf569d05c0be30c12c723ffca0e2/training-finalize.json", "sha256": "2f2b7a3ff091f54e511e7bad9ab2a53fabbe2fc626f5bd91e49db7c1ade33a26"}
BASELINE_AUDIT = {"path": ".runtime/ai-painter/stage4-mvp256-dry-v24-recovery-v2-executions/mvp256-dry-v24-9056e7f9a7eb9ba8bf8fbf569d05c0be30c12c723ffca0e2/dry-review/independent-audit.json", "sha256": "c3c4db62221412523349ea57d8e925e13d49039903e6adffd2d4e10ce2556ae8"}
BASELINE_MAE = 0.06140733743086457
BASELINE_CORRELATION = -0.08459185063838959


def own_worker():
    value = worker if worker is not None else importlib.import_module(
        "painter_stage4_ecology_quality_worker_v1")
    require(value.CAPABILITY == CAPABILITY and value.EXECUTION_PROFILE == EXECUTION_PROFILE
            and value.TERMINAL_SCHEMA == TERMINAL_SCHEMA and value.checkpoint is checkpoint,
            "own ecology worker/profile/codec required")
    return value


def read_bytes(reader, binding):
    exact_binding(binding)
    raw = reader.read(binding)
    require(type(raw) is bytes and hashlib.sha256(raw).hexdigest() == binding["sha256"],
            "actual immutable source SHA differs")
    return raw


def read_json(reader, binding):
    value = decode(read_bytes(reader, binding))
    require(type(value) is dict, "bound JSON object required")
    return value


def regular(path, *, directory=False):
    info = Path(path).lstat()
    require((stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode))
            and not stat.S_ISLNK(info.st_mode)
            and not getattr(info, "st_file_attributes", 0) & 0x400,
            "review output must be regular, without links")
    return info


def claim_output(path, identity):
    path = Path(path)
    if not path.exists():
        path.mkdir()
    regular(path, directory=True)
    require(not any(path.iterdir()), "review output already contains evidence; no replay")
    with (path / "review-consumed.json").open("xb") as stream:
        stream.write(json.dumps(identity, sort_keys=True, allow_nan=False).encode())


def directory_bytes(path):
    regular(path, directory=True)
    total = 0
    for item in Path(path).iterdir():
        info = item.lstat()
        if stat.S_ISDIR(info.st_mode):
            total += directory_bytes(item)
        else:
            total += regular(item).st_size
    return total


def selected_record(terminal, *, configuration):
    """Validate all three ranks/counts through the own codec, then rank once."""
    own = own_worker()
    _torch, _profile, shared = own.runtime()
    require(type(terminal) is dict and terminal.get("schema") == TERMINAL_SCHEMA
            and terminal.get("status") == "training_completed_review_pending"
            and terminal.get("executionState") == "completed"
            and terminal.get("executionProfile") == EXECUTION_PROFILE
            and terminal.get("capabilityVersion") == CAPABILITY
            and type(terminal.get("completedEpochs")) is int and terminal["completedEpochs"] == 12
            and same_json(terminal.get("optimizerSteps"), {"generator": 576, "discriminator": 576})
            and type(terminal.get("optimizerStepsGenerator")) is int and terminal["optimizerStepsGenerator"] == 576
            and type(terminal.get("optimizerStepsDiscriminator")) is int and terminal["optimizerStepsDiscriminator"] == 576
            and terminal.get("checkpointReloadVerified") is True
            and all(terminal.get(key) is False for key in (
                "challengeContentRead", "regressionContentRead", "checkpointPromotable",
                "formalStage4QualificationAllowed", "runtimePublicationAllowed")),
            "complete nonpromotable ecology training evidence required")
    exact_binding(terminal.get("executionPackage"))
    require(type(terminal.get("packageId")) is str and bool(terminal["packageId"].strip()),
            "terminal package identity required")
    records = terminal.get("checkpoints")
    require(type(records) is list and len(records) == 1
            and [r.get("epoch") if type(r) is dict else None for r in records] == [12],
            "complete eligible checkpoint set required")
    for record in records:
        exact_binding(record.get("checkpoint"))
        checkpoint.validate_selection(configuration, terminal.get("runId"), record.get("epoch"),
                                      record.get("selection"), record.get("counts"))
    require(len({r["checkpoint"]["path"] for r in records}) == 1,
            "distinct eligible checkpoint sources required")
    selected = max(records, key=lambda row: ranking._validated_rank(row["selection"], eligible_epochs=(12,)))
    require(same_json(selected, terminal.get("selectedCheckpointRecord")),
            "machine selected checkpoint differs")
    return selected


def verify_current(reader, plan, terminal_binding):
    current = decode(reader.path(REGISTRY).read_bytes())
    require(type(current) is dict and current.get("schemaVersion") == "ai-painter-current-execution-registry-v1"
            and type(current.get("registryRevision")) is int and current["registryRevision"] > 0,
            "current execution registry missing or stale")
    latest = current.get("latestTrainingTerminal")
    require(type(latest) is dict and latest.get("runId") == plan["runId"]
            and same_json({"path": latest.get("path"), "sha256": latest.get("sha256")}, terminal_binding),
            "review requires immutable current completed training")
    require(current.get("activeExecution", "missing") is None, "review requires no active training")


def baseline_review(reader, plan, samples, order, resource, *, runtime):
    """Original V24 baseline algorithm, explicitly supplied pure dependencies."""
    torch, _profile, shared, _source = runtime
    prior = read_json(reader, BASELINE_TERMINAL)
    package = read_json(reader, prior["executionPackage"])
    body = read_json(reader, prior["workerTerminal"])
    require(package["candidateContract"] == plan["sourceCandidate"]
            and package["datasetManifest"] == plan["datasetManifest"]
            and package["validationSplit"] == plan["validationSplit"], "V24 comparison data differs")
    records = body["checkpoints"]
    require([r["epoch"] for r in records] == [24, 36, 48], "V24 baseline eligible set differs")
    selected = max(records, key=lambda row: shared._validated_rank(row["selection"]))
    audit = read_json(reader, BASELINE_AUDIT)
    require(body["completedEpochs"] == 48
            and body["optimizerStepsGenerator"] == body["optimizerStepsDiscriminator"] == 2304
            and selected == body["selectedCheckpointRecord"]
            and selected["checkpoint"] == audit["selectedCheckpoint"], "V24 baseline selection differs")
    resource()
    model, critic, states = shared.reload_checkpoint_exact(read_bytes(reader, selected["checkpoint"]),
        expected_epoch=selected["epoch"], expected_selection=selected["selection"],
        execution_package=prior["executionPackage"], candidate_contract=package["candidateContract"], channel_order=order)
    require(states == selected["stateSha256"], "V24 reload bytes differ")
    del critic
    rows = []
    before = shared.v24.core.cpu.state_hash(model)
    with shared._preserve_rng_and_mode(model), torch.inference_mode():
        model.eval()
        for sample in samples:
            resource()
            prediction = model(sample["conditions"][None], sample["objectInstanceTable"])
            _, corr = shared.original_object_class_spatial_loss(prediction, sample, order, split="validation")
            rows.append(observation(prediction, sample, corr, shared, selected["epoch"]))
    require(before == shared.v24.core.cpu.state_hash(model), "CPU baseline inference changed weights")
    ranked = shared.rank_validation_epoch(rows, [s["sampleId"] for s in samples], epoch=selected["epoch"])
    require(ranked["meanValidationRgbMae"] == BASELINE_MAE
            and ranked["worstApplicableObjectCorrelation"] == BASELINE_CORRELATION, "original baseline metric differs")
    return {"trainingTerminal": BASELINE_TERMINAL, "audit": BASELINE_AUDIT,
            "checkpoint": selected["checkpoint"], "selectionCpu": ranked, "rows": rows, "modelForwardCalls": 8}


def observation(prediction, sample, correlations, shared, epoch):
    return {"sampleId": sample["sampleId"], "split": "validation", "epoch": epoch,
            "fullRgbMae": float((prediction[0] - sample["image"]).abs().mean()),
            "objectCorrelations": {role: None if correlations.get(role) is None else float(correlations[role])
                                   for role in shared.OBJECT_CHANNELS}}


def subject_artifacts(reader, plan, sample, evidence, model, order, output, publish, *, shared):
    from ai_painter.complete_world.stage4_v17_responsibility_artifact import encode_responsibility_artifact
    import materialize_stage4_mvp256_dry_v24_candidate as files
    release = read_json(reader, plan["datasetManifest"])
    src = read_json(reader, release["sourceIndex"])
    rows = [row for row in src["samples"] if row["sampleId"] == SUBJECT_ID]
    require(len(rows) == 1 and rows[0]["split"] == "validation", "preselected189 source differs")
    row = rows[0]
    _decoded, identity = shared.v24.core.cpu.load_sample(
        reader, row, order, release["identityPayload"]["continuousChannelIds"])
    candidate = read_json(reader, plan["sourceCandidate"])
    scope = read_json(reader, candidate["frozenBindings"]["dryScope"])["preselectedSubject"]
    expected = {"worldId": identity["worldId"], "regionId": scope["regionId"], "tick": identity["tick"],
        "factHash": identity["factHash"], "visualFactManifestSha256": identity["visualFactManifestContentSha256"],
        "conditionPackSha256": identity["conditionPack"]["sha256"],
        "modelStateSha256": shared.v24.core.cpu.state_hash(model)}
    interface = {"path": files.INTERFACE,
                 "sha256": hashlib.sha256(reader.path(files.INTERFACE).read_bytes()).hexdigest()}
    schema = read_bytes(reader, interface)
    tensors = {**evidence["terrainResponsibilityFeatures"], **evidence["responsibilityFeatures"]}
    archive, responsibility = encode_responsibility_artifact(
        {key: value.detach().float().cpu() for key, value in tensors.items()}, identity=expected,
        archive_path=output + "/responsibilities.f32.zlib", schema_bytes=schema,
        schema_sha256=interface["sha256"], candidate_pack_schema_version=json.loads(schema)["candidatePackSchemaVersion"])
    archive_binding = publish(responsibility["tensorArchive"]["path"], archive)
    subject = {**expected, "sampleId": SUBJECT_ID, "split": "validation",
               "conditionPack": identity["conditionPack"], "referenceRgb": row["image"]}
    original = publish(output + "/original-256.png", shared.v24.core.png_bytes(sample["image"]))
    return subject, original, {"archive": archive_binding, "interface": interface, "evidence": responsibility}


def validate_validation_images(images, ids, selected, samples):
    require(type(images) is list and len(images) == len(ids) == len(samples) == 8,
        "fixed eight validation images required")
    require([row.get("sampleId") for row in images] == ids, "validation image order/identity differs")
    for row, sample in zip(images, samples):
        identity = json.loads(sample["_ecology_regime_binding"].identity_json)
        require(row.get("split") == "validation" and row.get("purpose") == "prediction"
            and type(row.get("epoch")) is int and row["epoch"] == 12
            and type(row.get("optimizerStep")) is int and row["optimizerStep"] == 576
            and same_json(row.get("checkpoint"), selected["checkpoint"])
            and same_json(row.get("condition"), identity["conditionPack"])
            and same_json(row.get("originalRgb"), identity["image"]), "validation image source/count binding differs")
        exact_binding(row.get("binding"))
    require(len({row["binding"]["path"] for row in images}) == 8, "validation prediction paths repeat")
    return images


def run(package_binding, terminal_binding, *, root=ROOT):
    started = time.monotonic()  # Includes imports/package checks, not just inference.
    own = own_worker()
    runtime = (*own.runtime(), None)
    torch, profile, shared, _source = runtime
    require(profile.CAPABILITY == "stage4_mvp256_dry_factorized_ecology_v1", "own ecology profile required")
    require(not torch.cuda.is_initialized(), "review must not initialize CUDA")
    torch.set_num_threads(2)
    context = own.load_package(package_binding, root=root)
    reader, plan = context.reader, context.plan
    configuration = plan["configuration"]
    exact_binding(package_binding)
    sources = list(plan["programBindings"].values())
    self_bindings = [item for item in sources if item["path"] == SELF]
    require(len(self_bindings) == 1
            and hashlib.sha256(Path(__file__).read_bytes()).hexdigest() == self_bindings[0]["sha256"],
            "actually loaded review source differs")
    read_bytes(reader, self_bindings[0])
    require(configuration["scope"]["subjectSampleId"] == SUBJECT_ID
            and same_json(plan["configuration"], configuration), "fixed preselected189 configuration differs")
    output = plan["outputRoot"] + "/dry-review"
    path = reader.path(output)
    claim_output(path, {"capabilityVersion": CAPABILITY, "executionPackage": package_binding,
                       "workerTerminal": terminal_binding, "optimizerSteps": 0, "automaticRetries": 0})

    def resource():
        require(time.monotonic() - started < 120 and directory_bytes(path) <= MAX_OUTPUT,
                "review CPU120s/16MiB budget")
        require(torch.get_num_threads() <= 2 and not torch.cuda.is_initialized(), "CPU review thread/CUDA boundary")

    def publish(logical, value, *, failure=False):
        require(logical.startswith(output + "/"), "same review output required")
        raw = value if type(value) is bytes else (json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n").encode()
        require(type(value) is bytes or len(raw) <= 2 * 1024**2, "single JSON byte ceiling")
        require(directory_bytes(path) + len(raw) <= MAX_OUTPUT - (0 if failure else FAILURE_RESERVE),
                "review output/failure reserve ceiling")
        if not failure:
            resource()
        return own.write(root, logical, value, terminal=True) if failure else own.write(root, logical, value)

    try:
        resource()
        terminal = read_json(reader, terminal_binding)
        require(same_json(terminal.get("executionPackage"), package_binding)
                and terminal.get("runId") == plan["runId"]
                and terminal.get("packageId") == plan["packageId"], "review same-package Run differs")
        selected = selected_record(terminal, configuration=configuration)
        verify_current(reader, plan, terminal_binding)
        # Check every eligible source, without loading an unselected model.
        for record in terminal["checkpoints"]:
            resource()
            read_bytes(reader, record["checkpoint"])
        loaded, order = own.load_samples(reader, plan, splits=("validation",))
        require(type(loaded) is dict and set(loaded) == {"validation"}, "validation only review required")
        samples = loaded["validation"]
        ids = [sample["sampleId"] for sample in samples]
        fixed_ids = read_json(reader, plan["validationSplit"])["sampleIds"]
        require(len(ids) == len(set(ids)) == 8 and ids == fixed_ids and SUBJECT_ID in ids
                and all(sample.get("split") == "validation" for sample in samples), "fixed8/preselected189 differs")
        baseline = baseline_review(reader, plan, samples, order, resource, runtime=runtime)
        resource()
        model, critic = profile.fresh_networks(order)
        checkpoint.reload(read_bytes(reader, selected["checkpoint"]), model=model, critic=critic,
            configuration=configuration, run_id=plan["runId"], package_binding=package_binding,
            dataset_binding=plan["datasetManifest"], epoch=selected["epoch"],
            selection=selected["selection"], counts=selected["counts"],
            program_bindings=plan["programBindings"],
            plan_binding=next(b for b in context.package["inputEvidence"] if b["path"] == plan["outputRoot"] + "/quality-plan.json"))
        require(set(model.object_rgb_heads) == set(shared.OBJECT_CHANNELS)
                and all(len(tuple(head.parameters())) == 4 for head in model.object_rgb_heads.values()),
                "sixteen own object head parameters required")
        model.eval()
        before = shared.v24.core.cpu.state_hash(model)
        observations, artifacts, validation_images = [], [], []
        with shared._preserve_rng_and_mode(model), torch.inference_mode():
            for sample in samples:
                resource()
                prediction, evidence = profile.sample_forward(model, sample, return_evidence=True)
                require(tuple(prediction.shape) == (1, 3, 192, 256)
                        and tuple(sample["image"].shape) == (3, 192, 256)
                        and prediction.device.type == "cpu" and bool(torch.isfinite(prediction).all()),
                        "native CPU RGB256x192 required")
                _, corr = shared.original_object_class_spatial_loss(prediction, sample, order, split="validation")
                observations.append(observation(prediction, sample, corr, shared, selected["epoch"]))
                image = publish(output + "/" + str(len(artifacts)) + ".png", shared.v24.core.png_bytes(prediction[0]))
                artifacts.append(image)
                identity = json.loads(sample["_ecology_regime_binding"].identity_json)
                validation_images.append({"sampleId": sample["sampleId"], "split": "validation",
                    "epoch": selected["epoch"], "optimizerStep": selected["counts"]["generator"],
                    "purpose": "prediction", "binding": image, "checkpoint": selected["checkpoint"],
                    "condition": identity["conditionPack"], "originalRgb": identity["image"]})
                if sample["sampleId"] == SUBJECT_ID:
                    subject, original, responsibility = subject_artifacts(
                        reader, plan, sample, evidence, model, order, output, publish, shared=shared)
                    native = image
        selection = ranking.rank_validation_epoch(observations, ids, epoch=selected["epoch"], eligible_epochs=(12,))
        validate_validation_images(validation_images, ids, selected, samples)
        checkpoint.validate_selection(configuration, plan["runId"], selected["epoch"], selection, selected["counts"])
        require(before == shared.v24.core.cpu.state_hash(model)
                and all(p.grad is None for network in (model, critic) for p in network.parameters()), "CPU review changed model/gradients")
        resource()
        verify_current(reader, plan, terminal_binding)
        reader.unchanged()
        return publish(output + "/cpu-review.json", {
            "schema": "ecology-regime-native-review-input-v1", "status": "native_artifacts_ready_machine_audits_pending",
            "capabilityVersion": CAPABILITY, "executionProfile": EXECUTION_PROFILE,
            "executionPackage": package_binding, "workerTerminal": terminal_binding,
            "selectedCheckpoint": selected["checkpoint"], "subject": subject,
            "candidateRgb": native, "originalRgb": original, "responsibility": responsibility,
            "baseline": baseline, "modelForwardCalls": 16,
            "validationImprovedWithoutMeanRgbRegression": selection["meanValidationRgbMae"] <= BASELINE_MAE
                and selection["worstApplicableObjectCorrelation"] > BASELINE_CORRELATION,
            "validation": observations, "selectionCpu": selection, "artifacts": artifacts,
            "validationImages": validation_images,
            "optimizerSteps": 0, "gpuInitialized": False, "automaticRetries": 0,
            "challengeContentRead": False, "regressionContentRead": False,
            "formalStage4QualificationAllowed": False, "runtimePublicationAllowed": False})
    except BaseException as primary:
        failure = {"schema": "ecology-regime-native-review-failure-v1", "status": "failed_closed",
            "capabilityVersion": CAPABILITY, "executionPackage": package_binding, "workerTerminal": terminal_binding,
            "trainingTerminalMutationAllowed": False, "errorType": type(primary).__name__, "error": str(primary)[:4096],
            "optimizerSteps": 0, "automaticRetries": 0,
            "formalStage4QualificationAllowed": False, "runtimePublicationAllowed": False}
        try:
            publish(output + "/cpu-review-failure.json", failure, failure=True)
        except BaseException as secondary:
            try:
                primary.secondary_review_failure_error = str(secondary)[:4096]
            except BaseException:
                pass
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ("package", "sha256", "terminal", "terminal-sha256"):
        parser.add_argument("--" + flag, required=True)
    args = parser.parse_args()
    print(json.dumps(run({"path": args.package, "sha256": args.sha256},
                         {"path": args.terminal, "sha256": args.terminal_sha256})))
