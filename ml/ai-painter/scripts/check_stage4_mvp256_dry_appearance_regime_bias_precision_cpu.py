"""T-Q4-35 independent four-fixed-train CPU successor check; zero updates."""
from __future__ import annotations
import argparse
import ast
from copy import deepcopy
from datetime import datetime,timezone
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import _thread
import time

ROOT = Path(os.path.abspath(__file__)).parents[3]
sys.path.insert(0,str(ROOT/"ml/ai-painter/src")); sys.path.insert(0,str(ROOT/"ml/ai-painter/scripts"))
import torch
import compare_stage4_mvp256_dry_rgb_bias_precision_cpu as comparison
from ai_painter.complete_world.object_appearance_regime_bias_precision_cpu import (
    build_fresh_object_appearance_regime_bias_precision_cpu as build,seasonal_parameter,
    validate_model_identity,parameter_initialization_digest,CAPABILITY,ARCHITECTURE,NUMERIC_RULE)
parent = comparison.parent
require = parent.require
PROGRAM = "ml/ai-painter/scripts/check_stage4_mvp256_dry_appearance_regime_bias_precision_cpu.py"
TEST = "ml/ai-painter/tests/test_check_stage4_mvp256_dry_appearance_regime_bias_precision_cpu.py"
MODEL = "ml/ai-painter/src/ai_painter/complete_world/object_appearance_regime_bias_precision_cpu.py"
MODEL_TEST = "ml/ai-painter/tests/test_object_appearance_regime_bias_precision_cpu.py"
FILES = [MODEL,MODEL_TEST,PROGRAM,TEST]
OUTPUT = parent.DIAG+"/season-bias-precision-cpu-t-q4-35"
SPEC = {"path":parent.SPEC["path"],"sha256":"43fb07858b6436a20db77c3c3180e3ea935e2b1b0d5953ff6de3027baadb2511"}
GUIDE = {"path":parent.GUIDE["path"],"sha256":"7f094a570f73302858deb9ff3551a84a464ad91b168fc9e73afbc282dcf1c10d"}
WORK = {"path":OUTPUT+"/workorder.json","sha256":"f3517c22ebdf32d29efca4d675f0d8c649bbe0edd847696aa346c4d395b93d47"}
OLD_SPEC = {"path":OUTPUT+"/parent-formal-spec-1.42.bin","sha256":parent.SPEC["sha256"]}
OLD_GUIDE = {"path":comparison.OUTPUT+"/execution-guide-at-comparison.bin","sha256":comparison.GUIDE["sha256"]}
PRIOR_GUIDE = {"path":OUTPUT+"/guide-before-integration.bin","sha256":"a46546b6aa12c185a8bd1c30248c7d2cfa20b0469e878fab35ed4be12260fb4f"}
PREDECESSOR = {"path":comparison.OUTPUT+"/report.json","sha256":"d0e2048d2839b4ca49004c24dd06cf75a40d2a9ed43dbcdf56aad4a5ff6ee571"}
ACCEPT = {"path":comparison.OUTPUT+"/controller-acceptance.json","sha256":"f741237d3af4506f97956adb2ae6c8ceb7316462c573d40f6db04fc70628a6d4"}
SELECTED = ((2,"dry_season"),(3,"dry_to_wet_transition"),(0,"wet_season"),(1,"wet_to_dry_transition"))
BUDGET = {"cpuThreads":2,"seconds":180,"outputBytes":16777216,"attempts":1,"automaticRetries":0,
          "generatorForwards":4,"generatorAutograd":16,"discriminatorAutograd":4,"optimizerUpdates":0}
EXPECTED = {key:(4 if "Forwards" in key or key.startswith("discriminator") else 16) for key in parent.COUNTS}
summarize_all = comparison.summarize_all
discriminator_objective = parent.discriminator_train_objective
generator_objective = parent.train_object_core_fidelity_candidate_objective


