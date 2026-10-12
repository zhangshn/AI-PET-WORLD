from __future__ import annotations

from copy import deepcopy
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys

import pytest
import torch
from torch import nn


ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "ml/ai-painter/src"
SCRIPTS = ROOT / "ml/ai-painter/scripts"
for entry in (str(SRC), str(SCRIPTS)):
    if entry not in sys.path:
        sys.path.insert(0, entry)

WORKER_PATH = SCRIPTS / "painter_stage4_v24_dry_single_world_checkpoint_worker.py"
SPEC = importlib.util.spec_from_file_location("dry_v24_checkpoint_worker", WORKER_PATH)
worker = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = worker
SPEC.loader.exec_module(worker)


def order():
    return ("red", "green", "blue", *worker.OBJECT_CHANNELS,
            *(f"unused_{index}" for index in range(16)))


class EchoModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.scale = nn.Parameter(torch.tensor(1.0))

    def forward(self, conditions, _instance_table):
        return (conditions[:, :3] * self.scale).clamp(0, 1)


class TinyCritic(nn.Module):
    def __init__(self):
        super().__init__()
        self.weight = nn.Parameter(torch.tensor([2.0]))


def tiny_factory(_order):
    torch.manual_seed(91)
    return EchoModel(), TinyCritic()


def validation_sample(sample_id="validation-0"):
    y = torch.linspace(0, 1, 192)[:, None].expand(192, 256)
    x = torch.linspace(0, 1, 256)[None, :].expand(192, 256)
    image = torch.stack((x, y, (x + y) / 2))
    conditions = torch.zeros(23, 192, 256)
    conditions[:3] = image
    for index, role in enumerate(worker.OBJECT_CHANNELS):
        left = index * 48
        conditions[order().index(role), :, left:left + 64] = 1
    return {"sampleId": sample_id, "split": "validation",
            "image": image, "conditions": conditions,
            "objectInstanceTable": []}


def rank(epoch, worst=0.25, mae=0.2):
    return {"epoch": epoch,
            "worstApplicableObjectCorrelation": worst,
            "meanValidationRgbMae": mae,
            "applicableImageCounts": {role: 2 for role in worker.OBJECT_CHANNELS},
            "rank": [worst, -mae, -epoch],
            "qualificationGranted": False,
            "checkpointPromotionEligible": False}


def binding(name):
    return {"path": name, "sha256": "a" * 64}


