"""Read-only CPU probe for an independent conditional-texture candidate.

No optimizer, GPU, Checkpoint, current-execution update or release occurs here.
Passing this probe does not grant execution or visual qualification.
"""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
import time
from uuid import uuid4

import torch


ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "ml/ai-painter/src"
if str(SOURCE) not in sys.path:
    sys.path.insert(0, str(SOURCE))

from ai_painter.complete_world.native_rgb_conditional_texture_cpu import (  # noqa: E402
    ADVERSARIAL_WEIGHT, COARSE_SCALE, EXECUTION_QUALIFIED,
    FACT_REGION_CHANNELS, FACT_REGION_WEIGHT, HIGHPASS_WINDOW, PROTOTYPE_ID,
    TEXTURE_WEIGHT, build_conditional_texture_discriminator,
    discriminator_train_objective, generator_train_objective,
)
from ai_painter.complete_world.native_rgb_instance_object_prototype import (  # noqa: E402
    build_native_rgb_instance_object_prototype,
)
from ai_painter.complete_world.object_instance_supervision_cpu import (  # noqa: E402
    load_bound_object_sample,
)
from ai_painter.complete_world.split_release import (  # noqa: E402
    SplitReleaseDataset, bound_json, project_file, read_bound,
)
from ai_painter.complete_world.split_training import state_hash  # noqa: E402


