"""Selected snapshot CPU validation and preselected189 native artifacts.

The original machine auditors consume these exact artifacts in the JS review
phase. Measurements or training completion never grant visual/Runtime release.
"""
import argparse
import json
from pathlib import Path
import sys
import time
ROOT = Path(__file__).absolute().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import painter_stage4_detail_weight_managed_worker as worker


def selected_record(terminal):
    _torch, _profile, shared, _source = worker.runtime()
    worker.require(terminal.get("schema") == worker.TERMINAL_SCHEMA and terminal.get("status") == "training_completed_review_pending"
        and terminal.get("capabilityVersion") == worker.CAPABILITY and terminal.get("completedEpochs") == 48
        and terminal.get("optimizerSteps") == {"generator":2304,"discriminator":2304}
        and terminal.get("checkpointReloadVerified") is True and terminal.get("challengeContentRead") is False
        and terminal.get("regressionContentRead") is False and terminal.get("checkpointPromotable") is False, "complete nonpromotable training evidence required")
    records = terminal["checkpoints"]; worker.require([r["epoch"] for r in records] == [24,36,48], "complete eligible checkpoint set required")
    for record in records:
        worker.require(type(record["epoch"]) is int and record["selection"]["epoch"] == record["epoch"] and type(record["counts"]) is dict and set(record["counts"]) == {"generator","discriminator"} and all(type(v) is int for v in record["counts"].values()) and record["counts"] == {"generator":record["epoch"]*48,"discriminator":record["epoch"]*48}, "checkpoint actual counts differ")
        shared._validated_rank(record["selection"])
    selected = max(records, key=lambda r: shared._validated_rank(r["selection"]))
    worker.require(selected == terminal["selectedCheckpointRecord"] and selected["counts"] == {"generator":selected["epoch"]*48,"discriminator":selected["epoch"]*48}, "machine selected checkpoint differs")
    return selected


BASELINE_TERMINAL={"path":".runtime/ai-painter/stage4-mvp256-dry-v24-recovery-v2-executions/mvp256-dry-v24-9056e7f9a7eb9ba8bf8fbf569d05c0be30c12c723ffca0e2/training-finalize.json","sha256":"2f2b7a3ff091f54e511e7bad9ab2a53fabbe2fc626f5bd91e49db7c1ade33a26"}
BASELINE_AUDIT={"path":".runtime/ai-painter/stage4-mvp256-dry-v24-recovery-v2-executions/mvp256-dry-v24-9056e7f9a7eb9ba8bf8fbf569d05c0be30c12c723ffca0e2/dry-review/independent-audit.json","sha256":"c3c4db62221412523349ea57d8e925e13d49039903e6adffd2d4e10ce2556ae8"}


