"""Synthetic-only authentication and real legacy guard-to-four-VJP integration."""
import ast, copy, hashlib, inspect, json, sys, tempfile, time, unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch
import torch
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import diagnose_stage4_detail_weight_precision_counterfactual_gpu as driver
from ai_painter.complete_world import object_appearance_regime_detail_weight_precision as model_api
from ai_painter.complete_world import object_appearance_regime_bias_precision as old
from ai_painter.complete_world import object_appearance_regime_detail_weight_priority_update as bridge
from ai_painter.complete_world.object_appearance_regime_input_cpu import encode_season, SEASONS
from test_object_appearance_regime_conditioned_cpu import ORDER, scene


class Critic(torch.nn.Module):
    def __init__(self):
        super().__init__(); self.values = torch.nn.ParameterList(
            [torch.nn.Parameter(torch.ones(1)) for _ in range(14)])
    def forward(self, value): return value


class Reader:
    root = ROOT
    observed = {"synthetic-source-proof": "b" * 64}
    def unchanged(self): pass


def authenticated_fixture(predecessor, critic):
    tensors, descriptors, networks = {}, {}, {}
    for family, network in (("model", predecessor), ("critic", critic)):
        metadata = {"parameters": [], "buffers": [], "modes": {n: m.training for n, m in network.named_modules()}}
        for kind, rows in (("parameters", network.named_parameters()), ("buffers", network.named_buffers())):
            for i, (name, value) in enumerate(rows):
                key = f"{family}.{kind[:-1]}.{i}"; tensor = value.detach().clone()
                tensors[key] = tensor
                item = {"name": name, "key": key, "shape": list(tensor.shape), "dtype": str(tensor.dtype)}
                descriptors[key] = {"shape": item["shape"], "dtype": item["dtype"]}
                if kind == "parameters": item.update(requiresGrad=value.requires_grad, gradientKey=None)
                metadata[kind].append(item)
        networks[family] = metadata
    return {"reader": Reader(), "context": {"manifest": {"networks": networks, "tensorDescriptors": descriptors}},
        "data": {"sources": {driver.TEST: hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}},
        "tensors": tensors, "archivePreflight": {"syntheticMock": True},
        "terminalBinding": driver.core.SOURCE_FAILURE, "historyBinding": driver.legacy.HISTORY}


class SyntheticGraphProfile:
    def __init__(self, kind="pass"): self.kind = kind
    observe_generator_gradients = staticmethod(bridge.observe_generator_gradients)
    def sample_forward(self, model, sample):
        if self.kind == "rng": torch.random.default_generator.manual_seed(77)
        return model(sample["conditions"], sample["objectInstanceTable"], appearance_regime=sample["appearance_regime"])
    def _generator_candidate(self, model, critic, sample, order, prediction):
        mean = prediction.mean(); structured = mean * .25; whole = mean * .125; core = mean * .25
        if self.kind == "input": sample["image"].add_(1)
        candidate, facts = bridge.compute_generator_candidate_gradients(model=model, critic=critic, sample=sample,
            actual_total=(structured.float() + whole).float() + core, structured_objective=structured,
            whole_frame_fidelity=whole, object_core_rgb=core)
        if self.kind == "late": raise ValueError("synthetic late after four gradients")
        return mean, candidate, facts


