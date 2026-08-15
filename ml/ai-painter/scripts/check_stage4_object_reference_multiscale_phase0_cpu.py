from __future__ import annotations

import ast
from copy import deepcopy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
from types import SimpleNamespace


ROOT = Path.cwd().resolve()
ENTRY = ROOT / "ml/ai-painter/scripts/run_stage4_object_visible_structure_phase0.py"
TRAINER = ROOT / "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"
NODE_RUNNER = ROOT / "scripts/run-stage4-object-reference-multiscale-phase0.mjs"
PYTHON = ROOT / "ml/ai-painter/.venv/Scripts/python.exe"
FRAGMENT = (
    ROOT
    / ".runtime/ai-painter/stage4-object-reference-multiscale-luminance-structure-"
    "supervision-cpu-implementations/20260815-141934048/inactive-config-fragment.json"
)


def load_entry():
    spec = importlib.util.spec_from_file_location("stage4_multiscale_phase0_entry", ENTRY)
    if spec is None or spec.loader is None:
        raise RuntimeError("phase0 entry import specification missing")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def active_contract() -> dict:
    fragment = json.loads(FRAGMENT.read_text(encoding="utf-8"))
    contract = deepcopy(
        fragment["trainingPatch"]["add"][
            "stage4ObjectReferenceMultiscaleLuminanceStructureSupervision"
        ]
    )
    contract["status"] = "training_loss_active_owner_authorized"
    active = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow",
    }
    contract["activationGate"] = {
        key: key in active for key in contract["activationGate"]
    }
    return contract


def rejects(callable_) -> bool:
    try:
        callable_()
        return False
    except Exception:
        return True


def validate_contract(module, contract: dict) -> dict:
    trainer = SimpleNamespace()
    module.install_phase0_object_reference_multiscale_validator(trainer)
    return trainer.validate_stage4_object_reference_multiscale_luminance_structure_supervision({
        "training": {
            "stage4ObjectReferenceMultiscaleLuminanceStructureSupervision": contract,
        }
    })


def valid_update_evidence() -> dict:
    fields = [f"metric{index:02d}" for index in range(48)]
    object_group = lambda: {
        "finiteAndStrictlyNonzero": True,
        "denoiserGradient": {"finite": True, "absoluteSum": 1.0},
        "matchingSemanticMixtureExpertGradient": {"finite": True, "absoluteSum": 1.0},
    }
    return {
        "status": "phase0_single_cuda_optimizer_step_passed_closed",
        "optimizerStepCount": 1,
        "backwardCallCount": 1,
        "replayOptimizerStepCount": 0,
        "parameterGradientsCleared": True,
        "lossFinite": True,
        "gradientFinite": True,
        "gradientNonzero": True,
        "weightsChanged": True,
        "autoencoderWeightsChanged": False,
        "diagnosticManifest": {
            "fieldCount": 48,
            "fields": fields,
            "values": {field: float(index) for index, field in enumerate(fields)},
        },
        "requiredGradientGroups": {
            "footprints": object_group(),
            "tree": object_group(),
            "rock": object_group(),
            "vegetation": object_group(),
            "combined": {
                "finiteAndStrictlyNonzero": True,
                "denoiserGradient": {"finite": True, "absoluteSum": 1.0},
            },
        },
    }


