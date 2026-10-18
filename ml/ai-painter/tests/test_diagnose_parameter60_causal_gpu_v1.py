"""CPU micro-fixtures; no actual renderer/archive/GPU or optimizer construction."""
import ast
import contextlib
import importlib.util
import json
from copy import deepcopy
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

import torch
from torch import nn

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
spec = importlib.util.spec_from_file_location("parameter60_gpu_worker_fixture", ROOT / "ml/ai-painter/scripts/diagnose_parameter60_causal_gpu_v1.py")
worker = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = worker
spec.loader.exec_module(worker)
torch.set_num_threads(2)
if torch.get_num_interop_threads() != 2: torch.set_num_interop_threads(2)


class TinyG(nn.Module):
    def __init__(self):
        super().__init__()
        self.prefix = nn.ParameterList([nn.Parameter(torch.zeros(1)) for _ in range(60)])
        self.core = nn.Module()
        self.core.core = nn.Module()
        self.core.core.terrain = nn.Module()
        self.core.core.terrain.full_resolution_detail = nn.Module()
        self.core.core.terrain.full_resolution_detail.layers = nn.ModuleList(
            [nn.Identity(), nn.Identity(), nn.Identity(), nn.Conv2d(48, 48, 3, padding=1)])
        self.suffix = nn.ParameterList([nn.Parameter(torch.zeros(1)) for _ in range(30)])
        self.object_rgb_heads = nn.ModuleDict({key: nn.Sequential(nn.Linear(1, 1), nn.Linear(1, 1))
            for key in worker.gate_module.OBJECT_HEAD_KEYS})
        self.condition_channel_order = tuple("channel" + str(i) for i in range(23))

    def forward(self, x): return self.core.core.terrain.full_resolution_detail.layers[3](x)


class TinyD(nn.Module):
    def __init__(self):
        super().__init__()
        self.parameters14 = nn.ParameterList([nn.Parameter(torch.ones(1)) for _ in range(14)])
    def forward(self, *args): raise AssertionError("D forward forbidden by fixture")


def fixture(case="target"):
    torch.manual_seed(117)
    g, d = TinyG(), TinyD()
    sample = dict(sampleId=worker.restore.SAMPLE_ID, split="train", image=torch.ones(3, 4, 5),
        conditions=torch.arange(23*4*5).reshape(23, 4, 5).float().div(1000),
        appearance_regime=torch.tensor([1., 0., 0., 0.]), ecology_regime=torch.tensor([1., 0., 0., 0., 0., 0., 0.]),
        objectInstanceTable=[])
    active = [None]
    counts = dict(forward=0, autograd=0)

    @contextlib.contextmanager
    def observe(callback):
        active[0] = callback
        try: yield
        finally: active[0] = None

    def forward(model, bound):
        counts["forward"] += 1
        x = bound["conditions"][:1].repeat(48, 1, 1).unsqueeze(0)
        y = model(x)
        if case == "repeat": model(x)
        return y

    def candidate(model, critic, bound, order, y):
        if case == "forged": raise ValueError(worker.TARGET_ERROR)
        coefficients = [torch.full_like(y, value) for value in (.001, -.0003, .0002)]
        terms = [(y*c).sum() for c in coefficients]
        total = (terms[0].float()+terms[1]).float()+terms[2]
        grads = []
        for index, (label, loss) in enumerate(zip(worker.LABELS, (total, *terms))):
            active[0]("attempt", label, None)
            raw = list(torch.autograd.grad(loss, tuple(model.parameters()), retain_graph=index < 3, allow_unused=True))
            counts["autograd"] += 1
            if index == 0 and case in ("target", "other", "source-tamper"):
                raw[60 if case != "other" else 61] = raw[60 if case != "other" else 61].clone()
                raw[60 if case != "other" else 61].reshape(-1)[0] += .01
            if case == "nonfinite" and index == 0: raw[60].reshape(-1)[0] = float("nan")
            active[0]("complete", label, tuple(raw))
            grads.append(tuple(raw))
        values, facts = worker.gate_module.apply_object_head_core_priority_update_v24_cpu(
            model=model, parameters=tuple(model.parameters()), total_gradients=grads[0],
            structured_gradients=grads[1], whole_frame_gradients=grads[2], core_gradients=grads[3])
        return total, values, facts

    def phase(critic, training): critic.train(training).requires_grad_(training)
    fake = types.SimpleNamespace(_phase=phase, _bound_device=lambda m, s: dict(s),
        sample_forward=forward, _generator_candidate=candidate, observe_generator_gradients=observe)
    return g, d, sample, fake, counts


