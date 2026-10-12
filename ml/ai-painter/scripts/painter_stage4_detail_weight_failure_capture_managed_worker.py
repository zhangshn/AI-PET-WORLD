"""Explicit failure boundary for the frozen detail-weight loop.

Component-only CPU evidence adapter. No GPU/registry/package admission exists
here: a future production caller needs independent final-source admission.
The pair hook is explicit, never installed into another module's globals.
"""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import random
import sys
import time

ROOT = Path(os.path.abspath(__file__)).parents[3]
for directory in (ROOT / "ml/ai-painter/scripts", ROOT / "ml/ai-painter/src"):
    if str(directory) not in sys.path:
        sys.path.insert(0, str(directory))
import painter_stage4_detail_weight_managed_worker as frozen
from ai_painter.complete_world import appearance_regime_gradient_failure_capture as capture

ENTRY = "ml/ai-painter/scripts/painter_stage4_detail_weight_failure_capture_managed_worker.py"
SCHEMA = "detail-weight-failure-capture-component-v1"
OUTPUT_PARENT = ".runtime/ai-painter/detail-weight-failure-capture-connection-t-q4-49/training"
TOTAL_BYTES, CAPTURE_BYTES, TERMINAL_RESERVE = 128 * 1024**2, 64 * 1024**2, 65536
FROZEN = {
    "ml/ai-painter/scripts/painter_stage4_detail_weight_managed_worker.py": "aeeaf8f536fd88c684c64c0f7fcf1293c56bac12558affc9810597ba9774d957",
    "ml/ai-painter/scripts/painter_stage4_appearance_regime_detail_weight_training_profile.py": "f40d084bb1821736dbc1d6a26a4b15a42b394e5f2b3423b681cc3143002cb5a6",
    "ml/ai-painter/src/ai_painter/complete_world/appearance_regime_gradient_failure_capture.py": "20dfbcd0fe87b26c7b56043dd792624d82d6ab2840cad90b13525acc9b933eef",
}
SOURCE_PATHS = frozenset((*FROZEN, ENTRY,
    "ml/ai-painter/tests/test_painter_stage4_detail_weight_failure_capture_managed_worker.py"))
MAX_INPUT_BYTES = 2097152
TASK_OUTPUT_BYTES = 8 * 1024**2


def require(value, message):
    if not value:
        raise ValueError(message)


def read_bound(binding, *, execution=False):
    """Reject scope/size before opening; read bounded stable file bytes."""
    binding = frozen.binding(binding)
    logical = binding["path"]
    if execution:
        require(logical.startswith(OUTPUT_PARENT + "/") and logical.endswith("/component-execution.json"),
                "execution metadata outside scoped synthetic Run")
    else:
        require(logical in SOURCE_PATHS, "only approved adapter/profile source references allowed")
    path = capture._path(binding["path"])
    capture._no_redirect(path)
    require(path.is_file(), "bound source absent")
    def identity(stat, *, include_ctime=True):
        shared = stat.st_dev, stat.st_ino, stat.st_size, stat.st_mtime_ns
        return (*shared, stat.st_ctime_ns) if include_ctime else shared
    before = path.stat()
    require(0 <= before.st_size <= MAX_INPUT_BYTES, "bound input byte ceiling exceeded before read")
    with path.open("rb") as stream:
        handle_before = os.fstat(stream.fileno())
        # Windows path stat and descriptor fstat expose different ctime
        # semantics in this runtime. File-id/size/mtime still agree across
        # APIs; each API's complete identity, including ctime, must be stable.
        require(identity(handle_before, include_ctime=False) == identity(before, include_ctime=False),
                "bound input changed before open")
        data = stream.read(MAX_INPUT_BYTES + 1)
        require(len(data) <= MAX_INPUT_BYTES and len(data) == before.st_size, "bound input grew/changed during read")
        require(identity(os.fstat(stream.fileno())) == identity(handle_before), "bound input changed during read")
    capture._no_redirect(path)
    require(identity(path.stat()) == identity(before), "bound input replaced after read")
    require(hashlib.sha256(data).hexdigest() == binding["sha256"], "actual source SHA differs")
    return path, data