def main() -> int:
    if os.environ.get("CUDA_VISIBLE_DEVICES") not in (None, ""):
        raise ValueError("CPU checker requires CUDA_VISIBLE_DEVICES empty")
    module = load_entry()
    source = ENTRY.read_text(encoding="utf-8")
    trainer_source = TRAINER.read_text(encoding="utf-8")
    runner_source = NODE_RUNNER.read_text(encoding="utf-8")
    tree = ast.parse(source)
    top_imports = [
        node for node in tree.body if isinstance(node, (ast.Import, ast.ImportFrom))
    ]
    top_import_names = {
        alias.name
        for node in top_imports
        for alias in node.names
    }
    environment = {**os.environ, "CUDA_VISIBLE_DEVICES": ""}
    contract_process = subprocess.run(
        [str(PYTHON), "-B", str(ENTRY), "--object-reference-multiscale-contract-only"],
        cwd=ROOT,
        env=environment,
        text=True,
        capture_output=True,
        check=False,
    )
    if contract_process.returncode != 0:
        raise RuntimeError(contract_process.stderr)
    entry_report = json.loads(contract_process.stdout)
    contract = active_contract()
    validation = validate_contract(module, contract)
    multiscale_identity = {
        "schemaVersion": module.MULTISCALE_IDENTITY_SCHEMA,
    }
    old_identity = {
        "schemaVersion": (
            "ai-painter-stage4-object-visible-structure-phase0-execution-identity-v1"
        ),
    }
    multiscale_profile = module.phase0_profile(multiscale_identity)
    old_profile = module.phase0_profile(old_identity)
    update_evidence = valid_update_evidence()
    update_validation = module.validate_object_reference_multiscale_phase0_update_evidence(
        update_evidence,
        update_evidence["diagnosticManifest"]["fields"],
    )

    positive = {
        "entryContractProcessPassed": contract_process.returncode == 0,
        "entryContractStatusExact": entry_report["status"] == (
            "stage4_object_reference_multiscale_phase0_python_entry_contract_valid_cpu_only"
        ),
        "entryContractExact48": entry_report["diagnosticManifestMetricCount"] == 48,
        "entryContractScalesExact": entry_report["pyramidScales"] == [1.0, 0.5, 0.25],
        "entryContractNoRuntimeOpened": all(
            entry_report[key] is False
            for key in (
                "trainerImported", "torchImported", "cudaInitialized", "checkpointRead",
                "modelLoaded", "optimizerCreated", "backwardExecuted", "trainingStarted",
            )
        ),
        "noTopLevelTorchImport": "torch" not in top_import_names,
        "activeContractValidated": validation["status"] == (
            "stage4_object_reference_multiscale_supervision_contract_valid_phase0_active"
        ),
        "activeContractChannelsExact": validation["sourceChannels"] == [
            "object_footprints", "object_tree", "object_rock", "object_vegetation",
        ],
        "activeContractScalesExact": validation["pyramidScales"] == [1.0, 0.5, 0.25],
        "multiscaleProfileExact": (
            multiscale_profile["multiscale"] is True
            and multiscale_profile["requestPrefix"]
            == "owner-authorized-stage4-object-reference-multiscale-phase0-gpu-execution-"
            and multiscale_profile["modeId"]
            == "stage4_object_reference_multiscale_phase0_engineering"
        ),
        "oldProfilePreserved": (
            old_profile["multiscale"] is False
            and old_profile["modeId"] == "stage4_object_visible_structure_phase0_engineering"
        ),
        "failedCheckpointStillForbidden": "failedDenoiserCheckpointReadOrLoad" in source,
        "formalStageStillDenied": "ExecutionAction.RUN_STAGE0" in source,
        "automaticRetryStillDenied": "ExecutionAction.AUTOMATIC_RETRY" in source,
        "correctedUpdateEvidenceAccepted": update_validation["optimizerStepCount"] == 1,
        "exact48UpdateEvidenceAccepted": (
            update_validation["diagnosticManifestMetricCount"] == 48
        ),
        "fiveGradientGroupsAccepted": update_validation["requiredGradientGroupCount"] == 5,
        "trainerDisablesPhase0EpochWorstReplay": (
            "enable_epoch_worst_replay=not object_reference_multiscale_phase0"
            in trainer_source
        ),
        "trainerRunsPreStepGradientGate": (
            "stage4_object_reference_multiscale_phase0_pre_step_gradient_evidence"
            in trainer_source
            and "phase0_pre_step_gate" in trainer_source
        ),
        "trainerRecordsActualOptimizerState": (
            "optimizer_steps != {1}" in trainer_source
            and '"replayOptimizerStepCount": 0' in trainer_source
        ),
        "runnerRejectsMissingUpdateEvidence": (
            "validateCorrectedUpdateReport" in runner_source
        ),
    }

    mutations = {
        "rejectInactiveStatus": lambda x: x.update(status="cpu_support_verified_inactive"),
        "rejectWrongContractId": lambda x: x.update(contractId="wrong"),
        "rejectMissingChannel": lambda x: x["sourceChannels"].pop(),
        "rejectWrongNativeScale": lambda x: x["pyramidScales"].__setitem__(0, 0.75),
        "rejectWrongHalfScale": lambda x: x["pyramidScales"].__setitem__(1, 0.75),
        "rejectWrongQuarterScale": lambda x: x["pyramidScales"].__setitem__(2, 0.125),
        "rejectFreeWeightSelection": lambda x: x["aggregation"].update(
            freeNumericalWeightSelectionAllowed=True
        ),
        "rejectFailedSingleScaleReuse": lambda x: x["noveltyBoundary"].update(
            failedSingleScaleContractReuseAllowed=True
        ),
        "rejectConfigurationInactive": lambda x: x["activationGate"].update(
            configurationActiveNow=False
        ),
        "rejectCheckpointGateInactive": lambda x: x["activationGate"].update(
            checkpointReadNow=False
        ),
        "rejectOptimizerGateInactive": lambda x: x["activationGate"].update(
            optimizerCreationNow=False
        ),
        "rejectBackwardGateInactive": lambda x: x["activationGate"].update(
            backwardExecutionNow=False
        ),
        "rejectSmokeGateOpened": lambda x: x["activationGate"].update(smokeNow=True),
        "rejectStage4GateOpened": lambda x: x["activationGate"].update(
            stage4FullTrainingNow=True
        ),
        "rejectStage5GateOpened": lambda x: x["activationGate"].update(stage5Now=True),
        "rejectWorldGateOpened": lambda x: x["activationGate"].update(worldEntryNow=True),
    }
    negative = {}
    for name, mutate in mutations.items():
        candidate = deepcopy(contract)
        mutate(candidate)
        negative[name] = rejects(lambda candidate=candidate: validate_contract(module, candidate))
    blocked_environment = {**os.environ, "CUDA_VISIBLE_DEVICES": "0"}
    blocked = subprocess.run(
        [str(PYTHON), "-B", str(ENTRY), "--object-reference-multiscale-contract-only"],
        cwd=ROOT,
        env=blocked_environment,
        text=True,
        capture_output=True,
        check=False,
    )
    negative["rejectCudaVisibleCpuContract"] = blocked.returncode != 0
    update_mutations = {
        "rejectNullOptimizerStepCount": lambda x: x.update(optimizerStepCount=None),
        "rejectExtraOptimizerStep": lambda x: x.update(optimizerStepCount=3),
        "rejectExtraBackward": lambda x: x.update(backwardCallCount=3),
        "rejectReplayStep": lambda x: x.update(replayOptimizerStepCount=2),
        "rejectUnclearedGradients": lambda x: x.update(parameterGradientsCleared=False),
        "rejectMissingGradientGroup": lambda x: x["requiredGradientGroups"].pop("rock"),
        "rejectZeroMatchingExpertGradient": lambda x: x["requiredGradientGroups"]["tree"][
            "matchingSemanticMixtureExpertGradient"
        ].update(absoluteSum=0.0),
        "rejectZeroCombinedGradient": lambda x: x["requiredGradientGroups"]["combined"][
            "denoiserGradient"
        ].update(absoluteSum=0.0),
        "rejectWrongMetricCount": lambda x: x["diagnosticManifest"].update(fieldCount=47),
        "rejectNegativeMetric": lambda x: x["diagnosticManifest"]["values"].update(
            metric00=-1.0
        ),
    }
    for name, mutate in update_mutations.items():
        candidate = deepcopy(update_evidence)
        mutate(candidate)
        negative[name] = rejects(
            lambda candidate=candidate: (
                module.validate_object_reference_multiscale_phase0_update_evidence(
                    candidate, update_evidence["diagnosticManifest"]["fields"]
                )
            )
        )

    failed_positive = [name for name, value in positive.items() if value is not True]
    failed_negative = [name for name, value in negative.items() if value is not True]
    report = {
        "schemaVersion": "stage4-object-reference-multiscale-phase0-python-entry-cpu-report-v1",
        "status": (
            "stage4_object_reference_multiscale_phase0_python_entry_cpu_contract_passed"
            if not failed_positive and not failed_negative
            else "stage4_object_reference_multiscale_phase0_python_entry_cpu_contract_failed_closed"
        ),
        "positive": positive,
        "negative": negative,
        "positivePassed": sum(value is True for value in positive.values()),
        "positiveTotal": len(positive),
        "negativePassed": sum(value is True for value in negative.values()),
        "negativeTotal": len(negative),
        "failedPositiveKeys": failed_positive,
        "failedNegativeKeys": failed_negative,
        "trainerImportedNow": False,
        "torchImportedNow": "torch" in sys.modules,
        "cudaInitializedNow": False,
        "checkpointReadNow": False,
        "modelLoadedNow": False,
        "optimizerCreatedNow": False,
        "backwardExecutedNow": False,
        "trainingStartedNow": False,
    }
    print(json.dumps(report, indent=2))
    return 0 if not failed_positive and not failed_negative else 1


if __name__ == "__main__":
    raise SystemExit(main())
