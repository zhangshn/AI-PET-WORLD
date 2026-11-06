"""Fixed real149 native v6 compute smoke. The caller supplies a retained resource guard."""
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import time

ROOT=Path(__file__).resolve().parents[3]
if __name__=="__main__" and sys.argv[1:] in (["--run"],["--recover"]):
    import subprocess
    coordinator=ROOT/".runtime/ai-painter/controller-repair-reviews/native-real-update-smoke-211-20261103/launch.mjs"
    sys.exit(subprocess.run(["node",str(coordinator),sys.argv[1]],cwd=ROOT).returncode)
sys.path[:0]=[str(ROOT/"ml/ai-painter/scripts"),str(ROOT/"ml/ai-painter/src")]
if os.name=="nt":
    sys.path.insert(0,str(ROOT/"ml/ai-painter/.venv/Lib/site-packages"))
import numpy as np
import torch
from PIL import Image
from ai_painter.complete_world.native_stage_geometry_v1 import NativeStageGeometry
from ai_painter.complete_world import native_training_step_v6 as core
from ai_painter.complete_world import terrain_ecology_native_recomputed_stage_v1 as family
import painter_stage4_rock_background_training_profile_v1 as background
import painter_stage4_decode1_entry_weight_training_profile_v1 as numerical
import check_stage4_mvp_structured_object_v18_cpu_acceptance as original
from painter_stage4_appearance_regime_probe import derive_regime_record

REVIEW=ROOT/".runtime/ai-painter/controller-repair-reviews"
EVIDENCE=REVIEW/"native-real-update-smoke-211-20261103"
PRIOR=REVIEW/"native-required-gradient-memory-205-20261103"
RUN=EVIDENCE/"execution"
SOURCE_ID="ai-cold-start-v7-v7-capacity-slot-149-tropical-forest-glade-v3"
ORIGINAL_205="b1d97e17cd1500672734aea9b6dba854be2d9ae0b2b66ceffe375e50ae3b6d5f"
require=core.require
def encode(v):return (json.dumps(v,ensure_ascii=False,indent=2,allow_nan=False)+"\n").encode()
def digest(v):return hashlib.sha256(v).hexdigest()
def file_sha(p):
    with Path(p).open("rb") as f:return hashlib.file_digest(f,"sha256").hexdigest()
def binding(p):return {"path":Path(p).relative_to(ROOT).as_posix(),"sha256":file_sha(p),"bytes":Path(p).stat().st_size}
def read(p):return json.loads(Path(p).read_bytes())
def exclusive(p,b):
    with Path(p).open("xb") as f:f.write(b);f.flush();os.fsync(f.fileno())

def reopen_205():
    evidence=PRIOR/"delivery.json"
    require(file_sha(evidence)==ORIGINAL_205,"unbound original compute qualification")
    doc=read(evidence);result=PRIOR/"implementation/gpu-only/stage2/result.json"
    require(binding(result) in doc["evidence"] and doc["calls"]["gGradientCompletions"]==5
            and doc["unchangedModelCriticInputRngModes"],"incomplete native source")
    return read(result)

def sample149(history):
    reader=original.BoundReader(ROOT);parents=history["sourceRoute"]["parentBindings"]
    package,terminal,result=(reader.json(parents[k]) for k in ("package","terminal","result"))
    require(terminal["runId"]==package["experimentIdentity"]==result["experimentIdentity"] and terminal["result"]==parents["result"],
            "wrong historical data binding")
    plan=reader.json(package["sourcePlan"]);manifest=reader.json(plan["datasetManifest"]);index=reader.json(manifest["sourceIndex"])
    require(SOURCE_ID in reader.json(plan["trainSplit"])["sampleIds"],"sample not in train split")
    row=next(r for r in index["samples"] if r["sampleId"]==SOURCE_ID)
    require(row["split"]=="train" and "sourceCorrection" not in row,"changed train row")
    order=manifest["identityPayload"]["channelOrder"]
    require(len(order)==23 and len(set(order))==23,"wrong input channel order")
    base,identity=original.load_sample(reader,row,order,manifest["identityPayload"]["continuousChannelIds"])
    require(identity==history["sourceIdentity"],"source identity differs from 205")
    regime,_,_=derive_regime_record(reader,identity)
    pack=reader.json(row["conditionPack"])
    def pixels(ref,mode):
        with Image.open(io.BytesIO(reader.read(ref))) as image:
            require(image.format=="PNG" and image.mode==mode and image.size==(1024,768),"original raster geometry changed")
            return torch.from_numpy(np.asarray(image,dtype=np.uint8).copy()).float().div_(255)
    require([x["id"] for x in pack["channels"]]==order,"scrambled channels")
    sample={**base,"conditions":torch.stack([pixels(c,"L") for c in pack["channels"]]),
            "image":pixels(row["image"],"RGB").permute(2,0,1),"native_stage_geometry":NativeStageGeometry(2)}
    sample=numerical.bind_sample_ecology(reader,sample,identity,regime);numerical.validate_sample_ecology(sample)
    expected=history["initialState"]["input"]
    require(all(core.tensor_sha(sample[k])==expected[k]["sha256"] for k in ("conditions","image","appearance_regime","ecology_regime"))
            and digest(json.dumps(sample["objectInstanceTable"],sort_keys=True).encode())==expected["instanceTableSha256"],"altered native tensors")
    return sample,order,identity

