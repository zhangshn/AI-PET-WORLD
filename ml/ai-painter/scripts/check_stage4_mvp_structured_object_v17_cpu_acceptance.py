"""Bounded CPU numerical probe only; no formal qualification or optimizer.

Decode only the first frozen train and validation members. Other split files
are membership metadata. All output goes to a new private runtime namespace.
"""
from __future__ import annotations

import argparse
import base64
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from unittest.mock import patch
import uuid

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
from ai_painter.complete_world.split_release import canonical_bytes, project_file

PROGRAM_PATH = "ml/ai-painter/scripts/check_stage4_mvp_structured_object_v17_cpu_acceptance.py"
TEST_PATH = "ml/ai-painter/tests/test_stage4_mvp_structured_object_v17_cpu_acceptance.py"
OUTPUT_ROOT = ".runtime/ai-painter/stage4-mvp-structured-object-v17-cpu-probes"
REPORT_SCHEMA = "stage4-mvp-structured-object-v17-cpu-numerical-probe-v1"
MAX_SECONDS = 120
SEED = 20260927
THREADS = 2
MANIFEST = {
    "path": "data/world-samples/ai-assisted-cold-start-dataset-packages/"
            "stage4-v2-mvp64-denoiser-qualified-016bee510b7636115d4241787ac361594dc8c88de7bb74970d86dbd4a3964e71/manifest.json",
    "sha256": "3d3cb6c594bd3b719e9dd13e366d492e1ac1717caaecca78434468484ac70913",
}
CONDITION_CONTRACT = {
    "path": "data/ai-painter/system-governance/ai-painter-complete-map-condition-contract-v1.json",
    "sha256": "c8941c7730edb73c0b0a733bc877cf550184e2f3ab2adb08102fb0214d38cac2",
}
COUNTS = {"train": 48, "validation": 8, "challenge": 4, "regression": 4}
PROGRAMS = [PROGRAM_PATH, TEST_PATH,
    "ml/ai-painter/src/ai_painter/complete_world/native_rgb_structured_object_cpu_v17.py",
    "ml/ai-painter/src/ai_painter/complete_world/native_rgb_structured_object_objective_cpu_v17.py",
    "ml/ai-painter/src/ai_painter/complete_world/native_rgb_conditional_texture_cpu.py",
    "ml/ai-painter/src/ai_painter/complete_world/native_rgb_instance_object_prototype.py",
    "ml/ai-painter/src/ai_painter/complete_world/native_rgb_aperiodic_detail_renderer.py",
    "ml/ai-painter/src/ai_painter/complete_world/native_rgb_local_texture_objective_v12.py",
    "ml/ai-painter/src/ai_painter/complete_world/object_instance_supervision_cpu.py",
    "ml/ai-painter/src/ai_painter/complete_world/split_release.py",
    "ml/ai-painter/src/ai_painter/training/discriminator.py"]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


class BoundReader:
    def __init__(self, root=ROOT):
        self.root = root
        self.observed = {}

    def read(self, binding):
        require(isinstance(binding, dict) and isinstance(binding.get("sha256"), str)
                and len(binding["sha256"]) == 64
                and all(c in "0123456789abcdef" for c in binding["sha256"]), "missing SHA binding")
        data = project_file(self.root, binding["path"]).read_bytes()
        require(sha(data) == binding["sha256"], "source SHA mismatch: " + binding["path"])
        self.observed[binding["path"]] = binding["sha256"]
        return data

    def json(self, binding):
        result = json.loads(self.read(binding))
        require(isinstance(result, dict), "source must be a JSON object")
        return result

    def snapshot(self, path):
        data = project_file(self.root, path).read_bytes()
        binding = {"path": path, "sha256": sha(data)}
        self.observed[path] = binding["sha256"]
        return data, binding

    def unchanged(self):
        for path, digest in list(self.observed.items()):
            self.read({"path": path, "sha256": digest})


