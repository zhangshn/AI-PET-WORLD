# TD-TRAIN-ENTRY-01-PY: independent terrain-detail identity, inherited frozen algorithms.
"""Fixed eight-row ecology CPU review; artifacts never grant qualification.

The caller's existing owned CPU process enforces its registered shared deadline.
This adapter checks the same deadline cooperatively, with two CPU threads and
16 MiB of cumulative output. The independent review preserves consumed evidence.
"""
import argparse
import hashlib
import importlib
import json
import os
from pathlib import Path
import stat
import sys
import time

ROOT = Path(__file__).absolute().parents[3]
SELF = "ml/ai-painter/scripts/decode1_entry_weight_quality_review_v1.py"
for directory in (ROOT / "ml/ai-painter/scripts", ROOT / "ml/ai-painter/src"):
    if str(directory) not in sys.path:
        sys.path.insert(0, str(directory))
from ai_painter.complete_world import decode1_entry_weight_quality_checkpoint_v1 as checkpoint
import ecology_quality_ranking_v1 as ranking
import decode1_entry_weight_quality_auth_v1 as auth
from decode1_entry_weight_quality_auth_v1 import decode, exact_binding, require, same_json

CAPABILITY = "stage4_mvp256_dry_decode1_entry_weight_quality24_v1"
EXECUTION_PROFILE = "bounded_decode1_entry_weight_quality24_v1"
TERMINAL_SCHEMA = "object-support-structure-quality-worker-terminal-v1"
SUBJECT_ID = "ai-cold-start-v7-v7-capacity-slot-189-bamboo-grove-v2"
REGISTRY = ".runtime/ai-painter/current-execution-registry/current.json"
MAX_OUTPUT = 16 * 1024**2
FAILURE_RESERVE = 65536
worker = None  # Explicitly injectable in isolation; no predecessor fallback.

BASELINE_TERMINAL = {"path": ".runtime/ai-painter/stage4-mvp256-dry-v24-recovery-v2-executions/mvp256-dry-v24-9056e7f9a7eb9ba8bf8fbf569d05c0be30c12c723ffca0e2/training-finalize.json", "sha256": "2f2b7a3ff091f54e511e7bad9ab2a53fabbe2fc626f5bd91e49db7c1ade33a26"}
BASELINE_AUDIT = {"path": ".runtime/ai-painter/stage4-mvp256-dry-v24-recovery-v2-executions/mvp256-dry-v24-9056e7f9a7eb9ba8bf8fbf569d05c0be30c12c723ffca0e2/dry-review/independent-audit.json", "sha256": "c3c4db62221412523349ea57d8e925e13d49039903e6adffd2d4e10ce2556ae8"}
BASELINE_MAE = 0.06140733743086457
BASELINE_CORRELATION = -0.08459185063838959
HISTORY_ROOT = ".runtime/ai-painter/controller-repair-reviews/training-review-data-identity-20261022"
SUCCESSOR_CASE = ".runtime/ai-painter/controller-repair-reviews/training-review-transport-successor-002-20261022"
INDEPENDENT_CASE = auth._INDEPENDENT_CASE
RECOVERY_SCHEMA = "completed-training-independent-review-v1"
CURRENT_SPECIFICATION = {"path":"docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
    "sha256":"89a0d3f9f1a67390eeb5c71ac85491a2ad5ce4974803f87c7466c1319f00c167"}
CURRENT_REVIEW_SPECIFICATION = {"path":"docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md",
    "sha256":"4b4e4d083024e9944474dc3df3db97ae782910064661cd74fb8cdca94ddbe6e5"}