def baseline_review(reader,plan,samples,order,resource):
    torch,_profile,shared,_source=worker.runtime()
    prior=reader.json(BASELINE_TERMINAL); package=reader.json(prior["executionPackage"]); body=reader.json(prior["workerTerminal"])
    worker.require(package["candidateContract"]==plan["sourceCandidate"] and package["datasetManifest"]==plan["datasetManifest"] and package["validationSplit"]==plan["validationSplit"],"V24 comparison data differs")
    records=body["checkpoints"];worker.require([r["epoch"] for r in records]==[24,36,48],"V24 baseline eligible set differs")
    selected=max(records,key=lambda r:shared._validated_rank(r["selection"]))
    audit=reader.json(BASELINE_AUDIT)
    worker.require(body["completedEpochs"]==48 and body["optimizerStepsGenerator"]==body["optimizerStepsDiscriminator"]==2304 and selected==body["selectedCheckpointRecord"] and selected["checkpoint"]==audit["selectedCheckpoint"],"V24 baseline selection differs")
    model,critic,states=shared.reload_checkpoint_exact(reader.read(selected["checkpoint"]),expected_epoch=selected["epoch"],expected_selection=selected["selection"],execution_package=prior["executionPackage"],candidate_contract=package["candidateContract"],channel_order=order)
    worker.require(states==selected["stateSha256"],"V24 reload bytes differ")
    del critic;rows=[];before=shared.v24.core.cpu.state_hash(model)
    with shared._preserve_rng_and_mode(model),torch.inference_mode():
        model.eval()
        for sample in samples:
            resource();prediction=model(sample["conditions"][None],sample["objectInstanceTable"])
            _,corr=shared.original_object_class_spatial_loss(prediction,sample,order,split="validation")
            rows.append({"sampleId":sample["sampleId"],"split":"validation","epoch":selected["epoch"],"fullRgbMae":float((prediction[0]-sample["image"]).abs().mean()),"objectCorrelations":{role:None if corr.get(role) is None else float(corr[role]) for role in shared.OBJECT_CHANNELS}})
    worker.require(before==shared.v24.core.cpu.state_hash(model),"CPU baseline inference changed weights")
    ranked=shared.rank_validation_epoch(rows,[s["sampleId"] for s in samples],epoch=selected["epoch"])
    worker.require(ranked["meanValidationRgbMae"]==0.06140733743086457 and ranked["worstApplicableObjectCorrelation"]==-0.08459185063838959,"original baseline metric differs")
    return {"trainingTerminal":BASELINE_TERMINAL,"audit":BASELINE_AUDIT,"checkpoint":selected["checkpoint"],"selectionCpu":ranked,"rows":rows,"modelForwardCalls":8}


