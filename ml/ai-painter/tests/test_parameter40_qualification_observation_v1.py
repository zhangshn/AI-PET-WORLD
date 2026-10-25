import unittest
from copy import deepcopy
import hashlib
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import Mock, patch
import torch
from torch import nn
from ai_painter.complete_world import parameter40_qualification_observation_v1 as observation
from ai_painter.complete_world.parameter40_qualification_reference_v1 import contrast


class Fixture(nn.Module):
    def __init__(self):
        super().__init__()
        self.layer = nn.Conv2d(192, 96, 3, padding=1)
        self.rows = [("p" + str(i), nn.Parameter(torch.zeros(1))) for i in range(108)]
        self.rows[40] = (observation.NAME, self.layer.weight)
    def named_parameters(self, *args, **kwargs):
        return iter(self.rows)
    def get_submodule(self, name):
        if name != observation.NAME.removesuffix(".weight"):
            raise ValueError("wrong fixture module")
        return self.layer


class SmallObservation(observation.Target40Observation):
    def spatial(self):
        return (3, 4)


class ObservationTests(unittest.TestCase):
    def setUp(self):
        torch.set_num_threads(2)

    def captured(self):
        model = Fixture()
        source = torch.ones(1, 192, 3, 4)
        observer = SmallObservation(model, lambda: None)
        with observer:
            output = model.layer(source)
            parts = [output.sum() * scale for scale in (0.1, 0.2, 0.3, 0.4)]
            for i, loss in enumerate((sum(parts), *parts)):
                observer.event("attempt", "generator")
                value = torch.autograd.grad(loss, model.layer.weight, retain_graph=i < 4)[0]
                rows = [None] * 108
                rows[40] = value
                if i == 0:
                    # Deliberate synthetic bad value: never used in production.
                    rows[40] = value.clone()
                    rows[40][2, 3, 1, 1] += 0.1
                observer.event("complete", "generator", rows)
        return model, observer

    def test_capture_is_bounded_closed_and_explicitly_synthetic(self):
        model, observer = self.captured()
        packet, metadata = observer.compact()
        self.assertEqual(metadata["coordinate"], [2, 3, 1, 1])
        self.assertFalse(metadata["productionGeometry"])
        self.assertEqual(len(packet), 11)
        self.assertLess(observer.bytes, observation.MAX_CAPTURE)
        self.assertFalse(model.layer._forward_hooks)
        self.assertTrue(all(p.grad is None for _, p in model.named_parameters()))

    def test_local_decomposition_preserves_original_packet(self):
        _, observer = self.captured()
        packet, metadata = observer.compact()
        result = contrast(packet, metadata, lambda: None)
        self.assertAlmostEqual(result["observedDifference"], 0.1, places=5)
        self.assertLess(abs(result["reconstructionResidual"]), 1e-12)
        self.assertAlmostEqual(result["terms"]["totalWeightReduction"], 0.1, places=5)
        self.assertEqual(result["localReferenceCount"], 5)
        self.assertFalse(result["modelUpdated"])

    def test_packet_digest_change_rejected(self):
        _, observer = self.captured()
        packet, metadata = observer.compact()
        packet["input"][0, 0, 0, 0] += 1
        with self.assertRaisesRegex(ValueError, "digest"):
            contrast(packet, metadata, lambda: None)

    def test_not_a_real_model_or_wrong_target_rejected(self):
        with self.assertRaises(ValueError):
            observation.Target40Observation(nn.Linear(1, 1), lambda: None)
        model = Fixture()
        model.rows[40] = ("wrong", model.layer.weight)
        with self.assertRaises(ValueError):
            SmallObservation(model, lambda: None)

    def test_incomplete_capture_cannot_be_called_complete(self):
        observer = SmallObservation(Fixture(), lambda: None)
        with observer:
            pass
        with self.assertRaisesRegex(ValueError, "complete"):
            observer.compact()

    def test_parameter_version_mutation_rejected_and_hooks_removed(self):
        model = Fixture()
        observer = SmallObservation(model, lambda: None)
        with self.assertRaisesRegex(ValueError, "changed model"):
            with observer, torch.no_grad():
                model.layer.weight.add_(0)
        self.assertFalse(model.layer._forward_hooks)

    def test_original_exception_is_not_replaced_by_observation_error(self):
        model = Fixture()
        observer = SmallObservation(model, lambda: None)
        with self.assertRaisesRegex(RuntimeError, "original"):
            with observer, torch.no_grad():
                model.layer.weight.add_(0)
                raise RuntimeError("original")
        self.assertIsNotNone(observer.observation_error)
        self.assertFalse(model.layer._forward_hooks)

    def test_duplicate_attempt_rejected(self):
        observer = SmallObservation(Fixture(), lambda: None)
        with observer:
            observer.event("attempt", "generator")
            with self.assertRaisesRegex(ValueError, "duplicate"):
                observer.event("attempt", "generator")

    def test_production_geometry_rejects_small_fixture(self):
        model = Fixture()
        with observation.Target40Observation(model, lambda: None):
            with self.assertRaisesRegex(ValueError, "geometry"):
                model.layer(torch.ones(1, 192, 3, 4))

    def test_capture_ceiling_checked_before_copy(self):
        observer = SmallObservation(Fixture(), lambda: None)
        observer.bytes = observation.MAX_CAPTURE
        with self.assertRaisesRegex(ValueError, "budget"):
            observer.copy(torch.ones(1))

    def test_actual_torch_provider_sources_are_explicitly_bound(self):
        import painter_stage4_decode1_entry_weight_quality_worker_v1 as worker
        root = Path(__file__).absolute().parents[3]
        policy = json.loads((root / "data/ai-painter/system-governance/ai-painter-parameter40-qualification-diagnostic-policy-v3.json").read_text(encoding="utf8"))
        bindings = {b["path"]: b for b in policy["programBindings"]}
        class ProofReader:
            def path(self, logical):
                return root / logical
            def read(self, binding):
                if bindings.get(binding["path"]) != binding:
                    raise ValueError("unregistered provider")
                raw = (root / binding["path"]).read_bytes()
                if hashlib.sha256(raw).hexdigest() != binding["sha256"]:
                    raise ValueError("provider SHA")
                return raw
        for binding in worker._TORCH_SOURCE_BINDINGS.values():
            self.assertEqual(bindings.get(binding["path"]), binding)
        reader = ProofReader()
        for module in (worker._TORCH_OPS, worker._TORCH_CLASSES, worker._TORCH_HIGHER_ORDER):
            self.assertTrue(worker.verify_torch_dynamic_namespace(reader, module))

    def test_omitted_provider_is_rejected_not_treated_as_package_pass(self):
        import painter_stage4_decode1_entry_weight_quality_worker_v1 as worker
        root = Path(__file__).absolute().parents[3]
        class RejectReader:
            def path(self, logical):
                return root / logical
            def read(self, _binding):
                raise ValueError("unregistered provider")
        with self.assertRaisesRegex(ValueError, "unregistered provider"):
            worker.verify_torch_dynamic_namespace(RejectReader(), worker._TORCH_OPS)

    def test_cpu_sample_preflight_checks_loader_result_without_model(self):
        from unittest.mock import patch
        from types import SimpleNamespace
        import diagnose_parameter40_qualification_v1 as diagnostic
        profile = SimpleNamespace(fresh_networks=lambda: self.fail("model constructed"))
        sample = {"sampleId": diagnostic.SAMPLE, "split": "train",
                  "image": torch.zeros(3, 192, 256), "conditions": torch.zeros(23, 192, 256)}
        with patch.object(diagnostic, "load_one", return_value=(sample, list(range(23)))) as loaded:
            result = diagnostic.cpu_sample_preflight(None, None, None, profile, None)
        loaded.assert_called_once()
        self.assertTrue(result["originalLoaderAndEcologyBindingCompleted"])
        self.assertFalse(result["modelConstructed"])

    def test_cpu_sample_preflight_blocks_model_autograd_and_cuda(self):
        from unittest.mock import patch
        from types import SimpleNamespace
        import diagnose_parameter40_qualification_v1 as diagnostic
        profile = SimpleNamespace(fresh_networks=lambda: None)
        for prohibited in (lambda: profile.fresh_networks(), lambda: torch.autograd.grad(None, None),
                           lambda: torch.cuda._lazy_init()):
            with patch.object(diagnostic, "load_one", side_effect=lambda *_: prohibited()):
                with self.assertRaisesRegex(ValueError, "prohibited"):
                    diagnostic.cpu_sample_preflight(None, None, None, profile, None)

    def test_cpu_sample_preflight_rejects_wrong_tensor_geometry(self):
        from unittest.mock import patch
        from types import SimpleNamespace
        import diagnose_parameter40_qualification_v1 as diagnostic
        sample = {"sampleId": diagnostic.SAMPLE, "split": "train",
                  "image": torch.zeros(3, 191, 256), "conditions": torch.zeros(23, 192, 256)}
        with patch.object(diagnostic, "load_one", return_value=(sample, list(range(23)))):
            with self.assertRaisesRegex(ValueError, "geometry"):
                diagnostic.cpu_sample_preflight(None, None, None, SimpleNamespace(fresh_networks=lambda: None), None)