def rehash(binding):
    return read_bound(binding)[0]


def attach(error, name, value):
    # Even a pathological exception rejecting attributes remains primary.
    try:
        setattr(error, name, value)
    except BaseException:
        pass


def secondary(error, stage, other):
    entries = list(getattr(error, "failure_capture_secondary_errors", ()))[:15]
    entries.append({"stage": stage, "error": capture._error(other)})
    attach(error, "failure_capture_secondary_errors", entries)


class ComponentContext:
    """Rehash CPU-only same-Run identity; legacy packages cannot authorize it."""
    def __init__(self, execution_binding, *, run_id, deadline):
        self.execution_binding = dict(execution_binding)
        self.run_id, self.deadline = run_id, deadline
        self.package, self.root = self.verify()
        self.verified_package = json.loads(json.dumps(self.package))
        self.verified_root = self.root
        self.verified_binding = dict(self.execution_binding)
        self.claim_binding = None
        self.consumed = False

    def verify(self, *, finalizing=False):
        if not finalizing:
            require(time.monotonic() < self.deadline, "component deadline exceeded")
            require(0 < self.deadline - time.monotonic() <= 120, "component wall ceiling differs")
        path, data = read_bound(self.execution_binding, execution=True)
        package = json.loads(data)
        require(package.get("schema") == SCHEMA and package.get("mode") == "synthetic-cpu-only"
                and package.get("productionAdopted") is False, "independent production admission absent; CPU component only")
        require(type(self.run_id) is str and self.run_id and package.get("runId") == self.run_id,
                "same-Run identity differs")
        root = capture._path(package["outputRoot"])
        parent = capture._path(OUTPUT_PARENT)
        capture._no_redirect(root)
        require(root != parent and root.is_relative_to(parent) and root.resolve().is_relative_to(parent.resolve()),
                "component output outside scoped evidence")
        require(path.is_relative_to(root), "execution binding must belong to same Run")
        bindings = package.get("sourceBindings")
        require(type(bindings) is list and 0 < len(bindings) <= 64, "bounded source bindings required")
        expected = dict(FROZEN)
        # The package's own adapter binding is verified against actual bytes
        # below, with the same bounded/stable read as every approved source.
        seen = {}
        for binding in bindings:
            rehash(binding)
            require(binding["path"] not in seen, "duplicate source binding")
            seen[binding["path"]] = binding["sha256"]
        require(ENTRY in seen and all(seen.get(key) == value for key, value in expected.items()),
                "final adapter/frozen profile lineage differs")
        for key, upper in (("outputLimitBytes", TOTAL_BYTES), ("captureLimitBytes", CAPTURE_BYTES)):
            require(type(package.get(key)) is int and 0 < package[key] <= upper, "component byte ceiling differs")
        require(package["outputLimitBytes"] > TERMINAL_RESERVE, "terminal reserve required")
        if hasattr(self, "verified_package"):
            require(package == self.verified_package and root == self.verified_root
                    and self.execution_binding == self.verified_binding and self.package == self.verified_package,
                    "previously verified Run identity changed")
        return package, root

    def remaining(self):
        package, root = self.verify()
        used = capture._owned_bytes(root)["totalBytes"]
        require(used <= package["outputLimitBytes"], "actual Run bytes exhausted")
        task_used = capture._owned_bytes(capture._path(OUTPUT_PARENT))["totalBytes"]
        require(task_used <= TASK_OUTPUT_BYTES, "aggregate task output already exhausted")
        return min(package["captureLimitBytes"], max(0, package["outputLimitBytes"] - used - TERMINAL_RESERVE),
                   max(0, TASK_OUTPUT_BYTES - task_used - TERMINAL_RESERVE))

    def write(self, name, value, *, terminal=False):
        package, root = self.verify(finalizing=terminal)
        require(not terminal or self.consumed, "failure finalization requires an owned consumed Run")
        if terminal:
            claim = root / "component-consumed.json"
            require(self.claim_binding is not None and claim.stat().st_size <= TERMINAL_RESERVE
                    and capture._binding(claim) == self.claim_binding, "actual consumed Run claim differs")
        require(name in ("component-consumed.json", "component-terminal.json"), "unknown component artifact")
        data = capture._json(value)
        require(len(data) <= (TERMINAL_RESERVE if terminal else 2097152), "component JSON ceiling")
        used = capture._owned_bytes(root)["totalBytes"]
        require(used + len(data) <= package["outputLimitBytes"] - (0 if terminal else TERMINAL_RESERVE),
                "actual output/reserve exhausted")
        task_used = capture._owned_bytes(capture._path(OUTPUT_PARENT))["totalBytes"]
        require(task_used + len(data) <= TASK_OUTPUT_BYTES - (0 if terminal else TERMINAL_RESERVE),
                "aggregate task output/reserve exhausted")
        root.mkdir(parents=True, exist_ok=True)
        with (root / name).open("xb") as stream:
            require(stream.write(data) == len(data), "short component write")
            stream.flush()
            os.fsync(stream.fileno())
        return capture._binding(root / name)

    def claim(self):
        require(not self.consumed, "component invocation consumed; no retry")
        # A new object cannot bypass the persisted exclusive claim.
        self.claim_binding = self.write("component-consumed.json", {"schema": SCHEMA, "runId": self.run_id, "automaticRetries": 0})
        self.consumed = True


