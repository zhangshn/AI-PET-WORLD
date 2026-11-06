"""Stage0 native optimizer and restart primitives. No stage or release registration."""
import hashlib
import json
import random
from copy import deepcopy

import numpy as np
import torch

from .detail_weight_checkpoint_codec import serialize_checkpoint, deserialize_checkpoint
from .native_training_step_v6 import adamw_pair, require, state_fingerprints, _cpu_state, OPT

SCHEMA="native-stage0-local-resume-v1"
GPU_SCHEMA="native-stage0-device-resume-v1"
LIMIT=1152


def position(train_ids, index):
    require(len(train_ids)==48 and len(set(train_ids))==48 and type(index) is int and 0<=index<LIMIT,"bad training cursor")
    epoch,ordinal=divmod(index,48)
    indices=list(range(48));random.Random(20260929+epoch+1).shuffle(indices)
    i=indices[ordinal]
    return {"epoch":epoch+1,"zeroBasedEpochPosition":ordinal,"trainIndex":i,"sampleId":train_ids[i]}


def modes(nets):
    return [{"modules":[(k,m.training) for k,m in net.named_modules()],
             "requiresGrad":[(k,p.requires_grad) for k,p in net.named_parameters()]} for net in nets]


def rng():
    algo,arr,offset,flag,cached=np.random.get_state()
    return {"torchCpu":torch.get_rng_state(),"python":random.getstate(),"numpy":(algo,arr.tolist(),offset,flag,cached)}


def restore_rng(state):
    algo,arr,offset,flag,cached=state["numpy"]
    np.random.set_state((algo,np.asarray(arr,dtype=np.uint32),offset,flag,cached))
    random.setstate(state["python"]);torch.set_rng_state(state["torchCpu"])


def optimizer_check(optimizer,net,step):
    require(len(optimizer.param_groups)==1,"AdamW group changed")
    group=optimizer.param_groups[0]
    require(all(group[k]==value for k,value in OPT.items()) and all(a is b for a,b in zip(group["params"],net.parameters(),strict=True)),"AdamW bindings changed")
    require(len(optimizer.state)==(len(group["params"]) if step else 0),"incomplete AdamW state")
    for p,s in optimizer.state.items():
        require(set(s)=={"step","exp_avg","exp_avg_sq"} and s["step"].numel()==1 and s["step"].item()==step,"AdamW step changed")
        for name in ("exp_avg","exp_avg_sq"):
            x=s[name];require(x.shape==p.shape and x.dtype==p.dtype and torch.isfinite(x).all().item(),"invalid AdamW tensor")


