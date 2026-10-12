"""Bind and exercise one inactive V26 candidate on a real train row, without updates."""
from __future__ import annotations

import argparse
from contextlib import contextmanager
from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
import torch
import materialize_stage4_mvp256_dry_v24_candidate as files
import painter_stage4_v24_dry_single_world_checkpoint_worker as base
from ai_painter.complete_world.object_local_context_isolation_v26_cpu import (
    ARCHITECTURE, CAPABILITY, CONTEXT_RULE, build_fresh_object_local_context_isolation_v26_cpu,
)
from ai_painter.complete_world.native_rgb_complete_support_partition_v23_cpu import ROLES

DIRECTORY = ".runtime/ai-painter/stage4-mvp256-dry-v26-cpu"
SPEC = "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"
MODEL = "ml/ai-painter/src/ai_painter/complete_world/object_local_context_isolation_v26_cpu.py"
TEST = "ml/ai-painter/tests/test_object_local_context_isolation_v26_cpu.py"
PROGRAM = "ml/ai-painter/scripts/check_stage4_mvp256_dry_v26_cpu.py"
REGISTRY = ".runtime/ai-painter/current-execution-registry/current.json"
require = files.require


@contextmanager
def cpu_zero_update_guard():
    # Unlike a pure inference guard, qualification must allow autograd.grad.
    with patch.object(torch.optim.Optimizer, "__init__", side_effect=RuntimeError("optimizer prohibited")), \
         patch.object(torch, "load", side_effect=RuntimeError("checkpoint load prohibited")), \
         patch.object(torch, "save", side_effect=RuntimeError("checkpoint write prohibited")), \
         patch.object(torch.Tensor, "backward", side_effect=RuntimeError("backward accumulation prohibited")), \
         patch.object(torch.cuda, "is_available", side_effect=RuntimeError("GPU prohibited")):
        yield


def validate_cpu_scope(model, sample):
    require(model.architecture_id == ARCHITECTURE and model.capability_version == CAPABILITY
            and model.object_context_rule == CONTEXT_RULE
            and model.execution_qualified is False and model.parent_checkpoint_loaded is False,
            "inactive V26 candidate identity required")
    require(sample.get("split") == "train", "only bound train may form CPU gradients")
    require(not torch.cuda.is_initialized() and next(model.parameters()).device.type == "cpu",
            "CPU-only candidate check required")