def verify_js_content_hash(data, excluded, expected):
    """Match the source compiler's JSON.stringify hash, including JS numbers."""
    code = ("const fs=require('node:fs'),c=require('node:crypto');"
            "const v=JSON.parse(fs.readFileSync(0,'utf8'));"
            "const o=JSON.parse(Buffer.from(v.data,'base64').toString('utf8'));"
            "delete o[v.excluded];"
            "process.stdout.write(c.createHash('sha256').update(JSON.stringify(o)).digest('hex'));")
    result = subprocess.run(["node", "-e", code], input=json.dumps({
        "data": base64.b64encode(data).decode("ascii"), "excluded": excluded}),
        capture_output=True, text=True, check=True, timeout=10)
    require(result.stdout == expected, "canonical content SHA mismatch: " + excluded)


def select_rows(reader):
    manifest = reader.json(MANIFEST)
    contract = reader.json(CONDITION_CONTRACT)
    require(manifest["sampleCount"] == 64 and manifest["splitCounts"] == COUNTS,
            "frozen 64/48/8/4/4 membership differs")
    require(manifest["datasetReleaseIdentity"] == manifest["packageId"], "dataset identity differs")
    source = reader.json(manifest["sourceIndex"])
    rows = source["samples"]
    require(len(rows) == source["sampleCount"] == 64, "source row count differs")
    by_id = {row["sampleId"]: row for row in rows}
    require(len(by_id) == 64, "duplicate source sample ID")
    order = contract["tensorContract"]["channelOrder"]
    continuous = contract["tensorContract"]["typePartitions"]["continuous"]
    require(manifest["identityPayload"]["channelOrder"] == order and len(order) == len(set(order)) == 23
            and manifest["identityPayload"]["continuousChannelIds"] == continuous,
            "dataset condition order or type partition differs")
    selected, memberships, seen = {}, {}, set()
    for split, count in COUNTS.items():
        membership = reader.json(manifest["splits"][split])
        ids = membership["sampleIds"]
        require(membership["split"] == split and len(ids) == len(set(ids)) == count
                and seen.isdisjoint(ids) and all(key in by_id and by_id[key]["split"] == split for key in ids),
                "split membership differs: " + split)
        seen.update(ids)
        memberships[split] = {"count": count, "selectionSha256": sha(canonical_bytes([by_id[key] for key in ids]))}
        if split in ("train", "validation"):
            selected[split] = deepcopy(by_id[ids[0]])
    require(len(seen) == 64, "incomplete split partition")
    return manifest, order, continuous, selected, memberships


def validate_pack(row, pack, order):
    require(pack["schemaVersion"] == "complete-world-visual-condition-pack-v1", "condition schema differs")
    require([item["id"] for item in pack["channels"]] == order, "condition channel order differs")
    require(pack["worldId"] == row["grouping"]["worldId"], "row/condition world mismatch")
    require((pack["canvas"]["width"], pack["canvas"]["height"]) == (1024, 768), "condition canvas differs")
    require(isinstance(pack.get("objectInstanceTable"), list) and pack["objectInstanceTable"], "missing object table")
    for item in pack["channels"]:
        require(item["dtype"] == "uint8" and item["shape"] == [1, 768, 1024], "channel shape or dtype differs")


