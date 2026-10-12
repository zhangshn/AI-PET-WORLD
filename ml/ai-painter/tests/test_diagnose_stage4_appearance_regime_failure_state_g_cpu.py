"""Synthetic contracts and real CPU microgradients; no real snapshot or model."""
from contextlib import contextmanager
import json
import os
from pathlib import Path
import sys
import tempfile
import time
import unittest
from unittest.mock import patch
import torch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import diagnose_stage4_appearance_regime_failure_state_g_cpu as control

torch.set_num_threads(2)
torch.set_num_interop_threads(2)
tempfile.tempdir = str(ROOT / control.NEW_PARENT / "numeric-implementation/repair-input-closure/synthetic-fixtures")
Path(tempfile.tempdir).mkdir(parents=True, exist_ok=True)


class ARealMicrogradientTests(unittest.TestCase):
    def test_cold_dynamo_real_cpu_gradients_and_guards(self):
        # This class must run first in a cold managed process: mocked grad calls
        # never exercise Torch's lazy Dynamo import and previously hid the bug.
        self.assertFalse("torch._dynamo" in sys.modules, "run this regression in a cold Python process")
        original_call, original_grad = torch.nn.Module.__call__, torch.autograd.grad
        names = ("_lazy_init", "init", "is_available", "is_initialized", "device_count",
                 "get_rng_state", "get_rng_state_all", "set_rng_state", "manual_seed_all", "synchronize")
        originals = [torch.Tensor.backward, torch.optim.Optimizer.__init__]
        originals += [getattr(torch.cuda, name) for name in names]
        x = torch.tensor(2., requires_grad=True)
        before = x.detach().clone()
        counts = {"forward": 0, "attempt": 0, "complete": 0}
        def call(module, *args, **kwargs):
            counts["forward"] += 1
            return original_call(module, *args, **kwargs)
        def grad(*args, **kwargs):
            counts["attempt"] += 1
            result = original_grad(*args, **kwargs)
            counts["complete"] += 1
            return result
        @torch._compile._disable_dynamo
        def microterms(y):
            return (y.square(), y * 3., y * 5.)
        with control.torch_guards(torch, call, grad):
            y = torch.nn.Identity()(x)
            terms = microterms(y)
            losses = (sum(terms), *terms)
            values = [torch.autograd.grad(loss, (x,), retain_graph=i < 3,
                      create_graph=False, allow_unused=True)[0].item() for i, loss in enumerate(losses)]
            self.assertEqual(values, [12., 4., 3., 5.])
            self.assertTrue("torch._dynamo" in sys.modules)
            from torch._dynamo import trace_rules
            # Explicit rebuild ensures a warmed cache cannot hide aliasing.
            trace_rules.get_torch_obj_rule_map.cache_clear()
            trace_rules.get_torch_obj_rule_map()
            guards = [torch.Tensor.backward, torch.optim.Optimizer.__init__]
            guards += [getattr(torch.cuda, name) for name in names]
            self.assertEqual(len(set(guards)), len(guards))
            for guard in guards:
                self.assertFalse(hasattr(guard, "__wrapped__"))
                with self.assertRaisesRegex(RuntimeError, "forbidden"):
                    guard()
            with self.assertRaisesRegex(RuntimeError, "forbidden.*Optimizer"):
                torch.optim.SGD((x,), lr=.1)
        trace_rules.get_torch_obj_rule_map.cache_clear()
        self.assertIs(torch.autograd.grad, original_grad)
        self.assertIs(torch.nn.Module.__call__, original_call)
        restored = [torch.Tensor.backward, torch.optim.Optimizer.__init__]
        restored += [getattr(torch.cuda, name) for name in names]
        self.assertTrue(all(a is b for a, b in zip(originals, restored)))
        self.assertEqual(torch.get_num_threads(), 2)
        self.assertEqual(torch.get_num_interop_threads(), 2)
        self.assertEqual(counts, {"forward": 1, "attempt": 4, "complete": 4})
        self.assertTrue(torch.equal(x.detach(), before))
        self.assertIsNone(x.grad)


