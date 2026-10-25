"""Strict private seasonal input. Metadata eligibility grants no execution right."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

SEASONS = ("dry_season", "dry_to_wet_transition", "wet_season", "wet_to_dry_transition")

def require(value, message):
    if not value:
        raise ValueError(message)

def encode_season(season):
    import torch
    require(type(season) is str and season in SEASONS, "unknown or missing season")
    result = torch.zeros(4, dtype=torch.float32)
    result[SEASONS.index(season)] = 1
    return result

def validate_regime(value):
    import torch
    require(isinstance(value, torch.Tensor) and value.shape == (4,)
            and value.dtype == torch.float32 and value.device.type == "cpu"
            and not value.requires_grad and bool(torch.isfinite(value).all())
            and bool(((value == 0) | (value == 1)).all()) and float(value.sum()) == 1,
            "private regime must be a non-gradient CPU float32 four-value one-hot")
    return value


def _canonical_node(region, root, module, *, executable="node"):
    """The original JS function and timeout; successful digest is not admission."""
    program = ("import {pathToFileURL} from 'node:url';import {readFileSync} from 'node:fs';"
        "const {canonicalSha256}=await import(pathToFileURL(process.argv[1]).href);"
        "const {packageSha256,...payload}=JSON.parse(readFileSync(0,'utf8'));"
        "process.stdout.write(canonicalSha256(payload));")
    return subprocess.run([executable, "--input-type=module", "-e", program,
        str(Path(os.path.abspath(root / module)))], input=json.dumps(region, ensure_ascii=False),
        text=True, encoding="utf-8", capture_output=True, check=True, timeout=10)

def bound_regime(reader, record):
    """Authenticate all source bytes separately from the canonical package hash."""
    pack = reader.json(record["conditionPack"])
    task = reader.json(record["taskPackage"])
    region = reader.json(record["regionSourcePackage"])
    snapshot = reader.json(record["seasonSnapshot"])
    profile = reader.json(record["regionalProfile"])
    registry = reader.json(record["sourceRegistry"])
    ecology, material = (pack["categoricalConditions"][key] for key in ("ecologyPlan", "materialPlan"))
    require(pack["sourceBindings"]["taskPackagePath"] == record["taskPackage"]["path"], "task path differs")
    require(ecology == task["directorPlan"]["singleMapEcologyPlan"]
            and material == task["directorPlan"]["singleMapMaterialPlan"], "categorical plans differ")
    season = ecology.get("season")
    require(season in SEASONS and material.get("season") == season
            and snapshot["environment"]["season"] == season, "season binding differs")
    source, provenance = task["sourceBindings"], region["sourceProvenance"]
    for key, item in (("seasonSnapshot", record["seasonSnapshot"]),
                      ("realEarthRegionSourcePackage", record["regionSourcePackage"]),
                      ("regionalProfile", record["regionalProfile"])):
        require(source[key + "Path"] == item["path"], "source path differs: " + key)
        if key != "realEarthRegionSourcePackage":
            require(source[key + "Sha256"] == item["sha256"], "source bytes differ: " + key)
    for key, item in (("seasonSnapshot", record["seasonSnapshot"]),
                      ("worldProfile", record["regionalProfile"]),
                      ("sourceRegistry", record["sourceRegistry"])):
        require(provenance[key + "Path"] == item["path"] and provenance[key + "Sha256"] == item["sha256"],
                "region provenance differs: " + key)
    expected = source["realEarthRegionSourcePackageSha256"]
    require(region["packageSha256"] == expected == record["regionSourcePackage"]["taskBoundCanonicalPackageSha256"],
            "region declared canonical identity differs")
    module = "scripts/lib/real-earth-region-governance.mjs"
    _, module_binding = reader.snapshot(module)
    # Only the already loaded, exact authenticated Reader can own private v3 state.
    # Duck-typed attributes or a caller supplied "cache enabled" flag are ignored.
    auth = sys.modules.get("decode1_entry_weight_quality_auth_v1")
    actual = (reader._verified_canonical_region(record, region, module_binding, expected)
        if auth is not None and type(reader) is auth.Reader else None)
    if actual is None:
        actual = _canonical_node(region, reader.root, module).stdout
    require(actual == expected, "region recomputed canonical identity differs")
    require(snapshot["schemaVersion"] == "natural-home-visual-snapshot-v1"
        and snapshot["status"] in ("provisional_owner_approved_profile_baseline",
            "provisional_owner_approved_profile_seasonal_variant", "provisional_owner_authorized_profile_seasonal_transition")
        and snapshot["usage"]["originalImageCoverageBaseline"] is True and snapshot["isFinal"] is False,
        "not an existing provisional visual baseline")
    require(ecology["snapshotId"] == snapshot["snapshotId"], "snapshot identity differs")
    for key in ("weather", "lighting", "groundMoisture"):
        require(material[key] == snapshot["environment"][key], "profile appearance differs: " + key)
    climate = [entry for entry in provenance["sources"] if entry["role"] == "regional_climate_and_monsoon_context"]
    require(len(climate) == 1 and climate[0].get("license") and climate[0].get("attribution")
        and climate[0]["visualTrainingTargetEligible"] is False, "climate metadata boundary differs")
    matching = [entry for entry in registry["sources"] if entry["sourceId"] == climate[0]["sourceId"]]
    require(len(matching) == 1 and all(matching[0].get(key) == climate[0].get(key)
        for key in ("license", "attribution", "role", "acquisitionStatus", "visualTrainingTargetEligible")),
        "climate registry record differs")
    return encode_season(season), {"season": season, "canonicalPackageSha256": expected,
        "canonicalProgram": module_binding, "snapshotUsage": snapshot["usage"], "executionAuthorityGranted": False}
