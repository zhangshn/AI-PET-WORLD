"""Independent V16 CPU qualification for the unchanged RGB objective and BF16 plan.

This does not invoke the V15 candidate probe. Only a bound train original is
decoded; validation/challenge/regression are membership metadata here.
"""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from unittest.mock import patch


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
for directory in (ROOT / "ml/ai-painter/src", SCRIPT_DIR):
    if str(directory) not in sys.path:
        sys.path.insert(0, str(directory))

import torch  # noqa: E402
from ai_painter.complete_world.native_rgb_conditional_texture_cpu import (  # noqa: E402
    ADVERSARIAL_WEIGHT, COARSE_SCALE, FACT_REGION_CHANNELS, FACT_REGION_WEIGHT,
    HIGHPASS_WINDOW, TEXTURE_WEIGHT, build_conditional_texture_discriminator,
    discriminator_train_objective, generator_train_objective,
)
from ai_painter.complete_world.native_rgb_instance_object_prototype import (  # noqa: E402
    build_native_rgb_instance_object_prototype,
)
from ai_painter.complete_world.split_release import (  # noqa: E402
    bound_json, canonical_bytes, project_file, read_bound,
)
from ai_painter.complete_world.split_training import state_hash  # noqa: E402
from run_stage4_mvp_conditional_texture_bf16_v16_readonly_gpu_qualification import (  # noqa: E402
    CAPABILITY, CONTRACT_PATH, PRECISION_PLAN, REVIEW_PATH, bind,
    load_one_train_sample, registry_snapshot,
)