class HistoryTests(unittest.TestCase):
    @contextmanager
    def fixture(self):
        from contextlib import ExitStack
        with tempfile.TemporaryDirectory() as temp, ExitStack() as stack:
            root = Path(temp)
            def write(path, value, raw=False):
                file = root / path; file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(value if raw else control.safe.encoded(value))
                return {"path": path, "sha256": control.safe.digest(file.read_bytes())}
            sources = []
            for i, (path, _, _) in enumerate(control.HISTORY_SOURCES):
                raw = ("// synthetic historical JS " + str(i)).encode()
                sources.append((path, control.safe.digest(raw), len(raw)))
                write(path, b"// synthetic current JS", True)
            stack.enter_context(patch.object(control, "HISTORY_SOURCES", tuple(sources)))
            records = []
            for mapping in control.history_mappings():
                raw = ("// synthetic historical JS " + str(len(records))).encode()
                write(mapping["snapshot"]["path"], raw, True)
                records.append({k: mapping[k] for k in ("path", "sha256", "bytes")})
                records[-1]["snapshot"] = "R:\\never-used\\" + Path(mapping["path"]).name + ".bin"
            manifest = write(control.HISTORY_MANIFEST["path"], records)
            stack.enter_context(patch.object(control, "HISTORY_MANIFEST", manifest))
            package = write(control.SOURCE_PACKAGE["path"], {"outputRoot": control.SOURCE_RUN,
                "programBindings": {str(i): {"path": p, "sha256": s} for i, (p, s, _) in enumerate(sources)}})
            stack.enter_context(patch.object(control, "SOURCE_PACKAGE", package))
            terminal = write(control.SOURCE_FAILURE["path"], {"executionPackage": package})
            stack.enter_context(patch.object(control, "SOURCE_FAILURE", terminal))
            proof = {"schemaVersion": control.HISTORY_MODE, "mode": control.HISTORY_MODE,
                     "sourceFailure": terminal, "sourceExecutionPackage": package,
                     "beforeSourceManifest": manifest, "mappings": control.history_mappings()}
            binding = write(control.NEW_PARENT + "/history-proof.json", proof)
            yield root, terminal, binding, proof, write

    def test_history_maps_only_raw_js_and_observes_current_and_snapshot(self):
        with self.fixture() as (root, terminal, binding, proof, write):
            reader = control.make_reader(root, time.monotonic()+10, terminal, binding)
            for mapping in proof["mappings"]:
                original = {k: mapping[k] for k in ("path", "sha256", "bytes")}
                file = reader.bound(original, json_data=False)
                self.assertEqual(file, root / mapping["snapshot"]["path"])
                self.assertIn(mapping["snapshot"]["path"], reader.observed)
                self.assertIn(mapping["path"], reader.observed)
                with self.assertRaisesRegex(ValueError, "raw-byte"):
                    reader.bound(original)
            reader.unchanged()
            before = control.control_identity(reader, [], terminal, binding)
            self.assertNotEqual(before, control.control_identity(reader, [], terminal))
            current = root / proof["mappings"][0]["path"]
            current.write_text("changed after verification")
            with self.assertRaisesRegex(ValueError, "changed"):
                reader.unchanged()

    def test_history_rejects_unknown_fields_crossrun_and_snapshot_redirects(self):
        for mutation in ("field", "crossrun", "absolute", "traversal", "python", "bytes", "sha"):
            with self.subTest(mutation=mutation), self.fixture() as (root, terminal, binding, proof, write):
                if mutation == "field": proof["fallback"] = True
                elif mutation == "crossrun": proof["sourceFailure"]["path"] = "other/failure.json"
                elif mutation == "absolute": proof["mappings"][0]["snapshot"]["path"] = "C:/outside.bin"
                elif mutation == "traversal": proof["mappings"][0]["snapshot"]["path"] = "../outside.bin"
                elif mutation == "python": proof["mappings"][0]["path"] = "ml/ai-painter/src/model.py"
                elif mutation == "bytes": proof["mappings"][0]["bytes"] += 1
                elif mutation == "sha": proof["mappings"][0]["sha256"] = "a"*64
                binding = write(binding["path"], proof)
                with self.assertRaises(ValueError):
                    control.make_reader(root, time.monotonic()+10, terminal, binding)

    def test_history_proof_and_manifest_and_snapshot_changes_fail_closed(self):
        for target in ("proof", "manifest", "snapshot"):
            with self.subTest(target=target), self.fixture() as (root, terminal, binding, proof, write):
                reader = control.make_reader(root, time.monotonic()+10, terminal, binding)
                path = binding["path"] if target == "proof" else proof["beforeSourceManifest"]["path"] if target == "manifest" else proof["mappings"][0]["snapshot"]["path"]
                (root/path).write_bytes(b"tampered")
                with self.assertRaisesRegex(ValueError, "changed"):
                    reader.unchanged()
                with self.assertRaises(ValueError):
                    control.make_reader(root, time.monotonic()+10, terminal, binding)

    def test_python_sha_mismatch_never_falls_back_and_root_proof_rejected(self):
        with self.fixture() as (root, terminal, binding, proof, write):
            reader = control.make_reader(root, time.monotonic()+10, terminal, binding)
            write("ml/ai-painter/src/synthetic.py", b"x=1", True)
            with self.assertRaisesRegex(ValueError, "SHA"):
                reader.bound({"path": "ml/ai-painter/src/synthetic.py", "sha256": "a"*64}, json_data=False)
            with self.assertRaisesRegex(ValueError, "path"):
                control.make_reader(root, time.monotonic()+10, terminal, {**binding, "path": str(root/binding["path"])})

    def test_new_history_failed_identity_is_consumed_once_without_retry(self):
        with self.fixture() as (root, terminal, binding, proof, write):
            with patch.object(control, "bindings", return_value=[]), \
                 patch.object(control.safe, "preflight", return_value={"originalError": {"message": "original failure"}}), \
                 patch.object(control, "input_preflight", return_value={}), \
                 patch.object(control.safe, "run_owned_process", return_value={"cleanupConfirmed": True, "timedOut": False, "exitCode": 1}) as owned:
                first = control.diagnose(terminal_binding=terminal, root=root, history_binding=binding)
                self.assertEqual(owned.call_count, 1)
                second = control.diagnose(terminal_binding=terminal, root=root, history_binding=binding)
                self.assertEqual(first, second)
                self.assertEqual(owned.call_count, 1)
                report = json.loads(Path(first["path"]).read_bytes())
                self.assertEqual(report["historyBinding"], binding)
                self.assertEqual(report["historyMode"], control.HISTORY_MODE)
                self.assertTrue(str(Path(first["path"]).relative_to(root)).replace("\\", "/").startswith(control.NEW_PARENT + "/control-"))


