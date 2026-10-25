"""Finite read-only history for FIT006; never a training/review credential."""
from dataclasses import dataclass
import ast
import hashlib
from pathlib import Path
import weakref

CASE = ".runtime/ai-painter/controller-repair-reviews/fit-comparison-006-20261022/evaluation-v1"
RUN = "d1-src-v1-850c25f8-8181-446e-99da-3dae2dbb21a8"
BASE = ".runtime/ai-painter/registered-training-d1-src-v1-executions/" + RUN
PLAN = {"path": BASE + "/quality-plan.json", "sha256": "fc2a9d8d4d1b9cdb280be9e8d2ad5459f3a0f24e0543e5ef030bc64741bfa641"}
TERMINAL = {"path": BASE + "/worker-terminal.json", "sha256": "9f11ec2f93cfcf1cf43ce4c384b16e208e29c57d7ae0f1468053b0cc12d7e708"}
CHECKPOINT_SHA = "275886bb27c2ba1942c768f4cbb1bb7fc2c49024509d8b06e2ed6a5f832d49d4"
PRESERVATION = {"path": ".runtime/ai-painter/controller-repair-reviews/training-review-data-identity-20261022/all-original-source-preservation.json",
    "sha256": "fc9a2887b339159033cbfff27259e5025da679d3423365d8441fcdf081f7d24a"}
LIMITS = {"wallSeconds": 600, "batchWallSeconds": 180, "cpuThreads": 2,
    "modelForwards": 56, "batches": 4, "outputBytes": 8388608, "optimizerUpdates": 0, "automaticRetries": 0}
_VERIFIED = weakref.WeakSet()


def need(value, message):
    if not value:
        raise ValueError(message)


@dataclass(frozen=True)
class FitHistory:
    root: str
    aliases: tuple
    semantics: tuple


def validated_history(history, root):
    need(type(history) is FitHistory and history in _VERIFIED
         and history.root == str(Path(root).absolute()), "verified same-root FIT006 history required")
    return history


def function_ast(source, name):
    tree = ast.parse(source)
    matches = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == name]
    need(len(matches) == 1, "one historical function required: " + name)
    return ast.dump(matches[0], include_attributes=False)


def inspect_fit_inputs(root, request):
    """Read-only preflight; the returned value is NOT a registered credential."""
    from decode1_entry_weight_quality_auth_v1 import Reader, _REVIEW_NORMALS
    live = Reader(root)
    need(request.get("schemaVersion") == "current-checkpoint-fit-comparison-cpu-request-v1"
         and request.get("taskId") == "PAINTER-FIT-COMPARISON-006"
         and request.get("diagnosticId") == "painter-fit-comparison-006"
         and request.get("outputRoot") == CASE and request.get("sourceRunId") == RUN
         and request.get("sourcePlan") == PLAN and request.get("sourceTerminal") == TERMINAL
         and request.get("limits") == LIMITS, "exact FIT006 scope required")
    need(request.get("specification") == {"path": "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
         "sha256": "ba3fa217ca7f7127efe9e1d65421a650283c21391516bbbe1d19abe519cd242b"}, "FIT006 normative version differs")
    live.read(request["specification"])
    original = live.json(PLAN)
    terminal = live.json(TERMINAL)
    need(original["runId"] == terminal["runId"] == RUN
         and original["capabilityVersion"] == "stage4_mvp256_dry_decode1_registered_source_v1"
         and terminal["status"] == "training_completed_review_pending"
         and terminal["completedEpochs"] == 24 and terminal["checkpointReloadVerified"] is True,
         "completed source identity differs")
    selected = terminal["selectedCheckpointRecord"]
    need(selected["checkpoint"] == request["checkpoint"]
         and request["checkpoint"]["sha256"] == CHECKPOINT_SHA
         and selected["counts"] == {"generator": 1152, "discriminator": 1152}
         and selected["epoch"] == 24 and terminal["executionPackage"] == request["sourcePackage"],
         "exact final checkpoint required")
    package = live.json(request["sourcePackage"])
    need(PLAN in package["inputEvidence"] and request["sourcePackage"]["sha256"] ==
         "835e0bb18a2fb7f5614b1bf7b494acd8149842475584b313f0be24ff0f9ae27a", "source package differs")
    preservation = live.json(PRESERVATION)
    need(preservation["sourcePlan"] == PLAN and preservation["sourcePackage"] == request["sourcePackage"],
         "source preservation identity differs")
    rows = preservation["entries"]
    need(len(rows) == len(original["programBindings"]) == 256
         and len({r["role"] for r in rows}) == len(rows), "historical closure differs")
    aliases, snapshots = [], {}
    for row in rows:
        old = original["programBindings"][row["role"]]
        need(row["originalPath"] == old["path"] and row["sha256"] == old["sha256"]
             and row["snapshotPath"] == PRESERVATION["path"].rsplit("/", 1)[0] + "/source-baselines/" + old["sha256"] + ".txt",
             "historical source mapping differs")
        snapshots[row["role"]] = live.read({"path": row["snapshotPath"], "sha256": old["sha256"]})
        aliases.append((old["path"], old["sha256"], row["snapshotPath"]))
    for logical, digest, snapshot, _ in _REVIEW_NORMALS:
        live.read({"path": snapshot, "sha256": digest})
        aliases.append((logical, digest, snapshot))
    programs = request["actualPrograms"]
    need(type(programs) is list and 1 <= len(programs) <= 256
         and len({b["path"] for b in programs}) == len(programs), "actual diagnostic closure differs")
    actual = {b["path"]: live.read(b, 1048576) for b in programs}
    need(sum(map(len, actual.values())) <= 16 * 1024 ** 2, "actual source total exceeded")
    auth_path = "ml/ai-painter/scripts/decode1_entry_weight_quality_auth_v1.py"
    need(auth_path in actual and hashlib.sha256(actual[auth_path]).hexdigest() ==
         hashlib.sha256((Path(root) / auth_path).read_bytes()).hexdigest(), "actual auth omitted")
    semantics = []
    for role, names in {"trainingProfile": ("fresh_networks", "_bound_device", "sample_forward"),
                        "worker": ("load_samples",), "managedCheckpoint": ("_metadata", "reload")}.items():
        logical = original["programBindings"][role]["path"]
        need(logical in actual, "actual inference source omitted: " + role)
        for name in names:
            old_ast = function_ast(snapshots[role], name)
            need(old_ast == function_ast(actual[logical], name), "inference semantics changed: " + role + "." + name)
            semantics.append((logical, name, hashlib.sha256(old_ast.encode()).hexdigest()))
    live.unchanged()
    return FitHistory(str(Path(root).absolute()), tuple(aliases), tuple(semantics))


def verified_fit_history(root, request_binding):
    from decode1_entry_weight_quality_auth_v1 import Reader, _VERIFIED_FIT_HISTORIES
    need(request_binding["path"] == CASE + "/request.json", "exact FIT006 request path required")
    history = inspect_fit_inputs(root, Reader(root).json(request_binding))
    _VERIFIED.add(history)
    _VERIFIED_FIT_HISTORIES.add(history)
    return history
