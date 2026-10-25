"""CPU fixtures and source-created factory checks; no real forward/archive/GPU."""
import ast
import contextlib
import importlib.util
import json
import io
import shutil
import tempfile
import time
from copy import deepcopy
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

import psutil
_cpu_process = psutil.Process()
_cpu_process.cpu_affinity(_cpu_process.cpu_affinity()[:2])
assert 0 < len(_cpu_process.cpu_affinity()) <= 2
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
import torch
from torch import nn
from ai_painter.complete_world.object_appearance_regime_bias_precision import PrecisionFinalRGBConv

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
spec = importlib.util.spec_from_file_location("parameter90_gpu_worker_v1_fixture", ROOT / "ml/ai-painter/scripts/diagnose_parameter90_causal_gpu_v1.py")
worker = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = worker
spec.loader.exec_module(worker)
from ai_painter.complete_world.parameter90_causal_observation_v1 import _PlaneObserver


class MicroObserver(_PlaneObserver):
    """Actual plane observer mechanism with explicit synthetic 4x5 geometry."""
    def _spatial(self): return (4, 5)
torch.set_num_threads(2)
if torch.get_num_interop_threads() != 2: torch.set_num_interop_threads(2)

CANONICAL_PROGRAM = {"path": "scripts/lib/real-earth-region-governance.mjs",
    "sha256": "c4ae942c1f44a60fad1650f02c9dccb0f780472638693e7146fbbe9a2dc85af1"}
NODE_PATH = Path(shutil.which("node")).resolve()
NODE_BINDING = {"path": str(NODE_PATH), "sha256": worker.capture.digest(NODE_PATH.read_bytes())}


def policy_fixture():
    """Pure synthetic policy shape. Never read production policy/data/archives."""
    return dict(
        schemaVersion="ai-painter-parameter90-causal-gpu-policy-v1",
        metadataCanonicalProgram=dict(CANONICAL_PROGRAM), nodeInterpreter=dict(NODE_BINDING),
        status="registered_one_shot_zero_update_diagnostic_not_training",
        formalSpecification=dict(path="docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
                                 sha256="a"*64, version="AI-PAINTER-SPEC-1.101"),
        designBinding=dict(path="private/synthetic-design.json", sha256="b"*64),
        scope=dict(failureRunId=worker.restore.SOURCE_ROOT.rstrip("/").rsplit("/", 1)[-1],
            failureSampleId=worker.restore.SAMPLE_ID, sampleSplit="train", sampleCount=1,
            resolution=[256,192], sourceStateTiming="after_exception"),
        sourceEvidence=[dict(path=worker.restore.SOURCE_ROOT+name, sha256=sha)
                        for name, sha in worker.restore.SOURCE_HASHES.items()],
        sourceTensorArchive=dict(path=worker.restore.SOURCE_ROOT+"gradient-failure/tensors.pt",
                                 sha256=worker.restore.ARCHIVE_SHA, bytes=worker.restore.ARCHIVE_BYTES),
        target=dict(parameterIndex=90, parameterName=worker.TARGET_NAME, weightShape=[3,48,1,1],
            coordinates=[list(p) for p in worker.COORDINATES], captureInputChannel=1, captureOutputChannel=0),
        sourceStateUse=dict(trainingInitializationAllowed=False, historicalReplayAllowed=False,
            archivedGradientsInstalled=False, archivedRngRestored=False, requiresGradHistoricalClaim=False),
        sourceAlgorithmBindings=[dict(role=role, binding=dict(path=(
            "ml/ai-painter/scripts/" if role.startswith("painter_stage4_") else
            "ml/ai-painter/src/ai_painter/complete_world/")+role+".py", sha256="c"*64))
            for role in sorted(worker.restore.ALGORITHM_ROLES)],
        gradientLabels=list(worker.LABELS),
        comparison=dict(atol=1e-6, rtol=1e-5, originalGateKept=True),
        resources=dict(maxWallSeconds=180, threads=2, maxGpuMemoryFraction=.7,
            maximumTemperatureC=85, minimumFreeVramMiB=2048, minimumFreeDiskMiB=2048,
            maxOutputBytes=134217728, maxTargetCaptureBytes=67108864, maxStreamBytes=8388608,
            attempts=1, automaticRetries=0, cleanupReserveMs=1000, failureEvidenceReserveBytes=65536,
            temperaturePollMs=1000, cpuPreflightMaxWallSeconds=120, cpuPreflightMaxOutputBytes=8388608,
            finalizationReserveMs=8000),
        cpuPreparation=dict(maxWallSeconds=120, threads=2, maxOutputBytes=8388608, attempts=1, automaticRetries=0,
            fullModelForwards=0, fullModelAutogradCalls=0, optimizerConstruction=0, optimizerUpdates=0,
            cudaCalls=0, scope="bound archive/state/sample identity, synthetic observer and exact request ABI; no real forward"),
        outputRoot=".runtime/ai-painter/parameter90-causal-gpu-diagnostics-v1",
        attemptClaimPath=".runtime/ai-painter/parameter90-causal-gpu-diagnostics-v1/attempt-v1.json",
        qualification=dict(trainingAllowed=False, stage4Qualified=False, rootCauseProven=False))


