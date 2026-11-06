"""166: one fixed CPU prediction from an actually committed private state."""
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import re
import stat
import sys
import time
import types

START_MONOTONIC = time.monotonic()
ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ".runtime/ai-painter/controller-repair-reviews/world-environment-background-166-20261031"
TASK_ID = "WORLD-ENVIRONMENT-BACKGROUND-166"
CONTRACT_SHA256 = "26b87b4294e9cae347afe795a094b0a3955f31580ae7312a7483212345cc7d78"
LEGACY_PATH = "ml/ai-painter/scripts/world_environment_loop_forward.py"
LEGACY_SHA = "0df00784d1a63a40e0cc25099ef5f5839003a3b4c4af4dc34ef8d3ed43855c62"
SELF_PATH = "ml/ai-painter/scripts/world_environment_scheduled_forward.py"
MAX_BYTES, MAX_SECONDS, FORWARD_CALLS = 65536, 30, 0


def legacy_helpers():
    current = ROOT
    for part in LEGACY_PATH.split("/"):
        current /= part
        info = current.lstat()
        if current.is_symlink() or getattr(info, "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT:
            raise ValueError("scheduled_legacy_link")
    raw = current.read_bytes()
    if hashlib.sha256(raw).hexdigest() != LEGACY_SHA:
        raise ValueError("scheduled_legacy_sha")
    module = types.ModuleType("scheduled166_fixed_helpers")
    module.__file__ = str(current)
    exec(compile(raw, str(current), "exec"), module.__dict__)
    return module


HELPER = legacy_helpers()
require, exact = HELPER.require, HELPER.exact
read_fixed, sha, strict_json = HELPER.read_fixed, HELPER.sha, HELPER.strict_json
canonical, utc, utc_now = HELPER.canonical, HELPER.utc, HELPER.utc_now
feature_value_sha = HELPER.feature_value_sha


def ref_identity(ref):
    return {"path": ref["path"], "sha256": ref["sha256"]}


def read_live(path, maximum=MAX_BYTES):
    """Only called with contract-owned paths; hash and re-read a stable regular file."""
    target = HELPER.safe_path(path)
    with target.open("rb") as handle:
        before = os.fstat(handle.fileno())
        require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and 0 < before.st_size <= maximum, "166_live_file")
        raw = handle.read(maximum + 1)
        after = os.fstat(handle.fileno())
    require(before.st_size == after.st_size == len(raw) and before.st_ino == after.st_ino
            and before.st_mtime_ns == after.st_mtime_ns, "166_live_changed")
    ref = {"path": path, "sha256": sha(raw)}
    require(read_fixed(ref, maximum) == raw, "166_live_recheck")
    return raw, ref


def read_contract():
    c = strict_json(read_fixed({"path": EVIDENCE + "/model/model-contract.json", "sha256": CONTRACT_SHA256}, MAX_BYTES))
    require(c["schemaVersion"] == "world-environment-scheduled-forward-contract-v1" and c["taskId"] == TASK_ID
            and c["scope"] == "private_two_scheduled_evolutions_only", "166_contract")
    require(c["limits"] == {"cpuThreads": 2, "workerSeconds": 30, "workerBytes": MAX_BYTES,
                            "modelForwardRuns": 1, "totalModelForwardRunsMaximum": 2,
                            "trainingUpdates": 0, "worldWrites": 0}, "166_limits")
    require(c["reusedWorker"]["path"] == LEGACY_PATH and c["reusedWorker"]["sha256"] == LEGACY_SHA, "166_helper")
    require(c["stepRoot"] == EVIDENCE + "/runtime/actual-run", "166_step_root")
    return c