CONTRACT_PATH = (
    "data/ai-painter/system-governance/"
    "stage4-mvp-native-rgb-conditional-texture-v15-contract.json"
)
CAPABILITY = "stage4_mvp_native_rgb_conditional_texture_v15"
SCHEMA = "stage4-mvp-native-rgb-conditional-texture-v15-contract-v1"
OUTPUT_DIR = ".runtime/ai-painter/stage4-mvp-conditional-texture-v15-cpu-probes"
SEED = 20260927
MAX_SECONDS = 120
MANIFEST = {
    "path": "data/world-samples/ai-assisted-cold-start-dataset-packages/"
            "stage4-v2-mvp64-denoiser-qualified-016bee510b7636115d4241787ac361594dc8c88de7bb74970d86dbd4a3964e71/manifest.json",
    "sha256": "3d3cb6c594bd3b719e9dd13e366d492e1ac1717caaecca78434468484ac70913",
}
PROGRAMS = {
    "objectiveAndDiscriminator": "ml/ai-painter/src/ai_painter/complete_world/native_rgb_conditional_texture_cpu.py",
    "renderer": "ml/ai-painter/src/ai_painter/complete_world/native_rgb_instance_object_prototype.py",
    "freshCore": "ml/ai-painter/src/ai_painter/complete_world/native_rgb_aperiodic_detail_renderer.py",
    "objectView": "ml/ai-painter/src/ai_painter/complete_world/object_instance_supervision_cpu.py",
    "textureStatistics": "ml/ai-painter/src/ai_painter/complete_world/native_rgb_local_texture_objective_v12.py",
    "patchDiscriminator": "ml/ai-painter/src/ai_painter/training/discriminator.py",
    "objectiveTests": "ml/ai-painter/tests/test_native_rgb_conditional_texture_cpu.py",
    "rendererTests": "ml/ai-painter/tests/test_native_rgb_instance_object_prototype.py",
    "cpuProbe": "ml/ai-painter/scripts/check_stage4_mvp_conditional_texture_cpu.py",
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def binding(path: str) -> dict:
    return {"path": path, "sha256": hashlib.sha256(
        project_file(ROOT, path).read_bytes()).hexdigest()}


def verify_contract() -> dict:
    contract = bound_json(ROOT, binding(CONTRACT_PATH))
    gates = contract.get("activationGates", {})
    expected_gates = {
        "cpuReadOnlyNow": True, "gpuNow": False,
        "optimizerNow": False, "trainingNow": False,
        "formalReviewNow": False, "runtimeFrameNow": False,
    }
    require(contract.get("schemaVersion") == SCHEMA
            and contract.get("capabilityVersion") == CAPABILITY
            and contract.get("prototypeId") == PROTOTYPE_ID
            and contract.get("status") == "cpu_candidate_not_execution_qualified"
            and all(gates.get(key) is value for key, value in expected_gates.items())
            and set(gates).issubset(set(expected_gates) | {"gpuReadOnlyNow"})
            and type(gates.get("gpuReadOnlyNow", False)) is bool
            and not EXECUTION_QUALIFIED,
            "conditional candidate identity or activation changed")
    require(contract.get("datasetBinding", {}).get("manifest") == MANIFEST,
            "conditional candidate dataset manifest changed")
    parent = bound_json(ROOT, contract["parentFailedCandidate"])
    require(parent.get("capabilityVersion") ==
            "stage4_mvp_native_rgb_instance_object_renderer_v13"
            and parent.get("executionState") == "failed_closed"
            and parent.get("stagePassed") is False
            and parent.get("formalQualificationGranted") is False,
            "conditional candidate parent failure lineage changed")
    require(set(PROGRAMS).issubset(contract.get("programBindings", {})),
            "conditional candidate program list changed")
    for role, path in PROGRAMS.items():
        require(contract["programBindings"][role] == binding(path),
                f"conditional candidate program changed: {role}")
    for bound in contract["programBindings"].values():
        read_bound(ROOT, bound)
    dataset = contract["datasetBinding"]
    manifest = bound_json(ROOT, dataset["manifest"])
    require(dataset.get("datasetReleaseIdentity") == manifest.get("datasetReleaseIdentity")
            and dataset.get("sourceIndex") == manifest.get("sourceIndex")
            and dataset.get("splits") == manifest.get("splits")
            and manifest.get("splitCounts") == {
                "train": 48, "validation": 8, "challenge": 4, "regression": 4,
            }, "conditional candidate release identity or split lineage changed")
    for item in (dataset["manifest"], dataset["sourceIndex"],
                 *dataset["splits"].values(), contract["conditionContract"],
                 contract["reviewBinding"]["thresholds"],
                 contract["reviewBinding"]["minimumDetail"]):
        read_bound(ROOT, item)
    require(set(dataset["splits"]) == {"train", "validation", "challenge", "regression"}
            and contract["trainingBoundNotActivated"] == {
                "resolution": [256, 192], "trainSamples": 48,
                "validationSamplesForCheckpointOnly": 8,
                "maxGeneratorSteps": 1152, "maxDiscriminatorSteps": 1152,
                "maxGpuMemoryFraction": 0.7, "automaticRetries": 0,
            }, "conditional candidate training bounds changed")
    expected_loss = {
                "implementation": "programBindings.objectiveAndDiscriminator",
                "test": "programBindings.objectiveTests",
                "trainOnly": True,
                "coarseScale": COARSE_SCALE,
                "highpassWindow": HIGHPASS_WINDOW,
                "factRegionChannels": list(FACT_REGION_CHANNELS),
                "factRegionWeight": FACT_REGION_WEIGHT,
                "textureMomentsWeight": TEXTURE_WEIGHT,
                "adversarialWeight": ADVERSARIAL_WEIGHT,
                "generatorTerms": ["coarseRgbMae", "instanceSupportRgbMae",
                                   "factRegionCoarseRgbMae", "localTextureMoments",
                                   "adversarial"],
                "criticInput": "23_conditions_plus_3_highpass_rgb",
                "validationUsesCritic": False,
                "challengeOrRegressionUsedForWeights": False,
                "failedPreviewOrReviewScoreAsTrainingTarget": False,
            }
    actual_loss = contract.get("lossContract", {})
    require(all(actual_loss.get(key) == value for key, value in expected_loss.items()),
            "conditional candidate loss contract changed")
    review = contract.get("reviewBinding", {})
    require({"thresholds", "minimumDetail", "formalReviewDispatchable",
             "thresholdLoweringAllowed", "alignmentQualified"}.issubset(review)
            and review["formalReviewDispatchable"] is False
            and review["thresholdLoweringAllowed"] is False,
            "conditional candidate review state changed")
    foundation = contract.get("foundationAssetBinding", {})
    require(foundation.get("autoencoderLoadedByThisRenderer") is False
            and foundation.get("failedCheckpointLoaded") is False
            and foundation.get("initializationSeed") == SEED
            and foundation.get("candidateRole") == "fresh_native_rgb_neural_renderer_and_critic",
            "conditional candidate foundation role changed")
    require(manifest.get("foundationCheckpoint") ==
            foundation.get("qualifiedFoundationRecordedByDataset")
            and manifest.get("foundationQualification") ==
            foundation.get("foundationQualification")
            and manifest.get("identityPayload", {}).get("foundationStateSha256") ==
            foundation.get("qualifiedFoundationStateSha256"),
            "conditional candidate parent asset or review alignment state changed")
    if review["alignmentQualified"]:
        require("formalContract" in review
                and len(contract.get("trainingReviewAlignment", [])) == 7
                and gates.get("gpuReadOnlyNow") is True,
                "conditional candidate formal review alignment is incomplete")
        read_bound(ROOT, review["formalContract"])
    else:
        require("trainingReviewAlignment" not in contract
                and "formalContract" not in review,
                "conditional candidate unqualified review binding changed")
    read_bound(ROOT, foundation["qualifiedFoundationRecordedByDataset"])
    read_bound(ROOT, foundation["foundationQualification"])
    registry = json.loads((ROOT / ".runtime/ai-painter/current-execution-registry/current.json")
                          .read_text(encoding="utf-8"))
    require(registry.get("activeExecution") is None,
            "another AI Painter execution is active")
    return contract


def run() -> dict:
    start = time.monotonic()
    contract = verify_contract()
    torch.set_num_threads(4)
    torch.manual_seed(SEED)
    train = SplitReleaseDataset(ROOT, MANIFEST, "train", (256, 192))
    validation = SplitReleaseDataset(ROOT, MANIFEST, "validation", (256, 192))
    dataset = contract["datasetBinding"]
    require(len(train) == 48 and len(validation) == 8
            and train.selection_sha256 == dataset["trainSelectionSha256"]
            and validation.selection_sha256 == dataset["validationSelectionSha256"],
            "conditional candidate selected split rows changed")
    order = train.manifest["identityPayload"]["channelOrder"]
    model = build_native_rgb_instance_object_prototype(
        condition_channel_order=order, base_channels=48, patch_channels=32,
    )
    critic = build_conditional_texture_discriminator()
    before_model, before_critic = state_hash(model.state_dict()), state_hash(critic.state_dict())
    sample = load_bound_object_sample(train, 0)
    predicted = model(sample["conditions"][None], sample["objectInstanceTable"])
    critic_loss, _ = discriminator_train_objective(critic, predicted, sample)
    critic_loss.backward()
    require(any(parameter.grad is not None and bool(parameter.grad.abs().sum())
                for parameter in critic.parameters()), "conditional critic has no train gradient")
    require(all(parameter.grad is None for parameter in model.parameters()),
            "critic step leaked gradient into renderer")
    critic.zero_grad(set_to_none=True)
    critic.requires_grad_(False)
    loss, parts = generator_train_objective(
        critic, predicted, sample, sample["objectInstanceTable"], order,
    )
    loss.backward()
    require(bool(torch.isfinite(loss))
            and all(parameter.grad is None for parameter in critic.parameters())
            and any(parameter.grad is not None and bool(parameter.grad.abs().sum())
                    for parameter in model.object_head.parameters())
            and any(parameter.grad is not None and bool(parameter.grad.abs().sum())
                    for parameter in model.core.parameters() if parameter.requires_grad),
            "conditional generator gradient boundary failed")
    # Bind validation membership by metadata only; do not consume its RGB or
    # metrics while deciding whether this new architecture should be trained.
    require(state_hash(model.state_dict()) == before_model
            and state_hash(critic.state_dict()) == before_critic,
            "conditional CPU probe modified model state")
    elapsed = time.monotonic() - start
    require(elapsed <= MAX_SECONDS, "conditional CPU probe exceeded wall bound")
    return {
        "schemaVersion": "stage4-mvp-conditional-texture-v15-cpu-probe-v1",
        "status": "cpu_readonly_probe_passed_no_execution_authority",
        "capabilityVersion": CAPABILITY, "candidateContract": binding(CONTRACT_PATH),
        "datasetManifest": MANIFEST, "trainSelectionSha256": train.selection_sha256,
        "validationSelectionSha256": validation.selection_sha256,
        "initialGeneratorStateSha256": before_model,
        "initialDiscriminatorStateSha256": before_critic,
        "generatorStateUnchanged": True, "discriminatorStateUnchanged": True,
        "trainSampleId": sample["sampleId"],
        "validationContentRead": False,
        "trainObjective": float(parts["total"].detach()),
        "optimizerSteps": 0,
        "gpuUsed": False, "trainingStarted": False,
        "elapsedSeconds": round(elapsed, 3),
        "recordedAtUtc": datetime.now(timezone.utc).isoformat(),
    }


def main() -> int:
    report = run()
    directory = project_file(ROOT, OUTPUT_DIR)
    directory.mkdir(parents=True, exist_ok=True)
    destination = directory / f"cpu-probe-{uuid4().hex}.json"
    temporary = destination.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                         encoding="utf-8")
    temporary.replace(destination)
    print(json.dumps({"evidencePath": destination.relative_to(ROOT).as_posix(),
                      "report": report}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
