"""Independent T-Q4-34 single-train, zero-update native/bias-precision comparison.

No production factory or historical execution is modified or replayed. Hooks
only observe existing outputs and VJPs. Actual execution belongs to controller.
"""
from __future__ import annotations
import argparse
import ast
from contextlib import contextmanager
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile
import threading
import _thread
import time
from unittest.mock import patch

ROOT = Path(os.path.abspath(__file__)).parents[3]
sys.path.insert(0, str(ROOT/"ml/ai-painter/src"))
sys.path.insert(0, str(ROOT/"ml/ai-painter/scripts"))
import torch
import diagnose_stage4_mvp256_dry_appearance_regime_gradient_cpu as capture
from ai_painter.complete_world.rgb_bias_reduction_precision_cpu import rgb_bias_reduction_precision_cpu
parent = capture.parent
require = parent.require
PROGRAM = "ml/ai-painter/scripts/compare_stage4_mvp256_dry_rgb_bias_precision_cpu.py"
TEST = "ml/ai-painter/tests/test_compare_stage4_mvp256_dry_rgb_bias_precision_cpu.py"
OUTPUT = parent.DIAG+"/bias-reduction-real-comparison-t-q4-34"
T33 = parent.DIAG+"/bias-reduction-proposal-t-q4-33"
TARGET = "core.core.final_rgb_decoder.base.layers.4"
BIAS = TARGET+".bias"
IMPLEMENTATION = "t-q4-34_task_local_native_vs_rgb_bias_fp64_cpu_diagnostic"
SPEC = dict(capture.SPEC)
GUIDE = {"path": capture.GUIDE["path"], "sha256": "3f233a1f0a1389f68f91a6b79740e6ad1841f8f6eaab3931e6092df82ec96df9"}
PRECISION = {"path": "ml/ai-painter/src/ai_painter/complete_world/rgb_bias_reduction_precision_cpu.py", "sha256": "958ece1e2bd967d9c0b7f9f99f183d2b496c6b23bb767702816aeed89c8c2cab"}
PRECISION_TEST = {"path": "ml/ai-painter/tests/test_rgb_bias_reduction_precision_cpu.py", "sha256": "9b1f1cf46c0ec442cbdfd4a8146bfc48fef0721ba408932df7b2e23c67cd945f"}
T32_REPORT = {"path": capture.OUTPUT+"/report.json", "sha256": "909fc1abd20f2a44744fd1dde88c249c79dbb1d2a9f5aa0e3ae65174b9ac7466"}
T33_REPORT = {"path": T33+"/report.json", "sha256": "9a06ed4fce4a323284743f72147e562f4eeac8a462b70cb4d298c9c421e8f005"}
T33_ACCEPT = {"path": T33+"/controller-acceptance.json", "sha256": "748190d6da3cc1c890a4004fca2b89208ea6bf60d5f9733ebc68fa307428e3ca"}
T33_GUIDE = {"path": T33+"/execution-guide-at-proposal.bin", "sha256": "0aa98a7ce4a8b37f1a834f74ee92a4d0ac12793e8e2ae30a1482d4c1439c8ce7"}
WORK = {"path": OUTPUT+"/work-order.json", "sha256": "1b2408ea70526b97353c5aa4c9fef3a00dc728e54e948f2e59ee1dba9d25a50a"}
LIMITS = {"cpuThreads": 2, "wallSeconds": 120, "paths": 2, "generatorForwardsPerPath": 1,
          "generatorAutogradCallsPerPath": 4, "discriminatorAutogradCallsPerPath": 1,
          "optimizerSteps": 0, "attempts": 1, "automaticRetries": 0,
          "combinedOutputBytes": 2097152, "gradientExamples": 8}


class FrozenReader(capture.FrozenReader):
    def read(self, binding):
        require(binding["path"] in self.frozen and self.frozen[binding["path"]] == binding["sha256"],
                "read outside frozen closure: "+binding["path"])
        return super().read(binding)