class DiagnosticDigestTests(unittest.TestCase):
    def tearDown(self): self.assertFalse(torch.cuda.is_initialized())

    def test_digest_matches_frozen_host_bytes_without_dtype_conversion(self):
        values = [torch.tensor([0., -0., 1.25, -3.5], dtype=dtype)
                  for dtype in (torch.float16, torch.float32, torch.float64, torch.bfloat16)]
        values += [torch.tensor([-2, 0, 4], dtype=torch.int64),
                   torch.tensor([True, False]), torch.tensor(2.), torch.empty(0)]
        for value in values:
            with self.subTest(dtype=value.dtype, shape=value.shape):
                self.assertEqual(worker._diagnostic_tensor_sha(value), worker.capture.tensor_sha(value))

    def test_noncontiguous_view_uses_logical_order_and_preserves_identity(self):
        value = torch.arange(12., requires_grad=True).reshape(3, 4).transpose(0, 1)
        before = worker._tensor_identity(value)
        self.assertEqual(worker._diagnostic_tensor_sha(value), worker.capture.tensor_sha(value.detach()))
        self.assertEqual(worker._tensor_identity(value), before)
        self.assertTrue(value.requires_grad)
        self.assertIsNotNone(value.grad_fn)

    def test_host_transfer_precedes_cpu_only_digest_for_every_input(self):
        value = nn.Parameter(torch.arange(4.))
        before = worker._tensor_identity(value)
        calls = []
        actual_cpu, actual_digest = torch.Tensor.cpu, worker.capture.tensor_sha
        def host_transfer(detached):
            self.assertFalse(detached.requires_grad)
            calls.append("host-transfer")
            return actual_cpu(detached)
        def cpu_only_digest(host):
            self.assertEqual(calls, ["host-transfer"])
            self.assertEqual(host.device.type, "cpu")
            self.assertFalse(host.requires_grad)
            self.assertEqual(host.dtype, value.dtype)
            calls.append("digest")
            return actual_digest(host)
        with patch.object(torch.Tensor, "cpu", host_transfer), \
             patch.object(worker.capture, "tensor_sha", side_effect=cpu_only_digest):
            worker._diagnostic_tensor_sha(value)
        self.assertEqual(calls, ["host-transfer", "digest"])
        self.assertEqual(worker._tensor_identity(value), before)
        self.assertTrue(value.requires_grad)
        self.assertIsNone(value.grad)

    def test_failed_host_transfer_never_falls_back_to_direct_numpy(self):
        with patch.object(torch.Tensor, "cpu", side_effect=RuntimeError("transfer unavailable")), \
             patch.object(worker.capture, "tensor_sha", side_effect=AssertionError("digest before host transfer")):
            with self.assertRaisesRegex(RuntimeError, "transfer unavailable"):
                worker._diagnostic_tensor_sha(torch.ones(1))

    def test_meta_sparse_and_non_tensor_are_refused_before_transfer(self):
        values = [torch.empty(1, device="meta"), torch.tensor([1.]).to_sparse(), [1.]]
        with patch.object(torch.Tensor, "cpu", side_effect=AssertionError("invalid transfer")):
            for value in values:
                with self.subTest(value=type(value)), self.assertRaisesRegex(ValueError, "plain CPU/CUDA"):
                    worker._diagnostic_tensor_sha(value)

    def test_all_diagnostic_callers_use_the_single_device_adapter(self):
        tree = ast.parse(Path(worker.__file__).read_text(encoding="utf8"))
        direct = []
        for function in tree.body:
            if not isinstance(function, (ast.FunctionDef, ast.AsyncFunctionDef)): continue
            for node in ast.walk(function):
                if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) \
                        and isinstance(node.func.value, ast.Name) \
                        and node.func.value.id == "capture" and node.func.attr == "tensor_sha":
                    direct.append(function.name)
        self.assertEqual(direct, ["_diagnostic_tensor_sha"])