def execute(proposal_binding):
    started = time.monotonic()
    torch.set_num_threads(2)
    require(not torch.cuda.is_initialized(), "CUDA already initialized")
    output = DIRECTORY + "/report.json"
    require(not files.project_file(output).exists(), "CPU evidence already exists")
    reader = base.v24.core.cpu.BoundReader(ROOT)
    proposal = reader.json(proposal_binding)
    require(proposal.get("schemaVersion") == "ai-painter-object-expression-diagnosis-and-proposal-v1"
            and proposal.get("status") == "diagnosis_completed_repair_proposed_not_implemented",
            "bound diagnostic proposal required")
    for binding in proposal["evidence"].values():
        reader.read(binding)
    snapshot = files.bind(DIRECTORY + "/frozen-formal-spec-1.33.md")
    require(snapshot["sha256"] == "95cb74c9bb1f9fdca69983df74a5b96c8b3c46a159717af1ea5bb8ce22af8b45",
            "historical V25 specification snapshot differs")
    spec = files.bind(SPEC)
    text = reader.read(spec).decode("utf8")
    require("文档版本：`AI-PAINTER-SPEC-1.34`" in text and "#### 9.6.18 " in text,
            "current V26 specification required")
    registry_binding = files.bind(REGISTRY)
    registry = reader.json(registry_binding)
    require(registry.get("activeExecution") is None and registry.get("nextMachineAction") is None
            and registry.get("activity") == "dry_single_world_review_failed_closed"
            and registry.get("runId") == proposal["runId"], "closed V25 and idle execution required")
    comparison = reader.json(proposal["evidence"]["validationComparison"])
    package = reader.json(comparison["executionPackage"])
    parent = reader.json(comparison["sourceDataCandidate"])
    manifest = reader.json(parent["frozenBindings"]["datasetManifest"])
    source = reader.json(manifest["sourceIndex"])
    require(manifest["splitCounts"] == {"train": 48, "validation": 8, "challenge": 4, "regression": 4},
            "fixed split counts differ")
    require(package["datasetManifest"] == parent["frozenBindings"]["datasetManifest"],
            "predecessor dataset differs")
    split_ids = {key: reader.json(binding)["sampleIds"] for key, binding in manifest["splits"].items()}
    require(all(len(set(ids)) == len(ids) == manifest["splitCounts"][key]
                for key, ids in split_ids.items())
            and len(set().union(*map(set, split_ids.values()))) == 64,
            "split membership overlap or capacity differs")
    rows = {row["sampleId"]: row for row in source["samples"]}
    require(all(rows[sample_id]["split"] == split for split, ids in split_ids.items() for sample_id in ids),
            "source/split membership differs")
    # The existing source reader validates its JSON list representation exactly.
    order = list(manifest["identityPayload"]["channelOrder"])
    continuous = set(manifest["identityPayload"]["continuousChannelIds"])
    sample, identity = base.v24.core.cpu.load_sample(reader, rows[split_ids["train"][0]], order, continuous)
    dependencies = {key: files.bind(value["path"]) for key, value in package["programBindings"].items()
                    if not value["path"].startswith("docs/")}
    for key, binding in dependencies.items():
        require(binding == package["programBindings"][key], "inherited training program changed: " + key)
        reader.read(binding)
    for logical in (MODEL, TEST, PROGRAM):
        dependencies[logical] = files.bind(logical)
        reader.read(dependencies[logical])
    source_hashes = {key: base.v24.core.cpu.tensor_hash(sample[key]) for key in ("conditions", "image")}
    instances = deepcopy(sample["objectInstanceTable"])
    with base._preserve_global_rng(), cpu_zero_update_guard():
        baseline, critic = base.v24.fresh_networks(order)
        candidate = build_fresh_object_local_context_isolation_v26_cpu(condition_channel_order=order)
        require(tuple(candidate.state_dict()) == tuple(baseline.state_dict())
                and all(torch.equal(value, baseline.state_dict()[key])
                        for key, value in candidate.state_dict().items()), "fresh state differs from V24")
        validate_cpu_scope(candidate, sample)
        initial = {"Model": base.v24.core.cpu.state_hash(candidate),
                   "Critic": base.v24.core.cpu.state_hash(critic)}
        baseline.eval(); candidate.eval()
        with torch.no_grad():
            expected, before = baseline(sample["conditions"][None], instances, return_evidence=True)
            actual, after = candidate(sample["conditions"][None], instances, return_evidence=True)
            repeated = candidate(sample["conditions"][None], instances)
        require(torch.equal(actual, repeated), "candidate inference is not deterministic")
        require(torch.equal(before["terrainRgb"], after["terrainRgb"]), "terrain output changed")
        outside = torch.ones((1, 1, 192, 256), dtype=torch.bool)
        core_counts = {}
        for role in ROLES:
            require(torch.equal(before["visibleObjectSupportMasks"][role],
                                after["visibleObjectSupportMasks"][role]), "visible support changed: " + role)
            outside &= ~after["visibleObjectSupportMasks"][role]
            core_counts[role] = int(sample["conditions"][order.index(role)].count_nonzero())
        require(all(count > 0 for count in core_counts.values()), "bound row lacks one of four object classes")
        require(torch.equal(expected[outside.expand_as(actual)], actual[outside.expand_as(actual)]),
                "outside-support output changed")
        require(not torch.equal(expected, actual), "context ablation had no observable effect")
        candidate.train(); critic.eval().requires_grad_(False)
        def forward(_kind, bound):
            validate_cpu_scope(candidate, bound)
            return candidate(bound["conditions"][None], bound["objectInstanceTable"])
        predicted, loss, parts, gradients, facts = base.v24.generator_candidate_for_sample(
            candidate, critic, sample, order, forward, "training")
        require(bool(torch.isfinite(loss)) and facts["autogradGradCalls"] == 4
                and all(value > 0 for value in facts["generatorGradientFacts"]["headCandidateL2"].values())
                and len(gradients) == 106
                and all(value is not None and bool(torch.isfinite(value).all()) for value in gradients),
                "real train generator gradients invalid")
        critic.train().requires_grad_(True)
        critic_loss, _ = base.v24.core.gpu.detached_discriminator_objective(critic, predicted.detach(), sample)
        critic_gradients = torch.autograd.grad(critic_loss, tuple(critic.parameters()), allow_unused=True)
        require(all(value is not None and bool(torch.isfinite(value).all()) for value in critic_gradients)
                and any(bool(torch.count_nonzero(value)) for value in critic_gradients), "critic gradients invalid")
        final = {"Model": base.v24.core.cpu.state_hash(candidate),
                 "Critic": base.v24.core.cpu.state_hash(critic)}
        require(initial == final and all(p.grad is None for network in (candidate, critic)
                                        for p in network.parameters()), "zero-update state changed")
        require(source_hashes == {key: base.v24.core.cpu.tensor_hash(sample[key]) for key in source_hashes}
                and instances == sample["objectInstanceTable"], "source data changed")
    reader.unchanged()
    require(time.monotonic() - started <= 180, "CPU time cap exceeded")
    report = {"schemaVersion": "ai-painter-mvp256-dry-v26-cpu-check-v1",
        "status": "cpu_contract_checked_not_execution_qualified", "capabilityVersion": CAPABILITY,
        "architectureId": ARCHITECTURE, "objectContextRule": CONTEXT_RULE,
        "proposal": proposal_binding, "formalSpecification": spec,
        "historicalV25Specification": snapshot, "programBindings": dependencies,
        "datasetManifest": parent["frozenBindings"]["datasetManifest"], "sourceIndex": manifest["sourceIndex"],
        "splits": manifest["splits"], "splitCounts": manifest["splitCounts"],
        "numericReview": parent["frozenBindings"]["numericReview"],
        "detailReview": parent["frozenBindings"]["detailReview"],
        "testedSample": identity, "testedTrainSampleCount": 1, "all48GradientProbesCompleted": False,
        "facts": {"initialState": initial, "finalState": final,
            "initialWeightsEqualFreshV24": True, "terrainRgbExact": True,
            "outsideSupportRgbExact": True, "supportMasksExact": True,
            "objectEffectObserved": True, "deterministicEval": True,
            "sourceTensorsAndInstancesUnchanged": True, "fourClassCorePixels": core_counts,
            "generatorLoss": float(loss), "discriminatorLoss": float(critic_loss),
            "generatorGradientFacts": facts, "discriminatorGradientsFiniteNonzero": True},
        "boundary": {"cpuOnly": True, "modelForwardCalls": 4, "optimizerSteps": 0,
            "checkpointLoaded": False, "gpuStarted": False, "trainingStarted": False,
            "weightsModified": False, "sourceImagesModified": False,
            "challengeContentRead": False, "regressionContentRead": False,
            "executionRegistryWritten": False, "formalStage4Qualified": False,
            "runtimePublicationGranted": False},
        "remaining": ["独立CPU证据复核", "V26生命周期训练及审核适配与独立执行包",
                      "当前完整48份零更新GPU准入", "一次有上限训练与冻结审核"],
        "elapsedSeconds": time.monotonic() - started, "recordedAtUtc": datetime.now(timezone.utc).isoformat()}
    encoded = (json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode()
    require(len(encoded) <= 16 * 1024 * 1024, "CPU output cap exceeded")
    return files.write_exclusive(output, encoded)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--proposal", required=True)
    parser.add_argument("--sha256", required=True)
    args = parser.parse_args()
    binding = {"path": args.proposal, "sha256": args.sha256}
    try:
        print(json.dumps(execute(binding), ensure_ascii=False))
    except Exception as error:
        failure_key = files.sha((str(error) + files.bind(PROGRAM)["sha256"]).encode())[:20]
        failure = DIRECTORY + "/failure-" + failure_key + ".json"
        if not files.project_file(failure).exists():
            files.write_exclusive(failure, (json.dumps({"status": "cpu_check_failed_closed",
                "input": binding, "error": str(error), "optimizerSteps": 0, "gpuStarted": False,
                "recordedAtUtc": datetime.now(timezone.utc).isoformat()}, ensure_ascii=False, indent=2) + "\n").encode())
        raise
