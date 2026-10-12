"""T-Q4-69-TEST: synthetic CPU contracts for AI-PAINTER-SPEC-1.51 §9.6.37.

No sample pixels, validation data, training, optimizer or production checkpoint.
The controller runs this module once in its serial managed CPU worker. COUNTS
is cumulative for the entire imported batch, including failed call attempts;
it deliberately survives test/class boundaries and is never reset here.
"""
from contextlib import ExitStack
from copy import deepcopy
import hashlib
import io
import json
from pathlib import Path
import unittest
from unittest.mock import patch

import torch

from ai_painter.complete_world import object_ecology_regime_input_cpu as inputs
from ai_painter.complete_world import object_ecology_regime_prototype_cpu as api
from ai_painter.complete_world import object_appearance_regime_detail_weight_precision as old
from ai_painter.complete_world import object_appearance_regime_bias_precision as seasonal
from ai_painter.complete_world.object_appearance_regime_input_cpu import SEASONS, encode_season
from ai_painter.complete_world.native_rgb_complete_support_partition_v23_cpu import ROLES
from test_object_appearance_regime_conditioned_cpu import ORDER, scene
from test_check_stage4_mvp256_dry_appearance_regime_cpu import metadata_fixture
from test_rgb_bias_reduction_precision_cpu import same_bytes


EXPECTED_ECOLOGIES = (
    "bamboo-grove", "dry-dipterocarp-woodland", "forested-low-mountain",
    "grassland-forest-transition", "seasonal-evergreen-semi-evergreen-forest",
    "tropical-forest-glade", "wet-season-drainage-hollow",
)
ECOLOGY_WEIGHT = "core.core.appearance.base.layers.0.ecology_branch.weight"
COUNTS = {
    "generatorForwardsAttempted": 0, "generatorForwardsCompleted": 0,
    "generatorGradCallsAttempted": 0, "generatorGradCallsCompleted": 0,
    "discriminatorForwardsAttempted": 0, "discriminatorGradCallsAttempted": 0,
    "optimizerConstructionsAttempted": 0, "optimizerUpdatesAttempted": 0,
    "cudaCallsAttempted": 0,
}
LIMITS = {"generatorForwardsAttempted": 64, "generatorGradCallsAttempted": 16}


def _attempt(key):
    # Reject BEFORE dispatch; do not let test selection/retry replenish quota.
    if key in LIMITS and COUNTS[key] >= LIMITS[key]:
        raise RuntimeError("synthetic batch budget exhausted: " + key)
    COUNTS[key] += 1


def _json_bytes(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"),
                      ensure_ascii=True, allow_nan=False).encode("utf-8")


def _sha(raw):
    return hashlib.sha256(raw).hexdigest()


class SyntheticSourceReader:
    """Only fixture JSON bytes; the sole disk read is the canonical CODE module.

    Independent sorted JSON hashes agree with the existing canonical algorithm
    for this ASCII-only fixture. bound_regime still invokes the real Node
    canonicalSha256 implementation; neither it nor subprocess.run is mocked.
    """

    def __init__(self, root, values):
        self.root = Path(root)
        # metadata_fixture shares a few dictionaries across nominal files.
        # Real JSON files cannot alias: isolate each document before mutation.
        self.values = {path: deepcopy(value) for path, value in values.items()}
        self.reads = {}
        self.program_reads = []

    def json(self, binding):
        path = binding["path"]
        self.reads[path] = self.reads.get(path, 0) + 1
        raw = _json_bytes(self.values[path])
        if _sha(raw) != binding["sha256"]:
            raise ValueError("synthetic exact file SHA differs: " + path)
        return json.loads(raw)

    def snapshot(self, path):
        if path != "scripts/lib/real-earth-region-governance.mjs":
            raise ValueError("fixture cannot access project data: " + path)
        raw = (self.root / path).read_bytes()
        self.program_reads.append(path)
        return raw, {"path": path, "sha256": _sha(raw)}


def _bind_fixture(reader, record):
    """Rebind synthetic file bytes separately from canonical region payload."""
    region = reader.values["regionSourcePackage.json"]
    for stem, key in (("seasonSnapshot", "seasonSnapshot"),
                      ("worldProfile", "regionalProfile"),
                      ("sourceRegistry", "sourceRegistry")):
        digest = _sha(_json_bytes(reader.values[record[key]["path"]]))
        region["sourceProvenance"][stem + "Sha256"] = digest
    payload = {key: value for key, value in region.items() if key != "packageSha256"}
    canonical = _sha(_json_bytes(payload))
    region["packageSha256"] = canonical
    record["regionSourcePackage"]["taskBoundCanonicalPackageSha256"] = canonical
    source = reader.values["taskPackage.json"]["sourceBindings"]
    source["realEarthRegionSourcePackageSha256"] = canonical
    for key in ("seasonSnapshot", "regionalProfile"):
        source[key + "Sha256"] = _sha(_json_bytes(reader.values[record[key]["path"]]))
    for binding in record.values():
        binding["sha256"] = _sha(_json_bytes(reader.values[binding["path"]]))