class TinyG(nn.Module):
    def __init__(self):
        super().__init__()
        self.prefix = nn.ParameterList([nn.Parameter(torch.zeros(1)) for _ in range(90)])
        self.core = nn.Module()
        self.core.core = nn.Module()
        self.core.core.final_rgb_decoder = nn.Module()
        self.core.core.final_rgb_decoder.base = nn.Module()
        self.core.core.final_rgb_decoder.base.layers = nn.ModuleList(
            [nn.Identity() for _ in range(4)] + [PrecisionFinalRGBConv(nn.Conv2d(48, 3, 1))])
        self.suffix = nn.ParameterList([nn.Parameter(torch.zeros(1)) for _ in range(16)])
        self.condition_channel_order = tuple("channel" + str(i) for i in range(23))

    def forward(self, x): return self.core.core.final_rgb_decoder.base.layers[4](x)


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
        coefficients = [torch.full_like(y, value) for value in (.001, -.0003, .0002, .0004)]
        terms = [(y*c).sum() for c in coefficients]
        total = ((terms[0].float()+terms[1]).float()+terms[2]).float()+terms[3]
        grads = []
        for index, (label, loss) in enumerate(zip(worker.LABELS, (total, *terms))):
            active[0]("attempt", label, None)
            raw = list(torch.autograd.grad(loss, tuple(model.parameters()), retain_graph=index < 4, allow_unused=True))
            counts["autograd"] += 1
            if index == 0 and case in ("target", "other", "source-tamper", "one-coordinate", "different-coordinate"):
                position = 90 if case != "other" else 91
                raw[position] = raw[position].clone()
                if case == "other": raw[position].reshape(-1)[0] += .01
                elif case == "different-coordinate": raw[position][0, 2, 0, 0] += .01
                else:
                    raw[position][worker.COORDINATES[0]] += .01
            if case == "nonfinite" and index == 0: raw[90].reshape(-1)[0] = float("nan")
            active[0]("complete", label, tuple(raw))
            grads.append(tuple(raw))
        values, facts = worker.gate_module.apply_object_joint_rgb_structure_priority_update_cpu(
            model=model, parameters=tuple(model.parameters()), total_gradients=grads[0],
            structured_gradients=grads[1], whole_frame_gradients=grads[2], core_gradients=grads[3], support_gradients=grads[4])
        return total, values, facts

    def phase(critic, training): critic.train(training).requires_grad_(training)
    fake = types.SimpleNamespace(_phase=phase, _bound_device=lambda m, s: dict(s),
        sample_forward=forward, _generator_candidate=candidate, observe_generator_gradients=observe)
    return g, d, sample, fake, counts


