"""Actual formal single-segment numerical driver; no stage selection or release."""
import hashlib
import io
import json
import os
from pathlib import Path
import random
import shutil
import subprocess
import sys
import time

import numpy as np
import psutil
from PIL import Image
import torch

from . import native_stage0_formal_contract as c
from .native_stage0_training import deserialize_checkpoint, optimizer_check, position
from .native_stage0_training import rng
from .native_training_step_v6 import state_fingerprints,_cpu_state
from .detail_weight_checkpoint_codec import serialize_checkpoint


def check_ref(ref):
    path=c.ROOT/ref["path"]
    c.need(c.binding(path)["sha256"]==ref["sha256"],"source hash changed: "+ref["path"])
    if "bytes" in ref:c.need(path.stat().st_size==ref["bytes"],"source bytes changed")


def check_policy(policy,trial):
    expected={"runId":c.RUN_ID,"model":"terrain_ecology_native_recomputed_stage_v1","stage":0,
              "geometry":[256,192],"seed":20260929,"origin":"fresh_stage0_no_parent"}
    c.need(all(policy[k]==v for k,v in expected.items()) and policy["initialState"]==trial.lineage["initialState"],"wrong registered origin")
    for field,source in (("sourceRelease","dataset"),("trainMembership","trainMembership"),("validationMembership","validationMembership")):
        c.need(all(policy[field][k]==trial.lineage[source][k] for k in ("path","sha256")),"wrong data release")
        check_ref(policy[field])
    numeric={"epochs":24,"trainPerEpoch":48,"segments":48,"pairsPerSegment":24,"maxG":1152,"maxD":1152,
             "maxSegmentSeconds":840,"maxRunSeconds":32400,"maxOutputMiB":128,"maxGpuFraction":.7,"minFreeVramMiB":2048,"maxTemperatureC":85}
    c.need(all(policy["budget"][k]==v for k,v in numeric.items()),"registered ceilings")
    check_ref(policy["qualification"]);check_ref(policy["optimizerQualification"])
    g=c.read(c.ROOT/policy["qualification"]["path"])
    c.need(g["actualTrainCases"]==48 and g["fullGeneratorGradients"]==240 and g["optimizerUpdates"]==0 and
           {x["id"] for x in g["samples"]}==set(trial.ids),"incomplete current numerical gate")
    for sample in g["samples"]:check_ref(sample)
    q=c.read(c.ROOT/policy["optimizerQualification"]["path"])
    c.need(q["aggregateModelOptimizers"]=={"G":2,"D":2} and q["bothDeviceReloadsRgbRawIdentical"] and q["deviceRngExact"],"missing real optimizer/restore")
    programs={item["path"]:item for item in policy["programs"]}
    required=("ml/ai-painter/scripts/native_stage0_formal_worker.py","ml/ai-painter/src/ai_painter/complete_world/native_stage0_formal_contract.py",
              "ml/ai-painter/src/ai_painter/complete_world/native_stage0_formal_device.py",*trial.lineage["sources"])
    c.need(all(k in programs for k in required),"missing program identity")
    for item in programs.values():check_ref(item)