def own_worker():
    value = worker if worker is not None else importlib.import_module(
        "painter_stage4_decode1_entry_weight_quality_worker_v1")
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
    route=auth.execution_route(configuration.get("capabilityVersion",CAPABILITY))
    codec=auth.checkpoint_components(route.capability)
    own = own_worker()
    _torch, _profile, shared = own.runtime() if route.capability == CAPABILITY else own.runtime(route.capability)
    require(type(terminal) is dict and terminal.get("schema") == TERMINAL_SCHEMA
            and terminal.get("status") == "training_completed_review_pending"
            and terminal.get("executionState") == "completed"
            and terminal.get("executionProfile") == route.profile
            and terminal.get("capabilityVersion") == route.capability
            and type(terminal.get("completedEpochs")) is int and terminal["completedEpochs"] == 24
            and same_json(terminal.get("optimizerSteps"), {"generator": 1152, "discriminator": 1152})
            and type(terminal.get("optimizerStepsGenerator")) is int and terminal["optimizerStepsGenerator"] == 1152
            and type(terminal.get("optimizerStepsDiscriminator")) is int and terminal["optimizerStepsDiscriminator"] == 1152
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
            and [r.get("epoch") if type(r) is dict else None for r in records] == [24],
            "complete eligible checkpoint set required")
    for record in records:
        exact_binding(record.get("checkpoint"))
        codec.validate_selection(configuration, terminal.get("runId"), record.get("epoch"),
                                      record.get("selection"), record.get("counts"))
    require(len({r["checkpoint"]["path"] for r in records}) == 1,
            "distinct eligible checkpoint sources required")
    selected = max(records, key=lambda row: ranking._validated_rank(row["selection"], eligible_epochs=(24,)))
    require(same_json(selected, terminal.get("selectedCheckpointRecord")),
            "machine selected checkpoint differs")
    return selected


def verify_current(reader, plan, terminal_binding, recovery=None):
    current = decode(reader.snapshot(REGISTRY)[0])
    require(type(current) is dict and current.get("schemaVersion") == "ai-painter-current-execution-registry-v1"
            and type(current.get("registryRevision")) is int and current["registryRevision"] > 0,
            "current execution registry missing or stale")
    latest = current.get("latestTrainingTerminal")
    require(type(latest) is dict and latest.get("runId") == plan["runId"]
            and same_json({"path": latest.get("path"), "sha256": latest.get("sha256")}, terminal_binding),
            "review requires immutable current completed training")
    if recovery is None:
        require(current.get("activeExecution", "missing") is None, "review requires no active training")
    else:
        active=current.get("activeExecution")
        require(type(active) is dict and current.get("taskId")==recovery["taskId"]
            and current.get("activity")=="cpu_review_recovery_running"
            and active.get("programLineage")==recovery["programBindings"]
            and active.get("processId")==recovery["processId"]
            and active.get("processStartIdentity")==recovery["processStartIdentity"]
            and auth.process_identity(active["processId"])==active["processStartIdentity"],
            "same-call recovery active identity required")
        lock=read_json(reader,active["lock"])
        require(lock.get("processId")==active["processId"] and lock.get("processStartIdentity")==active["processStartIdentity"]
            and active["lock"]["path"]==recovery["outputRoot"]+"/execution-lock.json", "recovery lock differs")
        heart_path=INDEPENDENT_CASE+"/control-heartbeat/"+recovery["recoveryId"]+"/heartbeat.json"
        require(active.get("heartbeat")=={"path":heart_path,"ttlSeconds":120},"independent heartbeat path/TTL differs")
        identity={k:recovery[k] for k in ("runId","packageId","capabilityVersion","processId","processStartIdentity")}
        auth._snapshot_heartbeat(reader,heart_path,recovery,identity,review_history=reader._review_history)


