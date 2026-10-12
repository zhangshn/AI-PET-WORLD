"""Memory-only state checks; zero forward, autograd, optimizer or CUDA calls.

Checkpoint counts and ranking are synthetic metadata, not actual optimization
or evidence of qualification. The owning native batch runs these tests.
"""
from copy import deepcopy
import hashlib
import io
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

import torch

ROOT = Path(__file__).absolute().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import painter_stage4_v24_dry_single_world_checkpoint_worker as shared
from ai_painter.complete_world import ecology_quality_checkpoint_v1 as codec
from ai_painter.complete_world import object_ecology_regime_conditioned as training
from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator

ORDER = tuple("terrain_grass terrain_water terrain_path_ground terrain_shoreline terrain_natural_boundary terrain_mud_patch terrain_tall_grass walkable collision object_footprints object_tree object_rock object_vegetation focal_area object_instance coordinate_x coordinate_y signed_distance_path signed_distance_water signed_distance_shoreline signed_distance_object_ground signed_distance_boundary moisture_proximity".split())


class ByteReader:
    def __init__(self):
        self.files = {path: (ROOT / path).read_bytes() for path in (codec.CANDIDATE_PATH, codec.SPEC_PATH)}
        self.observed = {}
        self.unchanged_calls = 0

    def binding(self, path):
        return {"path": path, "sha256": hashlib.sha256(self.files[path]).hexdigest()}

    def read(self, binding):
        raw = self.files[binding["path"]]
        if hashlib.sha256(raw).hexdigest() != binding["sha256"]:
            raise ValueError("reader source SHA differs")
        self.observed[binding["path"]] = raw
        return raw

    def unchanged(self):
        self.unchanged_calls += 1
        if any(self.files[path] != raw for path, raw in self.observed.items()):
            raise ValueError("reader bytes changed")


def configuration():
    """Actual fixed configuration with synthetic package/run fixture bindings.

    This fixture does not authenticate a production source binding. It serves
    only memory codec checks and the owning lifecycle's simulated schedule.
    """
    reader = ByteReader()
    value = codec.derive_configuration(reader, reader.binding(codec.CANDIDATE_PATH), reader.binding(codec.SPEC_PATH))
    # Exact actual candidate identity; these tests still grant no qualification.
    return value


def selection(epoch=12):
    return {"epoch": epoch, "worstApplicableObjectCorrelation": .1, "meanValidationRgbMae": .2,
            "applicableImageCounts": {role: 1 for role in shared.OBJECT_CHANNELS},
            "rank": [.1, -.2, -epoch], "qualificationGranted": False, "checkpointPromotionEligible": False}


def serialize(payload):
    stream = io.BytesIO()
    torch.save(payload, stream)
    return stream.getvalue()


