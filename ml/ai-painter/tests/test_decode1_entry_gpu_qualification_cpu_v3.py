"""Synthetic CPU tests only; no real raster, qualification claim, forward or CUDA."""
from contextlib import ExitStack, redirect_stdout
from copy import deepcopy
import ast
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import time
import types
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
os.environ["OMP_NUM_THREADS"] = os.environ["MKL_NUM_THREADS"] = "2"
os.environ["CUDA_VISIBLE_DEVICES"] = ""
ROOT = Path(__file__).absolute().parents[3]
sys.path[:0] = [str(ROOT / "ml/ai-painter/src"), str(ROOT / "ml/ai-painter/scripts")]
import torch
from torch import nn
import qualify_decode1_entry_gpu_v3 as worker
from ai_painter.complete_world import object_decode1_entry_joint_priority_device_v1 as bridge

_GUARDS = None


def setUpModule():
    global _GUARDS
    worker.configure_cpu()
    _GUARDS = ExitStack()
    for obj, name in ((torch.cuda, "_lazy_init"), (torch.optim.Optimizer, "__init__"), (torch, "load"), (torch, "save")):
        _GUARDS.enter_context(patch.object(obj, name, side_effect=AssertionError("synthetic CPU prohibited operation")))


def tearDownModule():
    if _GUARDS is not None: _GUARDS.close()
    assert not torch.cuda.is_initialized()


def fixture():
    # Declarative policy is the only real JSON read by these fixtures; no data,
    # historical reports, claims, registry, state archive or image is opened.
    # Explicit synthetic v3 policy: only versioned wire/entry identities change.
    # Historical/frozen inputs remain v2's exact declarations. This fixture is
    # not a fallback policy or execution authorization for the real worker.
    policy = json.loads((ROOT / "data/ai-painter/system-governance/ai-painter-decode1-entry-gpu-qualification-policy-v2.json").read_text(encoding="utf-8"))
    policy.update(schemaVersion="ai-painter-decode1-entry-gpu-qualification-policy-v3",
        capabilityVersion=worker.CAPABILITY, outputRoot=worker.OUTPUT_ROOT,
        attemptClaimPath=worker.OUTPUT_ROOT + "/attempt-v1.json")
    policy["wireProtocols"] = dict(package="decode1-entry-gpu-qualification-package-v3",
        request="decode1-entry-gpu-qualification-request-v3", worker="decode1-entry-gpu-qualification-worker-result-v3")
    policy["implementations"].update(worker=worker.PROGRAM, pythonTests=worker.TEST,
        host="scripts/qualify-ai-painter-decode1-entry-gpu-v3.mjs", nodeTests="scripts/tests/ai-painter-decode1-entry-gpu-v3.test.mjs")
    paths = (worker.PROGRAM, worker.TEST, worker.CANONICAL["path"], policy["implementations"]["deviceBridge"])
    programs = [{"path": path, "sha256": hashlib.sha256((ROOT / path).read_bytes()).hexdigest()} for path in paths]
    programs += deepcopy(policy["frozenCpuModelBindings"])
    run_id = "decode1-entry-qualification-v3-00000000-0000-4000-8000-000000000000"
    policy_binding = {"path": worker.POLICY_PATH, "sha256": worker.POLICY_SHA256}
    package = dict(schemaVersion="decode1-entry-gpu-qualification-package-v3", runId=run_id,
        capabilityVersion=worker.CAPABILITY, modelCapabilityVersion=worker.MODEL_CAPABILITY,
        policy=policy_binding, programBindings=programs, interpreter={"path": sys.executable, "sha256": "a" * 64},
        **{key: deepcopy(policy[key]) for key in ("nodeInterpreter", "scope", "resources", "dataBindings", "frozenCpuModelBindings")})
    request = dict(schemaVersion="decode1-entry-gpu-qualification-request-v3", runId=run_id, mode="cpu_prepare",
        outputRoot=worker.OUTPUT_ROOT + "/" + run_id, policy=policy_binding,
        package={"path": worker.OUTPUT_ROOT + "/" + run_id + "/package.json", "sha256": "b" * 64},
        deadlineUnixMs=int(time.time() * 1000) + 100000)
    return request, package, policy