def source_closure(reader):
    seen = set(capture.source_closure(reader))
    pending = [PROGRAM, TEST, PRECISION["path"], PRECISION_TEST["path"]]
    roots = ("ml/ai-painter/src", "ml/ai-painter/scripts", "ml/ai-painter/tests")
    def locate(name):
        for root in roots:
            for suffix in (name.replace(".","/")+"/__init__.py", name.replace(".","/")+".py"):
                if reader.path(root+"/"+suffix).is_file(): return root+"/"+suffix
        return None
    while pending:
        path = pending.pop()
        if path in seen: continue
        seen.add(path); payload, _ = reader.snapshot(path)
        root = next(root for root in roots if path.startswith(root+"/"))
        parts = path[len(root)+1:].split("/")[:-1]
        for i in range(1,len(parts)+1):
            init = root+"/"+"/".join(parts[:i])+"/__init__.py"
            if reader.path(init).is_file(): pending.append(init)
        for node in ast.walk(ast.parse(payload,filename=path)):
            names = []
            if isinstance(node,ast.Import): names = [item.name for item in node.names]
            elif isinstance(node,ast.ImportFrom):
                base = ".".join(parts[:len(parts)-node.level+1]) if node.level else ""
                name = ".".join(value for value in (base,node.module) if value)
                names = [name]+[name+"."+item.name for item in node.names if item.name != "*"]
            for name in names:
                path = locate(name)
                if path: pending.append(path)
    return sorted(seen)


def binding_template(reader=None):
    """Read/hash only: no PNG decode, model construction, forward or claim."""
    reader = reader or parent.Reader()
    closure = source_closure(reader)
    seeds = (SPEC, GUIDE, capture.PARENT_SOURCE, capture.PARENT_TEST, capture.OLD_CLAIM,
             capture.OLD_FAILURE, capture.REGISTRY, PRECISION, PRECISION_TEST, T32_REPORT,
             T33_REPORT, T33_ACCEPT, T33_GUIDE, WORK)
    for binding in seeds: reader.read(binding)
    historical = reader.json(T32_REPORT)
    # Rebind only the current authority. All old source/data bytes stay exact.
    for binding in historical["inputs"]:
        reader.read(GUIDE if binding["path"] == GUIDE["path"] else binding)
    reader.unchanged()
    return {"schemaVersion":"t-q4-34-frozen-bindings-v1","task":"T-Q4-34","limits":LIMITS,
            "sample":{"split":"train","trainOrdinal":2,"season":"dry_season"},
            "guideRebinding":{"oldCaptureGuide":capture.GUIDE,"currentGuide":GUIDE,
                              "proposalGuideSnapshot":T33_GUIDE},
            "sourceClosure":closure,"bindings":[{"path":p,"sha256":sha} for p,sha in sorted(reader.observed.items())]}


def authenticate(reader, manifest):
    require(manifest["schemaVersion"] == "t-q4-34-frozen-bindings-v1" and manifest["task"] == "T-Q4-34"
            and manifest["limits"] == LIMITS and manifest["sample"] == {"split":"train","trainOrdinal":2,"season":"dry_season"}, "manifest contract differs")
    for binding in manifest["bindings"]: reader.read(binding)
    require(source_closure(reader) == manifest["sourceClosure"], "complete source closure differs")
    require(manifest["guideRebinding"] == {"oldCaptureGuide":capture.GUIDE,"currentGuide":GUIDE,"proposalGuideSnapshot":T33_GUIDE}, "guide rebind differs")
    for binding in (SPEC, GUIDE, capture.PARENT_SOURCE, capture.PARENT_TEST, capture.OLD_CLAIM,
                    capture.OLD_FAILURE, PRECISION, PRECISION_TEST, T33_GUIDE): reader.read(binding)
    registry = reader.json(capture.REGISTRY)
    require(registry["registryRevision"] == 371 and registry["activeExecution"] is None
            and registry["nextMachineAction"] is None, "registry not idle")
    work = reader.json(WORK)
    require(work["task"] == "T-Q4-34" and work["head"] == "8eba77b064cafb750557385687c855fe1e42bc28"
            and work["limits"] == LIMITS and work["spec"] == SPEC and work["guide"] == GUIDE
            and work["allowedNewFiles"] == [PROGRAM,TEST] and work["frozenCandidate"] == PRECISION,
            "work-order differs")
    historical = reader.json(T32_REPORT); proposal = reader.json(T33_REPORT); accepted = reader.json(T33_ACCEPT)
    require(historical["status"] == "capture_completed_original_check_rejected" and historical["trainOrdinal"] == 2
            and historical["season"] == "dry_season" and historical["actualGraph"]["tensors"] == 107
            and historical["actualGraph"]["parameters"][90]["name"] == BIAS
            and historical["initialState"] == historical["finalState"], "original capture binding differs")
    require(accepted["report"] == T33_REPORT and accepted["sources"] == [PRECISION,PRECISION_TEST]
            and proposal["sourceBindings"][0:2] == [PRECISION,PRECISION_TEST], "proposal source/acceptance differs")
    saved_guide = next(item for item in proposal["sourceBindings"] if item["path"] == GUIDE["path"])
    require(saved_guide["sha256"] == T33_GUIDE["sha256"], "historical guide snapshot differs")
    for binding in historical["inputs"]:
        reader.read(GUIDE if binding["path"] == GUIDE["path"] else binding)
    parent.verify_loaded_sources(reader,manifest["sourceClosure"])
    return historical, work


