"""Prepare the fixed terrain/ecology Stage0 inputs, or run their registered zero-update gate inside an owned Job."""
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
REVIEWS = ".runtime/ai-painter/controller-repair-reviews/"
CASE = REVIEWS + "native-stage0-source-gate-219-20261103"
RUN = ROOT / CASE / "execution"
FORMAL = "data/ai-painter/system-governance/ai-painter-native-stage0-train-gate-v1.json"
MODEL = "terrain_ecology_native_recomputed_stage_v1"
CANDIDATE = "native-stage0-train48-zero-update-v1"
GPU = "GPU-48ef1a4c-5905-0ab2-bc2d-1f8ea9b1bbcd"
R113 = {"path": REVIEWS+"native-recomputed-gpu-113-20261028/implementation/stage0/result.json",
        "sha256": "c0b31658be544b8641ec9e8d725a5c9575e2ea85b92977ac24df85530542100c"}
R217 = {"path": REVIEWS+"formal-stage0-eligibility-217-20261103/source-evaluation.json",
        "sha256": "267937a2acf3701bd4211a9ed4d91007d4324e1f1d4d76200660d9ba1cc7ebf6"}
R205 = {"path": REVIEWS+"native-required-gradient-memory-205-20261103/delivery.json",
        "sha256": "b1d97e17cd1500672734aea9b6dba854be2d9ae0b2b66ceffe375e50ae3b6d5f"}
FIRST = "ai-cold-start-v7-v7-capacity-slot-157-grassland-forest-transition-v2"
ANCHOR = "ai-cold-start-v7-v7-capacity-slot-149-tropical-forest-glade-v3"
TECH = REVIEWS+"native-p86-telemetry-196-20261103"
sys.path[:0] = [str(ROOT/"ml/ai-painter/scripts"),str(ROOT/"ml/ai-painter/src"),str(ROOT/"ml/ai-painter/.venv/Lib/site-packages")]


def require(ok, reason):
    if not ok:
        raise ValueError("native_stage0_" + reason)


def raw_sha(data):
    return hashlib.sha256(data).hexdigest()


def stable(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def record(path, value):
    with path.open("xb") as f:
        f.write(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False).encode()+b"\n")
        f.flush()
        os.fsync(f.fileno())


def fixed_order(ids):
    require(len(ids)==48 and len(set(ids))==48 and FIRST in ids and ANCHOR in ids, "train_membership")
    return [FIRST]+[x for x in ids if x!=FIRST]


def source(reader):
    audit=reader.json(R217);plan=reader.json(audit["plan"]);manifest=reader.json(plan["datasetManifest"])
    require(plan["datasetManifest"]==audit["manifest"] and manifest["sourceIndex"]==audit["index"], "wrong_manifest")
    train=reader.json(plan["trainSplit"])
    require(train["split"]=="train" and plan["trainSplit"]==manifest["splits"]["train"]==audit["splits"]["train"],"wrong_training_split")
    ids=train["sampleIds"]; order=fixed_order(ids);index=reader.json(manifest["sourceIndex"])
    rows={r["sampleId"]:r for r in index["samples"] if r["split"]=="train"}
    require(ids==[row["sampleId"] for row in index["samples"] if row["split"]=="train"]==audit["memberships"]["train"],"train_order_drift")
    expected={r["sampleId"]:r for r in audit["loaded"] if r["split"]=="train" and r["okay"]}
    require(set(expected)==set(rows)==set(ids),"train_bindings")
    return manifest,rows,expected,order,plan


def decode(reader, row, expected, channels, continuous):
    import check_stage4_mvp_structured_object_v18_cpu_acceptance as cpu
    import decode1_entry_weight_quality_auth_v1 as auth
    from painter_stage4_appearance_regime_probe import derive_regime_record
    import painter_stage4_decode1_entry_weight_training_profile_v1 as original
    from ai_painter.complete_world.native_stage_geometry_v1 import NativeStageGeometry
    require(row["split"]=="train" and expected["split"]=="train" and expected["sampleId"]==row["sampleId"],"wrong_split_or_identity")
    if "sourceCorrection" in row:
        correction=reader.json(row["sourceCorrection"]);parent=reader.json(correction["parentDataset"])
        previous=next(x for x in reader.json(parent["sourceIndex"])["samples"] if x["sampleId"]==row["parentSampleId"])
        require(previous["split"]=="train" and row["sampleId"]=="mvp64-slot164-objects-v5-20261020","unauthenticated_correction")
        _,identity=cpu.load_sample(reader,previous,channels,continuous)
        identity.update(sampleId=row["sampleId"],image=row["image"])
        sample,identity=auth.load_corrected_sample(reader,row,channels,continuous,identity,cpu)
    else:
        sample,identity=cpu.load_sample(reader,row,channels,continuous)
    regime,_,_=derive_regime_record(reader,identity)
    sample=original.bind_sample_ecology(reader,sample,identity,regime);original.validate_sample_ecology(sample)
    require(identity["image"]==expected["image"] and identity["conditionPack"]==expected["conditions"] and
            identity["worldId"]==expected["worldId"] and len(sample["objectInstanceTable"])==expected["instances"],"bound_source_changed")
    require(tuple(sample["conditions"].shape)==(23,192,256) and tuple(sample["image"].shape)==(3,192,256),"stage0_geometry")
    sample["native_stage_geometry"]=NativeStageGeometry(0)
    return sample,identity