class Fixture0(Fixture):
    def __init__(self):
        nn.Module.__init__(self)
        self.layer = nn.Conv2d(31, 48, 3, padding=1)
        self.rows = [("synthetic." + str(i), nn.Parameter(torch.zeros(1))) for i in range(108)]
        self.rows[0] = (observation.TARGET0_NAME, self.layer.weight)

    def get_submodule(self, name):
        if name != observation.TARGET0_NAME.removesuffix(".weight"):
            raise ValueError("wrong fixture module")
        return self.layer


class SmallObservation0(observation.Target0Observation):
    def spatial(self):
        return (3, 4)


def policy0():
    import diagnose_parameter40_qualification_v1 as diagnostic
    return dict(schemaVersion="parameter40-qualification-diagnostic-policy-v4",
        failureRunId=diagnostic.FAILURE_RUN_V4, sampleId=diagnostic.SAMPLE_V4, sampleOrdinal=17,
        target=dict(index=0, name=observation.TARGET0_NAME, shape=list(observation.TARGET0_SHAPE)),
        modelCapabilityVersion=diagnostic.MODEL_V4, selectedTargetPacketBytes=2097152,
        outputRoot=".runtime/ai-painter/parameter0-qualification-diagnostics-v1")


class Target0Tests(unittest.TestCase):
    def setUp(self):
        torch.set_num_threads(2)

    def captured(self, overflow=None):
        model, source = Fixture0(), torch.ones(1, 31, 3, 4)
        observer = SmallObservation0(model, lambda: None)
        originals = []
        with observer:
            output = model.layer(source)
            parts = [output.sum() * scale for scale in (0.1, 0.2, 0.3, 0.4)]
            for i, loss in enumerate((sum(parts), *parts)):
                observer.event("attempt", "generator")
                value = torch.autograd.grad(loss, model.layer.weight, retain_graph=i < 4)[0]
                value = value.clone()
                if overflow is None:
                    if i == 0:
                        value[2, 3, 1, 1] += 0.1
                else:
                    # Synthetic finite inputs whose ordered FP32 sum overflows.
                    value.zero_()
                    if i in (1, 2):
                        value[0, 0, 0, 0] = overflow * torch.finfo(torch.float32).max
                originals.append((value, value.clone(), observation.signature(value)))
                rows = [None] * 108
                rows[0] = value
                observer.event("complete", "generator", rows)
        return model, observer, originals

    def test_exact_subclass_and_legacy_constants_unchanged(self):
        self.assertTrue(issubclass(observation.Target0Observation, observation.Target40Observation))
        self.assertEqual((observation.INDEX, observation.SHAPE, observation.SPATIAL), (40, (96, 192, 3, 3), (96, 128)))
        self.assertEqual(observation.Target0Observation(Fixture0(), lambda: None).spatial(), (192, 256))

    def test_finite_capture_reference_and_original_gradient_bytes(self):
        model, observer, originals = self.captured()
        packet, meta = observer.compact()
        self.assertEqual(meta["parameterIndex"], 0)
        self.assertEqual(meta["shape"], [48, 31, 3, 3])
        self.assertEqual(meta["coordinate"], [2, 3, 1, 1])
        self.assertTrue(meta["componentSumFinite"])
        self.assertGreater(meta["selectedToleranceRatio"], 1)
        self.assertFalse(meta["productionGeometry"])
        hashes = {key: observation.sha(value) for key, value in packet.items()}
        result = contrast(packet, meta, lambda: None)
        self.assertEqual(result["localReferenceCount"], 5)
        self.assertLess(abs(result["reconstructionResidual"]), 1e-12)
        self.assertAlmostEqual(result["terms"]["totalWeightReduction"], 0.1, places=5)
        self.assertEqual(hashes, {key: observation.sha(value) for key, value in packet.items()})
        for value, before, signature in originals:
            self.assertTrue(torch.equal(value, before))
            self.assertEqual(observation.signature(value), signature)
        self.assertFalse(model.layer._forward_hooks)
        self.assertTrue(all(not hooks for hooks in [getattr(v, "_backward_hooks", None) for v, _, _ in originals]))
        self.assertTrue(all(p.grad is None for _, p in model.named_parameters()))
        json.dumps(meta, allow_nan=False)

    def test_positive_and_negative_sum_overflow_are_evidence_only(self):
        for sign, category in ((1, "positive_infinity"), (-1, "negative_infinity")):
            with self.subTest(category=category):
                _, observer, _ = self.captured(overflow=sign)
                packet, meta = observer.compact()
                self.assertEqual(meta["coordinate"], [0, 0, 0, 0])
                self.assertFalse(meta["componentSumFinite"])
                self.assertEqual(meta["selectedExpected"], {"value": None, "classification": category})
                for key in ("maximumToleranceRatio", "selectedAbsoluteDifference", "selectedAllowedDifference", "selectedToleranceRatio"):
                    self.assertIsNone(meta[key])
                self.assertEqual(len([k for k in packet if k.startswith("gradient.")]), 5)
                self.assertTrue(all(bool(torch.isfinite(packet["gradient." + label]).all()) for label in observation.LABELS))
                with patch("ai_painter.complete_world.parameter40_qualification_reference_v1.math.fsum",
                           side_effect=AssertionError("nonfinite sum must not run local reference")):
                    result = contrast(packet, meta, lambda: None)
                self.assertEqual(result["status"], "evidence_only")
                self.assertEqual(result["localReferenceCount"], 0)
                self.assertFalse(result["componentSumFinite"])
                json.dumps({"metadata": meta, "comparison": result}, allow_nan=False)

    def test_nan_scalar_is_json_null_and_explicit_category(self):
        self.assertEqual(observation.classified_scalar(float("nan")), {"value": None, "classification": "nan"})

    def test_finite_tie_uses_smallest_flat_index(self):
        _, observer, _ = self.captured(overflow=1)
        for row in observer.raw:
            row.zero_()
        observer.raw[0][0, 0, 0, 1] = 0.01
        observer.raw[0][0, 0, 0, 2] = 0.01
        self.assertEqual(observer.compact()[1]["coordinate"], [0, 0, 0, 1])

    def test_nonfinite_sum_skips_earlier_finite_violation_and_selects_first_nonfinite(self):
        _, observer, _ = self.captured(overflow=1)
        for row in observer.raw:
            row.zero_()
        observer.raw[0][0, 0, 0, 1] = 0.01
        for row in observer.raw[1:3]:
            row[0, 0, 0, 2] = torch.finfo(torch.float32).max
            row[0, 0, 1, 0] = torch.finfo(torch.float32).max
        meta = observer.compact()[1]
        self.assertFalse(meta["componentSumFinite"])
        self.assertEqual(meta["coordinate"], [0, 0, 0, 2])
        self.assertEqual(meta["selection"], "first_flattened_nonfinite_component_sum")
        self.assertEqual(meta["nonfiniteSumElements"], 2)
        self.assertEqual(meta["originalOutsideToleranceElements"], 3)
        self.assertEqual(meta["selectedExpected"], {"value": None, "classification": "positive_infinity"})

    def test_no_original_violation_is_not_accepted(self):
        _, observer, _ = self.captured(overflow=1)
        for row in observer.raw:
            row.zero_()
        with self.assertRaisesRegex(ValueError, "did not fail"):
            observer.compact()

    def test_wrong_shape_name_type_and_geometry_are_rejected(self):
        for change in (lambda m: m.rows.__setitem__(0, ("wrong", m.layer.weight)),
                       lambda m: m.rows.__setitem__(0, (observation.TARGET0_NAME, nn.Parameter(torch.zeros(48, 30, 3, 3)))),
                       lambda m: setattr(m.layer, "stride", (2, 2))):
            model = Fixture0()
            change(model)
            with self.assertRaises(ValueError):
                SmallObservation0(model, lambda: None)
        with self.assertRaises(ValueError):
            observation.Target0Observation(Fixture(), lambda: None)
        model = Fixture0()
        with observation.Target0Observation(model, lambda: None):
            with self.assertRaisesRegex(ValueError, "geometry"):
                model.layer(torch.ones(1, 31, 3, 4))
        self.assertFalse(model.layer._forward_hooks)

    def test_normal_and_abnormal_exit_remove_forward_and_tensor_hooks(self):
        for abnormal in (False, True):
            model = Fixture0()
            observer = SmallObservation0(model, lambda: None)
            output = None
            try:
                with observer:
                    output = model.layer(torch.ones(1, 31, 3, 4))
                    if abnormal:
                        raise RuntimeError("primary synthetic failure")
            except RuntimeError as error:
                self.assertTrue(abnormal)
                self.assertEqual(str(error), "primary synthetic failure")
            self.assertFalse(model.layer._forward_hooks)
            self.assertFalse(output._backward_hooks)
            self.assertFalse(observer.handles)

    def test_cleanup_error_cannot_replace_primary_and_other_handles_are_removed(self):
        model = Fixture0()
        observer = SmallObservation0(model, lambda: None)
        removed = Mock()
        with self.assertRaisesRegex(RuntimeError, "primary"):
            with observer:
                observer.handles.extend([SimpleNamespace(remove=removed),
                                         SimpleNamespace(remove=Mock(side_effect=ValueError("cleanup")))])
                raise RuntimeError("primary")
        removed.assert_called_once()
        self.assertIn("cleanup", observer.observation_error)
        self.assertFalse(model.layer._forward_hooks)

    def test_mutation_never_replaces_primary(self):
        model = Fixture0()
        observer = SmallObservation0(model, lambda: None)
        with self.assertRaisesRegex(RuntimeError, "primary"):
            with observer, torch.no_grad():
                model.layer.weight.add_(0)
                raise RuntimeError("primary")
        self.assertIsNotNone(observer.observation_error)
        self.assertFalse(model.layer._forward_hooks)

    def test_workspace_cap_is_checked_before_compact(self):
        _, observer, _ = self.captured()
        observer.bytes = observation.MAX_CAPTURE
        with self.assertRaisesRegex(ValueError, "workspace"):
            observer.compact()

    def test_native_geometry_packet_fits_2mib_and_memory_formula_fits_64mib(self):
        _, observer, _ = self.captured()
        packet, meta = observer.compact()
        # Enlarge only saved synthetic planes, not a model forward or real data.
        for key in ["input", *("adjoint." + label for label in observation.LABELS)]:
            packet[key] = torch.ones(1, 1, 192, 256)
        memory = io.BytesIO()
        torch.save(packet, memory)
        self.assertLessEqual(memory.tell(), 2 * 1024**2)
        shape, spatial = observation.TARGET0_SHAPE, observation.TARGET0_SPATIAL
        import math
        capture = observation.RESERVE + (31 + 5 * 48) * math.prod(spatial) * 4 + 5 * math.prod(shape) * 4
        workspace = 5 * math.prod(shape) * 8 + 3 * math.prod(shape) * 4 + 6 * math.prod(spatial) * 4 + 8 * math.prod(spatial) * 8 + 65536
        self.assertEqual(capture + workspace, 59684480)
        self.assertLessEqual(capture + workspace, observation.MAX_CAPTURE)
        self.assertFalse(meta["productionGeometry"])

    def test_reference_rejects_tampered_identity_classification_and_coordinates(self):
        _, observer, _ = self.captured()
        packet, meta = observer.compact()
        for values in (dict(parameterName="wrong"), dict(shape=[48, 32, 3, 3]),
                       dict(coordinate=[48, 0, 0, 0]), dict(componentSumFinite=False),
                       dict(selectedExpected={"value": None, "classification": "positive_infinity"})):
            with self.assertRaises((ValueError, IndexError)):
                contrast(packet, {**meta, **values}, lambda: None)

    def test_explicit_routes_and_bad_policy_rejection(self):
        import diagnose_parameter40_qualification_v1 as diagnostic
        self.assertEqual(diagnostic.diagnostic_route()["index"], 40)
        self.assertEqual(diagnostic.diagnostic_route(policy0())["index"], 0)
        for field, value in (("failureRunId", "other"), ("sampleId", diagnostic.SAMPLE),
                             ("sampleOrdinal", True), ("sampleOrdinal", 40), ("modelCapabilityVersion", "old"),
                             ("selectedTargetPacketBytes", 8388608), ("outputRoot", "wrong"),
                             ("schemaVersion", "unknown")):
            bad = {**policy0(), field: value}
            with self.assertRaises(ValueError):
                diagnostic.diagnostic_route(bad)

    def test_fresh_factory_is_explicit_and_legacy_default_is_unchanged(self):
        import diagnose_parameter40_qualification_v1 as diagnostic
        model, critic = Fixture0(), object()
        model.capability_version, model.architecture_id, model.numeric_rule = diagnostic.MODEL_V4, "synthetic", "synthetic"
        graph = [dict(name=n, shape=list(v.shape), elements=v.numel(), dtype=str(v.dtype)) for n, v in model.named_parameters()]
        metadata = dict(graph=graph, modelCapabilityVersion=diagnostic.MODEL_V4, architecture="synthetic", numericRule="synthetic")
        profile = SimpleNamespace(fresh_networks=Mock(return_value=(model, critic)))
        self.assertEqual(diagnostic.fresh_bound_networks(profile, ["synthetic"], policy0(), metadata), (model, critic))
        profile.fresh_networks.assert_called_once_with(["synthetic"], model_capability=diagnostic.MODEL_V4)
        profile.fresh_networks.reset_mock()
        diagnostic.fresh_bound_networks(profile, ["synthetic"], None, {})
        profile.fresh_networks.assert_called_once_with(["synthetic"])
        for field in ("architecture_id", "numeric_rule", "capability_version"):
            old = getattr(model, field)
            setattr(model, field, "wrong")
            with self.assertRaises(ValueError):
                diagnostic.fresh_bound_networks(profile, [], policy0(), metadata)
            setattr(model, field, old)
        bad = deepcopy(metadata)
        bad["graph"][1]["name"] = "wrong"
        with self.assertRaises(ValueError):
            diagnostic.validate_fresh_model(model, bad)

    def test_v4_cpu_preflight_is_synthetic_and_blocks_model_and_cuda(self):
        import diagnose_parameter40_qualification_v1 as diagnostic
        sample = dict(sampleId=diagnostic.SAMPLE_V4, split="train", image=torch.zeros(3, 192, 256),
                      conditions=torch.zeros(23, 192, 256))
        profile = SimpleNamespace(fresh_networks=lambda: self.fail("real model forbidden"))
        with patch.object(diagnostic, "load_one", return_value=(sample, list(range(23)))):
            result = diagnostic.cpu_sample_preflight(None, policy0(), None, profile, None)
        self.assertEqual(result["sampleId"], diagnostic.SAMPLE_V4)
        self.assertFalse(result["modelConstructed"])
        for prohibited in (lambda: profile.fresh_networks(), lambda: torch.autograd.grad(None, None), lambda: torch.cuda._lazy_init()):
            with patch.object(diagnostic, "load_one", side_effect=lambda *_: prohibited()):
                with self.assertRaisesRegex(ValueError, "prohibited"):
                    diagnostic.cpu_sample_preflight(None, policy0(), None, profile, None)

    def test_secondary_diagnostic_error_preserves_primary(self):
        import diagnose_parameter40_qualification_v1 as diagnostic
        first = {"type": "ValueError", "message": "original gate"}
        result = dict(originalError=first)
        diagnostic.record_diagnostic_failure(result, RuntimeError("compact or reference failed"))
        self.assertIs(result["originalError"], first)
        self.assertEqual(result["status"], "diagnostic_failed_closed")
        self.assertEqual(result["secondaryDiagnosticErrors"][0]["message"], "compact or reference failed")

    def test_bound_source_rejects_wrong_run_package_model_and_graph(self):
        import diagnose_parameter40_qualification_v1 as diagnostic
        policy = policy0()
        policy.update(sourceModel={"path": "synthetic/model.json", "sha256": "a" * 64},
                      sourceDataClosure={"path": "synthetic/data.json", "sha256": "b" * 64})
        graph = [dict(name="synthetic." + str(i), shape=[1], elements=1, dtype="torch.float32") for i in range(108)]
        graph[0] = dict(name=observation.TARGET0_NAME, shape=[48, 31, 3, 3], elements=13392, dtype="torch.float32")
        graph[-1].update(shape=[2242687 - 13392 - 106], elements=2242687 - 13392 - 106)
        model = dict(capabilityVersion=diagnostic.CAPABILITY_V4, modelCapabilityVersion=diagnostic.MODEL_V4, graph=graph)
        plan = dict(runId=diagnostic.FAILURE_RUN_V4, packageId="synthetic-package", capabilityVersion=diagnostic.CAPABILITY_V4,
                    configuration=dict(objectSupportStructureWeight=1, modelCapabilityVersion=diagnostic.MODEL_V4),
                    modelBinding=policy["sourceModel"], dataClosure=policy["sourceDataClosure"])
        failure = dict(runId=plan["runId"], packageId=plan["packageId"], capabilityVersion=diagnostic.CAPABILITY_V4,
            status="failed_closed", optimizerSteps=0,
            originalError=dict(type="ValueError", message="actual four-term total gradient identity differs at parameter 0"),
            attemptedSample=dict(sampleId=diagnostic.SAMPLE_V4, gradientSetsAvailable=5,
                callCounts=dict(generatorForwards=1, generatorForwardCompleted=1, generatorAutograd=5, discriminatorAutograd=1)))
        self.assertTrue(diagnostic.validate_bound_source(policy, plan, model, failure)["target0"])
        for mutate in (lambda p, m, f: p.update(runId="other"), lambda p, m, f: f.update(packageId="other"),
                       lambda p, m, f: m.update(modelCapabilityVersion="old"),
                       lambda p, m, f: m["graph"][0].update(shape=[48, 30, 3, 3]),
                       lambda p, m, f: p.update(dataClosure={"path": "other"}),
                       lambda p, m, f: f["attemptedSample"]["callCounts"].update(discriminatorAutograd=0)):
            p, m, f = deepcopy(plan), deepcopy(model), deepcopy(failure)
            mutate(p, m, f)
            with self.assertRaises(ValueError):
                diagnostic.validate_bound_source(policy, p, m, f)

    def test_v4_loader_selects_only_ordinal17_and_original_source_chain(self):
        import diagnose_parameter40_qualification_v1 as diagnostic
        import painter_stage4_appearance_regime_probe as seasonal
        policy = {**policy0(), "sourceDiagnostic": {"path": "metadata"}}
        sample_id = diagnostic.SAMPLE_V4
        identity = dict(sampleId=sample_id, split="train", image={"path": "synthetic/image"}, channels=[])
        binding = {"path": "dataset"}
        rows = [{"sampleId": sample_id, "split": "train", "ordinal": 17, "identity": identity},
                {"sampleId": "must-not-load", "split": "train", "ordinal": 18, "identity": {}}]
        ids = ["other-" + str(i) for i in range(48)]
        ids[17] = sample_id
        source = dict(sampleId=sample_id, split="train")
        values = {"metadata": dict(rows=rows, datasetManifest=binding),
            "dataset": dict(sourceIndex={"path": "index"}, identityPayload=dict(channelOrder=list(range(23)), continuousChannelIds=[])),
            "split": {"sampleIds": ids}, "index": {"samples": [source, dict(sampleId="must-not-load", split="train")]}}
        reader = SimpleNamespace(json=lambda b: values[b["path"]])
        loaded = Mock(return_value=({"sampleId": sample_id}, deepcopy(identity)))
        shared = SimpleNamespace(v24=SimpleNamespace(core=SimpleNamespace(cpu=SimpleNamespace(load_sample=loaded))))
        profile = SimpleNamespace(bind_sample_ecology=Mock(return_value={"sampleId": sample_id}))
        with patch.object(seasonal, "derive_regime_record", return_value=({"synthetic": True}, None, None)):
            result, order = diagnostic.load_one(reader, policy, dict(datasetManifest=binding, trainSplit={"path": "split"}), profile, shared)
        self.assertEqual(result["sampleId"], sample_id)
        self.assertEqual(order, list(range(23)))
        loaded.assert_called_once_with(reader, source, list(range(23)), [])
        rows[0]["ordinal"] = 40
        with self.assertRaisesRegex(ValueError, "metadata"):
            diagnostic.load_one(reader, policy, dict(datasetManifest=binding, trainSplit={"path": "split"}), profile, shared)
        self.assertEqual(loaded.call_count, 1)

    def test_authentication_uses_actual_gate_frame_and_same_call_bytes(self):
        import diagnose_parameter40_qualification_v1 as diagnostic
        from ai_painter.complete_world import object_joint_rgb_structure_priority_update_cpu_v1 as gate
        model = Fixture0()
        parameters = tuple(v for _, v in model.named_parameters())
        observation0 = observation.Target0Observation(model, lambda: None)
        sets = [[torch.zeros_like(v) for v in parameters] for _ in range(5)]
        sets[0][0][1, 2, 1, 0] = 0.1
        observation0.raw = [rows[0].clone() for rows in sets]
        programs = {}
        for fn in (gate.apply_object_joint_rgb_structure_priority_update_cpu, gate.require):
            path = Path(fn.__code__.co_filename).absolute()
            programs[path.relative_to(diagnostic.ROOT).as_posix()] = {"sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
        with patch.object(gate, "bind_parameters", return_value=(parameters, {}, 1, 2)), \
             patch.object(gate, "_validate_model_and_parameters", return_value=(parameters, {})):
            try:
                gate.apply_object_joint_rgb_structure_priority_update_cpu(model=model, parameters=parameters,
                    total_gradients=sets[0], structured_gradients=sets[1], whole_frame_gradients=sets[2],
                    core_gradients=sets[3], support_gradients=sets[4])
            except ValueError as caught:
                proof = diagnostic.authenticate_gate(caught, observation0, programs)
                self.assertEqual(proof["parameterIndex"], 0)
                self.assertTrue(proof["sameCallInputsVerified"])
                observation0.raw[0][0, 0, 0, 0] = 1
                with self.assertRaisesRegex(ValueError, "same-call"):
                    diagnostic.authenticate_gate(caught, observation0, programs)
            else:
                self.fail("synthetic gate violation was not observed")
        with self.assertRaisesRegex(ValueError, "traceback"):
            diagnostic.authenticate_gate(ValueError("actual four-term total gradient identity differs at parameter 0"), observation0, programs)

    def test_mocked_original_probe_preserves_order_and_distinct_nonfinite_terminal(self):
        import diagnose_parameter40_qualification_v1 as diagnostic
        import ai_painter.complete_world.parameter40_qualification_reference_v1 as reference
        _, small, _ = self.captured()
        packet, metadata = small.compact()
        metadata["productionGeometry"] = True  # Mock control flow only, never a real admission.
        for nonfinite in (False, True):
            saved = []
            model, critic = SimpleNamespace(to=Mock()), SimpleNamespace(to=Mock())
            state_hash = lambda network: "g" if network is model else "d"
            shared = SimpleNamespace(v24=SimpleNamespace(core=SimpleNamespace(cpu=SimpleNamespace(state_hash=state_hash))))
            counts = {k + s: n for k, n in (("forward", 1), ("generator", 5), ("discriminator", 1)) for s in ("Attempted", "Completed")}
            observer = Mock(counts=counts)
            observer.__enter__ = Mock(return_value=observer)
            observer.__exit__ = Mock(return_value=False)
            def compact():
                self.assertEqual(saved[0], "original-observation.json")
                return packet, metadata
            observer.compact.side_effect = compact
            profile = SimpleNamespace(zero_update_probe=Mock(side_effect=ValueError("actual four-term total gradient identity differs at parameter 0")))
            def save(_output, name, _value, **_options):
                saved.append(name)
                return {"path": "synthetic/" + name, "sha256": "a" * 64}
            def compare(*_args):
                self.assertEqual(saved, ["original-observation.json", "target0-packet.pt", "target0-packet.json"])
                return dict(localReferenceCount=0 if nonfinite else 5, componentSumFinite=not nonfinite)
            result = {}
            with patch.object(diagnostic, "load_one", return_value=({"synthetic": True}, ["order"])), \
                 patch.object(diagnostic, "fresh_bound_networks", return_value=(model, critic)), \
                 patch.object(diagnostic, "validate_fresh_model"), patch.object(diagnostic, "put", side_effect=save), \
                 patch.object(diagnostic, "authenticate_gate", return_value={"sameCallInputsVerified": True}), \
                 patch.object(observation, "Target0Observation", return_value=observer), \
                 patch.object(reference, "contrast", side_effect=compare), \
                 patch.object(torch.cuda, "is_available", return_value=True), patch.object(torch.cuda, "is_bf16_supported", return_value=True), \
                 patch.object(torch.cuda, "set_device"), patch.object(torch.cuda, "set_per_process_memory_fraction"), \
                 patch.object(torch.cuda, "_lazy_init", side_effect=AssertionError("real CUDA forbidden")):
                diagnostic.run_gpu_observation(None, policy0(), {}, dict(initialState={"generator": "g", "discriminator": "d"}),
                    profile, shared, None, {}, lambda: None, result)
            expected = "diagnostic_nonfinite_component_sum_evidence_complete" if nonfinite else "diagnostic_target_evidence_complete"
            self.assertEqual(result["status"], expected)
            self.assertTrue(result["originalGate"]["sameCallInputsVerified"])
            self.assertEqual(profile.zero_update_probe.call_args.kwargs["support_structure_weight"], 1.0)
            profile.zero_update_probe.assert_called_once()
            self.assertFalse(torch.cuda.is_initialized())

    def test_mocked_main_writes_failure_result_after_compact_or_reference_error(self):
        import diagnose_parameter40_qualification_v1 as diagnostic
        for phase in ("compact", "reference"):
            with TemporaryDirectory(prefix="parameter0-synthetic-") as temporary:
                root = Path(temporary)
                policy = policy0()
                run_id = "p0-gpu-synthetic"
                logical = policy["outputRoot"] + "/" + run_id
                output = root / logical
                output.mkdir(parents=True)
                request = dict(policy=dict(path=diagnostic.POLICY_V4, sha256="a" * 64), mode="gpu", runId=run_id,
                               outputRoot=logical, deadlineUnixMs=diagnostic.time.time() * 1000 + 10000)
                def primitive(_request, _policy, _route, out, _resource, _worker, result):
                    result.update(originalError=dict(type="ValueError", message="original synthetic parameter0 gate"))
                    diagnostic.put(out, "original-observation.json", result)
                    raise RuntimeError(phase + " failed")
                with patch.object(diagnostic, "ROOT", root), patch.object(diagnostic, "raw_json", side_effect=[request, policy]), \
                     patch.object(diagnostic, "execute_request", side_effect=primitive), \
                     patch.object(diagnostic.sys, "argv", ["synthetic", "--request", "synthetic.json", "--request-sha256", "a" * 64]), \
                     patch("builtins.print"):
                    diagnostic.main()
                original = json.loads((output / "original-observation.json").read_text())
                result = json.loads((output / "worker-result.json").read_text())
                self.assertEqual(result["status"], "diagnostic_failed_closed")
                self.assertEqual(result["originalError"], original["originalError"])
                self.assertEqual(result["secondaryDiagnosticErrors"][0]["message"], phase + " failed")
                self.assertFalse(torch.cuda.is_initialized())

    def test_original_probe_state_guard_preserves_cpu_rng_modes_flags_and_primary(self):
        import painter_stage4_decode1_entry_weight_training_profile_v1 as profile
        model, critic = nn.Linear(1, 1), nn.Linear(1, 1)
        before = torch.get_rng_state().clone()
        primary = ValueError("synthetic primary")
        with self.assertRaisesRegex(ValueError, "synthetic primary"):
            with profile._probe_state(model, critic, torch.device("cpu")):
                critic.eval().requires_grad_(False)
                torch.rand(1)  # The unchanged guard must reject, then restore this RNG mutation.
                raise primary
        self.assertTrue(critic.training)
        self.assertTrue(all(p.requires_grad and p.grad is None for p in critic.parameters()))
        self.assertTrue(torch.equal(before, torch.get_rng_state()))
        self.assertTrue(any("RNG" in error for error in primary.secondary_probe_errors))
        self.assertFalse(torch.cuda.is_initialized())

    def test_mocked_main_archives_primitive_setup_failure(self):
        import diagnose_parameter40_qualification_v1 as diagnostic
        with TemporaryDirectory(prefix="parameter0-synthetic-") as temporary:
            root, policy = Path(temporary), policy0()
            run_id = "p0-cpu-synthetic"
            logical = policy["outputRoot"] + "/" + run_id
            output = root / logical
            output.mkdir(parents=True)
            request = dict(policy=dict(path=diagnostic.POLICY_V4, sha256="a" * 64), mode="cpu", runId=run_id,
                           outputRoot=logical, deadlineUnixMs=diagnostic.time.time() * 1000 + 10000)
            with patch.object(diagnostic, "ROOT", root), patch.object(diagnostic, "raw_json", side_effect=[request, policy]), \
                 patch.object(diagnostic, "execute_request", side_effect=KeyError("synthetic missing input")), \
                 patch.object(diagnostic.sys, "argv", ["synthetic", "--request", "synthetic.json", "--request-sha256", "a" * 64]), \
                 patch("builtins.print"):
                diagnostic.main()
            result = json.loads((output / "worker-result.json").read_text())
            self.assertEqual(result["status"], "diagnostic_failed_closed")
            self.assertEqual(result["originalError"]["type"], "KeyError")
            self.assertTrue(all(n == 0 for n in result["actualCounts"].values()))


if __name__ == "__main__":
    unittest.main()