def same_bytes(left, right):
    return (left.shape == right.shape and left.dtype == right.dtype and left.device == right.device
            and torch.equal(left.detach().contiguous().reshape(-1).view(torch.uint8),right.detach().contiguous().reshape(-1).view(torch.uint8)))


def tensor_digest(value):
    return {"shape":list(value.shape),"dtype":str(value.dtype),
            "sha256":hashlib.sha256(value.detach().contiguous().numpy().tobytes()).hexdigest()}


def backend_state():
    return {"deterministic":torch.are_deterministic_algorithms_enabled(),
            "warnOnly":torch.is_deterministic_algorithms_warn_only_enabled(),
            "mkldnnEnabled":torch.backends.mkldnn.enabled,
            "mkldnnDeterministic":torch.backends.mkldnn.deterministic}


class DiagnosticRGBConv(torch.nn.Conv2d):
    def forward(self, value): return rgb_bias_reduction_precision_cpu(value,self.weight,self.bias)


def install_candidate(model):
    original = model.get_submodule(TARGET)
    require(type(original) is torch.nn.Conv2d and original.in_channels == 48 and original.out_channels == 3
            and original.kernel_size == (1,1) and original.stride == (1,1) and original.padding == (0,0)
            and original.dilation == (1,1) and original.groups == 1 and original.padding_mode == "zeros"
            and original.bias is not None, "target convolution differs")
    before_state = parent.state(model); before_parameters = tuple(model.named_parameters())
    with torch.random.fork_rng(devices=[]): replacement = DiagnosticRGBConv(48,3,1,bias=True)
    replacement.weight, replacement.bias = original.weight, original.bias
    replacement.train(original.training)
    owner, leaf = TARGET.rsplit(".",1); model.get_submodule(owner)._modules[leaf] = replacement
    after_parameters = tuple(model.named_parameters())
    require(len(before_parameters) == len(after_parameters)
            and all(n == m and p is q for (n,p),(m,q) in zip(before_parameters,after_parameters))
            and parent.state(model) == before_state, "replacement parameter/state identity differs")
    return {"implementation":IMPLEMENTATION,"target":TARGET,"parameterObjectsPreserved":True,
            "releaseIdentity":None,"qualification":False}


@contextmanager
def observe(model, trace):
    """Return values and gradient gates remain untouched; no additional VJP."""
    handles = []; original = parent.autograd
    def model_output(_module, _arguments, result):
        value = result[0] if isinstance(result,tuple) else result
        require(isinstance(value,torch.Tensor), "whole forward tensor missing")
        trace["forward"].append(value.detach().clone())
    def target_output(_module, arguments, result):
        trace["targetInputs"].append(tensor_digest(arguments[0]))
        def incoming(value): trace["gradOutputs"].append(value.detach().clone())
        handles.append(result.register_hook(incoming))
    def autograd(loss, parameters, counters, kind, budget, retain=False):
        trace["scalars"][kind].append(loss.detach().clone())
        result = original(loss,parameters,counters,kind,budget,retain=retain)
        trace["gradients"][kind].append(tuple(None if value is None else value.detach().clone() for value in result))
        return result
    try:
        handles.extend((model.register_forward_hook(model_output),model.get_submodule(TARGET).register_forward_hook(target_output)))
        with patch.object(parent,"autograd",autograd): yield
    finally:
        for handle in handles: handle.remove()


