"""One governed fresh-model target48 CPU check; no GPU, training or state recovery."""
from __future__ import annotations

import argparse
from contextlib import ExitStack
import hashlib
import json
import os
from pathlib import Path
import random
import re
import sys
import time
from unittest.mock import patch

STARTED = time.monotonic()
ROOT = Path(__file__).absolute().parents[3]
sys.dont_write_bytecode = True
sys.path[:0] = [str(ROOT / "ml/ai-painter/src"), str(ROOT / "ml/ai-painter/scripts")]

import torch
import diagnose_parameter48_causal_gpu_v2 as diagnostic
from ai_painter.complete_world import object_ecology_decode1_entry_weight_precision_v1 as candidate
from ai_painter.complete_world import object_ecology_final_rgb_base_weight_precision_v1 as parent
from ai_painter.complete_world import object_joint_rgb_structure_priority_update_cpu_v1 as arithmetic
from ai_painter.complete_world.native_rgb_object_support_structure_device_v1 import (
    train_object_support_structure_candidate_objective,
)

require = diagnostic.require
POLICY_PATH = "data/ai-painter/system-governance/ai-painter-decode1-entry-weight-precision-cpu-policy-v1.json"
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-172-seasonal-evergreen-semi-evergreen-forest-v2"
LOCATOR = {"path": ".runtime/ai-painter/joint-object-priority-quality-executions/joint-object-quality-v1-c6ec20e3-a5bc-4969-9bb8-437f47fa2802/gradient-failure/manifest.json",
           "sha256": "cd809d9c4d7d59507fdcadad78eae09cb1a76c52f4f84830f6c18611a43f3c1a"}
RESOURCES = dict(maxWallSeconds=120, threads=2, maxOutputBytes=8388608, maxStreamBytes=8388608,
                 failureReserveBytes=65536, cleanupReserveMs=1000, finalizationReserveMs=8000,
                 attempts=1, automaticRetries=0)
LIMITS = dict(fullBaselineForwards=1, fullCandidateForwards=1, fullGeneratorAutogradCalls=5,
              discriminatorAutogradCalls=0, optimizerConstruction=0, optimizerUpdates=0, cudaCalls=0)
QUALIFICATION = dict(gpuExecutionAllowed=False, trainingAllowed=False, checkpointWritten=False,
                     stage4Qualified=False, capabilityReleased=False, runtimeFrameAllowed=False)
LABELS = ("actualTotal", "structuredObjective", "wholeFrameFidelity", "objectCoreRgb", "objectSupportStructure")


def raw_binding(value):
    require(type(value) is dict and type(value.get("path")) is str
            and re.fullmatch("[a-f0-9]{64}", value.get("sha256", "")), "exact source binding required")
    return {key: value[key] for key in ("path", "sha256")}