def cpu_guard(model, critic):
    import torch
    require(torch.get_num_threads() <= 2 and not torch.cuda.is_initialized(), "CPU-only component resource boundary")
    require(all(tensor.device.type == "cpu" for network in (model, critic)
                for tensor in list(network.parameters()) + list(network.buffers())), "CPU-only component tensors required")


class FailureCapturePair:
    def __init__(self, context, *, pair_runner, progress_sink, capture_runner=capture.capture_gradient_failure):
        self.context, self.pair_runner = context, pair_runner
        self.progress_sink, self.capture_runner = progress_sink, capture_runner
        self.failed = False

    def __call__(self, *, epoch, train_position, model, critic, sample, order, go, do,
                 counts, ledger, resource, selected, completed_epochs):
        require(not self.failed, "failed pair consumed; no retry")
        require(type(epoch) is int and 1 <= epoch <= 48 and type(train_position) is int
                and 1 <= train_position <= 48, "explicit loop location required")
        require(sample.get("split") == "train" and ledger.get("sampleId") == sample.get("sampleId"),
                "actual dispatch sample/ledger differs")
        self.context.verify()
        cpu_guard(model, critic)
        try:
            return self.pair_runner(model, critic, sample, order, go, do, counts, ledger, resource, None)
        except BaseException as error:
            self.failed = True
            actual = {"epoch": epoch, "trainPosition": train_position, "sampleId": sample["sampleId"],
                      "split": sample["split"], "ledger": dict(ledger), "counts": dict(counts),
                      "origin": "actual_loop_dispatch", "inferredSample": False}
            attach(error, "failure_capture_dispatch", actual)
            attach(error, "actual_optimizer_counts", dict(counts))
            try:
                self.progress_sink(epoch, dict(counts), selected, completed_epochs=completed_epochs,
                                   state="failed_closed", force=True)
            except BaseException as other:
                secondary(error, "failure_progress", other)
            try:
                remaining = self.context.remaining()
                receipt = self.capture_runner(error=error, model=model, critic=critic, sample=sample,
                    counts=dict(counts), epoch=epoch, train_position=train_position,
                    output_root=self.context.root / "failure-capture", execution_binding=self.context.execution_binding,
                    source_bindings=self.context.package["sourceBindings"], remaining_output_bytes=remaining)
                attach(error, "gradient_failure_capture", receipt)
                # Only rehashed, safely reloaded bytes justify a complete receipt.
                if receipt.get("status") in ("failure_evidence_captured", "partial_failure_evidence_captured"):
                    manifest, _tensors = capture.verify_gradient_failure_capture(receipt)
                    require(manifest["location"] == {key: actual[key] for key in
                            ("epoch", "trainPosition", "sampleId", "split", "inferredSample")} | {"origin": "explicit_capture_call"}
                            and manifest["counts"] == actual["counts"], "captured dispatch identity differs")
                self.context.remaining()
            except BaseException as other:
                secondary(error, "failure_capture", other)
                saved = getattr(error, "gradient_failure_capture", None)
                attach(error, "gradient_failure_capture", {"status": "capture_interrupted" if isinstance(other, (KeyboardInterrupt, SystemExit)) else "capture_failed",
                    "captureError": capture._error(other), "unverifiedCaptureReceipt": saved,
                    "executionQualified": False, "automaticRetries": 0})
            raise