class Counters(dict):
    def __init__(self):
        super().__init__(parent.COUNTS); self.window = dict(EXPECTED)
    def begin_case(self):
        self.window = {key:min(EXPECTED[key],self[key]+(1 if "Forwards" in key or key.startswith("discriminator") else 4)) for key in EXPECTED}
    def __setitem__(self,key,value):
        require(key in EXPECTED and type(value) is int and value == self[key]+1 and value <= self.window[key], "counter transition/call limit differs")
        super().__setitem__(key,value)


FrozenReader = comparison.FrozenReader


def historical_binding(binding):
    if binding["path"] == SPEC["path"]:
        require(binding["sha256"] == OLD_SPEC["sha256"], "unknown historical spec identity")
        return OLD_SPEC
    if binding["path"] == GUIDE["path"]:
        require(binding["sha256"] == OLD_GUIDE["sha256"], "unknown historical guide identity")
        return OLD_GUIDE
    return binding


def source_closure(reader):
    seen = set(comparison.source_closure(reader)); pending = list(FILES)
    roots = ("ml/ai-painter/src","ml/ai-painter/scripts","ml/ai-painter/tests")
    def locate(name):
        for root in roots:
            for suffix in (name.replace(".","/")+"/__init__.py",name.replace(".","/")+".py"):
                if reader.path(root+"/"+suffix).is_file(): return root+"/"+suffix
        return None
    while pending:
        path = pending.pop()
        if path in seen: continue
        seen.add(path); payload,_ = reader.snapshot(path)
        root = next(root for root in roots if path.startswith(root+"/")); parts = path[len(root)+1:].split("/")[:-1]
        for i in range(1,len(parts)+1):
            init = root+"/"+"/".join(parts[:i])+"/__init__.py"
            if reader.path(init).is_file(): pending.append(init)
        for node in ast.walk(ast.parse(payload,filename=path)):
            names = []
            if isinstance(node,ast.Import): names = [item.name for item in node.names]
            elif isinstance(node,ast.ImportFrom):
                base = ".".join(parts[:len(parts)-node.level+1]) if node.level else ""
                name = ".".join(v for v in (base,node.module) if v)
                names = [name]+[name+"."+item.name for item in node.names if item.name != "*"]
            for name in names:
                dependency = locate(name)
                if dependency: pending.append(dependency)
    return sorted(seen)


def prepare_metadata(reader,collect_assets=False):
    diagnostic = reader.json(comparison.capture.DIAGNOSTIC); proposal = reader.json(comparison.capture.PROPOSAL)
    manifest = reader.json(diagnostic["datasetManifest"]); split = reader.json(diagnostic["trainSplit"])
    condition = reader.json(comparison.capture.CONDITION); order = manifest["identityPayload"]["channelOrder"]
    require(split["split"] == "train" and len(split["sampleIds"]) == len(set(split["sampleIds"])) == 48
            and order == condition["tensorContract"]["channelOrder"] and len(order) == len(set(order)) == 23, "train/channel contract differs")
    continuous = manifest["identityPayload"]["continuousChannelIds"]
    require(continuous == condition["tensorContract"]["typePartitions"]["continuous"], "continuous channel contract differs")
    selected = {}
    for ordinal,season in SELECTED:
        rows = [row for row in diagnostic["rows"] if row["split"] == "train" and row["ordinal"] == ordinal]
        records = [row for row in proposal["records"] if row["trainOrdinal"] == ordinal]
        require(len(rows) == len(records) == 1, "fixed metadata absent/duplicate")
        row,record = rows[0],records[0]; identity = row["identity"]
        require(row["sampleId"] == identity["sampleId"] == split["sampleIds"][ordinal] == record["sampleIdEvidenceOnly"]
                and identity["split"] == "train" and record["appearanceValues"]["season"] == season
                and identity["conditionPack"] == record["conditionPack"] and identity["taskPackage"] == record["taskPackage"], "fixed source/train/season differs")
        selected[str(ordinal)] = {"identity":deepcopy(identity),"regimeRecord":deepcopy(record)}
        if collect_assets:
            code,_ = parent.bound_regime(reader,record)
            require(torch.equal(code,parent.encode_season(season)), "actual metadata season differs")
            pack = reader.json(identity["conditionPack"]); task = reader.json(identity["taskPackage"])
            require([item["id"] for item in pack["channels"]] == order, "bound pack channels differ")
            source = task["sourceBindings"]
            reader.read({"path":source["naturalizedWorldFactsPath"],"sha256":source["naturalizedWorldFactsSha256"]})
            reader.read(identity["visualFactManifestFile"]); reader.read(identity["image"])
            for channel in pack["channels"]: reader.read(channel)
    return {"order":order,"continuous":continuous,"selected":selected,
            "historyUsage":"Fixed train source metadata only; no holdout metrics/pixels/selection"}