class PreparationAbiTests(unittest.TestCase):
    """This class alone also runs inside cpu_prepare: no forward/autograd/CUDA."""
    def test_cpu_and_gpu_exact_request_package_abi(self):
        request, package, policy = fixture()
        worker.validate_contract(request, package, policy)
        request.update(mode="gpu_qualify", cpuAcceptance={"path": request["outputRoot"] + "/cpu-acceptance.json", "sha256": "c" * 64})
        worker.validate_contract(request, package, policy)

    def test_cross_package_mode_scope_policy_and_source_rejected(self):
        request, package, policy = fixture()
        for mutate in (lambda r, p: r.update(cpuAcceptance={"path": "wrong", "sha256": "0" * 64}),
                       lambda r, p: r.update(mode="training"), lambda r, p: p.update(resources={**p["resources"], "threads": 3}),
                       lambda r, p: p.update(modelCapabilityVersion="old-model"), lambda r, p: p.update(runId="another-run"),
                       lambda r, p: p.update(programBindings=p["programBindings"][:-1]),
                       lambda r, p: p.update(programBindings=p["programBindings"] + [p["programBindings"][0]]),
                       lambda r, p: r.update(package={"path": ".runtime/other/package.json", "sha256": "a" * 64}),
                       lambda r, p: r.update(deadlineUnixMs=int(time.time() * 1000) + 300000)):
            r, p = deepcopy(request), deepcopy(package)
            mutate(r, p)
            with self.assertRaises(ValueError): worker.validate_contract(r, p, policy)

    def test_attempt_completed_counts_fail_closed_without_retry(self):
        calls = worker.Calls()
        calls.begin({"sampleId": "synthetic", "split": "train"}, 0)
        calls.event("attempt", "forward")
        self.assertEqual(calls.counts["forwardAttempted"], 1)
        self.assertEqual(calls.counts["forwardCompleted"], 0)
        calls.event("complete", "forward")
        with self.assertRaises(ValueError): calls.event("attempt", "forward")
        with self.assertRaises(ValueError): calls.event("complete", "generator")
        self.assertEqual(calls.counts["generatorCompleted"], 0)

    def test_failure_json_keeps_first_error_actual_counts_and_bounded_receipts(self):
        calls = worker.Calls()
        result = dict(status="failed_closed", firstError={"type": "ValueError", "message": "original gate48"},
            counts=calls.counts, sampleIdentity={"sampleId": "synthetic"},
            sourceReceipts={"data/" + str(i) + "x" * 160: "f" * 64 for i in range(4000)})
        encoded = worker.result_json(result)
        self.assertLessEqual(len(encoded.encode()), 65536)
        actual = json.loads(encoded)
        self.assertEqual(actual["firstError"]["message"], "original gate48")
        self.assertEqual(actual["counts"], calls.counts)
        self.assertEqual(actual["sourceReceiptCount"], 4000)
        self.assertTrue(actual["sourceReceiptsTruncated"])


class MemoryPath:
    def __init__(self, data, path): self.data, self.path = data, path
    def lstat(self): return types.SimpleNamespace(st_size=len(self.data[self.path]))


class MemoryMapping:
    project = ROOT
    def __init__(self): self.data, self.reads = {}, []
    def put(self, path, value):
        raw = value if type(value) is bytes else json.dumps(value, separators=(",", ":")).encode()
        self.data[path] = raw
        return dict(path=path, sha256=hashlib.sha256(raw).hexdigest())
    def path(self, path): return MemoryPath(self.data, path)
    def binding(self, binding, maximum=2 * 1024**2):
        raw = self.data[binding["path"]]
        assert len(raw) <= maximum and hashlib.sha256(raw).hexdigest() == binding["sha256"]
        self.reads.append(binding["path"])
        return raw
    def check(self): pass