def validate_input(raw, c):
    data = strict_json(raw)
    exact(data, c["inputContract"]["exactFields"], "166_input_fields")
    require(data["schemaVersion"] == c["inputContract"]["schemaVersion"] and data["taskId"] == TASK_ID
            and data["contractSha256"] == CONTRACT_SHA256 and data["mode"] == "primary", "166_input_identity")
    require(type(data["step"]) is int and data["step"] in (1, 2), "166_two_steps")
    step = c["steps"][data["step"] - 1]
    exact(data["identity"], HELPER.IDENTITY_FIELDS, "166_identity_fields")
    require(data["identity"] == c["identity"], "166_private_identity")
    before = data["before"]
    exact(before, ["tick", "stateVersion", "eventCursor", "fileSha256", "recordContentSha256"], "166_before_fields")
    require(all(type(before[k]) is int and before[k] == step["before"][k]
                for k in ("tick", "stateVersion", "eventCursor")), "166_actual_counters")
    require(all(type(before[k]) is str and HELPER.SHA.fullmatch(before[k]) for k in ("fileSha256", "recordContentSha256")), "166_before_hash")
    exact(data["interval"], ["logicalStartUtc", "logicalEndUtc", "durationSeconds"], "166_interval_fields")
    require(data["interval"] == step["interval"] and type(data["interval"]["durationSeconds"]) is int, "166_interval")
    window = data["window"]
    exact(window, ["fieldOrder", "units", "values"], "166_window_fields")
    require(window["fieldOrder"] == c["fieldOrder"] and window["units"] == c["units"], "166_units")
    require(type(window["values"]) is list and len(window["values"]) == 7, "166_window_length")
    for row in window["values"]:
        require(type(row) is list and len(row) == 4, "166_row")
        for field, value in zip(c["fieldOrder"], row):
            guard = c["guards"][field]
            require(type(value) in (float, int) and math.isfinite(value)
                    and guard["minimum"] <= value <= guard["maximum"], "166_input_value")
    exact(data["previousEventRef"], ["path", "sha256"], "166_event_ref")
    require(type(data["previousEventRef"]["path"]) is str and re.fullmatch(
        re.escape(c["recordPath"] + ".evolution/") + r"[a-f0-9]{64}\.[a-f0-9]{64}\.event\.json", data["previousEventRef"]["path"])
        and type(data["previousEventRef"]["sha256"]) is str and HELPER.SHA.fullmatch(data["previousEventRef"]["sha256"]), "166_event_namespace")
    require(type(data["provenance"]) is list and len(data["provenance"]) == 7, "166_provenance_rows")
    first = utc(data["interval"]["logicalStartUtc"]) - dt.timedelta(days=7)
    for i, p in enumerate(data["provenance"]):
        exact(p, ["origin", "sourceRef", "periodStartUtc", "periodEndUtc", "note"], "166_provenance_fields")
        exact(p["sourceRef"], ["path", "sha256"], "166_provenance_ref")
        require(utc(p["periodStartUtc"]) == first + dt.timedelta(days=i)
                and utc(p["periodEndUtc"]) == first + dt.timedelta(days=i + 1), "166_provenance_period")
        require(type(p["note"]) is str and len(p["note"]) <= 512, "166_note")
    return data