def initialize():
    history=reopen_205();policy=core.load_policy(ROOT);sample,order,identity=sample149(history)
    model,critic=background.fresh_networks(order,model_capability=family.CAPABILITY,geometry=NativeStageGeometry(2))
    model.train();critic.eval().requires_grad_(False)
    for name,network in (("model",model),("critic",critic)):
        expected=history["initialState"][name]
        require([{"name":k,"dtype":str(v.dtype),"shape":list(v.shape),"sha256":core.tensor_sha(v)} for k,v in network.state_dict().items()]==
            [{k:t[k] for k in ("name","dtype","shape","sha256")} for t in expected["tensors"]],"changed fresh "+name)
        require([{"name":k,"training":m.training} for k,m in network.named_modules()]==expected["modes"]
                and [p.requires_grad for p in network.parameters()]==expected["requiresGrad"],"wrong initial parameter flags")
    lineage={"candidate":core.CANDIDATE,"policySha256":core.POLICY_SHA,"sampleId":SOURCE_ID,"split":"train","geometry":[1024,768],
             "model":family.CAPABILITY,"seed":20260929,"source205":ORIGINAL_205,
             "GState205":history["initialState"]["model"]["sha256"],"DState205":history["initialState"]["critic"]["sha256"],
             "trainedParentLoaded":False,"stageSuccessInherited":False,"image":identity["image"],"conditionsSha":history["initialState"]["input"]["conditions"]["sha256"]}
    return policy,sample,order,model,critic,lineage

def prediction_array(tensor):
    a=tensor.detach().cpu().float()
    require(tuple(a.shape)==(1,3,768,1024) and torch.isfinite(a).all().item(),"invalid native RGB prediction")
    a=a[0].permute(1,2,0).contiguous().numpy()
    require(0<=float(a.min())<=float(a.max())<=1,"out-of-range RGB")
    return a

def save_image(name,a):
    b=io.BytesIO();np.save(b,a,allow_pickle=False);exclusive(RUN/(name+".npy"),b.getvalue())
    im=io.BytesIO();Image.fromarray(np.rint(a*255).astype(np.uint8)).save(im,format="PNG");exclusive(RUN/(name+".png"),im.getvalue())
    return {"raw":binding(RUN/(name+".npy")),"png":binding(RUN/(name+".png"))}

def sample_identity(sample):
    return {**{k:core.tensor_sha(sample[k]) for k in ("image","conditions","appearance_regime","ecology_regime")},
            "instanceTableSha256":digest(json.dumps(sample["objectInstanceTable"],sort_keys=True).encode())}

def read_worker_state():
    """Refuse unauthenticated entry before CUDA, optimizer construction or writes."""
    guard=read(ROOT/".runtime/ai-painter/owned-worker-guards/active.json")
    reservation=read(RUN/"launch.json");grant=read(EVIDENCE/"controller-grant.json")
    require(grant["task"]=="NATIVE-ACTUAL-PAIR-211" and grant["mode"]=="one_G_one_D_and_fresh_reload" and
            grant["planSha256"]==file_sha(EVIDENCE/"execution-plan.json") and reservation["grantSha256"]==file_sha(EVIDENCE/"controller-grant.json")
            and guard["runnerPid"]==reservation["runnerPid"] and read(RUN/"owner.json")["pid"]==os.getppid() and
            time.time()<reservation["deadlineEpoch"],"unauthorized or expired managed smoke")
    plan=read(EVIDENCE/"execution-plan.json")
    for r in plan["programs"]:require(file_sha(ROOT/r["path"])==r["sha256"],"worker source changed")
    return reservation

def device_setup():
    read_worker_state()
    require(os.environ.get("CUDA_VISIBLE_DEVICES")=="GPU-48ef1a4c-5905-0ab2-bc2d-1f8ea9b1bbcd" and not torch.cuda.is_initialized() and
            os.environ.get("PYTORCH_ALLOC_CONF")=="max_split_size_mb:128","invalid native resource environment")
    torch.cuda.set_device(0)
    require(str(torch.cuda.get_device_properties(0).uuid).lower().removeprefix("gpu-")==
            os.environ["CUDA_VISIBLE_DEVICES"].lower().removeprefix("gpu-"),"wrong GPU")
    torch.cuda.set_per_process_memory_fraction(.7,0)
    require(torch.cuda.get_allocator_backend()=="native","unsupported allocator")

