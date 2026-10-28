"""Authenticated target-free natural input; no model or checkpoint execution."""
from __future__ import annotations

from dataclasses import dataclass
from copy import deepcopy
from pathlib import Path
from io import BytesIO
import hashlib
import json

SCOPE = "natural_world_runtime_v1"
IDENTITIES = ("ownerId", "playerId", "worldId", "worldSeed", "worldProfileId", "regionId")


def _require(value, message):
    if not value:
        raise ValueError(message)


def _digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
        separators=(",", ":"), allow_nan=False).encode("utf-8")).hexdigest()


def _hash_ok(value):
    return type(value) is str and len(value) == 64 and all(c in "0123456789abcdef" for c in value)


class _Reader:
    def __init__(self, root):
        self.root = Path(root).resolve()
        self.runtime = (self.root / ".runtime").resolve()
        self.receipts = []
        self.expected = {}

    def path(self, binding):
        p = binding.get("path") if isinstance(binding, dict) else None
        _require(type(p) is str and p and "\\" not in p and ":" not in p
            and "/design/" not in p
            and not p.startswith("/") and all(x not in ("", ".", "..", "latest", "latest.json")
                for x in p.split("/")) and _hash_ok(binding.get("sha256")), "natural file binding invalid")
        file = self.root / p
        real = file.resolve(strict=True)
        _require(real.is_relative_to(self.root) or p.startswith(".runtime/")
            and real.is_relative_to(self.runtime), "natural file physical escape")
        prior = self.expected.setdefault(p, binding["sha256"])
        _require(prior == binding["sha256"], "conflicting natural file binding")
        return file

    def bytes(self, binding, limit=2 * 1024 * 1024):
        file = self.path(binding)
        _require(file.stat().st_size <= limit, "natural consumed input too large")
        data = file.read_bytes()
        actual = hashlib.sha256(data).hexdigest()
        self.receipts.append({"path": binding["path"], "sha256": actual, "bytes": len(data)})
        _require(actual == binding["sha256"], "natural consumed file hash differs: " + binding["path"])
        return data

    def verify(self, binding):
        file = self.path(binding)
        h = hashlib.sha256()
        with file.open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                h.update(block)
        self.receipts.append({"path": binding["path"], "sha256": h.hexdigest(), "bytes": file.stat().st_size})
        _require(h.hexdigest() == binding["sha256"], "natural source/dependency hash differs: " + binding["path"])

    def json(self, binding):
        return json.loads(self.bytes(binding).decode("utf-8"), parse_constant=lambda value: (_ for _ in ()).throw(ValueError("nonfinite natural JSON")))


@dataclass(frozen=True)
class NaturalWorldModelInput:
    conditions: object
    instance_table: list
    appearance_regime: object
    ecology_regime: object
    geometry: object
    identity: dict
    provenance: dict
    consumed_bindings: list


