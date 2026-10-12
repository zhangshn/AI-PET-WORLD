"""Own same-package complete48 train GPU gate, zero optimizer updates."""
import argparse
import json
from pathlib import Path
import sys
import time

ROOT = Path(__file__).absolute().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import painter_stage4_ecology_regime_execution_worker as worker
# Only the bounded event counter is reused, never the predecessor's run/gate.
from qualify_stage4_detail_weight_capture_execution_gpu import Calls


def run(package_binding, *, root=ROOT):
    torch, profile, shared, source = worker.runtime()
    torch.set_num_threads(2)
    started = time.monotonic()
    reader, _spec, plan, configuration = worker.authenticate_live(package_binding, root=root)
    worker.write(root, plan["outputRoot"] + "/gpu-consumed.json",
        {"executionPackage": package_binding, "capabilityVersion": worker.CAPABILITY,
         "attempt": 1, "automaticRetries": 0})
    calls, cases, attempted_sample = Calls(), [], None
    try:
        loaded, order = worker.load_samples(reader, plan, splits=("train",))
        model, critic = profile.fresh_networks(order)
        cpu_state = {"generator": shared.v24.core.cpu.state_hash(model),
                     "discriminator": shared.v24.core.cpu.state_hash(critic)}
        metadata = worker.auth.read_json(reader, plan["modelBinding"])
        worker.require(worker.auth.same_json(cpu_state, metadata["initialState"]),
                       "own fresh GPU candidate differs from bound CPU identity")
        worker.require(time.monotonic() - started < 600, "GPU setup deadline exhausted")
        worker.require(torch.cuda.is_available() and torch.cuda.is_bf16_supported(), "CUDA BF16 unavailable")
        torch.cuda.set_per_process_memory_fraction(.7)
        model.to("cuda:0")
        critic.to("cuda:0")
        initial = {"generator": shared.v24.core.cpu.state_hash(model),
                   "discriminator": shared.v24.core.cpu.state_hash(critic)}
        worker.require(worker.auth.same_json(initial, cpu_state), "device transfer changed own state")
        resource = worker.ResourceGuard(package_binding, plan, configuration,
            root=root, started=started, gpu_gate=True)
        for sample in loaded["train"]:
            resource()
            calls.begin()
            attempted_sample = {"sampleId": sample["sampleId"]}
            proof = profile.zero_update_probe(model, critic, sample, order, resource,
                event=calls.event, failure_evidence=attempted_sample)
            worker.require(proof.get("passed") is True
                and all(p.grad is None for network in (model, critic) for p in network.parameters()),
                "own GPU probe changed gradient state")
            cases.append({"sampleId": sample["sampleId"], "passed": True, "proof": proof})
        final = {"generator": shared.v24.core.cpu.state_hash(model),
                 "discriminator": shared.v24.core.cpu.state_hash(critic)}
        expected = {key + suffix: limit for key, limit in Calls.LIMITS.items()
                    for suffix in ("Attempted", "Completed")}
        worker.require(worker.auth.same_json(initial, final) and len(cases) == 48
            and worker.auth.same_json(calls.counts, expected), "complete own GPU counts/state differ")
        reader.unchanged()
        resource()
        return worker.write(root, plan["outputRoot"] + "/gpu-gate.json", {
            "schema": worker.GPU_SCHEMA, "status": "passed", "capabilityVersion": worker.CAPABILITY,
            "executionProfile": worker.EXECUTION_PROFILE, "executionPackage": package_binding,
            "runId": plan["runId"], "packageId": plan["packageId"],
            "programBindings": plan["programBindings"], "actualCounts": calls.counts, "cases": cases,
            "initialState": initial, "finalState": final, "initialCpuState": cpu_state,
            "optimizerSteps": 0, "checkpointLoaded": False, "checkpointWritten": False,
            "elapsedSeconds": time.monotonic() - started,
            "formalStage4QualificationAllowed": False, "runtimePublicationAllowed": False})
    except BaseException as error:
        try:
            worker.write(root, plan["outputRoot"] + "/gpu-failure.json", {
                "schema": worker.GPU_SCHEMA, "status": "failed_closed",
                "capabilityVersion": worker.CAPABILITY, "executionPackage": package_binding,
                "runId": plan["runId"], "packageId": plan["packageId"],
                "originalError": {"type": type(error).__name__, "message": str(error)[:4096]},
                "actualCounts": calls.counts, "completedCases": len(cases),
                "attemptedSample": attempted_sample, "optimizerSteps": 0, "automaticRetries": 0,
                "formalStage4QualificationAllowed": False, "runtimePublicationAllowed": False}, terminal=True)
        except BaseException as other:
            error.secondary_evidence_error = str(other)[:2048]
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package", required=True)
    parser.add_argument("--sha256", required=True)
    args = parser.parse_args()
    print(json.dumps(run({"path": args.package, "sha256": args.sha256})))