class Guard:
    def __init__(self,root,folder,ticket,inspect):
        self.root,self.folder,self.ticket,self.inspect=root,folder,ticket,inspect
        self.charge=False
        self.peaks={"cardUsedMiB":0,"minimumCardFreeMiB":None,"temperatureC":0,"allocatedBytes":0,"reservedBytes":0,"jobBytes":0,"retainedBytes":0}
        self.latest={};self.last_heartbeat=0.;self.completed={"D":ticket["startPair"],"G":ticket["startPair"]}

    def check(self,phase="training_guard"):
        from telemetry import checked_snapshot
        import run_stage4_mvp_structured_object_v18_readonly_gpu_qualification as mem
        t=self.ticket;now=time.time()
        c.need(now<min(c.timestamp(t["segmentDeadlineUtc"]),c.timestamp(t["runDeadlineUtc"])) and
               not (self.root/"cancel").exists() and not (self.folder/"cancel").exists(),"wall/cancel")
        guard=c.read(c.ACTIVE);c.need(guard["runnerPid"]==t["ownerRunnerPid"],"lost owned resource")
        c.need(psutil.virtual_memory().available>=10*2**30 and shutil.disk_usage(self.root).free>=2048*c.MIB,"host/disk headroom")
        used=c.room(self.root,reserve=(64*c.MIB+1*c.MIB+65536 if self.charge else 65536))
        cmd=["nvidia-smi","--query-gpu=uuid,memory.total,memory.used,memory.free,temperature.gpu","--format=csv,noheader,nounits"]
        value=subprocess.run(cmd,capture_output=True,text=True,check=True,timeout=4,creationflags=subprocess.CREATE_NO_WINDOW)
        card=checked_snapshot(value.stdout,phase=="entry")
        job=self.inspect();total=card["totalMiB"]*c.MIB
        allocated=reserved=0
        if torch.cuda.is_initialized():
            torch.cuda.synchronize();avail,ctotal=torch.cuda.mem_get_info(0)
            allocated=torch.cuda.max_memory_allocated(0);reserved=torch.cuda.max_memory_reserved(0)
            c.need(avail>=2048*c.MIB,"CUDA free VRAM")
            mem.check_memory(total=ctotal,reserved=reserved,allocated=allocated,device_used=ctotal-avail,fraction=.7)
            mem.check_memory(total=total,reserved=torch.cuda.memory_reserved(0),allocated=torch.cuda.memory_allocated(0),device_used=card["usedMiB"]*c.MIB,fraction=.7)
        peak=self.peaks
        peak["cardUsedMiB"]=max(peak["cardUsedMiB"],card["usedMiB"])
        peak["minimumCardFreeMiB"]=card["freeMiB"] if peak["minimumCardFreeMiB"] is None else min(peak["minimumCardFreeMiB"],card["freeMiB"])
        for key,x in (("temperatureC",card["temperatureC"]),("allocatedBytes",allocated),("reservedBytes",reserved),("jobBytes",job["peakJobBytes"]),("retainedBytes",used)):
            peak[key]=max(peak[key],x)
        self.latest={"phase":phase,"utc":c.now(),"card":card,"job":job,"completedInMemory":dict(self.completed)}
        if now-self.last_heartbeat>=2 or phase in ("entry","segment_complete"):
            hb="readback-heartbeat.json" if t["phase"]=="verify_final" else "heartbeat.json"
            c.publish(self.folder/hb,c.encoded({"workerPid":os.getpid(),"runId":c.RUN_ID,"segment":t["segment"],**self.latest,"peaks":dict(peak)}),
                      self.root,replace=True,reserve=64*c.MIB+1*c.MIB+65536 if self.charge else 65536)
            self.last_heartbeat=now


def device_install():
    uuid="GPU-48ef1a4c-5905-0ab2-bc2d-1f8ea9b1bbcd"
    c.need(os.environ.get("CUDA_VISIBLE_DEVICES")==uuid and os.environ.get("PYTORCH_ALLOC_CONF")=="max_split_size_mb:128" and
           not torch.cuda.is_initialized(),"device environment")
    torch.cuda.set_device(0);torch.cuda.set_per_process_memory_fraction(.7,0)
    c.need(str(torch.cuda.get_device_properties(0).uuid).lower().removeprefix("gpu-")==uuid.lower().removeprefix("gpu-") and
           torch.cuda.get_allocator_backend()=="native","device/allocator")
    return torch.device("cuda:0")


def verify_checkpoint(path,trial,expected,count):
    import prepare_native_stage0_training as entry
    from .native_stage0_training import GPU_SCHEMA
    # Independent fresh CPU G/D and AdamW instances, using reread bytes.
    data=deserialize_checkpoint(path.read_bytes())
    c.need(data["schema"]==GPU_SCHEMA and data["lineage"]==trial.lineage and data["counts"]=={"generator":count,"discriminator":count},"disk checkpoint identity")
    fresh,_=entry.dataset()
    for i,(net,opt) in enumerate(((fresh.g,fresh.go),(fresh.d,fresh.do))):
        net.load_state_dict(data["models"][i],strict=True);opt.load_state_dict(data["optimizers"][i]);optimizer_check(opt,net,count)
    values={"networks":[state_fingerprints(n.state_dict()) for n in (fresh.g,fresh.d)],
        "adamw":[state_fingerprints(o.state_dict()) for o in (fresh.go,fresh.do)],"rng":state_fingerprints(data["rng"]),
        "cudaRng":state_fingerprints(data["accelerator"]["rng"]),"modes":c.primitive_modes(data["modes"]),
        "counts":data["counts"],"history":data["historySha256"]}
    computed={k:hashlib.sha256(c.encoded(v)).hexdigest() for k,v in values.items()}
    c.need(computed==expected,"disk checkpoint field mismatch")
    import painter_stage4_decode1_entry_weight_lifecycle_v1 as lifecycle
    return {"independentCpuReconstruction":True,"deviceRngBytesVerified":True,"checkpoint":c.binding(path),"stateDigest":computed,
            "generatorStateSha256":lifecycle.shared.v24.core.cpu.state_hash(fresh.g)}