class PhaseTests(unittest.TestCase):
    def tearDown(self): self.assertFalse(torch.cuda.is_initialized())

    def run_fixture(self, case="target"):
        g, d, sample, profile, calls = fixture(case)
        with patch.object(worker, "_profile", return_value=profile), \
             patch.object(torch.optim, "AdamW", side_effect=AssertionError("optimizer forbidden")):
            phase = worker.run_observed_g_phase(g, d, sample, g.condition_channel_order, resource=lambda: None)
        return phase, g, d, sample, calls

    def test_real_gate_origin_authenticated_and_failure_saved_before_math(self):
        phase, g, d, sample, calls = self.run_fixture()
        self.assertEqual(phase["status"], "diagnostic_target_gate_observed", phase)
        self.assertEqual(calls, dict(forward=1, autograd=4))
        self.assertEqual(phase["originalGateFailure"]["gateLine"], 161)
        self.assertEqual(phase["originalGateFailure"]["sourceSha256"], worker.GATE_SHA)
        saved = []
        def preserve(error, observation):
            self.assertEqual(error["message"], worker.TARGET_ERROR)
            saved.append(1)
            return {"privateFixture": "original-gate-failure"}
        original = worker.decompose_target_gradients
        def contrast(*args, **kwargs):
            self.assertEqual(saved, [1])
            return original(*args, **kwargs)
        with patch.object(worker, "decompose_target_gradients", side_effect=contrast), \
             patch.object(torch.autograd, "grad", side_effect=AssertionError("extra gradient forbidden")):
            result = worker.finish_target_contrast(phase, preserve=preserve, resource=lambda: None)
        self.assertEqual(result["status"], "diagnostic_target_evidence_complete")
        self.assertEqual(result["counts"]["localFp64WeightVjp"], 4)
        self.assertTrue(all(p.grad is None for n in (g, d) for p in n.parameters()))
        self.assertTrue(all(p.requires_grad for p in d.parameters()))
        with self.assertRaisesRegex(ValueError, "private phase proof"):
            worker.finish_target_contrast(phase, preserve=preserve, resource=lambda: None)

    def test_gate_pass_stops_without_mathematical_contrast(self):
        with patch.object(worker, "decompose_target_gradients", side_effect=AssertionError("no local contrast")):
            phase, *_, calls = self.run_fixture("pass")
        self.assertEqual(phase["status"], "diagnostic_not_reproduced", phase)
        self.assertEqual(calls, dict(forward=1, autograd=4))
        self.assertNotIn("observation", phase)
        with self.assertRaisesRegex(ValueError, "other terminal"):
            worker.finish_target_contrast(phase, preserve=lambda *args: None, resource=lambda: None)

    def test_forged_message_other_parameter_incomplete_and_nonfinite_close(self):
        for case in ("forged", "other", "repeat", "nonfinite"):
            with self.subTest(case=case), patch.object(worker, "decompose_target_gradients", side_effect=AssertionError("no math")):
                phase, _, d, _, _ = self.run_fixture(case)
                self.assertEqual(phase["status"], "diagnostic_failed_closed", phase)
                self.assertNotIn("observation", phase)
                self.assertTrue(all(p.requires_grad for p in d.parameters()))

    def test_claimed_status_cannot_authorize_contrast(self):
        with self.assertRaisesRegex(ValueError, "private phase proof"):
            worker.finish_target_contrast(dict(status="diagnostic_target_gate_observed"),
                preserve=lambda *args: {}, resource=lambda: None)

    def test_original_source_sha_mismatch_refuses_attribution(self):
        with patch.object(worker, "GATE_SHA", "0"*64):
            phase, *_ = self.run_fixture()
        self.assertEqual(phase["status"], "diagnostic_failed_closed")
        self.assertIn("SHA", phase["secondaryError"])

    def test_state_or_capture_changes_after_phase_block_math(self):
        phase, g, *_ = self.run_fixture()
        with torch.no_grad(): next(g.parameters()).add_(1)
        with self.assertRaisesRegex(ValueError, "state/versions"):
            worker.finish_target_contrast(phase, preserve=lambda *args: {}, resource=lambda: None)
        phase, *_ = self.run_fixture()
        phase["observation"]["adjoints"][0].reshape(-1)[0] += 1
        with self.assertRaisesRegex(ValueError, "capture changed"):
            worker.finish_target_contrast(phase, preserve=lambda *args: {}, resource=lambda: None)

    def test_resource_failure_cleans_hooks_and_no_optimizer_or_d_grad(self):
        g, d, sample, profile, calls = fixture()
        checks = [0]
        def resource():
            checks[0] += 1
            if checks[0] > 5: raise ValueError("fixture deadline")
        with patch.object(worker, "_profile", return_value=profile):
            phase = worker.run_observed_g_phase(g, d, sample, g.condition_channel_order, resource=resource)
        self.assertEqual(phase["status"], "diagnostic_failed_closed")
        self.assertFalse(g.get_submodule(worker.TARGET_NAME.removesuffix(".weight"))._forward_hooks)
        self.assertEqual(phase["counts"]["optimizerConstruction"], 0)
        self.assertEqual(phase["counts"]["discriminatorAutograd"], 0)

    def test_missing_sample_split_and_parameter_count_refuse_before_forward(self):
        for case in ("split", "count"):
            g, d, sample, profile, calls = fixture()
            if case == "split": sample["split"] = "validation"
            else: d.parameters14 = nn.ParameterList(list(d.parameters14)[:-1])
            with patch.object(worker, "_profile", return_value=profile), self.assertRaises(ValueError):
                worker.run_observed_g_phase(g, d, sample, g.condition_channel_order, resource=lambda: None)
            self.assertEqual(calls["forward"], 0)