def training_loop(*, context, model, critic, train, validation, order, configuration,
                  package_binding, plan, resource, checkpoint_sink, progress_sink,
                  profile=None, pair_runner=None, optimizer_factory=None, capture_runner=capture.capture_gradient_failure,
                  validation_runner=frozen.validation_epoch, checkpoint_encoder=frozen.checkpoint.encode,
                  checkpoint_reloader=frozen.checkpoint.reload, fresh_networks=None):
    """Frozen 48×48 schedule/ranking/codec, with actual dispatch coordinates."""
    torch, frozen_profile, shared, _source = frozen.runtime()
    profile = profile or frozen_profile
    context.verify()
    cpu_guard(model, critic)
    require(package_binding == context.execution_binding and plan["runId"] == context.run_id
            and plan["outputRoot"] == context.package["outputRoot"], "loop same-Run binding differs")
    shared._validate_samples(train, validation)
    context.claim()
    counts = {"generator": 0, "discriminator": 0}
    records, selected, completed_epochs = [], None, 0
    args = dict(lr=.0001, betas=(.9, .999), eps=1e-8, weight_decay=.01, foreach=False, fused=False)
    optimizer_factory = optimizer_factory or torch.optim.AdamW
    go = optimizer_factory(model.parameters(), **args)
    do = optimizer_factory(critic.parameters(), **args)
    pair = FailureCapturePair(context, pair_runner=pair_runner or profile.perform_pair,
                              progress_sink=progress_sink, capture_runner=capture_runner)
    try:
        for epoch in range(1, 49):
            order_indices = list(range(48))
            random.Random(20260929 + epoch).shuffle(order_indices)
            for position, i in enumerate(order_indices, 1):
                resource()
                ledger = {"sampleId": train[i]["sampleId"], "generator": 0, "discriminator": 0}
                pair(epoch=epoch, train_position=position, model=model, critic=critic, sample=train[i],
                     order=order, go=go, do=do, counts=counts, ledger=ledger, resource=resource,
                     selected=selected, completed_epochs=completed_epochs)
                require(ledger == {"sampleId": train[i]["sampleId"], "generator": 1, "discriminator": 1}, "actual pair ledger differs")
                progress_sink(epoch, counts, selected, completed_epochs=completed_epochs)
            require(counts == {"generator": epoch * 48, "discriminator": epoch * 48}, "actual epoch counts differ")
            completed_epochs = epoch
            if epoch in (24, 36, 48):
                selection, observations = validation_runner(model, validation, order, epoch=epoch)
                raw = checkpoint_encoder(model, critic, configuration=configuration, run_id=plan["runId"],
                    package_binding=package_binding, dataset_binding=plan["datasetManifest"], epoch=epoch,
                    selection=selection, counts=counts)
                bound = checkpoint_sink(epoch, raw)
                require(bound["sha256"] == hashlib.sha256(raw).hexdigest(), "checkpoint sink source SHA differs")
                record = {"epoch": epoch, "selection": selection, "validation": observations,
                          "checkpoint": bound, "counts": dict(counts)}
                records.append(record)
                if shared.prefer_checkpoint(selection, None if selected is None else selected["selection"]):
                    selected = record
            progress_sink(epoch, counts, selected, completed_epochs=completed_epochs)
        cpu_model, cpu_critic = (fresh_networks or frozen_profile.fresh_networks)(order)
        raw = checkpoint_sink(None, selected["checkpoint"])
        checkpoint_reloader(raw, model=cpu_model, critic=cpu_critic, configuration=configuration,
            run_id=plan["runId"], package_binding=package_binding, dataset_binding=plan["datasetManifest"],
            epoch=selected["epoch"], selection=selected["selection"], counts=selected["counts"])
        return {"schema": frozen.TERMINAL_SCHEMA, "status": "training_completed_review_pending",
            "capabilityVersion": frozen.CAPABILITY, "executionPackage": package_binding,
            "runId": plan["runId"], "packageId": plan["packageId"], "completedEpochs": 48,
            "executionState": "completed", "optimizerStepsGenerator": counts["generator"],
            "optimizerStepsDiscriminator": counts["discriminator"], "optimizerSteps": dict(counts),
            "checkpoints": records, "selectedCheckpointRecord": selected, "checkpointReloadVerified": True,
            "challengeContentRead": False, "regressionContentRead": False, "checkpointPromotable": False,
            "formalStage4QualificationAllowed": False, "runtimePublicationAllowed": False,
            "componentOnly": True, "productionAdopted": False}
    except BaseException as error:
        attach(error, "actual_optimizer_counts", dict(counts))
        attach(error, "partial_checkpoint_records", records)
        attach(error, "completed_epochs", completed_epochs)
        raise