def load_natural_world_input(*, root, descriptor_binding, stage):
    """Read each stage directly from authenticated ORIGINAL 1024 channel bytes."""
    reader = _Reader(root)
    descriptor = reader.json(descriptor_binding)
    _require(type(descriptor) is dict, "natural descriptor must be an object")
    _require(descriptor.get("schemaVersion") == "natural-world-model-input-descriptor-v1"
        and descriptor.get("scope") == SCOPE and descriptor.get("newWorldIsDatasetSample") is False
        and "sampleId" not in descriptor and "split" not in descriptor and "image" not in descriptor,
        "unsupported natural descriptor scope or training masquerade")
    payload = {k: v for k, v in descriptor.items() if k != "descriptorPayloadSha256"}
    _require(_digest(payload) == descriptor.get("descriptorPayloadSha256"), "natural descriptor payload hash differs")
    _require(type(stage) is int and stage in (0, 1, 2), "unregistered natural stage")
    mandatory = {"scripts/lib/natural-world-model-input.mjs", "ml/ai-painter/src/ai_painter/__init__.py",
        "ml/ai-painter/src/ai_painter/complete_world/__init__.py", "ml/ai-painter/src/ai_painter/training/__init__.py",
        "ml/ai-painter/src/ai_painter/training/torch_runtime.py"}
    mandatory.update("ml/ai-painter/src/ai_painter/complete_world/" + name + ".py" for name in
        ("natural_world_input_v1", "native_stage_geometry_v1", "object_instance_supervision_cpu", "dataset",
         "object_ecology_regime_input_cpu", "object_appearance_regime_input_cpu"))
    _require(type(descriptor.get("dependencyBindings")) is list and type(descriptor.get("sourceReadBindings")) is list
        and 1 <= len(descriptor["sourceReadBindings"]) <= 512
        and mandatory <= {b.get("path") for b in descriptor["dependencyBindings"]}, "natural dependency closure missing")
    for binding in descriptor["dependencyBindings"] + descriptor["sourceReadBindings"]:
        reader.verify(binding)
    # These imports expose data/geometry helpers and encoders, not a renderer.
    import torch
    from PIL import Image
    from ai_painter.complete_world.dataset import read_image
    from ai_painter.complete_world.native_stage_geometry_v1 import NativeStageGeometry
    from ai_painter.complete_world.object_instance_supervision_cpu import iter_object_views, ROLE_BY_KIND
    from ai_painter.complete_world.object_appearance_regime_input_cpu import encode_season, SEASONS
    from ai_painter.complete_world.object_ecology_regime_input_cpu import encode_ecology, ECOLOGIES

    geometry = NativeStageGeometry(stage)
    policy = reader.json(descriptor["nativePolicy"])
    _require(policy["schemaVersion"] == "native-stage-geometry-policy-v1" and descriptor["nativeStages"] == policy["stages"], "natural registered geometry policy differs")
    registered = policy["stages"][stage]
    _require((registered["stage"], registered["width"], registered["height"], registered["patchSize"],
        registered["backgroundRingRadius"], registered["nativeCoordinateStep"], registered["nativeHalfPixelTolerance"])
        == (stage, geometry.width, geometry.height, geometry.patch_size, geometry.background_ring_radius,
            geometry.native_coordinate_step, geometry.native_half_pixel_tolerance), "natural geometry registration differs")
    for key, role in (("tree", "object_tree"), ("rock", "object_rock"), ("vegetation", "object_vegetation")):
        _require(registered["supportRadii"][key] == geometry.support_radius(role), "natural support geometry differs")
    bindings = descriptor["bindings"]
    record = reader.json(bindings["runtimeSave"])
    release = reader.json(bindings["sourceFactRelease"])
    task = reader.json(bindings["taskPackage"])
    task_manifest = reader.json(bindings["taskManifest"])
    pack = reader.json(bindings["conditionPackage"])
    manifest = reader.json(bindings["conditionManifest"])
    _require(record.get("version") == "natural-world-runtime-save-v1"
        and record.get("worldFacts", {}).get("schemaVersion") == "natural-world-facts-snapshot-v1"
        and record.get("worldState", {}).get("schemaVersion") == "natural-world-state-snapshot-v1", "natural saved schema differs")
    _require(set(descriptor["identity"]) == set(IDENTITIES) and all(record[k] == descriptor["identity"][k] for k in IDENTITIES), "natural world identity differs")
    for key in ("tick", "stateVersion", "recordContentSha256", "statePayloadSha256"):
        _require(record[key] == descriptor[key], "natural saved state differs: " + key)
    _require(record["worldFactsPayloadSha256"] == descriptor["factHash"] == release["factHash"], "natural fact hash differs")
    roles = {"sourceFactRelease": "natural_source_fact_release", "taskManifest": "visual_task_manifest",
        "taskPackage": "visual_generation_task", "conditionManifest": "condition_manifest", "conditionPackage": "condition_package"}
    for key, role in roles.items():
        actual = [b for b in record["sourceBindings"] if b["role"] == role]
        _require(len(actual) == 1 and actual[0]["uri"] == bindings[key]["path"]
            and actual[0]["fileSha256"] == bindings[key]["sha256"], "natural immutable saved binding differs")
    _require(release["schemaVersion"] == "natural-world-source-fact-release-v1" and release["scope"] == SCOPE,
        "natural source release scope differs")
    release_payload = {k: v for k, v in release.items() if k != "sourceFactReleaseIdentity"}
    _require(release["sourceFactReleaseIdentity"] == "natural-source-facts-" + _digest(release_payload)
        == descriptor["sourceFactReleaseIdentity"], "natural source release identity differs")
    for producer in release["producerBindings"]:
        reader.verify(producer)
    generated = reader.json(release["generatedFactsBinding"])
    source_package = reader.json(release["sourcePackageBinding"])
    _require(generated["identity"] == descriptor["identity"] and generated["sourcePackage"] == source_package
        and generated["sourcePackageIdentity"] == descriptor["sourcePackageIdentity"], "natural source facts identity differs")
    _require(record["randomState"] == generated["randomState"], "natural random state differs")
    expected_environment = {**generated["environment"], "resourceInitialization": "no_resource_instances_created", "runtimeEvents": "none_created"}
    _require(record["worldState"]["payload"]["environment"] == expected_environment == descriptor["ecology"]["environment"], "natural environment differs")
    for document in (task, task_manifest, pack, manifest):
        _require(document.get("scope") == SCOPE and document["worldId"] == record["worldId"]
            and document["regionId"] == record["regionId"] and document["tick"] == record["tick"]
            and document["factHash"] == descriptor["factHash"]
            and document["sourceFactReleaseIdentity"] == descriptor["sourceFactReleaseIdentity"], "natural task/condition cross identity differs")
    _require(task_manifest["taskPath"] == bindings["taskPackage"]["path"]
        and manifest["conditionPackPath"] == bindings["conditionPackage"]["path"]
        and pack["sourceBindings"]["taskPackagePath"] == bindings["taskPackage"]["path"], "natural task/condition path differs")
    _require(pack.get("newWorldIsDatasetSample") is False and pack["datasetBindingPurpose"] == "model_training_knowledge_only"
        and descriptor["knowledgeDatasetBinding"] == generated["knowledgeDatasetBinding"]
        and pack["datasetReleaseIdentity"] == generated["knowledgeDatasetBinding"]["identity"], "natural knowledge-only binding differs")
    ecology = task["singleMapEcologyFields"]
    _require(ecology == pack["categoricalConditions"]["ecologyPlan"] == task["directorPlan"]["singleMapEcologyPlan"]
        and ecology["regionalLandscapeType"] == descriptor["ecology"]["regionalLandscapeType"] == generated["regionalLandscapeType"], "natural ecology category differs")
    scenario = descriptor["ecology"]["seasonScenario"]
    _require(scenario == expected_environment["seasonScenario"] == ecology["environment"]["seasonScenario"]
        and scenario.get("kind") == "initial_simulation_scenario" and scenario.get("season") == "wet_season",
        "natural season scenario differs")
    _require(all(expected_environment[k].get("status") == "unknown" and expected_environment[k].get("reason")
        for k in ("weather", "lighting", "wind", "localTime")), "natural unknown weather/light/time changed")
    order = [c["id"] for c in pack["channels"]]
    contract = reader.json({"path": pack["identityBindings"]["conditionContractPath"], "sha256": pack["identityBindings"]["conditionContractSha256"]})
    _require(order == contract["tensorContract"]["channelOrder"] and len(order) == 23
        and len(set(order)) == 23 and len(descriptor["channels"]) == 23, "natural channel order differs")
    _require(descriptor["tensorPolicy"] == {"sourceWidth": 1024, "sourceHeight": 768, "dtype": "float32", "layout": "NCHW",
        "range": [0, 1], "normalizationDivisor": 255, "directFromOriginalForEveryStage": True}, "natural tensor transform policy differs")
    tensors = []
    for entry, channel in zip(descriptor["channels"], pack["channels"], strict=True):
        method = "bilinear" if channel["kind"] in ("distance", "coordinate", "continuous") or channel["id"].startswith("signed_distance_") or channel["id"] in ("coordinate_x", "coordinate_y", "moisture_proximity") else "nearest"
        _require(entry == {"id": channel["id"], "kind": channel["kind"], "path": channel["path"], "sha256": channel["sha256"],
            "dtype": "uint8", "nativeShape": [1, 768, 1024], "resize": method}, "natural typed channel descriptor differs")
        saved = [b for b in record["sourceBindings"] if b["role"] == "condition_channel_" + channel["id"]]
        _require(len(saved) == 1 and saved[0]["uri"] == entry["path"] and saved[0]["fileSha256"] == entry["sha256"], "natural channel differs from saved raw binding")
        raw = reader.bytes({"path": entry["path"], "sha256": entry["sha256"]})
        with Image.open(BytesIO(raw)) as image:
            _require(image.format == "PNG" and image.mode == "L" and image.size == (1024, 768), "natural original PNG type/size differs")
        values = read_image(BytesIO(raw), "L", (geometry.width, geometry.height),
            Image.Resampling.BILINEAR if method == "bilinear" else Image.Resampling.NEAREST)
        tensors.append(torch.from_numpy(values).float().div(255.0))
    conditions = torch.stack(tensors).contiguous()
    _require(conditions.shape == (23, geometry.height, geometry.width) and conditions.dtype == torch.float32
        and conditions.device.type == "cpu" and not conditions.requires_grad and bool(torch.isfinite(conditions).all()), "natural condition tensor invalid")
    table = deepcopy(descriptor["objectInstanceTable"])
    _require(descriptor["instanceCoordinateSpace"] == "original_1024x768" and descriptor["objectRoles"] == ROLE_BY_KIND
        and table == pack["objectInstanceTable"] and all(row["kind"] in ROLE_BY_KIND for row in table), "natural instance table differs")
    views = 0
    for _view in iter_object_views(conditions, table, order, geometry=geometry):
        views += 1
    _require(views == len(table), "natural instance labels missing")
    season = encode_season(scenario["season"])
    ecology_code = encode_ecology(ecology["regionalLandscapeType"])
    reader.verify(bindings["runtimeSave"])
    return NaturalWorldModelInput(conditions=conditions.unsqueeze(0), instance_table=table,
        appearance_regime=season, ecology_regime=ecology_code, geometry=geometry,
        identity=deepcopy(descriptor["identity"]), provenance={"scope": SCOPE, "tick": descriptor["tick"],
            "stateVersion": descriptor["stateVersion"], "factHash": descriptor["factHash"], "sourceFactReleaseIdentity": descriptor["sourceFactReleaseIdentity"],
            "seasonScenario": deepcopy(scenario), "environment": deepcopy(expected_environment), "seasonOrder": list(SEASONS), "ecologyOrder": list(ECOLOGIES),
            "executionQualificationGranted": False, "originalSourceResizeOnly": True}, consumed_bindings=reader.receipts)