def png(array):
    stream=io.BytesIO();Image.fromarray(array).save(stream,format="PNG");return stream.getvalue()


def pre_pair_capture(trial,pos):
    # Stash the real pre-update state on CPU. On an unsafe device measurement
    # the exception path can keep this snapshot without touching CUDA again.
    packet={"role":"native_stage0_unpublished_pre_pair_failure_evidence_v1","position":pos,"lineage":trial.lineage,
            "counts":dict(trial.counts),"history":trial.history_hash,
            "networks":[_cpu_state(n.state_dict()) for n in (trial.g,trial.d)],
            "optimizers":[_cpu_state(o.state_dict()) for o in (trial.go,trial.do)],
            "modes":c.primitive_modes(trial.expected_modes),"rng":rng(),"accelerator":trial.accelerator()}
    return serialize_checkpoint(packet)


def record_failure(folder,root,exc,checker,before,pos):
    record={"atUtc":c.now(),"firstError":str(exc)[:4096],"errorType":type(exc).__name__,"position":pos,"phase":checker.latest,
            "completedInMemory":dict(checker.completed),"officialSegmentCommitted":False,"prePairState":None}
    try:
        if before is not None and shutil.disk_usage(root).free-len(before)>=2048*c.MIB:
            record["prePairState"]=c.publish(folder/"failed-pre-pair.pt",before,root,reserve=c.MIB+65536)
        record["nativeExecutionCalls"]=getattr(exc,"native_execution_calls",None)
        raw=c.encoded(record)
        if len(raw)>c.MIB:
            record["nativeExecutionCalls"]=None;record["metadataOverflow"]=True;raw=c.encoded(record)
        c.publish(folder/"pair-failure.json",raw,root,reserve=65536)
    except Exception as secondary:
        exc.add_note("Failure capture did not replace the original cause: "+str(secondary)[:500])


def append_pair(folder,root,row):
    raw=c.encoded(row)+b"\n"
    c.room(root,len(raw),64*c.MIB+c.MIB+65536)
    with (folder/"pairs.jsonl").open("ab") as stream:
        stream.write(raw);stream.flush();os.fsync(stream.fileno())


def validation(trial,ids,epoch,folder,root,guard,checkpoint):
    import prepare_native_stage0_training as entry
    import painter_stage4_rock_background_training_profile_v1 as profile
    import painter_stage4_decode1_entry_weight_lifecycle_v1 as lifecycle
    import ecology_quality_ranking_v1 as ranking
    import decode1_entry_weight_quality_review_v1 as judge
    import check_stage4_mvp_structured_object_v18_cpu_acceptance as cpu
    from .native_rgb_structured_object_objective_cpu_v17 import OBJECT_CHANNELS,original_object_class_spatial_loss
    class Reader(cpu.BoundReader):
        def path(self,rel):
            return cpu.project_file(self.root,rel)
    reader=Reader(c.ROOT);source_plan=reader.json(reader.json(entry.gate.R217)["plan"])
    digest=c.state_digests(trial);rows=[];extra={}
    with lifecycle.observation_scope(trial.g,trial.d),torch.no_grad():
        trial.g.eval()
        for i,(sample,identity) in enumerate(entry.development_inputs()):
            guard.check("evaluation_"+str(i))
            sid=sample["sampleId"];c.need(sid==ids[i],"fixed validation order")
            collect=(epoch==24 and sid==judge.SUBJECT_ID)
            value=profile.sample_forward(trial.g,sample,return_evidence=collect)
            pred,evidence=value if collect else (value,None)
            _,corr=original_object_class_spatial_loss(pred,sample,trial.channels,split="validation",geometry=trial.g.native_stage_geometry)
            b=pred[0].permute(1,2,0).detach().contiguous().cpu().numpy()
            c.need(b.shape==(192,256,3) and np.isfinite(b).all() and b.min()>=0 and b.max()<=1,"bad development RGB")
            image=png(np.rint(255*b).astype(np.uint8))
            ref=c.publish(folder/f"validation-{i:02d}.png",image,root,reserve=65536)
            rows.append({"sampleId":sid,"split":"validation","epoch":epoch,"image":ref,"rawRgbSha256":hashlib.sha256(b.tobytes()).hexdigest(),
                "sourceImage":identity["image"],"conditionPack":identity["conditionPack"],
                "fullRgbMae":float((pred[0]-sample["image"].to(pred.device)).abs().mean()),
                "objectCorrelations":{k:None if k not in corr else float(corr[k]) for k in OBJECT_CHANNELS},
                "maskPixels":{k:int((sample["conditions"][trial.channels.index(k)]>.5).sum()) for k in OBJECT_CHANNELS}})
            if collect:
                def publish(rel,raw):
                    p=c.ROOT/rel
                    c.need(p.parent==folder and p.name in ("responsibilities.f32.zlib","original-256.png"),"189 artifact path")
                    return c.publish(p,raw,root,reserve=65536)
                subject,original,res=judge.subject_artifacts(reader,source_plan,sample,evidence,trial.g,list(trial.channels),
                    folder.relative_to(c.ROOT).as_posix(),publish,shared=lifecycle.shared)
                # Retain original interface and exact geometry-bound features.
                extra["responsibility"]={**res,"subject":subject,"original":original}
                with Image.open(io.BytesIO(image)) as src:
                    target=src.resize((1024,768),Image.Resampling.NEAREST)
                    projected=io.BytesIO();target.save(projected,format="PNG")
                c.need(len(projected.getvalue())<=c.MIB,"189 projection budget")
                extra["auditProjection"]=c.publish(folder/"auditor-input-1024.png",projected.getvalue(),root,reserve=65536)
    after=c.state_digests(trial)
    c.need(len(rows)==8 and digest==after and (epoch==12 or "responsibility" in extra),"evaluation incomplete or altered state")
    return {"epoch":epoch,"eligibility":"observation_only" if epoch==12 else "sole_selection_candidate","rows":rows,
            "metrics":ranking.rank_validation_epoch(rows,ids,epoch=epoch,eligible_epochs=(12,24)),"checkpoint":checkpoint,
            "stateBefore":digest,"stateAfter":after,"reloadedBoundary":True,**extra}