def validate_request(request, policy, now=None):
    require(type(request) is dict and set(request) == {"schemaVersion", "runId", "outputRoot", "policy",
            "programBindings", "interpreter", "nodeInterpreter", "deadlineUnixMs", "mode"}, "exact CPU request fields required")
    require(request["schemaVersion"] == "decode1-entry-precision-cpu-request-v1"
            and request["mode"] == "cpu_candidate_check", "dedicated CPU request required")
    require(re.fullmatch(r"decode1-entry-cpu-[a-f0-9-]{36}", request["runId"] or "") is not None,
            "dedicated CPU run identity required")
    require(request["policy"]["path"] == POLICY_PATH
            and policy["schemaVersion"] == "ai-painter-decode1-entry-weight-precision-cpu-policy-v1"
            and policy["status"] == "registered_cpu_candidate_verification_only", "registered CPU candidate policy required")
    require(policy["formalSpecification"]["path"] == "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"
            and policy["formalSpecification"]["version"] == "AI-PAINTER-SPEC-1.91", "current formal version required")
    require(policy["candidate"] == candidate.CAPABILITY and policy["target"] == {
        "parameterIndex": 48, "parameterName": "core.core.terrain.decode_1.layers.0.weight", "weightShape": [48,144,3,3]},
        "only parameter48 candidate allowed")
    require(policy["scope"] == dict(resolution=[256,192], sampleId=SAMPLE_ID, split="train", sampleCount=1,
        originalDataSplits="48/8/4/4 unchanged", initializationSeed=20260929, parameterCount=108,
        parameterElements=2242687, failureStateInitializationAllowed=False), "one fresh fixed train sample required")
    require(raw_binding(policy["dataLocator"]) == LOCATOR and policy["resources"] == RESOURCES
            and policy["limits"] == LIMITS and policy["qualification"] == QUALIFICATION, "fixed identity and CPU budgets required")
    require(policy["comparison"] == dict(atol=1e-6, rtol=1e-5, originalGateKept=True,
        nativeForwardBytesIdentical=True, onlyTargetWeightGradientChanged=True), "original numerical gate required")
    output = ".runtime/ai-painter/decode1-entry-weight-precision-cpu-checks"
    require(policy["outputRoot"] == output and request["outputRoot"] == output + "/" + request["runId"]
            and policy["attemptClaimPath"] == output + "/attempt-v1.json", "dedicated bounded output required")
    require(type(request["deadlineUnixMs"]) is int and 0 < request["deadlineUnixMs"] / 1000
            - (time.time() if now is None else now) <= 120, "bounded shared deadline required")
    programs = request["programBindings"]
    require(type(programs) is list and 0 < len(programs) <= 256
            and all(type(b) is dict and set(b) == {"path", "sha256"} for b in programs)
            and len({b["path"] for b in programs}) == len(programs), "bounded unique source closure required")
    diagnostic.canonical_program_binding(programs)
    require(request["nodeInterpreter"] == policy["nodeInterpreter"], "original canonical Node binding required")


def digest(value):
    return diagnostic._diagnostic_tensor_sha(value)


def verify_parameter_mapping(model, carrier):
    """A genuine original model is only a pure arithmetic carrier, never a renamed candidate."""
    candidate.validate_model_identity(model)
    parent.validate_model_identity(carrier)
    actual, reference = tuple(model.named_parameters()), tuple(carrier.named_parameters())
    require(len(actual) == len(reference) == 108, "complete model/carrier graph required")
    for (name, value), (other, expected) in zip(actual, reference):
        require(name == other and value.shape == expected.shape and value.dtype == expected.dtype
                and value.device.type == expected.device.type == "cpu" and value is not expected
                and value.untyped_storage()._cdata != expected.untyped_storage()._cdata
                and digest(value) == digest(expected), "fresh arithmetic carrier parameter bytes differ: " + name)
    require(model.capability_version != carrier.capability_version and carrier.capability_version == parent.CAPABILITY
            and not model.execution_qualified and not carrier.execution_qualified, "identities or qualification inherited")


def compute_checked_gradients(model, carrier, losses, counts, resource):
    """Five real candidate VJPs followed by the frozen original CPU arithmetic gate."""
    verify_parameter_mapping(model, carrier)
    parameters = tuple(model.parameters())
    require(len(losses) == 5 and all(type(v) is torch.Tensor and v.shape == torch.Size([])
            and v.dtype == torch.float32 and v.device.type == "cpu" and v.requires_grad
            and bool(torch.isfinite(v.detach())) for v in losses), "five differentiable scalar losses required")
    expected = (((losses[1].float() + losses[2]).float() + losses[3]).float() + losses[4])
    require(torch.equal(losses[0].detach(), expected.detach()), "original ordered four-term scalar formula differs")
    raw = []
    for index, loss in enumerate(losses):
        resource()
        counts["fullGeneratorAutogradCalls"] += 1
        raw.append(torch.autograd.grad(loss, parameters, retain_graph=index < 4, create_graph=False, allow_unused=True))
        require(len(raw[-1]) == 108, "full candidate parameter gradient set required")
    verify_parameter_mapping(model, carrier)
    checked, facts = arithmetic.apply_object_joint_rgb_structure_priority_update_cpu(model=carrier,
        parameters=tuple(carrier.parameters()), total_gradients=raw[0], structured_gradients=raw[1],
        whole_frame_gradients=raw[2], core_gradients=raw[3], support_gradients=raw[4])
    facts.update(modelCapabilityVersion=model.capability_version, arithmeticCarrierCapabilityVersion=carrier.capability_version,
        carrierAllParameterNamesShapesBytesVerified=True, carrierQualificationInherited=False,
        actualTotalProvenanceVerified=True, actualTotalIndependentFullModelGradient=True,
        autogradGradCalls=len(raw), independentFullParameterGradientTensorCounts=[len(rows) for rows in raw],
        originalGateAndProjectionUnchanged=True, sourceArithmeticModelCapabilityVersion=parent.CAPABILITY,
        scalarValues={label: float(v.detach()) for label, v in zip(LABELS, losses)})
    require(len(checked) == 108 and all(v.shape == p.shape and bool(torch.isfinite(v).all())
            for v, p in zip(checked, parameters)), "complete finite checked candidate gradients required")
    facts["generatorGradientFacts"] = dict(tensorCount=len(checked), allFinite=True,
        parameterElements=sum(p.numel() for p in parameters), parametersUpdated=False)
    return facts