def recovery_context(package_binding, terminal_binding, recovery_binding, root):
    """Historical bytes authenticate the old run; live bytes authenticate this call."""
    live=auth.Reader(root)
    recovery=read_json(live,recovery_binding)
    output=recovery.get("outputRoot","")
    require(auth.independent_plan_path(recovery_binding["path"])
        and recovery_binding["path"]==output+"/plan.json"
        and recovery.get("schema")==RECOVERY_SCHEMA
        and output==INDEPENDENT_CASE+"/review-"+recovery.get("recoveryId","")
        and recovery.get("sourceExecutionPackage")==package_binding
        and recovery.get("sourceWorkerTerminal")==terminal_binding
        and recovery.get("specification")==CURRENT_SPECIFICATION
        and recovery.get("reviewSpecification")==CURRENT_REVIEW_SPECIFICATION,
        "registered immutable recovery identity required")
    for b in (CURRENT_SPECIFICATION,CURRENT_REVIEW_SPECIFICATION):read_bytes(live,b)
    original=read_json(live,recovery["sourceTrainingPlan"])
    require(original["capabilityVersion"]=="stage4_mvp256_dry_decode1_registered_source_v1"
        and original["runId"]=="d1-src-v1-850c25f8-8181-446e-99da-3dae2dbb21a8"
        and recovery.get("limits")==auth.INDEPENDENT_LIMITS
        and recovery.get("independentPolicy")==auth.INDEPENDENT_POLICY
        and recovery.get("priorAccounting")==auth.PRIOR_ACCOUNTING
        and recovery.get("gpuAllowed") is False and recovery.get("runtimePublicationAllowed") is False,
        "exact source-correction recovery limits required")
    programs=recovery["programBindings"]
    require(set(programs)==set(original["programBindings"]),"recovery source roles differ")
    mutable={"reviewWorker","reviewDriver","nativeRunner","executionAuth"}
    for role,b in programs.items():
        old=original["programBindings"][role]
        require(b["path"]==old["path"] and (role in mutable or b==old),"protected numerical/data source changed: "+role)
        read_bytes(live,b)
    require(programs["reviewWorker"]["path"]==SELF
        and hashlib.sha256(Path(__file__).read_bytes()).hexdigest()==programs["reviewWorker"]["sha256"],
        "actual recovery review module differs")
    acceptance=read_json(live,recovery["cpuAcceptance"])
    require(acceptance.get("status")=="passed" and acceptance.get("failed")==0
        and acceptance.get("skipped")==0 and acceptance.get("modelForwards")==0
        and acceptance.get("programBindings")==programs,"current recovery CPU acceptance required")
    for b in acceptance["testEvidence"]:read_bytes(live,b)
    index=read_json(live,recovery["sourcePreservation"])
    require(index["sourcePackage"]==package_binding and index["sourcePlan"]==recovery["sourceTrainingPlan"],
        "historical preservation source differs")
    aliases={}
    require(len(index["entries"])==len(original["programBindings"]),"historical source count differs")
    for item in index["entries"]:
        old=original["programBindings"][item["role"]]
        require(item["originalPath"]==old["path"] and item["sha256"]==old["sha256"]
            and item["snapshotPath"].startswith(HISTORY_ROOT+"/source-baselines/"),
            "historical source mapping differs")
        key=(old["path"],old["sha256"])
        require(key not in aliases,"duplicate historical source")
        aliases[key]={"path":item["snapshotPath"],"sha256":old["sha256"]}
    normative=[(CURRENT_SPECIFICATION["path"],"385d9a2a788ca016545ea2b620c45a4ff05c28cd1dfb48bba5378395b9f7e8c3","ai-painter-spec-1.108-385d9a2a.txt"),
        (CURRENT_REVIEW_SPECIFICATION["path"],"48d9b177df5936bdd3898e6743f703a97a2f5f490ec0ba22d748601aa1493909","review-storage-1.25-48d9b177.txt")]
    for logical,digest,name in normative:
        aliases[(logical,digest)]={"path":"data/ai-painter/system-governance/document-baselines/"+name,"sha256":digest}
    for b in aliases.values():read_bytes(live,b)
    history=auth.verified_review_history(root,recovery_binding)
    reader=auth.Reader(root,review_history=history)
    context=auth.load_execution_package(reader,package_binding)
    own=own_worker()
    own.verify_final_cpu(reader,context.plan)
    own.verify_loaded_sources(live,{**context.plan,"programBindings":programs})
    require(context.plan==original,"historical training plan differs")
    claim_path=live.path(output+"/consumed.json")
    regular(claim_path)
    claim=decode(claim_path.read_bytes())
    require(claim.get("plan")==recovery_binding and claim.get("attempt")==1 and claim.get("automaticRetries")==0,
        "same one-shot recovery consumption required")
    admission_path=live.path(INDEPENDENT_CASE+"/admission/independent-consumed.json")
    regular(admission_path)
    require(decode(admission_path.read_bytes())==claim,"cross-directory successor already consumed or differs")
    prior=read_json(live,recovery["priorReviewReceipt"])
    require(prior.get("phase")=="review" and prior.get("cleanupConfirmed") is True
        and prior.get("ownerClosed") is True and prior["proof"]["activeProcessesAfterCleanup"]==0
        and prior["budget"]["timeoutMs"]==120000 and prior["budget"]["outputBytes"]==MAX_OUTPUT
        and prior["elapsedMs"]==57148,"original review budget/cleanup evidence differs")
    require(recovery["processStartIdentity"]==auth.process_identity(recovery["processId"]),"recovery process creation differs")
    from datetime import datetime
    creation=datetime.fromisoformat(recovery["processStartIdentity"].split(":",1)[1]).timestamp()*1000
    require(abs(creation-recovery["startedAtUnixMs"])<1,"budget must start at actual process creation")
    guard=decode(live.path(".runtime/ai-painter/owned-worker-guards/active.json").read_bytes())
    require(guard.get("runnerPid")==recovery["processId"]
        and guard.get("helperSha256")==programs["nativeRunner"]["sha256"],"live native recovery guard differs")
    ledger=auth.independent_budget(live)
    require(recovery["priorAccountingRoots"]==ledger["roots"],"prior cumulative accounting roots differ")
    recovery["deadlineUnixMs"]=recovery["startedAtUnixMs"]+ledger["timeoutMs"]
    recovery["workDeadlineUnixMs"]=recovery["deadlineUnixMs"]-ledger["terminalReserveMs"]
    recovery["priorByteDebit"]=ledger["priorByteDebit"]
    recovery["controlReserveBytes"]=ledger["controlReserveBytes"]
    recovery["accountingRoots"]=json.loads(os.environ["DETAIL_WEIGHT_OUTPUT_ROOTS"])
    native_root=".runtime/ai-painter/owned-worker-guards/"+str(__import__("uuid").UUID(hashlib.sha256((output+"/dry-review-owned").encode()).hexdigest()[:32]))
    require(set(recovery["accountingRoots"])==set([output,native_root]+ledger["roots"]),
        "cumulative recovery accounting roots differ")
    live.unchanged();reader.unchanged()
    return context,recovery