def resource(phase):
    import subprocess
    from datetime import datetime,timezone
    import painter_stage4_decode1_entry_weight_quality_worker_v1 as hardware
    import run_stage4_mvp_structured_object_v18_readonly_gpu_qualification as memory
    import psutil
    r=read(RUN/"launch.json")
    require(time.time()<r["deadlineEpoch"] and not (RUN/"cancel").exists() and
            psutil.virtual_memory().available>=10*1024**3,"wall, host or stop guard")
    torch.cuda.synchronize();sample=subprocess.run(["nvidia-smi","--query-gpu=uuid,memory.total,memory.used,memory.free,temperature.gpu","--format=csv,noheader,nounits"],
        capture_output=True,text=True,timeout=4,check=True,creationflags=subprocess.CREATE_NO_WINDOW)
    matches=[s.strip().split(", ") for s in sample.stdout.splitlines() if s.split(",")[0]==os.environ["CUDA_VISIBLE_DEVICES"]]
    require(len(matches)==1 and len(matches[0])==5,"invalid card observation")
    uid,total,used,free,temp=matches[0]
    total,used,free=(int(v)*2**20 for v in (total,used,free));temp=float(temp)
    avail,card=torch.cuda.mem_get_info()
    a=torch.cuda.memory_allocated();z=torch.cuda.memory_reserved();pa=torch.cuda.max_memory_allocated();pz=torch.cuda.max_memory_reserved()
    row={"phase":phase,"pid":os.getpid(),"utc":datetime.now(timezone.utc).isoformat(),"driverUsedBytes":used,"driverFreeBytes":free,"driverTotalBytes":total,
         "temperature":temp,"allocated":a,"reserved":z,"peakAllocated":pa,"peakReserved":pz,"cudaFree":avail,"cudaTotal":card}
    with (RUN/("resource-"+str(os.getpid())+".jsonl")).open("a",encoding="utf8") as f:f.write(json.dumps(row)+"\n")
    hardware.require_gpu_resource_poll(free_bytes=min(free,avail),uuid=uid,temperature=temp,sampled_at=row["utc"])
    memory.check_memory(total=total,reserved=z,allocated=a,device_used=used,fraction=.7)
    memory.check_memory(total=card,reserved=pz,allocated=pa,device_used=card-avail,fraction=.7)

def observe_prediction(model,sample,policy,label):
    bound=numerical._bound_device(model,sample)
    memory=core.NativeMemoryScope(model,policy,resource)
    modes=[(m,m.training) for m in model.modules()]
    try:
        model.eval()
        with torch.no_grad(),memory.during("g_forward"),numerical.generator_fp32_scope(next(model.parameters()).device):
            t=background.sample_forward(model,bound)
    finally:
        for m,flag in modes:m.training=flag
    a=prediction_array(t);resource(label);return a