def verify_diagnostic_evidence(mapping, policy):
    value = json.loads(mapping.binding(raw_binding(policy["diagnosticEvidence"])))
    require(value["schemaVersion"] == "parameter48-causal-diagnostic-terminal-v2"
            and value["status"] == "diagnostic_target_evidence_complete" and value["executionState"] == "completed",
            "closed current two-coordinate evidence required")
    require(value["worker"]["counts"]["generatorForwards"] == 1
            and value["worker"]["counts"]["generatorAutogradCompleted"] == 5
            and value["worker"]["counts"]["optimizerUpdates"] == 0
            and value["worker"]["contrast"]["originalFp32Comparison"]["selectedCoordinatesOutsideTolerance"] == [True,True],
            "two authentic original-tolerance failures required")
    require(value["ownedReceipt"]["cleanupConfirmed"] is True
            and value["ownedReceipt"]["guardReleaseConfirmed"] is True, "prior evidence was not closed")
    mapping.binding(raw_binding(policy["controllerReview"]))
    mapping.binding(raw_binding(policy["frozenPredecessorSpecification"]))


def run_check(mapping, request, policy, resource, counts):
    verify_diagnostic_evidence(mapping, policy)
    locator = json.loads(mapping.binding(LOCATOR))
    sample, order, reader = diagnostic.load_failure_sample(mapping, locator, resource=resource,
                                                          programs=request["programBindings"])
    profile = diagnostic._profile()
    resource()
    baseline, critic = profile.fresh_networks(order)
    model = candidate.build_fresh_object_ecology_decode1_entry_weight_precision(condition_channel_order=order)
    verify_parameter_mapping(model, baseline)
    # In-memory strict identity/reload, not a saved Checkpoint or failed-state restore.
    pristine = {name: value.detach().clone() for name, value in model.state_dict().items()}
    model.load_state_dict(pristine, strict=True, assign=False)
    require(all(digest(value) == digest(pristine[name]) for name, value in model.state_dict().items()),
            "candidate strict reload changed fresh bytes")
    profile.shared._phase(critic, False)
    networks = (baseline, model, critic)
    before = tuple(diagnostic._network_state(net) for net in networks)
    sample_before = diagnostic._sample_state(sample)
    rng = diagnostic._rng_snapshot(torch.device("cpu"))
    backend = profile.inherited._backend_snapshot()
    resource()
    with profile.generator_fp32_scope(torch.device("cpu")):
        with torch.no_grad():
            counts["fullBaselineForwards"] += 1
            native = profile.inherited.sample_forward(baseline, sample)
        counts["fullCandidateForwards"] += 1
        prediction = profile.inherited.sample_forward(model, sample)
        require(tuple(prediction.shape) == (1,3,192,256) and digest(prediction) == digest(native),
                "native complete256 forward bytes differ")
        hashes = dict(baseline=digest(native), candidate=digest(prediction))
        resource()
        total, parts = train_object_support_structure_candidate_objective(critic, prediction, sample,
            sample["objectInstanceTable"], order)
        facts = compute_checked_gradients(model, baseline, (total, parts["v21UnchangedTotal"],
            parts["wholeFrameFidelity"], parts["objectCoreRgbWeighted"], parts["objectSupportStructureWeighted"]),
            counts, resource)
    require(counts == LIMITS, "exact fresh-model operation counts differ")
    for network, snapshot in zip(networks, before): diagnostic._state_unchanged(network, snapshot)
    diagnostic._sample_unchanged(sample, sample_before)
    diagnostic._rng_unchanged(rng, torch.device("cpu"))
    require(profile.inherited._backend_snapshot() == backend, "original backend was not restored")
    reader.unchanged()
    diagnostic._verify_imports(mapping, request["programBindings"])
    resource()
    return dict(status="cpu_candidate_verified_inactive", executionState="completed", candidate=candidate.CAPABILITY,
        nativeFull256ForwardBytesEqual=True, fullForwardHashes=hashes, fullOriginalLossGradientGatePassed=True,
        strictReloadPassed=True, beforeAfterStateBytesEqual=True, gradientFacts=facts,
        sourceReceipts=dict(reader.observed), failedStateOrCheckpointLoaded=False, pngOrCheckpointWritten=False,
        cudaInitialized=False, trainingAllowed=False, stage4Qualified=False, checkpointWritten=False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request", required=True)
    parser.add_argument("--request-sha256", required=True)
    args = parser.parse_args()
    mapping = diagnostic.capture.RuntimeMap.current(ROOT)
    request = json.loads(mapping.binding({"path": args.request, "sha256": args.request_sha256}))
    require(raw_binding(request["policy"])["path"] == POLICY_PATH, "fixed policy source required")
    policy = json.loads(mapping.binding(raw_binding(request["policy"])))
    validate_request(request, policy)
    counts = {key: 0 for key in LIMITS}
    envelope = dict(schemaVersion="decode1-entry-precision-cpu-worker-result-v1", runId=request["runId"],
                    policy=request["policy"], candidate=candidate.CAPABILITY)
    try:
        require(os.environ.get("CUDA_VISIBLE_DEVICES") == "" and not torch.cuda.is_initialized(), "CPU visibility required")
        process, affinity = diagnostic._configure_cpu_affinity()
        torch.set_num_threads(2)
        if torch.get_num_interop_threads() != 2: torch.set_num_interop_threads(2)
        def resource():
            require(time.time() * 1000 < request["deadlineUnixMs"] and time.monotonic() - STARTED < 120,
                    "CPU candidate shared deadline exceeded")
            require(not torch.cuda.is_initialized() and torch.get_num_threads() <= 2
                    and torch.get_num_interop_threads() <= 2 and 0 < len(process.cpu_affinity()) <= 2,
                    "CPU thread/affinity boundary exceeded")
            mapping.check()
        resource()
        mapping.binding(raw_binding(policy["formalSpecification"]))
        require(Path(sys.executable).resolve() == Path(request["interpreter"]["path"]).resolve()
                and hashlib.sha256(Path(sys.executable).read_bytes()).hexdigest() == request["interpreter"]["sha256"],
                "actual Python identity differs")
        node = diagnostic._verify_metadata_node(mapping, policy, request)
        for b in request["programBindings"]: mapping.binding(b, maximum=1048576)
        for item in policy["sourceAlgorithmBindings"]: mapping.binding(raw_binding(item["binding"]), maximum=1048576)
        diagnostic._verify_imports(mapping, request["programBindings"])
        with ExitStack() as guards:
            for obj, name in ((torch.cuda, "_lazy_init"), (torch.optim.Optimizer, "__init__"), (torch, "load"),
                    (torch, "save"), (torch.Tensor, "backward"), (torch.autograd, "backward")):
                guards.enter_context(patch.object(obj, name, side_effect=AssertionError("CPU candidate prohibited: " + name)))
            result = run_check(mapping, request, policy, resource, counts)
        resource()
        result.update(envelope, counts=counts, cpuAffinity=affinity, metadataNodeInterpreter=node,
                      elapsedSeconds=time.monotonic() - STARTED)
        print(json.dumps(result, allow_nan=False))
    except BaseException as error:
        value = dict(envelope, status="cpu_candidate_failed_closed", executionState="failed_closed", counts=counts,
            error=dict(type=type(error).__name__, message=str(error)[:4096]), trainingAllowed=False,
            stage4Qualified=False, checkpointWritten=False, elapsedSeconds=time.monotonic() - STARTED)
        print(json.dumps(value, allow_nan=False))
        raise


if __name__ == "__main__":
    main()