def binding_template(reader=None):
    """Opaque file-byte hashes and metadata only; never decode/model/claim."""
    reader = reader or parent.Reader(); closure = source_closure(reader)
    for binding in (SPEC,GUIDE,WORK,OLD_SPEC,OLD_GUIDE,PRIOR_GUIDE,PREDECESSOR,ACCEPT,
                    comparison.PRECISION,comparison.PRECISION_TEST,comparison.capture.REGISTRY): reader.read(binding)
    previous = reader.json(PREDECESSOR)
    for binding in previous["inputs"]: reader.read(historical_binding(binding))
    prepare_metadata(reader,collect_assets=True); reader.unchanged()
    return {"schemaVersion":"t-q4-35-frozen-bindings-v1","task":"T-Q4-35","budget":BUDGET,
            "selection":[{"trainOrdinal":ordinal,"season":season} for ordinal,season in SELECTED],
            "historicalDocumentMapping":{"spec":OLD_SPEC,"guide":OLD_GUIDE,"priorGuide":PRIOR_GUIDE},
            "sourceClosure":closure,"bindings":[{"path":p,"sha256":sha} for p,sha in sorted(reader.observed.items())]}


def authenticate(reader,manifest):
    require(manifest["schemaVersion"] == "t-q4-35-frozen-bindings-v1" and manifest["task"] == "T-Q4-35"
            and manifest["budget"] == BUDGET and manifest["selection"] == [{"trainOrdinal":o,"season":s} for o,s in SELECTED]
            and manifest["historicalDocumentMapping"] == {"spec":OLD_SPEC,"guide":OLD_GUIDE,"priorGuide":PRIOR_GUIDE}, "frozen manifest contract differs")
    for binding in manifest["bindings"]: reader.read(binding)
    require(source_closure(reader) == manifest["sourceClosure"], "complete own source closure differs")
    for binding in (SPEC,GUIDE,WORK,OLD_SPEC,OLD_GUIDE,PRIOR_GUIDE,comparison.PRECISION): reader.read(binding)
    work = reader.json(WORK); previous = reader.json(PREDECESSOR); reader.read(ACCEPT)
    require(work["taskId"] == "T-Q4-35" and work["allowedCodeFiles"] == FILES and work["documents"] == [SPEC,GUIDE]
            and work["outputRoot"] == OUTPUT and work["budget"] == BUDGET and work["selection"] == manifest["selection"], "workorder differs")
    require(previous["status"] == "comparison_completed_candidate_probe_passed_single_train_not_qualified", "predecessor comparison differs")
    for binding in previous["inputs"]: reader.read(historical_binding(binding))
    registry = reader.json(comparison.capture.REGISTRY)
    require(registry["registryRevision"] == 371 and registry["activeExecution"] is None and registry["nextMachineAction"] is None, "registry not idle")
    parent.verify_loaded_sources(reader,manifest["sourceClosure"])
    return work