def baseline_comparison_identity(reader, plan, package):
    """15.5.1: exact legacy identity, or the verified published direct parent."""
    names=(("candidateContract","sourceCandidate"),("datasetManifest","datasetManifest"),("validationSplit","validationSplit"))
    if all(package[a]==plan[b] for a,b in names):
        return {"mode":"exact_original_bindings","qualificationGranted":False}
    capability=plan.get("capabilityVersion")
    require(capability in ("stage4_mvp256_dry_decode1_registered_source_v1",
        "stage4_mvp256_dry_decode1_support_structure_weight1_v1", "stage4_mvp256_dry_decode2_support_structure_weight1_v1", "stage4_mvp256_dry_decode2_rgb_output_support_structure_weight1_v1", checkpoint.QUALIFICATION_CAPTURE_CAPABILITY, *checkpoint.TRAINING_CAPTURE_CAPABILITIES),
        "V24 comparison data differs: unregistered corrected-source route")
    current=auth.Reader(reader.root)
    specification=CURRENT_SPECIFICATION
    if capability in ("stage4_mvp256_dry_decode1_support_structure_weight1_v1", "stage4_mvp256_dry_decode2_support_structure_weight1_v1", "stage4_mvp256_dry_decode2_rgb_output_support_structure_weight1_v1", checkpoint.QUALIFICATION_CAPTURE_CAPABILITY, *checkpoint.TRAINING_CAPTURE_CAPABILITIES):
        route=auth.execution_route(capability)
        policy=read_json(current,route.execution_policy)
        require(type(policy.get("objectSupportStructureWeight")) is int
            and policy["objectSupportStructureWeight"]==1
            and policy.get("modelCapability")==auth.execution_route(plan["capabilityVersion"]).model_capability
            and policy.get("sourceCandidate")==plan["sourceCandidate"]
            and type(plan.get("configuration",{}).get("objectSupportStructureWeight")) is int
            and plan["configuration"]["objectSupportStructureWeight"]==1,
            "registered same-model support weight1 comparison required")
        specification=route.specification
        require(plan.get("formalSpecification")==specification and b"15.6" in read_bytes(current,specification),
            "registered support weight1 specification differs")
    require(b"15.5.1" in read_bytes(current,specification)
        and b"11.12" in read_bytes(current,CURRENT_REVIEW_SPECIFICATION),"current comparison/recovery contract required")
    policy=read_json(reader,plan["executionPolicy"])
    require(policy.get("sourceCandidate")==plan["sourceCandidate"],"comparison candidate is not registered")
    candidate=read_json(reader,plan["sourceCandidate"])
    require(candidate.get("parentCandidate")==package["candidateContract"],"baseline candidate is not the direct parent")
    frozen=candidate["frozenBindings"]
    require(frozen["datasetManifest"]==plan["datasetManifest"] and frozen["validationSplit"]==plan["validationSplit"],
        "comparison plan/candidate data differs")
    manifest=read_json(reader,plan["datasetManifest"])
    require(manifest.get("schemaVersion")=="ai-painter-stage4-source-correction-release-v1",
        "published source correction required")
    payload=manifest["identityPayload"]
    require(payload["parentDatasetRelease"]==package["datasetManifest"],"baseline dataset is not the direct parent")
    class BoundMetadata:
        def read(self,b):
            value=read_bytes(reader,{"path":b["path"],"sha256":b["sha256"]})
            if "bytes" in b:require(type(b["bytes"]) is int and b["bytes"]==len(value),"publication binding byte count differs")
            return value
        def json(self,b):return decode(self.read(b))
    diagnostic=auth.reproduce_diagnostic(BoundMetadata(),frozen["trainingDiagnostic"])
    require(diagnostic["datasetManifest"]==plan["datasetManifest"],"comparison diagnostic dataset differs")
    parent_diagnostic=read_json(reader,diagnostic["derivation"]["parentDiagnostic"])
    parent=read_json(reader,payload["parentDatasetRelease"])
    parent_candidate=read_json(reader,candidate["parentCandidate"])
    require(parent_candidate["frozenBindings"]["datasetManifest"]==payload["parentDatasetRelease"],
        "parent candidate/dataset binding differs")
    old_rows=read_json(reader,parent["sourceIndex"])["samples"]
    new_rows=read_json(reader,manifest["sourceIndex"])["samples"]
    require(len(old_rows)==len(new_rows)==64,"comparison source capacity differs")
    old_ids=read_json(reader,package["validationSplit"])["sampleIds"]
    ids=read_json(reader,plan["validationSplit"])["sampleIds"]
    require(ids==old_ids and len(ids)==len(set(ids))==8,"comparison validation membership/order changed")
    old_by_id={r["sampleId"]:r for r in old_rows};new_by_id={r["sampleId"]:r for r in new_rows}
    diagnostic_by_id={r["sampleId"]:r for r in diagnostic["rows"]}
    parent_diagnostic_by_id={r["sampleId"]:r for r in parent_diagnostic["rows"]}
    def bindings(value):
        if type(value) is dict:
            if type(value.get("path")) is str and type(value.get("sha256")) is str:
                read_bytes(reader,{"path":value["path"],"sha256":value["sha256"]})
            for item in value.values():bindings(item)
        elif type(value) is list:
            for item in value:bindings(item)
    proof=[]
    for sid in ids:
        row=new_by_id[sid];identity=diagnostic_by_id[sid]["identity"]
        require(row==old_by_id[sid] and row["split"]=="validation"
            and diagnostic_by_id[sid]==parent_diagnostic_by_id[sid],"comparison validation row changed")
        require(identity["image"]==row["image"] and identity["conditionPack"]==row["conditionPack"]
            and [r["id"] for r in identity["channels"]]==payload["channelOrder"],"comparison validation identity/channels differ")
        bindings(row);bindings(identity)
        condition=read_json(reader,identity["conditionPack"]);bindings(condition)
        task=read_json(reader,identity["taskPackage"])
        facts={"path":task["sourceBindings"]["naturalizedWorldFactsPath"],
            "sha256":task["sourceBindings"]["naturalizedWorldFactsSha256"]}
        read_bytes(reader,facts)
        require(identity["factHash"]==facts["sha256"],"comparison WorldFacts changed")
        proof.append({"sampleId":sid,"sourceRowSha256":hashlib.sha256(auth.canonical(row)).hexdigest(),
            "identitySha256":hashlib.sha256(auth.canonical(identity)).hexdigest(),"image":row["image"],
            "conditionPack":row["conditionPack"],"worldFacts":facts,
            "channelsSha256":hashlib.sha256(auth.canonical(condition["channels"])).hexdigest(),
            "objectTableSha256":hashlib.sha256(auth.canonical(condition["objectInstanceTable"])).hexdigest()})
    return {"mode":"published_train_correction_direct_parent_same_validation_v1",
        "candidate":plan["sourceCandidate"],"datasetManifest":plan["datasetManifest"],
        "parentCandidate":package["candidateContract"],"parentDatasetManifest":package["datasetManifest"],
        "validationSplit":plan["validationSplit"],"parentValidationSplit":package["validationSplit"],
        "validation":proof,"qualificationGranted":False}


