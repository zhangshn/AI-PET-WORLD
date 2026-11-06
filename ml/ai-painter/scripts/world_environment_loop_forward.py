"""158 private integration worker: one fixed CPU model forward, no Store writes.

Input provenance is checked for shape/time only. The parent must independently
authenticate its Store/event sources; this worker never grants that authority.
"""
import datetime as dt
import hashlib
import importlib.util
import io
import json
import math
import os
from pathlib import Path
import re
import stat
import struct
import sys
import time

START_MONOTONIC = time.monotonic()
ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ".runtime/ai-painter/controller-repair-reviews/world-evolution-loop-158-20261030"
CONTRACT_SHA256 = "822db6bd5daffdd438c9b2490b3e665a32c4cc6d52930135fbedae203a0ed526"
FEATURE_HASH_SHA256 = "7de1f14a87a48386bed5110385fdba25984cc42d523b93e53c5fda380b7bfa56"
MAX_BYTES = 65536
MAX_SECONDS = 30
IDENTITY_FIELDS = ["ownerId", "playerId", "worldId", "worldSeed", "worldProfileId", "regionId"]
SHA = re.compile(r"^[a-f0-9]{64}$")
UTC = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")


def require(ok, why):
    if not ok:
        raise ValueError("loop_forward_" + why)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8")


def strict_json(raw):
    require(type(raw) is bytes and 0 < len(raw) <= MAX_BYTES, "byte_limit")
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, "duplicate_key")
            result[key] = value
        return result
    result = json.loads(raw.decode("utf-8"), object_pairs_hook=pairs,
                        parse_int=lambda value: -0.0 if value == "-0" else int(value),
                        parse_constant=lambda _: (_ for _ in ()).throw(ValueError("loop_forward_nonfinite")))
    def check(value, depth=0):
        require(depth <= 32, "depth")
        if type(value) is dict:
            for child in value.values():
                check(child, depth + 1)
        elif type(value) is list:
            for child in value:
                check(child, depth + 1)
        elif type(value) in (int, float):
            require(math.isfinite(value), "nonfinite")
            require(type(value) is not int or abs(value) <= 9007199254740991, "unsafe_integer")
    check(result)
    return result


def exact(value, keys, why):
    require(type(value) is dict and set(value) == set(keys), why)


def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def utc(value):
    require(type(value) is str and UTC.fullmatch(value), "utc_shape")
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    require(parsed.isoformat(timespec="milliseconds").replace("+00:00", "Z") == value, "utc_roundtrip")
    return parsed