def graph(model):
    validate_model_identity(model)
    parameters,groups = parent._validate_model_and_parameters(model,tuple(model.parameters()))
    named = tuple(model.named_parameters()); seasonal = seasonal_parameter(model)
    index = next(i for i,value in enumerate(parameters) if value is seasonal)
    require(sum(p is seasonal for p in parameters) == 1 and index not in {i for rows in groups.values() for i in rows}
            and len(parameters) == 107 and sum(p.numel() for p in parameters) == 2240671, "complete successor graph differs")
    return parameters,groups,index,{"capability":CAPABILITY,"architecture":ARCHITECTURE,"numericRule":NUMERIC_RULE,
        "tensors":len(parameters),"elements":sum(p.numel() for p in parameters),"seasonalParameterIndex":index,"seasonalElements":seasonal.numel(),
        "parameters":[{"name":name,"shape":list(value.shape),"elements":value.numel()} for name,value in named],
        "headIndices":{role:list(rows) for role,rows in groups.items()},"storageAliases":False,
        "identityBuffers":["regime_identity","numeric_identity"]}


def autograd(loss,parameters,counters,kind,budget,retain=False,observed=None):
    budget(); counters[kind+"GradCallsAttempted"] += 1
    values = torch.autograd.grad(loss,parameters,retain_graph=retain,allow_unused=True)
    counters[kind+"GradCallsCompleted"] += 1
    if observed is not None: observed.append(values)
    require(all(value is None or bool(torch.isfinite(value).all()) for value in values), "nonfinite "+kind+" gradients")
    return values


