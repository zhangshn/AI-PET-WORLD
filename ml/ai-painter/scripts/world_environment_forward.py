"""155 bounded stdin/stdout diagnostic forward; no training or world writes."""

import datetime as dt
import hashlib
import importlib.util
import io
import json
import math
from pathlib import Path
import sys
import time

START_MONOTONIC = time.monotonic()
CONTRACT_SHA256 = "3c6d5bf1963c5c1aad795b72b4b7af0a20aa6f5c1afb30f3c6a552a921a26b1e"
WIRE_SHA256 = "d78eb34bbddd792a949831111cd815b92dca63031e510fdbcd5006ea8ce7d771"
ROOT = Path(__file__).resolve().parents[3]
EVIDENCE_ROOT = ROOT / ".runtime/ai-painter/controller-repair-reviews/world-evolution-candidate-155-20261029"
MAX_WIRE_BYTES = 65536
IDENTITY_FIELDS = ["ownerId", "playerId", "worldId", "worldSeed", "worldProfileId", "regionId"]
FEATURE_FIELDS = ["schemaVersion", "sourceSha256", "fieldOrder", "units", "shape", "dates", "periods", "asOfUtc", "asOfSemantics", "horizonSeconds", "targetPeriod", "values", "inputContentSha256"]


def require(ok, message):
    if not ok:
        raise ValueError(message)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def canonical(value):
    # Preserve the original parsed numbers; never hash tensor-cast values.
    return json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8")


def strict_json(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, "duplicate JSON key")
            result[key] = value
        return result
    result = json.loads(raw.decode("utf-8"), object_pairs_hook=pairs, parse_constant=lambda _: (_ for _ in ()).throw(ValueError("nonfinite JSON constant")))
    def check(value, depth=0):
        require(depth <= 32, "JSON depth exceeded")
        if isinstance(value, dict):
            for item in value.values():
                check(item, depth + 1)
        elif isinstance(value, list):
            for item in value:
                check(item, depth + 1)
        elif type(value) in (float, int):
            require(math.isfinite(value), "nonfinite number")
    check(result)
    return result


def exact(value, keys, label):
    require(type(value) is dict and set(value) == set(keys), label + ": missing or unknown fields")


def read_fixed(ref, limit=8 * 1024 * 1024):
    path = ROOT / ref["path"]
    require(path.is_file() and not path.is_symlink() and path.stat().st_nlink == 1, "fixed input must be regular nonlinked file")
    with path.open("rb") as handle:
        raw = handle.read(limit + 1)
    require(0 < len(raw) <= limit and sha(raw) == ref["sha256"], "fixed input byte/SHA mismatch: " + ref["path"])
    return raw


def read_contracts():
    probe = strict_json(read_fixed({"path": str(EVIDENCE_ROOT / "probe-contract.json"), "sha256": CONTRACT_SHA256}, MAX_WIRE_BYTES))
    wire = strict_json(read_fixed({"path": str(EVIDENCE_ROOT / "wire-contract.json"), "sha256": WIRE_SHA256}, MAX_WIRE_BYTES))
    require(probe["taskId"] == "WORLD-EVOLUTION-CANDIDATE-155" and wire["contractSha256"] == CONTRACT_SHA256, "frozen contract mismatch")
    return probe, wire