def sample_facts(sample):
    fields=("image","conditions","appearance_regime","ecology_regime")
    return {**{k:raw_sha(sample[k].detach().cpu().contiguous().numpy().tobytes()) for k in fields},
            "instanceTableSha256":raw_sha(json.dumps(sample["objectInstanceTable"],sort_keys=True).encode())}


def fresh_networks(channels,previous):
    from ai_painter.complete_world.native_stage_geometry_v1 import NativeStageGeometry
    from ai_painter.complete_world import terrain_ecology_native_recomputed_stage_v1 as family
    import painter_stage4_rock_background_training_profile_v1 as normal
    require(previous["nativeCapability"]==MODEL and previous["stage"]==0 and previous["seed"]==20260929 and
            previous["checkpointLoads"]==previous["optimizerSteps"]==0, "wrong_model_or_origin")
    model,critic=normal.fresh_networks(channels,model_capability=MODEL,geometry=NativeStageGeometry(0))
    model.train();critic.eval().requires_grad_(False)
    family.validate_model_identity(model)
    delivery=read(check_ref(R205))
    current=read(check_ref(next(v for v in delivery["evidence"] if v["path"].endswith("/stage2/result.json"))))
    require(current["numericRule"]==family.NUMERIC_RULE and current["nativeCapability"]==MODEL and
            current["seed"]==20260929 and previous["numericRule"]!=current["numericRule"],"wrong_current_numeric_rule")
    def identity_hash(kind,stage):
        geometry=NativeStageGeometry(stage)
        parts=[kind,MODEL,family.ARCHITECTURE,current["numericRule"],repr(geometry.identity()),*family.parent.SEASONS,*family.parent.ECOLOGIES]
        return raw_sha(hashlib.sha256("|".join(parts).encode()).digest())
    flags={}
    for role,net in (("model",model),("critic",critic)):
        state=net.state_dict();history=previous["initialState"][role]
        signed=[{"name":n,"dtype":str(v.dtype),"shape":list(v.shape),"sha256":raw_sha(v.detach().cpu().contiguous().numpy().tobytes())} for n,v in state.items()]
        reference=[{k:t[k] for k in ("name","dtype","shape","sha256")} for t in history["tensors"]]
        other={v["name"]:v for v in current["initialState"][role]["tensors"]}
        special=dict(family.IDENTITIES) if role=="model" else {}
        for row in reference:
            key=row["name"]
            if key in special:
                kind=special[key];require(other[key]["sha256"]==identity_hash(kind,2),"205_geometry_identity")
                row["sha256"]=identity_hash(kind,0)
            else:require(other[key]["sha256"]==row["sha256"],"113_205_parameter_mismatch")
        require(signed==reference,"fresh_"+role+"_identity")
        require(history["modes"]==[{"name":n,"training":m.training} for n,m in net.named_modules()] and
                history["requiresGrad"]==[p.requires_grad for p in net.parameters()],"fresh_"+role+"_modes")
        flags[role]={"stateTensors":len(signed),"parameterTensors":len(list(net.parameters())),"sha256":raw_sha(stable(signed))}
    return model,critic,flags