class ActualProfileInterfaceTests(unittest.TestCase):
    def test_actual_factory_and_metadata_interfaces_without_forward_or_archive(self):
        # Read only bound JSON metadata. Exercise the real profile/factory,
        # including dependency binding, instead of substituting a toy factory.
        policy = {"schemaVersion": worker.restore.CURRENT_SCHEMA}
        self.enterContext(patch.object(worker, "CURRENT_POLICY", policy))
        manifest_path = ROOT / worker.restore.CURRENT_ROOT / "gradient-failure/manifest.json"
        self.assertLess(manifest_path.stat().st_size, 2 * 1024**2)
        manifest = json.loads(manifest_path.read_text(encoding="utf8"))
        programs = manifest["context"]["programBindings"]
        verified = {str(ROOT / b["path"]): b["sha256"] for b in programs.values()
                    if worker.restore._is_original_python_source(b["path"])}
        order = [c["id"] for c in manifest["context"]["sampleIdentity"]["channels"]]
        profile = worker._profile()
        self.assertEqual(Path(profile.__file__).name, "painter_stage4_decode1_entry_weight_training_profile_v1.py")
        from ai_painter.complete_world import object_decode1_entry_joint_priority_device_v1 as bridge
        from ai_painter.complete_world import object_ecology_decode1_entry_weight_precision_v1 as identity
        self.assertIs(profile.compute_generator_candidate_gradients, bridge.compute_generator_candidate_gradients)
        self.assertIs(profile.observe_generator_gradients, bridge.observe_generator_gradients)
        self.assertIs(profile._phase, profile.inherited._phase)
        self.assertTrue(callable(profile.inherited.core.cpu.load_sample))
        self.assertTrue(callable(profile.inherited.predecessor.derive_regime_record))
        self.assertIs(profile.bind_sample_ecology, profile.inherited.bind_sample_ecology)
        with patch.object(nn.Module, "_call_impl", side_effect=AssertionError("real model forward forbidden")), \
             patch.object(torch.autograd, "grad", side_effect=AssertionError("model autograd forbidden")), \
             patch.object(torch.optim, "AdamW", side_effect=AssertionError("optimizer forbidden")), \
             patch.object(torch.cuda, "init", side_effect=AssertionError("CUDA forbidden")), \
             patch.object(worker.capture, "safe_load_bytes", side_effect=AssertionError("archive forbidden")), \
             worker.restore._preserve_current_rng():
            model, critic = worker.restore._fresh_networks(ROOT, order, verified, policy=policy)
            self.assertIs(identity.validate_model_identity(model), model)
            worker.capture.validate_graph(tuple(model.named_parameters(remove_duplicate=False)), manifest["graph"])
            observer = worker.Parameter90Observer(model)
            self.assertIs(type(observer.module), PrecisionFinalRGBConv)
            self.assertEqual(observer.convolution, dict(weight_shape=(3,48,1,1), stride=(1,1), padding=(0,0), dilation=(1,1), groups=1))
            self.assertEqual(len(tuple(critic.parameters())), 14)
            self.assertEqual(sum(p.numel() for p in model.parameters()), 2242687)
            self.assertEqual(tuple(model.named_parameters())[91][0], worker.TARGET_NAME.removesuffix("weight")+"bias")
        self.assertFalse(torch.cuda.is_initialized())
        stale = dict(verified); stale[str(ROOT / worker.restore.PROFILE_PATH)] = "0"*64
        with self.assertRaisesRegex(ValueError, "exact original decode1-entry"):
            worker.restore._fresh_networks(ROOT, order, stale, policy=policy)


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

    def run_fixture(self, case="target", *, current=False):
        g, d, sample, profile, calls = fixture(case)
        if current:
            sample["sampleId"] = worker.restore.CURRENT_SAMPLE
            original = profile._generator_candidate
            def weighted(*args, support_structure_weight):
                self.assertEqual(support_structure_weight, 1.0)
                return original(*args)
            profile._generator_candidate = weighted
        with patch.object(worker, "CURRENT_POLICY", {"schemaVersion": worker.restore.CURRENT_SCHEMA} if current else None), \
             patch.object(worker, "COORDINATES", ((1,7,0,0),) if current else worker.COORDINATES), \
             patch.object(worker, "_profile", return_value=profile), \
             patch.object(worker, "Parameter90Observer", MicroObserver), \
             patch.object(worker.gate_module, "bind_parameters", side_effect=lambda m: (tuple(m.parameters()), {}, 106, 107)), \
             patch.object(worker.gate_module, "_validate_model_and_parameters", side_effect=lambda m, p: (tuple(p), {})), \
             patch.object(torch.optim, "AdamW", side_effect=AssertionError("optimizer forbidden")):
            phase = worker.run_observed_g_phase(g, d, sample, g.condition_channel_order, resource=lambda: None)
        return phase, g, d, sample, calls

    def test_current_decode2_weight1_route_captures_actual_new_coordinate(self):
        phase, _, _, _, calls = self.run_fixture(current=True)
        self.assertEqual(phase["status"], "diagnostic_target_gate_observed", phase)
        self.assertEqual(phase["originalGateFailure"]["selectedCoordinates"], [[1,7,0,0]])
        self.assertEqual(calls, dict(forward=1, autograd=5))
        with patch.object(worker, "CURRENT_POLICY", {"schemaVersion": worker.restore.CURRENT_SCHEMA}):
            result = worker.finish_target_contrast(phase, preserve=lambda *args: {"saved":True}, resource=lambda:None)
        self.assertEqual(result["status"], "diagnostic_target_evidence_complete")
        self.assertEqual(result["contrast"]["coordinates"], [[1,7,0,0]])

    def test_current_policy_binds_exact_failure_model_weight_and_coordinate(self):
        policy=policy_fixture();route=worker.restore.source_route({"schemaVersion":worker.restore.CURRENT_SCHEMA})
        policy.update(schemaVersion=worker.restore.CURRENT_SCHEMA,modelCapabilityVersion=route["model_capability"],objectSupportStructureWeight=1)
        policy["scope"].update(failureRunId=route["run"],failureSampleId=route["sample"])
        policy["sourceEvidence"]=[dict(path=route["root"]+name,sha256=sha) for name,sha in route["hashes"].items()]
        policy["sourceTensorArchive"]=dict(path=route["root"]+"gradient-failure/tensors.pt",sha256=route["archive_sha"],bytes=route["archive_bytes"])
        policy["target"].update(coordinates=route["coordinates"],captureInputChannel=7,captureOutputChannel=1)
        worker.restore.validate_source_policy(policy)
        for key,value in [("modelCapabilityVersion","old-model"),("objectSupportStructureWeight",.1)]:
            bad=deepcopy(policy);bad[key]=value
            with self.assertRaises(ValueError):worker.restore.validate_source_policy(bad)
        bad=deepcopy(policy);bad["target"]["coordinates"]=[[0,1,0,0]]
        with self.assertRaises(ValueError):worker.restore.validate_source_policy(bad)

    def test_real_gate_origin_authenticated_and_failure_saved_before_math(self):
        phase, g, d, sample, calls = self.run_fixture()
        self.assertEqual(phase["status"], "diagnostic_target_gate_observed", phase)
        self.assertEqual(calls, dict(forward=1, autograd=5))
        self.assertGreater(phase["originalGateFailure"]["gateLine"], 0)
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
        self.assertEqual(result["counts"]["localFp64WeightVjp"], 5)
        self.assertEqual(result["originalGateFailure"]["selectedCoordinates"], [list(p) for p in worker.COORDINATES])
        self.assertTrue(all(p.grad is None for n in (g, d) for p in n.parameters()))
        self.assertTrue(all(p.requires_grad for p in d.parameters()))
        with self.assertRaisesRegex(ValueError, "private phase proof"):
            worker.finish_target_contrast(phase, preserve=preserve, resource=lambda: None)

    def test_gate_pass_stops_without_mathematical_contrast(self):
        with patch.object(worker, "decompose_target_gradients", side_effect=AssertionError("no local contrast")):
            phase, *_, calls = self.run_fixture("pass")
        self.assertEqual(phase["status"], "diagnostic_not_reproduced", phase)
        self.assertEqual(calls, dict(forward=1, autograd=5))
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

    def test_selected_coordinate_not_reproduced_preserves_authenticated_original_failure_and_mask(self):
        for case, mask in (("different-coordinate", [False]),):
            with self.subTest(case=case), patch.object(worker, "decompose_target_gradients", side_effect=AssertionError("no local reference")):
                phase, *_, calls = self.run_fixture(case)
            self.assertEqual(phase["status"], "diagnostic_not_reproduced", phase)
            self.assertEqual(phase["reasonCode"], "selected_coordinates_not_reproduced")
            self.assertEqual(phase["originalGateFailure"]["message"], worker.TARGET_ERROR)
            self.assertEqual(phase["originalGateFailure"]["selectedCoordinateFailureMask"], mask)
            self.assertEqual(phase["counts"]["localFp64WeightVjp"], 0)
            self.assertEqual(calls, dict(forward=1, autograd=5))
            self.assertNotIn("observation", phase)

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
        with patch.object(worker, "_profile", return_value=profile), patch.object(worker, "Parameter90Observer", MicroObserver):
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
        binding = {"path": worker.GPU_POLICY_PATH, "sha256": "cd8da08f8eeeeb6ad486db958f1ef50f5e887969bf6423db6cf446d8de79d647"}
        policy = policy_fixture()
        run = "parameter90-cpu-current-fixture" if cpu else "parameter90-gpu-fixture"
        request = dict(schemaVersion="parameter90-causal-gpu-request-v1", policy=binding,
            runId=run, outputRoot=policy["outputRoot"]+"/"+run, mode="cpu_preflight" if cpu else "gpu_diagnostic",
            nodeInterpreter=dict(NODE_BINDING),
            programBindings=[{"path": "ml/ai-painter/scripts/diagnose_parameter90_causal_gpu_v1.py", "sha256": "a"*64}, dict(CANONICAL_PROGRAM)],
            deadlineUnixMs=1001000)
        return policy, request

    def test_cpu_and_gpu_envelopes_share_original_deadline_without_fallback(self):
        for cpu in (True, False):
            policy, request = self.policy_request(cpu)
            worker.validate_request(request, policy, cpu=cpu, now=1000)
            for key, value in (("policy", dict(path="data/ai-painter/system-governance/old-policy.json", sha256="a"*64)),
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
        a = {"path": "private/only-train172.json", "sha256": "a"*64}
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
        image = binding("train172.png", b"CPU-fixture-source")
        ecology = dict(season="wet_season", snapshotId="synthetic-only", landscapeType="forested-low-mountain")
        material = dict(season="wet_season", weather="rain", lighting="overcast", groundMoisture="wet")
        fact = binding("facts.json", {})
        climate = dict(sourceId="synthetic-climate", role="regional_climate_and_monsoon_context",
            license="synthetic-license", attribution="synthetic-attribution", acquisitionStatus="metadata_only",
            visualTrainingTargetEligible=False)
        registry = binding("registry.json", dict(sources=[climate]))
        season = binding("season.json", dict(schemaVersion="natural-home-visual-snapshot-v1",
            status="provisional_owner_authorized_profile_seasonal_transition", isFinal=False,
            usage=dict(originalImageCoverageBaseline=True), snapshotId=ecology["snapshotId"], environment=material))
        regional = binding("regional.json", dict(synthetic=True))
        region_payload = dict(sourceProvenance=dict(sourceRegistryPath=registry["path"], sourceRegistrySha256=registry["sha256"],
            seasonSnapshotPath=season["path"], seasonSnapshotSha256=season["sha256"],
            worldProfilePath=regional["path"], worldProfileSha256=regional["sha256"], sources=[climate]))
        # ASCII-only synthetic JSON: independently sorted in Python, recomputed
        # by the real Node canonicalSha256 in the original bound_regime below.
        canonical_sha = worker.capture.digest(json.dumps(region_payload, sort_keys=True, separators=(",", ":")).encode())
        region = binding("region.json", dict(**region_payload, packageSha256=canonical_sha))
        task = binding("task.json", dict(sourceBindings=dict(naturalizedWorldFactsPath=fact["path"],
            naturalizedWorldFactsSha256=fact["sha256"], seasonSnapshotPath=season["path"], seasonSnapshotSha256=season["sha256"],
            regionalProfilePath=regional["path"], regionalProfileSha256=regional["sha256"], realEarthRegionSourcePackagePath=region["path"],
            realEarthRegionSourcePackageSha256=canonical_sha), directorPlan=dict(singleMapEcologyPlan=ecology, singleMapMaterialPlan=material)))
        condition = binding("condition.json", dict(objectInstanceTable=[], sourceBindings=dict(taskPackagePath=task["path"]),
            categoricalConditions=dict(ecologyPlan=ecology, materialPlan=material)))
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
            return dict(sampleId=identity["sampleId"], split="train", objectInstanceTable=[], image=torch.ones(3, 192, 256),
                conditions=torch.ones(23, 192, 256)), deepcopy(identity)
        with patch.object(worker, "CURRENT_POLICY", {"schemaVersion": worker.restore.CURRENT_SCHEMA}):
            profile = worker._profile()
        self.enterContext(patch.object(worker, "_profile", return_value=profile))
        cpu = profile.inherited.core.cpu
        # Replace only the leaf dataset/raster I/O with private JSON/tensors.
        # Profile dispatch, derive/bound_regime, seasonal/ecological binding and
        # validation all remain their actual source implementations.
        self.enterContext(patch.object(cpu, "MANIFEST", dataset))
        self.enterContext(patch.object(cpu, "CONDITION_CONTRACT", contract))
        self.enterContext(patch.object(cpu, "load_sample", side_effect=load))
        self.assertFalse(hasattr(cpu, "load_samples"))
        predecessor = profile.inherited.predecessor
        self.assertEqual(Path(predecessor.__file__).name, "painter_stage4_appearance_regime_probe.py")
        manifest = dict(context=dict(sampleIdentity=identity, programBindings={}))
        canonical_raw = (ROOT / CANONICAL_PROGRAM["path"]).read_bytes()
        self.assertEqual(worker.capture.digest(canonical_raw), CANONICAL_PROGRAM["sha256"])
        blobs[CANONICAL_PROGRAM["path"]] = canonical_raw
        extra = binding("unrelated-program.mjs", b"// not authorized by a request program list")
        programs = [dict(CANONICAL_PROGRAM), extra]
        derive = predecessor.derive_regime_record
        bound = derive.__globals__["bound_regime"]
        snapshot = worker._SingleSampleReader.snapshot
        self.assertEqual(Path(bound.__code__.co_filename).name, "object_appearance_regime_input_cpu.py")
        traced = []
        def trace(frame, event, arg):
            if event == "call":
                if frame.f_code is derive.__code__: traced.append("derive")
                elif frame.f_code is bound.__code__: traced.append("bound")
                elif frame.f_code is snapshot.__code__ and frame.f_locals.get("logical") == CANONICAL_PROGRAM["path"]:
                    traced.append("canonical-snapshot")
        previous_trace = sys.getprofile()
        try:
            sys.setprofile(trace)
            with patch.object(worker, "_profile", return_value=profile):
                sample, actual_order, reader = worker.load_failure_sample(Mapping(), manifest, resource=lambda: None, programs=programs)
        finally:
            sys.setprofile(previous_trace)
        self.assertEqual(traced[:3], ["derive", "bound", "canonical-snapshot"])
        self.assertEqual(traced.count("derive"), 1)
        self.assertGreaterEqual(traced.count("bound"), 3)
        self.assertGreaterEqual(traced.count("canonical-snapshot"), 3)
        self.assertEqual(type(sample["_ecology_regime_binding"]).__name__, "_EcologyBinding")
        self.assertEqual(sample["ecology_regime"].tolist(), [0.,0.,1.,0.,0.,0.,0.])
        self.assertEqual(reader.observed[CANONICAL_PROGRAM["path"]], CANONICAL_PROGRAM["sha256"])
        self.assertEqual(reader.snapshot(CANONICAL_PROGRAM["path"]), (canonical_raw, CANONICAL_PROGRAM))
        self.assertEqual({path for path in reader.allowed if path.endswith(".mjs")}, {CANONICAL_PROGRAM["path"]})
        self.assertNotIn(extra["path"], calls)
        self.assertIn(region["path"], calls)
        self.assertIn(registry["path"], calls)
        self.assertNotEqual(region["sha256"], canonical_sha)
        for forbidden in (extra, dict(path="private/validation.png", sha256="a"*64)):
            with self.assertRaisesRegex(ValueError, "undeclared"):
                reader.snapshot(forbidden["path"])
        for invalid in ([], [dict(CANONICAL_PROGRAM, sha256="0"*64)],
                        [dict(CANONICAL_PROGRAM, path="private/canonical-copy.mjs")],
                        [dict(CANONICAL_PROGRAM), dict(CANONICAL_PROGRAM)]):
            with self.subTest(programs=invalid), patch.object(worker, "_profile", return_value=profile), \
                 self.assertRaisesRegex(ValueError, "canonical|program"):
                worker.load_failure_sample(Mapping(), manifest, resource=lambda: None, programs=invalid)
        blobs[CANONICAL_PROGRAM["path"]] = b"// changed canonical bytes"
        with patch.object(worker, "_profile", return_value=profile), self.assertRaisesRegex(ValueError, "SHA"):
            worker.load_failure_sample(Mapping(), manifest, resource=lambda: None, programs=programs)
        self.assertEqual(sample["sampleId"], worker.restore.SAMPLE_ID)
        self.assertEqual(actual_order, order)
        self.assertFalse(any("validation" in path for path in calls))
        with self.assertRaisesRegex(ValueError, "undeclared"):
            reader.read(dict(path="private/validation.png", sha256="a"*64))

class MetadataNodeTests(unittest.TestCase):
    def tearDown(self): self.assertFalse(torch.cuda.is_initialized())

    def node_fixture(self, change=None):
        policy = policy_fixture()
        request = dict(nodeInterpreter=dict(NODE_BINDING), programBindings=[dict(CANONICAL_PROGRAM)])
        original = dict(absolutePath=NODE_BINDING["path"], sha256=NODE_BINDING["sha256"])
        if change == "request": request["nodeInterpreter"]["sha256"] = "0"*64
        elif change == "original_path": original["absolutePath"] = str(ROOT / "private/unbound-node.exe")
        elif change == "original_sha": original["sha256"] = "0"*64
        elif change == "bytes":
            original["sha256"] = "0"*64
            policy["nodeInterpreter"]["sha256"] = "0"*64
            request["nodeInterpreter"]["sha256"] = "0"*64
        elif change == "canonical": request["programBindings"][0]["sha256"] = "0"*64
        elif change == "canonical_policy": policy["metadataCanonicalProgram"]["path"] = "private/canonical.mjs"
        raw = json.dumps(dict(runtimeIdentity=dict(node=original))).encode()
        plan = dict(path="private/synthetic-failure/quality-plan.json", sha256=worker.capture.digest(raw))
        policy["sourceEvidence"] = [plan]
        calls = []
        class Mapping:
            def binding(self, bound, maximum=2*1024**2):
                calls.append(dict(bound))
                if bound == CANONICAL_PROGRAM:
                    value = (ROOT / bound["path"]).read_bytes()
                else:
                    worker.require(bound == plan, "fixture undeclared plan")
                    value = raw
                worker.require(len(value) <= maximum and worker.capture.digest(value) == bound["sha256"], "fixture SHA")
                return value
        return Mapping(), policy, request, calls, plan

    def test_actual_node_bytes_and_original_plan_are_verified_before_archive_loading(self):
        mapping, policy, request, calls, plan = self.node_fixture()
        with patch.object(worker.restore, "prepare_exact_failure_state", side_effect=AssertionError("archive forbidden")):
            actual = worker._verify_metadata_node(mapping, policy, request)
        self.assertEqual(actual, dict(**NODE_BINDING, verified=True))
        self.assertEqual(calls, [CANONICAL_PROGRAM, plan])
        self.assertEqual(worker.CANONICAL_PROGRAM, CANONICAL_PROGRAM)

    def test_node_original_identity_request_canonical_and_actual_byte_mismatches_refuse(self):
        for change in ("request", "original_path", "original_sha", "bytes", "canonical", "canonical_policy"):
            with self.subTest(change=change):
                mapping, policy, request, _, _ = self.node_fixture(change)
                with self.assertRaises(ValueError):
                    worker._verify_metadata_node(mapping, policy, request)
        for discovered in (None, str(ROOT / "private/unbound-node.exe")):
            mapping, policy, request, _, _ = self.node_fixture()
            with patch.object(worker.shutil, "which", return_value=discovered), \
                 self.assertRaisesRegex(ValueError, "PATH identity"):
                worker._verify_metadata_node(mapping, policy, request)

    def test_old_schema_namespace_or_unbound_canonical_cannot_enter_v1(self):
        for change in ("request_schema", "policy_schema", "namespace", "canonical", "node"):
            policy, request = EnvelopeAndSampleTests().policy_request()
            if change == "request_schema": request["schemaVersion"] = "parameter48-causal-gpu-request-v2"
            elif change == "policy_schema": policy["schemaVersion"] = "ai-painter-parameter48-causal-gpu-policy-v2"
            elif change == "namespace": policy["outputRoot"] = ".runtime/ai-painter/parameter90-causal-gpu-diagnostics"
            elif change == "canonical": request["programBindings"] = request["programBindings"][:1]
            else: request["nodeInterpreter"] = dict(NODE_BINDING, sha256="0"*64)
            with self.subTest(change=change), self.assertRaises(ValueError):
                worker.validate_request(request, policy, cpu=True, now=1000)


class CompleteMainFixtureTests(unittest.TestCase):
    """Real parser/restore/serialization with synthetic bytes and a toy factory."""
    def run_main_fixture(self, gpu):
        g, d, sample, profile, calls = fixture("target")
        # Match the complete108/2242687 metadata budget without a real renderer.
        g.prefix[0] = nn.Parameter(torch.zeros(2242435))
        graph = [{"name": n, "shape": list(p.shape), "dtype": str(p.dtype), "elements": p.numel()}
                 for n, p in g.named_parameters()]
        self.assertEqual(sum(r["elements"] for r in graph), 2242687)
        private_directory = tempfile.TemporaryDirectory(prefix="cp90-main-")
        self.addCleanup(private_directory.cleanup)
        private = Path(private_directory.name)
        blobs, read_paths = {}, []
        def binding(path, value):
            raw = value if isinstance(value, bytes) else json.dumps(value, sort_keys=True).encode()
            blobs[path] = raw
            return {"path": path, "sha256": worker.capture.digest(raw)}
        class Mapping:
            project = ROOT
            def check(self): pass
            def path(self, logical): return private / logical
            def binding(self, bound, maximum=2*1024**2):
                self_outer.assertEqual(set(bound), {"path", "sha256"})
                read_paths.append(bound["path"])
                raw = blobs[bound["path"]]
                worker.require(len(raw) <= maximum and worker.capture.digest(raw) == bound["sha256"], "synthetic binding differs")
                return raw
        self_outer = self
        mapping = Mapping()
        programs = {}
        for module in tuple(sys.modules.values()):
            filename = getattr(module, "__file__", None)
            if not filename: continue
            path = Path(filename).absolute()
            if path.suffix == ".py" and any(path.is_relative_to(ROOT / p) for p in ("ml/ai-painter/src", "ml/ai-painter/scripts")):
                logical = path.relative_to(ROOT).as_posix()
                programs["module:"+logical] = binding(logical, path.read_bytes())
        policy = policy_fixture()
        for item in policy["sourceAlgorithmBindings"]:
            path = item["binding"]["path"]
            programs[item["role"]] = binding(path, (ROOT / path).read_bytes())
            item["binding"] = programs[item["role"]]
        programs = {b["path"]: b for b in programs.values()}
        program_list = list(programs.values())
        program_list.append(binding(CANONICAL_PROGRAM["path"], (ROOT / CANONICAL_PROGRAM["path"]).read_bytes()))
        payload, descriptors, networks = {}, {}, {}
        for prefix, network in (("generator", g), ("discriminator", d)):
            rows = []
            for i, (name, value) in enumerate(network.named_parameters()):
                key = prefix + ".parameter." + str(i)
                tensor = value.detach().clone()
                payload[key] = tensor
                descriptors[key] = {"shape": list(tensor.shape), "dtype": str(tensor.dtype),
                    "bytes": tensor.numel()*tensor.element_size(), "sha256": worker.capture.tensor_sha(tensor),
                    "sourceVersion": value._version, "sourceDevice": "cpu", "capturedAtUtc": "synthetic", "allFinite": True}
                rows.append({"kind": "parameter", "name": name, "key": key})
            networks[prefix] = {"state": rows, "modes": {n: m.training for n, m in network.named_modules()},
                                "timing": "after_exception", "capturedAtUtc": "synthetic"}
        payload["rng.torch_cpu"] = torch.zeros(1, dtype=torch.uint8)
        descriptors["rng.torch_cpu"] = {"shape": [1], "dtype": "torch.uint8", "bytes": 1,
            "sha256": worker.capture.tensor_sha(payload["rng.torch_cpu"]), "sourceVersion": 0,
            "sourceDevice": "cpu", "capturedAtUtc": "synthetic", "allFinite": True}
        source = ".runtime/synthetic-parameter90-source/"
        archive_raw = worker.capture.archive_bytes(payload)
        archive = {**binding(source+"gradient-failure/tensors.pt", archive_raw), "bytes": len(archive_raw)}
        identity = binding(source+"model-identity.json", {"graph": graph})
        package = binding(source+"package.json", {"synthetic": True})
        image = binding(source+"source.png", b"synthetic source binding, never image-decoded")
        condition = binding(source+"condition.json", {})
        position = {"epoch": 15, "zeroBasedEpochPosition": 8, "trainIndex": 28, "sampleId": worker.restore.SAMPLE_ID}
        context = {"runId": "synthetic-failed-run", "sampleId": worker.restore.SAMPLE_ID, "split": "train",
            "failurePosition": position, "optimizerSteps": {"generator": 680, "discriminator": 681},
            "executionPackage": package, "modelBinding": identity, "programBindings": programs,
            "sampleBindings": {"source": image, "condition": condition},
            "sampleIdentity": {"channels": [{"id": v} for v in g.condition_channel_order]}}
        error = {"type": "ValueError", "message": worker.TARGET_ERROR}
        primary = binding(source+"gradient-failure/primary.json", {"context": context, "primaryError": error, "timing": "after_exception"})
        execution = binding(source+"capture-execution.json", {"schema": "object-support-structure-failure-capture-execution-v1",
            "runId": context["runId"], "modelBinding": identity, "programBindings": programs})
        interpreter = {"path": sys.executable, "sha256": worker.capture.digest(Path(sys.executable).read_bytes())}
        plan = binding(source+"quality-plan.json", {"runId": context["runId"], "modelBinding": identity,
            "programBindings": programs, "runtimeIdentity": {"python": {"absolutePath": sys.executable, "sha256": interpreter["sha256"]},
                "node": {"absolutePath": NODE_BINDING["path"], "sha256": NODE_BINDING["sha256"]}}})
        gradients = [{"label": label, "parameters": [{"index": i, "name": row["name"], "key": None, "unused": True}
                     for i, row in enumerate(graph)]} for label in worker.LABELS]
        manifest = {"schema": worker.capture.SCHEMA, "status": "captured", "archiveEncoding": "gzip-torch-flat-cpu-v1",
            "context": context, "graph": graph, "labels": list(worker.LABELS), "gradients": gradients,
            "networks": networks, "tensorDescriptors": descriptors, "decompressedBytes": sum(d["bytes"] for d in descriptors.values()),
            "stateTiming": "after_exception", "missing": [], "nonfiniteTensorKeys": [], "qualificationAllowed": False,
            "replayAllowed": False, "rng": {"timing": "after_exception", "cudaDevices": [], "numpy": ["synthetic"]},
            "artifacts": {"primary": {**primary, "bytes": len(blobs[primary["path"]])}, "tensors": archive}, "executionBinding": execution}
        manifest_binding = binding(source+"gradient-failure/manifest.json", manifest)
        terminal = binding(source+"worker-terminal.json", {"schema": "object-support-structure-quality-worker-terminal-v1",
            "status": "failed_closed", "executionState": "failed_closed", "runId": context["runId"],
            "executionPackage": package, "originalError": error, "failurePosition": position, "optimizerSteps": context["optimizerSteps"],
            "captureReceipt": {"replayAllowed": False, "artifacts": {"tensors": archive}}})
        evidence = [plan, identity, terminal, manifest_binding, primary, execution]
        hashes = {b["path"][len(source):]: b["sha256"] for b in evidence}
        policy.update(sourceEvidence=evidence, sourceTensorArchive=archive, sourceSampleBindings=context["sampleBindings"])
        policy["scope"]["failureRunId"] = "synthetic-failed-run"
        formal = binding("private/formal.txt", b"synthetic normative fixture")
        policy["formalSpecification"] = {**formal, "version": "AI-PAINTER-SPEC-1.101", "path": "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"}
        blobs[policy["formalSpecification"]["path"]] = blobs[formal["path"]]
        policy["designBinding"] = binding("private/design.json", {"synthetic": True})
        policy_binding = binding(worker.GPU_POLICY_PATH, policy)
        run = "parameter90-gpu-fixture" if gpu else "parameter90-cpu-current-fixture"
        output = policy["outputRoot"]+"/"+run
        mapping.path(output).mkdir(parents=True)
        request = {"schemaVersion": "parameter90-causal-gpu-request-v1", "runId": run, "outputRoot": output,
            "policy": policy_binding, "mode": "gpu_diagnostic" if gpu else "cpu_preflight", "interpreter": interpreter,
            "nodeInterpreter": dict(NODE_BINDING),
            "programBindings": program_list, "deadlineUnixMs": int(time.time()*1000)+119000}
        if gpu:
            request["cpuAcceptance"] = binding(policy["outputRoot"]+"/parameter90-cpu-current-other-fixture/cpu-acceptance.json", {
                "schemaVersion": "parameter90-current-cpu-acceptance-v1", "status": "current_cpu_accepted_not_gpu_result",
                "policy": policy_binding, "programBindings": program_list, "interpreter": interpreter, "nodeInterpreter": dict(NODE_BINDING),
                "worker": {"status": "cpu_preflight_passed_not_gpu_or_root_cause", "cpuComponentTests": {"status": "passed"}}})
        request_binding = binding("private/request.json", request)
        argv = ["synthetic-worker", "--request", request_binding["path"], "--request-sha256", request_binding["sha256"]]
        if not gpu: argv.append("--cpu-preflight")
        fake_reader = types.SimpleNamespace(observed={"synthetic": True}, unchanged=lambda: None)
        printed = io.StringIO()
        with contextlib.ExitStack() as stack:
            stack.enter_context(patch.object(sys, "argv", argv))
            stack.enter_context(patch.object(worker, "GPU_POLICY", None))
            stack.enter_context(patch.object(worker, "run_cpu_component_tests", return_value={"status": "passed", "testsRun": 2}))
            stack.enter_context(patch.object(worker, "_configure_cpu_affinity", return_value=(types.SimpleNamespace(cpu_affinity=lambda: [0,1]), [0,1])))
            stack.enter_context(patch.object(worker.capture.RuntimeMap, "current", return_value=mapping))
            stack.enter_context(patch.object(worker.restore, "SOURCE_ROOT", source))
            stack.enter_context(patch.object(worker.restore, "SOURCE_HASHES", hashes))
            stack.enter_context(patch.object(worker.restore, "ARCHIVE_SHA", archive["sha256"]))
            stack.enter_context(patch.object(worker.restore, "ARCHIVE_BYTES", archive["bytes"]))
            stack.enter_context(patch.object(worker.restore, "_fresh_networks", return_value=(g, d)))
            stack.enter_context(patch.object(worker, "load_failure_sample", return_value=(sample, g.condition_channel_order, fake_reader)))
            stack.enter_context(patch.object(worker, "_profile", return_value=profile))
            stack.enter_context(patch.object(worker, "Parameter90Observer", MicroObserver))
            stack.enter_context(patch.object(worker.restore, "SOURCE_RUN_ID", "synthetic-failed-run"))
            stack.enter_context(patch.object(worker.gate_module, "bind_parameters", side_effect=lambda m: (tuple(m.parameters()), {}, 106, 107)))
            stack.enter_context(patch.object(worker.gate_module, "_validate_model_and_parameters", side_effect=lambda m, p: (tuple(p), {})))
            stack.enter_context(patch.object(torch.optim, "AdamW", side_effect=AssertionError("optimizer forbidden")))
            if gpu:
                stack.enter_context(patch.object(torch.cuda, "set_per_process_memory_fraction"))
                stack.enter_context(patch.object(torch.cuda, "mem_get_info", return_value=(8*1024**3, 16*1024**3)))
                stack.enter_context(patch.object(g, "to", return_value=g))
                stack.enter_context(patch.object(d, "to", return_value=d))
            with contextlib.redirect_stdout(printed): worker.main()
        result = json.loads(printed.getvalue())
        self.assertNotIn("error", result, result)
        self.assertEqual(result["status"], "diagnostic_target_evidence_complete" if gpu else "cpu_preflight_passed_not_gpu_or_root_cause")
        self.assertEqual(result["counts"]["generatorForwards"], 1 if gpu else 0)
        self.assertEqual(result["counts"]["generatorAutogradCompleted"] if gpu else result["counts"]["generatorAutogradAttempts"], 5 if gpu else 0)
        self.assertFalse(result["historicalReplayAllowed"])
        self.assertFalse(result["rootCauseProven"])
        saved = mapping.path(result["workerResult"]["path"])
        self.assertEqual(worker.capture.digest(saved.read_bytes()), result["workerResult"]["sha256"])
        if gpu:
            self.assertEqual(result["counts"]["localFp64WeightVjp"], 5)
            self.assertEqual(result["counts"]["discriminatorAutograd"], 0)
            contrast = torch.load(io.BytesIO(mapping.path(result["artifacts"]["contrastTensors"]["path"]).read_bytes()), weights_only=True)
            self.assertNotIn("upstreamAdjointDifference", contrast)
            self.assertEqual(len([k for k in contrast if k.startswith("reference.")]), 5)
        self.assertTrue(all(path in blobs for path in read_paths))
        self.assertFalse(torch.cuda.is_initialized())

    def test_complete_cpu_main_safe_archive_restore_and_receipt(self):
        self.run_main_fixture(False)

    def test_complete_gpu_branch_on_cpu_toy_no_real_cuda_five_capture_and_small_contrast(self):
        self.run_main_fixture(True)


class CpuComponentRunnerTests(unittest.TestCase):
    def test_runs_exactly_two_bound_suites_in_process_and_rejects_failure_or_skip(self):
        paths = worker.CPU_TEST_PATHS
        raw = b"# synthetic bound component source\n"
        bindings = [{"path": logical, "sha256": worker.capture.digest(raw)} for logical in paths]
        calls = []
        class Mapping:
            def binding(self, bound, maximum):
                calls.append(bound["path"])
                return raw
        fake = unittest.FunctionTestCase(lambda: None)
        modules = {Path(p).stem: types.SimpleNamespace(__file__=str(ROOT/p)) for p in paths}
        with patch.object(worker.importlib, "import_module", side_effect=lambda name: modules[name]), \
             patch.object(Path, "read_bytes", return_value=raw), \
             patch.object(unittest.TestLoader, "loadTestsFromModule", side_effect=lambda module: unittest.TestSuite([fake])):
            result = worker.run_cpu_component_tests(Mapping(), bindings, resource=lambda: None)
        self.assertEqual(result["status"], "passed")
        self.assertEqual(result["testsRun"], 2)
        self.assertEqual(result["processId"], worker.os.getpid())
        self.assertEqual(calls, list(paths))
        with patch.object(Path, "read_bytes", return_value=raw), \
             patch.object(worker.importlib, "import_module", side_effect=lambda name: modules[name]), \
             patch.object(unittest.TestLoader, "loadTestsFromModule", side_effect=lambda module: unittest.TestSuite([unittest.FunctionTestCase(lambda: None)])), \
             self.assertRaisesRegex(ValueError, "unbound"):
            worker.run_cpu_component_tests(Mapping(), bindings[:1], resource=lambda: None)

    def test_failed_or_skipped_component_cannot_become_cpu_acceptance(self):
        paths = worker.CPU_TEST_PATHS
        bindings = [{"path": p, "sha256": "a"*64} for p in paths]
        raw = b"# synthetic bound component source\n"
        class Mapping:
            def binding(self, bound, maximum): return raw
        modules = {Path(p).stem: types.SimpleNamespace(__file__=str(ROOT/p)) for p in paths}
        for skip in (False, True):
            def case():
                if skip: raise unittest.SkipTest("fixture skip")
                raise AssertionError("fixture failure")
            with patch.object(worker.importlib, "import_module", side_effect=lambda name: modules[name]), \
                 patch.object(Path, "read_bytes", return_value=raw), \
                 patch.object(unittest.TestLoader, "loadTestsFromModule", side_effect=lambda module: unittest.TestSuite([unittest.FunctionTestCase(case)])), \
                 self.assertRaisesRegex(ValueError, "failed/skipped"):
                worker.run_cpu_component_tests(Mapping(), bindings, resource=lambda: None)

    def test_affinity_is_set_and_read_back_without_system_changes(self):
        class Process:
            affinity = [2,3,4]
            def cpu_affinity(self, values=None):
                if values is not None: self.affinity = list(values)
                return list(self.affinity)
        process = Process()
        import psutil
        with patch.object(psutil, "Process", return_value=process):
            _, observed = worker._configure_cpu_affinity()
        self.assertEqual(observed, [2,3])
        self.assertEqual(process.affinity, [2,3])


if __name__ == "__main__": unittest.main()