def validate_input(raw, probe, wire, world, world_sha, archive, receipt):
    require(0 < len(raw) <= MAX_WIRE_BYTES, "stdin byte bound exceeded")
    data = strict_json(raw)
    exact(data, wire["input"]["exactFields"], "forward input")
    require(data["schemaVersion"] == wire["input"]["schemaVersion"] and data["taskId"] == probe["taskId"] and data["contractSha256"] == CONTRACT_SHA256, "forward input identity mismatch")
    require(data["historyOrigin"] == "external_archival_context" and data["productionReady"] is False, "archive/production boundary mismatch")
    binding = data["worldBinding"]
    exact(binding, wire["input"]["worldBindingExactFields"], "world binding")
    exact(binding["identity"], wire["input"]["identityExactFields"], "world identity")
    exact(binding["before"], wire["input"]["beforeExactFields"], "world before")
    require(binding["identity"] == {k: world[k] for k in IDENTITY_FIELDS}, "world identity mismatch")
    require(world_sha == probe["worldStore"]["sha256"], "actual world file identity mismatch")
    expected_before = {"tick": world["tick"], "stateVersion": world["stateVersion"], "eventCursor": world["eventCursor"], "fileSha256": world_sha,
                       "factsSha256": world["worldFactsPayloadSha256"], "stateSha256": world["statePayloadSha256"], "recordSha256": world["recordContentSha256"]}
    require(binding["before"] == expected_before, "world before mismatch")
    require(all(type(binding["before"][k]) is int and binding["before"][k] == 0 for k in ("tick", "stateVersion", "eventCursor")), "world is not the fixed initial state")
    features = data["features"]
    exact(features, FEATURE_FIELDS, "features")
    feature_content = {k: v for k, v in features.items() if k != "inputContentSha256"}
    require(type(features["inputContentSha256"]) is str and sha(canonical(feature_content)) == features["inputContentSha256"], "feature canonical SHA mismatch")
    spec = probe["features"]
    for key in ("schemaVersion", "fieldOrder", "units", "shape", "dates"):
        require(features[key] == spec[key], "feature " + key + " mismatch")
    require(all(type(n) is int for n in features["shape"]), "feature shape must be integers")
    archive_sha = wire["archiveBindings"][0]["sha256"]
    require(features["sourceSha256"] == archive_sha and receipt["responseSha256"] == archive_sha and receipt["httpStatus"] == 200, "archive receipt identity mismatch")
    require(archive["header"]["start"] == "20200101" and archive["header"]["end"] == "20200131" and archive["header"]["time_standard"] == "UTC", "archive date/time mismatch")
    require(features["asOfUtc"] == spec["forecastInterval"]["startUtc"] and features["asOfSemantics"] == "retrospective_completed_day_assumption_not_publication", "as-of interpretation mismatch")
    require(type(features["horizonSeconds"]) is int and features["horizonSeconds"] == 86400, "forecast horizon mismatch")
    require(features["targetPeriod"] == {"startUtc": spec["forecastInterval"]["startUtc"], "endUtc": spec["forecastInterval"]["endUtc"]}, "target interval mismatch")
    require(type(features["periods"]) is list and len(features["periods"]) == 7, "feature periods mismatch")
    require(type(features["values"]) is list and len(features["values"]) == 7, "feature matrix shape mismatch")
    for index, date in enumerate(spec["dates"]):
        day = dt.datetime.strptime(date, "%Y%m%d").replace(tzinfo=dt.timezone.utc)
        expected_period = {"startUtc": day.isoformat(timespec="milliseconds").replace("+00:00", "Z"), "endUtc": (day + dt.timedelta(days=1)).isoformat(timespec="milliseconds").replace("+00:00", "Z")}
        require(features["periods"][index] == expected_period, "future/mismatched period")
        row = features["values"][index]
        require(type(row) is list and len(row) == 4 and all(type(v) in (int, float) and math.isfinite(v) for v in row), "feature matrix numeric mismatch")
        expected_row = []
        for field, unit in zip(spec["fieldOrder"], spec["units"]):
            require(archive["parameters"][field]["units"] == unit, "archive unit mismatch")
            expected_row.append(archive["properties"]["parameter"][field][date])
        require(row == expected_row, "feature differs from fixed raw archive")
    return data


def load_model(probe):
    for ref in probe["modelCodeBindings"]:
        read_fixed(ref)
    path = ROOT / probe["modelCodeBindings"][0]["path"]
    spec = importlib.util.spec_from_file_location("humidity155_dependency", path)
    model_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(model_module)
    torch = model_module.pilot.configure_torch()
    checkpoint = torch.load(io.BytesIO(read_fixed(probe["checkpoint"])), map_location="cpu", weights_only=True)
    require(checkpoint["schemaVersion"] == "world-environment-humidity-checkpoint-v1" and checkpoint["targetTransform"] == "raw_RH_other_columns150", "checkpoint schema/target mismatch")
    require(checkpoint["contractSha256"] == probe["checkpoint"]["trainingContractSha256"] and checkpoint["trainingDatasetSha256"] == probe["checkpoint"]["trainingDatasetSha256"], "checkpoint training lineage mismatch")
    require(checkpoint["parentCheckpointSha256"] == "ef9a67f8a6078dc4f39e3280351ecca94f7a31677a3fc4ad0620fc186adbda54" and checkpoint["fitCount"] == 1 and checkpoint["onlyFittedColumn"] == "RH2M", "checkpoint parent/fit identity mismatch")
    model = checkpoint["model"]
    exact(model, ["weights", "inputMean", "inputStd", "targetMean", "targetStd"], "model")
    for key, value in model.items():
        shape = (29, 4) if key == "weights" else (4,)
        require(type(value) is torch.Tensor and tuple(value.shape) == shape and value.dtype == torch.float64 and value.device.type == "cpu" and bool(torch.isfinite(value).all()), "checkpoint tensor mismatch")
    require(bool((model["inputStd"] > 0).all()) and bool((model["targetStd"] > 0).all()), "checkpoint normalization mismatch")
    return model_module, model, torch