class SourceIdentityTests(unittest.TestCase):
    def source_fixture(self):
        request, package, policy = fixture()
        rows = policy["sourceAlgorithmBindings"]
        original = {("jointTrainingProfile" if row["role"] == "painter_stage4_joint_object_priority_training_profile_v1"
                     else "historical-" + str(i)): deepcopy(row["binding"])
                    for i, row in enumerate(rows) if row["role"] != "parameter60_causal_restore_v1"}
        # Historical registration may have257 paths; the new execution closure
        # remains independently bounded to256. The two counts are not conflated.
        for i in range(257 - len(original)):
            original["unused-" + str(i)] = dict(path="scripts/synthetic-old-" + str(i) + ".mjs", sha256="e" * 64)
        manifest = {"context": {"programBindings": original}}
        pinned = [*policy["frozenCpuModelBindings"], policy["formalSpecification"], policy["originalSourceLocator"],
            policy["frozenDeviceBridge"], *(row["binding"] for row in rows)]
        pinned += [policy["priorCpuEvidence"][key] for key in ("acceptance", "terminal", "request", "policy", "originalNormativeBytes")]
        pinned += [policy["predecessorFailure"][key] for key in ("policy", "claim", "package", "terminal", "workerFailure", "controllerReview", "normativeBytes")]
        expected = {b["path"]: worker.raw_binding(b) for b in pinned}
        for b in package["programBindings"]: expected[b["path"]] = b
        # Cover the real loaded-source verifier too, using synthetic immutable
        # byte boundaries; no real source manifest, runtime binary or asset read.
        for module in tuple(sys.modules.values()):
            if type(module) is not types.ModuleType: continue
            filename = vars(module).get("__file__")
            if type(filename) is not str: continue
            try: logical = Path(filename).resolve().relative_to(ROOT).as_posix()
            except ValueError: continue
            if logical.startswith(("ml/ai-painter/src/", "ml/ai-painter/scripts/", "ml/ai-painter/tests/")) and logical.endswith(".py"):
                expected.setdefault(logical, dict(path=logical, sha256=hashlib.sha256(logical.encode()).hexdigest()))
        package["programBindings"] = [b for path, b in expected.items() if path.endswith((".py", ".mjs"))]
        python_bytes, node_bytes = b"synthetic interpreter bytes", b"synthetic canonical Node bytes"
        package["interpreter"] = dict(path=sys.executable, sha256=hashlib.sha256(python_bytes).hexdigest())
        node_path = str(ROOT / "synthetic-node-not-opened.exe")
        package["nodeInterpreter"] = policy["nodeInterpreter"] = dict(path=node_path, sha256=hashlib.sha256(node_bytes).hexdigest())
        class SyntheticReader:
            root = ROOT
            def __init__(self): self.reads, self.observed = [], {}; self.resource = lambda: None
            def read(self, binding, maximum):
                bound = worker.raw_binding(binding)
                if expected.get(bound["path"]) != bound:
                    raise ValueError("synthetic bound byte SHA differs: " + bound["path"])
                self.reads.append(bound["path"])
                self.observed[bound["path"]] = bound["sha256"]
                return b"synthetic already-hash-checked source bytes"
            def json(self, binding):
                self.read(binding, 8 * 1024**2)
                assert worker.raw_binding(binding) == worker.raw_binding(policy["originalSourceLocator"])
                return manifest
            def unchanged(self): pass
        reader = SyntheticReader()
        def binary_bytes(path):
            if path.resolve() == Path(sys.executable).resolve(): return python_bytes
            if path.resolve() == Path(node_path).resolve(): return node_bytes
            raise AssertionError("unexpected real byte read")
        def guards():
            stack = ExitStack()
            stack.enter_context(patch.object(Path, "read_bytes", binary_bytes))
            stack.enter_context(patch.object(worker.shutil, "which", return_value=node_path))
            return stack
        return request, package, policy, manifest, reader, guards

    def test_actual_verify_sources_accepts_descriptive_role_difference_and_all_pinned_reads(self):
        request, package, policy, manifest, reader, guards = self.source_fixture()
        before = deepcopy(manifest)
        with guards(): worker.verify_sources(reader, package, policy)
        self.assertEqual(manifest, before)
        self.assertIn("jointTrainingProfile", manifest["context"]["programBindings"])
        self.assertNotIn("painter_stage4_joint_object_priority_training_profile_v1", manifest["context"]["programBindings"])
        self.assertIn(policy["frozenDeviceBridge"]["path"], reader.reads)
        for key in ("policy", "claim", "package", "terminal", "workerFailure", "controllerReview", "normativeBytes"):
            self.assertIn(policy["predecessorFailure"][key]["path"], reader.reads)
        self.assertIn(worker.INDEPENDENT_HELPER["path"], reader.reads)

    def test_missing_duplicate_same_sha_conflicting_sha_and_malformed_metadata_rejected(self):
        for kind in ("missing", "duplicate", "conflict", "wrong-sha", "invalid-sha", "unsafe-path", "not-object", "not-binding"):
            request, package, policy, manifest, reader, guards = self.source_fixture()
            original = manifest["context"]["programBindings"]
            target = original["jointTrainingProfile"]
            if kind == "missing": del original["jointTrainingProfile"]
            elif kind == "duplicate": original["alias"] = deepcopy(target)
            elif kind == "conflict": original["alias"] = {**target, "sha256": "0" * 64}
            elif kind == "wrong-sha": target["sha256"] = "0" * 64
            elif kind == "invalid-sha": target["sha256"] = "not-a-sha"
            elif kind == "unsafe-path": original["malicious"] = dict(path="scripts/../escape.py", sha256="a" * 64)
            elif kind == "not-object": manifest["context"]["programBindings"] = list(original.values())
            else: original["malicious"] = "not-a-binding"
            with self.subTest(kind=kind), guards(), self.assertRaises(ValueError):
                worker.verify_sources(reader, package, policy)

    def test_independent_helper_exception_cannot_bypass_exact_path_or_sha(self):
        for kind in ("helper-path", "helper-sha", "original-helper-conflict", "bridge-sha", "bridge-omitted", "predecessor-sha"):
            request, package, policy, manifest, reader, guards = self.source_fixture()
            row = next(row for row in policy["sourceAlgorithmBindings"] if row["role"] == "parameter60_causal_restore_v1")
            if kind == "helper-path": row["binding"] = {**row["binding"], "path": "scripts/not-the-helper.py"}
            elif kind == "helper-sha": row["binding"] = {**row["binding"], "sha256": "0" * 64}
            elif kind == "original-helper-conflict": manifest["context"]["programBindings"]["untrustedHelper"] = {**row["binding"], "sha256": "0" * 64}
            elif kind == "bridge-sha": policy["frozenDeviceBridge"] = {**policy["frozenDeviceBridge"], "sha256": "0" * 64}
            elif kind == "bridge-omitted": package["programBindings"] = [b for b in package["programBindings"] if b != policy["frozenDeviceBridge"]]
            else: policy["predecessorFailure"]["workerFailure"] = {**policy["predecessorFailure"]["workerFailure"], "sha256": "0" * 64}
            with self.subTest(kind=kind), guards(), self.assertRaises(ValueError): worker.verify_sources(reader, package, policy)

    def test_main_source_gate_precedes_any_loading_or_model_calculation(self):
        for corrupt in (False, True):
            request, package, policy, manifest, reader, guards = self.source_fixture()
            # The request/policy wire check is separately tested unchanged. Here
            # the actual main verifies exact v2 control byte bindings, then runs
            # the actual verify_sources and verify_imports on synthetic metadata.
            policy["nodeInterpreter"] = package["nodeInterpreter"]
            mapping = MemoryMapping()
            policy_binding = mapping.put(worker.POLICY_PATH, policy)
            request["policy"] = package["policy"] = policy_binding
            request["package"] = mapping.put(request["package"]["path"], package)
            request_binding = mapping.put(request["outputRoot"] + "/synthetic-request.json", request)
            order = []
            if corrupt: manifest["context"]["programBindings"].pop("jointTrainingProfile")
            def synthetic_run(*args):
                order.append("run_after_source_gate")
                worker.load_samples(None, {}, split="validation")
                worker.fresh_networks(None)
            output = io.StringIO()
            with guards(), ExitStack() as stack:
                stack.enter_context(patch.object(worker, "POLICY_SHA256", policy_binding["sha256"]))
                stack.enter_context(patch.object(worker.capture.RuntimeMap, "current", return_value=mapping))
                stack.enter_context(patch.object(worker, "Reader", return_value=reader))
                stack.enter_context(patch.object(worker, "validate_contract"))
                stack.enter_context(patch.object(worker, "run", synthetic_run))
                load = stack.enter_context(patch.object(worker, "load_samples", side_effect=lambda *a, **k: order.append("load")))
                fresh = stack.enter_context(patch.object(worker, "fresh_networks", side_effect=lambda *a: order.append("fresh")))
                stack.enter_context(patch.object(worker.shutil, "disk_usage", return_value=types.SimpleNamespace(free=4 * 1024**3)))
                stack.enter_context(patch.object(worker.capture, "directory_bytes", return_value=0))
                stack.enter_context(patch.object(sys, "argv", [worker.PROGRAM, "--request", request_binding["path"], "--request-sha256", request_binding["sha256"]]))
                with redirect_stdout(output): status = worker.main()
            value = json.loads(output.getvalue())
            self.assertEqual(status, 1 if corrupt else 0, value.get("firstError"))
            self.assertEqual(value["status"], "failed_closed" if corrupt else "cpu_preparation_passed")
            self.assertEqual(order, [] if corrupt else ["run_after_source_gate", "load", "fresh"])
            self.assertTrue(all(count == 0 for count in value["counts"].values()))
            if corrupt:
                load.assert_not_called(); fresh.assert_not_called()

    def test_numerical_data_and_probe_algorithms_are_exact_v2_ast_clones(self):
        old = ast.parse((ROOT / "ml/ai-painter/scripts/qualify_decode1_entry_gpu_v2.py").read_text(encoding="utf-8"))
        new = ast.parse((ROOT / worker.PROGRAM).read_text(encoding="utf-8"))
        old_nodes = {n.name: n for n in old.body if isinstance(n, (ast.FunctionDef, ast.ClassDef))}
        new_nodes = {n.name: n for n in new.body if isinstance(n, (ast.FunctionDef, ast.ClassDef))}
        for name in ("Reader", "_profile", "load_samples", "fresh_networks", "state_digest", "model_identity", "Calls", "probe",
                     "configure_cpu", "verify_imports", "verify_sources", "cuda_call", "gpu_uuid", "result_json", "run"):
            self.assertEqual(ast.dump(old_nodes[name]), ast.dump(new_nodes[name]), name)
        resources = lambda tree: next(n for n in tree.body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "RESOURCES" for t in n.targets))
        self.assertEqual(ast.dump(resources(old)), ast.dump(resources(new)))
        self.assertEqual(worker.CAPABILITY, "stage4_mvp256_dry_decode1_entry_gpu_qualification_v3")
        self.assertEqual(bridge.CAPABILITY, "stage4_mvp256_dry_decode1_entry_gpu_qualification_v1")

    def test_complete_worker_diff_is_only_explicit_version_identity_and_policy_hash(self):
        old_raw = (ROOT / "ml/ai-painter/scripts/qualify_decode1_entry_gpu_v2.py").read_bytes()
        self.assertEqual(hashlib.sha256(old_raw).hexdigest(), "cc5e2a5d3838d0f4756057918d1b501d634d2a84c55fd77d9d2874d2c72d2256")
        source = old_raw.decode("utf-8")
        replacements = (
            ("ai-painter-decode1-entry-gpu-qualification-policy-v2", "ai-painter-decode1-entry-gpu-qualification-policy-v3"),
            ('POLICY_SHA256 = "54b01ecd9a5490de78ff05d4d8c0cbd89cc6b5a644bf741c1a849c71306a6789"', 'POLICY_SHA256 = "' + worker.POLICY_SHA256 + '"'),
            ("stage4_mvp256_dry_decode1_entry_gpu_qualification_v2", "stage4_mvp256_dry_decode1_entry_gpu_qualification_v3"),
            (".runtime/ai-painter/decode1-entry-gpu-qualifications-v2", ".runtime/ai-painter/decode1-entry-gpu-qualifications-v3"),
            ("qualify_decode1_entry_gpu_v2", "qualify_decode1_entry_gpu_v3"),
            ("test_decode1_entry_gpu_qualification_cpu_v2", "test_decode1_entry_gpu_qualification_cpu_v3"),
            ("decode1-entry-qualification-v2-", "decode1-entry-qualification-v3-"),
            ("decode1-entry-gpu-qualification-request-v2", "decode1-entry-gpu-qualification-request-v3"),
            ("decode1-entry-gpu-qualification-package-v2", "decode1-entry-gpu-qualification-package-v3"),
            ("decode1-entry-gpu-qualification-worker-result-v2", "decode1-entry-gpu-qualification-worker-result-v3"),
            ("decode1-entry-gpu-qualification-cpu-acceptance-v2", "decode1-entry-gpu-qualification-cpu-acceptance-v3"),
        )
        for before, after in replacements:
            source = source.replace(before, after)
        self.assertEqual(source, (ROOT / worker.PROGRAM).read_text(encoding="utf-8"))
        self.assertEqual(len(worker.POLICY_SHA256), 64)