def validate_sources(data, c):
    # Initial source bytes stay pinned, even for step2. This prevents a caller
    # choosing a different seed/model by merely providing plausible hash strings.
    source_input_raw = read_fixed(c["sourceInputRef"], MAX_BYTES)
    source_output_raw = read_fixed(c["sourceOutputRef"], MAX_BYTES)
    source_process_raw = read_fixed(c["sourceForwardProcessRef"], MAX_BYTES)
    read_fixed(c["archiveRef"], MAX_BYTES)
    read_fixed(c["archiveReceiptRef"], MAX_BYTES)
    source_record_raw = read_fixed(c["sourceRecordRef"], 512 * 1024)
    source_event_raw = read_fixed(c["sourceEventRef"], MAX_BYTES)
    seed = json.loads(read_fixed(c["sourceSeedRecordRef"], 512 * 1024))
    seed_weather = seed["worldState"]["payload"]["environment"]["evolution"]["weather"]
    require({k: seed[k] for k in HELPER.IDENTITY_FIELDS} == data["identity"]
            and [seed["tick"], seed["stateVersion"], seed["eventCursor"]] == [0, 1, 1]
            and seed_weather["origin"] == "simulated_archival_seed"
            and seed_weather["period"] == {"logicalStartUtc": "2020-01-07T00:00:00.000Z", "logicalEndUtc": "2020-01-08T00:00:00.000Z", "durationSeconds": 86400}
            and strict_json(source_input_raw)["window"]["values"][-1] == seed_weather["values"], "166_immutable_seed")
    if data["step"] == 1:
        previous_input_raw, previous_output_raw, previous_process_raw = source_input_raw, source_output_raw, source_process_raw
        previous_input_ref, previous_output_ref = c["sourceInputRef"], c["sourceOutputRef"]
    else:
        previous_root = c["stepRoot"] + "/step-1/"
        previous_input_raw, previous_input_ref = read_live(previous_root + "input.json")
        previous_output_raw, previous_output_ref = read_live(previous_root + "output.json")
        previous_process_raw, _ = read_live(previous_root + "forward-process.json")
        previous_data = validate_input(previous_input_raw, c)
        require(previous_data["step"] == 1, "166_previous_step")
        initial_input, initial_output = strict_json(source_input_raw), strict_json(source_output_raw)
        require(previous_data["window"]["values"] == initial_input["window"]["values"][1:] + [initial_output["values"]], "166_previous_seed_chain")
    previous_input, previous_output, process = map(strict_json, (previous_input_raw, previous_output_raw, previous_process_raw))
    require(process["exitCode"] == 0 and process["pid"] == previous_output["pid"]
            and json.loads(process["stdout"]) == previous_output, "166_previous_process")
    require(previous_output["inputBytesSha256"] == sha(previous_input_raw)
            and previous_output["featureValueSha256"] == feature_value_sha(previous_input["window"]["values"])
            and previous_output["checkpointSha256"] == c["checkpoint"]["sha256"]
            and previous_output["fieldOrder"] == c["fieldOrder"] and previous_output["units"] == c["units"]
            and type(previous_output["modelForwardRuns"]) is int and previous_output["modelForwardRuns"] == 1
            and previous_output["productionReady"] is False, "166_previous_output")
    if data["step"] == 2:
        require(previous_output["schemaVersion"] == c["outputContract"]["schemaVersion"]
                and previous_output["contractSha256"] == CONTRACT_SHA256 and previous_output["step"] == 1
                and previous_output["workerSha256"] == sha(HELPER.safe_path(SELF_PATH).read_bytes()), "166_previous_worker")
    record_raw = read_fixed({"path": c["recordPath"], "sha256": data["before"]["fileSha256"]}, 512 * 1024)
    record = json.loads(record_raw)
    require({k: record[k] for k in HELPER.IDENTITY_FIELDS} == data["identity"]
            and all(record[k] == data["before"][k] and type(record[k]) is int for k in ("tick", "stateVersion", "eventCursor"))
            and record["recordContentSha256"] == data["before"]["recordContentSha256"], "166_record_before")
    if data["step"] == 1:
        require(record_raw == source_record_raw, "166_initial_copy")
    event_raw = read_fixed(data["previousEventRef"], MAX_BYTES)
    event = strict_json(event_raw)
    require(event["identity"] == data["identity"] and event["eventKind"] == "evolution"
            and [event["toTick"], event["toStateVersion"], event["cursor"]]
            == [data["before"]["tick"], data["before"]["stateVersion"], data["before"]["eventCursor"]], "166_event_before")
    if data["step"] == 1:
        require(event_raw == source_event_raw, "166_initial_event_copy")
    side = c["recordPath"] + ".evolution/"
    stem = event["businessKey"] + "." + event["eventSha256"]
    require(data["previousEventRef"]["path"] == side + stem + ".event.json", "166_event_filename")
    journal_raw, _ = read_live(side + stem + ".commit.json")
    journal = strict_json(journal_raw)
    require(journal["state"] == "committed" and journal["identity"] == data["identity"]
            and journal["eventSha256"] == event["eventSha256"] and journal["event"]["fileSha256"] == sha(event_raw)
            and journal["next"]["fileSha256"] == sha(record_raw) and journal["recordContentSha256"] == record["recordContentSha256"], "166_committed_journal")
    require(journal["next"]["name"] == event["businessKey"] + "." + sha(record_raw) + ".record.json", "166_next_name")
    require(read_fixed({"path": side + journal["next"]["name"], "sha256": sha(record_raw)}, 512 * 1024) == record_raw, "166_saved_next")
    changes = event["changes"]
    require([x["fieldId"] for x in changes] == ["environment." + f for f in c["fieldOrder"]]
            and all(x["operation"] == "replace" for x in changes)
            and [x["newValue"] for x in changes] == previous_output["values"], "166_event_values")
    evidence = event["evidence"]
    require(evidence["inputRef"]["id"] == previous_input_ref["path"] and evidence["inputRef"]["sha256"] == sha(previous_input_raw)
            and evidence["outputRef"]["id"] == previous_output_ref["path"] and evidence["outputRef"]["sha256"] == sha(previous_output_raw)
            and evidence["modelRef"]["sha256"] == c["checkpoint"]["sha256"], "166_event_model_evidence")
    evolution = record["worldState"]["payload"]["environment"]["evolution"]
    require(evolution["logicalEndUtc"] == data["interval"]["logicalStartUtc"]
            and evolution["commit"]["eventSha256"] == event["eventSha256"]
            and evolution["weather"]["values"] == previous_output["values"]
            and evolution["weather"]["fieldOrder"] == c["fieldOrder"] and evolution["weather"]["units"] == c["units"], "166_committed_weather")
    require(data["window"]["values"] == previous_input["window"]["values"][1:] + [previous_output["values"]], "166_history_shift")
    for actual, prior in zip(data["provenance"][:6], previous_input["provenance"][1:]):
        expected = {k: v for k, v in prior.items() if k != "note"}
        if expected["origin"] == "initialized_store_weather":
            expected["sourceRef"] = ref_identity(c["sourceSeedRecordRef"])
        require({k: v for k, v in actual.items() if k != "note"} == expected, "166_prior_provenance")
    last = data["provenance"][6]
    require(last["origin"] == "committed_model_output" and last["sourceRef"] == data["previousEventRef"]
            and last["periodStartUtc"] == previous_input["interval"]["logicalStartUtc"]
            and last["periodEndUtc"] == previous_input["interval"]["logicalEndUtc"], "166_new_provenance")