def probe(model,critic,sample,code,counters,budget,*,failure_evidence=None):
    require(sample["split"] == "train", "gradient requires train")
    parameters,groups,season_index,actual_graph = graph(model)
    gradients = []; discriminator = []; current_error = None
    saved_source = {key:sample[key].clone() for key in ("image","conditions")}; saved_table = deepcopy(sample["objectInstanceTable"])
    saved_model,saved_critic = parent.state(model),parent.state(critic)
    rng = torch.random.get_rng_state().clone(); flags = comparison.backend_state()
    modes = [(module,module.training) for module in critic.modules()]; needed = [(p,p.requires_grad) for p in critic.parameters()]
    try:
        budget(); counters["generatorForwardsAttempted"] += 1
        prediction,evidence = model(sample["conditions"][None],sample["objectInstanceTable"],appearance_regime=code,return_evidence=True)
        counters["generatorForwardsCompleted"] += 1
        critic.train().requires_grad_(True)
        d_loss,_ = discriminator_objective(critic,prediction,sample)
        d_grad = autograd(d_loss,tuple(critic.parameters()),counters,"discriminator",budget,observed=discriminator)
        require(any(v is not None and bool(v.count_nonzero()) for v in d_grad), "critic gradient is zero")
        critic.eval().requires_grad_(False)
        total,parts = generator_objective(critic,prediction,sample,sample["objectInstanceTable"],model.condition_channel_order)
        values = (total,parts["v21UnchangedTotal"],parts["wholeFrameFidelity"],parts["objectCoreRgbWeighted"])
        for i,value in enumerate(values): autograd(value,parameters,counters,"generator",budget,retain=i<3,observed=gradients)
        identity = summarize_all(parameters,actual_graph,gradients,[])
        candidate,facts = parent.apply_object_head_core_priority_update_v24_cpu(model=model,parameters=parameters,
            total_gradients=gradients[0],structured_gradients=gradients[1],whole_frame_gradients=gradients[2],core_gradients=gradients[3])
        sg = gradients[0][season_index]; active = int(code.argmax())
        require(sg is not None and bool(sg.count_nonzero()), "seasonal actual-total gradient zero/missing")
        norms = [float(sg[:,i].norm()) for i in range(4)]
        require(norms[active] > 0 and all(norms[i] == 0 for i in range(4) if i != active), "seasonal slice reachability differs")
        require(torch.equal(candidate[season_index],sg), "seasonal non-head gradient changed")
        head_norms = {}
        for role,indexes in groups.items():
            head_norms[role] = float(torch.cat([candidate[i].reshape(-1) for i in indexes]).norm())
            if bool(sample["conditions"][model.condition_channel_order.index(role)].count_nonzero()):
                require(any(gradients[3][i] is not None and bool(gradients[3][i].count_nonzero()) for i in indexes), "applicable head core gradient zero: "+role)
                require(head_norms[role] > 0, "applicable projected head gradient zero: "+role)
        return {"loss":float(total.detach()),"discriminatorLoss":float(d_loss.detach()),"seasonalSliceL2":norms,
            "fourHeadUpdate":facts,"candidateHeadL2":head_norms,"objectCount":evidence["objectCount"],
            "allParameterIdentity":identity,"sourceUnchanged":True,"numericRule":NUMERIC_RULE}
    except BaseException as error:
        current_error = error
        try:
            parent.record_gradient_failure(failure_evidence,actual_graph,parameters,gradients,error)
            if failure_evidence is not None:
                failure_evidence["originalError"] = str(error)
                failure_evidence["gradientSetsAvailable"] = len(gradients)
                failure_evidence["discriminatorGradientSetsAvailable"] = len(discriminator)
                if len(gradients) == 4: failure_evidence["allParameterIdentity"] = summarize_all(parameters,actual_graph,gradients,[])
        except BaseException as secondary:
            if failure_evidence is not None:
                failure_evidence["originalError"] = str(error)
                failure_evidence.setdefault("secondaryDiagnosticErrors",[]).append({"type":type(secondary).__name__,"message":str(secondary)})
        raise
    finally:
        for module,mode in modes: module.training = mode
        for parameter,value in needed: parameter.requires_grad_(value)
        checks = ((lambda:parent.state(model) == saved_model and parent.state(critic) == saved_critic,"network state changed"),
                  (lambda:all(p.grad is None for network in (model,critic) for p in network.parameters()),"parameter .grad mutated"),
                  (lambda:all(comparison.same_bytes(sample[k],v) for k,v in saved_source.items()) and sample["objectInstanceTable"] == saved_table,"source/instance mutated"),
                  (lambda:torch.equal(rng,torch.random.get_rng_state()) and flags == comparison.backend_state(),"probe RNG/backend mutated"))
        try:
            for check,message in checks:
                try: require(check(),message)
                except BaseException as secondary:
                    if current_error is None: raise
                    if failure_evidence is not None:
                        failure_evidence.setdefault("secondaryInvariantErrors",[]).append({"type":type(secondary).__name__,"message":str(secondary)})
        finally:
            torch.random.set_rng_state(rng)
            torch.use_deterministic_algorithms(flags["deterministic"],warn_only=flags["warnOnly"])
            torch.backends.mkldnn.enabled = flags["mkldnnEnabled"]
            torch.backends.mkldnn.deterministic = flags["mkldnnDeterministic"]


def write_exclusive(output,name,value):
    require(name in ("claim.json","report.json","failure.json"), "terminal name differs")
    data = (json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+"\n").encode("utf-8")
    size = sum(path.stat().st_size for path in output.rglob("*") if path.is_file())
    require(len(data)+size <= BUDGET["outputBytes"], "combined 16MiB output budget exceeded")
    with (output/name).open("xb") as stream: stream.write(data); stream.flush(); os.fsync(stream.fileno())
    return {"path":str(output/name),"sha256":hashlib.sha256(data).hexdigest(),"bytes":len(data)}


