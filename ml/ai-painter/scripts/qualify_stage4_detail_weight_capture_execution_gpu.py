"""One same-package complete48 train GPU zero-update gate, no optimizer."""
import argparse
import json
from pathlib import Path
import sys
import time
ROOT = Path(__file__).absolute().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import painter_stage4_detail_weight_capture_execution_worker as worker


class Calls:
    LIMITS = {"forward": 48, "generator": 192, "discriminator": 48}
    def __init__(self): self.counts = {key + suffix: 0 for key in self.LIMITS for suffix in ("Attempted", "Completed")}; self.window = {}
    def begin(self): self.window = {key: self.counts[key + "Attempted"] + (4 if key == "generator" else 1) for key in self.LIMITS}
    def event(self, stage, kind, _gradients):
        worker.require(stage in ("attempt", "complete") and kind in self.LIMITS, "GPU event differs")
        key = kind + ("Attempted" if stage == "attempt" else "Completed"); value = self.counts[key] + 1
        worker.require(value <= min(self.LIMITS[kind], self.window[kind]), "GPU call ceiling exhausted")
        if stage == "complete": worker.require(value <= self.counts[kind + "Attempted"], "GPU completed without attempt")
        self.counts[key] = value


def run(package_binding, *, root=ROOT):
    torch, profile, shared, source = worker.runtime(); torch.set_num_threads(2)
    reader, spec, plan, configuration = worker.authenticate_live(package_binding, root=root)
    worker.write(root, plan["outputRoot"] + "/gpu-consumed.json", {"executionPackage": package_binding, "attempt": 1, "automaticRetries": 0})
    started = time.monotonic(); calls = Calls(); cases = []
    try:
        loaded, order = worker.load_samples(reader, plan, validation=False)
        model, critic = profile.fresh_networks(order)
        cpu_state = {"model": source.state(model), "critic": source.state(critic)}
        worker.require(torch.cuda.is_available() and torch.cuda.is_bf16_supported(), "CUDA BF16 unavailable")
        torch.cuda.set_per_process_memory_fraction(.7); model.to("cuda:0"); critic.to("cuda:0")
        initial = {"model": shared.v24.core.cpu.state_hash(model), "critic": shared.v24.core.cpu.state_hash(critic)}
        guard = worker.ResourceGuard(package_binding, plan, configuration, root=root)
        def resource():
            worker.require(time.monotonic() - started < 600, "600s current-train GPU gate exhausted")
            guard()
        for sample in loaded["train"]:
            resource(); calls.begin(); evidence = {"sampleId": sample["sampleId"]}
            proof = profile.zero_update_probe(model, critic, sample, order, resource, event=calls.event, failure_evidence=evidence)
            worker.require(proof["passed"] and all(p.grad is None for network in (model, critic) for p in network.parameters()), "GPU probe gradient state changed")
            cases.append({"sampleId": sample["sampleId"], "passed": True, "proof": proof})
        final = {"model": shared.v24.core.cpu.state_hash(model), "critic": shared.v24.core.cpu.state_hash(critic)}
        worker.require(initial == final and len(cases) == 48 and calls.counts == {key + suffix: limit for key,limit in Calls.LIMITS.items() for suffix in ("Attempted","Completed")}, "complete GPU cases/counts/state differ")
        reader.unchanged(); resource()
        return worker.write(root, plan["outputRoot"] + "/gpu-gate.json", {"schema": worker.GPU_SCHEMA, "status": "passed", "capabilityVersion": worker.CAPABILITY,
            "executionPackage": package_binding, "executionProfile": worker.EXECUTION_PROFILE,
            "runId": plan["runId"], "packageId": plan["packageId"], "programBindings": plan["programBindings"],
            "actualCounts": calls.counts, "cases": cases, "initialState": initial, "finalState": final, "initialCpuState": cpu_state,
            "optimizerSteps": 0, "checkpointLoaded": False, "checkpointWritten": False, "elapsedSeconds": time.monotonic()-started,
            "formalStage4QualificationAllowed": False, "runtimePublicationAllowed": False})
    except BaseException as error:
        worker.write(root, plan["outputRoot"] + "/gpu-failure.json", {"schema": worker.GPU_SCHEMA, "status": "failed_closed", "error": str(error)[:4096],
            "actualCounts": calls.counts, "completedCases": len(cases), "optimizerSteps": 0, "executionPackage": package_binding})
        raise


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__); p.add_argument("--package", required=True); p.add_argument("--sha256", required=True)
    a = p.parse_args(); print(json.dumps(run({"path":a.package,"sha256":a.sha256})))