class ImportTests(unittest.TestCase):
    def setUp(self):
        torch.set_num_threads(2)
        self.rng = torch.random.get_rng_state().clone()
        self.model = model_api.build_fresh_object_appearance_regime_detail_weight_precision(condition_channel_order=ORDER)
        self.critic = Critic()
        self.old = old.build_fresh_object_appearance_regime_bias_precision(condition_channel_order=ORDER)
        self.proof = authenticated_fixture(self.old, self.critic)
    def tearDown(self):
        self.assertTrue(torch.equal(self.rng, torch.random.get_rng_state()))
        self.assertFalse(torch.cuda.is_initialized())
    def invoke(self, proof=None):
        with patch.object(model_api, "authenticate_diagnostic_capture", return_value=proof or self.proof):
            return model_api.import_diagnostic_failure_state(model=self.model, critic=self.critic, root=ROOT,
                terminal_binding=driver.core.SOURCE_FAILURE, history_binding=driver.legacy.HISTORY,
                deadline=time.monotonic() + 30)
    def digest(self):
        return driver.core.state_snapshot(self.model), driver.core.state_snapshot(self.critic)

    def test_complete_synthetic_install_only_numeric_buffer_changes(self):
        result = self.invoke()
        expected = self.old.state_dict(); actual = self.model.state_dict()
        for key in expected:
            if key != "numeric_identity": self.assertTrue(torch.equal(actual[key], expected[key]), key)
        self.assertFalse(torch.equal(actual["numeric_identity"], expected["numeric_identity"]))
        self.assertTrue(result["receipt"]["diagnosticOnly"])
        self.assertFalse(result["receipt"]["trainingInitialization"])
        self.assertEqual(result["receipt"]["excludedCrossBaselineBuffers"], ["numeric_identity"])

    def test_all_metadata_rejections_are_before_writes(self):
        changes = ("missing", "order", "shape", "dtype", "finite", "identity", "modes", "requires", "gradient")
        for change in changes:
            proof = copy.deepcopy(self.proof); metadata = proof["context"]["manifest"]["networks"]["model"]
            key = metadata["parameters"][0]["key"]
            if change == "missing": metadata["parameters"].pop()
            elif change == "order": metadata["parameters"][0], metadata["parameters"][1] = metadata["parameters"][1], metadata["parameters"][0]
            elif change == "shape": proof["tensors"][key] = torch.zeros(1)
            elif change == "dtype": proof["tensors"][key] = proof["tensors"][key].double()
            elif change == "finite": proof["tensors"][key].fill_(float("nan"))
            elif change == "identity": proof["tensors"]["model.buffer.1"].zero_()
            elif change == "modes": metadata["modes"].pop("")
            elif change == "requires": metadata["parameters"][0]["requiresGrad"] = False
            else: metadata["parameters"][0]["gradientKey"] = "bad"
            before = self.digest()
            with self.subTest(change=change), self.assertRaises((ValueError, KeyError)): self.invoke(proof)
            self.assertEqual(before, self.digest())

    def test_critic_partial_modes_and_nonfinite_reject_before_generator_write(self):
        for change in ("partial", "modes", "finite"):
            proof = copy.deepcopy(self.proof); metadata = proof["context"]["manifest"]["networks"]["critic"]
            if change == "partial": metadata["parameters"].pop()
            elif change == "modes": metadata["modes"]["unknown"] = True
            else: proof["tensors"]["critic.parameter.0"].fill_(float("inf"))
            before = self.digest()
            with self.assertRaises(ValueError): self.invoke(proof)
            self.assertEqual(before, self.digest())

    def test_old_ordinary_load_and_verified_shortcut_rejected(self):
        before = self.digest()
        with self.assertRaises(ValueError): self.model.load_state_dict(self.old.state_dict())
        with self.assertRaises(TypeError): model_api.import_diagnostic_failure_state(state=self.old.state_dict(), verified=True)
        self.assertEqual(before, self.digest())

    def test_fixed_failure_root_source_sha_reject_before_capture_load(self):
        with patch.object(driver.safe, "load_capture", side_effect=AssertionError("capture load forbidden")):
            with self.assertRaisesRegex(ValueError, "root"):
                model_api.authenticate_diagnostic_capture(root=ROOT.parent, terminal_binding={}, history_binding={}, deadline=time.monotonic()+10)
            with self.assertRaisesRegex(ValueError, "binding"):
                model_api.authenticate_diagnostic_capture(root=ROOT, terminal_binding={}, history_binding={}, deadline=time.monotonic()+10)
            with patch.dict(model_api._DIAGNOSTIC_FROZEN, {driver.core.ENTRY: "0"*64}):
                with self.assertRaisesRegex(ValueError, "source"):
                    model_api.authenticate_diagnostic_capture(root=ROOT, terminal_binding=driver.core.SOURCE_FAILURE,
                        history_binding=driver.legacy.HISTORY, deadline=time.monotonic()+10)

    def test_archive_hash_and_weights_only_path_is_explicit_in_frozen_sources(self):
        source = inspect.getsource(model_api.authenticate_diagnostic_capture)
        self.assertIn("inspect_tensor_archive", source); self.assertIn("locked_capture_archive", source)
        self.assertIn("capture._verify_tensors", source); self.assertIn('safe.digest(raw) == artifact["sha256"]', source)
        capture = ROOT / driver.safe.CAPTURE
        text = capture.read_text(encoding="utf-8")
        self.assertIn('weights_only=True', text)
        self.assertEqual(hashlib.sha256(capture.read_bytes()).hexdigest(), driver.safe.CAPTURE_SHA)

    def test_exact_nonexecuted_cpu_js_snapshot_and_provenance(self):
        reader = driver.CounterfactualCpuEvidenceReader(ROOT, time.monotonic()+10)
        file = reader.bound({"path": driver.CPU_JS_TEST, "sha256": driver.CPU_JS_TEST_SHA}, json_data=False)
        self.assertEqual(hashlib.sha256(file.read_bytes()).hexdigest(), driver.CPU_JS_TEST_SHA)
        self.assertIn(driver.CPU_JS_TEST, reader.observed)
        self.assertIn(driver.CPU_JS_TEST_SNAPSHOT["path"], reader.observed)
        self.assertIn(driver.CPU_JS_BASELINE["path"], reader.observed)
        reader.unchanged()

    def test_cpu_snapshot_mapping_rejects_wrong_hash_json_or_other_source(self):
        reader = driver.CounterfactualCpuEvidenceReader(ROOT, time.monotonic()+10)
        with self.assertRaisesRegex(ValueError, "binding"):
            reader.bound({"path": driver.CPU_JS_TEST, "sha256": "0"*64}, json_data=False)
        with self.assertRaisesRegex(ValueError, "binding"):
            reader.bound({"path": driver.CPU_JS_TEST, "sha256": driver.CPU_JS_TEST_SHA}, json_data=True)
        with self.assertRaisesRegex(ValueError, "SHA"):
            reader.bound({"path": driver.MODEL, "sha256": "0"*64}, json_data=False)
        with patch.dict(driver.CPU_JS_TEST_SNAPSHOT, {"sha256": "0"*64}):
            with self.assertRaisesRegex(ValueError, "SHA"):
                reader.bound({"path": driver.CPU_JS_TEST, "sha256": driver.CPU_JS_TEST_SHA}, json_data=False)