def run_captured_boundary(*, context, terminal_sink=None, **arguments):
    """Keep exact primary exception across late terminal IO/interruption."""
    try:
        terminal = training_loop(context=context, **arguments)
    except BaseException as error:
        terminal = {"schema": SCHEMA, "status": "failed_closed", "executionState": "failed_closed",
            "runId": context.run_id, "executionPackage": context.execution_binding,
            "originalError": capture._error(error), "optimizerSteps": getattr(error, "actual_optimizer_counts", None),
            "completedEpochs": getattr(error, "completed_epochs", None),
            "partialCheckpoints": getattr(error, "partial_checkpoint_records", []),
            "dispatch": getattr(error, "failure_capture_dispatch", None),
            "capture": getattr(error, "gradient_failure_capture", None),
            "secondaryErrors": getattr(error, "failure_capture_secondary_errors", []),
            "productionAdopted": False, "automaticRetries": 0}
        attach(error, "failure_capture_terminal", terminal)
        attach(error, "failure_capture_terminal_publication", {"status": "not_saved", "complete": False})
        try:
            bound = (terminal_sink or (lambda value: context.write("component-terminal.json", value, terminal=True)))(terminal)
            attach(error, "failure_capture_terminal_publication", {"status": "saved" if terminal_sink is None else "external_sink_returned_unverified",
                "complete": terminal_sink is None, "binding": bound})
        except BaseException as other:
            secondary(error, "failure_terminal", other)
            attach(error, "failure_capture_terminal_publication", {"status": "not_saved", "complete": False,
                "error": capture._error(other)})
        raise
    (terminal_sink or (lambda value: context.write("component-terminal.json", value, terminal=True)))(terminal)
    return terminal


def run(*_args, **_kwargs):
    raise ValueError("production adoption requires independent final-source lifecycle/package admission; CPU component only")


if __name__ == "__main__":
    run()
