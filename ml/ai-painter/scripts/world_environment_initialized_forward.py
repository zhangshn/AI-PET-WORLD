"""One164 CPU forward from the actual initialized 0/1/1 state; no Store writes."""
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import stat
import sys
import time
import types

START_MONOTONIC = time.monotonic()
ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ".runtime/ai-painter/controller-repair-reviews/world-initialized-evolution-164-20261030"
TASK_ID = "WORLD-INITIALIZED-EVOLUTION-164"
CONTRACT_SHA256 = "1f059107bb9637fdfc44092920b1109a88844c99daf3dd5f47c5f2d2e6716195"
LEGACY_PATH = "ml/ai-painter/scripts/world_environment_loop_forward.py"
LEGACY_SHA = "0df00784d1a63a40e0cc25099ef5f5839003a3b4c4af4dc34ef8d3ed43855c62"
SELF_PATH = "ml/ai-painter/scripts/world_environment_initialized_forward.py"
MAX_BYTES = 65536
MAX_SECONDS = 30
FORWARD_CALLS = 0


def legacy_helpers():
    filename = ROOT / LEGACY_PATH
    current = ROOT
    for part in LEGACY_PATH.split("/"):
        current /= part
        info = current.lstat()
        if current.is_symlink() or getattr(info, "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT:
            raise ValueError("initialized_forward_legacy_link")
    raw = filename.read_bytes()
    if hashlib.sha256(raw).hexdigest() != LEGACY_SHA:
        raise ValueError("initialized_forward_legacy_sha")
    module = types.ModuleType("initialized164_fixed_helpers")
    module.__file__ = str(filename)
    exec(compile(raw, str(filename), "exec"), module.__dict__)
    return module


HELPER = legacy_helpers()
require, exact = HELPER.require, HELPER.exact
read_fixed, sha, strict_json = HELPER.read_fixed, HELPER.sha, HELPER.strict_json
canonical, utc, utc_now = HELPER.canonical, HELPER.utc, HELPER.utc_now
feature_value_sha = HELPER.feature_value_sha


def ref_identity(ref):
    return {"path": ref["path"], "sha256": ref["sha256"]}


def read_contract():
    c = strict_json(read_fixed({"path": EVIDENCE + "/model/model-contract.json", "sha256": CONTRACT_SHA256}, MAX_BYTES))
    require(c["schemaVersion"] == "world-environment-initialized-forward-contract-v1" and c["taskId"] == TASK_ID
            and c["scope"] == "private_initialized_world_first_evolution_only", "164_contract")
    require(c["limits"]["cpuThreads"] == 2 and c["limits"]["workerSeconds"] == 30
            and c["limits"]["workerBytes"] == MAX_BYTES and c["limits"]["worldWrites"] == 0
            and c["limits"]["trainingUpdates"] == 0 and c["limits"]["modelForwardRuns"] == 1, "164_limits")
    require(c["reusedWorker"]["path"] == LEGACY_PATH and c["reusedWorker"]["sha256"] == LEGACY_SHA, "164_helpers")
    return c


def validate_input(raw, c):
    data = strict_json(raw)
    exact(data, c["inputContract"]["exactFields"], "164_input_fields")
    require(data["schemaVersion"] == "world-environment-initialized-forward-input-v1" and data["taskId"] == TASK_ID
            and data["contractSha256"] == CONTRACT_SHA256 and data["mode"] == "primary", "164_input_identity")
    exact(data["identity"], HELPER.IDENTITY_FIELDS, "164_identity_fields")
    require(data["identity"] == c["identity"], "164_same_initialized_world")
    before = data["before"]
    exact(before, ["tick", "stateVersion", "eventCursor", "fileSha256", "recordContentSha256"], "164_before_fields")
    require(all(type(before[k]) is int for k in ("tick", "stateVersion", "eventCursor"))
            and [before["tick"], before["stateVersion"], before["eventCursor"]] == [0, 1, 1], "164_before_0_1_1")
    require(before["fileSha256"] == c["initializedRecordRef"]["sha256"]
            and before == c["before"], "164_before_hash")
    exact(data["interval"], ["logicalStartUtc", "logicalEndUtc", "durationSeconds"], "164_interval_fields")
    require(data["interval"] == {"logicalStartUtc": "2020-01-08T00:00:00.000Z", "logicalEndUtc": "2020-01-09T00:00:00.000Z", "durationSeconds": 86400}
            and type(data["interval"]["durationSeconds"]) is int, "164_interval")
    window = data["window"]
    exact(window, ["fieldOrder", "units", "values"], "164_window_fields")
    require(window["fieldOrder"] == c["fieldOrder"] and window["units"] == c["units"], "164_field_units")
    require(type(window["values"]) is list and len(window["values"]) == 7, "164_seven_days")
    for row in window["values"]:
        require(type(row) is list and len(row) == 4, "164_four_fields")
        for field, value in zip(c["fieldOrder"], row):
            guard = c["guards"][field]
            require(type(value) in (float, int) and math.isfinite(value)
                    and guard["minimum"] <= value <= guard["maximum"], "164_input_value")
    exact(data["initializationEventRef"], ["path", "sha256"], "164_event_ref_fields")
    require(data["initializationEventRef"] == ref_identity(c["initializationEventRef"]), "164_event_ref")
    require(type(data["provenance"]) is list and len(data["provenance"]) == 7, "164_provenance_rows")
    for i, row in enumerate(data["provenance"]):
        exact(row, ["origin", "sourceRef", "periodStartUtc", "periodEndUtc", "note"], "164_provenance_fields")
        exact(row["sourceRef"], ["path", "sha256"], "164_provenance_ref_fields")
        start = dt.datetime(2020, 1, i + 1, tzinfo=dt.timezone.utc)
        require(utc(row["periodStartUtc"]) == start and utc(row["periodEndUtc"]) == start + dt.timedelta(days=1), "164_provenance_period")
        require(type(row["note"]) is str and len(row["note"]) <= 512, "164_provenance_note")
        expected_origin = "external_archival_context" if i < 6 else "initialized_store_weather"
        expected_ref = c["archiveRef"] if i < 6 else c["initializedRecordRef"]
        require(row["origin"] == expected_origin and row["sourceRef"] == ref_identity(expected_ref), "164_provenance_origin")
    return data


def validate_sources(data, c):
    source_bytes = read_fixed(c["sourceInitializedRecordRef"], 512 * 1024)
    record_bytes = read_fixed(c["initializedRecordRef"], 512 * 1024)
    require(record_bytes == source_bytes, "164_snapshot_bytes")
    record = json.loads(record_bytes)
    require({k: record[k] for k in HELPER.IDENTITY_FIELDS} == data["identity"]
            and [record["tick"], record["stateVersion"], record["eventCursor"]] == [0, 1, 1]
            and record["recordContentSha256"] == data["before"]["recordContentSha256"], "164_record_before")
    evolution = record["worldState"]["payload"]["environment"]["evolution"]
    weather = evolution["weather"]
    require(evolution["logicalEndUtc"] == "2020-01-08T00:00:00.000Z" and weather["origin"] == "simulated_archival_seed"
            and weather["fieldOrder"] == c["fieldOrder"] and weather["units"] == c["units"]
            and weather["period"] == {"logicalStartUtc": "2020-01-07T00:00:00.000Z", "logicalEndUtc": "2020-01-08T00:00:00.000Z", "durationSeconds": 86400}, "164_saved_weather")
    raw_archive = read_fixed(c["archiveRef"], 65536)
    source = json.loads(raw_archive)
    receipt = json.loads(read_fixed(c["archiveReceiptRef"], 65536))
    require(receipt["responseSha256"] == sha(raw_archive) and receipt["responseBytes"] == len(raw_archive), "164_archive_receipt")
    require(source["header"]["time_standard"] == "UTC" and source["header"]["start"] == "20200101"
            and source["header"]["end"] == "20200131" and source["geometry"]["coordinates"][:2] == [101.895, 14.508]
            and [source["parameters"][f]["units"] for f in c["fieldOrder"]] == c["units"], "164_archive_scope")
    values = [[source["properties"]["parameter"][f][f"2020010{i}"] for f in c["fieldOrder"]] for i in range(1, 7)]
    values.append(weather["values"])
    require(data["window"]["values"] == values, "164_actual_matrix")
    event_bytes = read_fixed(c["initializationEventRef"], 65536)
    require(event_bytes == read_fixed(c["sourceInitializationEventRef"], 65536), "164_event_copy")
    event = json.loads(event_bytes)
    require(event["identity"] == data["identity"] and event["eventKind"] == "maintenance"
            and event["cursor"] == 1 and event["fromTick"] == event["toTick"] == 0
            and event["fromStateVersion"] == 0 and event["toStateVersion"] == 1
            and event["interval"]["durationSeconds"] == 0
            and event["eventSha256"] == evolution["commit"]["eventSha256"] == c["initializationEventContentSha256"], "164_maintenance_trace")


def run(raw, started_at, started_mono):
    global FORWARD_CALLS
    c = read_contract()
    data = validate_input(raw, c)
    validate_sources(data, c)
    module, model, torch = HELPER.load_model(c)
    require(time.monotonic() - started_mono < MAX_SECONDS, "164_deadline_before")
    values = torch.tensor([data["window"]["values"]], dtype=torch.float64, device="cpu")
    with torch.no_grad():
        require(FORWARD_CALLS == 0, "164_one_forward_only")
        FORWARD_CALLS += 1
        output = module.predict(model, values)
    require(tuple(output.shape) == (1, 4) and bool(torch.isfinite(output).all()), "164_output_nonfinite_shape")
    for ref in [c["checkpoint"], {"path": LEGACY_PATH, "sha256": LEGACY_SHA}] + c["modelCodeBindings"]:
        read_fixed(ref)
    validate_sources(data, c)
    require(time.monotonic() - started_mono < MAX_SECONDS, "164_deadline_after")
    result = {"schemaVersion": "world-environment-initialized-forward-output-v1", "taskId": TASK_ID,
              "contractSha256": CONTRACT_SHA256, "mode": "primary", "inputBytesSha256": sha(raw),
              "featureValueSha256": feature_value_sha(data["window"]["values"]), "checkpointSha256": c["checkpoint"]["sha256"],
              "workerSha256": sha(HELPER.safe_path(SELF_PATH).read_bytes()), "values": output[0].tolist(),
              "fieldOrder": c["fieldOrder"], "units": c["units"], "pid": os.getpid(), "startedAtUtc": started_at,
              "finishedAtUtc": utc_now(), "elapsedSeconds": time.monotonic() - started_mono,
              "modelForwardRuns": FORWARD_CALLS, "trainingUpdates": 0, "worldWrites": 0, "productionReady": False}
    exact(result, c["outputContract"]["exactFields"], "164_output_fields")
    encoded = canonical(result) + b"\n"
    require(len(encoded) <= MAX_BYTES, "164_output_bytes")
    return encoded


def main():
    started = utc_now()
    try:
        require(len(sys.argv) == 1, "164_stdin_only")
        sys.stdout.buffer.write(run(sys.stdin.buffer.read(MAX_BYTES + 1), started, START_MONOTONIC))
        sys.stdout.buffer.flush()
        return 0
    except Exception as error:
        failure = {"schemaVersion": "world-environment-initialized-forward-failure-v1", "taskId": TASK_ID,
                   "status": "failed", "errorType": type(error).__name__, "error": str(error)[:2000], "pid": os.getpid(),
                   "startedAtUtc": started, "finishedAtUtc": utc_now(), "elapsedSeconds": time.monotonic() - START_MONOTONIC,
                   "modelForwardRuns": FORWARD_CALLS, "productionReady": False, "worldWrites": 0, "trainingUpdates": 0}
        sys.stderr.buffer.write(canonical(failure) + b"\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
