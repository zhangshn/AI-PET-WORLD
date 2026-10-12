"""Synthetic-only regression for the standalone snapshot CPU boundary."""
import ast
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
import hashlib
import io
import json
import os
import pickletools
from pathlib import Path
import sys
import time
import threading
import unittest
from unittest.mock import patch
import uuid
import zipfile
import struct
import warnings
import shutil

import analyze_stage4_appearance_regime_gradient_failure_snapshot_cpu as a

SUITE_ROOT = os.environ.get("AI_PAINTER_SYNTHETIC_SUITE_ROOT",
    a.OUTPUT_PARENT + "/lifecycle-implementation/synthetic-suite-" + uuid.uuid4().hex)
a.require(any(a.re.fullmatch(a.re.escape(parent) + r"/synthetic-suite-[a-f0-9]{32}", SUITE_ROOT)
              for parent in (a.OUTPUT_PARENT + "/lifecycle-implementation", a.IMPLEMENTATION_PARENT)),
          "test suite must remain in isolated synthetic evidence namespace")


def put(file, value):
    file.parent.mkdir(parents=True, exist_ok=True)
    raw = a.encoded(value)
    with file.open("xb") as stream:
        stream.write(raw)
    return {"path": file.relative_to(a.ROOT).as_posix(), "sha256": a.digest(raw)}


def binding(file):
    return {"path": file.relative_to(a.ROOT).as_posix(), "sha256": hashlib.sha256(file.read_bytes()).hexdigest()}


class SyntheticFixture:
    def __init__(self, *, outside=False, conflict=False, production=False):
        self.logical = SUITE_ROOT + "/fixture-" + uuid.uuid4().hex
        self.parent = a.ROOT / self.logical
        self.run = self.parent / "source-run"
        self.run.mkdir(parents=True)
        self.capture = a.load_capture(a.ROOT)
        torch = self.capture.torch
        torch.set_num_threads(2)
        self.tensors = {}
        model, groups, graph = [], [[] for _ in range(4)], []
        for i in range(107):
            name, key = "synthetic.parameter." + str(i), "model.parameter." + str(i)
            weight = torch.zeros(1, dtype=torch.float32)
            self.tensors[key] = weight
            model.append({"name": name, "key": key, "shape": [1], "dtype": "torch.float32"})
            graph.append({"name": name, "shape": [1], "elements": 1})
            values = [torch.tensor([.6]), torch.tensor([.1]), torch.tensor([.2]), torch.tensor([.3])]
            values[0] = (values[1].float() + values[2].float()).float() + values[3].float()
            if outside and i == 56:
                values[0] = values[0] + .0001
            for j, value in enumerate(values):
                gradient_key = "gradient." + str(j) + "." + str(i)
                self.tensors[gradient_key] = value
                groups[j].append({"key": gradient_key, "unused": False, "shape": [1], "dtype": "torch.float32", "sourceDevice": "cpu"})
        named = [(p["name"], self.tensors[p["key"]]) for p in model]
        comparison = self.capture._comparison(named, groups, self.tensors, [], ValueError("actual total gradient identity differs at parameter 56"))
        if conflict:
            comparison["outsideToleranceElements"] += 1
        self.location = {"epoch": 9, "trainPosition": 36, "sampleId": "synthetic-row-1", "split": "train",
                         "origin": "explicit_capture_call", "inferredSample": False}
        self.counts = {"generator": 419, "discriminator": 420}
        error = {"type": "builtins.ValueError", "message": "actual total gradient identity differs at parameter 56"}
        proof = {"status": "cpu_execution_bridge_checked_not_gpu_qualified", "capabilityVersion": a.CAPABILITY,
                 "optimizerSteps": 0, "gpuInitialized": False, "synthetic": True,
                 "actualGraph": {"tensors": 107, "parameters": graph, "elements": 107}}
        proof_binding = put(self.run / "graph.json", proof)
        policy = {"executionVersion": a.VERSION, "modelCpuEvidence": proof_binding}
        if production:
            formal = {"path": a.FORMAL, "sha256": a.FORMAL_SHA}
            policy.update(formalSpecification=formal, failureSnapshotAnalysis={"schemaVersion": a.DISPATCH_SCHEMA,
                "mode": a.PRODUCTION_MODE, "namespace": a.PRODUCTION_PARENT, "algorithm": a.SCHEMA,
                "limits": a.LIMITS, "programBindings": a.production_program_bindings(a.ROOT, time.monotonic() + 120),
                "formalSpecification": formal})
        policy_binding = put(self.run / "policy.json", policy)
        self.identity = {"runId": "synthetic-run", "packageId": "synthetic-package", "capabilityVersion": a.CAPABILITY}
        split = put(self.run / "train.json", {"split": "train", "sampleIds": ["synthetic-row-" + str(i) for i in range(48)]})
        package = {**self.identity, "executionVersion": a.VERSION, "outputRoot": (self.run.relative_to(a.ROOT)).as_posix(),
                   "candidateContract": policy_binding, "trainSplit": split,
                   "programBindings": {"capture": binding(a.ROOT / a.CAPTURE)}}
        package_binding = put(self.run / "execution-package.json", package)
        capture_root = self.run / "failure-capture"
        capture_root.mkdir()
        primary = {"schemaVersion": self.capture.SCHEMA, "originalError": error, "location": self.location, "counts": self.counts}
        put(capture_root / self.capture.PRIMARY, primary)
        buffer = io.BytesIO()
        torch.save(self.tensors, buffer)
        (capture_root / self.capture.TENSORS).write_bytes(buffer.getvalue())
        def artifact(name):
            file = capture_root / name
            raw = file.read_bytes()
            return {"path": file.resolve().as_posix(), "sha256": a.digest(raw), "bytes": len(raw)}
        self.manifest = {"schemaVersion": self.capture.SCHEMA, "status": "failure_evidence_captured", "executionQualified": False,
                         "originalError": error, "location": self.location, "counts": self.counts,
                         "executionBinding": package_binding, "networks": {"model": {"parameters": model}, "critic": {}},
                         "gradientSets": groups, "gradientEvidenceComplete": True,
                         "tensorDescriptors": {k: {"shape": list(v.shape), "dtype": str(v.dtype), "bytes": v.numel() * v.element_size(),
                                                    "sha256": self.capture._tensor_sha(v)} for k, v in self.tensors.items()},
                         "artifacts": {"primary": artifact(self.capture.PRIMARY), "tensors": artifact(self.capture.TENSORS)},
                         "comparison": comparison}
        put(capture_root / self.capture.MANIFEST, self.manifest)
        receipt = {"status": "failure_evidence_captured", "executionQualified": False, "counts": self.counts,
                   "location": self.location, "originalError": error, "artifacts": {**self.manifest["artifacts"], "manifest": artifact(self.capture.MANIFEST)}}
        capture = {"failureCaptureTriggered": True, "originalErrorType": "ValueError", "originalError": error["message"],
                   "epoch": 9, "trainPosition": 36, "sampleId": self.location["sampleId"], "optimizerSteps": self.counts, "captureReceipt": receipt}
        diagnostic_binding = put(self.run / "failure-capture-diagnostic.json", capture)
        counted = {"optimizerStepsGenerator": 419, "optimizerStepsDiscriminator": 420}
        phase = {**self.identity, **counted, "status": "experiment_failed_closed", "executionState": "failed_closed",
                 "executionVersion": a.VERSION, "executionPackage": package_binding, "candidateContract": policy_binding,
                 "failureCapture": capture, "failureCaptureReceipt": diagnostic_binding, "error": error["message"]}
        phase_binding = put(self.run / "phase-terminal.json", phase)
        progress_binding = put(self.run / "progress.json", {**self.identity, **counted})
        started_binding = put(self.run / "failure-capture-started.json", {**self.identity, **counted, "originalError": error["message"],
                        "epoch": 9, "trainPosition": 36, "sampleId": self.location["sampleId"]})
        terminal = {**self.identity, **counted, "status": "experiment_failed_closed", "executionState": "failed_closed",
                    "executionVersion": a.VERSION, "executionPackage": package_binding, "workerTerminal": phase_binding,
                    "progress": progress_binding, "failureCapture": capture, "diagnosticEvidence": {"captureStarted": started_binding}}
        self.terminal = put(self.run / "failure.json", terminal)
        self.context = a.preflight(a.Reader(a.ROOT, time.monotonic() + 120), self.terminal)
        self.source_hashes = {p: a.digest(p.read_bytes()) for p in self.run.rglob("*") if p.is_file()}

    def output(self, name):
        return self.logical + "/" + name


class AnalyzerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        reuse = os.environ.get("AI_PAINTER_SYNTHETIC_REUSE_SOURCES")
        if reuse:
            source = a.logical_path(a.ROOT, reuse)
            a.require(reuse.startswith(a.IMPLEMENTATION_PARENT + "/synthetic-suite-"), "reuse outside synthetic evidence")
            rows = {}
            for run in source.glob("fixture-*/source-run"):
                f = SyntheticFixture.__new__(SyntheticFixture)
                f.logical = SUITE_ROOT + "/reused-" + uuid.uuid4().hex
                f.parent = a.ROOT / f.logical
                f.parent.mkdir(parents=True)
                f.run, f.capture = run, a.load_capture(a.ROOT)
                f.terminal = binding(run / "failure.json")
                f.context = a.preflight(a.Reader(a.ROOT, time.monotonic()+120), f.terminal)
                f.manifest, f.tensors = f.capture.verify_gradient_failure_capture(f.context["receipt"])
                f.counts, f.location = f.context["counts"], f.context["location"]
                f.identity = {k:f.context["terminal"][k] for k in ("runId","packageId","capabilityVersion")}
                f.source_hashes = {p:a.digest(p.read_bytes()) for p in run.rglob("*") if p.is_file()}
                comparison=f.manifest["comparison"]
                label="outside" if not comparison["passedAllOriginalToleranceMasks"] else ("conflict" if comparison["outsideToleranceElements"] else "good")
                rows[label]=f
            a.require(set(rows)=={"good","outside","conflict"}, "incomplete synthetic reuse set")
            cls.good,cls.outside,cls.conflict = rows["good"],rows["outside"],rows["conflict"]
        else:
            cls.good = SyntheticFixture()
            cls.outside = SyntheticFixture(outside=True)
            cls.conflict = SyntheticFixture(conflict=True)
        cls.production_root = a.ROOT / SUITE_ROOT / "production-sandbox"
        cls.production_root.mkdir(parents=True)
        for logical in (*a.PRODUCTION_PROGRAMS, a.FORMAL):
            target = cls.production_root / logical
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(a.ROOT / logical, target)
        with patch.object(a, "ROOT", cls.production_root):
            cls.production = SyntheticFixture(outside=True, production=True)

    def production_request(self, mutation=None):
        f = self.production
        request = {"schemaVersion": a.DISPATCH_SCHEMA, "mode": a.PRODUCTION_MODE,
            "sourceFailure": f.terminal, "sourceExecutionPackage": f.context["terminal"]["executionPackage"],
            "sourceCapture": f.context["receipt"]["artifacts"], **f.identity, "executionVersion": a.VERSION,
            "programBindings": a.production_program_bindings(self.production_root, time.monotonic() + 120),
            "formalSpecification": {"path": a.FORMAL, "sha256": a.FORMAL_SHA}, "algorithm": a.SCHEMA,
            "limits": a.LIMITS}
        if mutation:
            mutation(request)
        request["dispatchIdentity"] = a.dispatch_identity(request)
        request["outputRoot"] = a.PRODUCTION_PARENT + "/" + request["dispatchIdentity"]
        file = self.production_root / request["outputRoot"] / "dispatch-request.json"
        if not file.exists():
            with patch.object(a, "ROOT", self.production_root):
                put(file, request)
        return {"path": file.relative_to(self.production_root).as_posix(), "sha256": a.digest(a.encoded(request))}, request

    def test_b01_production_safe_complete_and_lost_receipt_readback_without_reload(self):
        bound, request = self.production_request()
        f = self.production
        first = a.analyze_production_dispatch(dispatch_binding=bound, root=self.production_root,
            parent_deadline_unix_ms=int(time.time() * 1000) + 120000)
        report = json.loads(Path(first["path"]).read_bytes())
        self.assertEqual(report["dispatchSummary"]["status"], "diagnostic_complete_original_training_failed")
        self.assertEqual(report["dispatchSummary"]["sourceFailure"], f.terminal)
        self.assertFalse(report["comparison"]["passedAllOriginalToleranceMasks"])
        self.assertEqual(report["counts"], f.counts)
        self.assertLessEqual(a.output_bytes(self.production_root / request["outputRoot"]), a.LIMITS["outputBytes"])
        with patch.object(a, "run_owned_process", side_effect=AssertionError("no second worker")), \
             patch.object(a, "load_capture", side_effect=AssertionError("no reload")):
            self.assertEqual(first, a.analyze_production_dispatch(dispatch_binding=bound, root=self.production_root,
                parent_deadline_unix_ms=int(time.time() * 1000) + 120000))
        self.assertEqual(f.source_hashes, {p: a.digest(p.read_bytes()) for p in f.source_hashes})

    def test_b02_request_contract_root_capability_cross_run_and_adoption_rejections(self):
        mutations = [lambda r: r.update(mode=True), lambda r: r.update(algorithm="unknown"),
            lambda r: r.update(capabilityVersion="stale"), lambda r: r.update(runId="another-run"),
            lambda r: r.update(sourceFailure={**r["sourceFailure"], "sha256": "0" * 64}),
            lambda r: r.update(sourceExecutionPackage={**r["sourceExecutionPackage"], "sha256": "0" * 64}),
            lambda r: r.update(sourceCapture={}), lambda r: r.update(limits={**a.LIMITS,"outputBytes":a.LIMITS["outputBytes"]+1}),
            lambda r: r.update(formalSpecification={"path":a.FORMAL,"sha256":"0"*64}),
            lambda r: r.update(programBindings=[])]
        for mutation in mutations:
            bound, _ = self.production_request(mutation)
            with self.subTest(request=bound["path"]), patch.object(a,"run_owned_process",side_effect=AssertionError("no dispatch")):
                with self.assertRaises(ValueError):
                    a.analyze_production_dispatch(dispatch_binding=bound,root=self.production_root,
                        parent_deadline_unix_ms=int(time.time()*1000)+120000)
        bound, request = self.production_request()
        original = a.Reader.bound
        def unadopted(reader,binding,**kwargs):
            value=original(reader,binding,**kwargs)
            if kwargs.get("json_data",True) and binding["path"].endswith("/policy.json"):
                value.pop("failureSnapshotAnalysis",None)
            return value
        with patch.object(a.Reader,"bound",unadopted), self.assertRaisesRegex(ValueError,"not adopted"):
            a.production_preflight(a.Reader(self.production_root,time.monotonic()+120),bound)
        with self.assertRaisesRegex(ValueError,"outside current task"):
            a.analyze_failure_snapshot(terminal_binding=self.good.terminal,output_root=request["outputRoot"])
        with self.assertRaises(ValueError):
            a.production_preflight(a.Reader(self.production_root,time.monotonic()+120),{**bound,"path":"arbitrary/request.json"})

    def test_b03_parent_deadline_never_renews_and_refuses_short_budget(self):
        for value in (None,True,int(time.time()*1000)-1,int(time.time()*1000)+50):
            with self.assertRaises(ValueError):
                a.production_deadline(value)
        start=time.monotonic()-30
        deadline=a.production_deadline(int(time.time()*1000)+120000,started=start)
        self.assertLessEqual(deadline,start+120)
        bound,_=self.production_request()
        with patch.object(a,"run_owned_process",side_effect=AssertionError("no short-deadline dispatch")):
            with self.assertRaises(ValueError):
                a.analyze_production_dispatch(dispatch_binding=bound,root=self.production_root,
                    parent_deadline_unix_ms=int(time.time()*1000)+10)

    def test_b04_partial_stale_unknown_lock_and_shared_request_budget(self):
        bound,_=self.production_request()
        original=a.Reader.bound
        for filename,key,value in (("/gradient-failure-manifest.json","status","partial"),
                                   ("/failure.json","executionVersion","stale")):
            def modified(reader,binding,**kwargs):
                result=original(reader,binding,**kwargs)
                if kwargs.get("json_data",True) and binding["path"].endswith(filename):
                    result[key]=value
                return result
            with patch.object(a.Reader,"bound",modified), self.assertRaises(ValueError):
                a.production_preflight(a.Reader(self.production_root,time.monotonic()+120),bound)
        # This rejection occurs before any child computation and preserves the
        # already completed identity; cached budgets count request and witnesses.
        with patch.object(a,"output_bytes",return_value=a.LIMITS["outputBytes"]+1), \
             patch.object(a,"run_owned_process",side_effect=AssertionError("no budget dispatch")):
            with self.assertRaisesRegex(ValueError,"budget"):
                a.analyze_production_dispatch(dispatch_binding=bound,root=self.production_root,
                    parent_deadline_unix_ms=int(time.time()*1000)+120000)
        output=self.production_root/Path(bound["path"]).parent
        lock=output/"unknown-lock"
        lock.write_bytes(b"preserve unknown production lock")
        with patch.object(a,"run_owned_process",side_effect=AssertionError("no takeover")):
            with self.assertRaisesRegex(ValueError,"unknown production"):
                a.analyze_production_dispatch(dispatch_binding=bound,root=self.production_root,
                    parent_deadline_unix_ms=int(time.time()*1000)+120000)
        self.assertEqual(lock.read_bytes(),b"preserve unknown production lock")

    def test_a01_complete_safe_verifier_comparison_and_rng(self):
        f = self.good
        torch = f.capture.torch
        rng = torch.random.get_rng_state().clone()
        manifest, tensors = f.capture.verify_gradient_failure_capture(f.context["receipt"])
        actual = a.compare_snapshot(f.context, f.capture, tensors)
        self.assertTrue(actual["passedAllOriginalToleranceMasks"])
        self.assertEqual(len(actual["parameters"]), 107)
        self.assertEqual(manifest, f.manifest)
        self.assertTrue(torch.equal(rng, torch.random.get_rng_state()))
        self.assertFalse(torch.cuda.is_initialized())
        self.assertTrue(all(not v.requires_grad and v.device.type == "cpu" for v in tensors.values()))

    def test_a01_none_preserved_and_zero_normalized(self):
        f = self.good
        context = deepcopy(f.context)
        tensors = dict(f.tensors)
        for j in range(4):
            context["manifest"]["gradientSets"][j][0] = {"key": None, "unused": True}
        model = context["manifest"]["networks"]["model"]["parameters"]
        expected = f.capture._comparison([(p["name"], tensors[p["key"]]) for p in model], context["manifest"]["gradientSets"], tensors, [], ValueError(context["originalError"]["message"]))
        context["manifest"]["comparison"] = expected
        actual = a.compare_snapshot(context, f.capture, tensors)
        self.assertEqual(actual["parameters"][0]["unused"], [True] * 4)
        self.assertTrue(actual["passedAllOriginalToleranceMasks"])

    def test_a02_real_owned_synthetic_cli_false_gate_and_cached_no_worker(self):
        f = self.outside
        first = a.analyze_failure_snapshot(terminal_binding=f.terminal, output_root=f.output("completed-analysis"))
        report = json.loads(Path(first["path"]).read_bytes())
        self.assertFalse(report["comparison"]["passedAllOriginalToleranceMasks"])
        self.assertEqual(report["comparison"]["outsideToleranceElements"], 1)
        self.assertEqual(report["counts"], {"generator": 419, "discriminator": 420})
        self.assertEqual(report["boundary"], a.BOUNDARY)
        self.assertTrue(report["synthetic"])
        self.assertTrue(report["ownedProcess"]["assignedBeforeResume"])
        self.assertTrue(report["ownedProcess"]["cleanupConfirmed"])
        with patch.object(a, "run_owned_process", side_effect=AssertionError("second worker forbidden")), patch.object(a, "load_capture", side_effect=AssertionError("second load forbidden")):
            self.assertEqual(first, a.analyze_failure_snapshot(terminal_binding=f.terminal, output_root=f.output("completed-analysis")))
        self.assertEqual(f.source_hashes, {p: a.digest(p.read_bytes()) for p in f.source_hashes})
        with self.assertRaisesRegex(ValueError, "identity conflict"):
            a.analyze_failure_snapshot(terminal_binding={**f.terminal, "sha256": "0" * 64}, output_root=f.output("completed-analysis"))

    def test_a03_partial_missing_unknown_metadata_rejected(self):
        for mutation in (lambda m: m.update(status="partial_failure_evidence_captured"),
                         lambda m: m.update(gradientEvidenceComplete=False),
                         lambda m: m["gradientSets"].pop(),
                         lambda m: m["gradientSets"][0].pop(),
                         lambda m: m["originalError"].update(message="unknown fault"),
                         lambda m: m["originalError"].update(message="actual total gradient identity differs at parameter 999")):
            manifest = deepcopy(self.good.manifest)
            mutation(manifest)
            with self.assertRaises(ValueError):
                a.validate_metadata(manifest, self.good.context["graph"])

    def test_a04_nonfinite_actual_values_not_false_pass(self):
        f = self.good
        for value, status in ((float("nan"), "nan"), (float("inf"), "positive_infinity")):
            context, tensors = deepcopy(f.context), dict(f.tensors)
            tensors["gradient.0.56"] = f.capture.torch.tensor([value])
            model = context["manifest"]["networks"]["model"]["parameters"]
            context["manifest"]["comparison"] = f.capture._comparison([(p["name"], tensors[p["key"]]) for p in model], context["manifest"]["gradientSets"], tensors, [], ValueError(context["originalError"]["message"]))
            result = a.compare_snapshot(context, f.capture, tensors)
            self.assertFalse(result["allFinite"])
            self.assertFalse(result["passedAllOriginalToleranceMasks"])
            self.assertEqual(result["parameters"][56]["maxAbsoluteDifference"]["status"], status)

    def test_a04_wrong_order_shape_key_dtype_and_duplicate_rejected(self):
        for mutate in (lambda m: m["networks"]["model"]["parameters"][0].update(name="bad"),
                       lambda m: m["networks"]["model"]["parameters"][1].update(name=m["networks"]["model"]["parameters"][0]["name"]),
                       lambda m: m["gradientSets"][0][0].update(key="gradient.0.1"),
                       lambda m: m["gradientSets"][0][0].update(shape=[2]),
                       lambda m: m["gradientSets"][0][0].update(dtype="torch.float64"),
                       lambda m: m["gradientSets"][0][0].update(key=None, unused=False)):
            manifest = deepcopy(self.good.manifest)
            mutate(manifest)
            with self.assertRaises(ValueError):
                a.validate_metadata(manifest, self.good.context["graph"])

    def test_a05_sha_identity_failure_retained_without_child(self):
        f = self.good
        with patch.object(a, "run_owned_process", side_effect=AssertionError("child must not start")):
            with self.assertRaisesRegex(ValueError, "SHA differs"):
                a.analyze_failure_snapshot(terminal_binding={**f.terminal, "sha256": "0" * 64}, output_root=f.output("invalid-input"))
        failure = json.loads((f.parent / "invalid-input/analysis-terminal.json").read_bytes())
        self.assertIsNone(failure["counts"])
        self.assertEqual(failure["status"], "snapshot_analysis_failed_closed")
        with self.assertRaisesRegex(ValueError, "previous analysis failed"):
            a.analyze_failure_snapshot(terminal_binding={**f.terminal, "sha256": "0" * 64}, output_root=f.output("invalid-input"))

    def test_a05_cross_run_counts_location_base_conflict_before_load(self):
        f = self.good
        original_reader = a.Reader.bound
        cases = {"runId": "other-run", "optimizerStepsGenerator": 0, "executionPackage": {"path": "other", "sha256": "0" * 64}}
        for key, value in cases.items():
            def wrong(reader, bound, **kwargs):
                result = original_reader(reader, bound, **kwargs)
                if bound["path"].endswith("/phase-terminal.json"):
                    result[key] = value
                return result
            with patch.object(a.Reader, "bound", wrong), patch.object(a, "load_capture", side_effect=AssertionError("no load")):
                with self.assertRaises((ValueError, FileNotFoundError)):
                    a.preflight(a.Reader(a.ROOT, time.monotonic() + 120), f.terminal)
        def location_conflict(reader, bound, **kwargs):
            result = original_reader(reader, bound, **kwargs)
            if bound["path"].endswith("/failure-capture-started.json"):
                result["trainPosition"] = 1
            return result
        with patch.object(a.Reader, "bound", location_conflict):
            with self.assertRaisesRegex(ValueError, "location conflict"):
                a.preflight(a.Reader(a.ROOT, time.monotonic() + 120), f.terminal)

    def test_a06_path_escape_redirect_and_artifact_bytes_rejected(self):
        f = self.good
        for logical in ("../bad", "F:/bad", "a\\b", "latest.json", "/bad", "a/./b"):
            with self.assertRaises(ValueError):
                a.logical_path(a.ROOT, logical)
        reader = a.Reader(a.ROOT, time.monotonic() + 120)
        artifact = deepcopy(f.context["receipt"]["artifacts"]["tensors"])
        artifact["bytes"] += 1
        with self.assertRaisesRegex(ValueError, "bytes differ"):
            reader.absolute_artifact(artifact, f.run, f.capture.TENSORS, json_data=False)
        artifact["path"] = str(f.parent / "unrelated.pt")
        with self.assertRaisesRegex(ValueError, "outside exact"):
            reader.absolute_artifact(artifact, f.run, f.capture.TENSORS, json_data=False)
        target = f.parent / "redirect"
        import _winapi
        _winapi.CreateJunction(str(f.run.resolve()), str(target.resolve()))
        with self.assertRaisesRegex(ValueError, "redirect"):
            a.logical_path(a.ROOT, target.relative_to(a.ROOT).as_posix() + "/failure.json")

    def test_a06_safe_payload_rejects_extra_non_tensor_and_unsafe_object(self):
        f = self.good
        for payload in ({"extra": f.capture.torch.zeros(1)}, {"bad": 5}, {"bad": Path("unsafe") } ):
            buffer = io.BytesIO()
            f.capture.torch.save(payload, buffer)
            with self.assertRaises(Exception):
                f.capture._verify_tensors(buffer.getvalue(), f.manifest["tensorDescriptors"])

    def test_a06_descriptor_over_budget_rejected_before_load(self):
        manifest = deepcopy(self.good.manifest)
        descriptor = manifest["tensorDescriptors"]["model.parameter.0"]
        descriptor.update(shape=[a.LIMITS["captureBytes"]], bytes=a.LIMITS["captureBytes"] * 4)
        with self.assertRaisesRegex(ValueError, "budget"):
            a.validate_metadata(manifest, self.good.context["graph"])

    def test_a07_actual_owned_statistical_conflict_keeps_two_results(self):
        f = self.conflict
        with self.assertRaisesRegex(ValueError, "worker failed"):
            a.analyze_failure_snapshot(terminal_binding=f.terminal, output_root=f.output("conflict-analysis"))
        out = f.parent / "conflict-analysis"
        both = json.loads((out / "comparison-conflict.json").read_bytes())
        self.assertNotEqual(both["saved"], both["recomputed"])
        self.assertTrue((out / "worker-error.json").exists())
        self.assertTrue((out / "analysis-terminal.json").exists())
        self.assertFalse((out / "analysis-report.json").exists())

    def test_a08_unknown_directory_and_incomplete_claim_not_taken_over(self):
        f = self.good
        out = f.parent / "unknown-lock"
        out.mkdir()
        (out / "foreign-lock").write_bytes(b"preserve")
        with self.assertRaisesRegex(ValueError, "unknown analysis identity"):
            a.analyze_failure_snapshot(terminal_binding=f.terminal, output_root=f.output("unknown-lock"))
        self.assertEqual((out / "foreign-lock").read_bytes(), b"preserve")

    def test_a08_simultaneous_same_identity_runs_at_most_one_owned_worker(self):
        f = self.good
        barrier = threading.Barrier(2)
        def invoke():
            barrier.wait(timeout=5)
            try:
                return a.analyze_failure_snapshot(terminal_binding=f.terminal, output_root=f.output("concurrent-analysis"))
            except (ValueError, FileExistsError) as error:
                return error
        with patch.object(a, "run_owned_process", wraps=a.run_owned_process) as owned:
            with ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(lambda _: invoke(), range(2)))
            self.assertEqual(owned.call_count, 1)
        successes = [row for row in results if isinstance(row, dict)]
        self.assertGreaterEqual(len(successes), 1)
        self.assertTrue(all(row == successes[0] for row in successes))
        report = json.loads(Path(successes[0]["path"]).read_bytes())
        self.assertEqual(report["snapshotDeserializations"], 1)
        self.assertTrue(report["ownedProcess"]["cleanupConfirmed"])

    def test_a09_budget_and_io_preserve_primary(self):
        f = self.good
        out = f.parent / "budget-test"
        out.mkdir()
        with self.assertRaisesRegex(ValueError, "budget exceeded"):
            a.write_exclusive(out, "huge.json", {"large": "x" * a.LIMITS["jsonBytes"]})
        original = a.write_exclusive
        def denied(directory, name, value, **kwargs):
            if name == "analysis-terminal.json":
                raise OSError("secondary terminal write failure")
            return original(directory, name, value, **kwargs)
        with patch.object(a, "write_exclusive", denied), patch.object(a, "run_owned_process", side_effect=OSError("primary child IO failure")):
            with self.assertRaisesRegex(OSError, "primary child IO failure") as caught:
                a.analyze_failure_snapshot(terminal_binding=f.terminal, output_root=f.output("io-failure"))
        self.assertIn("secondary", caught.exception.analysis_publication_error)

    def test_a09_real_owned_timeout_cleans_descendant_without_pid_kill(self):
        out = self.good.parent / "timeout-job"
        out.mkdir()
        code = "import subprocess,sys,time,pathlib; p=subprocess.Popen([sys.executable,'-B','-c','import time; time.sleep(30)']); pathlib.Path(sys.argv[1]).write_text(str(p.pid)); time.sleep(30)"
        result = a.run_owned_process([sys.executable, "-B", "-c", code, str(out / "child-pid.txt")],
                    cwd=a.ROOT, deadline=time.monotonic() + 1, evidence_root=out)
        self.assertTrue(result["timedOut"])
        self.assertTrue(result["cleanupConfirmed"])
        self.assertEqual(result["activeProcessesAfterCleanup"], 0)
        self.assertGreaterEqual(result["totalProcesses"], 2)
        a.write_exclusive(out, "timeout-proof.json", result)

    def test_a09_atomic_publication_preserves_pending_and_refuses_overwrite(self):
        out = self.good.parent / "atomic-publication"
        out.mkdir()
        value = {"status": "complete"}
        result = a.write_exclusive(out, "analysis-terminal.json", value)
        pending = list(out.glob("analysis-terminal.json.pending-*"))
        self.assertEqual(len(pending), 1)
        self.assertEqual(Path(result["path"]).read_bytes(), pending[0].read_bytes())
        self.assertEqual(a.output_bytes(out), 2 * len(a.encoded(value)))
        with self.assertRaisesRegex(ValueError, "already exists"):
            a.write_exclusive(out, "analysis-terminal.json", {"status": "failed"}, failure=True)

    def test_a09_real_owned_budget_error_preserves_primary_and_cleans_child(self):
        out = self.good.parent / "budget-error-job"
        out.mkdir()
        code = "import time; time.sleep(30)"
        with patch.object(a, "output_bytes", return_value=a.LIMITS["outputBytes"]):
            with self.assertRaisesRegex(ValueError, "child output budget exhausted") as caught:
                a.run_owned_process([sys.executable, "-B", "-c", code], cwd=a.ROOT,
                                    deadline=time.monotonic() + 5, evidence_root=out)
        receipt = caught.exception.owned_process_receipt
        self.assertTrue(receipt["assignedBeforeResume"])
        self.assertTrue(receipt["cleanupConfirmed"])
        self.assertEqual(receipt["activeProcessesAfterCleanup"], 0)
        self.assertGreater(receipt["processCreationFileTime"], 0)
        a.write_exclusive(out, "budget-error-owned-proof.json", receipt)

    def test_a09_interrupted_commit_preserves_primary_and_single_failure_terminal(self):
        f = self.good
        original = a.os.link
        def interrupted(source, target, **kwargs):
            if Path(target).name == "analysis-terminal.json" and not json.loads(Path(source).read_bytes()).get("status", "").endswith("failed_closed"):
                raise OSError("interrupted success commit")
            return original(source, target, **kwargs)
        def fake_owned(argv, **kwargs):
            out = kwargs["evidence_root"]
            inputs = json.loads((out / "analysis-inputs.json").read_bytes())
            a.write_exclusive(out, "worker-result.json", {"identity": inputs["identity"],
                "inputBindings": inputs["inputBindings"], "programBindings": a.program_bindings(a.ROOT, time.monotonic() + 120),
                "boundary": a.BOUNDARY, "status": "worker_snapshot_verified_pending_supervisor_commit"})
            return {"timedOut": False, "exitCode": 0}
        with patch.object(a.os, "link", interrupted), patch.object(a, "run_owned_process", fake_owned):
            with self.assertRaisesRegex(OSError, "interrupted success commit"):
                a.analyze_failure_snapshot(terminal_binding=f.terminal, output_root=f.output("interrupted-commit"))
        out = f.parent / "interrupted-commit"
        terminal = json.loads((out / "analysis-terminal.json").read_bytes())
        self.assertEqual(terminal["status"], "snapshot_analysis_failed_closed")
        self.assertEqual(terminal["counts"], f.counts)
        self.assertEqual(len(list(out.glob("analysis-terminal.json.pending-*"))), 2)
        self.assertTrue((out / "analysis-commit-intent.json").exists())
        with patch.object(a, "run_owned_process", side_effect=AssertionError("no retry")):
            with self.assertRaisesRegex(ValueError, "previous analysis failed"):
                a.analyze_failure_snapshot(terminal_binding=f.terminal, output_root=f.output("interrupted-commit"))

    def test_a06_archive_guard_rejects_unsafe_expansion_before_any_loader(self):
        f = self.good
        original = f.run / "failure-capture" / f.capture.TENSORS
        facts = a.inspect_tensor_archive(original, f.manifest["tensorDescriptors"])
        self.assertEqual(facts["storageBytes"], 535 * 4)
        self.assertFalse(facts["processMemoryBound"])
        with self.assertRaisesRegex(ValueError, "preflight SHA differs"):
            a.inspect_tensor_archive(original, f.manifest["tensorDescriptors"], expected_sha="0" * 64)
        with zipfile.ZipFile(original) as archive:
            rows = [(item.filename, archive.read(item.filename)) for item in archive.infolist()]
        pickle_index = next(i for i, (name, _) in enumerate(rows) if name.endswith("/data.pkl"))
        pickle_name, pickle_raw = rows[pickle_index]
        mutations = []
        mutations.append(("compressed", rows, zipfile.ZIP_DEFLATED))
        mutations.append(("duplicate", rows + [rows[0]], zipfile.ZIP_STORED))
        mutations.append(("traversal", rows + [("archive/../bad", b"x")], zipfile.ZIP_STORED))
        mutations.append(("pickle-cap", [(pickle_name, b"x")], zipfile.ZIP_STORED))
        mutations.append(("unsafe-global", [(pickle_name, b"\x80\x02cos\nsystem\n)R.")], zipfile.ZIP_STORED))
        # Increase only the pickle's declared storage numel: no large tensor is
        # constructed or deserialized. The four-byte record must reject it.
        ops = list(pickletools.genops(pickle_raw))
        persistent_index = next(i for i, (op, _, _) in enumerate(ops) if op.name == "BINPERSID")
        size_index = next(i for i in range(persistent_index - 1, -1, -1) if ops[i][0].name == "BININT1")
        position, end = ops[size_index][2], ops[size_index + 1][2]
        malicious = pickle_raw[:position] + b"J" + struct.pack("<i", a.LIMITS["captureBytes"]) + pickle_raw[end:]
        altered = list(rows)
        altered[pickle_index] = (pickle_name, malicious)
        mutations.append(("storage-declaration", altered, zipfile.ZIP_STORED))
        altered = list(rows)
        altered[pickle_index] = (pickle_name, pickle_raw + b"extra")
        mutations.append(("trailing-pickle", altered, zipfile.ZIP_STORED))
        with patch.object(f.capture.torch, "load", side_effect=AssertionError("loader forbidden")):
            for label, items, compression in mutations:
                file = f.parent / ("rejected-" + label + ".pt")
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore", UserWarning)
                    with zipfile.ZipFile(file, "x", compression=compression) as archive:
                        for name, raw in items:
                            archive.writestr(name, raw)
                if label == "pickle-cap":
                    # Forge the central record's claimed size in a tiny archive;
                    # rejection must precede reading/decompressing that member.
                    raw = bytearray(file.read_bytes())
                    central = raw.index(b"PK\x01\x02")
                    raw[central+20:central+28] = struct.pack("<II", a.LIMITS["jsonBytes"]+1, a.LIMITS["jsonBytes"]+1)
                    file.write_bytes(raw)
                with self.subTest(label=label), self.assertRaises(ValueError):
                    a.inspect_tensor_archive(file, f.manifest["tensorDescriptors"])
        # Tiny archives with forged declared sizes exercise total/single limits
        # through metadata only, with no decompression or large allocation.
        fake = deepcopy(zipfile.ZipInfo("archive/data/0"))
        fake.file_size = fake.compress_size = a.LIMITS["captureBytes"] + 1
        with patch.object(a.zipfile.ZipFile, "infolist", return_value=[fake]):
            with self.assertRaisesRegex(ValueError, "member over budget"):
                a.inspect_tensor_archive(original, f.manifest["tensorDescriptors"])
        fake.file_size = fake.compress_size = a.LIMITS["captureBytes"]
        other = zipfile.ZipInfo("archive/data/1")
        other.file_size = other.compress_size = 1
        with patch.object(a.zipfile.ZipFile, "infolist", return_value=[fake, other]):
            with self.assertRaisesRegex(ValueError, "total uncompressed"):
                a.inspect_tensor_archive(original, f.manifest["tensorDescriptors"])

    def test_a06_real_archive_read_lock_denies_concurrent_write(self):
        file = self.good.parent / "locked-archive.bin"
        file.write_bytes(b"preserve synthetic archive")
        with a.locked_capture_archive(file):
            self.assertEqual(file.read_bytes(), b"preserve synthetic archive")
            with self.assertRaises(PermissionError):
                with file.open("wb") as stream:
                    stream.write(b"forbidden write")
        self.assertEqual(file.read_bytes(), b"preserve synthetic archive")

    def test_a10_forbidden_computation_sentinels_and_direct_worker_denied(self):
        f = self.good
        torch = f.capture.torch
        with patch.object(torch.autograd, "grad", side_effect=AssertionError("autograd forbidden")), \
             patch.object(torch.Tensor, "backward", side_effect=AssertionError("backward forbidden")), \
             patch.object(torch.nn.Module, "__init__", side_effect=AssertionError("model forbidden")), \
             patch.object(torch.cuda, "init", side_effect=AssertionError("CUDA forbidden")), \
             patch.object(torch.nn.Module, "__call__", side_effect=AssertionError("forward forbidden")), \
             patch.object(torch.optim.Optimizer, "step", side_effect=AssertionError("optimizer forbidden")), \
             patch.object(f.capture, "capture_gradient_failure", side_effect=AssertionError("capture replay forbidden")):
            _, tensors = f.capture.verify_gradient_failure_capture(f.context["receipt"])
            a.compare_snapshot(f.context, f.capture, tensors)
        with patch.dict(os.environ, {"AI_PAINTER_SNAPSHOT_JOB": ""}):
            with self.assertRaisesRegex(ValueError, "owned supervisor"):
                a.verify_owned_worker()

    def test_a10_pixel_reader_sentinel_and_no_model_imports(self):
        original_open = Path.open
        def no_pixels(path, *args, **kwargs):
            if path.suffix.lower() in (".png", ".jpg", ".npy"):
                raise AssertionError("pixel input forbidden")
            return original_open(path, *args, **kwargs)
        with patch.object(Path, "open", no_pixels):
            a.preflight(a.Reader(a.ROOT, time.monotonic() + 120), self.good.terminal)
        tree = ast.parse((a.ROOT / a.ENTRY).read_text(encoding="utf-8"))
        imports = [n.module for n in ast.walk(tree) if isinstance(n, ast.ImportFrom)]
        self.assertFalse(any(n and ("model" in n or "probe" in n or "worker" in n) for n in imports))

    def test_a11_program_closure_and_fixed_contract(self):
        rows = a.program_bindings(a.ROOT, time.monotonic() + 120)
        self.assertEqual([r["path"] for r in rows], [a.ENTRY, a.TEST, a.CAPTURE])
        self.assertEqual(rows[-1]["sha256"], a.CAPTURE_SHA)
        self.assertEqual(a.LIMITS["cpuThreads"], 2)
        self.assertEqual(a.LIMITS["wallSeconds"], 120)
        self.assertEqual(a.LIMITS["outputBytes"], 8 * 1024 * 1024)
        self.assertFalse(a.BOUNDARY["qualificationGranted"])

    def test_a12_actual_acceptance_is_controller_owned(self):
        self.assertTrue(all(f.context["synthetic"] for f in (self.good, self.outside, self.conflict)))
        self.assertTrue(all("/lifecycle-implementation/synthetic-" in f.terminal["path"]
                            or f.terminal["path"].startswith(a.IMPLEMENTATION_PARENT+"/synthetic-")
                            for f in (self.good, self.outside, self.conflict)))
        self.assertFalse(self.good.capture.torch.cuda.is_initialized())


if __name__ == "__main__":
    unittest.main()
