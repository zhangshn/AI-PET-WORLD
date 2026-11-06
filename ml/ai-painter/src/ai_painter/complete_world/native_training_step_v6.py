"""One native optimizer smoke pair. No stage, visual, release or game admission."""
from contextlib import contextmanager
from copy import deepcopy
import hashlib
import json
from pathlib import Path
from threading import Lock, get_ident

import torch
from torch.utils._python_dispatch import TorchDispatchMode

from .detail_weight_checkpoint_codec import deserialize_checkpoint, serialize_checkpoint

POLICY = "data/ai-painter/system-governance/ai-painter-native-training-memory-policy-v6.json"
POLICY_SHA = "2d0af4c2e9fdef42d35b0c86817a00db4ff14532607276bb88888c04f4b934af"
CAPABILITY = "terrain_ecology_native_recomputed_stage_v1"
CANDIDATE = "native-training-one-pair-v6"
OPT = dict(lr=0.0001, betas=(0.9, 0.999), eps=1e-8, weight_decay=0.01, foreach=False, fused=False)
PHASES = ("actualTotal", "structuredObjective", "wholeFrameFidelity", "objectCoreRgb", "objectSupportStructure")
_scope_lock = Lock()


def require(value, reason):
    if not value:
        raise ValueError(reason)


def load_policy(root):
    raw = (Path(root) / POLICY).read_bytes()
    require(hashlib.sha256(raw).hexdigest() == POLICY_SHA, "unknown native training memory policy")
    policy = json.loads(raw)
    require(policy["capability"] == CAPABILITY and policy["optimizerSmoke"]["scope"] == "isolated_source_bound_single_pair"
            and policy["optimizerSmoke"]["maxGeneratorUpdates"] == policy["optimizerSmoke"]["maxDiscriminatorUpdates"] == 1
            and tuple(policy["namedFullGradientSites"]["requiredPhases"]) == PHASES, "wrong v6 responsibilities")
    return policy


def tensor_sha(tensor):
    raw = tensor.detach().contiguous().reshape(-1).view(torch.uint8).cpu().numpy()
    return hashlib.sha256(memoryview(raw)).hexdigest()


def state_fingerprints(values):
    if isinstance(values, torch.Tensor):
        return {"dtype": str(values.dtype), "shape": list(values.shape), "sha256": tensor_sha(values)}
    if isinstance(values, dict):
        return {str(k): state_fingerprints(v) for k, v in values.items()}
    if isinstance(values, (list, tuple)):
        return [state_fingerprints(v) for v in values]
    return values


def _cpu_state(v):
    if isinstance(v, torch.Tensor):
        return v.detach().cpu()
    if isinstance(v, dict):
        return {k: _cpu_state(w) for k, w in v.items()}
    if isinstance(v, tuple):
        return tuple(_cpu_state(w) for w in v)
    if isinstance(v, list):
        return [_cpu_state(w) for w in v]
    return v


def adamw_pair(model, critic):
    return torch.optim.AdamW(model.parameters(), **OPT), torch.optim.AdamW(critic.parameters(), **OPT)


