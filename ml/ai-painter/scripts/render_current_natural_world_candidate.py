"""One owned CPU forward on the current natural Store snapshot; the coordinator installs verified candidates."""
from datetime import datetime, timezone
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import sys
import time

ROOT=Path(__file__).resolve().parents[3]
WORLD="mvp-natural-world-001"
BASE=".runtime/ai-painter/natural-world-live-map-candidates/"+WORLD
MODEL_SOURCE=".runtime/ai-painter/controller-repair-reviews/world-first-current-rgb-192-20261103/run"
SNAPSHOT_SHA="dd4d77370bdc544b2cfb5aa3440d01141b21819be5a6c29d205a2f2fc3939bc2"
REFERENCE_SHA="dcb77f51a63951c2e561bd467cecf543719ae42befc2edf0ec69516dd06f8d2c"
LIVE="ml/ai-painter/src/ai_painter/complete_world/live_natural_world_input.py"
TECH=".runtime/ai-painter/controller-repair-reviews/native-p86-telemetry-196-20261103"
def need(ok,why):
    if not ok:raise ValueError("current_native_candidate_"+why)
def sha(data):return hashlib.sha256(data).hexdigest()
def bound(b,limit=64*1024**2):
    logical=b["path"];need(isinstance(logical,str) and not Path(logical).is_absolute() and not any(x in ("",".","..") for x in logical.split("/")),"file_path")
    p=((ROOT/".runtime").resolve()/logical[9:]) if logical.startswith(".runtime/") else ROOT/logical
    st=p.stat();need(p.resolve(strict=True)==p and p.is_file() and st.st_nlink==1 and 0<st.st_size<=limit,"file_scope")
    v=p.read_bytes();need(sha(v)==b["sha256"] and len(v)==st.st_size,"file_bytes");return v
def js(b):return json.loads(bound(b))
def read(p):return json.loads(Path(p).read_bytes())
def write(p,v):
    with p.open("xb") as f:
        f.write((json.dumps(v,allow_nan=False,ensure_ascii=False,indent=2)+"\n").encode());f.flush();os.fsync(f.fileno())
def timestamp():return datetime.now(timezone.utc).isoformat()

