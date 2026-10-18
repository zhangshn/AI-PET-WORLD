"""Small synthetic storage fixtures; no model, real Run, or GPU execution."""

import hashlib
import json
import os
from pathlib import Path
import random
import tempfile
import unittest
from unittest.mock import patch

import torch

from ai_painter.complete_world import training_preview_observer_v1 as memory
from ai_painter.complete_world import training_preview_storage_v1 as storage


class StorageCpuTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="training-preview-storage-synthetic-")
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root, self.data = self.base / "project", self.base / "data"
        self.root.mkdir()
        (self.data / "hot/runtime").mkdir(parents=True)
        self.environment = patch.dict(os.environ, {"AI_PET_WORLD_DATA_ROOT": str(self.data)})
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.mapping = storage.files.RuntimeMap.current(self.root)
        self.run_id, self.package_id = "synthetic-preview-run", "synthetic-preview-package"
        version = getattr(self, "preview_policy_version", 2)
        paths = {2: storage.POLICY_PATH, 3: storage.POLICY_V3_PATH, 4: storage.POLICY_V4_PATH, 5: storage.POLICY_V5_PATH}
        self.policy_path = paths[version]
        self.capability = "synthetic-capability" if version == 2 else storage.JOINT_CAPABILITY if version >= 4 else storage.FINAL_RGB_CAPABILITY
        self.model_capability = "synthetic-model" if version == 2 else storage.FINAL_RGB_MODEL_CAPABILITY
        self.run = (storage.RUN_PREFIX if version == 2 else storage.JOINT_RUN_PREFIX if version >= 4 else storage.FINAL_RGB_RUN_PREFIX) + self.run_id
        self.policy_programs = {
            "component": self.put(storage.COMPONENT_PATH, Path(memory.__file__).read_bytes()),
            "storage": self.put(storage.STORAGE_PATH, Path(storage.__file__).read_bytes()),
        }
        project = Path(storage.__file__).parents[5]
        # A private synthetic v5 fixture can use the immutable v4 record/resource
        # template before final policy registration; it never edits project JSON.
        template = self.policy_path if version != 5 else storage.POLICY_V4_PATH
        self.policy = json.loads((project / template).read_bytes())
        if version == 5:
            self.policy["schemaVersion"] = "ai-painter-training-preview-observation-policy-v5"
        for key, bound in self.policy["programBindings"].items():
            self.policy_programs[key] = self.put(bound["path"], (project / bound["path"]).read_bytes())
        for role, logical in self.policy["implementationPaths"].items():
            self.policy_programs[role] = self.put(logical, (project / logical).read_bytes())
        # Synthetic source adoption exercises the sink, not real policy registration.
        # Controller must separately bind these frozen bytes in the real policy.
        self.policy["programBindings"]["storage"] = self.policy_programs["storage"]
        self.policy["programBindings"]["storageTests"] = self.policy_programs["storageTests"]
        self.policy_binding = self.put(self.policy_path, self.policy)
        self.rgb = self.put("data/synthetic/source.png", b"synthetic original source bytes, never a model prediction")
        self.facts = self.put("data/synthetic/facts.json", {"worldId": "synthetic-world", "tick": 7})
        self.task = self.put("data/synthetic/task.json", dict(worldId="synthetic-world", tick=7,
            sourceBindings=dict(naturalizedWorldFactsPath=self.facts["path"], naturalizedWorldFactsSha256=self.facts["sha256"])))
        self.condition = self.put("data/synthetic/condition.json", dict(worldId="synthetic-world", tick=7,
            sourceBindings=dict(taskPackagePath=self.task["path"])))
        contribution = self.put("data/synthetic/contribution.json", dict(taskPackagePath=self.task["path"], taskPackageSha256=self.task["sha256"]))
        self.ids = [f"synthetic-sample-{index:02d}" for index in range(48)]
        index = self.put("data/synthetic/index.json", {"samples": [dict(sampleId=sample, split="train",
            image=self.rgb, conditionPack=self.condition, contribution=contribution) for sample in self.ids]})
        self.dataset = self.put("data/synthetic/dataset.json", {"sourceIndex": index})
        self.split = self.put("data/synthetic/train.json", {"sampleIds": self.ids})
        self.model = self.put(self.run + "/model-identity.json", dict(capabilityVersion=self.capability,
            modelCapabilityVersion=self.model_capability))
        self.plan = dict(runId=self.run_id, packageId=self.package_id, outputRoot=self.run,
            trainingPreviewPolicy=self.policy_binding,
            capabilityVersion=self.capability, configuration=dict(modelCapabilityVersion=self.model_capability,
            trainingPreviewPolicy=self.policy_binding), programBindings=self.policy_programs,
            modelBinding=self.model, datasetManifest=self.dataset, trainSplit=self.split)
        if version == 5:
            from ai_painter.complete_world import joint_object_priority_quality_checkpoint_v1 as execution
            self.execution_policy = self.put(execution.POLICY["path"], (project / execution.POLICY["path"]).read_bytes())
            self.plan["executionPolicy"] = self.execution_policy
            self.plan["configuration"] = execution.expected_configuration(self.policy_binding)
        while len(self.plan["programBindings"]) < getattr(self, "source_binding_count", 0):
            # Count-boundary fixture aliases existing immutable bytes. Real
            # execution source uniqueness is checked independently by auth.
            self.plan["programBindings"]["syntheticCount" + str(len(self.plan["programBindings"]))] = dict(self.policy_programs["component"])
        self.rebind()
        self.frame = torch.linspace(0, 1, 3 * 192 * 256, dtype=torch.float32).reshape(1, 3, 192, 256)

    def put(self, logical, value):
        raw = value if type(value) is bytes else storage.canonical(value) + b"\n"
        path = self.mapping.path(logical)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)
        return dict(path=logical, sha256=hashlib.sha256(raw).hexdigest())

    def rebind(self):
        self.plan_binding = self.put(self.run + "/quality-plan.json", self.plan)
        self.package = dict(schemaVersion="ai-painter-autonomous-closed-loop-package-v1",
            packageIdentity=self.package_id, capabilityVersion=self.plan["capabilityVersion"],
            programLineage={k: v["sha256"] for k, v in self.plan["programBindings"].items()},
            inputEvidence=[self.policy_binding, self.plan_binding, self.model, self.dataset, self.split])
        if hasattr(self, "execution_policy"):
            self.package["inputEvidence"].append(self.execution_policy)
        self.package_binding = self.put(".runtime/ai-painter/autonomous-closed-loop-packages/" + self.package_id + "/package.json", self.package)

    def sink(self, **kwargs):
        return storage.TrainingPreviewStorage(self.root, policy=self.policy_binding, plan=self.plan_binding,
            execution_package=self.package_binding, **kwargs)

    def identity(self, epoch=1, ordinal=0, **changes):
        def b(value):
            return memory.Binding(value["path"], value["sha256"])
        values = dict(run_id=self.run_id, package_id=self.package_id, capability_version=self.capability,
            model_capability_version=self.model_capability, epoch=epoch, train_ordinal=ordinal, train_index=0,
            sample_id=self.ids[0], generator_updates=(epoch - 1) * 48 + ordinal,
            discriminator_updates=(epoch - 1) * 48 + ordinal + 1, forward_sequence=epoch,
            execution_package=b(self.package_binding), plan=b(self.plan_binding), model=b(self.model),
            dataset_manifest=b(self.dataset), source_rgb=b(self.rgb), condition_pack=b(self.condition),
            world_facts=b(self.facts), configuration_sha256=storage._digest(storage.canonical(self.plan["configuration"])),
            program_bindings_sha256=storage._digest(storage.canonical(self.plan["programBindings"])))
        values.update(changes)
        return memory.PreviewIdentity(**values)

    def capture(self, sink, frame=None, identity=None, **kwargs):
        return sink.capture(self.frame if frame is None else frame, self.identity() if identity is None else identity,
                            world_id=kwargs.get("world_id", "synthetic-world"), tick=kwargs.get("tick", 7))

    def read(self, bound):
        return json.loads(self.mapping.binding(bound))

    def test_normal_record_progress_entry_and_once_terminal_manifest(self):
        sink = self.sink()
        entry = self.capture(sink)
        self.assertEqual(set(entry), {"record", "image"})
        record = self.read(entry["record"])
        self.assertEqual(record["schemaVersion"], storage.RECORD_SCHEMA)
        self.assertEqual(record["purpose"], "not_reviewed_diagnostic_only")
        self.assertEqual(record["optimizerSteps"], dict(generator=0, discriminator=1))
        self.assertEqual(record["modelBinding"], self.model)
        self.assertEqual(record["worldFacts"], self.facts)
        self.assertEqual(record["worldId"], "synthetic-world")
        self.assertEqual(record["tick"], 7)
        for field in ("formalOutput", "checkpointSelectionEligible", "qualificationEvidence", "runtimePublicationEligible"):
            self.assertIs(record[field], False)
        png = self.mapping.binding(entry["image"])
        self.assertEqual(record["image"], dict(entry["image"], bytes=len(png)))
        self.assertTrue(png.startswith(b"\x89PNG\r\n\x1a\n"))
        self.assertNotIn("proposal", record)
        self.assertEqual(list(sink.directory.glob("*.pending")), [])
        bound = sink.finish()
        self.assertEqual(self.read(bound)["entries"], [entry])
        self.assertEqual(sink.finish(), bound)
        self.assertIsNone(self.capture(sink, identity=self.identity(2)))

    def test_no_extra_forward_autograd_tensor_or_rng_change(self):
        sink = self.sink()
        before, version = self.frame.clone(), self.frame._version
        torch_rng, py_rng = torch.get_rng_state().clone(), random.getstate()
        blocked = AssertionError("training or CUDA operation forbidden")
        with patch.object(torch.nn.Module, "_call_impl", side_effect=blocked), \
             patch.object(torch.autograd, "grad", side_effect=blocked), \
             patch.object(torch.autograd, "backward", side_effect=blocked), \
             patch.object(torch.cuda, "_lazy_init", side_effect=blocked):
            self.assertIsNotNone(self.capture(sink))
        self.assertTrue(torch.equal(before, self.frame))
        self.assertEqual(self.frame._version, version)
        self.assertTrue(torch.equal(torch_rng, torch.get_rng_state()))
        self.assertEqual(py_rng, random.getstate())
        self.assertFalse(torch.cuda.is_initialized())

    def test_encoding_failure_disables_without_raising_or_rewriting(self):
        sink = self.sink()
        invalid = self.frame.clone()
        invalid[0, 0, 0, 0] = float("nan")
        self.assertIsNone(self.capture(sink, frame=invalid))
        self.assertIsNotNone(sink.secondary_error)
        self.assertEqual(sink.secondary_error["availabilityCode"], "capture_failed")
        self.assertIsNone(self.capture(sink, identity=self.identity(2)))
        manifest = self.read(sink.finish())
        self.assertEqual(manifest["entries"], [])
        self.assertIn("secondaryError", manifest)
        self.assertEqual(list(sink.directory.glob("*.png")), [])

    def test_source_binding_is_recomputed_not_trusted_sha_syntax(self):
        sink = self.sink()
        self.mapping.path(self.rgb["path"]).write_bytes(b"tampered source")
        self.assertIsNone(self.capture(sink))
        self.assertIn("SHA", sink.secondary_error["message"])
        self.assertEqual(sink.secondary_error["availabilityCode"], "binding_mismatch")
        self.assertEqual(sink.entries, [])

    def test_cross_run_world_sample_configuration_and_model_rejected(self):
        bad = [dict(run_id="other-synthetic-run"), dict(sample_id=self.ids[1]),
               dict(configuration_sha256="0" * 64), dict(program_bindings_sha256="0" * 64),
               dict(model=memory.Binding(self.model["path"], "0" * 64)),
               dict(world_facts=memory.Binding(self.facts["path"], "0" * 64))]
        for changes in bad:
            sink = self.sink()
            self.assertIsNone(self.capture(sink, identity=self.identity(**changes)))
            self.assertEqual(sink.entries, [])
        for kwargs in (dict(world_id="other-world"), dict(tick=8), dict(tick=True)):
            sink = self.sink()
            self.assertIsNone(self.capture(sink, **kwargs))

    def test_24_frames_one_per_epoch_and_manifest_size(self):
        sink = self.sink()
        self.frame = torch.rand(self.frame.shape, generator=torch.Generator(device="cpu").manual_seed(20261016))
        for epoch in range(1, 25):
            self.assertIsNotNone(self.capture(sink, identity=self.identity(epoch)))
            self.assertIsNone(self.capture(sink, frame=object(), identity=self.identity(epoch)))
            self.assertIsNone(self.capture(sink, frame=object(), identity=self.identity(epoch, 1)))
        bound = sink.finish()
        raw = self.mapping.binding(bound)
        self.assertLessEqual(len(raw), storage.MANIFEST_MAX)
        self.assertEqual(len(json.loads(raw)["entries"]), 24)
        self.assertEqual(len(list(sink.directory.glob("*.png"))), 24)
        self.assertGreater((sink.directory / "epoch-0024.png").stat().st_size, 140 * 1024)
        self.assertLessEqual(sink.measured_bytes()[1], memory.PREVIEW_BYTES)

    def test_failure_reference_retains_capture_identity_and_original_error(self):
        sink = self.sink()
        entry = self.capture(sink)
        error = ValueError("original training first error")
        original = error.args
        position = dict(epoch=2, zeroBasedEpochPosition=11, trainIndex=23, sampleId=self.ids[23])
        manifest = self.read(sink.finish(training_error=error, failure_position=position))
        ref = self.read(manifest["failureReference"])
        self.assertEqual(ref["capture"], entry)
        self.assertEqual(ref["failurePosition"], position)
        self.assertIs(ref["imageIsFailureForward"], False)
        self.assertIs(ref["regenerated"], False)
        self.assertEqual(error.args, original)
        self.assertEqual(self.read(entry["record"])["epoch"], 1)
        self.assertEqual(len(list(sink.directory.glob("*.png"))), 1)

    def test_no_capture_has_no_failure_image_or_reference(self):
        sink = self.sink()
        manifest = self.read(sink.finish(training_error=RuntimeError("failed before forward")))
        self.assertEqual(manifest["entries"], [])
        self.assertNotIn("failureReference", manifest)
        self.assertEqual(list(sink.directory.glob("*.png")), [])

    def test_write_interrupt_preserves_partial_and_disables(self):
        sink = self.sink()
        with patch.object(storage.os, "fsync", side_effect=OSError("synthetic interrupted write")):
            self.assertIsNone(self.capture(sink))
        pending = sink.directory / "epoch-0001.png.pending"
        self.assertTrue(pending.exists())
        used = sink.measured_bytes()[1]
        self.assertGreater(used, 0)
        self.assertEqual(sink.secondary_error["availabilityCode"], "publication_incomplete")
        self.assertIsNone(self.capture(sink, identity=self.identity(2)))
        self.assertEqual(sink.measured_bytes()[1], used)
        self.assertEqual(self.read(sink.finish())["entries"], [])
        self.assertTrue(pending.exists())

    def test_record_commit_failure_never_publishes_partial_pair(self):
        sink = self.sink()
        link = storage.os.link
        def interrupted(source, target):
            if str(target).endswith("epoch-0001.json"):
                raise OSError("synthetic record commit interruption")
            return link(source, target)
        with patch.object(storage.os, "link", side_effect=interrupted):
            self.assertIsNone(self.capture(sink))
        self.assertTrue((sink.directory / "epoch-0001.png").exists())
        self.assertTrue((sink.directory / "epoch-0001.json.pending").exists())
        self.assertFalse((sink.directory / "epoch-0001.json").exists())
        self.assertEqual(sink.entries, [])
        self.assertEqual(self.read(sink.finish())["entries"], [])
        self.assertEqual(sink.secondary_error["availabilityCode"], "publication_incomplete")

    def test_budget_shortage_preserves_all_existing_reserves(self):
        used = storage.files.directory_bytes(self.mapping.path(self.run))
        sink = self.sink(maximum_output_bytes=storage._RESERVES + used + storage.MANIFEST_MAX + memory.MAX_METADATA_BYTES)
        self.assertIsNone(self.capture(sink))
        self.assertEqual(sink.entries, [])
        self.assertIn("reserves", sink.secondary_error["message"])
        self.assertEqual(sink.secondary_error["availabilityCode"], "budget_exhausted")
        self.assertFalse(sink.directory.exists())

    def test_real_preview_directory_meter_counts_failed_and_foreign_files(self):
        sink = self.sink()
        entry = self.capture(sink)
        self.assertIsNotNone(entry)
        blocker = sink.directory / "retained-partial.bin"
        with blocker.open("xb") as stream:
            stream.truncate(memory.PREVIEW_BYTES)
        self.assertIsNone(self.capture(sink, identity=self.identity(2)))
        self.assertEqual(len(sink.entries), 1)
        self.assertTrue(blocker.exists())
        self.assertIn("ceiling", sink.secondary_error["message"])

    def test_registration_requires_actual_policy_plan_source_and_package(self):
        self.mapping.path(self.policy_binding["path"]).write_bytes(b"{}")
        with self.assertRaises(ValueError):
            self.sink()

    def test_policy_cannot_raise_budget_or_invent_loaded_source_identity(self):
        for key, value in (("maxPreviewBytes", 8 * 1024 * 1024), ("reservedFailureTensorBytes", 0)):
            original = self.policy["resources"][key]
            self.policy["resources"][key] = value
            self.policy_binding = self.put(storage.POLICY_PATH, self.policy)
            self.plan["configuration"]["trainingPreviewPolicy"] = self.policy_binding
            self.plan["trainingPreviewPolicy"] = self.policy_binding
            self.rebind()
            with self.assertRaisesRegex(ValueError, "resource boundary"):
                self.sink()
            self.policy["resources"][key] = original

    def test_existing_preview_subtree_cannot_be_adopted_or_overwritten(self):
        sink = self.sink()
        entry = self.capture(sink)
        original = self.mapping.binding(entry["image"])
        with self.assertRaisesRegex(ValueError, "no resume"):
            self.sink()
        self.assertEqual(self.mapping.binding(entry["image"]), original)

    def test_mapping_environment_change_fails_optional_preview(self):
        sink = self.sink()
        with patch.dict(os.environ, {"AI_PET_WORLD_DATA_ROOT": str(self.base / "changed")}):
            self.assertIsNone(self.capture(sink))
        self.assertEqual(sink.entries, [])
        self.assertIsNotNone(sink.secondary_error)

    def test_failure_reference_write_error_preserves_first_error_and_manifest(self):
        sink = self.sink()
        entry = self.capture(sink)
        error = RuntimeError("first training failure")
        link = storage.os.link
        def interrupted(source, target):
            if str(target).endswith("failure-reference.json"):
                raise OSError("secondary failure reference write")
            return link(source, target)
        with patch.object(storage.os, "link", side_effect=interrupted):
            bound = sink.finish(training_error=error, failure_position=dict(epoch=2,
                zeroBasedEpochPosition=0, trainIndex=0, sampleId=self.ids[0]))
        manifest = self.read(bound)
        self.assertEqual(manifest["entries"], [entry])
        self.assertIn("secondaryError", manifest)
        self.assertNotIn("failureReference", manifest)
        self.assertEqual(manifest["secondaryError"]["availabilityCode"], "publication_incomplete")
        self.assertEqual(str(error), "first training failure")

    def test_control_termination_is_not_swallowed(self):
        sink = self.sink()
        with patch.object(sink.observer, "observe", side_effect=KeyboardInterrupt):
            with self.assertRaises(KeyboardInterrupt):
                self.capture(sink)

    def test_exception_formatting_failure_cannot_escape_into_training(self):
        class BrokenError(Exception):
            def __str__(self):
                raise ValueError("secondary formatting error")
        sink = self.sink()
        with patch.object(sink.observer, "observe", side_effect=BrokenError()):
            self.assertIsNone(self.capture(sink))
        self.assertEqual(sink.secondary_error["message"], "preview exception formatting failed")

    def test_stale_committed_png_cannot_gain_a_terminal_manifest(self):
        sink = self.sink()
        entry = self.capture(sink)
        self.mapping.path(entry["image"]["path"]).write_bytes(b"changed PNG")
        self.assertIsNone(sink.finish())
        self.assertFalse((sink.directory / "manifest.json").exists())
        self.assertIsNotNone(sink.secondary_error)
        self.assertEqual(sink.secondary_error["availabilityCode"], "binding_mismatch")

    def test_availability_is_selected_by_program_stage_never_exception_text(self):
        sink = self.sink()
        with patch.object(sink, "_identity", side_effect=ValueError("capture failed; budget exhausted")):
            self.assertIsNone(self.capture(sink))
        self.assertEqual(sink.secondary_error["availabilityCode"], "binding_mismatch")
        sink = self.sink()
        with patch.object(sink.observer, "observe", side_effect=ValueError("SHA binding mismatch; budget exhausted")):
            self.assertIsNone(self.capture(sink))
        self.assertEqual(sink.secondary_error["availabilityCode"], "capture_failed")
        sink = self.sink()
        with patch.object(sink, "_budget", side_effect=storage._BudgetExhausted("encoding failed")):
            self.assertIsNone(self.capture(sink))
        self.assertEqual(sink.secondary_error["availabilityCode"], "budget_exhausted")
        sink = self.sink()
        with patch.object(storage.os, "fsync", side_effect=OSError("SHA mismatch; budget exhausted")):
            self.assertIsNone(self.capture(sink))
        self.assertEqual(sink.secondary_error["availabilityCode"], "publication_incomplete")
        self.assertTrue((sink.directory / "epoch-0001.png.pending").exists())

    def test_atomic_publication_does_not_swallow_process_control_exit(self):
        sink = self.sink()
        with patch.object(storage.os, "fsync", side_effect=SystemExit(17)):
            with self.assertRaises(SystemExit) as raised:
                self.capture(sink)
        self.assertEqual(raised.exception.code, 17)
        self.assertIsNone(sink.secondary_error)

    def test_terminal_counts_already_saved_64mib_failure_once_without_releasing_training_reserves(self):
        sink = self.sink()
        entry = self.capture(sink)
        evidence = self.mapping.path(self.run + "/gradient-failure/synthetic-saved-evidence.bin")
        evidence.parent.mkdir()
        with evidence.open("xb") as stream:
            stream.write(b"synthetic saved failure evidence")
            stream.truncate(memory.CAPTURE_RESERVED_BYTES)
        before = evidence.stat()
        with self.assertRaises(storage._BudgetExhausted):
            sink._budget(1)  # While capture is open the full old reserves still apply.
        error = RuntimeError("original training failure after saved evidence")
        bound = sink.finish(training_error=error, failure_position=dict(epoch=1,
            zeroBasedEpochPosition=1, trainIndex=1, sampleId=self.ids[1]))
        self.assertIsNotNone(bound)
        manifest = self.read(bound)
        self.assertEqual(manifest["entries"], [entry])
        self.assertIn("failureReference", manifest)
        self.assertEqual(str(error), "original training failure after saved evidence")
        self.assertEqual((evidence.stat().st_ino, evidence.stat().st_size), (before.st_ino, before.st_size))
        used, preview = sink.measured_bytes()
        self.assertLessEqual(used + memory.TERMINAL_RESERVED_BYTES, memory.TOTAL_BYTES)
        self.assertLessEqual(preview, memory.PREVIEW_BYTES)
        self.assertIsNone(self.capture(sink, identity=self.identity(2)))
        with self.assertRaisesRegex(ValueError, "only bounded terminal metadata"):
            sink._atomic(sink.preview_root + "/epoch-0002.png", b"not allowed", tail=0)
        self.assertFalse((sink.directory / "epoch-0002.png").exists())

    def test_terminal_cannot_consume_existing_64kib_worker_terminal_reserve(self):
        sink = self.sink()
        self.capture(sink)
        used, _ = sink.measured_bytes()
        sink.maximum = used + memory.TERMINAL_RESERVED_BYTES
        self.assertIsNone(sink.finish())
        self.assertEqual(sink.secondary_error["availabilityCode"], "budget_exhausted")
        self.assertFalse((sink.directory / "manifest.json").exists())
        self.assertLessEqual(sink.measured_bytes()[0] + memory.TERMINAL_RESERVED_BYTES, sink.maximum)

    def test_v3_exact_policy_root_and_real_candidate_identity(self):
        case = StorageCpuTests("test_normal_record_progress_entry_and_once_terminal_manifest")
        case.preview_policy_version = 3
        case.setUp()
        try:
            sink = case.sink()
            entry = case.capture(sink)
            self.assertIsNotNone(entry)
            record = case.read(entry["record"])
            self.assertEqual(record["capabilityVersion"], storage.FINAL_RGB_CAPABILITY)
            self.assertTrue(entry["image"]["path"].startswith(storage.FINAL_RGB_RUN_PREFIX))
            self.assertEqual(record["policy"]["path"], storage.POLICY_V3_PATH)
            case.plan["capabilityVersion"] = "synthetic-capability"
            case.rebind()
            with self.assertRaisesRegex(ValueError, "v3 exact final RGB"):
                case.sink()
        finally:
            case.doCleanups()

    def test_v5_joint_260_and_261_rejection_preserve_record_and_budget_abi(self):
        for count in (260, 261):
            case = StorageCpuTests("test_normal_record_progress_entry_and_once_terminal_manifest")
            case.preview_policy_version = 5
            case.source_binding_count = count
            case.setUp()
            try:
                if count == 261:
                    with self.assertRaisesRegex(ValueError, "program lineage"):
                        case.sink()
                else:
                    sink = case.sink()
                    entry = case.capture(sink)
                    self.assertIsNotNone(entry)
                    record = case.read(entry["record"])
                    self.assertEqual(record["schemaVersion"], storage.RECORD_SCHEMA)
                    self.assertEqual(record["policy"]["path"], storage.POLICY_V5_PATH)
                    self.assertEqual(record["capabilityVersion"], storage.JOINT_CAPABILITY)
                    self.assertEqual(sink.maximum, memory.TOTAL_BYTES)
                    self.assertEqual(case.policy["resources"]["maxPreviewBytes"], memory.PREVIEW_BYTES)
            finally:
                case.doCleanups()

    def test_old_preview_versions_still_reject_257(self):
        for version in (2, 3, 4):
            case = StorageCpuTests("test_normal_record_progress_entry_and_once_terminal_manifest")
            case.preview_policy_version = version
            case.source_binding_count = 257
            case.setUp()
            try:
                with self.assertRaisesRegex(ValueError, "program lineage"):
                    case.sink()
            finally:
                case.doCleanups()

    def test_v5_requires_real_execution_v2_binding_and_exact_original_limits(self):
        from ai_painter.complete_world import joint_object_priority_quality_checkpoint_v1 as execution
        case = StorageCpuTests("test_normal_record_progress_entry_and_once_terminal_manifest")
        case.preview_policy_version = 5
        case.setUp()
        try:
            case.plan["executionPolicy"] = {**execution.POLICY, "sha256": "a" * 64}
            case.rebind()
            with self.assertRaisesRegex(ValueError, "trusted execution policy"):
                case.sink()
            case.plan["executionPolicy"] = case.execution_policy
            value = case.read(case.execution_policy)
            value["executionCeiling"]["maxWallSeconds"] += 1
            wrong = case.put(execution.POLICY["path"], value)
            case.execution_policy = wrong
            case.plan["executionPolicy"] = case.plan["configuration"]["executionPolicy"] = wrong
            case.rebind()
            with self.assertRaisesRegex(ValueError, "trusted execution policy"):
                case.sink()
        finally:
            case.doCleanups()

    def test_v3_cannot_cross_into_old_run_root_or_use_v2_schema(self):
        case = StorageCpuTests("test_normal_record_progress_entry_and_once_terminal_manifest")
        case.preview_policy_version = 3
        case.setUp()
        try:
            case.policy["schemaVersion"] = storage.POLICY_SCHEMA
            case.policy_binding = case.put(storage.POLICY_V3_PATH, case.policy)
            case.plan["trainingPreviewPolicy"] = case.plan["configuration"]["trainingPreviewPolicy"] = case.policy_binding
            case.rebind()
            with self.assertRaisesRegex(ValueError, "schema"):
                case.sink()
            case.policy["schemaVersion"] = "ai-painter-training-preview-observation-policy-v3"
            case.policy_binding = case.put(storage.POLICY_V3_PATH, case.policy)
            case.plan["trainingPreviewPolicy"] = case.plan["configuration"]["trainingPreviewPolicy"] = case.policy_binding
            case.plan["outputRoot"] = storage.RUN_PREFIX + case.run_id
            case.rebind()
            with self.assertRaisesRegex(ValueError, "output binding"):
                case.sink()
        finally:
            case.doCleanups()

    def test_policy_must_bind_the_actual_loaded_storage_source(self):
        fake = self.put(storage.STORAGE_PATH, b"# invented storage source\n")
        self.policy_programs["storage"] = fake
        self.policy["programBindings"]["storage"] = fake
        self.policy_binding = self.put(storage.POLICY_PATH, self.policy)
        self.plan["configuration"]["trainingPreviewPolicy"] = self.policy_binding
        self.plan["trainingPreviewPolicy"] = self.policy_binding
        self.rebind()
        with self.assertRaisesRegex(ValueError, "actual loaded preview source"):
            self.sink()

    def test_plan_and_configuration_policy_bindings_both_required_and_equal(self):
        expected = self.policy_binding
        for root_value, config_value in ((None, expected), (expected, None), (None, None),
                (dict(expected, sha256="0" * 64), expected),
                (expected, dict(expected, sha256="0" * 64))):
            with self.subTest(root=root_value, configuration=config_value):
                self.plan.pop("trainingPreviewPolicy", None)
                self.plan["configuration"].pop("trainingPreviewPolicy", None)
                if root_value is not None:
                    self.plan["trainingPreviewPolicy"] = root_value
                if config_value is not None:
                    self.plan["configuration"]["trainingPreviewPolicy"] = config_value
                self.rebind()
                with self.assertRaisesRegex(ValueError, "plan and configuration"):
                    self.sink()
        self.plan["trainingPreviewPolicy"] = self.plan["configuration"]["trainingPreviewPolicy"] = expected
        self.rebind()
        self.assertIsNotNone(self.capture(self.sink()))

    def test_policy_omitting_storage_binding_is_rejected_even_with_plan_source(self):
        self.policy["programBindings"].pop("storage")
        self.policy_binding = self.put(storage.POLICY_PATH, self.policy)
        self.plan["trainingPreviewPolicy"] = self.plan["configuration"]["trainingPreviewPolicy"] = self.policy_binding
        self.rebind()
        with self.assertRaisesRegex(ValueError, "source not bound in policy and plan"):
            self.sink()

    def test_policy_omitting_storage_tests_is_rejected(self):
        self.policy["programBindings"].pop("storageTests")
        self.policy_binding = self.put(storage.POLICY_PATH, self.policy)
        self.plan["trainingPreviewPolicy"] = self.plan["configuration"]["trainingPreviewPolicy"] = self.policy_binding
        self.rebind()
        with self.assertRaisesRegex(ValueError, "storage test source"):
            self.sink()

    def test_package_must_include_policy_and_actual_source_lineage(self):
        self.package["inputEvidence"].remove(self.policy_binding)
        self.package_binding = self.put(self.package_binding["path"], self.package)
        with self.assertRaisesRegex(ValueError, "omits"):
            self.sink()

    def test_source_carrier_metadata_preserves_existing_reader_contract(self):
        source_index = self.read(self.read(self.dataset)["sourceIndex"])
        source_index["samples"][0]["image"]["width"] = 1024
        source_index["samples"][0]["conditionPack"]["format"] = "synthetic-condition-carrier"
        index = self.put("data/synthetic/index.json", source_index)
        self.dataset = self.put("data/synthetic/dataset.json", {"sourceIndex": index})
        self.plan["datasetManifest"] = self.dataset
        self.rebind()
        self.assertIsNotNone(self.capture(self.sink()))

    def test_actual_world_id_may_contain_colons_and_tick_may_be_zero(self):
        world = "world:synthetic:region-01"
        self.facts = self.put(self.facts["path"], dict(worldId=world, tick=0))
        self.task = self.put(self.task["path"], dict(worldId=world, tick=0,
            sourceBindings=dict(naturalizedWorldFactsPath=self.facts["path"], naturalizedWorldFactsSha256=self.facts["sha256"])))
        self.condition = self.put(self.condition["path"], dict(worldId=world, tick=0,
            sourceBindings=dict(taskPackagePath=self.task["path"])))
        contribution = self.put("data/synthetic/contribution.json", dict(taskPackagePath=self.task["path"], taskPackageSha256=self.task["sha256"]))
        index = self.put("data/synthetic/index.json", {"samples": [dict(sampleId=sample, split="train",
            image=self.rgb, conditionPack=self.condition, contribution=contribution) for sample in self.ids]})
        self.dataset = self.put(self.dataset["path"], {"sourceIndex": index})
        self.plan["datasetManifest"] = self.dataset
        self.rebind()
        entry = self.capture(self.sink(), world_id=world, tick=0)
        self.assertIsNotNone(entry)
        self.assertEqual(self.read(entry["record"])["worldId"], world)
        self.assertEqual(self.read(entry["record"])["tick"], 0)

    def test_preexisting_target_is_never_overwritten(self):
        sink = self.sink()
        sink._directory()
        target = sink.directory / "epoch-0001.png"
        target.write_bytes(b"existing evidence")
        self.assertIsNone(self.capture(sink))
        self.assertEqual(target.read_bytes(), b"existing evidence")
        self.assertTrue((sink.directory / "epoch-0001.png.pending").exists())
        self.assertEqual(sink.entries, [])

    def test_invalid_failure_position_is_secondary_and_preserves_committed_entries(self):
        sink = self.sink()
        entry = self.capture(sink, identity=self.identity(2))
        error = RuntimeError("original")
        manifest = self.read(sink.finish(training_error=error, failure_position=dict(
            epoch=1, zeroBasedEpochPosition=0, trainIndex=0, sampleId=self.ids[0])))
        self.assertEqual(manifest["entries"], [entry])
        self.assertIn("secondaryError", manifest)
        self.assertNotIn("failureReference", manifest)
        self.assertEqual(str(error), "original")


if __name__ == "__main__":
    unittest.main()