class EnvelopeAndSampleTests(unittest.TestCase):
    def tearDown(self): self.assertFalse(torch.cuda.is_initialized())

    def policy_request(self, cpu=True):
        policy = json.loads((ROOT / worker.GPU_POLICY["path"]).read_text(encoding="utf8"))
        run = "parameter60-cpu-current-fixture" if cpu else "parameter60-gpu-fixture"
        request = dict(schemaVersion="parameter60-causal-gpu-request-v1", policy=dict(worker.GPU_POLICY),
            runId=run, outputRoot=policy["outputRoot"]+"/"+run, mode="cpu_preflight" if cpu else "gpu_diagnostic",
            programBindings=[{"path": "ml/ai-painter/scripts/diagnose_parameter60_causal_gpu_v1.py", "sha256": "a"*64}],
            deadlineUnixMs=1001000)
        return policy, request

    def test_cpu_and_gpu_envelopes_share_original_deadline_without_fallback(self):
        for cpu in (True, False):
            policy, request = self.policy_request(cpu)
            worker.validate_request(request, policy, cpu=cpu, now=1000)
            for key, value in (("policy", dict(path=worker.restore.POLICY_PATH, sha256=worker.restore.POLICY_SHA)),
                ("deadlineUnixMs", 999999), ("deadlineUnixMs", 1300000), ("mode", "training"), ("outputRoot", ".runtime/other")):
                broken = deepcopy(request); broken[key] = value
                with self.assertRaises(ValueError): worker.validate_request(broken, policy, cpu=cpu, now=1000)

    def test_original_gate_tolerance_and_wrong_target_refuse(self):
        policy, request = self.policy_request()
        for key, value in (("atol", 1e-5), ("rtol", 1e-4)):
            broken = deepcopy(policy); broken["comparison"][key] = value
            with self.assertRaises(ValueError): worker.validate_request(request, broken, cpu=True, now=1000)
        policy["scope"]["sampleSplit"] = "validation"
        with self.assertRaises(ValueError): worker.validate_request(request, policy, cpu=True, now=1000)

    def test_single_source_reader_no_undeclared_or_other_sample_assets(self):
        a = {"path": "private/only-train157.json", "sha256": "a"*64}
        class Mapping:
            project = ROOT
            def binding(self, binding, maximum):
                self.assertion = binding
                return b'{}'
        mapping = Mapping()
        reader = worker._SingleSampleReader(mapping, {"only": a}, lambda: None)
        self.assertEqual(reader.json(a), {})
        with self.assertRaisesRegex(ValueError, "undeclared"):
            reader.read({"path": "private/validation.json", "sha256": "b"*64})
        with self.assertRaisesRegex(ValueError, "conflicting"):
            reader.allow({"path": a["path"], "sha256": "b"*64})
        # Raw and canonical content identities remain separate.
        extra = {**a, "contentSha256": "c"*64, "contentHashAlgorithm": "sorted_json_without_packageSha256_v1"}
        self.assertEqual(reader.json(extra), {})

    def test_serialization_quota_before_copies(self):
        value = torch.ones(2)
        with patch.object(torch, "save", side_effect=AssertionError("serialization before quota")):
            with self.assertRaisesRegex(ValueError, "before copies"):
                worker._tensor_archive({"x": value}, 1024**2)
        encoded = worker._tensor_archive({"x": value}, 2*1024**2)
        self.assertLess(len(encoded), 2*1024**2)

    def test_loader_selects_only_failure_row_and_original_channel_types(self):
        blobs, calls = {}, []
        def binding(name, value):
            raw = json.dumps(value).encode() if not isinstance(value, bytes) else value
            logical = "private/"+name
            blobs[logical] = raw
            return dict(path=logical, sha256=worker.capture.digest(raw))
        order = ["channel"+str(i) for i in range(23)]
        image = binding("train157.png", b"CPU-fixture-source")
        condition = binding("condition.json", {})
        fact = binding("facts.json", {})
        registry = binding("registry.json", {})
        region = binding("region.json", dict(sourceProvenance=dict(sourceRegistryPath=registry["path"], sourceRegistrySha256=registry["sha256"])))
        season, regional = binding("season.json", {}), binding("regional.json", {})
        task = binding("task.json", dict(sourceBindings=dict(naturalizedWorldFactsPath=fact["path"],
            naturalizedWorldFactsSha256=fact["sha256"], seasonSnapshotPath=season["path"], seasonSnapshotSha256=season["sha256"],
            regionalProfilePath=regional["path"], regionalProfileSha256=regional["sha256"], realEarthRegionSourcePackagePath=region["path"])))
        identity = dict(sampleId=worker.restore.SAMPLE_ID, split="train", image=image, conditionPack=condition,
            taskPackage=task, factHash=fact["sha256"], visualFactManifestFile=binding("visual.json", {}),
            channels=[dict(id=channel, **binding(channel+".png", b"CPU-condition")) for channel in order])
        row = dict(sampleId=worker.restore.SAMPLE_ID, split="train", image=image, conditionPack=condition,
            contribution=binding("contribution.json", {}), sourceRecord=binding("source-record.json", {}),
            regionSource={**region, "contentSha256": "a"*64, "contentHashAlgorithm": "sorted_json_without_packageSha256_v1"})
        source = binding("source-index.json", dict(samples=[row, dict(sampleId="validation-forbidden", split="validation")]))
        dataset = binding("manifest.json", dict(sourceIndex=source, identityPayload=dict(channelOrder=order, continuousChannelIds=[order[0]])))
        contract = binding("contract.json", dict(tensorContract=dict(channelOrder=order, typePartitions=dict(continuous=[order[0]]))))
        class Mapping:
            project = ROOT
            def binding(self, bound, maximum):
                calls.append(bound["path"])
                raw = blobs[bound["path"]]
                worker.require(len(raw) <= maximum and worker.capture.digest(raw) == bound["sha256"], "fixture source SHA")
                return raw
        def load(reader, selected, channel_order, continuous):
            self.assertEqual(selected, row)
            self.assertEqual(channel_order, order)
            self.assertEqual(continuous, [order[0]])
            reader.read(selected["image"])
            for channel in identity["channels"]:
                reader.read({**channel, "kind": "binary_mask", "dtype": "uint8",
                             "shape": [1, 768, 1024], "statistics": {"minimum": 0}})
            return dict(sampleId=identity["sampleId"], split="train", image=torch.ones(3, 192, 256),
                conditions=torch.ones(23, 192, 256)), deepcopy(identity)
        cpu = types.SimpleNamespace(MANIFEST=dataset, CONDITION_CONTRACT=contract, load_sample=load,
            load_samples=lambda *args: self.fail("all-split loader forbidden"))
        profile = types.SimpleNamespace(core=types.SimpleNamespace(cpu=cpu),
            predecessor=types.SimpleNamespace(derive_regime_record=lambda reader, value: ({}, None, None)),
            bind_sample_ecology=lambda reader, value, original, record: value,
            validate_sample_ecology=lambda sample: None,
            prepare_metadata=lambda *args: self.fail("whole metadata route forbidden"))
        manifest = dict(context=dict(sampleIdentity=identity, programBindings={}))
        with patch.object(worker, "_profile", return_value=profile):
            sample, actual_order, reader = worker.load_failure_sample(Mapping(), manifest, resource=lambda: None)
        self.assertEqual(sample["sampleId"], worker.restore.SAMPLE_ID)
        self.assertEqual(actual_order, order)
        self.assertFalse(any("validation" in path for path in calls))
        with self.assertRaisesRegex(ValueError, "undeclared"):
            reader.read(dict(path="private/validation.png", sha256="a"*64))


if __name__ == "__main__": unittest.main()