def run(key):
    need(re.fullmatch("[0-9a-f]{64}",key) and os.environ.get("CUDA_VISIBLE_DEVICES")=="","scope")
    staging=ROOT/BASE/(".pending-"+key);start=read(staging/"reservation.json")
    plan=start["plan"];need(plan["key"]==key and time.time()*1000<start["deadlineMs"],"reservation")
    guarddir=ROOT/".runtime/ai-painter/owned-worker-guards";guard=read(guarddir/"active.json")
    args=["-I","-B",str(Path(__file__).resolve()),key]
    need(guard["runnerPid"]==start["launcherPid"] and guard["commandSha256"]==sha(json.dumps(args,separators=(",",":")).encode())
         and guard["executableSha256"]==plan["interpreter"]["sha256"],"native_command")
    started=guarddir/(guard["identity"]+"-started.json");until=time.monotonic()+2
    while not started.exists() and time.monotonic()<until:time.sleep(.02)
    observed=read(started);need(observed["ownerIdentity"]["pid"]==os.getppid() and observed["runnerPid"]==start["launcherPid"],"native_process")
    for b in plan["programs"]:bound(b)
    for key2 in ["checkpoint","package","terminal","result"]:need(key2 in plan["model"],"parent_bindings")
    sys.path[:0]=[str(ROOT/TECH),str(ROOT/"ml/ai-painter/.venv/Lib/site-packages")]
    from safety import limit_tree
    inspect=limit_tree();job=inspect()
    need(job["limitBytes"]==8*1024**3 and len(job["cores"])==2,"cpu_job")
    write(staging/"worker-start.json",{"pid":os.getpid(),"guard":guard["identity"],"job":job,"startedAtUtc":timestamp(),"key":key})
    snapshot=js({"path":MODEL_SOURCE+"/snapshot-manifest.json","sha256":SNAPSHOT_SHA})
    numeric=js({"path":MODEL_SOURCE+"/inference-result.json","sha256":REFERENCE_SHA})
    archive=(ROOT/MODEL_SOURCE/"import-snapshot").resolve()
    for local,b in snapshot["files"].items():bound({"path":MODEL_SOURCE+"/import-snapshot/"+local,"sha256":b["sha256"]})
    need(not any(k=="torch" or k.startswith("torch.") or k=="ai_painter" or k.startswith("ai_painter.") for k in sys.modules),"preloaded_model")
    sys.path.insert(0,str(archive))
    import numpy as np
    from PIL import Image
    import torch
    torch.random.default_generator.manual_seed(0);torch.use_deterministic_algorithms(True);torch.set_num_threads(2);torch.set_num_interop_threads(2)
    counts={"checkpointLoads":0,"generatorForwards":0,"criticForwards":0,"gradientCalls":0,"optimizerStarts":0,"cudaStarts":0,"sourceRgbReads":0}
    def block(k):
        def denied(*args,**kwargs):counts[k]+=1;raise ValueError("forbidden "+k)
        return denied
    torch.autograd.grad=torch.autograd.backward=torch.Tensor.backward=block("gradientCalls")
    torch.optim.Optimizer.__init__=block("optimizerStarts");torch.cuda._lazy_init=block("cudaStarts")
    original_load=torch.load
    def load(stream,**kwargs):
        counts["checkpointLoads"]+=1
        need(counts["checkpointLoads"]==1 and type(stream) is io.BytesIO and kwargs=={"map_location":"cpu","weights_only":True},"unexpected_model_load")
        return original_load(stream,**kwargs)
    torch.load=load
    original_call=torch.nn.Module._call_impl
    def checked_call(instance,*args,**kwargs):
        if "critic" in type(instance).__name__.lower() or "discriminator" in type(instance).__name__.lower():return block("criticForwards")()
        return original_call(instance,*args,**kwargs)
    torch.nn.Module._call_impl=checked_call
    from ai_painter.complete_world import terrain_ecology_conditioned_v1 as original, terrain_ecology_native_stage_v1 as native
    from ai_painter.complete_world.native_stage_geometry_v1 import NativeStageGeometry
    live_name="ai_painter.complete_world.live_natural_world_input"
    spec=importlib.util.spec_from_file_location(live_name,ROOT/LIVE)
    module=importlib.util.module_from_spec(spec);sys.modules[live_name]=module
    exec(compile(bound(next(b for b in plan["programs"] if b["path"]==LIVE)),str(ROOT/LIVE),"exec"),module.__dict__)
    descriptor=js(plan["descriptor"])
    need(plan["store"]==descriptor["head"] and plan["identity"]==descriptor["identity"],"snapshot_identity")
    images={(ROOT/c["path"]).resolve() for c in descriptor["channels"]}
    initial=js(descriptor["creation"]["condition_package"])
    images.update((ROOT/c["path"]).resolve() for c in initial["channels"])
    def image_safety(event,argv):
        if event.startswith("socket.") and event not in ("socket.__new__",):raise ValueError("network unavailable in offline render")
        if event=="open" and isinstance(argv[0],(str,bytes)) and Path(os.fsdecode(argv[0])).suffix.lower() in (".png",".jpg",".bmp",".jpeg",".webp"):
            p=Path(os.fsdecode(argv[0])).resolve()
            if p not in images and p!=staging.resolve()/"native-rgb.png":
                counts["sourceRgbReads"]+=1;raise ValueError("reference images cannot be used")
    sys.addaudithook(image_safety)
    inp=module.load_live_natural_world_input(root=ROOT,descriptor_binding=plan["descriptor"],stage=2)
    def tensor(t):return sha(t.detach().cpu().contiguous().numpy().tobytes())
    def facts():
        return {"tensorSha256":tensor(inp.conditions),"objectTableSha256":sha(json.dumps(inp.instance_table,sort_keys=True,separators=(",",":")).encode()),
                "seasonCode":inp.appearance_regime.tolist(),"ecologyCode":inp.ecology_regime.tolist(),"shape":list(inp.conditions.shape),"instances":len(inp.instance_table)}
    inputs=facts();need(inp.identity==plan["identity"] and inp.provenance["snapshot"]==plan["descriptor"] and inputs["shape"]==[1,23,768,1024],"input_binding")
    if "independentExpected" in start:
        expected=start["independentExpected"];need(all(inputs[k]==v for k,v in expected.items()),"independent_input_differs")
    def network_hash(net,parameters):
        h=hashlib.sha256()
        values=net.named_parameters() if parameters else net.state_dict().items()
        for n,v in values:
            h.update(n.encode()+b"\0" if parameters else json.dumps([n,list(v.shape),str(v.dtype)],separators=(",",":")).encode())
            h.update(v.detach().cpu().contiguous().numpy().tobytes())
        return h.hexdigest()
    refs=plan["model"];need(refs==numeric["parentBindings"],"trained_parent_identity")
    pkg,term,result=[js(refs[k]) for k in ("package","terminal","result")]
    need(pkg["experimentIdentity"]==term["runId"]==result["experimentIdentity"] and term["executionState"]=="completed" and
         term["result"]==refs["result"] and refs["checkpoint"] in result["artifacts"] and result["checkpointReloadExact"]
         and pkg["modelCapability"]==original.CAPABILITY and result["optimizerSteps"]=={"generator":448,"discriminator":448},"parent_output")
    state=torch.load(io.BytesIO(bound(refs["checkpoint"])),map_location="cpu",weights_only=True)
    need(state["schema"]=="mixed-train-rehearsal-state-v1" and state["counts"]==result["optimizerSteps"] and state["sampleVisits"]==result["sampleVisits"]
         and state["packageSha256"]==refs["package"]["sha256"] and not state["checkpointPromotable"],"checkpoint")
    parent=original.build_fresh_terrain_ecology_conditioned(condition_channel_order=tuple(c["id"] for c in descriptor["channels"]))
    parent.load_state_dict(state["model"],strict=True);parent.eval();original.validate_model_identity(parent)
    before_parent=network_hash(parent,False);need(before_parent==numeric["parentStateSha256"],"parent_state")
    model=native.migrate_parent_parameters_for_diagnostic(parent,geometry=NativeStageGeometry(2));model.eval();native.validate_model_identity(model)
    weights=network_hash(model,True);model_state=network_hash(model,False)
    need(weights==numeric["nativeParameterSha256"]==network_hash(parent,True) and model_state==numeric["before"]["modelStateSha256"],"native_weights")
    del state,parent
    import gc
    gc.collect()
    def imports():
        for name,mod in list(sys.modules.items()):
            if name==live_name or not (name=="ai_painter" or name.startswith("ai_painter.")):continue
            f=Path(mod.__file__).resolve();need(f.is_relative_to(archive),"unregistered_import")
            key=f.relative_to(archive).as_posix();need(sha(f.read_bytes())==snapshot["files"][key]["sha256"],"numeric_import_changed")
    imports();bound(plan["store"])
    def count_forward(*_):
        counts["generatorForwards"]+=1;need(counts["generatorForwards"]==1,"extra_renderer_forward")
    model.register_forward_pre_hook(count_forward)
    at=timestamp();began=time.perf_counter()
    with torch.inference_mode():
        prediction=model(inp.conditions,inp.instance_table,appearance_regime=inp.appearance_regime,ecology_regime=inp.ecology_regime,return_evidence=False)
    finished=timestamp();elapsed=time.perf_counter()-began
    need(tuple(prediction.shape)==(1,3,768,1024) and str(prediction.dtype)=="torch.float32" and not prediction.requires_grad and
         torch.isfinite(prediction).all().item() and ((prediction>=0)&(prediction<=1)).all().item(),"native_complete_rgb")
    need(not torch.cuda.is_initialized() and facts()==inputs and model_state==network_hash(model,False),"mutation")
    imports();bound(plan["store"])
    arr=prediction[0].permute(1,2,0).contiguous().numpy()
    with (staging/"native-rgb.npy").open("xb") as f:np.save(f,arr,allow_pickle=False);f.flush();os.fsync(f.fileno())
    pixels=(arr*255).round().astype(np.uint8)
    with (staging/"native-rgb.png").open("xb") as f:Image.fromarray(pixels,"RGB").save(f,format="PNG");f.flush();os.fsync(f.fileno())
    proofs={n:{"sha256":sha((staging/n).read_bytes()),"bytes":(staging/n).stat().st_size} for n in ("native-rgb.npy","native-rgb.png")}
    write(staging/"render.json",{"status":"private_native_candidate","key":key,"pid":os.getpid(),"guard":guard["identity"],"inputs":inputs,
        "descriptor":plan["descriptor"],"store":plan["store"],"identity":inp.identity,"provenance":inp.provenance,
        "scope":"diagnostic_unpublished","parent":refs,"parentState":before_parent,"nativeParameters":weights,"nativeState":model_state,
        "snapshot":SNAPSHOT_SHA,"counts":counts,"forwardStartedUtc":at,"forwardFinishedUtc":finished,"forwardSeconds":elapsed,
        "outputShape":[1,3,768,1024],"outputFloatNchwSha256":tensor(prediction),"outputPixelSha256":sha(pixels.tobytes()),"artifacts":proofs,
        "job":inspect(),"formalImageReviews":0,"published":False})

if __name__=="__main__":
    need(len(sys.argv)==2,"fixed_key")
    run(sys.argv[1])
