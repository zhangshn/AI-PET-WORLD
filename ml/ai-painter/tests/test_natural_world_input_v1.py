import hashlib
import json
import os
from pathlib import Path
from io import BytesIO
import sys
import unittest
from unittest.mock import patch

import torch
import psutil
from PIL import Image
from ai_painter.complete_world.natural_world_input_v1 import load_natural_world_input, _digest, _Reader
from ai_painter.complete_world import dataset

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = Path(os.environ["NATURAL_MODEL_INPUT_PYTHON_OUTPUT"])
BINDING_PATH = Path(os.environ["NATURAL_MODEL_INPUT_DESCRIPTOR_BINDING"])


class NaturalWorldInputTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        torch.set_num_interop_threads(2)
        OUTPUT.mkdir(parents=True, exist_ok=True)
        cls.binding = json.loads(BINDING_PATH.read_text(encoding="utf-8"))
        cls.descriptor = json.loads((ROOT / cls.binding["path"]).read_text(encoding="utf-8"))
        cls.checkpoint_guard = patch("torch.load", side_effect=AssertionError("checkpoint load prohibited"))
        cls.model_guard = patch("torch.nn.Module.__init__", side_effect=AssertionError("model instantiation prohibited"))
        cls.checkpoint_guard.start(); cls.model_guard.start()
        cls.receipts = []

    @classmethod
    def tearDownClass(cls):
        cls.checkpoint_guard.stop(); cls.model_guard.stop()
        (OUTPUT / "python-receipt.json").write_text(json.dumps({"stages": cls.receipts,
            "peakWorkingSet": getattr(psutil.Process().memory_info(), "peak_wset", psutil.Process().memory_info().rss),
            "cudaInitialized": torch.cuda.is_initialized(),
            "rendererModuleImported": "ai_painter.complete_world.terrain_ecology_native_stage_v1" in sys.modules,
            "checkpointOrModelExecuted": False}, indent=2) + "\n", encoding="utf-8")

    def load(self, binding=None, stage=0):
        return load_natural_world_input(root=ROOT, descriptor_binding=binding or self.binding, stage=stage)

    def variant(self, name, change):
        descriptor = json.loads(json.dumps(self.descriptor)); change(descriptor)
        descriptor.pop("descriptorPayloadSha256", None); descriptor["descriptorPayloadSha256"] = _digest(descriptor)
        file = OUTPUT / (name + ".json"); raw = (json.dumps(descriptor, indent=2) + "\n").encode()
        file.write_bytes(raw)
        return {"path": file.relative_to(ROOT).as_posix(), "sha256": hashlib.sha256(raw).hexdigest()}

    def test_01_all_registered_stages_original_resize_and_instance_semantics(self):
        for stage in (0, 1, 2):
            with self.subTest(stage=stage), patch.object(dataset, "read_image", wraps=dataset.read_image) as original_resize:
                value = self.load(stage=stage)
                self.assertEqual(original_resize.call_count, 23)
                self.assertEqual(tuple(value.conditions.shape), (1, 23, 192 * 2 ** stage, 256 * 2 ** stage))
                self.assertEqual(value.conditions.dtype, torch.float32); self.assertFalse(value.conditions.requires_grad)
                self.assertEqual(len(value.instance_table), 52)
                self.assertEqual(value.appearance_regime.tolist(), [0, 0, 1, 0])
                self.assertEqual(value.ecology_regime.tolist(), [0, 0, 1, 0, 0, 0, 0])
                for channel, call in zip(self.descriptor["channels"], original_resize.call_args_list, strict=True):
                    stream, mode, size, method = call.args
                    self.assertIsInstance(stream, BytesIO); self.assertEqual(hashlib.sha256(stream.getvalue()).hexdigest(), channel["sha256"])
                    self.assertEqual(mode, "L"); self.assertEqual(size, (256 * 2 ** stage, 192 * 2 ** stage))
                    self.assertEqual(method, Image.Resampling.BILINEAR if channel["resize"] == "bilinear" else Image.Resampling.NEAREST)
                self.assertEqual(value.provenance["seasonScenario"]["kind"], "initial_simulation_scenario")
                self.assertEqual(value.provenance["environment"]["weather"]["status"], "unknown")
                self.receipts.append({"stage": stage, "shape": list(value.conditions.shape),
                    "tensorSha256": hashlib.sha256(value.conditions.numpy().tobytes()).hexdigest(),
                    "instanceTableSha256": _digest(value.instance_table), "instances": len(value.instance_table),
                    "seasonCode": value.appearance_regime.tolist(), "ecologyCode": value.ecology_regime.tolist(),
                    "geometryIdentity": value.geometry.identity(), "consumedBindings": value.consumed_bindings,
                    "workingSet": psutil.Process().memory_info().rss})

    def test_02_identity_state_scope_ecology_season_and_type_changes(self):
        cases = {
            "swapped_world": lambda d: d["identity"].update(worldId="natural-wrong-world"),
            "stale_state": lambda d: d.update(stateVersion=d["stateVersion"] + 1),
            "stripped_scope": lambda d: d.pop("scope"),
            "altered_ecology": lambda d: d["ecology"].update(regionalLandscapeType="bamboo-grove"),
            "altered_season": lambda d: d["ecology"]["seasonScenario"].update(season="dry_season"),
            "unknown_light": lambda d: d["ecology"]["environment"]["lighting"].update(status="observed"),
            "wrong_resize": lambda d: d["channels"][0].update(resize="bilinear"),
            "unsupported_role": lambda d: d["objectInstanceTable"][0].update(kind="animal"),
            "missing_dependencies": lambda d: d.update(dependencyBindings=[]),
        }
        failures = []
        for name, change in cases.items():
            with self.subTest(case=name):
                binding = self.variant(name, change)
                with self.assertRaises(ValueError) as raised:
                    self.load(binding)
                failures.append({"case": name, "binding": binding, "error": str(raised.exception)})
        (OUTPUT / "metadata-rejections.json").write_text(json.dumps(failures, indent=2) + "\n", encoding="utf-8")

    def test_03_fake_same_shaped_png_is_not_authenticated_by_shape(self):
        file = OUTPUT / "same-shaped-fake.png"; Image.new("L", (1024, 768), 17).save(file)
        binding = self.variant("same_shaped_png", lambda d: d["channels"][0].update(path=file.relative_to(ROOT).as_posix(), sha256=hashlib.sha256(file.read_bytes()).hexdigest()))
        with self.assertRaisesRegex(ValueError, "typed channel descriptor differs"):
            self.load(binding)

    def test_04_changed_bytes_between_source_verification_and_consumption_are_rejected(self):
        channel = self.descriptor["channels"][0]; original = ROOT / channel["path"]
        corrupt = bytearray(original.read_bytes()); corrupt[-1] ^= 1
        (OUTPUT / "corrupt-consumed-channel.png").write_bytes(corrupt)
        read_bytes = Path.read_bytes
        def changed(file):
            return bytes(corrupt) if file == original else read_bytes(file)
        with patch.object(Path, "read_bytes", changed):
            with self.assertRaisesRegex(ValueError, "consumed file hash differs"):
                self.load()

    def test_05_unregistered_geometry_and_wrong_descriptor_bytes(self):
        for stage in (True, -1, 3):
            with self.subTest(stage=stage), self.assertRaisesRegex(ValueError, "unregistered"):
                self.load(stage=stage)
        with self.assertRaisesRegex(ValueError, "file hash differs"):
            self.load({**self.binding, "sha256": "f" * 64})
        self.assertFalse(torch.cuda.is_initialized())
        self.assertNotIn("ai_painter.complete_world.terrain_ecology_native_stage_v1", sys.modules)


if __name__ == "__main__":
    unittest.main()