class NativeMemoryScope(TorchDispatchMode):
    """Use the registered storage identity; never select a convolution by shape alone."""
    def __init__(self, model, policy, resource):
        super().__init__()
        sites = policy["namedFullGradientSites"]
        self.by_storage = {}
        self.sites = {v["parameterName"]: v for v in sites["sites"]}
        named = list(model.named_parameters())
        require(len(named) == 109, "wrong generator identity")
        for site in self.sites.values():
            name, weight = named[site["parameterIndex"]]
            require(name == site["parameterName"] and list(weight.shape) == [48, site["inChannels"], 3, 3],
                    "registered generator weight differs")
        for name, p in named:
            storage = p.untyped_storage().data_ptr()
            require(storage not in self.by_storage and p.storage_offset() == 0, "ambiguous parameter storage")
            self.by_storage[storage] = (name, tuple(p.shape), p.device, p.dtype)
        self.resource = resource
        self.phase = None
        self.reclaims = {}
        self.site_calls = {}
        self.g_phases = []

    @contextmanager
    def during(self, phase):
        require(self.phase is None, "nested native memory phase")
        self.phase = phase
        try:
            with self:
                yield
        finally:
            self.phase = None

    def reclaim(self, name, label):
        # As in the verified 205 path, the threshold is only a predicate to try
        # a safe release. Synchronize and check the actual device before acting.
        if torch.cuda.memory_reserved() - torch.cuda.memory_allocated() < 256 * 1024**2:
            return
        require(self.reclaims.get(self.phase, 0) < 256 and sum(self.reclaims.values()) < 1536, "cache action budget")
        self.resource(self.phase + "/" + name + "/" + label + "/before_reclaim")
        torch.cuda.synchronize()
        live, reserved = torch.cuda.memory_allocated(), torch.cuda.memory_reserved()
        if reserved - live < 256 * 1024**2:
            return
        torch.cuda.empty_cache()
        torch.cuda.synchronize()
        require(torch.cuda.memory_allocated() == live and torch.cuda.memory_reserved() <= reserved, "active storage changed")
        self.reclaims[self.phase] = self.reclaims.get(self.phase, 0) + 1
        self.resource(self.phase + "/" + name + "/" + label + "/after_reclaim")

    def __torch_dispatch__(self, func, types, args=(), kwargs=None):
        kwargs = kwargs or {}
        forward = func is torch.ops.aten.convolution.default
        backward = func is torch.ops.aten.convolution_backward.default
        if not (forward or backward):
            return func(*args, **kwargs)
        fields = tuple(a.name for a in func._schema.arguments)
        require(len(args) + len(kwargs) == len(fields) and not set(fields[:len(args)]) & kwargs.keys()
                and set(kwargs) <= set(fields), "unexpected convolution signature")
        values = {**dict(zip(fields, args)), **kwargs}
        w = values["weight"]
        identity = self.by_storage.get(w.untyped_storage().data_ptr())
        if identity is None:
            return func(*args, **kwargs)
        name, shape, device, dtype = identity
        require(tuple(w.shape) == shape and w.device == device and w.dtype == dtype and w.storage_offset() == 0, "stale leaf binding")
        self.reclaim(name, "pre_native")
        site = self.sites.get(name)
        if backward and site is not None and self.phase in PHASES and tuple(values["output_mask"]) == (True, True, True):
            require(list(values["input"].shape) == [1, site["inChannels"], 768, 1024]
                    and list(values["grad_output"].shape) == [1, 48, 768, 1024] and list(values["bias_sizes"]) == [48]
                    and values["groups"] == 1 and not values["transposed"] and list(values["output_padding"]) == [0, 0]
                    and all(list(values[k]) == [1, 1] for k in ("stride", "padding", "dilation"))
                    and values["input"].device == values["grad_output"].device == device and dtype == torch.float32, "changed v6 convolution")
            base = tuple(values[k] for k in fields[:-1])
            def part(label, mask):
                self.resource(self.phase + "/" + name + "/" + label + "/before")
                value = func(*base, mask)
                self.resource(self.phase + "/" + name + "/" + label + "/after")
                return value
            _, dw, db = part("weight_bias", (False, True, True))
            self.resource(self.phase + "/" + name + "/midpoint/before")
            self.reclaim(name, "safe_midpoint")
            self.resource(self.phase + "/" + name + "/midpoint/after")
            dx, _, _ = part("input", (True, False, False))
            require(all(g is not None for g in (dx, dw, db)), "missing requested gradient")
            output = (dx, dw, db)
            key = self.phase + "/" + name
            self.site_calls[key] = self.site_calls.get(key, 0) + 1
        else:
            output = func(*args, **kwargs)
        if backward:
            self.reclaim(name, "post_native")
        return output

    @contextmanager
    def training_call(self, model):
        # Original numerical code requests each of the five ordered VJPs via
        # torch.autograd.grad. Install only for this dedicated caller and restore
        # every hook on failure. Other parameter sets and threads pass through.
        require(_scope_lock.acquire(blocking=False), "another native training scope is active")
        saved = torch.autograd.grad
        owner = get_ident()
        parameters = tuple(model.parameters())
        context = None
        hooks = []
        def enter(*_):
            nonlocal context
            require(context is None, "duplicate forward scope")
            context = self.during("g_forward"); context.__enter__()
        def leave(*_):
            nonlocal context
            if context is not None:
                c, context = context, None; c.__exit__(None, None, None)
        def grad(loss, inputs, *args, **kwargs):
            if get_ident() != owner or not isinstance(inputs, (tuple, list)) or len(inputs) != len(parameters) or not all(a is b for a, b in zip(inputs, parameters)):
                return saved(loss, inputs, *args, **kwargs)
            require(len(self.g_phases) < len(PHASES), "extra model gradient")
            phase = PHASES[len(self.g_phases)]
            with self.during(phase):
                result = saved(loss, inputs, *args, **kwargs)
            self.g_phases.append(phase)
            return result
        try:
            hooks.append(model.register_forward_pre_hook(enter))
            hooks.append(model.register_forward_hook(leave, always_call=True))
            torch.autograd.grad = grad
            yield
        finally:
            torch.autograd.grad = saved
            leave()
            for hook in hooks:hook.remove()
            _scope_lock.release()


def parameter_digests(network):
    return {name: tensor_sha(t) for name, t in network.named_parameters()}


