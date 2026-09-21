"""Versioned train/validation-isolated Smoke component; no GPU CLI or dispatch.

The inactive contract does not inherit V2 qualification. The epoch adapter is
called by CPU behavioral tests now; a qualified lifecycle execution adapter
must own model loading, resources, checkpoints, review and terminal publication.
"""
from __future__ import annotations

from copy import deepcopy
from pathlib import Path

from ai_painter.complete_world.split_release import (
    SplitReleaseDataset, bound_json, canonical_bytes, digest, load_package,
    project_file, read_bound,
)
from ai_painter.complete_world.split_training import TrainSplitBoundary, state_hash

SCHEMA = "ai-painter-stage4-split-isolated-smoke-contract-v1"
SCHEMA_V2 = "ai-painter-stage4-split-isolated-smoke-contract-v2"
COMPILER_LINEAGE = {
    "path": "data/ai-painter/system-governance/stage4-condition-compiler-lineage-v1-95e766c8e19ff23545612539426247948e801056c9ad82c454b06be656296206.json",
    "sha256": "d40eb85a7ae6c0ef0c3a7041bdf2ec86253abb1185d22b208b0c815abf0d6cd1",
}
PARENT = {
    "path": "data/ai-painter/system-governance/stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2.json",
    "sha256": "9e4eb98a1bdcc4afe03aa7fcecfb8350ddaff8030a62e143c289461d7041eef3",
}
PROGRAMS = (
    "ml/ai-painter/scripts/stage4_split_isolated_smoke.py",
    "ml/ai-painter/src/ai_painter/complete_world/split_release.py",
    "ml/ai-painter/src/ai_painter/complete_world/split_training.py",
)
PROGRAMS_V2 = PROGRAMS + (
    "scripts/lib/ai-painter-stage4-split-smoke-preflight.mjs",
    "scripts/lib/ai-painter-stage4-condition-compiler-lineage.mjs",
)


def verify_compiler_lineage(root, lineage_binding, parent):
    # One explicit, reviewed transition. Never accept caller-rehashed replacement
    # programs, edit the historical parent, or fall back to this graph for v1.
    if lineage_binding != COMPILER_LINEAGE:
        raise ValueError("unsupported compiler lineage binding")
    graph = bound_json(root, lineage_binding)
    if (graph["parentCapability"] != PARENT
            or graph["replacedHistoricalBinding"] != parent["programBindings"]["conditionCompiler"]
            or graph["status"] != "inactive_program_binding_candidate_not_execution_qualified"
            or any(graph["qualification"].values())):
        raise ValueError("compiler lineage parent or qualification conflict")
    effective = graph["effectiveProgramBindings"]
    unchanged = {key: value for key, value in parent["programBindings"].items() if key != "conditionCompiler"}
    if (set(effective) != set(unchanged) | {"conditionCompiler", "conditionRaster"}
            or any(effective[key] != value for key, value in unchanged.items())):
        raise ValueError("compiler lineage altered unrelated frozen programs")
    for binding in [*effective.values(), *graph["evaluatorBindings"]]:
        read_bound(root, binding)
    return graph


def selected_indices(dataset, sample_ids, expected_split):
    if not isinstance(dataset, SplitReleaseDataset) or dataset.split != expected_split:
        raise ValueError("Smoke requires the bound " + expected_split + " Dataset")
    if not isinstance(sample_ids, (tuple, list)) or not sample_ids or len(set(sample_ids)) != len(sample_ids):
        raise ValueError("Smoke sample selection must be nonempty and unique")
    rows = dataset.rows
    if len({row["sampleId"] for row in rows}) != len(rows) or any(row["split"] != expected_split for row in rows):
        raise ValueError("Smoke Dataset membership is inconsistent")
    by_id = {row["sampleId"]: index for index, row in enumerate(rows)}
    if any(sample_id not in by_id for sample_id in sample_ids):
        raise ValueError("Smoke selected sample is outside " + expected_split)
    return [by_id[sample_id] for sample_id in sample_ids]