class Stage0Training:
    def __init__(self,nets,channels,train_ids,lineage,decode,reader_check):
        from .terrain_ecology_native_recomputed_stage_v1 import validate_model_identity
        self.g,self.d=nets
        validate_model_identity(self.g)
        require(self.g.native_stage_geometry.stage==0 and all(next(n.parameters()).device.type=="cpu" for n in nets),"Stage0 requires authenticated CPU construction")
        require(len(channels)==23 and len(train_ids)==48 and len(set(train_ids))==48,"invalid dataset")
        self.channels,self.ids,self.lineage=tuple(channels),tuple(train_ids),deepcopy(lineage)
        self.decode,self.reader_check=decode,reader_check
        self.go,self.do=adamw_pair(*nets)
        self.counts={"generator":0,"discriminator":0}
        self.healthy=True
        self.history_hash=hashlib.sha256(b"native-stage0-original-order-v1").hexdigest()
        self.expected_modes=modes(nets)

    def install_cuda(self, device):
        """Install CPU-authenticated networks and bind live AdamW parameters/moments to the selected card."""
        require(self.healthy and device==torch.device("cuda:0") and next(self.g.parameters()).device.type=="cpu" and
                self.lineage.get("executionDevice")=="cuda:0","invalid device transition")
        self.healthy=False
        old_opts=[deepcopy(_cpu_state(o.state_dict())) for o in (self.go,self.do)]
        expected=[state_fingerprints(n.state_dict()) for n in (self.g,self.d)]
        self.g.to(device);self.d.to(device)
        self.go,self.do=adamw_pair(self.g,self.d)
        for opt,net,state in zip((self.go,self.do),(self.g,self.d),old_opts,strict=True):
            opt.load_state_dict(state)
            optimizer_check(opt,net,self.counts["generator"])
            require(state_fingerprints(opt.state_dict())==state_fingerprints(state),"device optimizer transfer changed bytes")
            for p,m in opt.state.items():
                require(p.device==m["exp_avg"].device==m["exp_avg_sq"].device==device and m["step"].device.type=="cpu","AdamW device responsibility")
        require(expected==[state_fingerprints(n.state_dict()) for n in (self.g,self.d)],"device model transfer changed bytes")
        self.healthy=True

    def train_one(self,resource):
        import painter_stage4_rock_background_training_profile_v1 as original
        require(self.healthy and self.counts["generator"]==self.counts["discriminator"],"asymmetric or failed training object")
        p=position(self.ids,self.counts["generator"])
        sample,identity=self.decode(p["sampleId"])
        require(sample["split"]=="train" and sample["sampleId"]==p["sampleId"]==identity["sampleId"] and
                sample["native_stage_geometry"]==self.g.native_stage_geometry,"wrong source")
        resource();self.reader_check()
        ledger={"sampleId":p["sampleId"],"generator":0,"discriminator":0}
        self.healthy=False
        result=original.perform_pair(self.g,self.d,sample,self.channels,self.go,self.do,self.counts,ledger,resource,None,update_limit=LIMIT,
                                     support_structure_weight=0.1)
        require(ledger=={"sampleId":p["sampleId"],"generator":1,"discriminator":1},"pair ledger")
        optimizer_check(self.go,self.g,self.counts["generator"]);optimizer_check(self.do,self.d,self.counts["discriminator"])
        require(modes((self.g,self.d))==self.expected_modes,"phase leaked")
        self.go.zero_grad(set_to_none=True);self.do.zero_grad(set_to_none=True)
        self.reader_check();resource()
        self.history_hash=self.next_hash(self.history_hash,p)
        self.healthy=True
        return {"position":p,"counts":dict(self.counts),"image":identity["image"],"ledger":ledger,
                "generatorLoss":result["generatorLoss"],"discriminatorLoss":result["discriminatorLoss"],"historySha256":self.history_hash}

    @staticmethod
    def next_hash(previous,p):
        return hashlib.sha256(bytes.fromhex(previous)+json.dumps(p,sort_keys=True,separators=(",",":")).encode()).hexdigest()

    def save_bytes(self):
        index=self.counts["generator"]
        require(self.healthy and index==self.counts["discriminator"] and 0<index<=LIMIT,"incomplete training pair")
        require(modes((self.g,self.d))==self.expected_modes,"training modes changed")
        for opt,net in ((self.go,self.g),(self.do,self.d)):optimizer_check(opt,net,index)
        data={"schema":SCHEMA,"lineage":self.lineage,"counts":dict(self.counts),"historySha256":self.history_hash,
              "models":[_cpu_state(n.state_dict()) for n in (self.g,self.d)],"modes":self.expected_modes,
              "optimizers":[_cpu_state(o.state_dict()) for o in (self.go,self.do)],"rng":rng()}
        if next(self.g.parameters()).device.type=="cuda":
            require(self.lineage.get("executionDevice")=="cuda:0","CUDA checkpoint origin")
            data.update(schema=GPU_SCHEMA,accelerator=self.accelerator())
        return serialize_checkpoint(data)

    @staticmethod
    def accelerator():
        return {"uuid":str(torch.cuda.get_device_properties(0).uuid),"torch":str(torch.__version__),"cuda":torch.version.cuda,
                "device":"cuda:0","rng":torch.cuda.get_rng_state(0)}

    def restore(self,raw,sha256,expected_step,*,device=None):
        """Install in a fresh, discarded-on-failure worker. Check cursor, all moments and RNG."""
        require(self.healthy and self.counts=={"generator":0,"discriminator":0} and type(expected_step) is int and 0<expected_step<=LIMIT,"invalid fresh resume")
        require(hashlib.sha256(raw).hexdigest()==sha256,"changed checkpoint bytes")
        data=deserialize_checkpoint(raw)
        keys={"schema","lineage","counts","historySha256","models","modes","optimizers","rng"}
        if device is not None:
            require(device==torch.device("cuda:0") and self.lineage.get("executionDevice")=="cuda:0","unsupported target device")
            keys.add("accelerator")
        require(set(data)==keys and data["schema"]==(GPU_SCHEMA if device is not None else SCHEMA)
                and data["lineage"]==self.lineage and data["modes"]==self.expected_modes
                and data["counts"]=={"generator":expected_step,"discriminator":expected_step} and all(type(v) is int for v in data["counts"].values()),"wrong resume lineage or cursor")
        digest=self.history_hash
        for i in range(expected_step):digest=self.next_hash(digest,position(self.ids,i))
        require(digest==data["historySha256"] and len(data["models"])==len(data["optimizers"])==2,"wrong exposure history")
        previous_rng=rng();self.healthy=False
        try:
            for net,state in zip((self.g,self.d),data["models"],strict=True):
                net.load_state_dict(state,strict=True)
                require(state_fingerprints(net.state_dict())==state_fingerprints(state),"model installation changed bytes")
            for opt,net,state in zip((self.go,self.do),(self.g,self.d),data["optimizers"],strict=True):
                opt.load_state_dict(state);optimizer_check(opt,net,expected_step)
                require(state_fingerprints(opt.state_dict())==state_fingerprints(state),"optimizer installation changed bytes")
            restore_rng(data["rng"])
            require(state_fingerprints(rng())==state_fingerprints(data["rng"]),"RNG installation changed bytes")
        except BaseException:
            restore_rng(previous_rng)
            raise
        self.counts=dict(data["counts"]);self.history_hash=digest;self.healthy=True
        if device is not None:
            try:
                self.install_cuda(device)
                current=self.accelerator();saved=data["accelerator"]
                require(set(saved)==set(current) and all(saved[k]==current[k] for k in current if k!="rng"),"wrong CUDA checkpoint environment")
                torch.cuda.set_rng_state(saved["rng"],0)
                require(torch.equal(torch.cuda.get_rng_state(0),saved["rng"]),"GPU RNG restoration failed")
            except BaseException:
                self.healthy=False;restore_rng(previous_rng)
                raise