class IntegrationTests(unittest.TestCase):
    def setUp(self):
        torch.set_num_threads(2); self.rng = torch.random.get_rng_state().clone()
    def tearDown(self):
        self.assertTrue(torch.equal(self.rng, torch.random.get_rng_state()))
        self.assertFalse(torch.cuda.is_initialized())
    def run_graph(self, kind="pass"):
        model = model_api.build_fresh_object_appearance_regime_detail_weight_precision(condition_channel_order=ORDER)
        critic = Critic()
        conditions, table = scene()
        sample = {"split": "train", "conditions": conditions, "image": torch.zeros(1,3,192,256),
            "appearance_regime": encode_season(SEASONS[0]), "objectInstanceTable": table}
        allowed = {str(Path(inspect.getfile(type(m))).resolve()) for network in (model,critic)
            for m in network.modules() if not type(m).__module__.startswith("torch.nn")}
        before = driver.core.state_snapshot(critic)
        with driver.delayed_native_profile(SyntheticGraphProfile(kind)) as profile:
            # Actual immutable legacy runner executes its real guard BEFORE hooks.
            result = driver.legacy.run_device_graph(model=model, critic=critic, sample=sample, order=ORDER,
                profile=profile, deadline=time.monotonic()+60, allowed_files=allowed,
                device=torch.device("cpu"), resource=lambda: None)
        self.assertEqual(before, driver.core.state_snapshot(critic))
        self.assertTrue(all(not getattr(p, "_backward_hooks", None) for p in model.parameters()))
        self.assertTrue(all(not m._forward_hooks for m in model.modules()))
        return result, profile.records, model

    def test_real_legacy_guard_then_one_forward_four_full_native_vjps(self):
        result, records, model = self.run_graph()
        self.assertEqual(result["callCounts"]["generatorForwards"],1)
        self.assertEqual(result["callCounts"]["generatorAutogradCompleted"],4)
        self.assertEqual([len(v) for v in result["rawGradients"]],[107]*4)
        driver.require_native_vjps(records)
        self.assertTrue(all(v["mask"] == [True,True,True] for v in records))
        self.assertEqual(result["outcome"],"original_cpu_reference_gate_passed")
        mask = driver.legacy.mask_statistics(result["rawGradients"],tuple(model.parameters()),torch.device("cpu"))
        self.assertTrue(mask["passedAllOriginalToleranceMasks"])

    def test_late_error_keeps_four_real_calls_and_observer_cleanup(self):
        with self.assertRaisesRegex(ValueError,"late after four") as error: self.run_graph("late")
        self.assertEqual(error.exception.control_call_counts["generatorAutogradCompleted"],4)
        self.assertEqual(len(error.exception.control_raw_summaries),4)
        self.assertEqual(len(error.exception.counterfactual_native_vjp_observations),4)

    def test_input_and_rng_mutation_rejected_and_restored_rng(self):
        for kind in ("input","rng"):
            with self.subTest(kind=kind), self.assertRaisesRegex(ValueError,"changed"): self.run_graph(kind)

    def test_resource_device_and_incomplete_native_evidence_rejected(self):
        valid={"index":0,"name":"NVIDIA GeForce RTX 5050","uuid":driver.legacy.GPU_UUID,
            "fraction":.7,"freeMiB":2048,"temperatureC":85,"diskFreeMiB":2048}
        driver.legacy.validate_resources(valid)
        for key,value in (("index",1),("freeMiB",2047),("fraction",.71),("temperatureC",86)):
            with self.assertRaises(ValueError):driver.legacy.validate_resources({**valid,key:value})
        with self.assertRaises(ValueError):driver.require_native_vjps([])

    def test_original_loss_source_and_no_stale_preflight_calls(self):
        text = inspect.getsource(driver.OriginalLossNewBridge)
        self.assertIn("train_object_core_fidelity_candidate_objective",text)
        self.assertIn("self.bridge.compute_generator_candidate_gradients",text)
        tree=ast.parse(Path(driver.__file__).read_text())
        for node in ast.walk(tree):
            if isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute) and isinstance(node.func.value,ast.Name):
                self.assertFalse(node.func.value.id=="legacy" and node.func.attr in ("programs","preflight"))
        with self.assertRaisesRegex(ValueError,"bindings"):driver.preflight(ROOT,time.monotonic()+10,[])

    def test_owned_cpu_timeout_cleanup_and_output_budget(self):
        output = driver.safe.logical_path(ROOT,driver.PARENT+"/synthetic-cpu/timeout-fixture")
        output.mkdir(parents=True,exist_ok=False)
        receipt=driver.safe.run_owned_process([sys.executable,"-B","-c","import time;time.sleep(10)"],
            cwd=ROOT,deadline=time.monotonic()+.5,evidence_root=output)
        self.assertTrue(receipt["timedOut"]);self.assertTrue(receipt["cleanupConfirmed"])
        self.assertEqual(receipt["activeProcessesAfterCleanup"],0)
        driver.safe.write_exclusive(output,"timeout-receipt.json",receipt)
        with self.assertRaisesRegex(ValueError,"budget"):
            driver.safe.write_exclusive(output,"oversized.json",{"value":"x"*2097152})


if __name__=="__main__":unittest.main()