def program_refs():
    base=ROOT/"ml/ai-painter"
    names={Path(__file__).resolve(),ROOT/CASE/"launch.mjs",ROOT/TECH/"safety.py",ROOT/TECH/"telemetry.py",ROOT/TECH/"operands.py",
           ROOT/"scripts/lib/ai-painter-owned-worker-v1.mjs",ROOT/"scripts/lib/ai-painter-owned-worker-native-v1.mjs",
           ROOT/"scripts/windows/ai-painter-owned-worker-owner.cs"}
    for module in list(sys.modules.values()):
        value=getattr(module,"__file__",None)
        if not value:continue
        file=Path(value).resolve()
        if file.is_relative_to(base/"scripts") or file.is_relative_to(base/"src"):names.add(file)
    return [{"path":v.relative_to(ROOT).as_posix(),"sha256":raw_sha(v.read_bytes())} for v in sorted(names)]


def prepare():
    import torch
    import check_stage4_mvp_structured_object_v18_cpu_acceptance as cpu
    from datetime import datetime, timezone
    torch.set_num_threads(2);require(not torch.cuda.is_initialized(),"prepare_on_cpu")
    reader=cpu.BoundReader(ROOT);source113=reader.json(R113)
    m,rows,expected,order,plan=source(reader);channels=m["identityPayload"]["channelOrder"];cont=m["identityPayload"]["continuousChannelIds"]
    require(len(channels)==len(set(channels))==23,"channels")
    _,_,states=fresh_networks(channels,source113);samples=[]
    for sid in order:
        obj,identity=decode(reader,rows[sid],expected[sid],channels,cont)
        samples.append({"id":sid,"image":identity["image"],"pack":identity["conditionPack"],"input":sample_facts(obj)})
    reference=next(s for s in samples if s["id"]==ANCHOR)["input"]
    for k,v in source113["initialState"]["input"].items():require(reference[k]==(v["sha256"] if isinstance(v,dict) else v),"149_input")
    require(not torch.cuda.is_initialized(),"unexpected_cuda")
    reader.unchanged()
    return {"schemaVersion":CANDIDATE,"modelCapability":MODEL,"stage":0,"geometry":[256,192],"seed":20260929,"fresh":True,
            "parentCheckpoint":None,"source205InheritedGate":False,"numericLineage205":R205,"previousTechnicalCase":R113,"sourceEvaluation":R217,
            "manifest":plan["datasetManifest"],"trainMembership":plan["trainSplit"],"historicalTrainOrder":list(rows),
            "gateOrder":order,"inputs":samples,"channels":channels,"state":states,"sourceBindings":program_refs(),
            "sourceFilesRead":len(reader.observed),"modelForwards":0,"optimizerUpdates":0}


def numerical_gate(model,critic,sample,order,guard,failure):
    import painter_stage4_rock_background_training_profile_v1 as profile
    # The existing zero-update probe owns the original five gradient gates, head coverage,
    # physical recomputation counters, state/gradients/modes and CPU/CUDA RNG restoration.
    require(model.capability_version==MODEL and tuple(model.native_stage_geometry.identity())[:3]==(0,256,192),"native_stage0_model")
    return profile.zero_update_probe(model,critic,sample,order,guard,failure_evidence=failure,support_structure_weight=.1)


LIMITS={"cpuCores":2,"maximumConcurrentWorkers":1,"windowsJobCommittedGiB":8,"windowsJobMaxProcesses":6,
        "maximumWorkerSeconds":1800,"cpuPreparationSeconds":300,"maximumOverallSeconds":2100,"maximumGpuFraction":0.7,
        "minimumFreeVramMiB":2048,"entryReserveMiB":3072,"minimumFreeHostGiB":10,"minimumFreeDiskMiB":2048,
        "maximumTemperatureC":85,"outputMiB":128,"failureTensorsMiB":64,"maxPerStreamMiB":8,
        "maximumSamples":48,"generatorForwards":48,"discriminatorForwards":144,"generatorGradients":240,"discriminatorGradients":48,
        "optimizerUpdates":0,"checkpointLoads":0,"automaticRetries":0}


def ref(file):
    return {"path":file.relative_to(ROOT).as_posix(),"sha256":raw_sha(file.read_bytes())}


def check_ref(binding):
    p=ROOT/binding["path"]
    require(not Path(binding["path"]).is_absolute() and ".." not in Path(binding["path"]).parts,"binding_path")
    require(ref(p)["sha256"]==binding["sha256"],"changed_"+binding["path"])
    return p