PROGRAM_PATH = "ml/ai-painter/scripts/check_stage4_mvp_conditional_texture_bf16_v16_cpu_acceptance.py"
OUTPUT_ROOT = ".runtime/ai-painter/stage4-mvp-conditional-texture-bf16-v16-cpu-acceptances"
REPORT_SCHEMA = "stage4-mvp-conditional-texture-bf16-v16-formal-cpu-acceptance-v1"
MAX_SECONDS = 120
SEED = 20260927
FORMULA_SHA256 = "fa4b85c62790fbb9eb52abca5002b2f48bdd2685ceddd74bdbaa63907402d351"
EXPECTED_PROGRAMS = {
    "objectiveAndDiscriminator": "ml/ai-painter/src/ai_painter/complete_world/native_rgb_conditional_texture_cpu.py",
    "renderer": "ml/ai-painter/src/ai_painter/complete_world/native_rgb_instance_object_prototype.py",
    "freshCore": "ml/ai-painter/src/ai_painter/complete_world/native_rgb_aperiodic_detail_renderer.py",
    "objectView": "ml/ai-painter/src/ai_painter/complete_world/object_instance_supervision_cpu.py",
    "textureStatistics": "ml/ai-painter/src/ai_painter/complete_world/native_rgb_local_texture_objective_v12.py",
    "patchDiscriminator": "ml/ai-painter/src/ai_painter/training/discriminator.py",
    "objectiveTests": "ml/ai-painter/tests/test_native_rgb_conditional_texture_cpu.py",
    "rendererTests": "ml/ai-painter/tests/test_native_rgb_instance_object_prototype.py",
    "cpuProbe": "ml/ai-painter/scripts/check_stage4_mvp_conditional_texture_cpu.py",
    "cpuAcceptance": PROGRAM_PATH,
    "trainingWorker": "ml/ai-painter/scripts/train_stage4_mvp_conditional_texture_bf16_v16_stage0.py",
    "reviewCandidateMaterializer": "ml/ai-painter/scripts/materialize_stage4_mvp_conditional_texture_bf16_v16_review_candidates.py",
    "readonlyGpuQualification": "ml/ai-painter/scripts/run_stage4_mvp_conditional_texture_bf16_v16_readonly_gpu_qualification.py",
    "formalReviewRunner": "scripts/run-ai-painter-stage4-mvp-v16-stage0-machine-review.mjs",
    "formalReviewLineage": "scripts/lib/ai-painter-stage4-mvp-v16-review-lineage.mjs",
    "frozenGenericAudit": "scripts/lib/ai-painter-stage4-mvp-v13-review-lineage.mjs",
    "closedLoopController": "scripts/run-ai-painter-stage4-mvp-v16-stage0-closed-loop.mjs",
    "workerGateTests": "ml/ai-painter/tests/test_stage4_mvp_conditional_texture_bf16_v16_worker_gate.py",
    "gpuGateTests": "ml/ai-painter/tests/test_stage4_mvp_conditional_texture_bf16_v16_gpu_gate.py",
    "formalReviewTests": "scripts/tests/test-ai-painter-stage4-mvp-v16-review-lineage.mjs",
}
FACT_ROLES = {
    "road": "terrain_path_ground", "hydrology": "terrain_water",
    "shoreline": "terrain_shoreline", "footprints": "object_footprints",
    "tree": "object_tree", "rock": "object_rock", "vegetation": "object_vegetation",
}
TRAIN_ONLY_OBJECTIVE_TESTS = (
    "test_real_bound_train_has_finite_generator_and_critic_gradients",
    "test_non_train_splits_cannot_update_critic_or_generator",
    "test_highpass_removes_constant_color_offset",
    "test_each_declared_fact_region_has_original_rgb_supervision",
    "test_generator_requires_frozen_critic",
    "test_each_natural_object_kind_has_train_rgb_gradient_and_role_guard",
)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def verify_formal_boundaries() -> tuple[dict, dict, dict]:
    """Recompute V16 contract/reviewer/program/dataset identity without old probe."""
    candidate_binding = bind(CONTRACT_PATH)
    contract = bound_json(ROOT, candidate_binding)
    require(contract.get("schemaVersion") ==
            "stage4-mvp-native-rgb-conditional-texture-bf16-v16-contract-v1"
            and contract.get("capabilityVersion") == CAPABILITY
            and contract.get("status") == "cpu_candidate_not_execution_qualified"
            and contract.get("precisionExecutionPlan") == PRECISION_PLAN,
            "V16 candidate identity or BF16 execution plan changed")
    gates = contract.get("activationGates", {})
    require(gates.get("cpuReadOnlyNow") is True
            and gates.get("gpuReadOnlyNow") is True
            and all(gates.get(field) is False for field in (
                "gpuNow", "optimizerNow", "trainingNow", "formalReviewNow",
                "runtimeFrameNow")),
            "V16 CPU must not activate GPU optimizer, training or publication")
    require(contract.get("trainingBoundNotActivated") == {
        "resolution": [256, 192], "trainSamples": 48,
        "validationSamplesForCheckpointOnly": 8,
        "maxGeneratorSteps": 1152, "maxDiscriminatorSteps": 1152,
        "maxGpuMemoryFraction": 0.7, "automaticRetries": 0,
    }, "V16 training resource boundary changed")
    parent = bound_json(ROOT, contract["parentFailedCandidate"])
    require(parent.get("capabilityVersion") ==
            "stage4_mvp_native_rgb_conditional_texture_v15"
            and parent.get("status") == "failed_closed"
            and parent.get("optimizerStepsGenerator") == 95
            and parent.get("optimizerStepsDiscriminator") == 95
            and parent.get("automaticRetryStarted") is False,
            "V16 failed V15 parent evidence changed")
    programs = contract.get("programBindings", {})
    for role, path in EXPECTED_PROGRAMS.items():
        require(programs.get(role) == bind(path),
                f"V16 acceptance program missing or changed: {role}")
    for bound in programs.values():
        read_bound(ROOT, bound)
    loss = contract.get("lossContract", {})
    require(loss.get("identity") ==
            "stage4-mvp-v15-train-original-conditional-texture-objective-v1"
            and loss.get("formulaSha256") == FORMULA_SHA256
            and loss["formulaSha256"] == hashlib.sha256(
                canonical_bytes(loss.get("formula"))).hexdigest()
            and set(loss.get("formula", {})) == {"generator", "critic", "validation"}
            and loss.get("implementation") == "programBindings.objectiveAndDiscriminator"
            and loss.get("test") == "programBindings.objectiveTests"
            and loss.get("inputShapes") == {
                "conditions": [23, 192, 256], "trainOriginalRgb": [3, 192, 256],
                "prediction": [1, 3, 192, 256], "criticInput": [1, 26, 192, 256],
            }
            and loss.get("coarseScale") == COARSE_SCALE
            and loss.get("highpassWindow") == HIGHPASS_WINDOW
            and loss.get("factRegionChannels") == list(FACT_REGION_CHANNELS)
            and loss.get("factRegionWeight") == FACT_REGION_WEIGHT
            and loss.get("textureMomentsWeight") == TEXTURE_WEIGHT
            and loss.get("adversarialWeight") == ADVERSARIAL_WEIGHT
            and loss.get("generatorTerms") == [
                "coarseRgbMae", "instanceSupportRgbMae", "factRegionCoarseRgbMae",
                "localTextureMoments", "adversarial"]
            and loss.get("validationUsesCritic") is False
            and loss.get("challengeOrRegressionUsedForWeights") is False
            and loss.get("failedPreviewOrReviewScoreAsTrainingTarget") is False,
            "V16 unchanged objective formula or split boundary invalid")
    review_binding = contract.get("reviewBinding", {}).get("formalContract")
    require(review_binding == bind(REVIEW_PATH)
            and contract["reviewBinding"].get("alignmentQualified") is True
            and contract["reviewBinding"].get("formalReviewDispatchable") is False
            and contract["reviewBinding"].get("thresholdLoweringAllowed") is False,
            "V16 separate formal review or training/review separation invalid")
    reviewer = bound_json(ROOT, review_binding)
    require(reviewer.get("schemaVersion") == "stage4-mvp-v16-stage0-review-contract-v1"
            and reviewer.get("capabilityVersion") == CAPABILITY
            and reviewer.get("status") == "active_for_v16_stage0_machine_review"
            and reviewer.get("activation", {}).get("formalReviewExecutionAllowed") is True
            and reviewer["activation"].get("trainingAllowed") is False
            and reviewer.get("candidateContractPath") == CONTRACT_PATH
            and reviewer.get("numericThresholdAdoption", {}).get("binding") ==
            contract["reviewBinding"]["thresholds"]
            and reviewer.get("minimumDetailGate") ==
            contract["reviewBinding"]["minimumDetail"],
            "V16 formal reviewer identity or frozen thresholds invalid")
    for role, key in (("formalReviewRunner", "runner"),
                      ("formalReviewLineage", "lineageAndAuditors"),
                      ("frozenGenericAudit", "frozenGenericAudit")):
        require(reviewer.get("programs", {}).get(key) == programs[role],
                f"V16 reviewer program changed: {role}")
    threshold = bound_json(ROOT, contract["reviewBinding"]["thresholds"])
    require(threshold.get("reviewTrainingSeparation", {}).get("thresholdLoweringAllowed")
            is False and reviewer["numericThresholdAdoption"].get("thresholdOverridesAllowed")
            is False, "V16 threshold lowering prohibited")
    allowed_codes = set().union(*(
        set(value) for value in threshold.get("failureCodes", {}).values()
        if isinstance(value, list)
    ))
    shoreline_failure = reviewer.get("shorelineReview", {}).get("failureCode")
    if isinstance(shoreline_failure, str):
        allowed_codes.add(shoreline_failure)
    alignment = contract.get("trainingReviewAlignment")
    require(isinstance(alignment, list) and len(alignment) == 7,
            "V16 seven-role training/review alignment missing")
    order = bound_json(ROOT, contract["conditionContract"])["tensorContract"]["channelOrder"]
    require(len(order) == len(set(order)) == 23, "V16 23 channels changed")
    seen = set()
    for row in alignment:
        role = row.get("responsibilityId")
        require(role in FACT_ROLES and role not in seen
                and row.get("conditionChannelIds") == [FACT_ROLES[role]]
                and FACT_ROLES[role] in order
                and row.get("formulaSha256") == FORMULA_SHA256
                and row.get("formalReviewContractIdentity") == reviewer["contractId"]
                and row.get("formalReviewContractSha256") == review_binding["sha256"]
                and isinstance(row.get("objectiveTermIds"), list)
                and bool(row["objectiveTermIds"])
                and set(row["objectiveTermIds"]).issubset(loss["generatorTerms"])
                and isinstance(row.get("responsibilityOutputIdentity"), str)
                and bool(row["responsibilityOutputIdentity"])
                and isinstance(row.get("reviewMetricIds"), list)
                and bool(row["reviewMetricIds"])
                and isinstance(row.get("failureCodes"), list)
                and bool(row["failureCodes"])
                and set(row["failureCodes"]).issubset(allowed_codes)
                and row.get("positiveAlignmentTests") == [programs["objectiveTests"]]
                and row.get("negativeAlignmentTests") == [programs["objectiveTests"]],
                f"V16 incomplete role alignment: {role}")
        seen.add(role)
    require(seen == set(FACT_ROLES), "V16 role alignment incomplete")
    require(reviewer.get("shorelineReview", {}).get("channelId") == "terrain_shoreline"
            and reviewer["shorelineReview"].get("independentGate") is True
            and reviewer["shorelineReview"].get("maximumMaskedRgbMae") == {
                "comparator": "<=", "value": 0.18, "unit": "normalized_rgb_mae"}
            and reviewer["shorelineReview"].get("thresholdSource", {}).get("binding") ==
            contract["reviewBinding"]["thresholds"]
            and reviewer["shorelineReview"].get("positiveNegativeTests") ==
            programs["formalReviewTests"],
            "V16 independently bound shoreline review missing")
    dataset = contract.get("datasetBinding", {})
    manifest = bound_json(ROOT, dataset["manifest"])
    require(dataset.get("datasetReleaseIdentity") == manifest.get("datasetReleaseIdentity")
            and dataset.get("sourceIndex") == manifest.get("sourceIndex")
            and dataset.get("splits") == manifest.get("splits")
            and manifest.get("sampleCount") == 64
            and manifest.get("qualification", {}).get("dataQualifiedForTraining") is True
            and manifest.get("splitCounts") == {
                "train": 48, "validation": 8, "challenge": 4, "regression": 4,
            }, "V16 64/48/8/4/4 dataset release changed")
    for bound in (dataset["sourceIndex"], *dataset["splits"].values(),
                  contract["conditionContract"], contract["reviewBinding"]["thresholds"],
                  contract["reviewBinding"]["minimumDetail"]):
        read_bound(ROOT, bound)
    source = bound_json(ROOT, dataset["sourceIndex"])
    require(source.get("sampleCount") == 64 and len(source.get("samples", [])) == 64,
            "V16 source count changed")
    by_id = {row["sampleId"]: row for row in source["samples"]}
    require(len(by_id) == 64, "V16 duplicate source ID")
    all_ids = set()
    for name, count in (("train", 48), ("validation", 8),
                        ("challenge", 4), ("regression", 4)):
        split = bound_json(ROOT, dataset["splits"][name])
        ids = split.get("sampleIds", [])
        require(split.get("split") == name and len(ids) == len(set(ids)) == count
                and all(key in by_id and by_id[key]["split"] == name for key in ids)
                and all_ids.isdisjoint(ids), f"V16 {name} split membership changed")
        all_ids.update(ids)
        if name in ("train", "validation"):
            selection = hashlib.sha256(canonical_bytes([by_id[key] for key in ids])).hexdigest()
            require(selection == dataset[f"{name}SelectionSha256"],
                    f"V16 {name} metadata selection changed")
    require(len(all_ids) == 64, "V16 source rows not completely partitioned")
    foundation = contract.get("foundationAssetBinding", {})
    require(foundation.get("autoencoderLoadedByThisRenderer") is False
            and foundation.get("failedCheckpointLoaded") is False
            and foundation.get("initializationSeed") == SEED
            and manifest.get("foundationCheckpoint") ==
            foundation.get("qualifiedFoundationRecordedByDataset")
            and manifest.get("foundationQualification") ==
            foundation.get("foundationQualification")
            and manifest.get("identityPayload", {}).get("foundationStateSha256") ==
            foundation.get("qualifiedFoundationStateSha256"),
            "V16 foundation identity or failed-weight separation changed")
    read_bound(ROOT, foundation["qualifiedFoundationRecordedByDataset"])
    read_bound(ROOT, foundation["foundationQualification"])
    require(registry_snapshot().get("activeExecution") is None,
            "another AI Painter execution is active")
    return contract, reviewer, manifest