class ReaderTests(unittest.TestCase):
    def test_only_declared_snapshots_and_phase_rasters_hash_and_archive_boundaries(self):
        mapping = MemoryMapping()
        canonical = mapping.put("scripts/synthetic-canonical.mjs", b"synthetic source")
        reader = worker.Reader(mapping, [canonical])
        self.assertEqual(reader.snapshot(canonical["path"])[0], b"synthetic source")
        with self.assertRaisesRegex(ValueError, "undeclared"): reader.snapshot("scripts/unknown.mjs")
        bound = mapping.put("data/train.png", b"not an actual raster")
        reader.rasters.add(bound["path"])
        with self.assertRaisesRegex(ValueError, "phase/split"): reader.read(bound)
        reader.allowed_rasters.add(bound["path"])
        self.assertEqual(reader.read(bound), b"not an actual raster")
        forbidden = mapping.put("data/challenge-pack.json", {})
        reader.forbidden.add(forbidden["path"])
        with self.assertRaises(ValueError): reader.json(forbidden)
        with self.assertRaisesRegex(ValueError, "archive"): reader.read({"path": "data/tensors.pt", "sha256": "a" * 64})
        with self.assertRaises(AssertionError): reader.read({**canonical, "sha256": "0" * 64})

    def loader_fixture(self):
        mapping = MemoryMapping()
        put = lambda key, value: mapping.put("data/synthetic-qualification/" + key, value)
        order = list(worker.identity.FORMAL_CONDITION_CHANNEL_ORDER)
        data = {key: put(key + ".json", {}) for key in ("datasetManifest", "trainSplit", "validationSplit", "regimeDiagnostic", "conditionContract")}
        source_rows, diagnostic_rows, records, ids = [], [], {}, {s: [] for s in ("train", "validation", "challenge", "regression")}
        for split, count in (("train", 48), ("validation", 8), ("challenge", 4), ("regression", 4)):
            for ordinal in range(count):
                sample_id = split + str(ordinal)
                ids[split].append(sample_id)
                region = put(sample_id + "region.json", {})
                row = dict(sampleId=sample_id, split=split, regionSource=region,
                    **{key: put(sample_id + key + ".json", {}) for key in ("image", "conditionPack", "contribution", "sourceRecord")})
                source_rows.append(row)
                if split not in ("train", "validation"): continue
                season, profile = put(sample_id + "season.json", {}), put(sample_id + "profile.json", {})
                task = put(sample_id + "task.json", {"sourceBindings": {"seasonSnapshotPath": season["path"], "seasonSnapshotSha256": season["sha256"],
                    "regionalProfilePath": profile["path"], "regionalProfileSha256": profile["sha256"]}})
                identity = dict(sampleId=sample_id, split=split, taskPackage=task,
                    visualFactManifestFile=put(sample_id + "visual.json", {}), channels=[put(sample_id + "channel.json", {})])
                diagnostic_rows.append(dict(split=split, ordinal=ordinal, identity=identity))
                records[(split, ordinal)] = dict(identity=identity, regimeRecord={})
        index = put("index.json", dict(sampleCount=64, samples=source_rows))
        data["datasetManifest"] = put("datasetManifest.json", dict(sourceIndex=index))
        for split in ("train", "validation"): data[split + "Split"] = put(split + "Split.json", dict(sampleIds=ids[split]))
        data["regimeDiagnostic"] = put("regimeDiagnostic.json", {**{key: data[key] for key in ("datasetManifest", "trainSplit", "validationSplit")}, "rows": diagnostic_rows})
        loaded = []
        def load_sample(reader, row, order, continuous):
            reader.read(row["image"])
            match = next(r for r in diagnostic_rows if r["identity"]["sampleId"] == row["sampleId"])
            reader.read(match["identity"]["channels"][0])
            loaded.append(row["sampleId"])
            return dict(sampleId=row["sampleId"], split=row["split"]), deepcopy(match["identity"])
        cpu = types.SimpleNamespace(MANIFEST=data["datasetManifest"], CONDITION_CONTRACT=data["conditionContract"], load_sample=load_sample,
            select_rows=lambda reader: (reader.json(data["datasetManifest"]), order, [], {}, {}))
        profile = types.SimpleNamespace(core=types.SimpleNamespace(cpu=cpu),
            prepare_metadata=lambda *args: dict(splitSampleIds=ids, records=records), bind_sample_ecology=lambda reader, sample, *args: sample)
        return mapping, data, profile, loaded

    def test_original_loader_algorithm_phase_split_and_order_no_other_content(self):
        for split, count in (("train", 48), ("validation", 8)):
            mapping, data, profile, loaded = self.loader_fixture()
            reader = worker.Reader(mapping, [])
            with patch.object(worker, "_profile", return_value=profile):
                samples, order = worker.load_samples(reader, data, split=split)
            self.assertEqual(loaded, [split + str(i) for i in range(count)])
            self.assertEqual([s["sampleId"] for s in samples], loaded)
            self.assertTrue(all("challenge" not in path and "regression" not in path for path in mapping.reads))
            other = "train" if split == "validation" else "validation"
            self.assertFalse(any(other in path and ("image" in path or "channel" in path) for path in mapping.reads))
        with self.assertRaises(ValueError): worker.load_samples(None, {}, split="challenge")


class BridgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model, cls.critic = worker.fresh_networks(worker.identity.FORMAL_CONDITION_CHANNEL_ORDER)
        cls.critic.eval().requires_grad_(False)

    def sample(self):
        return dict(split="train", image=torch.zeros(3, 192, 256), conditions=torch.zeros(23, 192, 256))

    def test_cpu_also_uses_genuine_parent_carrier_five_independent_vjps_and_frozen_gate(self):
        model, critic = self.model, self.critic
        before = worker.state_digest(model)
        energy = sum(p.square().mean() for p in model.parameters())
        s, w, c, u = energy * .001, energy * -.004, energy * .001, energy * .001
        total = ((s + w) + c) + u
        events, carriers = [], []
        original = bridge.frozen.apply_object_joint_rgb_structure_priority_update_cpu
        def apply(**kwargs):
            carrier = kwargs["model"]
            self.assertIs(type(carrier), bridge.parent.FinalRgbBaseWeightPrecisionEcologyRenderer)
            self.assertNotEqual(carrier.capability_version, model.capability_version)
            bridge._verify_carrier(model, carrier)
            carriers.append(carrier)
            return original(**kwargs)
        with patch.object(bridge.frozen, "apply_object_joint_rgb_structure_priority_update_cpu", apply), \
                bridge.observe_generator_gradients(lambda *args: events.append(args)):
            result, facts = bridge.compute_generator_candidate_gradients(model=model, critic=critic, sample=self.sample(),
                actual_total=total, structured_objective=s, whole_frame_fidelity=w, object_core_rgb=c, object_support_structure=u)
        self.assertEqual(len(carriers), 1)
        self.assertEqual([(e[0], e[1]) for e in events], [(stage, label) for label in bridge.COMPONENTS_IN_ORDER for stage in ("attempt", "complete")])
        self.assertEqual(facts["independentFullParameterGradientTensorCounts"], [108] * 5)
        self.assertEqual(facts["modelCapabilityVersion"], worker.MODEL_CAPABILITY)
        self.assertEqual(facts["arithmeticCarrierCapabilityVersion"], bridge.parent.CAPABILITY)
        self.assertFalse(facts["carrierQualificationInherited"])
        actual = events[1][2]
        _, groups, season, ecology = bridge.bind_parameters(model)
        heads = {i for rows in groups.values() for i in rows}
        self.assertTrue(all(result[i] is actual[i] for i in range(108) if i not in heads))
        self.assertIs(result[season], actual[season])
        self.assertIs(result[ecology], actual[ecology])
        self.assertEqual(before, worker.state_digest(model))
        self.assertTrue(all(p.grad is None for p in model.parameters()))

    def test_wrong_model_mode_scalar_and_original_gate_failure_keep_bounded_summary(self):
        with self.assertRaises(ValueError): bridge.bind_parameters(nn.Linear(1, 1))
        energy = sum(p.square().mean() for p in self.model.parameters())
        values = dict(model=self.model, critic=self.critic, sample=self.sample(), actual_total=energy * 4,
            structured_objective=energy, whole_frame_fidelity=energy, object_core_rgb=energy, object_support_structure=energy)
        with patch.object(bridge.frozen, "apply_object_joint_rgb_structure_priority_update_cpu", side_effect=ValueError("actual four-term total gradient identity differs at parameter 48")):
            with self.assertRaisesRegex(ValueError, "parameter 48") as caught: bridge.compute_generator_candidate_gradients(**values)
        self.assertEqual(caught.exception.decode1_entry_gradient_summary["gradientSetsAvailable"], 5)
        self.assertNotIn("rawGradients", caught.exception.decode1_entry_gradient_summary)
        self.assertLess(len(json.dumps(caught.exception.decode1_entry_gradient_summary)), 4096)
        values["actual_total"] = energy * 3
        with self.assertRaisesRegex(ValueError, "scalar formula"): bridge.compute_generator_candidate_gradients(**values)