def run(package_binding, terminal_binding, *, root=ROOT):
    torch, profile, shared, source = worker.runtime(); torch.set_num_threads(2)
    reader, _spec, plan, configuration = worker.load_package(package_binding, root=root)
    terminal = reader.json(terminal_binding); selected = selected_record(terminal)
    worker.require(terminal["executionPackage"] == package_binding and terminal["runId"] == plan["runId"]
        and terminal["packageId"] == plan["packageId"], "review same-package Run differs")
    current = json.loads(reader.path(".runtime/ai-painter/current-execution-registry/current.json").read_bytes())
    latest = current.get("latestTrainingTerminal", {})
    worker.require(current.get("activeExecution") is None and latest.get("runId") == plan["runId"]
        and {"path":latest.get("path"),"sha256":latest.get("sha256")} == terminal_binding, "review requires immutable current completed training")
    output = plan["outputRoot"] + "/dry-review"
    worker.require(not reader.path(output).exists() and not torch.cuda.is_initialized(), "review consumed or CUDA initialized")
    reader.path(output).mkdir(); started = time.monotonic()
    def resource():
        worker.require(time.monotonic()-started < 120 and sum(p.stat().st_size for p in reader.path(output).rglob("*") if p.is_file()) <= 16*1024**2, "review CPU120s/16MiB budget")
    try:
        loaded, order = worker.load_samples(reader, plan, splits=("validation",))
        baseline=baseline_review(reader,plan,loaded["validation"],order,resource)
        model, critic = profile.fresh_networks(order)
        raw = reader.read(selected["checkpoint"])
        worker.checkpoint.reload(raw, model=model, critic=critic, configuration=configuration, run_id=plan["runId"], package_binding=package_binding,
            dataset_binding=plan["datasetManifest"], epoch=selected["epoch"], selection=selected["selection"], counts=selected["counts"])
        model.eval(); before=shared.v24.core.cpu.state_hash(model); observations = []; artifacts = []
        ids = [s["sampleId"] for s in loaded["validation"]]
        worker.require(len(ids)==8 and plan["configuration"]["scope"]["subjectSampleId"] in ids, "preselected189 absent")
        from ai_painter.complete_world.stage4_v17_responsibility_artifact import encode_responsibility_artifact
        import materialize_stage4_mvp256_dry_v24_candidate as files
        for sample in loaded["validation"]:
            resource()
            with torch.inference_mode(): prediction,evidence = profile.sample_forward(model,sample,return_evidence=True)
            # Use the original metric calculation on THIS shared forward.
            _,corr = shared.original_object_class_spatial_loss(prediction,sample,order,split="validation")
            observations.append({"sampleId":sample["sampleId"],"split":"validation","epoch":selected["epoch"],
                "fullRgbMae":float((prediction[0]-sample["image"]).abs().mean()),
                "objectCorrelations":{role:None if corr.get(role) is None else float(corr[role]) for role in shared.OBJECT_CHANNELS}})
            image = worker.write(root, output + "/" + str(len(artifacts)) + ".png", shared.v24.core.png_bytes(prediction[0])); artifacts.append(image)
            if sample["sampleId"] == configuration["scope"]["subjectSampleId"]:
                release=reader.json(plan["datasetManifest"]); src=reader.json(release["sourceIndex"])
                row=next(r for r in src["samples"] if r["sampleId"]==sample["sampleId"])
                _decoded, identity=shared.v24.core.cpu.load_sample(reader,row,order,release["identityPayload"]["continuousChannelIds"])
                candidate=reader.json(plan["sourceCandidate"]); scope=reader.json(candidate["frozenBindings"]["dryScope"])["preselectedSubject"]
                expected={"worldId":identity["worldId"],"regionId":scope["regionId"],"tick":identity["tick"],"factHash":identity["factHash"],
                    "visualFactManifestSha256":identity["visualFactManifestContentSha256"],"conditionPackSha256":identity["conditionPack"]["sha256"],
                    "modelStateSha256":shared.v24.core.cpu.state_hash(model)}
                interface={"path":files.INTERFACE,"sha256":files.bind(files.INTERFACE)["sha256"]}; schema=reader.read(interface)
                archive, responsibility=encode_responsibility_artifact({k:v.detach().float().cpu() for k,v in {**evidence["terrainResponsibilityFeatures"],**evidence["responsibilityFeatures"]}.items()},
                    identity=expected, archive_path=output+"/responsibilities.f32.zlib",schema_bytes=schema,schema_sha256=interface["sha256"],candidate_pack_schema_version=json.loads(schema)["candidatePackSchemaVersion"])
                archive_binding=worker.write(root,responsibility["tensorArchive"]["path"],archive)
                subject={**expected,"sampleId":sample["sampleId"],"split":"validation","conditionPack":identity["conditionPack"],"referenceRgb":row["image"]}
                original=worker.write(root,output+"/original-256.png",shared.v24.core.png_bytes(sample["image"])); native=image
        selection=shared.rank_validation_epoch(observations,ids,epoch=selected["epoch"])
        worker.require(before==shared.v24.core.cpu.state_hash(model) and all(p.grad is None for p in model.parameters()), "CPU review changed model")
        resource(); reader.unchanged()
        return worker.write(root,output+"/cpu-review.json",{"schema":"detail-weight-native-review-input-v1","status":"native_artifacts_ready_machine_audits_pending",
            "capabilityVersion":worker.CAPABILITY,"executionPackage":package_binding,"workerTerminal":terminal_binding,"selectedCheckpoint":selected["checkpoint"],
            "subject":subject,"candidateRgb":native,"originalRgb":original,"responsibility":{"archive":archive_binding,"interface":interface,"evidence":responsibility},
            "baseline":baseline,"modelForwardCalls":16,"validationImprovedWithoutMeanRgbRegression":selection["meanValidationRgbMae"]<=0.06140733743086457 and selection["worstApplicableObjectCorrelation"]>-0.08459185063838959,"validation":observations,"selectionCpu":selection,"artifacts":artifacts,"optimizerSteps":0,"gpuInitialized":False,
            "challengeContentRead":False,"regressionContentRead":False,"formalStage4QualificationAllowed":False,"runtimePublicationAllowed":False})
    except BaseException as error:
        worker.write(root,output+"/cpu-review-failure.json",{"status":"failed_closed","error":str(error)[:4096]}); raise


if __name__ == "__main__":
    p=argparse.ArgumentParser(description=__doc__)
    for flag in ("package","sha256","terminal","terminal-sha256"): p.add_argument("--"+flag,required=True)
    a=p.parse_args(); print(json.dumps(run({"path":a.package,"sha256":a.sha256},{"path":a.terminal,"sha256":a.terminal_sha256})))