class InputClosureTests(unittest.TestCase):
    @contextmanager
    def fixture(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); known = {}
            visual, governance = "data/synthetic-visual.json", "scripts/lib/real-earth-region-governance.mjs"
            for path, raw in ((visual, b'{"synthetic":true}'), (governance, b'// synthetic nonexecuted JS')):
                file = root/path;file.parent.mkdir(parents=True, exist_ok=True);file.write_bytes(raw)
                known[path] = control.safe.digest(raw)
            task = {"sourceBindings": {"visualFactManifestPath": visual, "visualFactManifestSha256": "b"*64}}
            pack = {"sourceBindings": {"visualFactManifestPath": visual}, "visualFactManifestSha256": "b"*64}
            yield root, known, task, pack

    def test_missing_old_decoder_reads_change_identity_complete_preflight_does_not(self):
        with self.fixture() as (root, known, task, pack):
            reader = control.safe.Reader(root, time.monotonic()+10)
            old = control.control_identity(reader, [], {})
            adapter = control.InputReader(reader, known)
            adapter.snapshot(task["sourceBindings"]["visualFactManifestPath"])
            adapter.snapshot("scripts/lib/real-earth-region-governance.mjs")
            self.assertNotEqual(old, control.control_identity(reader, [], {}))
            reader = control.safe.Reader(root, time.monotonic()+10)
            control.close_decoder_inputs(reader, known, task, pack)
            complete = control.control_identity(reader, [], {})
            adapter = control.InputReader(reader, known)
            for path in known: adapter.snapshot(path)
            reader.unchanged()
            self.assertEqual(complete, control.control_identity(reader, [], {}))

    def test_missing_binding_wrong_sha_and_task_pack_conflict_rejected(self):
        for case in ("visual_missing", "governance_missing", "visual_sha", "governance_sha", "path", "content_sha"):
            with self.subTest(case=case), self.fixture() as (root, known, task, pack):
                visual = task["sourceBindings"]["visualFactManifestPath"]
                governance = "scripts/lib/real-earth-region-governance.mjs"
                if case.endswith("missing"): del known[visual if case.startswith("visual") else governance]
                elif case.endswith("_sha") and case != "content_sha": known[visual if case.startswith("visual") else governance] = "a"*64
                elif case == "path": pack["sourceBindings"]["visualFactManifestPath"] = "other.json"
                else: pack["visualFactManifestSha256"] = "a"*64
                with self.assertRaises(ValueError):
                    control.close_decoder_inputs(control.safe.Reader(root,time.monotonic()+10),known,task,pack)

    def test_final_identity_error_retains_completed_real_microgradient_receipt(self):
        x = torch.tensor(2., requires_grad=True)
        terms = (x.square(), x*3., x*5.)
        raw = [torch.autograd.grad(loss, (x,), retain_graph=i<3) for i, loss in enumerate((sum(terms), *terms))]
        counts = {"generatorForwards": 1, "generatorAutogradAttempts": 4, "generatorAutogradCompleted": 4,
                  "discriminatorAutograd": 0, "optimizerObjects": 0, "optimizerSteps": 0, "cudaCalls": 0}
        result = {"rawGradients": raw, "callCounts": counts, "stateInputRngUnchanged": True,
                  "before": {"synthetic": 1}, "after": {"synthetic": 1}, "originalGateError": None}
        with self.assertRaisesRegex(ValueError, "final identity") as caught:
            with control.completed_g_evidence(result):
                result.pop("rawGradients")
                raise ValueError("history/input final identity differs")
        error = caught.exception
        self.assertEqual(error.control_call_counts, counts)
        self.assertTrue(error.control_completed_g_result["stateInputRngUnchanged"])
        self.assertEqual(len(error.control_raw_summaries), 4)
        self.assertEqual(error.control_raw_summaries[0][0]["sha256"], control.tensor_sha(raw[0][0]))

    def test_worker_error_publishes_and_verifies_completed_evidence_after_identity_error(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); logical = control.PARENT + "/control-" + "a"*64
            output = root/logical;output.mkdir(parents=True)
            counts = {"generatorForwards": 1, "generatorAutogradAttempts": 4, "generatorAutogradCompleted": 4,
                      "discriminatorAutograd": 0, "optimizerObjects": 0, "optimizerSteps": 0, "cudaCalls": 0}
            x = torch.tensor(2., requires_grad=True)
            terms = (x.square(),x*3.,x*5.)
            raw = [torch.autograd.grad(loss,(x,),retain_graph=i<3) for i,loss in enumerate((sum(terms),*terms))]
            completed = {"rawGradients": raw, "callCounts": counts, "stateInputRngUnchanged": True,
                         "before": {"synthetic": 1}, "after": {"synthetic": 1}, "originalGateError": None}
            def failed_worker(*args):
                with control.completed_g_evidence(completed):
                    raise ValueError("history/input final identity differs")
            terminal = {"path": "closed/failure.json", "sha256": "b"*64}
            argv = ["control", "--worker", "--terminal", terminal["path"], "--sha256", terminal["sha256"],
                    "--output", logical, "--identity", "c"*64, "--deadline", str(time.monotonic()+10)]
            with patch.object(control,"ROOT",root), patch.object(control,"worker",side_effect=failed_worker), \
                 patch.object(sys,"argv",argv), self.assertRaisesRegex(ValueError,"final identity"):
                control.main()
            receipt = control.owned_failure_metadata(output,"c"*64,terminal)
            self.assertEqual(receipt["callCounts"],counts)
            self.assertIn("completedGReceiptBinding",receipt)
            saved = json.loads((output/"completed-g-receipt.json").read_bytes())
            self.assertTrue(saved["stateInputRngUnchanged"])
            self.assertEqual(saved["before"],saved["after"])
            self.assertIsNone(receipt["stateUnchangedOnFailure"])
            (output/"completed-g-receipt.json").write_text("tampered")
            with self.assertRaisesRegex(ValueError,"receipt SHA"):
                control.owned_failure_metadata(output,"c"*64,terminal)