def run() -> dict:
    started = time.monotonic()
    contract, reviewer, manifest = verify_formal_boundaries()
    candidate_binding = bind(CONTRACT_PATH)
    before_registry = registry_snapshot()
    test_commands = ([sys.executable, "-B", "-m", "unittest", "discover", "-s",
                      str(ROOT / "ml/ai-painter/tests"), "-p", pattern]
                     for pattern in (
                         "test_stage4_mvp_conditional_texture_bf16_v16_worker_gate.py",
                         "test_stage4_mvp_conditional_texture_bf16_v16_gpu_gate.py"))
    for command in test_commands:
        remaining = MAX_SECONDS - (time.monotonic() - started)
        require(remaining > 0, "V16 CPU acceptance exceeded wall limit")
        result = subprocess.run(
            command,
            cwd=ROOT, capture_output=True, text=True, timeout=remaining,
            env={**os.environ, "PYTHONPATH": str(ROOT / "ml/ai-painter/src"),
                 "PYTHONDONTWRITEBYTECODE": "1"}, check=False,
        )
        require(result.returncode == 0 and "OK" in result.stderr,
                "V16 bound train-only CPU tests failed: " + result.stderr[-1200:])
    torch.set_num_threads(4)
    torch.manual_seed(SEED)
    sample, order = load_one_train_sample(contract["datasetBinding"], manifest)
    # The historical test class's setUpClass constructs a validation Dataset.
    # Execute only its six train/synthetic methods with the SHA-bound train
    # fixture; bypass that setUpClass so no non-train image is opened.
    objective_file = project_file(ROOT, EXPECTED_PROGRAMS["objectiveTests"])
    specification = importlib.util.spec_from_file_location(
        "v16_train_only_objective_tests", objective_file)
    require(specification is not None and specification.loader is not None,
            "V16 objective test module unavailable")
    objective_tests = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(objective_tests)
    for name in TRAIN_ONLY_OBJECTIVE_TESTS:
        case = objective_tests.ConditionalTextureCpuTests(name)
        case.order = tuple(order)
        case.dataset = object()
        with patch.object(objective_tests, "load_bound_object_sample", return_value=sample):
            getattr(case, name)()
        require(time.monotonic() - started <= MAX_SECONDS,
                "V16 train-only objective tests exceeded wall limit")
    # The objective tests consume RNG; bind the fresh initialization itself,
    # identically to the GPU probe and training worker.
    torch.manual_seed(SEED)
    model = build_native_rgb_instance_object_prototype(
        condition_channel_order=order, base_channels=48, patch_channels=32)
    critic = build_conditional_texture_discriminator()
    before_model, before_critic = state_hash(model.state_dict()), state_hash(critic.state_dict())
    prediction = model(sample["conditions"].unsqueeze(0), sample["objectInstanceTable"])
    d_loss, _ = discriminator_train_objective(critic, prediction, sample)
    require(bool(torch.isfinite(d_loss)), "V16 CPU critic loss non-finite")
    d_loss.backward()
    require(sum(float(p.grad.detach().abs().sum()) for p in critic.parameters()
                if p.grad is not None) > 0
            and all(p.grad is None or bool(torch.isfinite(p.grad).all())
                    for p in critic.parameters())
            and all(p.grad is None for p in model.parameters()),
            "V16 CPU critic gradient missing, non-finite or leaked")
    critic.zero_grad(set_to_none=True)
    critic.requires_grad_(False)
    g_loss, _ = generator_train_objective(
        critic, prediction, sample, sample["objectInstanceTable"], order)
    require(bool(torch.isfinite(g_loss)), "V16 CPU generator loss non-finite")
    g_loss.backward()
    require(sum(float(p.grad.detach().abs().sum()) for p in model.object_head.parameters()
                if p.grad is not None) > 0
            and sum(float(p.grad.detach().abs().sum()) for p in model.core.parameters()
                    if p.grad is not None) > 0
            and all(p.grad is None or bool(torch.isfinite(p.grad).all())
                    for p in model.parameters())
            and all(p.grad is None for p in critic.parameters()),
            "V16 CPU generator gradient missing, non-finite or leaked")
    require(state_hash(model.state_dict()) == before_model
            and state_hash(critic.state_dict()) == before_critic,
            "V16 CPU probe modified network state")
    require(not torch.cuda.is_initialized() and time.monotonic() - started <= MAX_SECONDS,
            "V16 CPU probe initialized CUDA or exceeded wall limit")
    require(contract["programBindings"]["cpuAcceptance"] == bind(PROGRAM_PATH)
            and contract["reviewBinding"]["formalContract"] == bind(REVIEW_PATH)
            and candidate_binding == bind(CONTRACT_PATH),
            "V16 program or formal reviewer changed during acceptance")
    after_registry = registry_snapshot()
    require(after_registry.get("activeExecution") is None
            and after_registry.get("registryRevision") == before_registry.get("registryRevision")
            and after_registry.get("eventSequence") == before_registry.get("eventSequence"),
            "current-execution registry changed during V16 CPU acceptance")
    return {
        "schemaVersion": REPORT_SCHEMA,
        "status": "cpu_readonly_accepted_execution_disabled",
        "capabilityVersion": CAPABILITY,
        "candidateContract": candidate_binding,
        "formalReviewContract": bind(REVIEW_PATH),
        "datasetManifest": contract["datasetBinding"]["manifest"],
        "initialModelStateSha256": before_model,
        "initialDiscriminatorStateSha256": before_critic,
        "trainSelectionSha256": contract["datasetBinding"]["trainSelectionSha256"],
        "validationSelectionSha256": contract["datasetBinding"]["validationSelectionSha256"],
        "alignmentRoles": list(FACT_ROLES),
        "formulaSha256": FORMULA_SHA256,
        "reviewStatus": reviewer["status"],
        "precisionExecutionPlan": PRECISION_PLAN,
        "acceptanceProgram": bind(PROGRAM_PATH),
        "acceptanceTests": contract["programBindings"]["objectiveTests"],
        "workerGateTests": contract["programBindings"]["workerGateTests"],
        "gpuGateTests": contract["programBindings"]["gpuGateTests"],
        "trainOnlyObjectiveTestsExecuted": list(TRAIN_ONLY_OBJECTIVE_TESTS),
        "validationContentObjectiveTestExcluded":
        "test_validation_score_has_no_gradient_or_critic_input",
        "formalReviewAlignmentPassed": True,
        "independentAcceptance": True,
        "cpuTestsPassed": True,
        "trainSampleId": sample["sampleId"],
        "validationContentRead": False,
        "optimizerSteps": 0, "gpuStarted": False, "gpuUsed": False,
        "trainingStarted": False, "weightsModified": False,
        "recordedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def main() -> int:
    report = run()
    identity = hashlib.sha256(canonical_bytes({
        "candidateContract": report["candidateContract"],
        "formalReviewContract": report["formalReviewContract"],
        "cpuAcceptanceProgram": report["acceptanceProgram"],
    })).hexdigest()[:48]
    output = project_file(ROOT, f"{OUTPUT_ROOT}/cpu-v16-{identity}/report.json")
    output.parent.mkdir(parents=True, exist_ok=False)
    with output.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    print(json.dumps({"status": report["status"],
                      "report": bind(output.relative_to(ROOT).as_posix())}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({"status": "failed_closed", "errorType": type(error).__name__,
                          "error": str(error)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(1)