def complete_trace(trace, parameters, critic_parameters, counters):
    require(dict(counters) == capture.EXPECTED_COUNTS, "incomplete path call counts")
    require(len(trace["forward"]) == len(trace["targetInputs"]) == 1 and len(trace["gradOutputs"]) == 4
            and len(trace["gradients"]["generator"]) == len(trace["scalars"]["generator"]) == 4
            and len(trace["gradients"]["discriminator"]) == len(trace["scalars"]["discriminator"]) == 1,
            "incomplete observed forward/VJP/scalars")
    require(all(len(values) == len(parameters) for values in trace["gradients"]["generator"])
            and len(trace["gradients"]["discriminator"][0]) == len(critic_parameters), "observed gradient graph incomplete")


def summarize_all(parameters, graph, gradients, examples):
    require(len(gradients) == 4 and len(graph["parameters"]) == len(parameters), "complete gradient graph missing")
    rows, failed = [], []
    for index, parameter in enumerate(parameters):
        actual_values = [values[index] for values in gradients]
        missing = [value is None for value in actual_values]
        valid = all(value is None or (value.shape == parameter.shape and value.dtype == torch.float32
                    and value.device.type == "cpu") for value in actual_values)
        finite = [None if value is None else bool(torch.isfinite(value).all()) for value in actual_values]
        row = {"index":index,"name":graph["parameters"][index]["name"],"shape":list(parameter.shape),
               "noneGradients":dict(zip(("actualTotal","structured","wholeFrame","core"),missing)),
               "finiteGradients":dict(zip(("actualTotal","structured","wholeFrame","core"),finite))}
        if not valid or False in finite:
            row.update({"status":"invalid_or_nonfinite","outsideToleranceElements":None,"maxAbsDifference":None}); failed.append(index)
        else:
            actual, structured, whole, core = [torch.zeros_like(parameter) if value is None else value for value in actual_values]
            expected = (structured.float()+whole.float()).float()+core.float()
            mask = torch.isclose(actual,expected,atol=1e-6,rtol=1e-5)
            difference = (actual.double()-expected.double()).abs()
            outside = int((~mask).sum())
            row.update({"status":"finite" if bool(torch.isfinite(expected).all()) else "nonfinite_expected_fp32",
                        "outsideToleranceElements":outside,"maxAbsDifference":parent.diagnostic_number(float(difference.max())),
                        "atol":1e-6,"rtol":1e-5,"expectedFp32Finite":bool(torch.isfinite(expected).all())})
            if outside:
                failed.append(index)
                for offset in (~mask).reshape(-1).nonzero().reshape(-1)[:max(0,8-len(examples))].tolist():
                    examples.append({"parameterIndex":index,"flatIndex":offset,
                                     "actual":parent.diagnostic_number(actual.reshape(-1)[offset]),
                                     "expected":parent.diagnostic_number(expected.reshape(-1)[offset])})
        rows.append(row)
    return {"formula":"(structured.float()+wholeFrame.float()).float()+core.float()",
            "parameterCount":len(rows),"parameters":rows,"allFailureIndices":failed,
            "passedAllOriginalToleranceMasks":not failed}


def trace_report(trace, parameters, graph, target_index, examples):
    summary = summarize_all(parameters,graph,trace["gradients"]["generator"],examples)
    bias = []
    for i, name in enumerate(("independentTotal","structured","wholeFrame","core")):
        incoming = trace["gradOutputs"][i]; value = trace["gradients"]["generator"][i][target_index]
        require(incoming.dtype == torch.float32 and incoming.device.type == "cpu" and incoming.ndim == 4
                and tuple(incoming.shape[:2]) == (1,3) and bool(torch.isfinite(incoming).all())
                and value is not None and value.shape == (3,), "target bias/grad_output missing")
        reference64 = incoming.double().sum((0,2,3)); reference32 = reference64.float()
        bias.append({"loss":name,"bias":value.tolist(),"gradOutput":tensor_digest(incoming),
                     "float64Reduction":reference64.tolist(),"float64ReturnedFloat32":reference32.tolist(),
                     "matchesFloat64ReturnedFloat32":same_bytes(value,reference32),
                     "maxErrorToFloat64":parent.diagnostic_number(float((value.double()-reference64).abs().max()))})
    gradients = trace["gradients"]["generator"]
    values = [row[target_index] for row in gradients]
    actual, structured, whole, core = values
    expected = (structured.float()+whole.float()).float()+core.float()
    return {"wholeForward":tensor_digest(trace["forward"][0]),"targetInputs":trace["targetInputs"],
            "scalars":{kind:[parent.diagnostic_number(float(value)) for value in rows] for kind,rows in trace["scalars"].items()},
            "allParameterIdentity":summary,"targetBiasFourVjps":bias,
            "targetOriginalToleranceMask":torch.isclose(actual,expected,atol=1e-6,rtol=1e-5).tolist(),
            "targetIndependentTotal":actual.tolist(),"targetExpectedFp32":expected.tolist(),
            "targetDifferenceFloat64":(actual.double()-expected.double()).tolist(),
            "discriminatorGradients":[None if value is None else tensor_digest(value) for value in trace["gradients"]["discriminator"][0]]}