def device_segment(ticket,root,folder,inspect):
    import prepare_native_stage0_training as entry
    c.need(sys.argv[1]=="--segment","final replay is owned by an independent accepted read-only invocation")
    checker=Guard(root,folder,ticket,inspect);checker.check("entry")
    torch.manual_seed(20260929);np.random.seed(20260929);random.seed(20260929)
    trial,ids=entry.dataset()
    check_policy(c.read(c.POLICY,8*c.MIB),trial)
    device=device_install();torch.cuda.manual_seed(20260929)
    trial.lineage.update(scope="native_stage0_formal_training_v1",runId=c.RUN_ID,policySha256=ticket["policySha256"],executionDevice="cuda:0")
    n=ticket["segment"];start=ticket["startPair"];end=ticket["endPair"]
    if n==1:
        trial.install_cuda(device)
    else:
        prev=root/"segments"/f"{n-1:02d}";cp=ticket["previous"]["checkpoint"]
        trial.restore(c.bound(cp,prev/"recovery.pt").read_bytes(),cp["sha256"],start,device=device)
        recovered=c.state_digests(trial);expected=c.read(prev/"result.json")["stateDigest"]
        c.need(recovered==expected,"actual GPU continuation fields")
        c.publish(folder/"restore-proof.json",c.encoded({"runId":c.RUN_ID,"segment":n,"workerPid":os.getpid(),
            "checkpoint":cp,"counts":dict(trial.counts),"stateDigest":recovered,"receipt":ticket["previous"]["receipt"]}),root,reserve=65536)
    output=[];hooks=[];calls=[0,0];schedule=[]
    def applied(name):
        def cb(*args):
            checker.completed[name]+=1
            c.need(checker.completed[name]<=end,"optimizer budget")
            schedule.append(name);checker.check(name+"_applied")
        return cb
    for net,cap,name,i in ((trial.g,48+(8 if n in (24,48) else 0),"G",0),(trial.d,72,"D",1)):
        def counted(*args,i=i,cap=cap):
            calls[i]+=1;c.need(calls[i]<=cap,"extra forward")
        hooks.append(net.register_forward_pre_hook(counted))
    for opt,name in ((trial.go,"G"),(trial.do,"D")):hooks.append(opt.register_step_post_hook(applied(name)))
    try:
        checker.charge=True
        for index in range(start,end):
            pos=position(trial.ids,index);before=None
            try:
                checker.check("before_pair")
                c.publish(folder/"active-pair.json",c.encoded({"position":pos,"startCounts":trial.counts,"atUtc":c.now()}),root,
                          reserve=64*c.MIB+c.MIB+65536,replace=True)
                before=pre_pair_capture(trial,pos)
                row=trial.train_one(checker.check)
            except BaseException as exc:
                record_failure(folder,root,exc,checker,before,pos)
                raise
            c.need(row["position"]==position(trial.ids,index) and schedule[-2:]==["D","G"] and
                   checker.completed=={"D":index+1,"G":index+1},"real pair not complete")
            append_pair(folder,root,row);output.append(row)
        checker.charge=False
        c.need(len(output)==24 and schedule==["D","G"]*24 and trial.counts=={"generator":end,"discriminator":end},"segment incomplete")
        states=c.state_digests(trial)
        checkpoint=c.publish(folder/"recovery.pt",trial.save_bytes(),root,reserve=65536)
        proof=verify_checkpoint(folder/"recovery.pt",trial,states,end)
        observation=validation(trial,ids,n//2,folder,root,checker,checkpoint) if n in (24,48) else None
        c.need(calls==[48+(8 if observation else 0),72] and c.state_digests(trial)==states,"forward count or final state changed")
        checker.check("segment_complete")
        return {"schema":"native-stage0-formal-segment-result-v1","counts":trial.counts,"checkpoint":checkpoint,
            "checkpointVerification":proof,"stateDigest":states,"historySha256":trial.history_hash,"trainingRows":output,
            "validation":observation,"pairLedger":c.binding(folder/"pairs.jsonl"),"forwardCounts":{"G":calls[0],"D":calls[1]},"peaks":dict(checker.peaks)}
    finally:
        for hook in hooks:hook.remove()


def final_readback(ticket,root,folder,inspect):
    import prepare_native_stage0_training as entry
    checker=Guard(root,folder,ticket,inspect);checker.check("entry")
    trial,ids=entry.dataset();policy=c.read(c.POLICY,8*c.MIB);check_policy(policy,trial)
    dev=device_install()
    trial.lineage.update(scope="native_stage0_formal_training_v1",runId=c.RUN_ID,policySha256=ticket["policySha256"],executionDevice="cuda:0")
    original=c.read(folder/"result.json");cp=ticket["previous"]["checkpoint"]
    trial.restore(c.bound(cp,folder/"recovery.pt").read_bytes(),cp["sha256"],1152,device=dev)
    expected=original["stateDigest"];c.need(c.state_digests(trial)==expected,"fresh final G/D and optimizer state")
    c.need(os.getpid()!=original["workerPid"],"final readback requires fresh model process")
    rows=[];calls={"G":0,"D":0}
    def observed(name):
        def counter(*args):
            calls[name]+=1;c.need(calls[name] <= (8 if name=="G" else 0),"final readback forward cap")
        return counter
    hooks=[trial.g.register_forward_pre_hook(observed("G")),trial.d.register_forward_pre_hook(observed("D"))]
    try:
        for i,(sample,identity) in enumerate(entry.development_inputs()):
            checker.check("readback_"+str(i))
            prior=original["validation"]["rows"][i];c.need(sample["sampleId"]==ids[i]==prior["sampleId"],"development identity")
            c.bound(prior["image"],folder/f"validation-{i:02d}.png")
            rgb,metrics=entry.paired_observation(trial,sample)
            raw=hashlib.sha256(rgb.tobytes()).hexdigest();h=hashlib.sha256(png(np.rint(255*rgb).astype(np.uint8))).hexdigest()
            c.need(raw==prior["rawRgbSha256"] and h==prior["image"]["sha256"] and metrics["objectCorrelations"]==prior["objectCorrelations"]
                   and metrics["fullRgbMae"]==prior["fullRgbMae"],"reloaded development pixels/metrics differ")
            rows.append({"sampleId":ids[i],"originalValidationImage":prior["image"],"expectedRawRgbSha256":prior["rawRgbSha256"],
                         "actualRawRgbSha256":raw,"actualPngSha256":h})
    finally:
        for h in hooks:h.remove()
    c.need(calls=={"G":8,"D":0} and len(rows)==8 and c.state_digests(trial)==expected,"incomplete or changed final state")
    checker.check("segment_complete")
    return {"schema":"native-stage0-formal-final-readback-v1","counts":trial.counts,"checkpoint":cp,"stateDigest":expected,
            "optimizerUpdates":0,"modelForwards":calls,"rows":rows,"peaks":checker.peaks}
