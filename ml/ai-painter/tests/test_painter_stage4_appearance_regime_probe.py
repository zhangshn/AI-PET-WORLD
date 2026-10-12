"""Artificial source metadata and scenes; no original targets or CUDA execution."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import torch
ROOT = Path(__file__).absolute().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import painter_stage4_appearance_regime_probe as profile
from ai_painter.complete_world.object_appearance_regime_input_cpu import SEASONS, encode_season
from test_object_appearance_regime_conditioned_cpu import ORDER, scene


def encoded(value): return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


class SyntheticReader:
    """In-memory fake data. Only the real canonical hashing code is read."""
    root = ROOT
    def __init__(self): self.files = {}; self.observed = {}; self.reads = []
    def add(self, path, value):
        data = encoded(value); self.files[path] = data
        return {"path": path, "sha256": hashlib.sha256(data).hexdigest()}
    def read(self, binding):
        self.reads.append(binding["path"])
        data = self.files[binding["path"]]
        if hashlib.sha256(data).hexdigest() != binding["sha256"]: raise ValueError("synthetic source SHA differs")
        self.observed[binding["path"]] = binding["sha256"]; return data
    def json(self, binding): return json.loads(self.read(binding))
    def snapshot(self, path):
        if path == "scripts/lib/real-earth-region-governance.mjs":
            data = (ROOT / path).read_bytes()
            self.observed[path] = hashlib.sha256(data).hexdigest()
            return data, {"path": path, "sha256": self.observed[path]}
        data = self.files[path]; binding = {"path": path, "sha256": hashlib.sha256(data).hexdigest()}
        return self.read(binding), binding


def source_fixture(season=SEASONS[0], sample_id="synthetic", *, split="train", ordinal=0, reader=None):
    reader = reader or SyntheticReader(); prefix = "synthetic/" + season
    climate = {"sourceId": "synthetic-climate", "role": "regional_climate_and_monsoon_context", "license": "synthetic-license",
        "attribution": "synthetic-attribution", "acquisitionStatus": "synthetic", "visualTrainingTargetEligible": False}
    registry = reader.add("synthetic/registry.json", {"sources": [climate]})
    regional = reader.add("synthetic/profile.json", {"synthetic": True})
    env = {"season": season, "weather": "synthetic-weather", "lighting": "synthetic-light", "groundMoisture": "synthetic-moisture"}
    snapshot = reader.add(prefix + "/snapshot.json", {"schemaVersion": "natural-home-visual-snapshot-v1",
        "status": "provisional_owner_approved_profile_seasonal_variant", "usage": {"originalImageCoverageBaseline": True},
        "isFinal": False, "snapshotId": season, "environment": env})
    payload = {"sourceProvenance": {"seasonSnapshotPath": snapshot["path"], "seasonSnapshotSha256": snapshot["sha256"],
        "worldProfilePath": regional["path"], "worldProfileSha256": regional["sha256"],
        "sourceRegistryPath": registry["path"], "sourceRegistrySha256": registry["sha256"], "sources": [climate]}}
    canonical = hashlib.sha256(encoded(payload)).hexdigest()
    region = reader.add(prefix + "/region.json", {**payload, "packageSha256": canonical})
    region["taskBoundCanonicalPackageSha256"] = canonical
    ecology = {"season": season, "snapshotId": season}; material = dict(env)
    source = {"seasonSnapshotPath": snapshot["path"], "seasonSnapshotSha256": snapshot["sha256"],
        "regionalProfilePath": regional["path"], "regionalProfileSha256": regional["sha256"],
        "realEarthRegionSourcePackagePath": region["path"], "realEarthRegionSourcePackageSha256": canonical}
    task = reader.add(prefix + "/task.json", {"sourceBindings": source,
        "directorPlan": {"singleMapEcologyPlan": ecology, "singleMapMaterialPlan": material}})
    c, table = scene()
    pack = reader.add(prefix + "/pack.json", {"sourceBindings": {"taskPackagePath": task["path"]},
        "categoricalConditions": {"ecologyPlan": ecology, "materialPlan": material}, "objectInstanceTable": table,
        "channels": [{"id": channel} for channel in ORDER]})
    record = {"conditionPack": pack, "taskPackage": task, "seasonSnapshot": snapshot,
        "regionalProfile": regional, "regionSourcePackage": region, "sourceRegistry": registry}
    identity = {"sampleId": sample_id, "split": split, "ordinal": ordinal, "conditionPack": pack, "taskPackage": task,
        "image": {"path": "synthetic/unread-original.png", "sha256": "0" * 64}}
    sample = {"split": split, "sampleId": sample_id, "conditions": c[0], "objectInstanceTable": table,
        "image": torch.linspace(0, 1, 256)[None, None, :].expand(3, 192, 256).contiguous()}
    return reader, sample, identity, record


def bound_fixture(season=SEASONS[0], sample_id="synthetic"):
    reader, sample, identity, record = source_fixture(season, sample_id)
    return profile.bind_sample_season(reader, sample, identity, record)


class ProfileTests(unittest.TestCase):
    def setUp(self):
        self.threads = torch.get_num_threads(); torch.set_num_threads(2)
        self.rng = torch.random.get_rng_state().clone(); self.backend = profile._backend_snapshot()
    def tearDown(self):
        self.assertTrue(torch.equal(self.rng, torch.random.get_rng_state()))
        self.assertEqual(self.backend, profile._backend_snapshot()); torch.set_num_threads(self.threads)
        self.assertFalse(torch.cuda.is_initialized())

    def test_source_binding_missing_wrong_season_source_sha_table_and_content_rejected(self):
        reader, sample, identity, record = source_fixture()
        bound = profile.bind_sample_season(reader, sample, identity, record)
        self.assertTrue(torch.equal(profile.validate_sample_season(bound), encode_season(SEASONS[0])))
        for key, value in (("appearance_regime", encode_season(SEASONS[2])), ("_appearance_regime_binding", None),
                            ("sampleId", "wrong"), ("conditions", sample["conditions"] + 1)):
            bad = {**bound, key: value}
            with self.assertRaises(ValueError): profile.validate_sample_season(bad)
        bad = {**bound, "objectInstanceTable": []}
        with self.assertRaises(ValueError): profile.validate_sample_season(bad)
        raw = reader.files[record["seasonSnapshot"]["path"]]
        reader.files[record["seasonSnapshot"]["path"]] = raw + b" "
        with self.assertRaisesRegex(ValueError, "SHA"): profile.validate_sample_season(bound)

    def test_all_48_train_8_validation_metadata_no_target_read_or_metric_use(self):
        reader = SyntheticReader(); rows = []; split_bindings = {}
        for split, count in (("train", 48), ("validation", 8)):
            ids = []
            for i in range(count):
                sid = split + "-synthetic-" + str(i); ids.append(sid)
                _, _, identity, _ = source_fixture(SEASONS[(i + 2) % 4], sid, split=split, ordinal=0, reader=reader)
                rows.append({"split": split, "ordinal": i, "sampleId": sid, "identity": identity,
                    "rgbMae": "MUST_NOT_READ", "census": "MUST_NOT_READ"})
            split_bindings[split + "Split"] = reader.add("synthetic/" + split + ".json", {"split": split, "sampleIds": ids})
        manifest = reader.add("synthetic/manifest.json", {"identityPayload": {"channelOrder": list(ORDER), "continuousChannelIds": []}})
        diagnostic = reader.add("synthetic/diagnostic.json", {"datasetManifest": manifest, **split_bindings, "rows": rows})
        contract = reader.add("synthetic/contract.json", {"tensorContract": {"channelOrder": list(ORDER), "typePartitions": {"continuous": []}}})
        plan = profile.prepare_metadata(reader, diagnostic, contract)
        self.assertEqual(plan["metadataCounts"], {"train": 48, "validation": 8}); self.assertEqual(len(plan["records"]), 56)
        self.assertFalse(plan["validationRgbRead"]); self.assertFalse(plan["executionAuthorityGranted"])
        self.assertEqual(plan["records"][("train", 47)]["identity"]["ordinal"], 0)
        self.assertEqual(plan["records"][("train", 47)]["splitOrdinal"], 47)
        self.assertTrue(all(not p.endswith(".png") for p in reader.reads))
        for row in plan["records"].values():
            self.assertNotEqual(row["regimeRecord"]["regionSourcePackage"]["sha256"], row["metadataFacts"]["canonicalPackageSha256"])

    def test_sample_forward_fp32_external_autocast_and_fresh_factory_cuda_initialized(self):
        sample = bound_fixture()
        with patch.object(torch.cuda, "is_initialized", return_value=True), patch.object(torch.cuda, "_lazy_init", side_effect=AssertionError("CUDA touched")), \
             patch.object(torch.cuda, "manual_seed_all", side_effect=AssertionError("CPU profile seeded CUDA")):
            model, critic = profile.fresh_networks(ORDER)
            self.assertTrue(all(p.device.type == "cpu" for n in (model, critic) for p in n.parameters()))
            with torch.no_grad(), torch.autocast("cpu", dtype=torch.bfloat16): result = profile.sample_forward(model, sample)
        self.assertEqual(result.dtype, torch.float32)

    def test_rng_capture_cpu_never_cuda_api_cuda_branch_declared_without_execution(self):
        with patch.object(torch.cuda, "get_rng_state", side_effect=AssertionError("CPU touched CUDA RNG")):
            self.assertIsNone(profile._cuda_rng_snapshot(torch.device("cpu")))
        fake = torch.tensor([1, 2], dtype=torch.uint8)
        with patch.object(torch.cuda, "get_rng_state", return_value=fake) as capture:
            actual = profile._cuda_rng_snapshot(torch.device("cuda:0"))
            self.assertTrue(torch.equal(actual, fake)); self.assertIsNot(actual, fake); capture.assert_called_once()

    def test_phase_sequence_generator_fp32_and_critic_entry_restore_on_partial_failure(self):
        sample = bound_fixture(); model, critic = profile.fresh_networks(ORDER)
        critic.eval().requires_grad_(False); entry = profile.v24._critic_mode_snapshot(critic); seen = []
        original = profile.sample_forward
        def checked_forward(*args, **kwargs):
            self.assertFalse(torch.is_autocast_enabled("cpu")); self.assertEqual(torch.backends.cuda.matmul.fp32_precision, "ieee")
            seen.append((critic.training, all(p.requires_grad for p in critic.parameters()), torch.is_grad_enabled()))
            return original(*args, **kwargs)
        class NoOptimizer:
            def zero_grad(self, **_): pass
        counts = {"generator": 0, "discriminator": 0}; ledger = {"sampleId": sample["sampleId"], **counts}
        def d_update(*_args, **_kwargs): counts["discriminator"] += 1
        with patch.object(profile, "sample_forward", checked_forward), patch.object(profile.core.v21, "update_network", d_update), \
             patch.object(profile, "_generator_candidate", side_effect=RuntimeError("synthetic G root")):
            with self.assertRaisesRegex(RuntimeError, "synthetic G root"):
                profile.perform_pair(model, critic, sample, ORDER, NoOptimizer(), NoOptimizer(), counts, ledger, lambda: None, None)
        self.assertEqual(seen, [(True, True, False), (False, False, True)])
        self.assertEqual(counts, {"generator": 0, "discriminator": 1}); self.assertEqual(ledger["discriminator"], 1)
        self.assertTrue(all(m.training == flag for m, flag in entry["modules"]))
        self.assertTrue(all(p.requires_grad == flag for p, flag in entry["parameters"]))


if __name__ == "__main__": unittest.main()