def contract(ready):
    return {"schemaVersion":"native-stage0-train-gate-contract-v1","candidate":CANDIDATE,"model":MODEL,"seed":20260929,
            "stage":0,"geometry":[256,192],"capabilityScope":"train_only_zero_update_gate","worldWrites":0,
            "sourceRelease":ready["manifest"],"trainMembership":ready["trainMembership"],"initialState":ready["state"],
            "gateOrder":ready["gateOrder"],"cpuPreparation":ref(ROOT/CASE/"cpu-ready.json"),
            "entry":ref(Path(__file__).resolve()),"launcher":ref(ROOT/CASE/"launch.mjs"),
            "programs":ready["sourceBindings"],"parameters":{"supportStructureWeight":0.1,"gradientAtol":1e-6,"gradientRtol":1e-5},
            "limits":LIMITS,"gpuUuid":GPU,"origin":"fresh_no_checkpoint","stopOnFirstFailure":True,
            "trainingQualification":False,"formalStageQualification":False}


def read(p):
    return json.loads(Path(p).read_bytes())


def verify_worker():
    ready=read(ROOT/CASE/"cpu-ready.json");policy=read(ROOT/FORMAL)
    require(policy==contract(ready),"formal_contract")
    grant=read(ROOT/CASE/"qualification-dispatch.json");lease=read(RUN/"launch.json")
    require(grant["policySha256"]==ref(ROOT/FORMAL)["sha256"] and grant["cpuReadySha256"]==policy["cpuPreparation"]["sha256"]
            and grant["mode"]==CANDIDATE and ref(ROOT/CASE/"qualification-dispatch.json")["sha256"]==lease["grantSha256"],"dispatch")
    require(time.time()<lease["deadlineEpoch"]<=lease["startEpoch"]+LIMITS["maximumWorkerSeconds"],"deadline")
    guard=read(ROOT/".runtime/ai-painter/owned-worker-guards/active.json")
    require(guard["runnerPid"]==lease["runnerPid"] and guard["executableSha256"]==lease["interpreterSha256"],"owned_guard")
    args=["-I","-B",str(Path(__file__).resolve()),"--worker"]
    require(guard["commandSha256"]==raw_sha(json.dumps(args,separators=(",",":"),ensure_ascii=False).encode()),"owned_command")
    path=ROOT/".runtime/ai-painter/owned-worker-guards"/(guard["identity"]+"-started.json")
    until=time.monotonic()+2
    while not path.exists() and time.monotonic()<until:time.sleep(.02)
    start=read(path)
    require(start["ownerIdentity"]["pid"]==os.getppid() and start["runnerPid"]==lease["runnerPid"] and
            start["identity"]==guard["identity"],"owned_process_tree")
    for binding in policy["programs"]:check_ref(binding)
    return ready,lease,guard["identity"]


