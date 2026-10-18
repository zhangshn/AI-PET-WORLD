"""One fresh CPU generator, one original train sample, five VJPs; no training."""
from __future__ import annotations

import argparse
from contextlib import ExitStack
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys
import time
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[3]
SELF = "ml/ai-painter/scripts/check_object_support_structure_integration_cpu_v1.py"
POLICY_PATH = "data/ai-painter/system-governance/ai-painter-object-support-structure-integration-cpu-policy-v1.json"
CANDIDATE = "stage4_mvp256_dry_object_support_structure_integration_cpu_v1"
OUTPUT = ".runtime/ai-painter/controller-repair-reviews/fix-a69-20261014/object-support-integration-cpu-v1"


def require(ok, message):
    if not ok:
        raise ValueError(message)


def json_bytes(value):
    return (json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n").encode()


def validate_request(value):
    require(type(value) is dict and set(value) == {
        "schemaVersion", "candidateId", "policy", "dataPlan", "programBindings",
        "selectedSampleId", "outputRoot", "registryBefore", "interpreter"}, "exact request fields required")
    require(value["schemaVersion"] == "object-support-integration-cpu-request-v1"
        and value["candidateId"] == CANDIDATE and value["outputRoot"] == OUTPUT,
        "CPU integration request identity differs")
    def binding(item):
        require(type(item) is dict and set(item) == {"path", "sha256"}, "exact file binding required")
        logical, sha = item["path"], item["sha256"]
        require(type(logical) is str and logical and not logical.startswith(("/", "\\"))
            and ":" not in logical and "\\" not in logical
            and all(p not in ("", ".", "..") for p in logical.split("/")), "relative bound path required")
        require(type(sha) is str and len(sha) == 64 and all(c in "0123456789abcdef" for c in sha),
            "lowercase SHA-256 required")
    for key in ("policy", "dataPlan", "registryBefore"):
        binding(value[key])
    require(value["policy"]["path"] == POLICY_PATH, "fixed CPU integration policy required")
    require(type(value["programBindings"]) is dict and 1 <= len(value["programBindings"]) <= 256,
        "bounded source closure required")
    source_identities = {}
    for item in value["programBindings"].values():
        binding(item)
        logical, sha = item["path"], item["sha256"]
        require(logical not in source_identities or source_identities[logical] == sha,
            "conflicting hashes for one source path")
        source_identities[logical] = sha
    require(SELF in source_identities, "source closure must include this check")
    require(value["registryBefore"].get("path") == ".runtime/ai-painter/current-execution-registry/current.json",
        "exact production registry required")
    require(type(value["selectedSampleId"]) is str and bool(value["selectedSampleId"]), "fixed train ID required")
    require(type(value["interpreter"]) is dict and set(value["interpreter"]) == {"path", "sha256"}
        and type(value["interpreter"]["path"]) is str and Path(value["interpreter"]["path"]).is_absolute()
        and type(value["interpreter"]["sha256"]) is str and len(value["interpreter"]["sha256"]) == 64
        and all(c in "0123456789abcdef" for c in value["interpreter"]["sha256"]), "absolute interpreter binding required")
    return value


def guard_image_read(logical, allowed):
    if logical.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff")):
        require(logical in allowed, "out-of-scope RGB/channel read prohibited")


def run(request_binding):
    started = time.monotonic()
    sys.dont_write_bytecode = True
    for directory in (ROOT / "ml/ai-painter/scripts", ROOT / "ml/ai-painter/src"):
        sys.path.insert(0, str(directory))
    import ecology_terrain_detail_weight_quality_auth_v1 as auth
    import painter_stage4_ecology_terrain_detail_weight_quality_worker_v1 as worker
    import diagnose_ecology_terrain_detail_object_response_cpu_v1 as sample_loader

    class SelectedReader(auth.Reader):
        allowed_images = frozenset()
        snapshots = {}

        def read(self, binding, maximum=auth.MAX_CAPTURE):
            guard_image_read(binding["path"], self.allowed_images)
            return super().read(binding, maximum)

        def snapshot(self, logical):
            if logical == auth.CANONICAL_REGION_PROGRAM:
                return super().snapshot(logical)
            require(logical in self.snapshots and logical.endswith(".json"), "unbound metadata snapshot")
            binding = self.snapshots[logical]
            return self.read(binding), dict(binding)

    reader = SelectedReader(ROOT)
    request = validate_request(auth.read_json(reader, request_binding))
    policy = auth.read_json(reader, request["policy"])
    require(policy["candidateId"] == CANDIDATE and policy["boundaries"]["cpuOnly"] is True
        and policy["boundaries"]["trainingGranted"] is False, "CPU-only integration policy required")
    require(request["dataPlan"] == policy["realCpuScope"]["originalDataPlan"]
        and request["selectedSampleId"] == policy["realCpuScope"]["sampleId"], "fixed original train binding differs")
    require(os.environ.get("CUDA_VISIBLE_DEVICES") == "", "CPU-only visibility required")
    interpreter = Path(request["interpreter"]["path"])
    require(Path(sys.executable).resolve() == interpreter.resolve()
        and hashlib.sha256(interpreter.read_bytes()).hexdigest() == request["interpreter"]["sha256"],
        "exact interpreter required")
    programs = request["programBindings"]
    total_program_bytes = sum(len(reader.read(b, auth.PROGRAM_MAX)) for b in programs.values())
    require(total_program_bytes <= 16 * 1024**2, "source closure byte ceiling")
    for key in ("formalSpecification", "lossDefinition"):
        reader.read(policy[key], auth.PROGRAM_MAX)
    reader.read(request["registryBefore"], auth.CONTROL_JSON_MAX)
    output = reader.path(OUTPUT)
    output.mkdir(exist_ok=False)
    calls = {"generatorForwards": 0, "generatorForwardCompleted": 0, "trainSampleDecodeAttempts": 0,
        "decodedTrainSamples": 0, "autogradCalls": 0, "backwardCalls": 0,
        "optimizerConstruction": 0, "optimizerSteps": 0, "checkpointLoads": 0,
        "cudaInitializationAttempts": 0}

    def resource():
        require(time.monotonic() - started < 179, "CPU integration deadline/cleanup reserve")
        reader.mapping.check()

    def publish(name, value):
        raw = json_bytes(value)
        require(len(raw) <= 1048576, "single JSON ceiling")
        files = list(output.iterdir())
        require(all(p.is_file() and not p.is_symlink() for p in files), "unknown output entry")
        require(sum(p.stat().st_size for p in files) + len(raw) <= 8 * 1024**2, "output ceiling")
        reader.mapping.check()
        with (output / name).open("xb") as stream:
            require(stream.write(raw) == len(raw), "short evidence write")
            stream.flush()
            os.fsync(stream.fileno())

    def forbidden(counter):
        def reject(*args, **kwargs):
            calls[counter] += 1
            raise ValueError("CPU integration operation prohibited: " + counter)
        return reject

    try:
        publish("claim.json", {"request": request_binding, "candidateId": CANDIDATE, "automaticRetries": 0})
        torch, inherited_profile, shared = worker.runtime()
        import painter_stage4_object_support_structure_training_profile_cpu_v1 as profile
        torch.set_num_threads(2)
        if torch.get_num_interop_threads() != 2:
            torch.set_num_interop_threads(2)
        require(not torch.cuda.is_initialized(), "CUDA already initialized")
        with sample_loader.preserve_rng(torch), ExitStack() as guards:
            for owner, name, counter in ((torch.cuda, "_lazy_init", "cudaInitializationAttempts"),
                    (torch.autograd, "backward", "backwardCalls"),
                    (torch.optim.Optimizer, "__init__", "optimizerConstruction"),
                    (torch.optim.Optimizer, "step", "optimizerSteps"),
                    (torch, "load", "checkpointLoads")):
                guards.enter_context(patch.object(owner, name, forbidden(counter)))
            original_grad = torch.autograd.grad

            def counted_grad(*args, **kwargs):
                resource()
                require(calls["autogradCalls"] < 5, "five gradient ceiling")
                calls["autogradCalls"] += 1
                return original_grad(*args, **kwargs)

            guards.enter_context(patch.object(torch.autograd, "grad", counted_grad))
            plan = auth.read_json(reader, request["dataPlan"])
            require(plan["capabilityVersion"] == auth.CAPABILITY, "exact old data context required")
            require(all(b in programs.values() for b in plan["programBindings"].values()),
                "unchanged old source closure must be retained")
            closure = auth.read_json(reader, plan["dataClosure"])
            require(closure["schema"] == "ecology-terrain-detail-weight-quality-data-closure-v1"
                and closure["splitSampleIds"]["train"] == reader.json(plan["trainSplit"])["sampleIds"],
                "original data closure differs")
            reader.snapshots = {b["path"]: b for b in closure["bindings"] if b["path"].endswith(".json")}
            require(len(reader.snapshots) == sum(b["path"].endswith(".json") for b in closure["bindings"]),
                "duplicate closure metadata")
            sample, order, identity = sample_loader.load_selected(
                reader, plan, request["selectedSampleId"], inherited_profile, shared, calls)
            worker.verify_loaded_sources(reader, {"programBindings": programs})
            resource()
            model, critic = profile.fresh_networks(order)
            from ai_painter.complete_world.object_ecology_terrain_detail_weight_precision_v1 import validate_model_identity
            validate_model_identity(model)
            before = [shared.v24.core.cpu.state_hash(net) for net in (model, critic)]

            def generator_observed(*args):
                require(calls["generatorForwards"] == 0, "one full generator forward ceiling")
                calls["generatorForwards"] += 1

            handle = model.register_forward_pre_hook(generator_observed)
            guards.callback(handle.remove)
            completed_handle = model.register_forward_hook(
                lambda *_args: calls.__setitem__("generatorForwardCompleted", calls["generatorForwardCompleted"] + 1))
            guards.callback(completed_handle.remove)
            failure_evidence = {}
            probe = profile.zero_update_probe(model, critic, sample, order, resource, failure_evidence=failure_evidence)
            after = [shared.v24.core.cpu.state_hash(net) for net in (model, critic)]
            require(before == after and all(p.grad is None for net in (model, critic) for p in net.parameters()),
                "real model/critic state or grad fields changed")
            require(probe["passed"] is True and calls["autogradCalls"] == 5
                and calls["generatorForwards"] == calls["generatorForwardCompleted"] == 1
                and calls["decodedTrainSamples"] == calls["trainSampleDecodeAttempts"] == 1,
                "actual forward/decode/gradient calls differ")
            require(all(calls[k] == 0 for k in ("backwardCalls", "optimizerConstruction", "optimizerSteps",
                "checkpointLoads", "cudaInitializationAttempts")) and not torch.cuda.is_initialized(),
                "CPU boundary violated")
            imports = worker.verify_loaded_sources(reader, {"programBindings": programs})
            reader.unchanged()
            resource()
        report = {"schemaVersion": "object-support-integration-cpu-report-v1",
            "status": "real_cpu_integration_verified_inactive", "candidateId": CANDIDATE,
            "request": request_binding, "policy": request["policy"], "sampleIdentity": identity,
            "actualCalls": calls, "probe": probe, "modelStateBefore": before[0], "modelStateAfter": after[0],
            "criticStateBefore": before[1], "criticStateAfter": after[1], "rngUnchanged": True,
            "observedBindings": [{"path": p, "sha256": sha} for p, sha in sorted(reader.observed.items())],
            "loadedSources": imports, "elapsedMs": round((time.monotonic() - started) * 1000),
            "recordedAtUtc": datetime.now(timezone.utc).isoformat(), "gpuInitialized": False,
            "weightsModified": False, "trainingStarted": False, "imageOrCheckpointWritten": False,
            "validationRgbRead": False, "challengeContentRead": False, "regressionContentRead": False,
            "formalStage4QualificationGranted": False, "runtimePublicationGranted": False}
        publish("report.json", report)
        print(json.dumps({"status": report["status"], "actualCalls": calls, "elapsedMs": report["elapsedMs"]}), flush=True)
        return report
    except BaseException as primary:
        try:
            publish("failure.json", {"status": "cpu_integration_failed_closed", "request": request_binding,
                "errorType": type(primary).__name__, "error": str(primary)[:4096], "actualCalls": calls,
                "gradientEvidence": locals().get("failure_evidence", {}),
                "recordedAtUtc": datetime.now(timezone.utc).isoformat(), "automaticRetries": 0, "trainingStarted": False})
        except BaseException as secondary:
            print("secondary evidence error: " + str(secondary)[:1024], file=sys.stderr)
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request", required=True)
    parser.add_argument("--sha256", required=True)
    args = parser.parse_args()
    run({"path": args.request, "sha256": args.sha256})