def source_fixture(category=EXPECTED_ECOLOGIES[0], season=SEASONS[0]):
    legacy_reader, record, values = metadata_fixture()
    reader = SyntheticSourceReader(legacy_reader.root, values)
    for path, ecology_key, material_key in (
        ("conditionPack.json", "ecologyPlan", "materialPlan"),
        ("taskPackage.json", "singleMapEcologyPlan", "singleMapMaterialPlan"),
    ):
        container = reader.values[path]["categoricalConditions" if path.startswith("condition") else "directorPlan"]
        container[ecology_key]["landscapeType"] = category
        container[ecology_key]["season"] = season
        container[material_key]["season"] = season
    reader.values["seasonSnapshot.json"]["environment"]["season"] = season
    _bind_fixture(reader, record)
    return reader, record


class CpuContractCase(unittest.TestCase):
    def setUp(self):
        threads = torch.get_num_threads()
        self.addCleanup(torch.set_num_threads, threads)
        torch.set_num_threads(2)
        self.rng = torch.random.get_rng_state().clone()
        self.addCleanup(torch.random.set_rng_state, self.rng)
        self.backend = self.backend_state()
        self.addCleanup(self.restore_backend, self.backend)
        self.context = (seasonal._REGIME.get(), api._ECOLOGY.get())
        self.addCleanup(seasonal._REGIME.reset, seasonal._REGIME.set(self.context[0]))
        self.addCleanup(api._ECOLOGY.reset, api._ECOLOGY.set(self.context[1]))
        stack = ExitStack()
        self.addCleanup(stack.close)
        native_grad = torch.autograd.grad

        def grad(*args, **kwargs):
            _attempt("generatorGradCallsAttempted")
            value = native_grad(*args, **kwargs)
            COUNTS["generatorGradCallsCompleted"] += 1
            return value

        def forbidden(key):
            def fail(*_args, **_kwargs):
                _attempt(key)
                raise AssertionError("forbidden synthetic operation: " + key)
            return fail

        stack.enter_context(patch.object(torch.autograd, "grad", grad))
        stack.enter_context(patch.object(torch.autograd, "backward", forbidden("generatorGradCallsAttempted")))
        stack.enter_context(patch.object(torch.optim.Optimizer, "__init__", forbidden("optimizerConstructionsAttempted")))
        stack.enter_context(patch.object(torch.optim.Optimizer, "step", forbidden("optimizerUpdatesAttempted")))
        for name in ("_lazy_init", "manual_seed_all", "manual_seed", "init"):
            stack.enter_context(patch.object(torch.cuda, name, forbidden("cudaCallsAttempted")))

    @staticmethod
    def backend_state():
        return (torch.are_deterministic_algorithms_enabled(),
                torch.is_deterministic_algorithms_warn_only_enabled(),
                torch.backends.mkldnn.enabled, torch.backends.mkldnn.deterministic,
                torch.get_num_threads(), torch.is_autocast_enabled("cpu"))

    @staticmethod
    def restore_backend(before):
        # Assert invariance in tearDown first; cleanup only prevents a failed
        # test from contaminating later tests and never hides its failure.
        torch.use_deterministic_algorithms(before[0], warn_only=before[1])
        torch.backends.mkldnn.enabled = before[2]
        torch.backends.mkldnn.deterministic = before[3]
        torch.set_num_threads(before[4])

    def tearDown(self):
        self.assertTrue(same_bytes(self.rng, torch.random.get_rng_state()), "CPU RNG changed")
        self.assertEqual(self.backend, self.backend_state(), "CPU backend changed")
        self.assertIs(seasonal._REGIME.get(), self.context[0])
        self.assertIs(api._ECOLOGY.get(), self.context[1])
        for key, maximum in LIMITS.items():
            self.assertLessEqual(COUNTS[key], maximum)
        for key in ("discriminatorForwardsAttempted", "discriminatorGradCallsAttempted",
                    "optimizerConstructionsAttempted", "optimizerUpdatesAttempted", "cudaCallsAttempted"):
            self.assertEqual(COUNTS[key], 0, key)

    def tracked(self, model):
        def started(_module, _args):
            _attempt("generatorForwardsAttempted")

        def completed(_module, _args, _output):
            COUNTS["generatorForwardsCompleted"] += 1

        self.addCleanup(model.register_forward_pre_hook(started).remove)
        self.addCleanup(model.register_forward_hook(completed).remove)
        return model

    def fresh(self):
        return self.tracked(api.build_fresh_object_ecology_regime_prototype_cpu(
            condition_channel_order=ORDER)).eval()

    def predecessor(self):
        return self.tracked(old.build_fresh_object_appearance_regime_detail_weight_precision(
            condition_channel_order=ORDER)).eval()

    def assertStateBytes(self, expected, model):
        actual = model.state_dict()
        self.assertEqual(tuple(expected), tuple(actual))
        for key, value in expected.items():
            self.assertTrue(same_bytes(value, actual[key]), key)