class ConfigurationTests(unittest.TestCase):
    def test_current_authority_bytes_and_original_candidate_validator(self):
        reader = ByteReader()
        with patch.object(shared, "validate_candidate_contract", wraps=shared.validate_candidate_contract) as validator:
            value = codec.derive_configuration(reader, reader.binding(codec.CANDIDATE_PATH), reader.binding(codec.SPEC_PATH))
        validator.assert_called_once()
        self.assertEqual(reader.unchanged_calls, 1)
        self.assertEqual(value["formalSpecification"]["sha256"], codec.SPEC_SHA)
        self.assertEqual(value["executionCeiling"]["maxWallSeconds"], 2700)
        self.assertEqual(value["checkpointSelection"]["eligibleEpochs"], [12])
        self.assertEqual(value["optimizer"], shared.v24.core.TRAINING["optimizer"])
        self.assertEqual(value["capabilityVersion"], codec.CAPABILITY)

    def test_authority_binding_and_bytes_cannot_be_self_reported(self):
        reader = ByteReader()
        candidate, spec = reader.binding(codec.CANDIDATE_PATH), reader.binding(codec.SPEC_PATH)
        for bad in ({**spec, "sha256": "a" * 64}, {**spec, "path": "docs/history/spec.md"}):
            with self.assertRaises(ValueError):
                codec.derive_configuration(reader, candidate, bad)
        for binding in ({**candidate, "path": "data/other.json"}, {**candidate, "sha256": "a" * 64}):
            with self.assertRaises(ValueError):
                codec.derive_configuration(reader, binding, spec)
        # Even a reader returning bytes under a claimed SHA cannot grant identity.
        with patch.object(reader, "read", side_effect=[reader.files[codec.CANDIDATE_PATH], b"AI-PAINTER-SPEC-1.52 9.6.37 9.6.38"]):
            with self.assertRaisesRegex(ValueError, "quality formal bytes"):
                codec.derive_configuration(reader, candidate, spec)

    def test_candidate_rejection_and_source_change_fail_closed(self):
        reader = ByteReader()
        candidate = json.loads(reader.files[codec.CANDIDATE_PATH])
        candidate["activation"]["trainingAllowed"] = True
        reader.files[codec.CANDIDATE_PATH] = json.dumps(candidate).encode()
        with self.assertRaisesRegex(ValueError, "quality source candidate"):
            codec.derive_configuration(reader, reader.binding(codec.CANDIDATE_PATH), reader.binding(codec.SPEC_PATH))
        reader = ByteReader()
        def changed():
            reader.files[codec.SPEC_PATH] += b"\n"
            ByteReader.unchanged(reader)
        with patch.object(reader, "unchanged", side_effect=changed):
            with self.assertRaisesRegex(ValueError, "bytes changed"):
                codec.derive_configuration(reader, reader.binding(codec.CANDIDATE_PATH), reader.binding(codec.SPEC_PATH))

    def test_configuration_fields_types_and_no_budget_expansion(self):
        base = configuration()
        for key, value in (("schema", "detail-weight-managed-configuration-v1"), ("capabilityVersion", "old"),
                           ("seed", True), ("gpuAdmissionSeconds", 601), ("automaticResumeAllowed", True),
                           ("historicalCheckpointMayInitialize", True), ("freshInitializationOnly", False),
                           ("optimizer", {}), ("dataUse", {}), ("scope", {}), ("checkpointSelection", {})):
            with self.subTest(key=key), self.assertRaises(ValueError):
                codec.validate_configuration({**base, key: value})
        for key in ("maxWallSeconds", "epochs", "trainingAttempts"):
            bad = deepcopy(base)
            bad["executionCeiling"][key] = 4200 if key == "maxWallSeconds" else 49
            with self.assertRaises(ValueError):
                codec.validate_configuration(bad)
        bad = deepcopy(base)
        bad["scope"]["worldCount"] = True
        with self.assertRaises(ValueError):
            codec.validate_configuration(bad)
        for bad in (None, {}, {**base, "verified": True}):
            with self.assertRaises(ValueError):
                codec.validate_configuration(bad)

    def test_original_rank_counts_epochs_and_binding_paths(self):
        base = configuration()
        for epoch in (12,):
            codec.validate_selection(base, "synthetic-run", epoch, selection(epoch),
                                     {"generator": epoch * 48, "discriminator": epoch * 48})
        for counts in ({"generator": True, "discriminator": 576}, {"generator": 576., "discriminator": 576},
                       {"generator": 575, "discriminator": 576}, {"generator": 576, "discriminator": 577},
                       {"generator": 576, "discriminator": 576, "verified": True}):
            with self.assertRaises(ValueError):
                codec.validate_selection(base, "synthetic-run", 12, selection(), counts)
        for key, value in (("rank", [.1, -.2, -48]), ("epoch", 36), ("meanValidationRgbMae", float("nan")),
                           ("rank", [.1, -.2, -12.]),
                           ("qualificationGranted", True), ("checkpointPromotionEligible", True),
                           ("applicableImageCounts", {role: 0 for role in shared.OBJECT_CHANNELS})):
            with self.assertRaises(ValueError):
                codec.validate_selection(base, "synthetic-run", 12, {**selection(), key: value},
                                         {"generator": 576, "discriminator": 576})
        for epoch in (True, 23, 49, 24.):
            with self.assertRaises(ValueError):
                codec.validate_selection(base, "synthetic-run", epoch, selection(), {"generator": 576, "discriminator": 576})
        for path in ("../outside", "/outside", "C:/outside", "a//b", "a\\b", "a/./b"):
            with self.assertRaises(ValueError):
                codec.exact_binding({"path": path, "sha256": "a" * 64})


