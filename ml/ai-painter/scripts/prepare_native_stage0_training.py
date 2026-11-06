"""Stage0 native CPU preparation and bounded same-chain restart qualification."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import random
import time
import sys

ROOT=Path(__file__).resolve().parents[3]
sys.path[:0]=[str(ROOT/"ml/ai-painter/scripts"),str(ROOT/"ml/ai-painter/src"),str(ROOT/"ml/ai-painter/.venv/Lib/site-packages")]
import prepare_native_stage0_gate as gate

REV=ROOT/".runtime/ai-painter/controller-repair-reviews"
CASE=REV/"native-stage0-training-route-224-20261103"
OLD=REV/"native-stage0-source-gate-219-20261103"
POLICY=ROOT/"data/ai-painter/system-governance/ai-painter-native-stage0-train-gate-v2.json"
def get(p):return json.loads(p.read_bytes())
def sha(p):
    with p.open("rb") as f:return hashlib.file_digest(f,"sha256").hexdigest()
def evidence(p,body):
    with p.open("x",encoding="utf8") as f:json.dump(body,f,ensure_ascii=False,allow_nan=False,indent=2);f.flush();os.fsync(f.fileno())


def dataset():
    import check_stage4_mvp_structured_object_v18_cpu_acceptance as cpu
    from ai_painter.complete_world.native_stage0_training import Stage0Training
    cfg=get(POLICY);reader=cpu.BoundReader(ROOT)
    prepared=reader.json(cfg["cpuPreparation"])
    manifest,rows,expected,_,plan=gate.source(reader)
    split=reader.json(plan["trainSplit"]);validation=reader.json(plan["validationSplit"])
    gate.require(split["sampleIds"]==prepared["historicalTrainOrder"] and len(validation["sampleIds"])==8 and
                 len(set(validation["sampleIds"]))==8 and set(split["sampleIds"]).isdisjoint(validation["sampleIds"]),"holdout_leak")
    channels=manifest["identityPayload"]["channelOrder"];continuous=manifest["identityPayload"]["continuousChannelIds"]
    inputs={r["id"]:r for r in prepared["inputs"]}
    gate.require(len(inputs)==48 and set(inputs)==set(rows) and plan["datasetManifest"]==cfg["sourceRelease"] and
                 plan["trainSplit"]==cfg["trainMembership"] and plan["validationSplit"]==manifest["splits"]["validation"] and plan["configuration"]["seed"]==20260929,"source_release")
    nets=gate.fresh_networks(channels,reader.json(gate.R113))
    gate.require(nets[2]==cfg["initialState"]==prepared["state"],"initial_weights")
    def decode(sid):
        sample,identity=gate.decode(reader,rows[sid],expected[sid],channels,continuous)
        gate.require(gate.sample_facts(sample)==inputs[sid]["input"],"actual_loaded_input")
        return sample,identity
    lineage={"scope":"cpu_native_stage0_restart_224","stage":0,"canvas":[256,192],"model":gate.MODEL,"numericRule":nets[0].numeric_rule,
             "seed":20260929,"origin":"fresh_stage0_no_parent","initialState":nets[2],"dataset":plan["datasetManifest"],
             "trainMembership":plan["trainSplit"],"validationMembership":plan["validationSplit"],"splitOrder":"historical_train_index_python_seed_plus_epoch_v1",
             "pair":"rock_background_original_d_then_g_support_weight_0.1","sources":{n:sha(ROOT/n) for n in
               ("ml/ai-painter/src/ai_painter/complete_world/native_stage0_training.py","ml/ai-painter/scripts/prepare_native_stage0_training.py",
                "ml/ai-painter/scripts/prepare_native_stage0_gate.py","ml/ai-painter/scripts/painter_stage4_rock_background_training_profile_v1.py",
                "ml/ai-painter/scripts/painter_stage4_decode1_entry_weight_training_profile_v1.py")}}
    return Stage0Training(nets[:2],channels,split["sampleIds"],lineage,decode,reader.unchanged),validation["sampleIds"]


def development_inputs():
    import check_stage4_mvp_structured_object_v18_cpu_acceptance as cpu
    import painter_stage4_decode1_entry_weight_training_profile_v1 as normal
    from painter_stage4_appearance_regime_probe import derive_regime_record
    from ai_painter.complete_world.native_stage_geometry_v1 import NativeStageGeometry
    reader=cpu.BoundReader(ROOT);audit=reader.json(gate.R217);plan=reader.json(audit["plan"])
    manifest=reader.json(plan["datasetManifest"]);idx=reader.json(manifest["sourceIndex"])
    ids=reader.json(manifest["splits"]["validation"])["sampleIds"]
    gate.require(ids==audit["memberships"]["validation"] and len(ids)==len(set(ids))==8,"development_membership")
    rows={r["sampleId"]:r for r in idx["samples"] if r["split"]=="validation"}
    trusted={r["sampleId"]:r for r in audit["loaded"] if r["split"]=="validation" and r["okay"]}
    gate.require(set(rows)==set(trusted)==set(ids),"development_source")
    for sid in ids:
        row=rows[sid];original=trusted[sid]
        gate.require("sourceCorrection" not in row,"corrected_holdout")
        sample,identity=cpu.load_sample(reader,row,manifest["identityPayload"]["channelOrder"],manifest["identityPayload"]["continuousChannelIds"])
        regime,_,_=derive_regime_record(reader,identity)
        sample=normal.bind_sample_ecology(reader,sample,identity,regime);normal.validate_sample_ecology(sample)
        gate.require(identity["image"]==original["image"] and identity["conditionPack"]==original["conditions"] and identity["worldId"]==original["worldId"]
                     and len(sample["objectInstanceTable"])==original["instances"] and sample["split"]=="validation","development_evidence")
        sample["native_stage_geometry"]=NativeStageGeometry(0)
        reader.unchanged();yield sample,identity


def paired_observation(trial,sample):
    """Same geometry, source masks and existing luminance-correlation formula."""
    import torch
    import painter_stage4_rock_background_training_profile_v1 as normal
    from painter_stage4_ecology_terrain_detail_weight_quality_lifecycle_v1 import observation_scope
    from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import OBJECT_CHANNELS,original_object_class_spatial_loss
    from ai_painter.complete_world.native_training_step_v6 import state_fingerprints
    from ai_painter.complete_world.native_stage0_training import rng
    cpu_rng=state_fingerprints(rng());device=next(trial.g.parameters()).device
    gpu_rng=torch.cuda.get_rng_state(0) if device.type=="cuda" else None
    with observation_scope(trial.g,trial.d),torch.no_grad():
        trial.g.eval();pred=normal.sample_forward(trial.g,sample)
        result={}
        if sample["split"]=="validation":
            _,values=original_object_class_spatial_loss(pred,sample,trial.channels,split="validation",geometry=trial.g.native_stage_geometry)
            result={"sampleId":sample["sampleId"],"split":"validation","fullRgbMae":float((pred[0]-sample["image"].to(device)).abs().mean()),
                    "objectCorrelations":{k:None if k not in values else float(values[k]) for k in OBJECT_CHANNELS},
                    "maskPixels":{k:int((sample["conditions"][trial.channels.index(k)]>.5).sum()) for k in OBJECT_CHANNELS}}
        rgb=pred[0].permute(1,2,0).detach().contiguous().cpu().numpy()
    gate.require(cpu_rng==state_fingerprints(rng()) and (gpu_rng is None or torch.equal(gpu_rng,torch.cuda.get_rng_state(0))),"observation_changed_rng")
    return rgb,result


def qualification(action):
    import psutil
    sys.path.insert(0,str(REV/"native-p86-telemetry-196-20261103"))
    from safety import limit_tree
    gate.require(os.name=="nt" and os.environ.get("CUDA_VISIBLE_DEVICES")=="","CPU_qualification_environment")
    inspect=limit_tree()
    import numpy as np
    import torch
    from ai_painter.complete_world.native_training_step_v6 import state_fingerprints
    from ai_painter.complete_world.native_stage0_training import rng, position
    begin=time.monotonic();utc=datetime.now(timezone.utc).isoformat()
    torch.set_num_threads(2);torch.set_num_interop_threads(2)
    torch.manual_seed(20260929);np.random.seed(20260929);random.seed(20260929)
    conditions=[]
    def resource():
        obs=inspect();avail=psutil.virtual_memory().available
        gate.require(len(obs["cores"])==2 and obs["limitBytes"]==8*1024**3 and avail>=10*1024**3 and
                     time.monotonic()-begin<165 and not torch.cuda.is_initialized(),"bounded_CPU_qualification")
        conditions.append({"available":avail,"jobPeak":obs["peakJobBytes"]})
    resource();trial,validation=dataset();resource()
    output={"action":action,"pid":os.getpid(),"bornUtc":utc,"lineage":trial.lineage,"validationIds":validation,"trainIds":trial.ids}
    if action=="prepare":
        output["firstTwoPositions"]=[position(trial.ids,i) for i in (0,1)]
    else:
        run=CASE/"cpu-restart"
        if action=="uninterrupted":
            first=trial.train_one(resource);raw=trial.save_bytes()
            pending=run/"step1.pending";checkpoint=run/"step1.pt"
            with pending.open("xb") as f:f.write(raw);f.flush();os.fsync(f.fileno())
            os.link(pending,checkpoint);pending.unlink()
            evidence(run/"step1.json",{"sha256":sha(checkpoint),"step":1,"bytes":len(raw),"position":first,"pid":os.getpid()})
        elif action=="resumed":
            receipt=get(run/"step1.json");gate.require(receipt["pid"]!=os.getpid(),"independent_restore")
            trial.restore((run/"step1.pt").read_bytes(),receipt["sha256"],1)
        else:raise ValueError("unknown CPU run")
        output["actualStep"]=trial.train_one(resource)
        output["modelStates"]=[state_fingerprints(n.state_dict()) for n in (trial.g,trial.d)]
        output["optimizerStates"]=[state_fingerprints(o.state_dict()) for o in (trial.go,trial.do)]
        output["rngAfter"]=state_fingerprints(rng());output["modes"]=trial.expected_modes
        output["count"]=trial.counts;output["next"]=position(trial.ids,trial.counts["generator"])
    resource();output.update(durationSeconds=time.monotonic()-begin,job=inspect(),minimumAvailableBytes=min(v["available"] for v in conditions),
                             cudaInitialized=torch.cuda.is_initialized(),formalStage=False)
    return output


if __name__=="__main__":
    if sys.argv[1:] in (["--stage0-gpu-smoke"],["--stage0-smoke-recover"]):
        import subprocess
        program=REV/"native-stage0-gpu-training-entry-226-20261103/launch.mjs"
        sys.exit(subprocess.run(["node",str(program),"--run" if sys.argv[1]=="--stage0-gpu-smoke" else "--recover"],cwd=ROOT).returncode)
    gate.require(len(sys.argv)==2 and sys.argv[1] in ("--prepare-cpu","--uninterrupted-cpu","--resumed-cpu"),"scope")
    value=sys.argv[1][2:-4]
    evidence(CASE/"cpu-restart"/(value+".json"),qualification(value))