def build_inactive_contract(root, dataset_binding, train_sample_id, validation_sample_id, *, compiler_lineage=None):
    from ai_painter_stage4_semantic_transport_v2_trainer_support import build_stage4_semantic_transport_v2_cpu_inactive_config
    root = Path(root).resolve()
    parent = bound_json(root, PARENT)
    if compiler_lineage is None:
        for binding in parent["programBindings"].values():
            read_bound(root, binding)
    else:
        verify_compiler_lineage(root, compiler_lineage, parent)
    manifest, rows = load_package(root, dataset_binding)
    selections = {}
    for split, sample_id in (("train", train_sample_id), ("validation", validation_sample_id)):
        matches = [row for row in rows if row["sampleId"] == sample_id and row["split"] == split]
        if len(matches) != 1:
            raise ValueError("explicit Smoke sample must belong to " + split)
        selections[split] = {"sampleIds": [sample_id], "rowsSha256": digest(canonical_bytes(matches)),
                             "splitFile": manifest["splits"][split]}
    if train_sample_id == validation_sample_id:
        raise ValueError("Smoke train/validation identities overlap")
    core = {
        "schemaVersion": SCHEMA if compiler_lineage is None else SCHEMA_V2, "parentCapability": PARENT,
        "modelArchitectureId": parent["architectureId"],
        "datasetManifest": deepcopy(dataset_binding),
        "datasetReleaseIdentity": manifest["datasetReleaseIdentity"],
        "baseConfig": {"path": "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v6.json",
                       "sha256": digest(project_file(root, "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v6.json").read_bytes())},
        "derivedCpuConfigSha256": digest(canonical_bytes(build_stage4_semantic_transport_v2_cpu_inactive_config(root))),
        "selections": selections,
        "schedule": {"epochCount": 30, "batchSize": 1, "optimizerStepsPerEpoch": 1,
                     "seed": 20263722, "resolution": [256, 192], "previewEpochs": [1, 5, 10, 20, 30]},
        "boundaries": {"optimizerSplit": "train", "evaluationSplit": "validation",
                       "challengeConsumed": False, "regressionConsumed": False,
                       "replayAllowed": False, "smokeWeightsPromotable": False,
                       "lossOverrideAllowed": False, "thresholdOverrideAllowed": False},
        "frozenProgramBindings": parent["programBindings"],
        "programBindings": [{"path": logical, "sha256": digest(project_file(root, logical).read_bytes())}
                            for logical in (PROGRAMS if compiler_lineage is None else PROGRAMS_V2)],
    }
    if compiler_lineage is not None:
        core["compilerLineage"] = deepcopy(compiler_lineage)
    version = "v1" if compiler_lineage is None else "v2"
    identity = "stage4-split-isolated-smoke-" + version + "-" + digest(canonical_bytes(core))
    return {**core, "capabilityVersion": identity, "immutable": True,
            "status": "inactive_component_candidate_not_execution_qualified",
            "qualification": {"cpuComponentEvidenceRequired": True, "historicalDataAuditRequired": True,
                              "newCapabilityGpuQualificationRequired": True,
                              "lifecycleExecutionAdapterRequired": True,
                              "trainingAllowed": False, "capabilityReleased": False}}


def verify_inactive_contract(root, contract_binding):
    contract = bound_json(Path(root), contract_binding)
    schema = contract.get("schemaVersion")
    if schema not in {SCHEMA, SCHEMA_V2}:
        raise ValueError("unsupported Smoke contract schema")
    if (schema == SCHEMA_V2) != ("compilerLineage" in contract):
        raise ValueError("Smoke schema and compiler lineage conflict")
    kwargs = {"compiler_lineage": contract["compilerLineage"]} if schema == SCHEMA_V2 else {}
    expected = build_inactive_contract(root, contract["datasetManifest"],
                                      contract["selections"]["train"]["sampleIds"][0],
                                      contract["selections"]["validation"]["sampleIds"][0], **kwargs)
    if contract != expected:
        raise ValueError("Smoke contract no longer reproduces its data/program identity")
    return contract