class EcologyInputTests(CpuContractCase):
    def test_fixed_encoding_unknown_nan_dtype_shape_device_and_requires_grad(self):
        self.assertEqual(tuple(inputs.ECOLOGIES), EXPECTED_ECOLOGIES)
        for index, category in enumerate(EXPECTED_ECOLOGIES):
            with self.subTest(category=category):
                code = inputs.encode_ecology(category)
                self.assertTrue(same_bytes(code, torch.eye(7, dtype=torch.float32)[index]))
                self.assertEqual(code.device.type, "cpu")
                self.assertFalse(code.requires_grad)
                self.assertIs(inputs.validate_ecology(code), code)
        for category in (None, "", "unknown", "BAMBOO-GROVE", "bamboo-grove ", 0, [], {}):
            with self.subTest(category=category), self.assertRaises(ValueError):
                inputs.encode_ecology(category)
        invalid = [None, [1, 0, 0, 0, 0, 0, 0], torch.zeros(7), torch.ones(7),
                   torch.full((7,), 1 / 7), torch.eye(7), torch.zeros(6),
                   torch.eye(7)[0][None], torch.eye(7)[0].double(),
                   torch.eye(7)[0].to(torch.int64), torch.eye(7)[0].bool(),
                   torch.eye(7)[0].requires_grad_(), torch.empty(7, device="meta")]
        for value in (float("nan"), float("inf"), -float("inf"), -1.0, 0.5):
            code = inputs.encode_ecology(EXPECTED_ECOLOGIES[0]); code[1] = value
            invalid.append(code)
        noncontiguous = torch.zeros(14)[::2]; noncontiguous[0] = 1
        invalid.append(noncontiguous)
        for index, code in enumerate(invalid):
            with self.subTest(invalid=index), self.assertRaises(ValueError):
                inputs.validate_ecology(code)

    def test_bound_seven_ecologies_real_canonical_and_ignored_metadata(self):
        for index, category in enumerate(EXPECTED_ECOLOGIES):
            with self.subTest(category=category):
                reader, record = source_fixture(category, SEASONS[index % 4])
                before = _json_bytes(reader.values), deepcopy(record)
                season_code, ecology_code, facts = inputs.bound_ecology_regime(reader, record)
                self.assertTrue(same_bytes(season_code, encode_season(SEASONS[index % 4])))
                self.assertTrue(same_bytes(ecology_code, inputs.encode_ecology(category)))
                self.assertEqual(facts["canonicalPackageSha256"],
                                 record["regionSourcePackage"]["taskBoundCanonicalPackageSha256"])
                self.assertEqual(facts["ecology"], category)
                self.assertIs(facts["executionAuthorityGranted"], False)
                self.assertTrue(reader.program_reads, "real canonical source verifier was not reached")
                self.assertNotEqual(record["regionSourcePackage"]["sha256"], facts["canonicalPackageSha256"])
                self.assertEqual(before, (_json_bytes(reader.values), record))
                reader.values["conditionPack.json"].update({
                    "sampleId": "audit-only-other", "worldId": "audit-only-world",
                    "coordinate": 999, "freeText": "ignored", "landscapeType": "unknown",
                    "path": "ignored", "hash": "ignored"})
                _bind_fixture(reader, record)
                actual_season, actual_ecology, _ = inputs.bound_ecology_regime(reader, record)
                self.assertTrue(same_bytes(actual_season, season_code))
                self.assertTrue(same_bytes(actual_ecology, ecology_code))

    def test_bound_source_sha_canonical_paths_season_license_and_registry_rejections(self):
        # Each counterexample passes synthetic byte authentication unless that
        # authentication is the boundary under test. Never stub bound_regime.
        cases = ("file_sha", "canonical", "canonical_declaration", "task_path", "source_path",
                 "source_sha", "provenance", "season", "snapshot_id", "snapshot_usage",
                 "material", "license", "registry", "plans", "missing", "unknown")
        for kind in cases:
            with self.subTest(kind=kind):
                reader, record = source_fixture()
                values = reader.values
                pack, task = values["conditionPack.json"], values["taskPackage.json"]
                region, snapshot = values["regionSourcePackage.json"], values["seasonSnapshot.json"]
                if kind == "file_sha": record["conditionPack"]["sha256"] = "0" * 64
                elif kind == "canonical": region["auditOnlyPayloadChange"] = "new authenticated bytes"
                elif kind == "canonical_declaration": region["packageSha256"] = "0" * 64
                elif kind == "task_path": pack["sourceBindings"]["taskPackagePath"] = "other.json"
                elif kind == "source_path": task["sourceBindings"]["seasonSnapshotPath"] = "other.json"
                elif kind == "source_sha": task["sourceBindings"]["seasonSnapshotSha256"] = "0" * 64
                elif kind == "provenance": region["sourceProvenance"]["sourceRegistrySha256"] = "0" * 64
                elif kind == "season": snapshot["environment"]["season"] = SEASONS[1]
                elif kind == "snapshot_id": snapshot["snapshotId"] = "wrong"
                elif kind == "snapshot_usage": snapshot["usage"]["originalImageCoverageBaseline"] = False
                elif kind == "material": snapshot["environment"]["lighting"] = "wrong"
                elif kind == "license": region["sourceProvenance"]["sources"][0]["license"] = ""
                elif kind == "registry": values["sourceRegistry.json"]["sources"][0]["attribution"] = "wrong"
                elif kind == "plans": task["directorPlan"]["singleMapEcologyPlan"]["landscapeType"] = EXPECTED_ECOLOGIES[1]
                elif kind == "missing":
                    del pack["categoricalConditions"]["ecologyPlan"]["landscapeType"]
                    del task["directorPlan"]["singleMapEcologyPlan"]["landscapeType"]
                elif kind == "unknown":
                    pack["categoricalConditions"]["ecologyPlan"]["landscapeType"] = "unknown"
                    task["directorPlan"]["singleMapEcologyPlan"]["landscapeType"] = "unknown"
                if kind not in ("file_sha", "canonical", "canonical_declaration", "source_sha", "provenance"):
                    _bind_fixture(reader, record)
                else:
                    # Keep the deliberately bad semantic/canonical declaration,
                    # while authenticating any changed JSON file bytes.
                    for binding in record.values():
                        if kind != "file_sha": binding["sha256"] = _sha(_json_bytes(values[binding["path"]]))
                with self.assertRaises(ValueError): inputs.bound_ecology_regime(reader, record)
                if kind == "canonical":
                    self.assertTrue(reader.program_reads, "canonical mismatch must reach real Node verifier")

    def test_bound_pack_and_task_before_after_changes_are_rejected(self):
        for path in ("conditionPack.json", "taskPackage.json"):
            for mode in ("changed_bytes", "changed_returned_document"):
                with self.subTest(path=path, mode=mode):
                    reader, record = source_fixture()
                    native, calls = reader.json, {}

                    def changing(binding):
                        name = binding["path"]
                        calls[name] = calls.get(name, 0) + 1
                        if name == path and calls[name] >= 3:
                            if mode == "changed_bytes":
                                reader.values[name]["auditOnlyMutation"] = "during-read"
                            else:
                                value = native(binding)
                                value["auditOnlyMutation"] = "during-read"
                                return value
                        return native(binding)

                    with patch.object(reader, "json", changing), self.assertRaises(ValueError):
                        inputs.bound_ecology_regime(reader, record)
                    self.assertGreaterEqual(calls[path], 3)
                    self.assertTrue(reader.program_reads)