def safe_path(logical):
    require(type(logical) is str and 0 < len(logical) <= 1024 and not any(c in logical for c in "\\:\x00"), "path")
    parts = logical.split("/")
    require(all(part and part not in (".", "..") for part in parts), "path")
    base = ROOT
    if parts[0] == ".runtime":
        # The established runtime junction is the one allowed storage mapping.
        base = (ROOT / ".runtime").resolve(strict=True)
        parts = parts[1:]
    for part in parts:
        base = base / part
        info = base.lstat()
        require(not base.is_symlink() and not (getattr(info, "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT), "linked_path")
    return base


def read_fixed(ref, limit=8 * 1024 * 1024):
    require(type(ref) is dict and type(ref.get("sha256")) is str and SHA.fullmatch(ref["sha256"]), "fixed_ref")
    path = safe_path(ref["path"])
    with path.open("rb") as handle:
        before = os.fstat(handle.fileno())
        require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and 0 < before.st_size <= limit, "fixed_file")
        raw = handle.read(limit + 1)
        after = os.fstat(handle.fileno())
    require(len(raw) == before.st_size == after.st_size and before.st_mtime_ns == after.st_mtime_ns and before.st_ino == after.st_ino, "fixed_changed")
    require(sha(raw) == ref["sha256"], "fixed_sha")
    return raw


def read_contract():
    c = strict_json(read_fixed({"path": EVIDENCE + "/experiment-contract.json", "sha256": CONTRACT_SHA256}, MAX_BYTES))
    require(c["schemaVersion"] == "world-environment-loop-experiment-v1" and c["taskId"] == "WORLD-EVOLUTION-LOOP-158"
            and c["scope"] == "private_integration_fixture_only", "contract_scope")
    require(c["limits"]["cpuThreads"] == 2 and c["limits"]["workerSeconds"] == MAX_SECONDS
            and c["limits"]["workerBytes"] == MAX_BYTES and c["limits"]["trainingUpdates"] == 0
            and c["limits"]["gpu"] is False, "contract_limits")
    read_fixed({"path": EVIDENCE + "/feature-hash-contract.json", "sha256": FEATURE_HASH_SHA256}, MAX_BYTES)
    return c


def feature_value_sha(values):
    """Row-major IEEE754 float64 little-endian bytes, not cross-language JSON."""
    return sha(struct.pack("<28d", *(float(v) for row in values for v in row)))


def validate_input(raw, c):
    data = strict_json(raw)
    exact(data, c["inputContract"]["exactFields"], "input_fields")
    require(data["schemaVersion"] == c["inputContract"]["schemaVersion"] and data["taskId"] == c["taskId"]
            and data["contractSha256"] == CONTRACT_SHA256 and data["mode"] in c["inputContract"]["mode"], "input_identity")
    exact(data["identity"], IDENTITY_FIELDS, "six_identity")
    for value in data["identity"].values():
        require(type(value) is str and re.fullmatch(r"integration158-[a-zA-Z0-9_-]{1,100}", value), "private_identity")
    before = data["before"]
    exact(before, ["tick", "stateVersion", "eventCursor", "fileSha256", "recordContentSha256"], "before_fields")
    require(all(type(before[k]) is int and 0 <= before[k] < 3 for k in ("tick", "stateVersion", "eventCursor")), "before_counter")
    require(before["tick"] == before["stateVersion"] == before["eventCursor"], "before_continuity")
    require(all(type(before[k]) is str and SHA.fullmatch(before[k]) for k in ("fileSha256", "recordContentSha256")), "before_hash")
    interval = data["interval"]
    exact(interval, ["logicalStartUtc", "logicalEndUtc", "durationSeconds"], "interval_fields")
    start, end = utc(interval["logicalStartUtc"]), utc(interval["logicalEndUtc"])
    require(type(interval["durationSeconds"]) is int and interval["durationSeconds"] == 86400
            and end - start == dt.timedelta(days=1)
            and start == utc(c["simulationEpochUtc"]) + dt.timedelta(days=before["tick"]), "interval")
    if data["mode"] != "primary":
        require(before["tick"] == 2, "probe_step")
    window = data["window"]
    exact(window, ["fieldOrder", "units", "values"], "window_fields")
    require(window["fieldOrder"] == c["fieldOrder"] and window["units"] == c["units"], "fields_units")
    require(type(window["values"]) is list and len(window["values"]) == 7, "window_rows")
    for row in window["values"]:
        require(type(row) is list and len(row) == 4, "window_columns")
        for field, value in zip(c["fieldOrder"], row):
            guard = c["guards"][field]
            require(type(value) in (float, int) and math.isfinite(value)
                    and guard["minimum"] <= value <= guard["maximum"], "window_value")
    require(type(data["provenance"]) is list and len(data["provenance"]) == 7, "provenance_rows")
    for i, source in enumerate(data["provenance"]):
        exact(source, ["origin", "sourceRef", "periodStartUtc", "periodEndUtc", "note"], "provenance_fields")
        require(source["origin"] in ("external_archival_context", "committed_fixture_event"), "provenance_origin")
        exact(source["sourceRef"], ["path", "sha256"], "provenance_ref")
        logical, h = source["sourceRef"]["path"], source["sourceRef"]["sha256"]
        require(type(logical) is str and 0 < len(logical) <= 1024 and not any(v in logical for v in "\\:\x00")
                and all(part and part not in (".", "..") for part in logical.split("/"))
                and type(h) is str and SHA.fullmatch(h), "provenance_ref")
        require(type(source["note"]) is str and len(source["note"]) <= 512, "provenance_note")
        expected_start = start - dt.timedelta(days=7-i)
        require(utc(source["periodStartUtc"]) == expected_start and utc(source["periodEndUtc"]) == expected_start + dt.timedelta(days=1), "provenance_period")
        if expected_start < utc(c["simulationEpochUtc"]):
            require(source["origin"] == "external_archival_context" and source["sourceRef"] == c["archiveBindings"][0], "archive_ref")
        else:
            event_pattern = (re.escape(EVIDENCE) + r"/run-[a-f0-9]{32}/store/"
                             + re.escape(data["identity"]["ownerId"]) + "/" + re.escape(data["identity"]["worldId"])
                             + r"\.json\.evolution/[a-f0-9]{64}\.[a-f0-9]{64}\.event\.json")
            require(source["origin"] == "committed_fixture_event" and re.fullmatch(event_pattern, logical), "fixture_event_ref")
    return data


def validate_checkpoint(checkpoint, c, torch):
    require(type(checkpoint) is dict and checkpoint.get("schemaVersion") == "world-environment-humidity-checkpoint-v1"
            and checkpoint.get("targetTransform") == "raw_RH_other_columns150", "checkpoint_schema")
    require(checkpoint.get("contractSha256") == c["checkpoint"]["trainingContractSha256"]
            and checkpoint.get("trainingDatasetSha256") == c["checkpoint"]["trainingDatasetSha256"], "checkpoint_lineage")
    require(checkpoint.get("parentCheckpointSha256") == "ef9a67f8a6078dc4f39e3280351ecca94f7a31677a3fc4ad0620fc186adbda54"
            and type(checkpoint.get("fitCount")) is int and checkpoint["fitCount"] == 1
            and checkpoint.get("onlyFittedColumn") == "RH2M", "checkpoint_fit")
    model = checkpoint["model"]
    exact(model, ["weights", "inputMean", "inputStd", "targetMean", "targetStd"], "checkpoint_model")
    for key, value in model.items():
        shape = (29, 4) if key == "weights" else (4,)
        require(type(value) is torch.Tensor and tuple(value.shape) == shape and value.dtype == torch.float64
                and value.device.type == "cpu" and bool(torch.isfinite(value).all()), "checkpoint_tensor")
    require(bool((model["inputStd"] > 0).all()) and bool((model["targetStd"] > 0).all()), "checkpoint_normalizer")
    return model


def load_model(c):
    for ref in c["modelCodeBindings"]:
        read_fixed(ref)
    spec = importlib.util.spec_from_file_location("humidity158_dependency", safe_path(c["modelCodeBindings"][0]["path"]))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    torch = module.pilot.configure_torch()
    require(torch.get_num_threads() == 2 and not torch.cuda.is_initialized(), "cpu_only")
    checkpoint = torch.load(io.BytesIO(read_fixed(c["checkpoint"])), map_location="cpu", weights_only=True)
    model = validate_checkpoint(checkpoint, c, torch)
    return module, model, torch


def run(raw, started_at, started_mono):
    c = read_contract()
    data = validate_input(raw, c)
    module, model, torch = load_model(c)
    require(time.monotonic() - started_mono < MAX_SECONDS, "deadline_before_forward")
    values = torch.tensor([data["window"]["values"]], dtype=torch.float64, device="cpu")
    with torch.no_grad():
        output = module.predict(model, values)
    require(tuple(output.shape) == (1, 4) and bool(torch.isfinite(output).all()), "output_nonfinite_or_shape")
    for ref in [c["checkpoint"]] + c["modelCodeBindings"]:
        read_fixed(ref)
    require(time.monotonic() - started_mono < MAX_SECONDS, "deadline_after_forward")
    # Finite out-of-domain values remain unmodified for the parent Validator.
    result = {"schemaVersion": c["outputContract"]["schemaVersion"], "taskId": c["taskId"], "contractSha256": CONTRACT_SHA256,
              "mode": data["mode"], "inputBytesSha256": sha(raw), "featureValueSha256": feature_value_sha(data["window"]["values"]),
              "checkpointSha256": c["checkpoint"]["sha256"], "values": output[0].tolist(), "fieldOrder": c["fieldOrder"], "units": c["units"],
              "pid": os.getpid(), "startedAtUtc": started_at, "finishedAtUtc": utc_now(), "elapsedSeconds": time.monotonic() - started_mono,
              "modelForwardRuns": 1, "trainingUpdates": 0, "worldWrites": 0, "productionReady": False}
    exact(result, c["outputContract"]["exactFields"], "output_fields")
    encoded = canonical(result) + b"\n"
    require(len(encoded) <= MAX_BYTES, "output_bytes")
    return encoded


def main():
    started = utc_now()
    try:
        require(len(sys.argv) == 1, "stdin_only")
        sys.stdout.buffer.write(run(sys.stdin.buffer.read(MAX_BYTES + 1), started, START_MONOTONIC))
        sys.stdout.buffer.flush()
        return 0
    except Exception as error:
        failure = {"schemaVersion": "world-environment-loop-forward-failure-v1", "taskId": "WORLD-EVOLUTION-LOOP-158",
                   "status": "failed", "errorType": type(error).__name__, "error": str(error)[:2000], "pid": os.getpid(),
                   "startedAtUtc": started, "finishedAtUtc": utc_now(), "elapsedSeconds": time.monotonic() - START_MONOTONIC,
                   "productionReady": False, "worldWrites": 0, "trainingUpdates": 0}
        sys.stderr.buffer.write(canonical(failure) + b"\n")
        sys.stderr.buffer.flush()
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