def run_split_smoke_epoch(*, model, optimizer, train_dataset, validation_dataset,
                          train_sample_ids, validation_sample_ids, diffusion,
                          latent_normalization, device, config, epoch_index, seed):
    """Execute the real frozen Trainer with separate loaders and state guards.

    This low-level component grants no execution rights, writes no checkpoint,
    and does not choose/publish weights. Its caller owns qualified execution.
    """
    from torch.utils.data import DataLoader
    from train_ai_assisted_conditional_denoiser import train_epoch, evaluate_velocity_prediction
    from ai_painter_stage4_semantic_transport_v2_trainer_support import (
        validate_stage4_semantic_transport_v2_autoencoder_boundary,
        validate_stage4_semantic_transport_v2_trainer_contract,
    )

    train_indices = selected_indices(train_dataset, train_sample_ids, "train")
    validation_indices = selected_indices(validation_dataset, validation_sample_ids, "validation")
    if len(train_indices) != 1 or len(validation_indices) != 1:
        raise ValueError("Smoke v1 requires exactly one explicit train and validation sample")
    if (train_dataset.manifest != validation_dataset.manifest
            or set(train_sample_ids) & set(validation_sample_ids)):
        raise ValueError("Smoke loaders cross release or split identities")
    if not isinstance(epoch_index, int) or isinstance(epoch_index, bool) or not 0 <= epoch_index < 30:
        raise ValueError("Smoke epoch outside the versioned schedule")
    validate_stage4_semantic_transport_v2_trainer_contract(config, root=train_dataset.root)
    before_autoencoder = validate_stage4_semantic_transport_v2_autoencoder_boundary(model, phase="before_training")
    allowed_parameters = {id(value) for value in model.denoiser.parameters() if value.requires_grad}
    optimized_parameters = [value for group in optimizer.param_groups for value in group["params"]]
    if (len(optimized_parameters) != len(allowed_parameters)
            or {id(value) for value in optimized_parameters} != allowed_parameters):
        raise ValueError("Smoke optimizer must contain exactly the trainable Denoiser parameters")

    train_loader = DataLoader(train_dataset, batch_sampler=[[index] for index in train_indices], num_workers=0)
    validation_loader = DataLoader(validation_dataset, batch_sampler=[[index] for index in validation_indices], num_workers=0)
    validation_reads = []

    class CheckedValidationLoader:
        dataset = validation_dataset

        def __len__(self):
            return len(validation_loader)

        def __iter__(self):
            for batch in validation_loader:
                ids = batch.get("sampleId")
                if (ids != list(validation_sample_ids)
                        or batch.get("split") != ["validation"] * len(ids)
                        or batch.get("datasetReleaseIdentity") != [validation_dataset.manifest["datasetReleaseIdentity"]] * len(ids)):
                    raise ValueError("actual validation batch does not match the bound selection")
                validation_reads.extend(ids)
                yield batch
    initial_state = state_hash(model.state_dict())
    with TrainSplitBoundary(model, optimizer, train_dataset) as boundary:
        metrics = train_epoch(model, boundary.wrap_loader(train_loader), optimizer, diffusion,
                              latent_normalization, device, config, epoch_index,
                              enable_path_replay=False, enable_epoch_worst_replay=False)
        step_evidence = boundary.evidence()
        if step_evidence["optimizerSteps"] != 1 or step_evidence["steps"][0]["sampleIds"] != list(train_sample_ids):
            raise ValueError("Smoke optimizer evidence differs from selected train batch")
        before_validation = state_hash(model.state_dict())
        optimizer_before_validation = state_hash(optimizer.state_dict())
        with boundary.evaluation():
            validation = evaluate_velocity_prediction(
                model, CheckedValidationLoader(), diffusion, latent_normalization, device, seed + 2000,
                config["training"]["fixedValidationTimesteps"], config)
        after_validation = state_hash(model.state_dict())
        optimizer_after_validation = state_hash(optimizer.state_dict())
        if boundary.evidence()["rejectedOptimizerStepAttempts"]:
            raise ValueError("Smoke caught and suppressed a forbidden optimizer attempt")
        if validation_reads != list(validation_sample_ids):
            raise ValueError("Smoke validation did not consume exactly its selected sample")
    validate_stage4_semantic_transport_v2_autoencoder_boundary(
        model, phase="after_training", expected_state_sha256=before_autoencoder["stateSha256"])
    return {"epoch": epoch_index + 1, "trainMetrics": metrics, "validationMetrics": validation,
            "stepEvidence": step_evidence,
            "initialModelStateSha256": initial_state,
            "validationEvidence": {"sampleIds": validation_reads, "split": "validation",
                                   "datasetSelectionSha256": validation_dataset.selection_sha256,
                                   "modelStateBefore": before_validation, "modelStateAfter": after_validation,
                                   "optimizerStateBefore": optimizer_before_validation,
                                   "optimizerStateAfter": optimizer_after_validation,
                                   "gradientsEnabled": False},
            "smokeWeightsPromotable": False, "capabilityQualificationGranted": False}


def main():
    from argparse import ArgumentParser
    import json
    import os
    parser = ArgumentParser(description="Build an inactive split-Smoke component contract; cannot run GPU or training")
    parser.add_argument("--dataset-manifest", required=True)
    parser.add_argument("--dataset-sha256", required=True)
    parser.add_argument("--train-sample", required=True)
    parser.add_argument("--validation-sample", required=True)
    parser.add_argument("--compiler-lineage")
    parser.add_argument("--compiler-lineage-sha256")
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    if bool(args.compiler_lineage) != bool(args.compiler_lineage_sha256):
        parser.error("compiler lineage requires both explicit path and SHA-256")
    lineage = ({"path": args.compiler_lineage, "sha256": args.compiler_lineage_sha256}
               if args.compiler_lineage else None)
    root = Path.cwd()
    contract = build_inactive_contract(root, {"path": args.dataset_manifest, "sha256": args.dataset_sha256},
                                       args.train_sample, args.validation_sample, compiler_lineage=lineage)
    data = canonical_bytes(contract) + b"\n"
    logical = "data/ai-painter/system-governance/" + contract["capabilityVersion"] + ".json"
    binding = {"path": logical, "sha256": digest(data)}
    if args.write:
        target = project_file(root, logical)
        if target.exists():
            if target.read_bytes() != data:
                raise ValueError("immutable Smoke contract conflicts; no overwrite allowed")
        else:
            with target.open("xb") as stream:
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
        verify_inactive_contract(root, binding)
    print(json.dumps({"status": contract["status"], "binding": binding if args.write else None,
                      "capabilityVersion": contract["capabilityVersion"], "selections": contract["selections"],
                      "qualification": contract["qualification"], "gpuStarted": False, "trainingStarted": False}, indent=2))


if __name__ == "__main__":
    main()