def write_bound(root, relative, value):
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    data = (value if isinstance(value, bytes) else
            (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf8"))
    path.write_bytes(data)
    return {"path": relative, "sha256": hashlib.sha256(data).hexdigest()}


def test_import_and_cpu_preflight_do_not_initialize_cuda_or_create_optimizer(monkeypatch):
    monkeypatch.setattr(torch.cuda, "is_initialized", lambda: False)
    monkeypatch.setattr(torch.optim, "AdamW",
                        lambda *args, **kwargs: pytest.fail("optimizer prohibited"))
    result = worker.cpu_preflight()
    assert result == {
        "status": "cpu_preflight_passed_training_not_started",
        "capabilityVersion": worker.CAPABILITY,
        "candidateStatus": "cpu_candidate_not_execution_qualified",
        "eligibleCheckpointEpochs": [24, 36, 48],
        "trainingStarted": False, "gpuInitialized": False,
        "optimizerCreated": False, "checkpointLoaded": False,
        "checkpointWritten": False, "qualificationGranted": False,
    }


def test_candidate_contract_is_frozen_and_mutations_fail():
    candidate = worker.load_candidate_contract()
    assert candidate["activation"]["trainingAllowed"] is False
    mutations = []
    changed = deepcopy(candidate)
    changed["executionCeiling"]["epochs"] = 49
    mutations.append(changed)
    changed = deepcopy(candidate)
    changed["checkpointSelection"]["eligibleEpochs"] = [48]
    mutations.append(changed)
    changed = deepcopy(candidate)
    changed["activation"]["gpuQualificationAllowed"] = True
    mutations.append(changed)
    changed = deepcopy(candidate)
    changed["historicalV24"] = "parent"
    mutations.append(changed)
    for mutation in mutations:
        with pytest.raises(ValueError):
            worker.validate_candidate_contract(mutation)


def test_training_gate_uses_constructible_acyclic_file_binding_chain(tmp_path):
    candidate = worker.load_candidate_contract()
    for frozen_binding in candidate["frozenBindings"].values():
        copied = write_bound(
            tmp_path, frozen_binding["path"],
            (ROOT / frozen_binding["path"]).read_bytes())
        assert copied == frozen_binding
    frozen_train_binding = candidate["frozenBindings"]["trainSplit"]
    train_ids = json.loads(
        (ROOT / frozen_train_binding["path"]).read_bytes())["sampleIds"]
    candidate_binding = write_bound(tmp_path, worker.CANDIDATE_PATH, candidate)
    worker_binding = write_bound(tmp_path, worker.WORKER_PATH, b"worker")
    tests_binding = write_bound(tmp_path, worker.TEST_PATH, b"tests")
    programs = {"worker": worker_binding, "workerTests": tests_binding}
    for index, path in enumerate(worker.REQUIRED_PROGRAM_PATHS):
        if path in (worker.WORKER_PATH, worker.TEST_PATH):
            continue
        programs[f"implementation{index}"] = write_bound(
            tmp_path, path, ("implementation:" + path).encode("utf8"))
    run_id, package_id = "dry-run-0001", "dry-package-0001"
    review_plan = {
        "boundedDryReviewAllowed": True,
        "formalStage4QualificationAllowed": False,
        "runtimePublicationAllowed": False,
        "numericThresholdContract": candidate["frozenBindings"]["numericReview"],
        "detailThresholdContract": candidate["frozenBindings"]["detailReview"],
    }
    package = {"schemaVersion": worker.PACKAGE_SCHEMA,
        "status": "issued_single_attempt", "capabilityVersion": worker.CAPABILITY,
        "runId": run_id, "packageId": package_id,
        "candidateContract": candidate_binding,
        "datasetManifest": candidate["frozenBindings"]["datasetManifest"],
        "trainSplit": candidate["frozenBindings"]["trainSplit"],
        "validationSplit": candidate["frozenBindings"]["validationSplit"],
        "outputRoot": ".runtime/ai-painter/dry-run-0001",
        "resourceBudget": worker.RESOURCE_CEILING,
        "trainingPlan": {"epochs": 48, "trainRows": 48, "validationRows": 8,
            "eligibleCheckpointEpochs": [24, 36, 48],
            "generatorOptimizerSteps": 2304, "discriminatorOptimizerSteps": 2304,
            "historicalCheckpointLoaded": False},
        "programBindings": programs,
        "trainingIntent": "bounded_once", "trainingAllowed": False,
        "formalStage4QualificationAllowed": False,
        "runtimePublicationAllowed": False,
        "managedExecutionRequired": "javascript_managed_orchestration",
        "execution": {"reviewPlan": review_plan}}
    package_binding = write_bound(tmp_path, "runtime/base-package.json", package)
    initial_states = {"Model": "1" * 64, "Critic": "2" * 64}
    probe_cases = [{"passed": True, "optimizerCreated": False,
        "optimizerSteps": {"generator": 0, "discriminator": 0},
        "generatorCandidate": {"autogradGradCalls": 4},
        "discriminatorAutogradGradCalls": 1,
        "sourceTensorsUnchanged": True,
        "sourceTensorHashesBeforeAndAfter": {
            "image": f"{index:064x}", "conditions": f"{index + 48:064x}"},
        "initialStateSha256": initial_states, "finalStateSha256": initial_states,
        "case": {"sampleId": train_ids[index], "split": "train",
                 "trainOrdinal": index}}
        for index in range(48)]
    gpu = {"schemaVersion": worker.GPU_GATE_SCHEMA,
        "status": "current_candidate_zero_update_gpu_qualification_passed",
        "capabilityVersion": worker.CAPABILITY, "runId": run_id,
        "packageId": package_id, "executionPackage": package_binding,
        "candidateContract": candidate_binding,
        "historicalV24QualificationReused": False, "gpuInitialized": True,
        "optimizerCreated": False, "optimizerSteps": {"generator": 0, "discriminator": 0},
        "checkpointLoaded": False, "checkpointWritten": False,
        "weightsModified": False, "caseCount": 48,
        "generatorAutogradGradCalls": 192,
        "discriminatorAutogradGradCalls": 48,
        "initialStateSha256": initial_states, "finalStateSha256": initial_states,
        "cases": probe_cases,
        "trainingAllowedByThisArtifact": False}
    gpu_binding = write_bound(tmp_path, "runtime/gpu-gate.json", gpu)
    lock = {"schemaVersion": worker.LOCK_SCHEMA,
        "status": "active_bound_single_attempt", "runId": run_id,
        "packageId": package_id, "executionPackage": package_binding,
        "resourceBudget": worker.RESOURCE_CEILING}
    lock_binding = write_bound(tmp_path, "runtime/lock.json", lock)
    supervisor_pid = os.getppid()
    supervisor_identity = worker.managed_worker.process_identity(supervisor_pid)
    launch = {"schemaVersion": worker.LAUNCH_SCHEMA,
        "status": "managed_supervisor_identity_verified", "runId": run_id,
        "packageId": package_id, "executionPackage": package_binding,
        "managedLock": lock_binding, "processId": supervisor_pid,
        "processStartIdentity": supervisor_identity}
    launch_binding = write_bound(tmp_path, "runtime/launch.json", launch)
    ticket = {"schemaVersion": worker.TRAINING_TICKET_SCHEMA,
        "status": "issued_single_use", "capabilityVersion": worker.CAPABILITY,
        "runId": run_id, "packageId": package_id,
        "executionPackage": package_binding, "gpuQualification": gpu_binding,
        "managedLock": lock_binding, "launchIdentity": launch_binding,
        "consumptionClaimPath":
            ".runtime/ai-painter/dry-run-0001/training-ticket-consumed.json",
        "trainingAllowed": True, "automaticRetries": 0}
    ticket_binding = write_bound(tmp_path, "runtime/training-ticket.json", ticket)

    gate = worker.authenticate_training_gate(ticket_binding, root=tmp_path)
    assert gate.package_binding == package_binding
    assert gate.candidate_binding == candidate_binding
    assert gate.run_id == run_id and gate.package_id == package_id
    assert gate.supervisor_process_chain is not None
    assert [item["path"] for item in gate.source_bindings][-1]
    bad_gpu = deepcopy(gpu)
    bad_gpu["generatorAutogradGradCalls"] = 48
    bad_gpu_binding = write_bound(tmp_path, "runtime/gpu-gate-bad.json", bad_gpu)
    bad_ticket = {**ticket, "gpuQualification": bad_gpu_binding}
    bad_ticket_binding = write_bound(
        tmp_path, "runtime/training-ticket-bad.json", bad_ticket)
    with pytest.raises(ValueError):
        worker.authenticate_training_gate(
            bad_ticket_binding, root=tmp_path, check_process=False)
    (tmp_path / ".runtime/ai-painter/dry-run-0001").mkdir(parents=True)
    consumed = worker.consume_training_ticket(gate, root=tmp_path)
    assert consumed.authenticated == gate
    claim = json.loads((tmp_path / consumed.consumption_claim["path"]).read_bytes())
    assert claim["trainingTicket"] == ticket_binding
    assert claim["optimizerCreatedAtConsumption"] is False
    assert claim["gpuInitializedAtConsumption"] is False
    with pytest.raises(ValueError):
        worker.consume_training_ticket(gate, root=tmp_path)

    # A post-ticket package rewrite invalidates the first edge; no artifact can
    # repair this by pointing back to the ticket.
    (tmp_path / package_binding["path"]).write_text("{}", encoding="utf8")
    with pytest.raises(ValueError):
        worker.authenticate_training_gate(
            ticket_binding, root=tmp_path, check_process=False)


def test_validation_observation_is_read_only_and_uses_rgb_mae():
    model = EchoModel().train()
    sample = validation_sample()
    before_rng = torch.get_rng_state().clone()
    before_state = worker.v24.core.cpu.state_hash(model)
    row = worker.validation_observation(model, sample, order(), epoch=24)
    assert row["fullRgbMae"] == pytest.approx(0.0)
    assert all(value == pytest.approx(1.0, abs=2e-5)
               for value in row["objectCorrelations"].values())
    assert model.training is True
    assert worker.v24.core.cpu.state_hash(model) == before_state
    assert torch.equal(torch.get_rng_state(), before_rng)


def test_rank_requires_exact_order_epoch_count_and_four_class_coverage():
    ids = [f"validation-{index}" for index in range(8)]
    rows = []
    for index, sample_id in enumerate(ids):
        correlations = {role: None for role in worker.OBJECT_CHANNELS}
        correlations[worker.OBJECT_CHANNELS[index % 4]] = 0.1 + index / 100
        rows.append({"sampleId": sample_id, "split": "validation", "epoch": 24,
                     "fullRgbMae": 0.2 + index / 1000,
                     "objectCorrelations": correlations})
    result = worker.rank_validation_epoch(rows, ids, epoch=24)
    assert result["worstApplicableObjectCorrelation"] == pytest.approx(0.1)
    assert result["meanValidationRgbMae"] == pytest.approx(0.2035)
    assert result["rank"] == pytest.approx([0.1, -0.2035, -24])
    assert result["applicableImageCounts"] == {
        role: 2 for role in worker.OBJECT_CHANNELS}

    broken = deepcopy(rows)
    broken[0]["split"] = "train"
    with pytest.raises(ValueError):
        worker.rank_validation_epoch(broken, ids, epoch=24)
    broken = deepcopy(rows)
    broken.reverse()
    with pytest.raises(ValueError):
        worker.rank_validation_epoch(broken, ids, epoch=24)
    broken = deepcopy(rows)
    for row in broken:
        row["objectCorrelations"][worker.OBJECT_CHANNELS[0]] = None
    with pytest.raises(ValueError):
        worker.rank_validation_epoch(broken, ids, epoch=24)
    broken = deepcopy(rows)
    broken[0]["fullRgbMae"] = float("nan")
    with pytest.raises(ValueError):
        worker.rank_validation_epoch(broken, ids, epoch=24)
    with pytest.raises(ValueError):
        worker.rank_validation_epoch(rows, ids, epoch=25)


def test_checkpoint_preference_is_deterministic_and_keeps_earliest_tie():
    assert worker.prefer_checkpoint(rank(24), None) is True
    assert worker.prefer_checkpoint(rank(36, worst=0.3), rank(24)) is True
    assert worker.prefer_checkpoint(rank(36), rank(24)) is False
    assert worker.prefer_checkpoint(rank(36, mae=0.1), rank(24)) is True
    with pytest.raises(ValueError):
        worker.prefer_checkpoint(rank(24), rank(36))


def test_checkpoint_identity_and_cpu_exact_reload_reject_tampering():
    model, critic = tiny_factory(order())
    package = binding("runtime/package.json")
    candidate = binding(worker.CANDIDATE_PATH)
    selection = rank(24)
    payload, hashes = worker.serialize_checkpoint(
        model, critic, epoch=24, selection=selection,
        execution_package=package, candidate_contract=candidate)
    loaded_model, loaded_critic, observed = worker.reload_checkpoint_exact(
        payload, expected_epoch=24, expected_selection=selection,
        execution_package=package, candidate_contract=candidate,
        channel_order=order(), network_factory=tiny_factory)
    assert observed == hashes
    assert worker.nested_state_hash(worker._cpu_state_dict(loaded_model)) == hashes["Model"]
    assert worker.nested_state_hash(worker._cpu_state_dict(loaded_critic)) == hashes["Critic"]

    saved = torch.load(io.BytesIO(payload), map_location="cpu", weights_only=True)
    saved["historicalCheckpointLoaded"] = True
    stream = io.BytesIO()
    torch.save(saved, stream)
    with pytest.raises(ValueError):
        worker.reload_checkpoint_exact(
            stream.getvalue(), expected_epoch=24, expected_selection=selection,
            execution_package=package, candidate_contract=candidate,
            channel_order=order(), network_factory=tiny_factory)
    saved = torch.load(io.BytesIO(payload), map_location="cpu", weights_only=True)
    first = next(iter(saved["modelState"]))
    saved["modelState"][first] = saved["modelState"][first] + 1
    stream = io.BytesIO()
    torch.save(saved, stream)
    with pytest.raises(ValueError):
        worker.reload_checkpoint_exact(
            stream.getvalue(), expected_epoch=24, expected_selection=selection,
            execution_package=package, candidate_contract=candidate,
            channel_order=order(), network_factory=tiny_factory)


def test_training_entry_fails_closed_without_authenticated_gpu_and_js_gate():
    terminals = []
    result = worker.run_with_terminal_boundary(
        terminal_sink=terminals.append,
        train_samples=[], validation_samples=[], channel_order=order(),
        training_gate={"trainingAllowed": True},
        resource_check=lambda: None,
        checkpoint_sink=lambda *args: binding("runtime/checkpoint.pt"),
        device=torch.device("cpu"))
    assert result["status"] == "experiment_failed_closed"
    assert result["optimizerStepsGenerator"] == 0
    assert result["optimizerStepsDiscriminator"] == 0
    assert result["checkpointPromotionEligible"] is False
    assert result["formalStage4QualificationAllowed"] is False
    assert terminals == [result]


def test_atomic_progress_snapshot_and_failed_terminal_keep_latest_counts(tmp_path):
    output_root = ".runtime/ai-painter/progress-test"
    (tmp_path / output_root).mkdir(parents=True)
    authenticated = worker._AuthenticatedTrainingGate(
        binding("runtime/base.json"), binding(worker.CANDIDATE_PATH),
        "progress-run-0001", "progress-package-0001", output_root,
        binding("runtime/ticket.json"),
        output_root + "/training-ticket-consumed.json", None,
        {"Model": "1" * 64, "Critic": "2" * 64}, tuple())
    consumed = worker._ConsumedTrainingGate(
        authenticated, binding(output_root + "/training-ticket-consumed.json"))
    first = worker._progress_value(
        consumed, actual_epoch=1, completed_epochs=0,
        counts={"generator": 17, "discriminator": 18}, phase="executing")
    worker._publish_progress(consumed, first, root=tmp_path)
    second = worker._progress_value(
        consumed, actual_epoch=1, completed_epochs=1,
        counts={"generator": 48, "discriminator": 48}, phase="executing")
    worker._publish_progress(consumed, second, root=tmp_path)
    progress_path = tmp_path / output_root / "progress.json"
    assert json.loads(progress_path.read_bytes()) == second
    assert list(progress_path.parent.glob("progress.json.staged-*")) == []

    terminals = []
    result = worker.run_with_terminal_boundary(
        terminal_sink=terminals.append,
        train_samples=[], validation_samples=[], channel_order=order(),
        training_gate=consumed, resource_check=lambda: None,
        checkpoint_sink=lambda *args: binding("runtime/checkpoint.pt"),
        device=torch.device("cpu"), artifact_root=tmp_path)
    persisted = json.loads(progress_path.read_bytes())
    assert persisted["executionState"] == "failed_closed"
    assert persisted["optimizerStepsGenerator"] == 0
    assert persisted["optimizerStepsDiscriminator"] == 0
    assert result["latestProgress"] == persisted
    assert result["progressPublicationError"] is None
    assert terminals == [result]