class WorkerTests(unittest.TestCase):
    def test_own_cpu_acceptance_model_receipt_and_counts_checked_before_gpu(self):
        request, package, policy = fixture()
        binding = {"path": request["outputRoot"] + "/cpu-acceptance.json", "sha256": "a" * 64}
        owned_binding = {"path": request["outputRoot"] + "/cpu-owned-receipt.json", "sha256": "b" * 64}
        initial = {"initialState": {"generator": "a" * 64, "discriminator": "b" * 64}}
        prepared = dict(schemaVersion="decode1-entry-gpu-qualification-cpu-acceptance-v3", runId=request["runId"],
            package=request["package"], policy=request["policy"], status="cpu_preparation_passed", ownedReceipt=owned_binding,
            worker=dict(status="cpu_preparation_passed", executionState="completed", package=request["package"],
                policy=request["policy"], runId=request["runId"], modelIdentity=initial,
                counts=worker.Calls().counts, componentTests={"status": "passed"}))
        receipt = dict(ownerClosed=True, cleanupConfirmed=True, guardReleaseConfirmed=True,
            proof=dict(activeProcessesAfterCleanup=0, exitCode=0, assignedBeforeResume=True, killOnJobClose=True,
                stdoutClosed=True, stderrClosed=True, stopReason=None))
        reader = types.SimpleNamespace(json=lambda b: prepared if b == binding else receipt)
        worker.verify_cpu_acceptance(reader, binding, request, initial)
        prepared["worker"]["counts"]["generatorAttempted"] = 1
        with self.assertRaises(ValueError): worker.verify_cpu_acceptance(reader, binding, request, initial)
        prepared["worker"]["counts"]["generatorAttempted"] = 0
        receipt["guardReleaseConfirmed"] = False
        with self.assertRaises(ValueError): worker.verify_cpu_acceptance(reader, binding, request, initial)

    def synthetic_probe(self, fail_gate=False):
        """Real probe/bridge state machine, explicit scalar stand-in for renderer/Loss."""
        model, critic = worker.fresh_networks(worker.identity.FORMAL_CONDITION_CHANNEL_ORDER)
        sample = dict(sampleId="synthetic-not-real-train", split="train", image=torch.zeros(3, 192, 256),
            conditions=torch.zeros(23, 192, 256), objectInstanceTable=[],
            appearance_regime=torch.tensor([1., 0., 0., 0.]), ecology_regime=torch.tensor([1., 0., 0., 0., 0., 0., 0.]))
        calls = worker.Calls()
        calls.begin(sample, 0)
        before = (worker.state_digest(model), worker.state_digest(critic))
        def synthetic_forward(model, conditions, table, **kwargs):
            energy = sum(p.square().mean() for p in model.parameters())
            energy = energy + worker.identity.seasonal_parameter(model)[:, 0].sum() * .00001
            energy = energy + worker.identity.ecological_parameter(model)[:, 0].sum() * .00001
            return torch.sigmoid(energy).expand(1, 3, 192, 256), {"objectCount": 1}
        def synthetic_objective(critic, prediction, *args):
            energy = prediction.mean()
            s, w, c, u = energy * .001, energy * -.004, energy * .001, energy * .001
            return ((s + w) + c) + u, dict(v21UnchangedTotal=s, wholeFrameFidelity=w,
                objectCoreRgbWeighted=c, objectSupportStructureWeighted=u)
        def synthetic_d(critic, prediction, sample, device):
            return sum(p.square().mean() for p in critic.parameters()), {}
        with ExitStack() as guards:
            guards.enter_context(patch.object(worker._profile(), "validate_sample_ecology", return_value=(sample["appearance_regime"],)))
            guards.enter_context(patch.object(worker.identity.Decode1EntryWeightPrecisionEcologyRenderer, "forward", synthetic_forward))
            guards.enter_context(patch.object(worker, "train_object_support_structure_candidate_objective", synthetic_objective))
            guards.enter_context(patch.object(worker.shared, "_d_objective", synthetic_d))
            if fail_gate:
                guards.enter_context(patch.object(bridge.frozen, "apply_object_joint_rgb_structure_priority_update_cpu",
                    side_effect=ValueError("synthetic original gate48 failure")))
                with self.assertRaisesRegex(ValueError, "gate48"): worker.probe(model, critic, sample, model.condition_channel_order, calls, lambda: None)
            else:
                facts = worker.probe(model, critic, sample, model.condition_channel_order, calls, lambda: None)
                self.assertTrue(facts["originalGatePassed"])
        self.assertEqual(before, (worker.state_digest(model), worker.state_digest(critic)))
        self.assertTrue(all(p.grad is None for net in (model, critic) for p in net.parameters()))
        self.assertTrue(all(p.requires_grad for net in (model, critic) for p in net.parameters()))
        self.assertTrue(all(m.training for net in (model, critic) for m in net.modules()))
        self.assertEqual({key: calls.counts[key] for key in ("forwardAttempted", "forwardCompleted", "generatorAttempted",
            "generatorCompleted", "discriminatorAttempted", "discriminatorCompleted")}, dict(forwardAttempted=1, forwardCompleted=1,
            generatorAttempted=5, generatorCompleted=5, discriminatorAttempted=1, discriminatorCompleted=1))
        self.assertLessEqual(len(calls.gradient_summary), 6)

    def test_real_probe_control_flow_uses_synthetic_scalar_forward_and_loss_only(self):
        self.synthetic_probe()

    def test_probe_gate_failure_preserves_counts_state_flags_modes_without_retry(self):
        self.synthetic_probe(fail_gate=True)

    def test_cpu_run_factory_reload_validation_only_and_abi_no_compute(self):
        request, package, policy = fixture()
        samples = [dict(sampleId="validation" + str(i), split="validation") for i in range(8)]
        reader = types.SimpleNamespace(resource=lambda: None)
        calls, result = worker.Calls(), {}
        with patch.object(worker, "load_samples", return_value=(samples, worker.identity.FORMAL_CONDITION_CHANNEL_ORDER)) as load, \
                patch.object(worker, "preparation_abi_tests", return_value=dict(status="passed", testsRun=4)), \
                patch.object(torch.autograd, "grad", side_effect=AssertionError("CPU no autograd")), \
                patch.object(worker.identity.Decode1EntryWeightPrecisionEcologyRenderer, "forward", side_effect=AssertionError("CPU no model forward")):
            worker.run(request, package, policy, reader, calls, result, None)
        self.assertEqual(load.call_args.kwargs["split"], "validation")
        self.assertEqual(result["stateDigestBefore"], result["stateDigestAfter"])
        self.assertTrue(all(value == 0 for value in calls.counts.values()))
        self.assertEqual(result["modelIdentity"]["parameterCount"], 108)

    def test_preparation_literal_suite_runs_in_same_process_without_autograd(self):
        _, package, _ = fixture()
        reader = types.SimpleNamespace(read=lambda *a: b"bound", path=lambda p: ROOT / p)
        with patch.object(torch.autograd, "grad", side_effect=AssertionError("ABI must not compute gradients")):
            result = worker.preparation_abi_tests(reader, package)
        self.assertEqual(result["status"], "passed")
        self.assertEqual(result["testsRun"], 4)

    def test_cross_package_cpu_acceptance_stops_before_cuda(self):
        request, package, policy = fixture()
        request.update(mode="gpu_qualify", cpuAcceptance={"path": request["outputRoot"] + "/cpu.json", "sha256": "d" * 64})
        reader = types.SimpleNamespace(resource=lambda: None, json=lambda b: dict(schemaVersion="wrong"))
        with patch.object(worker, "load_samples", return_value=([], worker.identity.FORMAL_CONDITION_CHANNEL_ORDER)), \
                patch.object(torch.cuda, "init", side_effect=AssertionError("CPU rejection must precede CUDA")) as initialize:
            with self.assertRaises(ValueError): worker.run(request, package, policy, reader, worker.Calls(), {}, None)
        initialize.assert_not_called()

    def test_gpu_sequence_is_explicitly_synthetic_no_cuda_or_real_forward(self):
        request, package, policy = fixture()
        request.update(mode="gpu_qualify", cpuAcceptance={"path": request["outputRoot"] + "/cpu.json", "sha256": "d" * 64})
        samples = [dict(sampleId="train" + str(i), split="train") for i in range(48)]
        reader = types.SimpleNamespace(resource=lambda: None)
        calls, result, initialized = worker.Calls(), {}, [False]
        def fake_probe(model, critic, sample, order, calls, resource):
            for kind, count in (("forward", 1), ("discriminator", 1), ("generator", 5)):
                for _ in range(count): calls.event("attempt", kind); calls.event("complete", kind)
            return dict(sampleId=sample["sampleId"])
        with ExitStack() as guards:
            guards.enter_context(patch.object(worker, "load_samples", return_value=(samples, worker.identity.FORMAL_CONDITION_CHANNEL_ORDER)))
            guards.enter_context(patch.object(worker, "verify_cpu_acceptance"))
            guards.enter_context(patch.object(worker, "probe", fake_probe))
            guards.enter_context(patch.object(torch.cuda, "is_initialized", side_effect=lambda: initialized[0]))
            guards.enter_context(patch.object(torch.cuda, "init", side_effect=lambda: initialized.__setitem__(0, True)))
            guards.enter_context(patch.object(torch.cuda, "set_device"))
            guards.enter_context(patch.object(torch.cuda, "set_per_process_memory_fraction"))
            guards.enter_context(patch.object(torch.cuda, "is_bf16_supported", return_value=True))
            guards.enter_context(patch.object(nn.Module, "to", lambda self, *a, **k: self))
            worker.run(request, package, policy, reader, calls, result, None)
        for kind, ceiling in worker.Calls.LIMITS.items():
            self.assertEqual(calls.counts[kind + "Attempted"], ceiling)
            self.assertEqual(calls.counts[kind + "Completed"], ceiling)
        self.assertEqual(len(calls.completed_samples), 48)
        self.assertEqual(result["stateDigestBefore"], result["stateDigestAfter"])
        self.assertFalse(torch.cuda.is_initialized())


if __name__ == "__main__":
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__]))
    print(json.dumps(dict(testsRun=result.testsRun, passed=result.wasSuccessful(), realSampleRead=False,
        realRendererForward=False, cudaInitialized=torch.cuda.is_initialized(), qualificationAttemptConsumed=False)))
    raise SystemExit(0 if result.wasSuccessful() else 1)