class FakeNetwork(torch.nn.Module):
    def __init__(self, count):
        super().__init__()
        self.params = torch.nn.ParameterList([torch.nn.Parameter(torch.zeros(1)) for _ in range(count)])

    def forward(self, value):
        return value.sum()  # synthetic scalar; test replaces actual autograd


class Profile:
    def __init__(self, behavior="pass"):
        self.behavior = behavior
        self.observer = None

    @contextmanager
    def observe_generator_gradients(self, observer):
        self.observer = observer
        try:
            yield
        finally:
            self.observer = None

    def sample_forward(self, model, sample):
        result = model(sample["conditions"])
        if self.behavior == "extra_forward":
            model(sample["conditions"])
        if self.behavior == "input_mutation":
            sample["image"].add_(1)
        if self.behavior == "rng":
            torch.rand(1)
        return result

    def _generator_candidate(self, model, critic, sample, order, prediction):
        if self.behavior == "D":
            torch.autograd.grad(prediction, tuple(critic.parameters()), retain_graph=True,
                                create_graph=False, allow_unused=True)
        if self.behavior == "optimizer":
            torch.optim.SGD(model.parameters(), lr=.1)
        if self.behavior == "cuda":
            torch.cuda.is_available()
        for i, label in enumerate(("actualTotal", "structuredObjective", "wholeFrameFidelity", "objectCoreRgb")):
            self.observer("attempt", label, None)
            if self.behavior == "partial" and i == 2:
                raise ValueError("synthetic third differentiation failed")
            values = torch.autograd.grad(prediction, tuple(model.parameters()), retain_graph=i < 3,
                                         create_graph=False, allow_unused=True)
            self.observer("complete", label, values)
        if self.behavior == "model_mutation":
            with torch.no_grad():
                next(model.parameters()).add_(1)
        if self.behavior == "mode_mutation":
            critic.train()
        if self.behavior == "gate":
            raise ValueError("actual total gradient identity differs at parameter 56")