def execute(binding=None,*,output=None,synthetic=False,prepare=None,loader=None,model_factory=None,
            baseline_factory=None,critic_factory=None,graph_function=None,probe_function=None,clock=None):
    output = Path(os.path.abspath(output or ROOT/OUTPUT))
    callbacks = (prepare,loader,model_factory,baseline_factory,critic_factory,graph_function,probe_function,clock)
    if synthetic:
        require(output.is_relative_to(Path(os.path.abspath(tempfile.gettempdir()))) and all(callbacks[:7]), "isolated synthetic callbacks required")
        reader = parent.Reader(); manifest = work = None
    else:
        require(output == Path(os.path.abspath(ROOT/OUTPUT)) and all(value is None for value in callbacks), "real callback/path overrides forbidden")
        require(binding and binding["path"] == OUTPUT+"/frozen-bindings.json", "new unique frozen manifest required")
        preliminary = parent.Reader(); manifest = preliminary.json(binding)
        reader = FrozenReader(manifest["bindings"]+[binding])
        prepare,loader,model_factory,baseline_factory = prepare_metadata,parent.load_real,build,parent.build
        critic_factory,graph_function,probe_function = parent.build_conditional_texture_discriminator,graph,probe
    output.mkdir(parents=True,exist_ok=True)
    require(not any((output/name).exists() for name in ("claim.json","report.json","failure.json")), "new check already consumed; no retry")
    require(sum(p.stat().st_size for p in output.rglob("*") if p.is_file()) <= BUDGET["outputBytes"]-1048576, "insufficient reserved terminal budget")
    write_exclusive(output,"claim.json",{"task":"T-Q4-35","capability":CAPABILITY,"numericRule":NUMERIC_RULE,
        "synthetic":synthetic,"binding":binding,"attempt":1,"automaticRetries":0,"recordedAtUtc":datetime.now(timezone.utc).isoformat()})
    clock = clock or time.monotonic; started = clock(); expired = threading.Event()
    def interrupt(): expired.set(); _thread.interrupt_main()
    timer = threading.Timer(180,interrupt); timer.daemon = True; timer.start()
    def budget(): require(not expired.is_set() and 0 <= clock()-started < 180, "CPU180-second budget exceeded")
    rng = torch.random.get_rng_state().clone(); threads = torch.get_num_threads(); flags = comparison.backend_state()
    counters = Counters(); results = []; evidence = {}; actual_graph = plan = initial = initialization = None
    boundary = {"synthetic":synthetic,"qualified":False,"fixedFourCpuEvidenceOnly":True,"all48CpuGpuQualified":False,
                "GPU":False,"optimizerUpdates":0,"checkpoint":False,"PNG":False,"registryWritten":False,"trainingAllowed":False}
    try:
        torch.set_num_threads(2)
        with comparison.capture.guards(output),torch.random.fork_rng(devices=[]):
            budget(); require(not torch.cuda.is_initialized(), "CUDA already initialized")
            if not synthetic: work = authenticate(reader,manifest)
            plan = prepare(reader)
            model = model_factory(condition_channel_order=plan["order"]).train()
            baseline = baseline_factory(condition_channel_order=plan["order"]).train()
            old_parameters,new_parameters = tuple(baseline.named_parameters()),tuple(model.named_parameters())
            require(len(old_parameters) == len(new_parameters) and all(n==m and comparison.same_bytes(p,q)
                    for (n,p),(m,q) in zip(old_parameters,new_parameters)), "original parameter initialization differs")
            initialization = {"originalParameterDigest":parameter_initialization_digest(baseline),
                              "successorParameterDigest":parameter_initialization_digest(model),
                              "originalState":parent.state(baseline),"successorState":parent.state(model),
                              "nonparameterIdentityDifferenceExpected":not synthetic}
            del baseline
            with torch.random.fork_rng(devices=[]):
                torch.manual_seed(20260929); critic = critic_factory().eval().requires_grad_(False)
            _,_,_,actual_graph = graph_function(model)
            initial = {"model":parent.state(model),"critic":parent.state(critic)}
            if not synthetic:
                require(actual_graph["tensors"] == work["invariants"]["parameters"] == 107
                        and actual_graph["elements"] == work["invariants"]["parameterElements"] == 2240671
                        and actual_graph["seasonalElements"] == 1152, "workorder actual graph differs")
            for ordinal,season in SELECTED:
                budget(); before = dict(counters); counters.begin_case()
                evidence = {"status":"not_started","trainOrdinal":ordinal,"season":season}
                sample,code,identity = loader(reader,plan,ordinal,season)
                require(sample["split"] == "train" and torch.equal(code,parent.encode_season(season)), "fixed train regime differs")
                expected_id = plan["selected"][str(ordinal)]["identity"]
                require(sample["sampleId"] == expected_id["sampleId"], "fixed loaded train source differs")
                saved = {key:sample[key].clone() for key in ("image","conditions")}; table = deepcopy(sample["objectInstanceTable"])
                facts = probe_function(model,critic,sample,code,counters,budget,failure_evidence=evidence)
                delta = {key:counters[key]-before[key] for key in counters}
                require(delta == comparison.capture.EXPECTED_COUNTS, "per-case exact counts differ")
                require(initial == {"model":parent.state(model),"critic":parent.state(critic)}
                        and all(p.grad is None for network in (model,critic) for p in network.parameters()), "per-case network state changed")
                require(all(comparison.same_bytes(sample[k],v) for k,v in saved.items()) and sample["objectInstanceTable"] == table, "source/instance changed")
                require(flags == comparison.backend_state(), "backend changed")
                if not synthetic: validate_model_identity(model); parent.verify_loaded_sources(reader,manifest["sourceClosure"])
                reader.unchanged(); budget()
                results.append({"trainOrdinal":ordinal,"season":season,"sourceIdentity":expected_id,"loadedIdentity":identity,
                                "callCounts":delta,**facts})
            require(dict(counters) == EXPECTED and len(results) == 4, "four-case exact counts incomplete")
            reader.unchanged(); budget()
        require(torch.equal(rng,torch.random.get_rng_state()), "caller RNG not restored")
        return write_exclusive(output,"report.json",{"schemaVersion":"t-q4-35-versioned-season-bias-cpu-v1",
            "task":"T-Q4-35","status":"fixed_four_cpu_checked_not_execution_qualified","capability":CAPABILITY,
            "architecture":ARCHITECTURE,"numericRule":NUMERIC_RULE,"boundary":boundary,"binding":binding,
            "actualGraph":actual_graph,"parameterInitialization":initialization,"initialState":initial,
            "finalState":{"model":parent.state(model),"critic":parent.state(critic)},"sampleResults":results,
            "callCounts":dict(counters),"budget":BUDGET,"inputs":[{"path":p,"sha256":sha} for p,sha in sorted(reader.observed.items())],
            "unverified":["successor lifecycle","actual CUDA implementation","all48 GPU admission","training","visual/Runtime/Stage4 release"],
            "elapsedSeconds":clock()-started,"recordedAtUtc":datetime.now(timezone.utc).isoformat()})
    except BaseException as error:
        write_exclusive(output,"failure.json",{"schemaVersion":"t-q4-35-versioned-season-bias-cpu-v1","task":"T-Q4-35",
            "status":"cpu_failed_closed","errorType":type(error).__name__,"error":str(error),"gradientFailureEvidence":evidence,
            "callCounts":dict(counters),"partialResults":results,"actualGraph":actual_graph,"initialState":initial,
            "parameterInitialization":initialization,"boundary":boundary,"binding":binding,
            "inputs":[{"path":p,"sha256":sha} for p,sha in sorted(reader.observed.items())],"elapsedSeconds":clock()-started})
        raise
    finally:
        timer.cancel(); torch.random.set_rng_state(rng); torch.set_num_threads(threads)
        torch.use_deterministic_algorithms(flags["deterministic"],warn_only=flags["warnOnly"])
        torch.backends.mkldnn.enabled = flags["mkldnnEnabled"]; torch.backends.mkldnn.deterministic = flags["mkldnnDeterministic"]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bindings",required=True); parser.add_argument("--sha256",required=True)
    args = parser.parse_args(); require(ROOT == Path("F:/ai-pet-world"), "fixed workspace required")
    print(json.dumps(execute({"path":args.bindings,"sha256":args.sha256}),ensure_ascii=False))