def load_sample(reader, row, order, continuous):
    import numpy as np
    from PIL import Image
    import torch
    from ai_painter.complete_world.native_rgb_structured_object_cpu_v17 import validate_bound_object_views

    require(row["split"] in ("train", "validation"), "content read prohibited for this split")
    pack = reader.json(row["conditionPack"])
    validate_pack(row, pack, order)
    contribution = reader.json(row["contribution"])
    record = reader.json(row["sourceRecord"])
    reader.read(row["regionSource"])
    require(contribution["imageSha256"] == row["image"]["sha256"] == record["originalImage"]["sha256"]
            and contribution["conditionPackPath"] == row["conditionPack"]["path"]
            and contribution["conditionPackFileSha256"] == row["conditionPack"]["sha256"]
            and contribution["conditionWorldId"] == pack["worldId"], "source image/condition binding mismatch")
    task_binding = {"path": contribution["taskPackagePath"], "sha256": contribution["taskPackageSha256"]}
    require(task_binding["path"] == pack["sourceBindings"]["taskPackagePath"], "task path differs")
    task_bytes = reader.read(task_binding)
    task = json.loads(task_bytes)
    verify_js_content_hash(task_bytes, "taskSha256", pack["taskSha256"])
    require(task["taskSha256"] == pack["taskSha256"] and task["taskId"] == pack["taskId"]
            and task["worldId"] == pack["worldId"] and task["tick"] == pack["tick"], "task/condition identity differs")
    visual_path = task["sourceBindings"]["visualFactManifestPath"]
    require(visual_path == pack["sourceBindings"]["visualFactManifestPath"], "visual fact path differs")
    visual_bytes, visual_binding = reader.snapshot(visual_path)
    verify_js_content_hash(visual_bytes, "manifestSha256", pack["visualFactManifestSha256"])
    visual = json.loads(visual_bytes)
    require(visual["worldId"] == pack["worldId"] and visual["tick"] == pack["tick"]
            and visual["manifestId"] == pack["visualFactManifestId"]
            and visual["manifestSha256"] == task["sourceBindings"]["visualFactManifestSha256"], "visual fact identity differs")
    facts_binding = {"path": task["sourceBindings"]["naturalizedWorldFactsPath"],
                     "sha256": task["sourceBindings"]["naturalizedWorldFactsSha256"]}
    facts = reader.json(facts_binding)
    require(facts["v7SlotBinding"]["slotId"] == row["capacitySlotId"], "source facts slot differs")
    source_objects = task["spatialLayers"]["objectFootprints"]
    table = pack["objectInstanceTable"]
    require(len(source_objects) == len(table), "source object count differs")
    for ordinal, (item, source_object) in enumerate(zip(table, source_objects), 1):
        require(item["value"] == ordinal and all(item[key] == source_object[key] for key in (
            "objectId", "kind", "footprint", "blocksMovement")), "source object table differs")

    def pixels(binding, mode, resampling):
        with Image.open(io.BytesIO(reader.read(binding))) as image:
            require(image.format == "PNG" and image.size == (1024, 768) and image.mode == mode,
                    "native PNG dimensions or mode differs")
            return np.asarray(image.resize((256, 192), resample=resampling), dtype=np.uint8).copy()

    image = pixels(row["image"], "RGB", Image.Resampling.LANCZOS)
    channels = [pixels(item, "L", Image.Resampling.BILINEAR if item["id"] in continuous else Image.Resampling.NEAREST)
                for item in pack["channels"]]
    sample = {"sampleId": row["sampleId"], "split": row["split"],
              "image": torch.from_numpy(image).permute(2, 0, 1).float().div(255),
              "conditions": torch.stack([torch.from_numpy(value).float().div(255) for value in channels]),
              "objectInstanceTable": deepcopy(table)}
    validate_bound_object_views(sample["conditions"], table, order)
    identity = {"sampleId": row["sampleId"], "split": row["split"], "ordinal": 0,
                "worldId": pack["worldId"], "tick": pack["tick"], "factHash": facts_binding["sha256"],
                "image": row["image"], "conditionPack": row["conditionPack"], "taskPackage": task_binding,
                "visualFactManifestFile": visual_binding,
                "visualFactManifestContentSha256": pack["visualFactManifestSha256"],
                "objectTableSha256": sha(canonical_bytes(table)), "objectCount": len(table),
                "channels": [{"id": item["id"], "path": item["path"], "sha256": item["sha256"]} for item in pack["channels"]]}
    return sample, identity