def run(raw, started_at, started_mono):
    require(0 < len(raw) <= MAX_WIRE_BYTES, "stdin byte bound exceeded")
    probe, wire = read_contracts()
    world_raw = read_fixed(probe["worldStore"])
    world = strict_json(world_raw)
    archive_raw = read_fixed(wire["archiveBindings"][0])
    receipt = strict_json(read_fixed(wire["archiveBindings"][1]))
    require(receipt["responseBytes"] == len(archive_raw), "archive receipt byte mismatch")
    for ref in wire["producerCodeBindings"] + [probe["baselineSelection"], probe["acceptanceModelIdentity"]]:
        read_fixed(ref)
    data = validate_input(raw, probe, wire, world, sha(world_raw), strict_json(archive_raw), receipt)
    module, model, torch = load_model(probe)
    require(time.monotonic() - started_mono < 30, "worker wall budget exhausted before forward")
    # This is the single actual forward call; metadata never enters the tensor.
    values = torch.tensor([data["features"]["values"]], dtype=torch.float64, device="cpu")
    with torch.no_grad():
        output = module.predict(model, values)
    require(tuple(output.shape) == (1, 4), "model output shape mismatch")
    if not bool(torch.isfinite(output).all()):
        raise ValueError("nonfinite model output: " + repr(output.tolist()))
    # Preserve illegal finite values for the Node-side guarded candidate check.
    for ref in [probe["worldStore"], probe["checkpoint"]] + probe["modelCodeBindings"]:
        read_fixed(ref)
    result = {"schemaVersion": wire["output"]["schemaVersion"], "taskId": probe["taskId"], "contractSha256": CONTRACT_SHA256,
              "inputBytesSha256": sha(raw), "inputContentSha256": data["features"]["inputContentSha256"], "worldBindingSha256": sha(canonical(data["worldBinding"])),
              "checkpointSha256": probe["checkpoint"]["sha256"], "fieldOrder": probe["features"]["fieldOrder"], "units": probe["features"]["units"],
              "forecastInterval": probe["features"]["forecastInterval"], "values": output[0].tolist(), "modelExecuted": True, "trainingUpdates": 0,
              "featureValueSha256": sha(canonical(data["features"]["values"])), "startedAtUtc": started_at, "finishedAtUtc": utc_now(),
              "elapsedSeconds": time.monotonic() - started_mono, "codeBindings": [{"path": "ml/ai-painter/scripts/world_environment_forward.py", "sha256": sha(Path(__file__).read_bytes())}] + probe["modelCodeBindings"],
              "productionReady": False, "worldWrites": 0}
    exact(result, wire["output"]["exactFields"], "forward output")
    encoded = canonical(result) + b"\n"
    require(len(encoded) <= MAX_WIRE_BYTES and time.monotonic() - started_mono < 30, "worker output/time budget exceeded")
    return encoded


def main():
    started = utc_now()
    try:
        require(len(sys.argv) == 1, "worker accepts stdin only; no CLI arguments")
        raw = sys.stdin.buffer.read(MAX_WIRE_BYTES + 1)
        sys.stdout.buffer.write(run(raw, started, START_MONOTONIC))
        sys.stdout.buffer.flush()
        return 0
    except Exception as error:
        failure = {"schemaVersion": "world-environment-forward-failure-v1", "taskId": "WORLD-EVOLUTION-CANDIDATE-155", "status": "failed",
                   "errorType": type(error).__name__, "error": str(error)[:2000], "startedAtUtc": started, "finishedAtUtc": utc_now(),
                   "elapsedSeconds": time.monotonic() - START_MONOTONIC, "productionReady": False, "worldWrites": 0}
        sys.stderr.buffer.write(canonical(failure) + b"\n")
        sys.stderr.buffer.flush()
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