class EcologyModelTests(CpuContractCase):
    def test_fresh_108_parameter_graph_original_bytes_noalias_and_identity(self):
        predecessor, model = self.predecessor(), self.fresh()
        self.assertEqual(api.ECOLOGY_PARAMETER, ECOLOGY_WEIGHT)
        self.assertEqual(api.TARGET, ECOLOGY_WEIGHT.rsplit(".ecology_branch.weight", 1)[0])
        old_named = tuple(predecessor.named_parameters(remove_duplicate=False))
        named = tuple(model.named_parameters(remove_duplicate=False))
        retained = tuple((name, value) for name, value in named if name != ECOLOGY_WEIGHT)
        self.assertEqual(len(old_named), 107)
        self.assertEqual(len(named), 108)
        self.assertEqual(sum(p.numel() for _, p in named), 2242687)
        self.assertEqual(tuple(name for name, _ in retained), tuple(name for name, _ in old_named))
        for (name, value), (_, reference) in zip(retained, old_named):
            self.assertTrue(same_bytes(value, reference), name)
        self.assertEqual(len({id(p) for _, p in named}), 108)
        self.assertEqual(len({p.untyped_storage().data_ptr() for _, p in named}), 108)
        self.assertTrue(all(p.device.type == "cpu" and p.dtype == torch.float32 and p.requires_grad
                            and p.grad is None and p.is_contiguous() for _, p in named))
        self.assertIs(api.validate_model_identity(model), model)
        ecology, season = api.ecological_parameter(model), api.seasonal_parameter(model)
        self.assertIs(dict(named)[ECOLOGY_WEIGHT], ecology)
        self.assertEqual(tuple(ecology.shape), (32, 7, 3, 3))
        self.assertEqual(tuple(season.shape), (32, 4, 3, 3))
        self.assertEqual(int(ecology.count_nonzero()), 0)
        first = model.core.core.appearance.base.layers[0]
        self.assertEqual(tuple(first.weight.shape), (32, 78, 3, 3))
        self.assertEqual((first.ecology_branch.padding, first.ecology_branch.stride,
                          first.ecology_branch.dilation, first.ecology_branch.groups),
                         ((1, 1), (1, 1), (1, 1), 1))
        self.assertIsNone(first.ecology_branch.bias)
        self.assertEqual(model.capability_version, api.CAPABILITY)
        self.assertEqual(model.architecture_id, api.ARCHITECTURE)
        self.assertEqual(model.numeric_rule, api.NUMERIC_RULE)
        self.assertEqual(api.NUMERIC_RULE, old.NUMERIC_RULE)
        self.assertNotEqual(model.capability_version, predecessor.capability_version)
        self.assertNotEqual(model.architecture_id, predecessor.architecture_id)
        self.assertTrue(same_bytes(model.regime_identity, predecessor.regime_identity))
        self.assertFalse(same_bytes(model.numeric_identity, predecessor.numeric_identity))
        for key in ("regime_identity", "numeric_identity", "ecology_identity"):
            self.assertEqual(tuple(model.state_dict()[key].shape), (32,))
            self.assertEqual(model.state_dict()[key].dtype, torch.uint8)
            self.assertNotIn(key, dict(named))
        for role in ROLES:
            actual = tuple(model.object_rgb_heads[role].parameters())
            reference = tuple(predecessor.object_rgb_heads[role].parameters())
            self.assertEqual(len(actual), len(reference))
            self.assertTrue(all(same_bytes(a, b) for a, b in zip(actual, reference)))
        self.assertEqual(len({id(p) for head in model.object_rgb_heads.values() for p in head.parameters()}), 16)
        self.assertFalse(model.parent_checkpoint_loaded)
        self.assertFalse(model.execution_qualified)

    def test_all_7_by_4_zero_branch_rgb_bytes_with_four_cached_old_forwards(self):
        predecessor, model = self.predecessor(), self.fresh()
        conditions, table = scene(); before = conditions.clone(), deepcopy(table)
        old_state, new_state = deepcopy(predecessor.state_dict()), deepcopy(model.state_dict())
        start = COUNTS["generatorForwardsCompleted"]
        with torch.no_grad():
            for season in SEASONS:
                # Exactly one baseline forward per season, outside ecology loop.
                baseline = predecessor(conditions, table, appearance_regime=encode_season(season))
                for ecology in EXPECTED_ECOLOGIES:
                    with self.subTest(season=season, ecology=ecology):
                        actual = model(conditions, table, appearance_regime=encode_season(season),
                                       ecology_regime=inputs.encode_ecology(ecology))
                        self.assertTrue(same_bytes(actual, baseline))
        self.assertEqual(COUNTS["generatorForwardsCompleted"] - start, 32)
        self.assertTrue(same_bytes(before[0], conditions)); self.assertEqual(before[1], table)
        self.assertStateBytes(old_state, predecessor); self.assertStateBytes(new_state, model)

    def test_nonzero_ecology_and_season_independent_response_inside_object_support(self):
        model = self.fresh(); conditions, table = scene()
        before = conditions.clone(), deepcopy(table)
        with torch.no_grad():
            api.ecological_parameter(model)[:, 0].fill_(0.02)
            api.seasonal_parameter(model)[:, 0].fill_(0.015)
        state = deepcopy(model.state_dict()); outputs, evidence = {}, {}
        with torch.no_grad():
            for season_index, ecology_index in ((0, 0), (0, 1), (1, 0), (1, 1)):
                key = season_index, ecology_index
                outputs[key], evidence[key] = model(conditions, table,
                    appearance_regime=encode_season(SEASONS[season_index]),
                    ecology_regime=inputs.encode_ecology(EXPECTED_ECOLOGIES[ecology_index]),
                    return_evidence=True)
        reference = evidence[0, 0]
        outside = torch.ones(1, 1, 192, 256, dtype=torch.bool)
        for role in ROLES: outside &= ~reference["visibleObjectSupportMasks"][role].bool()
        self.assertTrue(bool(outside.any())); self.assertTrue(bool((~outside).any()))
        for key, facts in evidence.items():
            self.assertTrue(same_bytes(reference["terrainRgb"], facts["terrainRgb"]))
            for role in ROLES:
                self.assertTrue(same_bytes(reference["visibleObjectSupportMasks"][role],
                                           facts["visibleObjectSupportMasks"][role]))
            self.assertTrue(same_bytes(outputs[0, 0][outside.expand_as(outputs[key])],
                                       outputs[key][outside.expand_as(outputs[key])]))
        for a, b in (((0, 0), (0, 1)), ((1, 0), (1, 1)),
                     ((0, 0), (1, 0)), ((0, 1), (1, 1))):
            self.assertFalse(same_bytes(outputs[a][(~outside).expand_as(outputs[a])],
                                        outputs[b][(~outside).expand_as(outputs[b])]), (a, b))
        self.assertStateBytes(state, model)
        self.assertTrue(same_bytes(before[0], conditions)); self.assertEqual(before[1], table)

    def test_private_xy_terrain_and_separate_branch_broadcasts_retained(self):
        model = self.fresh(); conditions, table = scene(); captures = {}
        first = model.core.core.appearance.base.layers[0]
        with ExitStack() as stack:
            for name, module in (("features", first), ("season", first.season_branch),
                                 ("ecology", first.ecology_branch)):
                def capture(_module, args, name=name): captures[name] = args[0].detach().clone()
                stack.callback(module.register_forward_pre_hook(capture).remove)
            with torch.no_grad():
                model(conditions, table, appearance_regime=encode_season(SEASONS[2]),
                      ecology_regime=inputs.encode_ecology(EXPECTED_ECOLOGIES[5]))
        features = captures["features"]
        self.assertEqual(tuple(features.shape[1:]), (78, 32, 32))
        for channel in ("coordinate_x", "coordinate_y"):
            self.assertEqual(int(features[:, ORDER.index(channel)].count_nonzero()), 0)
        self.assertGreater(int(features[:, 24:26].count_nonzero()), 0)
        self.assertGreater(int(features[:, 26:74].count_nonzero()), 0)
        for key, code in (("season", encode_season(SEASONS[2])),
                          ("ecology", inputs.encode_ecology(EXPECTED_ECOLOGIES[5]))):
            actual = captures[key]
            expected = code[None, :, None, None].expand(features.shape[0], -1, 32, 32)
            self.assertTrue(same_bytes(actual, expected)); self.assertFalse(actual.requires_grad)

    def test_one_full_graph_autograd_finite_new_branch_nonzero_zero_update(self):
        model = self.fresh(); conditions, table = scene()
        before = deepcopy(model.state_dict()), conditions.clone(), deepcopy(table)
        named = tuple(model.named_parameters()); parameters = tuple(p for _, p in named)
        start = deepcopy(COUNTS)
        prediction = model(conditions, table, appearance_regime=encode_season(SEASONS[0]),
                           ecology_regime=inputs.encode_ecology(EXPECTED_ECOLOGIES[0]))
        # Fixed synthetic complete-frame target; no production Loss or data read.
        target = torch.linspace(0, 1, 256)[None, None, None, :].expand_as(prediction)
        loss = (prediction - target).square().mean()
        gradients = torch.autograd.grad(loss, parameters, allow_unused=True,
                                        retain_graph=False, create_graph=False)
        self.assertEqual(len(gradients), 108)
        for (name, parameter), value in zip(named, gradients):
            if value is not None:
                self.assertEqual(value.shape, parameter.shape, name)
                self.assertEqual(value.dtype, torch.float32, name)
                self.assertEqual(value.device.type, "cpu", name)
                self.assertTrue(bool(torch.isfinite(value).all()), name)
        gradient = gradients[tuple(name for name, _ in named).index(ECOLOGY_WEIGHT)]
        self.assertIsNotNone(gradient)
        self.assertGreater(float(torch.linalg.vector_norm(gradient.double())), 0)
        self.assertGreater(int(gradient[:, 0].count_nonzero()), 0)
        self.assertEqual(int(gradient[:, 1:].count_nonzero()), 0)
        self.assertTrue(all(parameter.grad is None for parameter in parameters))
        self.assertEqual(COUNTS["generatorForwardsCompleted"] - start["generatorForwardsCompleted"], 1)
        self.assertEqual(COUNTS["generatorGradCallsCompleted"] - start["generatorGradCallsCompleted"], 1)
        self.assertStateBytes(before[0], model)
        self.assertTrue(same_bytes(before[1], conditions)); self.assertEqual(before[2], table)

    def test_normal_nested_exception_context_rng_and_backend_restore(self):
        model, inner = self.fresh(), self.fresh(); conditions, table = scene()
        outer_season, outer_ecology = encode_season(SEASONS[3]), inputs.encode_ecology(EXPECTED_ECOLOGIES[6])
        season_token, ecology_token = seasonal._REGIME.set(outer_season), api._ECOLOGY.set(outer_ecology)
        try:
            with torch.no_grad():
                model(conditions, table, appearance_regime=encode_season(SEASONS[0]),
                      ecology_regime=inputs.encode_ecology(EXPECTED_ECOLOGIES[0]))
            self.assertIs(seasonal._REGIME.get(), outer_season); self.assertIs(api._ECOLOGY.get(), outer_ecology)
            active_season, active_ecology = encode_season(SEASONS[1]), inputs.encode_ecology(EXPECTED_ECOLOGIES[1])

            def nested(_module, _args):
                self.assertIs(seasonal._REGIME.get(), active_season)
                self.assertIs(api._ECOLOGY.get(), active_ecology)
                with torch.no_grad():
                    inner(conditions, table, appearance_regime=encode_season(SEASONS[2]),
                          ecology_regime=inputs.encode_ecology(EXPECTED_ECOLOGIES[2]))
                self.assertIs(seasonal._REGIME.get(), active_season)
                self.assertIs(api._ECOLOGY.get(), active_ecology)

            handle = model.core.core.appearance.base.layers[0].register_forward_pre_hook(nested)
            try:
                with torch.no_grad():
                    model(conditions, table, appearance_regime=active_season, ecology_regime=active_ecology)
            finally: handle.remove()
            self.assertIs(seasonal._REGIME.get(), outer_season); self.assertIs(api._ECOLOGY.get(), outer_ecology)
            # Raise inside the inherited strict deterministic index_add scope,
            # after both contexts have been installed and appearance has run.
            flags = self.backend_state()
            with patch.object(torch.Tensor, "index_add", side_effect=RuntimeError("synthetic assembly fault")):
                with torch.no_grad(), self.assertRaisesRegex(RuntimeError, "synthetic assembly fault"):
                    model(conditions, table, appearance_regime=active_season, ecology_regime=active_ecology)
            self.assertEqual(flags, self.backend_state())
            self.assertIs(seasonal._REGIME.get(), outer_season); self.assertIs(api._ECOLOGY.get(), outer_ecology)
            with torch.no_grad(), self.assertRaises(ValueError):
                model(conditions, [], appearance_regime=active_season, ecology_regime=active_ecology)
            self.assertIs(seasonal._REGIME.get(), outer_season); self.assertIs(api._ECOLOGY.get(), outer_ecology)
        finally:
            api._ECOLOGY.reset(ecology_token); seasonal._REGIME.reset(season_token)

    def test_explicit_codes_autocast_wrong_condition_dtype_shape_and_device_rejected(self):
        model = self.fresh(); conditions, table = scene(); saved = deepcopy(model.state_dict())
        valid = {"appearance_regime": encode_season(SEASONS[0]),
                 "ecology_regime": inputs.encode_ecology(EXPECTED_ECOLOGIES[0])}
        for missing in ("appearance_regime", "ecology_regime"):
            with self.subTest(missing=missing), self.assertRaises(TypeError):
                model(conditions, table, **{k: v for k, v in valid.items() if k != missing})
        for key, value in (("appearance_regime", torch.zeros(7)),
                           ("appearance_regime", valid["appearance_regime"].double()),
                           ("ecology_regime", torch.zeros(4)),
                           ("ecology_regime", valid["ecology_regime"].double())):
            with self.subTest(code=key, dtype=value.dtype), self.assertRaises(ValueError):
                model(conditions, table, **{**valid, key: value})
        for invalid in (conditions.double(), conditions[:, :, :1, :1],
                        torch.empty(1, 23, 192, 256, device="meta")):
            with self.subTest(condition=str(invalid.device), shape=invalid.shape), self.assertRaises(ValueError):
                model(invalid, table, **valid)
        with torch.autocast("cpu", dtype=torch.bfloat16), self.assertRaisesRegex(ValueError, "autocast"):
            model(conditions, table, **valid)
        self.assertStateBytes(saved, model)

    def test_bytesio_weights_only_state_roundtrip_retains_nonzero_branch_and_rgb(self):
        model, restored = self.fresh(), self.fresh(); conditions, table = scene()
        with torch.no_grad():
            api.ecological_parameter(model)[:, 4].fill_(0.02)
            api.seasonal_parameter(model)[:, 2].fill_(0.01)
        state = deepcopy(model.state_dict())
        stream = io.BytesIO()
        torch.save(state, stream); stream.seek(0)
        loaded = torch.load(stream, map_location="cpu", weights_only=True)
        result = restored.load_state_dict(loaded, strict=True, assign=False)
        self.assertEqual(result.missing_keys, []); self.assertEqual(result.unexpected_keys, [])
        self.assertStateBytes(state, restored); self.assertStateBytes(state, model)
        self.assertTrue(all(value.device.type == "cpu" for value in loaded.values()))
        kwargs = {"appearance_regime": encode_season(SEASONS[2]),
                  "ecology_regime": inputs.encode_ecology(EXPECTED_ECOLOGIES[4])}
        with torch.no_grad(): self.assertTrue(same_bytes(model(conditions, table, **kwargs),
                                                        restored(conditions, table, **kwargs)))

    def test_strict_reload_rejects_old_identities_nonfinite_keys_shape_dtype_atomically(self):
        model = self.fresh(); saved = deepcopy(model.state_dict())
        parameter_ids = tuple(id(p) for p in model.parameters())
        first_name = next(iter(dict(model.named_parameters())))
        old_state = self.predecessor().state_dict()
        cases = [old_state]
        for key in ("regime_identity", "numeric_identity", "ecology_identity", ECOLOGY_WEIGHT):
            cases.append({name: value for name, value in saved.items() if name != key})
        for key in ("regime_identity", "numeric_identity", "ecology_identity"):
            bad = deepcopy(saved); bad[key][0] ^= 1; cases.append(bad)
            bad = dict(saved); bad[key] = saved[key].float(); cases.append(bad)
        for key, value in ((ECOLOGY_WEIGHT, saved[ECOLOGY_WEIGHT].double()),
                           (ECOLOGY_WEIGHT, torch.zeros(32, 7, 1, 1)),
                           (ECOLOGY_WEIGHT, torch.empty(32, 7, 3, 3, device="meta")),
                           (ECOLOGY_WEIGHT, saved[ECOLOGY_WEIGHT].transpose(2, 3)),
                           (ECOLOGY_WEIGHT, torch.full_like(saved[ECOLOGY_WEIGHT], float("nan"))),
                           (first_name, torch.full_like(saved[first_name], float("inf")))):
            bad = dict(saved); bad[key] = value; cases.append(bad)
        bad = dict(saved); bad["unexpected"] = torch.zeros(1); cases.append(bad)
        # Put an otherwise valid changed early parameter in every rejected state.
        # Any importer that writes before validating the late error is detected.
        for index, bad in enumerate(cases):
            bad = dict(bad)
            if first_name in bad and bool(torch.isfinite(bad[first_name]).all()):
                bad[first_name] = bad[first_name].clone() + 0.125
            with self.subTest(case=index), self.assertRaises(ValueError): model.load_state_dict(bad)
            self.assertStateBytes(saved, model)
            self.assertEqual(parameter_ids, tuple(id(p) for p in model.parameters()))
        for options in ({"strict": False}, {"assign": True}):
            with self.subTest(options=options), self.assertRaises(ValueError):
                model.load_state_dict(saved, **options)
            self.assertStateBytes(saved, model)

    def test_late_post_load_hook_failure_rolls_back_bytes_without_reinvoking_hook(self):
        model = self.fresh(); saved = deepcopy(model.state_dict())
        parameters = tuple(model.parameters())
        storage = tuple(value.untyped_storage().data_ptr() for value in model.state_dict().values())
        payload = deepcopy(saved)
        first_name = next(iter(dict(model.named_parameters())))
        payload[first_name].add_(0.125)
        payload[ECOLOGY_WEIGHT][:, 0].fill_(0.02)
        payload_before = deepcopy(payload)
        calls = []

        def late_failure(module, incompatible_keys):
            calls.append(1)
            self.assertIs(module, model)
            self.assertEqual(incompatible_keys.missing_keys, [])
            self.assertEqual(incompatible_keys.unexpected_keys, [])
            # Confirm the deliberate error occurs after the new values were
            # installed, so this actually exercises storage rollback.
            self.assertStateBytes(payload_before, module)
            raise RuntimeError("synthetic late post-load hook failure")

        handle = model.register_load_state_dict_post_hook(late_failure)
        try:
            with self.assertRaisesRegex(RuntimeError, "synthetic late post-load hook failure"):
                model.load_state_dict(payload, strict=True, assign=False)
        finally: handle.remove()
        self.assertEqual(len(calls), 1, "rollback must not invoke the failing load hook")
        self.assertStateBytes(saved, model)
        self.assertEqual(tuple(id(value) for value in parameters), tuple(id(value) for value in model.parameters()))
        self.assertEqual(storage, tuple(value.untyped_storage().data_ptr() for value in model.state_dict().values()))
        for key, value in payload.items(): self.assertTrue(same_bytes(value, payload_before[key]), key)
        self.assertIs(api.validate_model_identity(model), model)

    def test_live_model_wrong_identity_alias_nonfinite_shape_dtype_and_operator_rejected(self):
        model = self.fresh(); state = deepcopy(model.state_dict())
        for key, value in (("capability_version", "old"), ("architecture_id", "old"),
                           ("numeric_rule", "wrong")):
            previous = getattr(model, key)
            try:
                setattr(model, key, value)
                with self.subTest(attribute=key), self.assertRaises(ValueError): api.validate_model_identity(model)
            finally: setattr(model, key, previous)
        for key in ("regime_identity", "numeric_identity", "ecology_identity"):
            try:
                getattr(model, key)[0] ^= 1
                with self.subTest(buffer=key), self.assertRaises(ValueError): api.validate_model_identity(model)
            finally: getattr(model, key).copy_(state[key])
        branch = model.core.core.appearance.base.layers[0].ecology_branch
        original = branch.weight
        invalid = (torch.nn.Parameter(original.detach().double()), torch.nn.Parameter(torch.zeros(1)),
                   torch.nn.Parameter(torch.full_like(original, float("nan"))),
                   torch.nn.Parameter(original.detach().to("meta")))
        for value in invalid:
            try:
                branch.weight = value
                with self.subTest(shape=value.shape, dtype=value.dtype), self.assertRaises(ValueError):
                    api.validate_model_identity(model)
            finally: branch.weight = original
        for alias in (original, torch.nn.Parameter(original.detach())):
            try:
                model.register_parameter("synthetic_alias", alias)
                with self.assertRaises(ValueError): api.validate_model_identity(model)
            finally: del model._parameters["synthetic_alias"]
        layers = model.core.core.appearance.base.layers; first = layers[0]
        try:
            with torch.random.fork_rng(devices=[]): layers[0] = torch.nn.Conv2d(78, 32, 3, padding=1)
            with self.assertRaises(ValueError): api.validate_model_identity(model)
        finally: layers[0] = first
        self.assertIs(api.validate_model_identity(model), model); self.assertStateBytes(state, model)
        predecessor = self.predecessor()
        with self.assertRaises(ValueError): api.validate_model_identity(predecessor)
        with self.assertRaises(ValueError): api.ecological_parameter(predecessor)
        with self.assertRaises(ValueError): old.validate_model_identity(model)


if __name__ == "__main__":
    # Counters remain available to an importing managed unittest runner even
    # after partial failure. CLI emits the same actual receipt without file I/O.
    try:
        unittest.main()
    finally:
        print(json.dumps({"synthetic": True, "callCounts": COUNTS, "limits": LIMITS},
                         sort_keys=True, allow_nan=False))