def worker():
    ready,lease,guard_id=verify_worker()
    import shutil
    import subprocess
    import psutil
    import torch
    import check_stage4_mvp_structured_object_v18_cpu_acceptance as cpu
    sys.path.insert(0,str(ROOT/TECH))
    from safety import limit_tree
    from telemetry import checked_snapshot
    inspect=limit_tree()
    torch.set_num_threads(2)
    require(os.environ.get("CUDA_VISIBLE_DEVICES")==GPU and os.environ.get("PYTORCH_ALLOC_CONF")=="max_split_size_mb:128"
            and not torch.cuda.is_initialized(),"resource_environment")
    require(not (RUN/"worker.json").exists(),"reservation_consumed")
    record(RUN/"worker.json",{"pid":os.getpid(),"globalGuard":guard_id,"atEpoch":time.time(),"nestedJob":inspect()})
    last=[0,None];peaks={"maxCardUsedMiB":0,"minCardFreeMiB":None,"maxTemperatureC":0,"highestJobPeakBytes":0}
    def resources(entry=False):
        require(time.time()<lease["deadlineEpoch"] and not (RUN/"cancel").exists(),"wall_or_stop")
        require(psutil.virtual_memory().available>=LIMITS["minimumFreeHostGiB"]*1024**3 and shutil.disk_usage(RUN).free>=2048*1024**2,"host_or_disk")
        if time.monotonic()-last[0]>=1 or entry:
            active=read(ROOT/".runtime/ai-painter/owned-worker-guards/active.json");require(active["identity"]==guard_id,"lease_changed")
            result=subprocess.run(["nvidia-smi","--query-gpu=uuid,memory.total,memory.used,memory.free,temperature.gpu","--format=csv,noheader,nounits"],
                                  capture_output=True,text=True,check=True,timeout=4,creationflags=subprocess.CREATE_NO_WINDOW)
            measure=checked_snapshot(result.stdout,entry);last[:]=[time.monotonic(),measure]
            peaks["maxCardUsedMiB"]=max(peaks["maxCardUsedMiB"],measure["usedMiB"])
            peaks["minCardFreeMiB"]=min(peaks["minCardFreeMiB"] or measure["freeMiB"],measure["freeMiB"])
            peaks["maxTemperatureC"]=max(peaks["maxTemperatureC"],measure["temperatureC"])
            job=inspect();peaks["highestJobPeakBytes"]=max(peaks["highestJobPeakBytes"],job["peakJobBytes"])
            require(sum(p.stat().st_size for p in RUN.iterdir() if p.is_file())<=LIMITS["outputMiB"]*1024**2,"output_limit")
            with (RUN/"resources.jsonl").open("a",encoding="utf8") as stream:stream.write(json.dumps({"atEpoch":time.time(),"card":measure,"job":job})+"\n")
    cpu_reader=cpu.BoundReader(ROOT);m,rows,expected,order,plan=source(cpu_reader)
    require(order==ready["gateOrder"] and plan["datasetManifest"]==ready["manifest"],"wrong_run")
    channels=m["identityPayload"]["channelOrder"];cont=m["identityPayload"]["continuousChannelIds"]
    model,critic,states=fresh_networks(channels,cpu_reader.json(R113));require(states==ready["state"],"fresh_state_changed")
    resources(True);torch.cuda.set_device(0);torch.cuda.set_per_process_memory_fraction(.7,0)
    require(str(torch.cuda.get_device_properties(0).uuid).lower().removeprefix("gpu-")==GPU[4:].lower() and
            torch.cuda.get_allocator_backend()=="native","device")
    model.to("cuda:0");critic.to("cuda:0")
    done=[];active_sample=None;failure={}
    try:
        for index,sid in enumerate(order):
            active_sample=sid;failure={};resources()
            sample,identity=decode(cpu_reader,rows[sid],expected[sid],channels,cont)
            require(ready["inputs"][index]["id"]==sid and sample_facts(sample)==ready["inputs"][index]["input"],"sample_tensor_changed")
            proof=numerical_gate(model,critic,sample,channels,resources,failure)
            calls={"generatorForwards":1,"generatorForwardCompleted":1,"generatorAutograd":5,"discriminatorAutograd":1}
            require(proof["passed"] and proof["callCounts"]==calls and proof["modelCapabilityVersion"]==MODEL and
                    not proof["optimizerCreated"] and proof["optimizerUpdates"]==0,"numerical_gate_did_not_pass")
            record(RUN/("probe-%02d.json"%index),{"id":sid,"ordinalInTrain":ready["historicalTrainOrder"].index(sid),
                   "input":ready["inputs"][index],"proof":proof,"atEpoch":time.time()})
            done.append(sid)
        resources()
        record(RUN/"result.json",{"status":"48_train_zero_update_probes_completed_pending_owner_cleanup","passedIds":done,
               "count":len(done),"optimizerUpdates":0,"evidence":peaks,"formalStagePassed":False})
    except BaseException as exc:
        saved=None;capture_error=None
        try:
            raw=getattr(exc,"object_support_gradient_evidence",{}).get("rawGradients",[])
            if raw:
                nbytes=sum(t.numel()*t.element_size() for group in raw for t in group if t is not None)
                require(nbytes<63*1024**2,"failure_capture_limit")
                f=io.BytesIO();torch.save([[None if t is None else t.detach().to("cpu") for t in group] for group in raw],f)
                require(f.tell()<=64*1024**2,"failure_serialization_limit")
                file=RUN/"first-failure-gradients.pt"
                with file.open("xb") as stream:stream.write(f.getbuffer())
                saved=ref(file)
        except BaseException as err:capture_error=repr(err)
        record(RUN/"first-failure.json",{"id":active_sample,"passedIds":done,"error":repr(exc),"mathEvidence":failure,
               "tensorCapture":saved,"captureError":capture_error,"peaks":peaks,"optimizerUpdates":0})
        raise


if __name__=="__main__":
    if sys.argv[1:]==["--prepare"]:
        os.environ["CUDA_VISIBLE_DEVICES"]=""
        import psutil
        process=psutil.Process()
        process.cpu_affinity(process.cpu_affinity()[:2])
        data=prepare()
        record(ROOT/CASE/"cpu-ready.json",data)
        record(ROOT/CASE/"contract-candidate.json",contract(data))
        print(json.dumps(ref(ROOT/CASE/"contract-candidate.json")))
    elif sys.argv[1:]==["--worker"]:
        worker()
    else:
        raise SystemExit("expected --prepare or fixed supervised --worker")