def tensor_hash(value):
    return sha(value.detach().cpu().contiguous().numpy().tobytes())


def state_hash(model):
    h = hashlib.sha256()
    for key, tensor in model.state_dict().items():
        h.update(canonical_bytes([key, str(tensor.dtype), list(tensor.shape)]))
        h.update(tensor.detach().cpu().contiguous().numpy().tobytes())
    return h.hexdigest()


def gradients(model):
    import torch
    result = []
    for name, parameter in model.named_parameters():
        require(parameter.device.type == "cpu", "non-CPU parameter")
        require(parameter.grad is not None, "missing parameter gradient: " + name)
        require(bool(torch.isfinite(parameter.grad).all()), "nonfinite parameter gradient: " + name)
        result.append({"name": name, "elements": parameter.numel(),
                       "absoluteSum": float(parameter.grad.detach().double().abs().sum())})
    require(result and sum(item["absoluteSum"] for item in result) > 0, "all model gradients are zero")
    return result


def expect_rejection(label, operation):
    try:
        operation()
    except (ValueError, FileNotFoundError, KeyError) as error:
        return {"case": label, "rejected": True, "errorType": type(error).__name__, "error": str(error)}
    raise ValueError("negative control unexpectedly accepted: " + label)


def run_probe():
    os.environ["CUDA_VISIBLE_DEVICES"] = ""
    import torch
    from ai_painter.complete_world.native_rgb_structured_object_cpu_v17 import build_native_rgb_structured_object_cpu_v17
    from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import (
        train_structured_object_objective, validation_structured_object_score, original_object_class_spatial_loss)
    from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator

    started = time.monotonic()
    report = {"schemaVersion": REPORT_SCHEMA, "status": "failed_closed", "qualificationGranted": False,
              "formalCpuAcceptanceGranted": False, "gpuQualificationGranted": False,
              "datasetManifest": MANIFEST, "conditionContract": CONDITION_CONTRACT,
              "seed": SEED, "threads": THREADS, "modelWidths": {"baseChannels": 48, "patchChannels": 32},
              "optimizerCreated": False, "optimizerSteps": 0, "backwardCalls": 0,
              "challengeContentRead": False, "regressionContentRead": False,
              "checkpointLoaded": False, "checkpointWritten": False, "registryWritten": False,
              "knownUnverified": ["formal capability/loss/review/foundation registration", "GPU/BF16 numerical behavior",
                  "training convergence", "visual quality and formal review", "full 64-sample content audit", "Runtime eligibility"]}
    reader = BoundReader()
    try:
        require(not torch.cuda.is_initialized(), "CUDA already initialized")
        torch.set_num_threads(THREADS)
        torch.manual_seed(SEED)
        report["torchVersion"] = str(torch.__version__)
        report["programBindings"] = [reader.snapshot(path)[1] for path in PROGRAMS]
        manifest, order, continuous, selected, memberships = select_rows(reader)
        report["datasetReleaseIdentity"] = manifest["datasetReleaseIdentity"]
        report["splitMemberships"] = memberships
        samples, identities = {}, {}
        for split in ("train", "validation"):
            samples[split], identities[split] = load_sample(reader, selected[split], order, continuous)
        report["samples"] = identities
        before_samples = {split: {key: tensor_hash(samples[split][key]) for key in ("image", "conditions")}
                          for split in samples}
        with patch.object(torch.cuda, "_lazy_init", side_effect=RuntimeError("CPU probe forbids CUDA")), \
             patch.object(torch.optim.Optimizer, "__init__", side_effect=RuntimeError("CPU probe forbids optimizer")), \
             patch.object(torch, "save", side_effect=RuntimeError("CPU probe forbids checkpoint writes")):
            model = build_native_rgb_structured_object_cpu_v17(condition_channel_order=order).cpu().eval()
            critic = build_conditional_texture_discriminator().cpu().eval().requires_grad_(False)
            before_model, before_critic = state_hash(model), state_hash(critic)
            report["initialModelStateSha256"], report["initialCriticStateSha256"] = before_model, before_critic
            train, validation = samples["train"], samples["validation"]
            predicted, evidence = model(train["conditions"][None], train["objectInstanceTable"], return_evidence=True)
            require(predicted.shape == (1, 3, 192, 256) and bool(torch.isfinite(predicted).all()), "invalid CPU RGB")
            loss, parts = train_structured_object_objective(critic, predicted, train, train["objectInstanceTable"], order)
            require(bool(torch.isfinite(loss)), "nonfinite CPU train loss")
            report["backwardCalls"] = 1
            loss.backward()
            report["parameterGradients"] = gradients(model)
            require(all(p.grad is None for p in critic.parameters()), "frozen critic received gradients")
            train_grads = {name: tensor_hash(p.grad) for name, p in model.named_parameters()}
            report["trainLoss"] = float(loss.detach())
            report["trainParts"] = {key: float(value.detach()) if isinstance(value, torch.Tensor) else value for key, value in parts.items()}
            report["responsibilityShapes"] = {key: list(value.shape) for group in (
                "terrainResponsibilityFeatures", "responsibilityFeatures") for key, value in evidence[group].items()}
            with torch.no_grad():
                validation_rgb = model(validation["conditions"][None], validation["objectInstanceTable"])
                score, validation_parts = validation_structured_object_score(
                    validation_rgb, validation, validation["objectInstanceTable"], order)
            require(not score.requires_grad and bool(torch.isfinite(score)), "validation score invalid")
            require(train_grads == {name: tensor_hash(p.grad) for name, p in model.named_parameters()}, "validation changed gradients")
            report["validationScore"] = float(score)
            report["validationParts"] = {key: float(value) if isinstance(value, torch.Tensor) else value for key, value in validation_parts.items()}
            missing_table = deepcopy(train["objectInstanceTable"])[1:]
            shifted = deepcopy(train["objectInstanceTable"])
            shifted[0]["footprint"]["x"] = (shifted[0]["footprint"]["x"] + 512) % 900
            degenerate = {**train, "image": torch.zeros_like(train["image"])}
            negatives = [
                expect_rejection("missing_original_binding", lambda: reader.read({"path": selected["train"]["image"]["path"]})),
                expect_rejection("changed_original_sha", lambda: reader.read({**selected["train"]["image"], "sha256": "0" * 64})),
                expect_rejection("missing_instance", lambda: model(train["conditions"][None], missing_table)),
                expect_rejection("misaligned_instance", lambda: model(train["conditions"][None], shifted)),
                expect_rejection("degenerate_original", lambda: original_object_class_spatial_loss(predicted.detach(), degenerate, order, split="train")),
                expect_rejection("validation_as_train", lambda: train_structured_object_objective(critic, validation_rgb, validation, validation["objectInstanceTable"], order)),
            ]
            with torch.no_grad():
                aligned, _ = original_object_class_spatial_loss(train["image"][None], train, order, split="train")
                uniform, _ = original_object_class_spatial_loss(torch.full_like(predicted, 0.5), train, order, split="train")
                displaced, _ = original_object_class_spatial_loss(torch.roll(train["image"][None], 32, -1), train, order, split="train")
            require(float(aligned) < float(uniform) and float(aligned) < float(displaced), "degraded/misaligned target not distinguished")
            report["negativeControls"] = negatives
            report["spatialControls"] = {"aligned": float(aligned), "uniform": float(uniform), "shifted": float(displaced)}
            report["finalModelStateSha256"], report["finalCriticStateSha256"] = state_hash(model), state_hash(critic)
            require(report["finalModelStateSha256"] == before_model and report["finalCriticStateSha256"] == before_critic,
                    "model or critic state changed")
        require(before_samples == {split: {key: tensor_hash(samples[split][key]) for key in ("image", "conditions")}
                                   for split in samples}, "source tensors changed")
        reader.unchanged()
        require(not torch.cuda.is_initialized() and time.monotonic() - started < MAX_SECONDS, "CPU boundary exceeded")
        report.update(status="cpu_numerical_probe_passed_not_qualification", weightsModified=False,
                      validationBackwardExecuted=False, gpuInitialized=False)
    except Exception as error:
        report.update(errorType=type(error).__name__, error=str(error))
    report["sourceBindingsRecomputed"] = [{"path": path, "sha256": digest} for path, digest in reader.observed.items()]
    report["elapsedSeconds"] = time.monotonic() - started
    report["recordedAtUtc"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--worker", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.worker:
        report = run_probe()
        print(json.dumps(report, allow_nan=False))
        return 0 if report["status"] == "cpu_numerical_probe_passed_not_qualification" else 1
    name = datetime.now(timezone.utc).strftime("probe-%Y%m%dT%H%M%SZ-") + uuid.uuid4().hex[:12]
    logical = f"{OUTPUT_ROOT}/{name}"
    directory = project_file(ROOT, logical)
    directory.mkdir(parents=True, exist_ok=False)
    env = {**os.environ, "CUDA_VISIBLE_DEVICES": "", "PYTHONDONTWRITEBYTECODE": "1",
           "OMP_NUM_THREADS": str(THREADS), "MKL_NUM_THREADS": str(THREADS)}
    stdout, stderr, test_stdout, test_stderr = "", "", "", ""
    started = time.monotonic()
    test_command = [sys.executable, "-B", "-m", "unittest", "discover", "-s", "ml/ai-painter/tests",
                    "-p", Path(TEST_PATH).name, "-v"]
    try:
        test_result = subprocess.run(test_command, cwd=ROOT, env=env,
                                     capture_output=True, text=True, timeout=60)
        test_stdout, test_stderr = test_result.stdout, test_result.stderr
        require(test_result.returncode == 0, "CPU control tests failed; worker was not started")
        result = subprocess.run([sys.executable, "-B", str(Path(__file__).resolve()), "--worker"],
                                cwd=ROOT, env=env, capture_output=True, text=True,
                                timeout=max(1, MAX_SECONDS - (time.monotonic() - started)))
        stdout, stderr = result.stdout, result.stderr
        report = json.loads(stdout)
        require(result.returncode == 0 or report["status"] == "failed_closed", "worker exit/report mismatch")
        report["controlTests"] = {"command": test_command, "exitCode": test_result.returncode,
                                  "stdout": logical + "/tests-stdout.log", "stderr": logical + "/tests-stderr.log"}
    except Exception as error:
        if isinstance(error, subprocess.TimeoutExpired):
            stdout = error.stdout.decode(errors="replace") if isinstance(error.stdout, bytes) else error.stdout or ""
            stderr = error.stderr.decode(errors="replace") if isinstance(error.stderr, bytes) else error.stderr or ""
        report = {"schemaVersion": REPORT_SCHEMA, "status": "failed_closed", "qualificationGranted": False,
                  "errorType": type(error).__name__, "error": str(error),
                  "recordedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}
    for filename, text in (("tests-stdout.log", test_stdout), ("tests-stderr.log", test_stderr),
                           ("worker-stdout.log", stdout), ("worker-stderr.log", stderr),
                           ("report.json", json.dumps(report, indent=2, allow_nan=False) + "\n")):
        with (directory / filename).open("x", encoding="utf-8") as stream:
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
    print(json.dumps({"status": report["status"], "report": {"path": logical + "/report.json",
                      "sha256": sha((directory / "report.json").read_bytes())}}))
    return 0 if report["status"] == "cpu_numerical_probe_passed_not_qualification" else 1


if __name__ == "__main__":
    raise SystemExit(main())