def perform_native_pair(model, critic, sample, order, optimizers, policy, resource, preview):
    import painter_stage4_rock_background_training_profile_v1 as profile
    require(policy == load_policy(Path(__file__).resolve().parents[5]), "unregistered policy")
    require(sample["split"] == "train" and tuple(order) == tuple(model.condition_channel_order), "invalid native train source")
    require(next(model.parameters()).device.type == "cuda" and not any(o.state for o in optimizers), "expected fresh GPU optimizers")
    for net,opt in zip((model,critic),optimizers,strict=True):
        require(type(opt) is torch.optim.AdamW and len(opt.param_groups)==1 and
                [id(p) for p in opt.param_groups[0]["params"]]==[id(p) for p in net.parameters()] and
                all(opt.param_groups[0].get(k)==v for k,v in OPT.items()),"wrong optimizer or parameter group")
    counts = {"generator": 0, "discriminator": 0}
    ledger = {"sampleId": sample["sampleId"], **counts}
    before = [parameter_digests(n) for n in (model, critic)]
    mode = NativeMemoryScope(model, policy, resource)
    completed = []
    def observe_step(name, loss):
        require(name == ("discriminator", "generator")[len(completed)] and counts[name] == 1, "wrong optimizer transition")
        completed.append(name)
        resource(name + "/updated")
    with mode.training_call(model):
        evidence = profile.perform_pair(model, critic, sample, order, *optimizers, counts, ledger,
            lambda: resource("normal_training_guard"), None, after_update=observe_step, prediction_observer=preview, support_structure_weight=0.1)
    require(completed == ["discriminator", "generator"] and counts == {"generator":1,"discriminator":1} and
            ledger == {"sampleId":sample["sampleId"],**counts} and tuple(mode.g_phases) == PHASES, "incomplete native update")
    require(all(mode.site_calls.get(phase+"/"+name,0) >= 1 for phase in PHASES for name in mode.sites),
            "registered same-loss site not observed")
    after = [parameter_digests(n) for n in (model, critic)]
    changed = [[k for k in a if a[k] != b[k]] for a,b in zip(after,before)]
    require(all(changed), "optimizer did not change each network")
    return {"counts":counts,"ledger":ledger,"changed":changed,"before":before,"after":after,
            "siteCalls":mode.site_calls,"cacheActions":mode.reclaims,"trainingEvidence":evidence}


def _optimizer_ticks(optimizer):
    require(len(optimizer.param_groups) == 1 and bool(optimizer.state), "missing AdamW state")
    group = optimizer.param_groups[0]
    require(all(group.get(k) == value for k,value in OPT.items()), "AdamW hyperparameters changed")
    for p, s in optimizer.state.items():
        require(set(s) == {"step","exp_avg","exp_avg_sq"} and s["step"].item() == 1
                and s["exp_avg"].shape == s["exp_avg_sq"].shape == p.shape, "wrong AdamW step state")


def encode_pair_checkpoint(networks, optimizers, lineage):
    for opt in optimizers:_optimizer_ticks(opt)
    data={"schema":CANDIDATE,"lineage":deepcopy(lineage),"policy":POLICY_SHA,"counts":{"generator":1,"discriminator":1},
          "parameters":[list(dict(n.named_parameters())) for n in networks],
          "networks":[_cpu_state(n.state_dict()) for n in networks],"optimizers":[_cpu_state(o.state_dict()) for o in optimizers]}
    return serialize_checkpoint(data)


def reload_pair_checkpoint(raw, expected_sha, networks, optimizers, lineage):
    require(hashlib.sha256(raw).hexdigest() == expected_sha, "checkpoint bytes changed")
    data=deserialize_checkpoint(raw)
    require(set(data)=={"schema","lineage","policy","counts","parameters","networks","optimizers"}
            and data["schema"]==CANDIDATE and data["policy"]==POLICY_SHA and json.dumps(data["lineage"],sort_keys=True)==json.dumps(lineage,sort_keys=True)
            and data["counts"]=={"generator":1,"discriminator":1} and all(type(i) is int for i in data["counts"].values())
            and len(data["networks"])==len(data["optimizers"])==2
            and data["parameters"]==[list(dict(n.named_parameters())) for n in networks],"checkpoint lineage or parameter identity differs")
    for n, saved in zip(networks,data["networks"],strict=True):
        require(set(n.state_dict())==set(saved) and all(t.dtype==saved[k].dtype and t.shape==saved[k].shape for k,t in n.state_dict().items()),
                "checkpoint tensor layout changed")
    targets=(*networks,*optimizers)
    backups=[deepcopy(_cpu_state(t.state_dict())) for t in targets]
    try:
        for n,saved in zip(networks,data["networks"],strict=True):
            n.load_state_dict(saved,strict=True)
            require(state_fingerprints(n.state_dict())==state_fingerprints(saved),"inexact network reload")
        for opt,saved in zip(optimizers,data["optimizers"],strict=True):
            opt.load_state_dict(saved);_optimizer_ticks(opt)
            require(state_fingerprints(opt.state_dict())==state_fingerprints(saved),"inexact optimizer reload")
    except BaseException:
        for target,original in zip(targets,backups,strict=True):target.load_state_dict(original)
        raise
    return data["counts"]