def compare_traces(native, candidate, target_index):
    require(same_bytes(native["forward"][0],candidate["forward"][0]), "whole forward bytes differ")
    require(native["targetInputs"] == candidate["targetInputs"], "target input bytes differ")
    for kind in ("generator","discriminator"):
        require(all(same_bytes(left,right) for left,right in zip(native["scalars"][kind],candidate["scalars"][kind])), kind+" scalar bytes differ")
        for lefts, rights in zip(native["gradients"][kind],candidate["gradients"][kind]):
            for index,(left,right) in enumerate(zip(lefts,rights)):
                if kind == "generator" and index == target_index: continue
                require((left is right is None) or (left is not None and right is not None and same_bytes(left,right)),
                        "non-target "+kind+" gradient bytes differ at "+str(index))
    require(all(same_bytes(left,right) for left,right in zip(native["gradOutputs"],candidate["gradOutputs"])), "target grad_output bytes differ")
    return {"wholeForwardByteEqual":True,"allNonTargetGeneratorGradientsByteEqual":True,
            "discriminatorGradientsByteEqual":True,"allScalarsByteEqual":True,"targetGradOutputsByteEqual":True}


def gate_outcome(error, evidence, summary):
    if error is None:
        require(summary["passedAllOriginalToleranceMasks"], "probe passed while original masks rejected")
        return {"status":"original_complete_probe_passed","error":None}
    match = re.fullmatch(r"actual total gradient identity differs at parameter (\d+)",str(error))
    require(type(error) is ValueError and match and summary["allFailureIndices"]
            and int(match[1]) == summary["allFailureIndices"][0]
            and evidence.get("originalError") == str(error), "unexpected probe exception or inconsistent first gate")
    return {"status":"original_gradient_gate_rejected","error":{"type":type(error).__name__,"message":str(error)},
            "failedGate":"original_v24_actual_total_gradient_identity","firstRejectedParameter":int(match[1])}