def run(raw, started_at, started_mono):
    global FORWARD_CALLS
    c = read_contract()
    data = validate_input(raw, c)
    validate_sources(data, c)
    module, model, torch = HELPER.load_model(c)
    require(time.monotonic() - started_mono < MAX_SECONDS, "166_deadline_before")
    values = torch.tensor([data["window"]["values"]], dtype=torch.float64, device="cpu")
    with torch.no_grad():
        require(FORWARD_CALLS == 0, "166_one_forward_only")
        FORWARD_CALLS += 1
        output = module.predict(model, values)
    require(tuple(output.shape) == (1, 4) and bool(torch.isfinite(output).all()), "166_output_nonfinite_shape")
    for ref in [c["checkpoint"], {"path": LEGACY_PATH, "sha256": LEGACY_SHA}] + c["modelCodeBindings"]:
        read_fixed(ref)
    validate_sources(data, c)
    require(time.monotonic() - started_mono < MAX_SECONDS, "166_deadline_after")
    result = {"schemaVersion": c["outputContract"]["schemaVersion"], "taskId": TASK_ID,
              "contractSha256": CONTRACT_SHA256, "mode": "primary", "step": data["step"], "inputBytesSha256": sha(raw),
              "featureValueSha256": feature_value_sha(data["window"]["values"]), "checkpointSha256": c["checkpoint"]["sha256"],
              "workerSha256": sha(HELPER.safe_path(SELF_PATH).read_bytes()), "values": output[0].tolist(),
              "fieldOrder": c["fieldOrder"], "units": c["units"], "pid": os.getpid(), "startedAtUtc": started_at,
              "finishedAtUtc": utc_now(), "elapsedSeconds": time.monotonic() - started_mono,
              "modelForwardRuns": FORWARD_CALLS, "trainingUpdates": 0, "worldWrites": 0, "productionReady": False}
    exact(result, c["outputContract"]["exactFields"], "166_output_fields")
    encoded = canonical(result) + b"\n"
    require(len(encoded) <= MAX_BYTES, "166_output_bytes")
    return encoded


def main():
    started = utc_now()
    try:
        require(len(sys.argv) == 1, "166_stdin_only")
        sys.stdout.buffer.write(run(sys.stdin.buffer.read(MAX_BYTES + 1), started, START_MONOTONIC))
        sys.stdout.buffer.flush()
        return 0
    except Exception as error:
        failure = {"schemaVersion": "world-environment-scheduled-forward-failure-v1", "taskId": TASK_ID,
                   "status": "failed", "errorType": type(error).__name__, "error": str(error)[:2000], "pid": os.getpid(),
                   "startedAtUtc": started, "finishedAtUtc": utc_now(), "elapsedSeconds": time.monotonic() - START_MONOTONIC,
                   "modelForwardRuns": FORWARD_CALLS, "productionReady": False, "worldWrites": 0, "trainingUpdates": 0}
        sys.stderr.buffer.write(canonical(failure) + b"\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
