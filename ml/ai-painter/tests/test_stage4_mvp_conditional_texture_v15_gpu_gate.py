"""CPU-only negative gate tests; this file never invokes CUDA or the GPU worker."""

from copy import deepcopy
import hashlib
import importlib.util
import io
from pathlib import Path
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[3]
SCRIPT = (ROOT / "ml/ai-painter/scripts/"
          "run_stage4_mvp_conditional_texture_v15_readonly_gpu_qualification.py")
SPEC = importlib.util.spec_from_file_location("v15_readonly_gpu_gate", SCRIPT)
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)


class V15ReadOnlyGpuGateTest(unittest.TestCase):
    def setUp(self):
        self.candidate_binding = {"path": gate.CONTRACT_PATH, "sha256": "a" * 64}
        self.program_binding = {"path": gate.PROGRAM_PATH, "sha256": "b" * 64}
        self.manifest = {"path": "data/qualified/manifest.json", "sha256": "c" * 64}
        self.cpu_binding = {"path": ".runtime/formal-cpu.json", "sha256": "d" * 64}
        self.policy = {
            "schemaVersion": gate.POLICY_SCHEMA,
            "status": "active_single_readonly_qualification",
            "capabilityVersion": gate.CAPABILITY,
            "candidateContract": self.candidate_binding,
            "cpuQualification": self.cpu_binding,
            "datasetManifest": self.manifest,
            "program": self.program_binding,
            "execution": deepcopy(gate.EXECUTION),
        }
        self.candidate = {
            "schemaVersion": "stage4-mvp-native-rgb-conditional-texture-v15-contract-v1",
            "capabilityVersion": gate.CAPABILITY,
            "datasetBinding": {"manifest": self.manifest,
                               "trainSelectionSha256": "e" * 64},
            "reviewBinding": {"alignmentQualified": True},
            "trainingReviewAlignment": [{} for _ in range(7)],
            "activationGates": {"gpuReadOnlyNow": True, "optimizerNow": False,
                                "trainingNow": False, "runtimeFrameNow": False},
            "trainingBoundNotActivated": {"resolution": [256, 192],
                                          "maxGpuMemoryFraction": 0.7},
        }
        self.cpu = {
            "schemaVersion": "stage4-mvp-conditional-texture-v15-formal-cpu-acceptance-v1",
            "status": gate.CPU_STATUS, "capabilityVersion": gate.CAPABILITY,
            "candidateContract": self.candidate_binding,
            "datasetManifest": self.manifest,
            "trainSelectionSha256": "e" * 64,
            "initialModelStateSha256": "f" * 64,
            "initialDiscriminatorStateSha256": "0" * 64,
            "acceptanceProgram": {"path": "ml/ai-painter/scripts/accept_v15_cpu.py",
                                  "sha256": "1" * 64},
            "acceptanceTests": {"path": "ml/ai-painter/tests/test_accept_v15_cpu.py",
                                "sha256": "2" * 64},
            "formalReviewAlignmentPassed": True,
            "independentAcceptance": True, "optimizerSteps": 0,
            "trainingStarted": False, "gpuUsed": False,
        }
        self.registry = {"activeExecution": None, "registryRevision": 308,
                         "eventSequence": 308}

    def check(self, policy=None, candidate=None, cpu=None, registry=None):
        return gate.validate_gate(policy if policy is not None else self.policy,
                                  candidate if candidate is not None else self.candidate,
                                  cpu if cpu is not None else self.cpu,
                                  registry if registry is not None else self.registry,
                                  candidate_binding=self.candidate_binding,
                                  program_binding=self.program_binding)

    def test_exact_candidate_specific_cpu_acceptance_passes_pure_gate(self):
        self.assertIsNone(self.check())

    def test_cpu_probe_or_other_candidate_cannot_stand_in_for_formal_cpu(self):
        for field, value in (("status", "cpu_readonly_probe_passed_no_execution_authority"),
                             ("candidateContract", {"path": gate.CONTRACT_PATH,
                                                    "sha256": "1" * 64}),
                             ("formalReviewAlignmentPassed", False),
                             ("independentAcceptance", False),
                             ("initialDiscriminatorStateSha256", ""),
                             ("acceptanceProgram", {"path": gate.PROGRAM_PATH,
                                                    "sha256": "1" * 64}),
                             ("optimizerSteps", 1), ("gpuUsed", True)):
            with self.subTest(field=field):
                cpu = deepcopy(self.cpu)
                cpu[field] = value
                with self.assertRaisesRegex(ValueError, "independent formal CPU"):
                    self.check(cpu=cpu)

    def test_resource_training_and_program_policy_tampering_fail(self):
        for section, field, value in (
            ("execution", "maxGpuMemoryFraction", 0.8),
            ("execution", "maxWallSeconds", 121),
            ("execution", "optimizerAllowed", True),
            ("execution", "trainingAllowed", True),
            ("execution", "validationRead", True),
            ("program", "sha256", "1" * 64),
        ):
            with self.subTest(field=field):
                policy = deepcopy(self.policy)
                policy[section][field] = value
                with self.assertRaisesRegex(ValueError, "exact read-only GPU policy"):
                    self.check(policy=policy)

    def test_unaligned_or_training_enabled_candidate_is_rejected(self):
        for section, field, value in (
            ("reviewBinding", "alignmentQualified", False),
            ("activationGates", "gpuReadOnlyNow", False),
            ("activationGates", "optimizerNow", True),
            ("activationGates", "trainingNow", True),
            ("activationGates", "runtimeFrameNow", True),
        ):
            with self.subTest(field=field):
                candidate = deepcopy(self.candidate)
                candidate[section][field] = value
                with self.assertRaisesRegex(ValueError, "formal alignment"):
                    self.check(candidate=candidate)

    def test_active_execution_refuses_probe(self):
        registry = {**self.registry, "activeExecution": {"runId": "another-run"}}
        with self.assertRaisesRegex(ValueError, "another AI Painter execution"):
            self.check(registry=registry)

    def test_absent_policy_fails_before_gpu_worker_or_cuda(self):
        with patch.object(gate, "bind", side_effect=FileNotFoundError("no GPU policy")), \
             patch.object(gate.subprocess, "run") as worker:
            with self.assertRaises(FileNotFoundError):
                gate.run()
            worker.assert_not_called()

    def test_train_reader_never_opens_non_train_rgb_or_conditions(self):
        from PIL import Image
        import torch

        channels = [f"channel_{index}" for index in range(23)]
        channels[14] = "object_instance"
        rows = [{"sampleId": f"sample-{index}",
                 "split": ("train" if index < 48 else "validation" if index < 56
                           else "challenge" if index < 60 else "regression"),
                 "image": {"path": f"rgb/{index}", "sha256": "a" * 64},
                 "conditionPack": {"path": f"pack/{index}", "sha256": "b" * 64}}
                for index in range(64)]
        ids = [row["sampleId"] for row in rows[:48]]
        dataset = {"sourceIndex": {"path": "source", "sha256": "c" * 64},
                   "splits": {"train": {"path": "train", "sha256": "d" * 64}},
                   "trainSelectionSha256": hashlib.sha256(
                       gate.canonical_bytes(rows[:48])).hexdigest()}
        manifest = {"identityPayload": {"channelOrder": channels,
                                        "continuousChannelIds": []}}
        pack = {"channels": [{"id": key, "path": f"channel/{index}",
                              "sha256": "e" * 64} for index, key in enumerate(channels)],
                "objectInstanceTable": []}
        rgb_buffer, gray_buffer = io.BytesIO(), io.BytesIO()
        Image.new("RGB", (1024, 768)).save(rgb_buffer, format="PNG")
        Image.new("L", (1024, 768)).save(gray_buffer, format="PNG")

        def bound(_root, binding):
            return {"source": {"sampleCount": 64, "samples": rows},
                    "train": {"split": "train", "sampleIds": ids},
                    "pack/0": pack}[binding["path"]]

        def read(_root, binding):
            path = binding["path"]
            self.assertTrue(path == "rgb/0" or path.startswith("channel/"), path)
            return rgb_buffer.getvalue() if path == "rgb/0" else gray_buffer.getvalue()

        with patch.object(gate, "bound_json", side_effect=bound), \
             patch.object(gate, "read_bound", side_effect=read):
            sample, order = gate.load_one_train_sample(dataset, manifest)
        self.assertEqual(sample["split"], "train")
        self.assertEqual(order, channels)
        self.assertEqual(tuple(sample["image"].shape), (3, 192, 256))
        self.assertEqual(tuple(sample["conditions"].shape), (23, 192, 256))
        self.assertFalse(torch.cuda.is_initialized())


if __name__ == "__main__":
    unittest.main()