def execute(binding=None, *, output=None, synthetic=False, prepare=None, loader=None, model_factory=None,
            critic_factory=None, graph_function=None, probe_function=None, installer=None, clock=None):
    output = Path(os.path.abspath(output or ROOT/OUTPUT))
    callbacks = (prepare,loader,model_factory,critic_factory,graph_function,probe_function,installer,clock)
    if synthetic:
        require(output.is_relative_to(Path(os.path.abspath(tempfile.gettempdir()))) and all(value for value in callbacks[:6]),
                "synthetic callbacks require isolated system-temp namespace")
        reader = parent.Reader(); manifest = historical = work = None
        installer = installer or install_candidate
    else:
        require(output == Path(os.path.abspath(ROOT/OUTPUT)) and all(value is None for value in callbacks), "real overrides forbidden")
        require(binding and binding["path"] == OUTPUT+"/frozen-bindings.json", "independent frozen manifest required")
        preliminary = parent.Reader(); manifest = preliminary.json(binding)
        reader = FrozenReader(manifest["bindings"]+[binding])
        prepare,loader,model_factory = capture.prepare_metadata,parent.load_real,parent.build
        critic_factory,graph_function,probe_function,installer = parent.build_conditional_texture_discriminator,parent.graph,parent.probe,install_candidate
    output.mkdir(parents=True,exist_ok=True)
    require(not any((output/name).exists() for name in ("claim.json","report.json","failure.json")), "independent comparison already consumed; no retry")
    require(capture.output_bytes(output) <= LIMITS["combinedOutputBytes"]-262144, "insufficient reserved terminal quota")
    capture.write_exclusive(output,"claim.json",{"task":"T-Q4-34","implementation":IMPLEMENTATION,"synthetic":synthetic,
                            "binding":binding,"attempt":1,"automaticRetries":0,"recordedAtUtc":datetime.now(timezone.utc).isoformat()})
    clock = clock or time.monotonic; started = clock(); expired = threading.Event()
    def interrupt(): expired.set(); _thread.interrupt_main()
    timer = threading.Timer(120,interrupt); timer.daemon = True; timer.start()
    def budget(): require(not expired.is_set() and 0 <= clock()-started < 120, "120-second comparison budget exceeded")
    caller_rng = torch.random.get_rng_state().clone(); old_threads = torch.get_num_threads()
    flags = backend_state()
    traces, results, counts, examples = {}, [], {}, []
    original_errors = {}
    current_evidence = {}
    plan = identity = initial = graph = parity = None
    boundary = {"synthetic":synthetic,"qualified":False,"all48CpuQualified":False,"GPU":False,"trainingAllowed":False,
                "optimizerSteps":0,"checkpoint":False,"PNG":False,"registryWritten":False,"oldClaimsReused":False}
    try:
        torch.set_num_threads(2)
        with capture.guards(output), torch.random.fork_rng(devices=[]):
            budget(); require(not torch.cuda.is_initialized(), "CUDA already initialized")
            if not synthetic: historical,work = authenticate(reader,manifest)
            plan = prepare(reader)
            require(plan["trainOrdinal"] == 2 and plan["season"] == "dry_season", "fixed plan differs")
            if not synthetic: require(plan["sourceIdentity"]["sampleId"] == work["sample"]["sampleId"], "work sample differs")
            sample,code,identity = loader(reader,plan,2,"dry_season")
            require(sample["split"] == "train" and sample["sampleId"] == plan["sourceIdentity"]["sampleId"]
                    and torch.equal(code,parent.encode_season("dry_season")), "loaded train/season differs")
            saved_source = {key:sample[key].clone() for key in ("image","conditions")}; saved_table = deepcopy(sample["objectInstanceTable"])
            initial = {}; graph = {}; networks = {}
            for path in ("native","candidate"):
                budget(); model = model_factory(condition_channel_order=plan["order"]).train()
                with torch.random.fork_rng(devices=[]):
                    torch.manual_seed(20260929); critic = critic_factory().eval().requires_grad_(False)
                replacement = installer(model) if path == "candidate" else None
                parameters,_,_,actual_graph = graph_function(model)
                graph[path] = actual_graph; initial[path] = {"model":parent.state(model),"critic":parent.state(critic)}
                networks[path] = (model,critic,parameters)
            require(initial["native"] == initial["candidate"] and graph["native"] == graph["candidate"], "initial state or parameter graph differs")
            names = [row["name"] for row in graph["native"]["parameters"]]
            require(names.count(BIAS) == 1, "target bias absent or duplicated")
            target_index = names.index(BIAS)
            if not synthetic:
                require(graph["native"] == historical["actualGraph"] and initial["native"] == historical["initialState"]
                        and len(names) == 107 and target_index == 90, "actual graph/state differs from immutable T32 capture")
            for path in ("native","candidate"):
                budget(); model,critic,parameters = networks[path]
                trace = {"forward":[],"targetInputs":[],"gradOutputs":[],"scalars":{"generator":[],"discriminator":[]},"gradients":{"generator":[],"discriminator":[]}}
                traces[path] = trace; counters = capture.LimitedCounters(); counts[path] = counters
                evidence = {}; error = facts = None
                current_evidence = evidence
                before_rng = torch.random.get_rng_state().clone()
                try:
                    with observe(model,trace): facts = probe_function(model,critic,sample,code,counters,budget,failure_evidence=evidence)
                except BaseException as original:
                    error = original; original_errors[path] = {"type":type(original).__name__,"message":str(original)}
                require(initial[path] == {"model":parent.state(model),"critic":parent.state(critic)}
                        and all(p.grad is None for network in (model,critic) for p in network.parameters()), "model/critic state changed")
                require(torch.equal(before_rng,torch.random.get_rng_state()) and all(same_bytes(sample[k],v) for k,v in saved_source.items())
                        and sample["objectInstanceTable"] == saved_table, "RNG/source/instances changed")
                require(flags == backend_state(), "backend changed")
                if error is not None and dict(counters) != capture.EXPECTED_COUNTS: raise error
                if error is not None and not (type(error) is ValueError and re.fullmatch(r"actual total gradient identity differs at parameter \d+",str(error))): raise error
                complete_trace(trace,parameters,tuple(critic.parameters()),counters)
                summary = trace_report(trace,parameters,graph[path],target_index,examples)
                gate = gate_outcome(error,evidence,summary["allParameterIdentity"])
                results.append({"path":path,"diagnosticImplementation":IMPLEMENTATION if path == "candidate" else "original_native_probe",
                                "gate":gate,"originalErrorEvidence":{k:v for k,v in evidence.items() if k != "examples"},
                                "probeFacts":facts,"measurements":summary,"initialState":initial[path],
                                "finalState":{"model":parent.state(model),"critic":parent.state(critic)}})
                budget()
            parity = compare_traces(traces["native"],traces["candidate"],target_index)
            require(all(row["matchesFloat64ReturnedFloat32"] for row in results[1]["measurements"]["targetBiasFourVjps"]), "candidate bias differs from observed FP64 reference")
            if not synthetic: parent.verify_loaded_sources(reader,manifest["sourceClosure"])
            reader.unchanged(); budget()
        require(torch.equal(caller_rng,torch.random.get_rng_state()), "caller RNG not restored")
        passed = results[1]["gate"]["status"] == "original_complete_probe_passed"
        report = {"schemaVersion":"t-q4-34-single-real-train-comparison-v1",
                  "status":"comparison_completed_candidate_probe_passed_single_train_not_qualified" if passed else "comparison_completed_candidate_rejected_closed",
                  "task":"T-Q4-34","implementation":IMPLEMENTATION,"boundary":boundary,"binding":binding,
                  "trainOrdinal":2,"season":"dry_season","sourceIdentity":plan["sourceIdentity"],"loadedIdentity":identity,
                  "actualGraphsInheritedMetadataNotReleaseIdentity":graph,"targetBiasIndex":target_index,
                  "pathResults":results,"parity":parity,"outsideToleranceExamples":examples,
                  "callCounts":{path:dict(value) for path,value in counts.items()},"limits":LIMITS,
                  "inputs":[{"path":p,"sha256":sha} for p,sha in sorted(reader.observed.items())],
                  "unverified":["all48train CPU/GPU qualification","training","visual/Runtime/Stage4 release","unique numerical root cause"],
                  "elapsedSeconds":clock()-started,"recordedAtUtc":datetime.now(timezone.utc).isoformat()}
        return capture.write_exclusive(output,"report.json",report)
    except BaseException as error:
        capture.write_exclusive(output,"failure.json",{"schemaVersion":"t-q4-34-single-real-train-comparison-v1","status":"comparison_failed_closed",
            "task":"T-Q4-34","errorType":type(error).__name__,"error":str(error),"boundary":boundary,"binding":binding,
            "actualGraphsInheritedMetadataNotReleaseIdentity":graph,"initialState":initial,"partialPathResults":results,"originalProbeErrors":original_errors,
            "observedPrefixes":{path:{"forward":len(t["forward"]),"generatorVjps":len(t["gradients"]["generator"]),"discriminatorVjps":len(t["gradients"]["discriminator"]),"targetGradOutputs":len(t["gradOutputs"])} for path,t in traces.items()},
            "callCounts":{path:dict(value) for path,value in counts.items()},"originalFailureEvidence":current_evidence,
            "outsideToleranceExamples":examples[:max(0,8-len(current_evidence.get("examples",[])))],
            "inputs":[{"path":p,"sha256":sha} for p,sha in sorted(reader.observed.items())],"elapsedSeconds":clock()-started})
        raise
    finally:
        timer.cancel(); torch.random.set_rng_state(caller_rng); torch.set_num_threads(old_threads)
        torch.use_deterministic_algorithms(flags["deterministic"],warn_only=flags["warnOnly"])
        torch.backends.mkldnn.enabled = flags["mkldnnEnabled"]
        torch.backends.mkldnn.deterministic = flags["mkldnnDeterministic"]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bindings",required=True); parser.add_argument("--sha256",required=True)
    args = parser.parse_args(); require(ROOT == Path("F:/ai-pet-world"), "fixed workspace required")
    print(json.dumps(execute({"path":args.bindings,"sha256":args.sha256}),ensure_ascii=False))