def device_worker(action):
    read_worker_state();policy,sample,order,model,critic,lineage=initialize()
    before_input=sample_identity(sample)
    if action=="fit":
        device_setup();resource("before_install")
        model.to("cuda:0");critic.to("cuda:0")
        go,do=core.adamw_pair(model,critic)
    calls={"generator":0,"critic":0}
    def count(name,maximum):
        def counted(*_):
            require(calls[name]<maximum,"extra actual "+name+" forward");calls[name]+=1
        return counted
    hooks=[model.register_forward_pre_hook(count("generator",4 if action=="fit" else 1)),
           critic.register_forward_pre_hook(count("critic",3 if action=="fit" else 0))]
    try:
        if action=="fit":
            require(not (RUN/"fit-start.json").exists(),"single-use pair already consumed")
            exclusive(RUN/"fit-start.json",encode({"lineage":lineage,"pid":os.getpid(),"atEpoch":time.time()}))
            before=save_image("before-update",observe_prediction(model,sample,policy,"before-G-forward"))
            training_preview={}
            def preview(t,b,counts):
                require(counts=={"generator":0,"discriminator":1} and not training_preview,"wrong before-G observation")
                training_preview.update(counts=counts,trainMode=True,rawSha=digest(prediction_array(t).tobytes()))
            optimizer_hooks=[]
            for name,opt in (("generator",go),("discriminator",do)):
                optimizer_hooks.append(opt.register_step_pre_hook(lambda *_args,n=name:resource(n+"/optimizer-start")))
                optimizer_hooks.append(opt.register_step_post_hook(lambda *_args,n=name:resource(n+"/optimizer-end")))
            try:pair=core.perform_native_pair(model,critic,sample,order,(go,do),policy,resource,preview)
            finally:
                for hook in optimizer_hooks:hook.remove()
            require(training_preview and before_input==sample_identity(sample),"missing original paired observation or altered sample")
            go.zero_grad(set_to_none=True);do.zero_grad(set_to_none=True)
            a=observe_prediction(model,sample,policy,"after-G-forward");after=save_image("after-update",a)
            require(before["raw"]["sha256"]!=after["raw"]["sha256"],"prediction did not change")
            prior=np.load(RUN/"before-update.npy",allow_pickle=False)
            target=sample["image"].reshape(3,768,1024).permute(1,2,0).cpu().numpy()
            image_change={"pixelsChangedUint8":int(np.count_nonzero(np.any(np.rint(prior*255)!=np.rint(a*255),axis=2))),
                          "meanAbsoluteRgbChange":float(np.abs(a-prior).mean(dtype=np.float64)),
                          "meanAbsoluteRgbVsTargetBefore":float(np.abs(prior-target).mean(dtype=np.float64)),
                          "meanAbsoluteRgbVsTargetAfter":float(np.abs(a-target).mean(dtype=np.float64))}
            resource("before_checkpoint")
            data=core.encode_pair_checkpoint((model,critic),(go,do),lineage)
            private=RUN/"candidate.pending.pt";exclusive(private,data)
            require(calls=={"generator":4,"critic":3},"normal pair forward count differs")
            output={"pid":os.getpid(),"lineage":lineage,"input":before_input,"before":before,"after":after,"pair":pair,"forwards":calls,
                "checkpoint":binding(private),"states":[core.state_fingerprints(o.state_dict()) for o in (go,do)],
                "originalTrainingPreview":training_preview,"beforeAfterEvalMode":True,"imageChange":image_change,"modes":[m.training for m in (model,critic)]}
            exclusive(RUN/"fit.json",encode(output))
        elif action=="reload":
            exclusive(RUN/"reload-start.json",encode({"pid":os.getpid(),"atEpoch":time.time()}))
            fit=read(RUN/"fit.json");require(fit["pid"]!=os.getpid() and fit["lineage"]==lineage and fit["input"]==before_input,"not an independent reload")
            candidate=RUN/"candidate.pending.pt";raw=candidate.read_bytes()
            go,do=core.adamw_pair(model,critic)
            counts=core.reload_pair_checkpoint(raw,fit["checkpoint"]["sha256"],(model,critic),(go,do),lineage)
            require([core.parameter_digests(n) for n in (model,critic)]==fit["pair"]["after"] and
                    [core.state_fingerprints(o.state_dict()) for o in (go,do)]==fit["states"],"fresh state changed")
            device_setup();resource("before_reloaded_weights_to_device")
            model.to("cuda:0");critic.to("cuda:0")
            require([core.parameter_digests(n) for n in (model,critic)]==fit["pair"]["after"],"weights changed during device transfer")
            prediction=observe_prediction(model,sample,policy,"reloaded-forward");reference=np.load(RUN/"after-update.npy",allow_pickle=False)
            require(binding(RUN/"after-update.npy")==fit["after"]["raw"] and prediction.shape==reference.shape,"wrong visual reference")
            bad=int(np.count_nonzero(~np.isclose(prediction,reference,rtol=1e-5,atol=1e-6)));im=save_image("reloaded",prediction)
            require(bad==0 and im["png"]["sha256"]==fit["after"]["png"]["sha256"],"fresh prediction does not match")
            require(calls=={"generator":1,"critic":0} and before_input==sample_identity(sample),"reload changed input or extra forward")
            exclusive(RUN/"reload.json",encode({"pid":os.getpid(),"fitPid":fit["pid"],"counts":counts,"checkpointSha":digest(raw),"forwards":calls,
                "prediction":im,"elementDifferencesBeyondTolerance":bad,"rawBitwise":np.array_equal(prediction,reference),"input":before_input}))
        else:raise ValueError("unsupported action")
    finally:
        for hook in hooks:hook.remove()
        if torch.cuda.is_initialized():torch.cuda.synchronize()

if __name__=="__main__":
    torch.set_num_threads(2);torch.set_num_interop_threads(2)
    require(len(sys.argv)==2 and sys.argv[1] in ("--prepare","--fit","--reload"),"unknown native smoke command")
    if sys.argv[1]=="--prepare":
        require(not torch.cuda.is_initialized(),"CPU prepare")
        policy,sample,order,g,disc,lineage=initialize()
        print(json.dumps({"lineage":lineage,"optimizer":core.OPT,"input":sample_identity(sample),"counts":[len(tuple(g.parameters())),len(tuple(disc.parameters()))],
                          "CUDA":torch.cuda.is_initialized(),"weightUpdates":0},allow_nan=False))
    else:device_worker(sys.argv[1][2:])