class ControlTests(unittest.TestCase):
    def setUp(self):
        self.model, self.critic = FakeNetwork(107), FakeNetwork(14)
        self.sample = {"split": "train", "sampleId": "synthetic-only",
                       "image": torch.zeros(3, 4, 4), "conditions": torch.zeros(23, 4, 4),
                       "appearance_regime": torch.tensor([0., 0., 0., 1.]),
                       "objectInstanceTable": [{"objectId": "synthetic"}]}
        self.source = {str(Path(__file__).resolve())}
        self.rng = torch.random.get_rng_state().clone()

    def run_control(self, behavior="pass", deadline=None, grad=None):
        calls = []
        def fake_grad(loss, inputs, **kwargs):
            calls.append(kwargs)
            return tuple(torch.zeros_like(p) for p in inputs)
        with patch.object(torch.autograd, "grad", grad or fake_grad):
            result = control.run_g_control(model=self.model, critic=self.critic, sample=self.sample,
                        order=list(range(23)), profile=Profile(behavior),
                        deadline=time.monotonic() + 10 if deadline is None else deadline,
                        allowed_files=self.source)
        return result, calls

    def test_exact_one_forward_four_actual_full_sets_and_critic_restored(self):
        result, calls = self.run_control()
        self.assertEqual(result["outcome"], "cpu_original_gate_passed")
        self.assertEqual(result["callCounts"]["generatorForwards"], 1)
        self.assertEqual(result["callCounts"]["generatorAutogradCompleted"], 4)
        self.assertEqual([len(r) for r in result["rawGradients"]], [107] * 4)
        self.assertEqual([c["retain_graph"] for c in calls], [True, True, True, False])
        self.assertTrue(result["stateInputRngUnchanged"])
        self.assertTrue(all(m.training for m in self.critic.modules()))
        self.assertTrue(all(p.requires_grad for p in self.critic.parameters()))
        self.assertTrue(torch.equal(self.rng, torch.random.get_rng_state()))
        self.assertEqual(result["callCounts"]["discriminatorAutograd"], 0)

    def test_original_identity_failure_is_diagnostic_outcome(self):
        result, _ = self.run_control("gate")
        self.assertEqual(result["outcome"], "cpu_original_gate_failed")
        self.assertEqual(result["originalGateError"], "actual total gradient identity differs at parameter 56")

    def test_validation_rejected(self):
        self.sample["split"] = "validation"
        with self.assertRaisesRegex(ValueError, "only train"):
            self.run_control()

    def test_extra_forward_rejected_with_real_attempt_count(self):
        with self.assertRaisesRegex(ValueError, "extra generator") as raised:
            self.run_control("extra_forward")
        self.assertEqual(raised.exception.control_call_counts["generatorForwards"], 2)

    def test_partial_failure_preserved_and_counted(self):
        with self.assertRaisesRegex(ValueError, "third differentiation") as raised:
            self.run_control("partial")
        self.assertEqual(raised.exception.control_call_counts["generatorAutogradCompleted"], 2)
        self.assertEqual(len(raised.exception.control_raw_summaries), 2)
        self.assertTrue(all(m.training for m in self.critic.modules()))

    def test_state_input_mode_rng_changes_rejected(self):
        for behavior in ("model_mutation", "input_mutation", "mode_mutation", "rng"):
            with self.subTest(behavior=behavior):
                self.setUp()
                with self.assertRaisesRegex(ValueError, "G changed"):
                    self.run_control(behavior)
                self.assertTrue(torch.equal(self.rng, torch.random.get_rng_state()))

    def test_D_optimizer_CUDA_prohibited(self):
        for behavior in ("D", "optimizer", "cuda"):
            with self.subTest(behavior=behavior):
                self.setUp()
                with self.assertRaises((ValueError, RuntimeError)):
                    self.run_control(behavior)

    def test_deadline_stops_before_forward_body(self):
        with self.assertRaisesRegex(ValueError, "deadline"):
            self.run_control(deadline=time.monotonic() - 1)

    def test_nonfinite_gradients_fail_closed(self):
        def bad(loss, inputs, **kwargs):
            return tuple(torch.full_like(p, float("nan")) for p in inputs)
        with self.assertRaisesRegex(ValueError, "nonfinite"):
            self.run_control(grad=bad)

    def test_dropout_and_unbound_hooks_rejected(self):
        self.model.drop = torch.nn.Dropout()
        with self.assertRaisesRegex(ValueError, "unknown torch module|random/stateful"):
            self.run_control()
        self.setUp()
        self.model.register_forward_pre_hook(lambda *args: None)
        with self.assertRaisesRegex(ValueError, "hooks"):
            self.run_control()

    def test_unknown_custom_module_rejected(self):
        self.source.clear()
        with self.assertRaisesRegex(ValueError, "unbound custom"):
            self.run_control()

    def test_exact_install_state_rejects_name_shape_and_mode_gaps(self):
        metadata = {"parameters": [{"name": n, "key": f"p{i}", "shape": [1], "dtype": "torch.float32",
                                    "requiresGrad": True} for i, (n, _) in enumerate(self.model.named_parameters())],
                    "buffers": [], "modes": {n: True for n, _ in self.model.named_modules()}}
        tensors = {f"p{i}": torch.ones(1) for i in range(107)}
        control.install_state(self.model, metadata, tensors)
        self.assertTrue(all(float(p.detach()) == 1 for p in self.model.parameters()))
        metadata["modes"].pop("")
        with self.assertRaisesRegex(ValueError, "mode map"):
            control.install_state(self.model, metadata, tensors)

    def test_transitive_reader_does_not_require_direct_capture_entry(self):
        class Reader:
            root = ROOT
            def bound(self, binding, **kwargs):
                self.seen = binding
                return Path(__file__)
        reader = Reader()
        adapter = control.InputReader(reader, {})
        content = adapter.read({"path": "transitive.json", "sha256": "a" * 64})
        self.assertTrue(content)
        self.assertEqual(reader.seen["path"], "transitive.json")
        with self.assertRaisesRegex(ValueError, "unbound"):
            adapter.snapshot("unknown.json")

    def test_safe_archive_reader_is_reused_after_zip_preflight(self):
        import ast
        tree = ast.parse((ROOT / control.ENTRY).read_text())
        calls = [ast.unparse(n.func) for n in ast.walk(tree) if isinstance(n, ast.Call)]
        self.assertNotIn("torch.load", calls)
        self.assertIn("safe.inspect_tensor_archive", calls)
        self.assertIn("capture._verify_tensors", calls)
        self.assertIn("safe.verify_owned_worker", calls)

    def test_malicious_zip_is_rejected_without_deserialization(self):
        from tempfile import TemporaryDirectory
        import zipfile
        with TemporaryDirectory() as temp:
            archive = Path(temp) / "synthetic-malicious.zip"
            with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as z:
                z.writestr("tensor/data.pkl", b"not a tensor pickle")
            with patch.object(torch, "load", side_effect=AssertionError("must not deserialize")):
                with self.assertRaisesRegex(ValueError, "compressed/encrypted"):
                    control.safe.inspect_tensor_archive(archive, {})

    def test_reader_rejects_sha_path_and_budget(self):
        from tempfile import TemporaryDirectory
        with TemporaryDirectory() as temp:
            root = Path(temp)
            (root / ".runtime").mkdir()
            (root / "input.json").write_text("{}")
            reader = control.safe.Reader(root, time.monotonic() + 10)
            with self.assertRaisesRegex(ValueError, "SHA"):
                reader.bound({"path": "input.json", "sha256": "a" * 64})
            with self.assertRaisesRegex(ValueError, "unsafe"):
                reader.bound({"path": "../input.json", "sha256": "a" * 64})
            with self.assertRaisesRegex(ValueError, "size"):
                reader.bound({"path": "input.json", "sha256": "a" * 64}, maximum=1)

    def test_owned_job_timeout_confirms_only_own_process_stopped(self):
        from tempfile import TemporaryDirectory
        with TemporaryDirectory() as temp:
            result = control.safe.run_owned_process(
                [sys.executable, "-B", "-c", "import time; time.sleep(10)"],
                cwd=ROOT, deadline=time.monotonic() + .4, evidence_root=Path(temp))
            self.assertTrue(result["assignedBeforeResume"])
            self.assertTrue(result["killOnJobClose"])
            self.assertTrue(result["timedOut"])
            self.assertTrue(result["cleanupConfirmed"])
            self.assertEqual(result["activeProcessesAfterCleanup"], 0)

    def test_primary_error_survives_cleanup_failure(self):
        real_set = torch.random.set_rng_state
        with patch.object(torch.random, "set_rng_state", side_effect=RuntimeError("synthetic cleanup")):
            with self.assertRaisesRegex(ValueError, "third differentiation") as raised:
                self.run_control("partial")
        self.assertEqual(raised.exception.control_cleanup_errors, ["synthetic cleanup"])
        real_set(self.rng)

    def test_owned_failure_metadata_carries_partial_counts_and_summary(self):
        from tempfile import TemporaryDirectory
        with TemporaryDirectory() as temp:
            output = Path(temp)
            summary = output / "partial-raw-summaries.json"
            summary.write_bytes(control.safe.encoded({"setsCompleted": 2}))
            binding = {"path": str(summary), "sha256": control.safe.digest(summary.read_bytes())}
            terminal = {"path": "closed/failure.json", "sha256": "a" * 64}
            counts = {"generatorForwards": 1, "generatorAutogradAttempts": 3,
                      "generatorAutogradCompleted": 2, "discriminatorAutograd": 0,
                      "optimizerObjects": 0, "optimizerSteps": 0, "cudaCalls": 0}
            error = {"identity": "b" * 64, "terminalBinding": terminal, "boundary": control.BOUNDARY,
                     "callCounts": counts, "errorType": "ValueError", "error": "third differentiation failed",
                     "originalCpuGateError": None, "cleanupErrors": ["synthetic secondary"],
                     "rawSummaryBinding": binding}
            (output / "worker-error.json").write_bytes(control.safe.encoded(error))
            result = control.owned_failure_metadata(output, "b" * 64, terminal)
            self.assertEqual(result["callCounts"], counts)
            self.assertEqual(result["rawSummaryBinding"], binding)
            self.assertEqual(result["cleanupErrors"], ["synthetic secondary"])
            summary.write_text("changed")
            with self.assertRaisesRegex(ValueError, "SHA"):
                control.owned_failure_metadata(output, "b" * 64, terminal)

    def test_missing_worker_counts_remain_unknown(self):
        from tempfile import TemporaryDirectory
        with TemporaryDirectory() as temp:
            self.assertIsNone(control.owned_failure_metadata(Path(temp), "b" * 64, {})["callCounts"])

    def test_cached_failure_is_returned_without_replay(self):
        from tempfile import TemporaryDirectory
        # Temporary isolated metadata only; never a real source Run or historical lock.
        with TemporaryDirectory() as temp:
            root = Path(temp)
            terminal = {"path": "closed/failure.json", "sha256": "a" * 64}
            programs = []
            request = control.safe.digest(control.safe.encoded({"terminal": terminal, "programs": programs,
                            "algorithm": control.SCHEMA, "limits": control.LIMITS}))
            output = root / control.PARENT / ("control-" + request)
            output.mkdir(parents=True)
            result = {"requestIdentity": request, "status": "cpu_surrogate_failed_closed",
                      "identity": None, "boundary": control.BOUNDARY}
            final = output / "control-terminal.json"
            final.write_bytes(control.safe.encoded(result))
            binding = {"path": str(final), "sha256": control.safe.digest(final.read_bytes())}
            (output / "control-claim.json").write_bytes(control.safe.encoded({"requestIdentity": request}))
            (output / "control-commit.json").write_bytes(control.safe.encoded({"terminal": binding, "identity": None}))
            with patch.object(control, "bindings", return_value=programs), \
                 patch.object(control.safe, "preflight", side_effect=AssertionError("no retry")), \
                 patch.object(control.safe, "run_owned_process", side_effect=AssertionError("no process")):
                self.assertEqual(control.diagnose(terminal_binding=terminal, root=root), binding)

    def test_incomplete_claim_never_reconsumed(self):
        from tempfile import TemporaryDirectory
        with TemporaryDirectory() as temp:
            root = Path(temp)
            binding = {"path": "closed/failure.json", "sha256": "a" * 64}
            request = control.safe.digest(control.safe.encoded({"terminal": binding, "programs": [],
                            "algorithm": control.SCHEMA, "limits": control.LIMITS}))
            (root / control.PARENT / ("control-" + request)).mkdir(parents=True)
            with patch.object(control, "bindings", return_value=[]), \
                 patch.object(control.safe, "run_owned_process", side_effect=AssertionError("no process")):
                with self.assertRaisesRegex(ValueError, "incomplete"):
                    control.diagnose(terminal_binding=binding, root=root)

    def test_supervisor_failure_keeps_original_and_verified_worker_evidence(self):
        from tempfile import TemporaryDirectory
        with TemporaryDirectory() as temp:
            root = Path(temp)
            terminal = {"path": "closed/failure.json", "sha256": "a" * 64}
            context = {"originalError": {"type": "builtins.ValueError", "message": "original CUDA failure"}}
            def failed_owned(argv, **kwargs):
                output = kwargs["evidence_root"]
                claim = json.loads((output / "control-inputs.json").read_bytes())
                summary = output / "partial-raw-summaries.json"
                summary.write_bytes(control.safe.encoded({"setsCompleted": 2}))
                counts = {"generatorForwards": 1, "generatorAutogradAttempts": 3,
                          "generatorAutogradCompleted": 2, "discriminatorAutograd": 0,
                          "optimizerObjects": 0, "optimizerSteps": 0, "cudaCalls": 0}
                record = {"identity": claim["identity"], "terminalBinding": terminal,
                          "boundary": control.BOUNDARY, "errorType": "ValueError", "error": "CPU third call",
                          "callCounts": counts, "rawSummaryBinding": {
                              "path": str(summary), "sha256": control.safe.digest(summary.read_bytes())}}
                (output / "worker-error.json").write_bytes(control.safe.encoded(record))
                return {"cleanupConfirmed": True, "timedOut": False, "exitCode": 1}
            with patch.object(control, "bindings", return_value=[]), \
                 patch.object(control.safe, "preflight", return_value=context), \
                 patch.object(control, "input_preflight", return_value={}), \
                 patch.object(control.safe, "run_owned_process", side_effect=failed_owned):
                binding = control.diagnose(terminal_binding=terminal, root=root)
            report = json.loads(Path(binding["path"]).read_bytes())
            self.assertEqual(report["status"], "cpu_surrogate_failed_closed")
            self.assertEqual(report["originalCudaFailure"], context["originalError"])
            self.assertEqual(report["ownedWorkerFailure"]["callCounts"]["generatorAutogradCompleted"], 2)
            self.assertIsNotNone(report["ownedWorkerFailure"]["rawSummaryBinding"])


if __name__ == "__main__":
    unittest.main()
