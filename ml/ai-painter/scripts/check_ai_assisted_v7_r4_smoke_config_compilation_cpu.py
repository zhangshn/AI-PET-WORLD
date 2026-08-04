from argparse import ArgumentParser
from copy import deepcopy
import json
from pathlib import Path

from train_ai_assisted_conditional_denoiser import (
    build_v7_r4_candidate_config,
    validate_v7_r4_candidate_contract,
    validate_v7_training_authorization,
)


def main():
    parser = ArgumentParser(description="Compile and CPU-check an isolated V7 R4 single-sample Smoke configuration.")
    parser.add_argument("--base-config", type=Path, required=True)
    parser.add_argument("--r3-candidate", type=Path, required=True)
    parser.add_argument("--r4-proposal", type=Path, required=True)
    parser.add_argument("--selection", type=Path, required=True)
    parser.add_argument("--selection-sha256", required=True)
    parser.add_argument("--compiled-config-project-path", required=True)
    parser.add_argument("--output-config", type=Path, required=True)
    parser.add_argument("--output-report", type=Path, required=True)
    args = parser.parse_args()

    base = read_json(args.base_config)
    r3 = read_json(args.r3_candidate)
    proposal = read_json(args.r4_proposal)
    selection = read_json(args.selection)
    assert selection["status"] == "evidence_driven_bounded_selection_completed_not_active"
    assert selection["reviewThresholdPolicy"] == "preserved_unchanged"
    assert selection["objectSemanticWeightPolicy"] == "preserved_unchanged"
    assert selection["gpuTrainingAuthorized"] is False

    r3_config = deep_merge(base, r3["patch"])
    selected = selection["selectedWeights"]
    config = build_v7_r4_candidate_config(
        r3_config,
        proposal,
        selected["pathInteriorRgb"],
        selected["pathForbiddenBoundaryRgb"],
    )
    training = config["training"]
    training["r4SmokeCandidateContract"] = {
        "mode": "single_sample_overfit_smoke",
        "status": "planned_not_authorized_not_started",
        "plannedOverfitSampleId": selection["plannedSmoke"]["overfitSampleId"],
        "plannedInitialization": selection["plannedSmoke"]["initialization"],
        "parentCheckpointAllowed": False,
        "plannedEpochs": int(selection["plannedSmoke"]["epochs"]),
        "plannedEvaluationInterval": int(selection["plannedSmoke"]["evaluationInterval"]),
        "requiredTailEpochs": [100, 110, 120],
        "gpuSmokeAuthorized": False,
    }
    config["r4CompilationEvidence"] = {
        "selectionPath": selection["identity"]["selectionPath"],
        "selectionSha256": args.selection_sha256,
        "sourceProposalPath": selection["identity"]["proposalPath"],
        "sourceProposalSha256": selection["identity"]["proposalSha256"],
        "trainerSupportContractPath": selection["identity"]["trainerSupportContractPath"],
        "trainerSupportContractSha256": selection["identity"]["trainerSupportContractSha256"],
    }
    contract = validate_v7_r4_candidate_contract(config)
    validate_smoke_candidate(config)

    negative = {
        "trainingRejectedWhileInactive": expect_value_error(
            lambda: validate_v7_training_authorization(config, {}),
            "is isolated and is not authorized for training",
        ),
        "parentCheckpointRejected": expect_mutation_rejected(
            config,
            lambda value: value["training"]["r4SmokeCandidateContract"].update(
                {"parentCheckpointAllowed": True}
            ),
            "parent checkpoint",
        ),
        "sampleIdentityRequired": expect_mutation_rejected(
            config,
            lambda value: value["training"]["r4SmokeCandidateContract"].update(
                {"plannedOverfitSampleId": ""}
            ),
            "sample identity",
        ),
        "tailEpochContractRequired": expect_mutation_rejected(
            config,
            lambda value: value["training"]["r4SmokeCandidateContract"].update(
                {"requiredTailEpochs": [100, 120]}
            ),
            "tail epochs",
        ),
        "gpuAuthorizationRejected": expect_mutation_rejected(
            config,
            lambda value: value["training"]["r4SmokeCandidateContract"].update(
                {"gpuSmokeAuthorized": True}
            ),
            "cannot authorize GPU",
        ),
    }
    assert all(negative.values())

    write_json(args.output_config, config)
    report = {
        "schemaVersion": "ai-assisted-v7-r4-smoke-config-compilation-cpu-regression-v1",
        "status": "passed_cpu_configuration_only_not_active_no_training",
        "device": "cpu",
        "compiledConfigPath": args.compiled_config_project_path,
        "selectedWeights": selected,
        "candidateContract": contract,
        "plannedSmoke": training["r4SmokeCandidateContract"],
        "positiveRegression": {
            "r4CandidateContractAccepted": True,
            "selectedWeightsRemainInsideProposalBounds": True,
            "objectSemanticWeightsPreserved": training["objectSemanticChannelWeights"]
            == proposal["proposal"]["objectSemanticStabilityProposal"]["currentChannelWeights"],
            "reviewThresholdsPreserved": config["training"]["r4BoundedSelectionEvidence"]["reviewThresholdPolicy"]
            == "preserved_unchanged",
            "singleSampleSmokePlanCompiled": True,
        },
        "negativeRegression": negative,
        "optimizerCreated": False,
        "modelWeightsModified": False,
        "formalConfigurationActivated": False,
        "gpuTrainingStarted": False,
        "validationStarted": False,
        "formalInferenceStarted": False,
        "runtimeFrameStarted": False,
        "worldEntered": False,
    }
    assert all(report["positiveRegression"].values())
    write_json(args.output_report, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))


def validate_smoke_candidate(config):
    smoke = config.get("training", {}).get("r4SmokeCandidateContract", {})
    if smoke.get("mode") != "single_sample_overfit_smoke":
        raise ValueError("V7 R4 candidate Smoke mode is invalid")
    if smoke.get("status") != "planned_not_authorized_not_started":
        raise ValueError("V7 R4 candidate Smoke status is invalid")
    if not str(smoke.get("plannedOverfitSampleId", "")).strip():
        raise ValueError("V7 R4 candidate Smoke sample identity is required")
    if smoke.get("plannedInitialization") != "project_random_multiscale_denoiser":
        raise ValueError("V7 R4 candidate Smoke initialization is invalid")
    if smoke.get("parentCheckpointAllowed") is not False:
        raise ValueError("V7 R4 candidate Smoke parent checkpoint is forbidden")
    if int(smoke.get("plannedEpochs", 0)) != 120 or int(smoke.get("plannedEvaluationInterval", 0)) != 10:
        raise ValueError("V7 R4 candidate Smoke epoch contract is invalid")
    if [int(value) for value in smoke.get("requiredTailEpochs", [])] != [100, 110, 120]:
        raise ValueError("V7 R4 candidate Smoke tail epochs are invalid")
    if smoke.get("gpuSmokeAuthorized") is not False:
        raise ValueError("V7 R4 candidate Smoke cannot authorize GPU execution")
    return True


def expect_mutation_rejected(config, mutate, message):
    candidate = deepcopy(config)
    mutate(candidate)
    return expect_value_error(lambda: validate_smoke_candidate(candidate), message)


def expect_value_error(action, message):
    try:
        action()
    except ValueError as error:
        assert message in str(error), f"unexpected error: {error}"
        return True
    raise AssertionError(f"expected ValueError containing: {message}")


def deep_merge(base, patch):
    result = deepcopy(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = deepcopy(value)
    return result


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