def baseline_review(reader, plan, samples, order, resource, *, runtime):
    """Original V24 baseline algorithm, explicitly supplied pure dependencies."""
    torch, _profile, shared, _source = runtime
    prior = read_json(reader, BASELINE_TERMINAL)
    package = read_json(reader, prior["executionPackage"])
    body = read_json(reader, prior["workerTerminal"])
    comparison=baseline_comparison_identity(reader,plan,package)
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
            "checkpoint": selected["checkpoint"], "selectionCpu": ranked, "rows": rows, "modelForwardCalls": 8,
            "inputComparison":comparison}


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
            and type(row.get("epoch")) is int and row["epoch"] == 24
            and type(row.get("optimizerStep")) is int and row["optimizerStep"] == 1152
            and same_json(row.get("checkpoint"), selected["checkpoint"])
            and same_json(row.get("condition"), identity["conditionPack"])
            and same_json(row.get("originalRgb"), identity["image"]), "validation image source/count binding differs")
        exact_binding(row.get("binding"))
    require(len({row["binding"]["path"] for row in images}) == 8, "validation prediction paths repeat")
    return images


def run(package_binding, terminal_binding, *, root=ROOT, recovery_binding=None):
    started = time.monotonic()  # Includes imports/package checks, not just inference.
    own = own_worker()
    runtime = (*own.runtime(), None)
    torch, profile, shared, _source = runtime
    require(not torch.cuda.is_initialized(), "review must not initialize CUDA")
    own.configure_cpu()
    recovery=None
    if recovery_binding is None:context=own.load_package(package_binding,root=root)
    else:context,recovery=recovery_context(package_binding,terminal_binding,recovery_binding,root)
    reader, plan = context.reader, context.plan
    route=auth.execution_route(plan["capabilityVersion"])
    if route.capability != CAPABILITY:
        runtime=(*own.runtime(route.capability),None)
        torch,profile,shared,_source=runtime
    codec=auth.checkpoint_components(route.capability)
    require(profile.CAPABILITY == auth.CAPABILITY and profile.MODEL_CAPABILITY == auth.MODEL_CAPABILITY,"own frozen runtime profile differs")
    configuration = plan["configuration"]
    exact_binding(package_binding)
    sources = list((recovery["programBindings"] if recovery else plan["programBindings"]).values())
    self_bindings = [item for item in sources if item["path"] == SELF]
    require(len(self_bindings) == 1
            and hashlib.sha256(Path(__file__).read_bytes()).hexdigest() == self_bindings[0]["sha256"],
            "actually loaded review source differs")
    read_bytes(auth.Reader(root) if recovery else reader, self_bindings[0])
    require(configuration["scope"]["subjectSampleId"] == SUBJECT_ID
            and same_json(plan["configuration"], configuration), "fixed preselected189 configuration differs")
    output = (recovery["outputRoot"] if recovery else plan["outputRoot"]) + "/dry-review"
    path = reader.path(output)
    claim_output(path, {"capabilityVersion": route.capability, "executionPackage": package_binding,
                       "workerTerminal": terminal_binding, "optimizerSteps": 0, "automaticRetries": 0})

    def output_usage():
        if recovery is None:return directory_bytes(path),MAX_OUTPUT
        ledger=auth.independent_budget(auth.Reader(root))
        require(ledger["priorByteDebit"]==recovery["priorByteDebit"] and ledger["priorWallMs"]==119634,
            "independent prior evidence changed")
        owned=sum(directory_bytes(reader.path(p)) for p in recovery["accountingRoots"])
        used=owned+ledger["priorByteDebit"]+ledger["controlReserveBytes"]
        ceiling=min(MAX_OUTPUT,int(os.environ["DETAIL_WEIGHT_OUTPUT_MAX"])+ledger["priorByteDebit"]+ledger["controlReserveBytes"])
        return used,ceiling

    def resource():
        elapsed_ok=time.time()*1000<recovery["workDeadlineUnixMs"] if recovery else time.monotonic()-started<120
        used,ceiling=output_usage()
        require(elapsed_ok and used <= ceiling,
                "review shared work deadline/cumulative 16MiB budget")
        require(torch.get_num_threads() <= 2 and not torch.cuda.is_initialized(), "CPU review thread/CUDA boundary")

    def publish(logical, value, *, failure=False):
        require(logical.startswith(output + "/"), "same review output required")
        raw = value if type(value) is bytes else (json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n").encode()
        require(type(value) is bytes or len(raw) <= 2 * 1024**2, "single JSON byte ceiling")
        used,ceiling=output_usage()
        require(used + len(raw) <= ceiling - (0 if failure else FAILURE_RESERVE),
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
        verify_current(reader, plan, terminal_binding, recovery)
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
        model, critic = profile.fresh_networks(order, **auth.model_arguments(route.capability))
        codec.reload(read_bytes(reader, selected["checkpoint"]), model=model, critic=critic,
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
        selection = ranking.rank_validation_epoch(observations, ids, epoch=selected["epoch"], eligible_epochs=(24,))
        validate_validation_images(validation_images, ids, selected, samples)
        codec.validate_selection(configuration, plan["runId"], selected["epoch"], selection, selected["counts"])
        require(before == shared.v24.core.cpu.state_hash(model)
                and all(p.grad is None for network in (model, critic) for p in network.parameters()), "CPU review changed model/gradients")
        resource()
        verify_current(reader, plan, terminal_binding, recovery)
        reader.unchanged()
        return publish(output + "/cpu-review.json", {
            "schema": "object-support-structure-quality-native-review-input-v1", "status": "native_artifacts_ready_machine_audits_pending",
            "capabilityVersion": route.capability, "executionProfile": route.profile,
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
        failure = {"schema": "object-support-structure-quality-native-review-failure-v1", "status": "failed_closed",
            "capabilityVersion": route.capability, "executionPackage": package_binding, "workerTerminal": terminal_binding,
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
    parser.add_argument("--recovery-plan")
    parser.add_argument("--recovery-sha256")
    args = parser.parse_args()
    print(json.dumps(run({"path": args.package, "sha256": args.sha256},
                         {"path": args.terminal, "sha256": args.terminal_sha256},
                         recovery_binding={"path":args.recovery_plan,"sha256":args.recovery_sha256} if args.recovery_plan else None)))
