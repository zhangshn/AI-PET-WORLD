"""Read-only recovery of a completed training's interrupted review.

Historical transport snapshots explain old evidence; only current, bound
numerical sources execute. No training/GPU qualification is inherited.
"""
import hashlib
import json
from pathlib import Path
from review_stage4_detail_weight_capture_execution_cpu import claim_output


def recovery_readers(package_binding, recovery_binding, *, root):
    import painter_stage4_detail_weight_capture_execution_worker as worker
    torch, _profile, _shared, source = worker.runtime()
    worker.require(not torch.cuda.is_initialized(), "review recovery must remain CPU-only")
    live = source.Reader(Path(root))
    recovery = live.json(worker.binding(recovery_binding))
    worker.require(recovery.get("schema") == "detail-weight-review-recovery-plan-v1"
        and recovery.get("sourceExecutionPackage") == package_binding
        and recovery.get("automaticRetries") == 0
        and recovery.get("optimizerSteps") == 0 and recovery.get("gpuAllowed") is False
        and recovery.get("formalQualificationAllowed") is False
        and recovery.get("runtimePublicationAllowed") is False,
        "exact read-only review recovery contract required")
    storage = live.read(worker.binding(recovery["reviewSpecification"]))
    worker.require(recovery["reviewSpecification"]["path"] == "docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md"
        and "11.12 训练完成后的只读审核恢复" in storage.decode("utf-8")
        and recovery.get("budget") == {"maxWallSeconds":120,"maxOutputMiB":16,"cpuThreads":2,"maxModelForwardCalls":16}, "frozen review budget/specification required")
    package = live.json(worker.binding(package_binding))
    bindings = [b for b in package["inputEvidence"] if b["path"].endswith("/detail-weight-capture-plan.json")]
    worker.require(len(bindings) == 1 and bindings[0] == recovery.get("sourceTrainingPlan"), "source plan differs")
    original = live.json(bindings[0])
    worker.require(all(recovery.get(k) == original.get(k) for k in ("runId", "packageId", "capabilityVersion")), "recovery identity differs")
    expected_output = original["outputRoot"] + "/review-recovery-v1/dry-review"
    worker.require(recovery.get("outputRoot") == expected_output
        and recovery_binding["path"] == original["outputRoot"] + "/review-recovery-v1/plan.json", "review recovery namespace differs")
    changed_roles = {"worker", "cpuReview", "adapter"}
    snapshots = recovery.get("historicalProgramSnapshots")
    worker.require(type(snapshots) is list and len(snapshots) == len(changed_roles), "exact historical transport snapshots required")
    replacements = {}
    for item in snapshots:
        role = item.get("role")
        worker.require(role in changed_roles and role not in replacements
            and item.get("originalBinding") == original["programBindings"][role], "historical source role differs")
        saved = worker.binding(item["snapshotBinding"])
        worker.require(saved["path"].startswith(".runtime/ai-painter/review-directory-recovery-t-q4-66/snapshots/")
            and saved["sha256"] == item["originalBinding"]["sha256"], "historical snapshot must preserve exact bytes")
        live.read(saved)
        replacements[role] = item
    programs = recovery.get("programBindings")
    worker.require(type(programs) is dict and set(programs) == set(original["programBindings"]) | {"reviewRecovery", "reviewRecoveryTests", "reviewRecoveryRunner", "reviewRecoveryRunnerTests"}, "recovery source closure differs")
    for role, bound in programs.items():
        if role in original["programBindings"]:
            expected = original["programBindings"][role]
            worker.require(bound["path"] == expected["path"] and (role in changed_roles or bound == expected), "numerical or unrelated source changed")
        live.read(worker.binding(bound))
    prior = live.json(worker.binding(recovery["sourceReviewFailure"]))
    worker.require(prior.get("schemaVersion") == "ai-painter-autonomous-phase-evidence-v1"
        and prior.get("phase") == "review" and prior.get("result", {}).get("failureCode") == "adapter_exception", "source review failure differs")
    terminal = live.json(worker.binding(recovery["sourceWorkerTerminal"]))
    worker.require(terminal.get("executionPackage") == package_binding and terminal.get("runId") == recovery["runId"]
        and terminal.get("packageId") == recovery["packageId"] and terminal.get("executionState") == "completed"
        and terminal.get("completedEpochs") == 48 and terminal.get("optimizerSteps") == {"generator": 2304, "discriminator": 2304}
        and terminal.get("checkpointReloadVerified") is True and terminal.get("checkpointPromotable") is False,
        "completed same-run nonpromotable training required")
    for item in terminal["checkpoints"]:
        live.read(worker.binding(item["checkpoint"]))
    acceptance = live.json(worker.binding(recovery["cpuAcceptance"]))
    worker.require(acceptance.get("schema") == "detail-weight-review-repair-cpu-acceptance-v1"
        and acceptance.get("status") == "passed"
        and acceptance.get("programBindings") == programs,
        "own final-source review CPU acceptance required")
    result = live.json(worker.binding(acceptance["testResult"]))
    receipt = live.json(worker.binding(acceptance["ownedReceipt"]))
    worker.require(result.get("passed", 0) > 0 and result.get("failed") == result.get("errors") == result.get("skipped") == 0
        and result.get("gpuInitialized") is False and result.get("modelForwards") == result.get("optimizerSteps") == 0
        and receipt.get("cleanupConfirmed") is True and receipt.get("proof", {}).get("exitCode") == 0
        and receipt["proof"].get("activeProcessesAfterCleanup") == 0,
        "actual CPU tests and live-owned receipt required")
    aliases = {item["originalBinding"]["path"]: item for item in replacements.values()}

    class HistoricalReader(source.Reader):
        def read(self, bound):
            item = aliases.get(bound["path"])
            if item is not None and bound == item["originalBinding"]:
                return super().read(item["snapshotBinding"])
            return super().read(bound)

    live.unchanged()
    return HistoricalReader(Path(root)), live, recovery
