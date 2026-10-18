"""One governed CPU candidate check; never a training or GPU entry."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import time
import unittest
import importlib.util
from unittest.mock import patch
import torch

ROOT = Path(__file__).resolve().parents[3]
sys.path[:0] = [str(ROOT/"ml/ai-painter/src"), str(ROOT/"ml/ai-painter/scripts")]
import diagnose_parameter60_causal_gpu_v1 as data
from ai_painter.complete_world import ecology_regime_gradient_failure_capture as capture
from ai_painter.complete_world import object_ecology_terrain_detail_weight_precision_v1 as candidate
from ai_painter.complete_world import object_ecology_terrain_detail_weight_priority_update_v1 as bridge
from ai_painter.complete_world import terrain_detail_weight_reduction_precision_v1 as operator

POLICY = {"path":"data/ai-painter/system-governance/ai-painter-terrain-detail-weight-precision-cpu-policy-v1.json","sha256":"8c94ed1b2828195111855a79cef10f54b66b500209d518820717c6ed3ba43917"}
require = capture.require
def digest(value):
    return capture.tensor_sha(value.detach().cpu().contiguous())
def states(network):
    return {name:digest(value) for name,value in network.state_dict().items()}

def main():
    began=time.monotonic()
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request",required=True)
    parser.add_argument("--request-sha256",required=True)
    args=parser.parse_args()
    mapping=capture.RuntimeMap.current(ROOT)
    request=data._json(mapping.binding({"path":args.request,"sha256":args.request_sha256}))
    require(request["schemaVersion"]=="terrain-detail-precision-cpu-request-v1" and request["policy"]==POLICY,"fixed candidate CPU request required")
    policy=data._json(mapping.binding(POLICY))
    require(policy["status"]=="registered_cpu_candidate_verification_only" and policy["candidate"]==candidate.CAPABILITY,"registered CPU candidate required")
    require(os.environ.get("CUDA_VISIBLE_DEVICES")=="","CPU-only visibility required")
    torch.set_num_threads(2);torch.set_num_interop_threads(2)
    deadline=request["deadlineUnixMs"]/1000
    require(0<deadline-time.time()<=120,"bounded CPU deadline required")
    def resource():
        require(time.time()<deadline and time.monotonic()-began<120,"CPU verification deadline")
        require(not torch.cuda.is_initialized() and torch.get_num_threads()<=2,"CPU boundary")
        mapping.check()
    resource()
    formal=policy["formalSpecification"]
    mapping.binding({key:formal[key] for key in ("path","sha256")})
    require(Path(sys.executable).resolve()==Path(request["interpreter"]["path"]).resolve()
            and hashlib.sha256(Path(sys.executable).read_bytes()).hexdigest()==request["interpreter"]["sha256"],"interpreter differs")
    for binding in request["programBindings"]:mapping.binding(binding,maximum=1048576)
    counts={"fullBaselineForwards":0,"fullCandidateForwards":0,"fullGeneratorAutogradCalls":0,
        "operatorFixtureForwards":0,"operatorFixtureAutogradCalls":0,"discriminatorAutogradCalls":0,
        "optimizerConstruction":0,"optimizerUpdates":0,"cudaCalls":0}
    try:
        spec=importlib.util.spec_from_file_location("terrain_private_cpu_tests",mapping.path(policy["testPath"]))
        tests=importlib.util.module_from_spec(spec);sys.modules[spec.name]=tests;spec.loader.exec_module(tests)
        log=io.StringIO()
        result=unittest.TextTestRunner(stream=log,verbosity=1).run(unittest.defaultTestLoader.loadTestsFromModule(tests))
        require(result.wasSuccessful() and not result.skipped and result.testsRun>0,"component tests failed: "+log.getvalue())
        resource()
        # Read captured feature/adjoint fixtures, never the failed G/D state archive.
        fixtures=policy["operatorFixture"]
        raw=mapping.binding(data._raw_binding(fixtures["tensors"]),maximum=67108864)
        captured=torch.load(io.BytesIO(raw),weights_only=True,map_location="cpu")
        raw=mapping.binding(data._raw_binding(fixtures["contrastTensors"]),maximum=33554432)
        reference=torch.load(io.BytesIO(raw),weights_only=True,map_location="cpu")
        metadata=data._json(mapping.binding(data._raw_binding(fixtures["metadata"])))
        require(type(captured) is dict and set(captured)==set(metadata["descriptors"]),"exact captured fixture keys required")
        for name,value in captured.items():
            descriptor=metadata["descriptors"][name]
            require(type(value) is torch.Tensor and value.device.type=="cpu" and value.dtype==torch.float32
                and list(value.shape)==descriptor["shape"] and digest(value)==descriptor["sha256"],"fixture descriptor differs")
        features=captured["input"]
        weight=torch.zeros((48,48,3,3),requires_grad=True);bias=torch.zeros(48)
        prediction=operator.terrain_detail_weight_reduction_precision(features,weight,bias)
        counts["operatorFixtureForwards"]+=1
        fixture_gradients=[]
        for index,label in enumerate(metadata["labels"]):
            resource();counts["operatorFixtureAutogradCalls"]+=1
            value=torch.autograd.grad(prediction,weight,grad_outputs=captured["adjoint."+label],retain_graph=index<3)[0]
            require(torch.isfinite(value).all() and torch.isclose(value,reference["reference."+str(index)].float(),atol=1e-6,rtol=1e-5).all(),"candidate fixture VJP differs")
            fixture_gradients.append(value)
        expected=(fixture_gradients[1]+fixture_gradients[2])+fixture_gradients[3]
        outside=int((~torch.isclose(fixture_gradients[0],expected,atol=1e-6,rtol=1e-5)).count_nonzero())
        require(outside==0,"captured target identity remains outside gate")
        del captured,reference,prediction,fixture_gradients
        resource()
        locator=data._json(mapping.binding(policy["dataLocator"]))
        sample,order,reader=data.load_failure_sample(mapping,locator,resource=resource)
        require(sample["sampleId"]==policy["scope"]["sampleId"] and sample["split"]=="train","fixed train input")
        profile=data._profile()
        baseline,critic=profile.fresh_networks(order)
        model=candidate.build_fresh_object_ecology_terrain_detail_weight_precision(condition_channel_order=order)
        require(tuple(baseline.named_parameters()) and len(tuple(model.parameters()))==108,"full graph")
        for (name,value),(other,previous) in zip(model.named_parameters(),baseline.named_parameters()):
            require(name==other and digest(value)==digest(previous),"fresh initialized parameter bytes differ")
        before=states(model);critic_before=states(critic);baseline_before=states(baseline)
        profile._phase(critic,False)
        with torch.no_grad():
            counts["fullBaselineForwards"]+=1
            native=profile.sample_forward(baseline,sample)
        counts["fullCandidateForwards"]+=1
        actual=profile.sample_forward(model,sample)
        require(tuple(actual.shape)==(1,3,192,256) and torch.equal(actual.detach(),native),"full256 native forward bytes differ")
        resource()
        total,parts=profile.train_object_core_fidelity_candidate_objective(critic,actual,sample,sample["objectInstanceTable"],order)
        labels=["actualTotal","structuredObjective","wholeFrameFidelity","objectCoreRgb"]
        observed=[]
        def event(stage,label,values):
            resource()
            if stage=="attempt":
                require(label==labels[len(observed)],"gradient order differs")
                counts["fullGeneratorAutogradCalls"]+=1
            else:
                require(type(values) is tuple and len(values)==108,"complete raw gradient set")
                observed.append(label)
        with bridge.observe_generator_gradients(event),patch.object(torch.optim,"Adam",side_effect=AssertionError("optimizer forbidden")),patch.object(torch.optim,"AdamW",side_effect=AssertionError("optimizer forbidden")):
            gradients,facts=bridge.compute_generator_candidate_gradients(model=model,critic=critic,sample=sample,
                actual_total=total,structured_objective=parts["v21UnchangedTotal"],
                whole_frame_fidelity=parts["wholeFrameFidelity"],object_core_rgb=parts["objectCoreRgbWeighted"])
        require(observed==labels and counts["fullGeneratorAutogradCalls"]==4,"four independent real gradients")
        require(len(gradients)==108 and all(torch.isfinite(value).all() for value in gradients),"finite full gradients")
        require(states(model)==before and states(critic)==critic_before and states(baseline)==baseline_before,"weights/buffers changed")
        require(all(value.grad is None for network in (model,baseline,critic) for value in network.parameters()),"grad fields changed")
        reader.unchanged();data._verify_imports(mapping,request["programBindings"]);resource()
        report={"schemaVersion":"terrain-detail-precision-cpu-worker-result-v1","status":"cpu_candidate_verified_inactive",
            "executionState":"completed","runId":request["runId"],"policy":POLICY,"candidate":candidate.CAPABILITY,
            "componentTests":{"passed":result.testsRun,"skipped":len(result.skipped)},
            "capturedFixtureOutsideToleranceElements":outside,"nativeFull256ForwardBytesEqual":True,
            "fullOriginalLossGradientGatePassed":True,"counts":counts,"gradientFacts":facts,
            "sourceReceipts":reader.observed,"beforeAfterStateBytesEqual":True,
            "failedStateOrCheckpointLoaded":False,"pngOrCheckpointWritten":False,
            "cudaInitialized":False,"trainingAllowed":False,"stage4Qualified":False,
            "elapsedSeconds":time.monotonic()-began}
        print(json.dumps(report,allow_nan=False))
    except BaseException as error:
        print(json.dumps({"status":"cpu_candidate_failed_closed","executionState":"failed_closed",
            "runId":request["runId"],"policy":POLICY,"counts":counts,"error":{"type":type(error).__name__,"message":str(error)},
            "trainingAllowed":False,"stage4Qualified":False},allow_nan=False))
        raise

if __name__=="__main__":main()