class CheckpointTests(unittest.TestCase):
    def setUp(self):
        self.threads = torch.get_num_threads()
        torch.set_num_threads(2)
        self.addCleanup(torch.set_num_threads, self.threads)
        self.rng = torch.random.get_rng_state().clone()
        self.addCleanup(torch.random.set_rng_state, self.rng)
        self.model = training.build_fresh_object_ecology_regime_conditioned(condition_channel_order=ORDER)
        with torch.device("cpu"), torch.random.fork_rng(devices=[]):
            self.critic = build_conditional_texture_discriminator()
        self.kw = dict(configuration=configuration(), run_id="synthetic-t-q4-70",
                       package_binding={"path": ".runtime/synthetic/package.json", "sha256": "a" * 64},
                       dataset_binding={"path": "data/synthetic/manifest.json", "sha256": "b" * 64},
                       epoch=12, selection=selection(), counts={"generator": 576, "discriminator": 576},
                       program_bindings={"worker": {"path": "synthetic/worker.py", "sha256": "c" * 64}},
                       plan_binding={"path": "synthetic/quality-plan.json", "sha256": "d" * 64})
        self.raw = codec.encode(self.model, self.critic, **self.kw)
        self.payload = torch.load(io.BytesIO(self.raw), map_location="cpu", weights_only=True)

    def load(self, payload=None, **changes):
        return codec.reload(self.raw if payload is None else serialize(payload), model=self.model,
                            critic=self.critic, **{**self.kw, **changes})

    def snapshot(self):
        return [{key: value.detach().clone() for key, value in network.state_dict().items()}
                for network in (self.model, self.critic)]

    def unchanged(self, before):
        for network, saved in zip((self.model, self.critic), before):
            self.assertEqual(list(network.state_dict()), list(saved))
            for name, value in network.state_dict().items():
                self.assertTrue(torch.equal(value.reshape(-1).view(torch.uint8),
                                            saved[name].reshape(-1).view(torch.uint8)), name)

    def changed_payload(self):
        value = deepcopy(self.payload)
        for group in ("generator", "discriminator"):
            names = [name for name, tensor in value[group].items() if tensor.is_floating_point()]
            for name in names[:2]:
                value[group][name].add_(.25)
        return value

    def test_full_graph_safe_cpu_round_trip_without_qualification_or_rng_change(self):
        self.assertEqual(len(self.payload["graph"]["generator"]), 108)
        self.assertEqual(sum(p.numel() for p in self.model.parameters()), 2242687)
        self.assertEqual(len(self.payload["graph"]["discriminator"]), 14)
        self.assertEqual({name for name in self.payload["generator"] if name.endswith("identity")},
                         {"regime_identity", "numeric_identity", "ecology_identity"})
        rng = torch.random.get_rng_state().clone()
        with torch.no_grad():
            next(self.model.parameters()).add_(.5)
            next(self.critic.parameters()).add_(.5)
        result = self.load()
        self.assertEqual(result, {"modelStateLoaded": True, "automaticResumeAllowed": False, "checkpointQualified": False})
        self.unchanged([self.payload["generator"], self.payload["discriminator"]])
        self.assertTrue(torch.equal(rng, torch.random.get_rng_state()))
        self.assertTrue(all(t.device.type == "cpu" for group in ("generator", "discriminator")
                            for t in self.payload[group].values()))

    def test_metadata_and_self_reported_qualification_rejected_before_any_load(self):
        before = self.snapshot()
        cases = (("schema", "detail-weight-managed-checkpoint-v1"), ("capabilityVersion", "old"),
                 ("architecture", "old"), ("numericRule", "old"), ("configurationSha256", "0" * 64),
                 ("runId", "other"), ("executionPackage", {**self.kw["package_binding"], "sha256": "c" * 64}),
                 ("datasetManifest", {**self.kw["dataset_binding"], "sha256": "c" * 64}),
                 ("selection", {**selection(), "meanValidationRgbMae": .3, "rank": [.1, -.3, -12]}),
                 ("counts", {"generator": 576., "discriminator": 576}), ("epoch", 24.),
                 ("graph", {}), ("checkpointQualified", True), ("automaticResumeAllowed", True))
        with patch.object(self.model, "load_state_dict", wraps=self.model.load_state_dict) as g_load, \
                patch.object(self.critic, "load_state_dict", wraps=self.critic.load_state_dict) as d_load:
            for key, value in cases:
                with self.subTest(key=key), self.assertRaises(ValueError):
                    self.load({**self.payload, key: value})
                self.unchanged(before)
            bad = deepcopy(self.payload)
            bad["configuration"]["optimizer"] = {}
            with self.assertRaises(ValueError):
                self.load(bad)
            for key in ("verified", "sourceVerified", "executionQualified"):
                with self.assertRaises(ValueError):
                    self.load({**self.payload, key: True})
            g_load.assert_not_called()
            d_load.assert_not_called()

    def test_wrong_expected_bindings_configuration_counts_and_rank(self):
        before = self.snapshot()
        for changes in ({"run_id": "other"}, {"run_id": " "},
                        {"package_binding": {**self.kw["package_binding"], "sha256": "c" * 64}},
                        {"dataset_binding": {**self.kw["dataset_binding"], "path": "data/other.json"}},
                        {"configuration": {**self.kw["configuration"], "seed": 1}},
                        {"counts": {"generator": 575, "discriminator": 576}},
                        {"selection": {**selection(), "rank": [.2, -.2, -12]}}):
            with self.assertRaises(ValueError):
                self.load(**changes)
            self.unchanged(before)

    def test_both_state_payloads_complete_finite_dtype_shape_and_layout_preflight(self):
        before = self.snapshot()
        with patch.object(self.model, "load_state_dict", wraps=self.model.load_state_dict) as g_load, \
                patch.object(self.critic, "load_state_dict", wraps=self.critic.load_state_dict) as d_load:
            for group in ("generator", "discriminator"):
                name = next(k for k, v in self.payload[group].items() if v.ndim >= 2 and v.is_floating_point())
                for kind in ("missing", "extra", "order", "dtype", "shape", "nan", "inf", "noncontiguous", "requires_grad"):
                    bad = deepcopy(self.payload)
                    state = bad[group]
                    if kind == "missing":
                        del state[name]
                    elif kind == "extra":
                        state["unexpected"] = torch.zeros(1)
                    elif kind == "order":
                        state[name] = state.pop(name)
                    elif kind == "dtype":
                        state[name] = state[name].double()
                    elif kind == "shape":
                        state[name] = state[name].flatten()[:1]
                    elif kind in ("nan", "inf"):
                        state[name].flatten()[0] = float(kind)
                    elif kind == "noncontiguous":
                        state[name] = state[name].transpose(0, 1).contiguous().transpose(0, 1)
                    else:
                        state[name].requires_grad_(True)
                    with self.subTest(group=group, kind=kind), self.assertRaises(ValueError):
                        self.load(bad)
                    self.unchanged(before)
            g_load.assert_not_called()
            d_load.assert_not_called()

    def test_old_and_cpu_prototype_identity_buffers_and_states_rejected(self):
        from ai_painter.complete_world import object_ecology_regime_prototype_cpu as prototype
        from ai_painter.complete_world import object_appearance_regime_detail_weight_precision as old
        before = self.snapshot()
        for name in ("regime_identity", "numeric_identity", "ecology_identity"):
            bad = deepcopy(self.payload)
            bad["generator"][name][0] ^= 1
            with self.assertRaises(ValueError):
                self.load(bad)
            self.unchanged(before)
        for source in (prototype, old):
            bad = deepcopy(self.payload)
            bad["generator"]["numeric_identity"] = source.identity_bytes("numeric")
            if source is prototype:
                bad["generator"]["ecology_identity"] = prototype.identity_bytes("ecology")
            else:
                del bad["generator"][training.ECOLOGY_PARAMETER]
                del bad["generator"]["ecology_identity"]
            with self.assertRaises(ValueError):
                self.load(bad)
            self.unchanged(before)

    def test_wrong_live_graph_and_forged_flags_cannot_grant_identity(self):
        before = self.snapshot()
        with patch.object(self.model, "capability_version", "old"), \
                patch.object(self.model, "execution_qualified", True):
            with self.assertRaises(ValueError):
                codec.encode(self.model, self.critic, **self.kw)
        self.unchanged(before)
        # An extra D parameter must fail even if no payload graph was altered.
        self.critic.register_parameter("extra", torch.nn.Parameter(torch.zeros(1)))
        try:
            with self.assertRaisesRegex(ValueError, "discriminator full graph"):
                codec.encode(self.model, self.critic, **self.kw)
        finally:
            del self.critic.extra
        self.unchanged(before)

    def test_late_generator_hook_restores_both_original_bytes_without_hook_retry(self):
        self._late_hook_failure(self.model, "generator")

    def test_late_discriminator_hook_restores_both_original_bytes_without_hook_retry(self):
        self._late_hook_failure(self.critic, "discriminator")

    def _late_hook_failure(self, network, label):
        payload = self.changed_payload()
        before = self.snapshot()
        calls = []
        primary = RuntimeError("late " + label + " load hook")
        def hook(_network, _incompatible):
            calls.append(label)
            # Prove the hook runs after actual state installation.
            name, parameter = next(iter(network.named_parameters()))
            self.assertTrue(torch.equal(parameter, payload[label][name]))
            self.assertFalse(torch.equal(parameter, before[0 if network is self.model else 1][name]))
            other = self.critic if network is self.model else self.model
            with torch.no_grad():
                next(other.parameters()).add_(.125)
            raise primary
        handle = network.register_load_state_dict_post_hook(hook)
        try:
            with self.assertRaises(RuntimeError) as caught:
                self.load(payload)
            self.assertIs(caught.exception, primary)
            self.assertEqual(calls, [label])
            self.unchanged(before)
        finally:
            handle.remove()

    def test_noop_and_partial_loaders_cannot_report_success(self):
        payload = self.changed_payload()
        for group, network in (("generator", self.model), ("discriminator", self.critic)):
            for partial in (False, True):
                before = self.snapshot()
                def loader(state, **_kw):
                    if partial:
                        name = next(k for k, v in state.items() if v.is_floating_point())
                        with torch.no_grad():
                            network.state_dict()[name].copy_(state[name])
                with patch.object(network, "load_state_dict", side_effect=loader) as mocked:
                    with self.subTest(group=group, partial=partial), self.assertRaisesRegex(ValueError, group + " installed tensor differs"):
                        self.load(payload)
                    mocked.assert_called_once()
                self.unchanged(before)

    def test_byte_bounds_and_missing_envelope_field(self):
        before = self.snapshot()
        for raw in (b"", bytearray(self.raw)):
            with self.assertRaises(ValueError):
                codec.reload(raw, model=self.model, critic=self.critic, **self.kw)
        bad = dict(self.payload)
        del bad["configurationSha256"]
        with self.assertRaises(ValueError):
            self.load(bad)
        self.unchanged(before)

    def test_codec_calls_no_forward_autograd_or_optimizer(self):
        # Sentinels cover the codec itself; no model execution is needed to test
        # complete graph/state serialization or loading.
        with patch.object(torch.nn.Module, "__call__", side_effect=AssertionError("forward forbidden")), \
                patch.object(torch.autograd, "grad", side_effect=AssertionError("autograd forbidden")), \
                patch.object(torch.Tensor, "backward", side_effect=AssertionError("backward forbidden")), \
                patch.object(torch.optim.Adam, "step", side_effect=AssertionError("optimization forbidden")):
            raw = codec.encode(self.model, self.critic, **self.kw)
            result = codec.reload(raw, model=self.model, critic=self.critic, **self.kw)
        self.assertFalse(result["checkpointQualified"])
