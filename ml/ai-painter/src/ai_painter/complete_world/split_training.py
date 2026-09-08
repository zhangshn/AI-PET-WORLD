"""Optimizer/evaluation boundary for a separately qualified split successor.

This is a training-loop component, not an execution grant or GPU entrypoint.
The existing frozen Smoke adapter is deliberately not changed to use it in place.
"""
from __future__ import annotations

from contextlib import contextmanager
import hashlib
import json


def state_hash(value) -> str:
    """Hash tensor values plus nested optimizer metadata without pickle."""
    import torch
    h = hashlib.sha256()

    def visit(item):
        if isinstance(item, torch.Tensor):
            tensor = item.detach().cpu().contiguous()
            h.update(json.dumps(["tensor", str(tensor.dtype), list(tensor.shape)]).encode())
            h.update(tensor.reshape(-1).view(torch.uint8).numpy().tobytes())
        elif isinstance(item, dict):
            h.update(b"dict:")
            for key in sorted(item, key=lambda k: (type(k).__name__, str(k))):
                visit(key)
                visit(item[key])
        elif isinstance(item, (list, tuple)):
            h.update((type(item).__name__ + ":").encode())
            for child in item:
                visit(child)
        elif item is None or isinstance(item, (str, bool, int, float)):
            h.update(json.dumps([type(item).__name__, item], allow_nan=False).encode())
        else:
            raise TypeError("unsupported state value: " + type(item).__name__)
    visit(value)
    return h.hexdigest()


class TrainSplitBoundary:
    """One checked train batch permits one optimizer step, with a source ledger.

    The loader must come from the bound SplitReleaseDataset. Replay is excluded
    from this boundary; a replay policy requires its own explicit contract.
    """
    def __init__(self, model, optimizer, dataset):
        from .split_release import SplitReleaseDataset
        if not isinstance(dataset, SplitReleaseDataset) or dataset.split != "train":
            raise ValueError("optimizer Dataset must be the bound train split")
        self.model, self.optimizer, self.dataset = model, optimizer, dataset
        self.allowed_ids = frozenset(row["sampleId"] for row in dataset.rows)
        self.release_id = dataset.manifest["datasetReleaseIdentity"]
        self.records = []
        self.rejected_steps = 0
        self._active = None
        self._phase = "idle"
        self._hooks = []

    def __enter__(self):
        if self._hooks:
            raise RuntimeError("training boundary is already active")
        self._hooks = [self.optimizer.register_step_pre_hook(self._before_step),
                       self.optimizer.register_step_post_hook(self._after_step)]
        return self

    def __exit__(self, *_):
        for hook in self._hooks:
            hook.remove()
        self._hooks = []
        self._active, self._phase = None, "idle"

    def _before_step(self, *_):
        if self._phase != "train" or self._active is None or self._active["consumed"]:
            self.rejected_steps += 1
            raise ValueError("optimizer step outside an unconsumed train batch")

    def _after_step(self, *_):
        self._active["consumed"] = True
        self.records.append({"optimizerStep": len(self.records) + 1,
                             "sampleIds": list(self._active["ids"]), "split": "train",
                             "datasetReleaseIdentity": self.release_id,
                             "datasetSelectionSha256": self.dataset.selection_sha256})

    def wrap_loader(self, loader):
        if not self._hooks or loader.dataset is not self.dataset:
            raise ValueError("training loader must use the exact bound Dataset")
        boundary = self

        class CheckedLoader:
            dataset = loader.dataset

            def __len__(self):
                return len(loader)

            def __iter__(self):
                for batch in loader:
                    ids = batch.get("sampleId")
                    if (not isinstance(ids, (list, tuple)) or not ids
                            or any(key not in boundary.allowed_ids for key in ids)
                            or list(batch.get("split", [])) != ["train"] * len(ids)
                            or list(batch.get("datasetReleaseIdentity", [])) != [boundary.release_id] * len(ids)):
                        raise ValueError("non-train or cross-release batch refused before forward")
                    if boundary._phase != "idle":
                        raise ValueError("nested training/evaluation boundary")
                    boundary._phase = "train"
                    boundary._active = {"ids": tuple(ids), "consumed": False}
                    try:
                        yield batch
                    finally:
                        boundary._active, boundary._phase = None, "idle"
        return CheckedLoader()

    @contextmanager
    def evaluation(self):
        import torch
        if not self._hooks or self._phase != "idle":
            raise ValueError("evaluation requires an idle active boundary")
        before = state_hash(self.model.state_dict())
        optimizer_before = state_hash(self.optimizer.state_dict())
        modes = [(module, module.training) for module in self.model.modules()]
        self._phase = "evaluation"
        self.model.eval()
        try:
            with torch.no_grad():
                yield
        finally:
            self._phase = "idle"
            for module, training in modes:
                module.training = training
            if before != state_hash(self.model.state_dict()) or optimizer_before != state_hash(self.optimizer.state_dict()):
                raise ValueError("evaluation mutated model or optimizer state")

    def evidence(self):
        return {"schemaVersion": "ai-painter-train-split-step-evidence-v1",
                "optimizerSteps": len(self.records), "nonTrainOptimizerSteps": 0,
                "rejectedOptimizerStepAttempts": self.rejected_steps,
                "steps": [dict(row) for row in self.records]}
