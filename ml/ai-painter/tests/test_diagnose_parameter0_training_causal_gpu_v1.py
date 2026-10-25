"""Synthetic CPU ABI, first-error and bounded evidence tests; no real model.

The real gate arithmetic/traceback runs on supplied synthetic tensors with only
its graph-binding fixtures replaced. No model forward, autograd, optimizer,
CUDA, archive restore or native managed-worker invocation occurs.
"""
import ast
import contextlib
import importlib.util
import io
import json
import sys
import tempfile
import traceback
from pathlib import Path
from copy import deepcopy
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path[:0] = [str(ROOT / "ml/ai-painter/src"), str(ROOT / "ml/ai-painter/scripts")]
import torch
import psutil
process = psutil.Process()
process.cpu_affinity(process.cpu_affinity()[:2])
torch.set_num_threads(2)
if torch.get_num_interop_threads() != 2: torch.set_num_interop_threads(2)
import diagnose_parameter0_training_causal_gpu_v1 as worker
from ai_painter.complete_world import object_joint_rgb_structure_priority_update_cpu_v1 as gate
from ai_painter.complete_world.parameter40_qualification_observation_v1 import Target0Observation

CANONICAL_PROGRAM = dict(worker.CANONICAL_PROGRAM)
POLICY = json.loads((ROOT / worker.GPU_POLICY_PATH).read_text(encoding="utf-8"))


def policy_request(cpu=True):
    policy = deepcopy(POLICY)
    run = "parameter0-training-cpu-current-fixture" if cpu else "parameter0-training-gpu-fixture"
    request = dict(schemaVersion="parameter0-training-causal-gpu-request-v1",
        policy=dict(path=worker.GPU_POLICY_PATH, sha256=worker.capture.digest((ROOT / worker.GPU_POLICY_PATH).read_bytes())),
        mode="cpu_preflight" if cpu else "gpu_diagnostic", runId=run, outputRoot=policy["outputRoot"]+"/"+run,
        nodeInterpreter=policy["nodeInterpreter"], deadlineUnixMs=1001000,
        programBindings=[dict(CANONICAL_PROGRAM)])
    return policy, request


def program_bindings():
    return [dict(path=Path(fn.__code__.co_filename).resolve().relative_to(ROOT).as_posix(),
                 sha256=worker.capture.digest(Path(fn.__code__.co_filename).read_bytes()))
            for fn in (gate.apply_object_joint_rgb_structure_priority_update_cpu, gate.require)]


def synthetic_gate(raw):
    parameters = tuple(torch.zeros_like(raw[0]) if i == 0 else torch.zeros(1) for i in range(108))
    rows = [[raw[j] if i == 0 else torch.zeros(1) for i in range(108)] for j in range(5)]
    with patch.object(gate, "bind_parameters", return_value=(parameters, {}, 106, 107)), \
         patch.object(gate, "_validate_model_and_parameters", return_value=(parameters, {})), \
         patch.object(gate, "_validate_gradient_set", side_effect=lambda label, v, p: (v, [False]*108)):
        gate.apply_object_joint_rgb_structure_priority_update_cpu(model=object(), parameters=parameters,
            **dict(zip(("total_gradients", "structured_gradients", "whole_frame_gradients", "core_gradients", "support_gradients"), rows)))


class SafeTest(unittest.TestCase):
    def setUp(self):
        self.enterContext(patch.object(worker, "CURRENT_POLICY", deepcopy(POLICY)))
        self.enterContext(patch.object(torch.autograd, "grad", side_effect=AssertionError("autograd forbidden")))
        self.enterContext(patch.object(torch.nn.Module, "_call_impl", side_effect=AssertionError("model forward forbidden")))
        self.enterContext(patch.object(torch.cuda, "_lazy_init", side_effect=AssertionError("CUDA forbidden")))
        self.enterContext(patch.object(torch.optim, "AdamW", side_effect=AssertionError("optimizer forbidden")))
    def tearDown(self):
        self.assertFalse(torch.cuda.is_initialized())
        self.assertLessEqual(len(process.cpu_affinity()), 2)


class EnvelopeTests(SafeTest):
    def test_exact_cpu_and_gpu_envelopes(self):
        for cpu in (True, False):
            policy, request = policy_request(cpu)
            worker.validate_request(request, policy, cpu=cpu, now=1000)

    def test_wrong_route_target_model_state_and_sources_rejected(self):
        mutations = [lambda p: p.update(schemaVersion="ai-painter-parameter90-causal-gpu-policy-v2"),
            lambda p: p["scope"].update(failureSampleId="slot163"),
            lambda p: p["scope"].update(sampleSplit="validation"),
            lambda p: p["target"].update(parameterIndex=90),
            lambda p: p["target"].update(parameterIndex=False),
            lambda p: p["target"].update(coordinates=[[1,12,0,0]]),
            lambda p: p.update(modelCapabilityVersion="entry-only"),
            lambda p: p.update(objectSupportStructureWeight=.1),
            lambda p: p["sourceOptimizerSteps"].update(generator=15),
            lambda p: p["sourceFailurePosition"].update(trainIndex=9),
            lambda p: p["sourceEvidence"][0].update(sha256="0"*64),
            lambda p: p["sourceEvidence"].append(p["sourceEvidence"][0]),
            lambda p: p["sourceTensorArchive"].update(bytes=1),
            lambda p: p["sourceStateUse"].update(archivedGradientsInstalled=True),
            lambda p: p["comparison"].update(atol=1e-4),
            lambda p: p["resources"].update(maxTargetPersistedBytes=3*1024**2),
            lambda p: p["counts"].update(fullGeneratorAutograd=6),
            lambda p: p["qualification"].update(trainingAllowed=True)]
        for mutate in mutations:
            policy, request = policy_request()
            mutate(policy)
            with self.subTest(mutate=mutate), self.assertRaises(ValueError):
                worker.validate_request(request, policy, cpu=True, now=1000)

    def test_bad_request_prefix_deadline_and_duplicate_programs_rejected(self):
        mutations = [lambda r: r.update(deadlineUnixMs=999000), lambda r: r.update(deadlineUnixMs=1201000),
            lambda r: r.update(mode="training"), lambda r: r["policy"].update(path="old.json"),
            lambda r: r.update(outputRoot="private/unbound"),
            lambda r: r["programBindings"].append(dict(CANONICAL_PROGRAM))]
        for mutate in mutations:
            policy, request = policy_request(); mutate(request)
            with self.assertRaises(ValueError): worker.validate_request(request, policy, cpu=True, now=1000)

    def test_no_legacy_routes_and_policy_required(self):
        for policy in (None, {}, dict(schemaVersion="ai-painter-parameter90-causal-gpu-policy-v1")):
            with self.assertRaises(ValueError): worker.restore.source_route(policy)

    def test_duplicate_json_members_rejected(self):
        for decoder in (worker._json, worker.restore._json):
            with self.assertRaises(ValueError): decoder(b'{"a":1,"a":2}')


class PhaseTests(SafeTest):
    def fixture(self, *, case="target", persist_error=False, mutate=False):
        log, original = [], [None]
        raw = [torch.zeros(48,31,3,3) for _ in range(5)]
        if case not in ("pass", "different_point"):
            raw[0][1,13,0,0] = .125
        if case == "different_point": raw[0][2,13,0,0] = .125
        if case == "nonfinite_sum":
            raw[1].fill_(torch.finfo(torch.float32).max); raw[2].fill_(torch.finfo(torch.float32).max)
        order = tuple("channel"+str(i) for i in range(23))
        class Net:
            condition_channel_order = order
            def __init__(self, n): self.items = [torch.zeros(1) for _ in range(n)]
            def parameters(self): return iter(self.items)
        model, critic = Net(108), Net(14)
        target = object.__new__(Target0Observation)
        target.index, target.name, target.shape, target.raw = 0, worker.TARGET_NAME, (48,31,3,3), []
        class Observer:
            _observation_error = None
            target_observation = target
            def __init__(self, *a, **kw): pass
            def __enter__(self): log.append("enter"); return self
            def __exit__(self, *a): log.append("exit"); return False
            def __call__(self, stage, label, rows):
                if case == "observer" and stage == "complete": raise ValueError("observation failure")
                if stage == "complete": target.raw.append(rows[0])
            def evidence(self):
                log.append("compact")
                packet = {"input": torch.ones(1,1,4,5),
                    **{"adjoint."+label: torch.ones(1,1,4,5) for label in worker.LABELS},
                    **{"gradient."+label: value for label,value in zip(worker.LABELS, raw)}}
                return dict(input_tensor=packet["input"], adjoints=tuple(packet["adjoint."+k] for k in worker.LABELS),
                    native_gradients=tuple(raw), convolution=dict(weight_shape=(48,31,3,3),stride=(1,1),padding=(1,1),dilation=(1,1),groups=1),
                    metadata=dict(descriptors={k:dict(sha256=worker._diagnostic_tensor_sha(v)) for k,v in packet.items()}))
        active = [None]
        @contextlib.contextmanager
        def observe(event):
            active[0] = event
            try: yield
            finally: active[0] = None
        def candidate(*args, **kwargs):
            self.assertEqual(kwargs, dict(support_structure_weight=1.0))
            for label, value in zip(worker.LABELS, raw):
                active[0]("attempt",label,None)
                active[0]("complete",label,[value]+[torch.zeros(1) for _ in range(107)])
            if case == "pass": return None
            try:
                if case == "forged": raise ValueError(worker.TARGET_ERROR)
                synthetic_gate(raw)
            except BaseException as error:
                original[0]=error; raise
        profile = SimpleNamespace(_phase=lambda *a: None, _bound_device=lambda m,s:s,
            sample_forward=lambda *a: log.append("forward"), observe_generator_gradients=observe,
            _generator_candidate=candidate)
        def unchanged(*args):
            log.append("state")
            if mutate and "first" in log: raise ValueError("state changed")
        def preserve(error, gradients):
            log.append("first")
            self.assertNotIn("exit", log)
            if persist_error: raise OSError("first writer failure")
            return {"rawCount":len(gradients)}
        stack = contextlib.ExitStack()
        for name, value in (("_profile",lambda:profile),("Parameter0Observer",Observer),
            ("_network_state",lambda n:dict(values=[],modes=[])),("_state_unchanged",unchanged),
            ("_sample_state",lambda s:None),("_sample_unchanged",lambda *a:None),
            ("_rng_snapshot",lambda d:None),("_rng_unchanged",lambda *a:None)):
            stack.enter_context(patch.object(worker,name,value))
        with stack:
            phase=worker.run_observed_g_phase(model,critic,{},order,resource=lambda:None,
                programs=program_bindings(),preserve_first=preserve)
        return phase, log, original[0], model, critic

    def test_actual_gate_origin_and_first_error_precede_observer_exit(self):
        phase, log, error, *_ = self.fixture()
        self.assertEqual(phase["status"],"diagnostic_target_gate_observed",phase)
        self.assertIs(phase["_primaryException"],error)
        self.assertLess(log.index("first"),log.index("exit"))
        self.assertLess(log.index("first"),log.index("state"))
        self.assertTrue(phase["originalGateFailure"]["sameCallInputsVerified"])
        self.assertEqual(phase["counts"]["generatorForwards"],1)
        self.assertEqual(phase["counts"]["generatorAutogradCompleted"],5)
        self.assertEqual(phase["counts"]["discriminatorAutograd"],0)
        self.assertEqual(phase["counts"]["optimizerUpdates"],0)

    def test_first_writer_failure_keeps_actual_error_and_no_reference(self):
        phase,log,error,*_ = self.fixture(persist_error=True)
        self.assertEqual(phase["status"],"diagnostic_failed_closed")
        self.assertIs(phase["_primaryException"],error)
        self.assertEqual(phase["error"]["message"],worker.TARGET_ERROR)
        self.assertIn("first writer failure","".join(traceback.format_exception(error)))
        self.assertTrue(any("first writer failure" in note for note in worker._secondary_notes(error)))
        self.assertNotIn("compact",log)

    def test_state_failure_cannot_replace_original_gate(self):
        phase,_,error,*_ = self.fixture(mutate=True)
        self.assertIs(phase["_primaryException"],error)
        self.assertEqual(phase["error"]["message"],worker.TARGET_ERROR)
        self.assertIn("state changed",phase["secondaryInvariantError"])

    def test_forged_exception_and_observer_failure_are_not_gate(self):
        for case in ("forged","observer"):
            phase,log,*_ = self.fixture(case=case)
            self.assertEqual(phase["status"],"diagnostic_failed_closed")
            self.assertEqual(phase["counts"]["localFp64WeightVjp"],0)
            self.assertNotIn("compact",log)

    def test_gate_pass_other_coordinate_and_overflow_have_zero_reference(self):
        for case in ("pass","different_point","nonfinite_sum"):
            phase,_,*rest=self.fixture(case=case)
            self.assertEqual(phase["status"],"diagnostic_not_reproduced",phase)
            self.assertEqual(phase["counts"]["localFp64WeightVjp"],0)
            with self.assertRaises(ValueError):
                worker.finish_target_contrast(phase,preserve=lambda *a:{},resource=lambda:None)

    def test_private_phase_and_capture_identity_precede_reference(self):
        with self.assertRaises(ValueError):
            worker.finish_target_contrast(dict(status="diagnostic_target_gate_observed"),preserve=lambda *a:{},resource=lambda:None)
        phase,*_=self.fixture()
        phase["observation"]["input_tensor"].add_(1)
        with patch.object(worker,"_state_unchanged"),patch.object(worker,"_sample_unchanged"),self.assertRaisesRegex(ValueError,"capture changed"):
            worker.finish_target_contrast(phase,preserve=lambda *a:{},resource=lambda:None)

    def test_reference_only_after_preservation_and_token_single_use(self):
        phase,*_=self.fixture()
        with patch.object(worker,"_state_unchanged"),patch.object(worker,"_sample_unchanged"):
            completed=worker.finish_target_contrast(phase,preserve=lambda *a:{"saved":True},resource=lambda:None)
            self.assertEqual(completed["counts"]["localFp64WeightVjp"],5)
            with self.assertRaises(ValueError):
                worker.finish_target_contrast(phase,preserve=lambda *a:{},resource=lambda:None)


class WriterTests(SafeTest):
    def mapping(self, directory, corrupt=False):
        class Mapping:
            project=Path(directory)
            def path(self,logical): return self.project / logical
            def binding(self,binding,maximum):
                raw=self.path(binding["path"]).read_bytes()
                worker.require(len(raw)<=maximum and worker.capture.digest(raw)==binding["sha256"],"readback mismatch")
                return b"corrupt" if corrupt else raw
        return Mapping()
    def test_exclusive_write_readback_and_aggregate_target_budget(self):
        with tempfile.TemporaryDirectory() as directory:
            mapping=self.mapping(directory)
            writer=worker._EvidenceWriter(mapping,"",8*1024**2,lambda:None)
            writer.output="."; writer.write("original-gate-failure.json",b"{}")
            with self.assertRaises(FileExistsError): writer.write("original-gate-failure.json",b"{}")
            with self.assertRaisesRegex(ValueError,"aggregate2MiB"):
                writer.write("target-capture.pt",b"x"*(2*1024**2-65536))
    def test_readback_failure_blocks_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            writer=worker._EvidenceWriter(self.mapping(directory,True),".",8*1024**2,lambda:None)
            with self.assertRaisesRegex(ValueError,"readback"):
                writer.write("target-capture.json",b"{}")
    def test_cumulative_terminal_reserve(self):
        with tempfile.TemporaryDirectory() as directory:
            writer=worker._EvidenceWriter(self.mapping(directory),".",8*1024**2,lambda:None)
            writer.write("worker-result.json",b"a"*40000)
            with self.assertRaisesRegex(ValueError,"cumulative"):
                writer.write("worker-failure.json",b"a"*30000,failure=True)
    def test_tensor_serializer_rejects_before_copy(self):
        with patch.object(torch,"save",side_effect=AssertionError("serialization occurred")):
            with self.assertRaisesRegex(ValueError,"before copies"):
                worker._tensor_archive({"x":torch.ones(100)},65536)
    def test_safe_decoder_rejects_wrong_hash_before_archive_decoding(self):
        with self.assertRaises(ValueError):
            worker.capture.safe_load_bytes(b"not an archive","0"*64,{})


class RestorePrimitiveTests(SafeTest):
    def synthetic_state(self):
        module = torch.nn.Module()
        module.register_parameter("weight", torch.nn.Parameter(torch.zeros(2)))
        module.register_buffer("counter", torch.zeros(1))
        tensors = {"p": torch.tensor([2., 3.]), "b": torch.tensor([4.])}
        descriptors = {key: dict(shape=list(value.shape), dtype=str(value.dtype),
            sha256=worker.capture.tensor_sha(value), allFinite=True, sourceVersion=17)
            for key, value in tensors.items()}
        metadata = dict(state=[dict(kind="parameter",name="weight",key="p"),
            dict(kind="buffer",name="counter",key="b")], modes={"": False})
        return module, metadata, tensors, descriptors

    def test_reused_copy_preserves_fresh_flags_and_never_installs_gradients(self):
        model, metadata, tensors, descriptors = self.synthetic_state()
        before = model.weight._version
        result = worker.restore._restore_network(model, metadata, tensors, descriptors)
        self.assertEqual(model.weight.tolist(), [2., 3.])
        self.assertEqual(model.weight._version, before + 1)
        self.assertTrue(model.weight.requires_grad)
        self.assertIsNone(model.weight.grad)
        self.assertFalse(model.training)
        self.assertFalse(result["requiresGradHistoricalClaim"])
        self.assertFalse(result["archivedGradientsInstalled"])

    def test_bad_last_state_rejects_before_any_copy(self):
        model, metadata, tensors, descriptors = self.synthetic_state()
        descriptors["b"]["sha256"] = "0" * 64
        before = model.weight._version
        with self.assertRaises(ValueError):
            worker.restore._restore_network(model, metadata, tensors, descriptors)
        self.assertEqual(model.weight.tolist(), [0., 0.])
        self.assertEqual(model.weight._version, before)

    def test_missing_mode_alias_and_dtype_reject(self):
        for case in ("mode", "dtype", "alias"):
            model, metadata, tensors, descriptors = self.synthetic_state()
            if case == "mode": metadata["modes"] = {}
            elif case == "dtype": tensors["p"] = tensors["p"].double()
            else: model.register_parameter("alias", model.weight)
            with self.assertRaises(ValueError):
                worker.restore._state_plan(model, metadata, tensors, descriptors)

    def test_factory_dispatch_is_fixed_rgb_without_model_construction(self):
        calls = []
        profile_path = ROOT / worker.restore.PROFILE_PATH
        profile = SimpleNamespace(__file__=str(profile_path),
            fresh_networks=lambda order, **kw: calls.append((order,kw)) or ("G", "D"))
        bindings = {str(profile_path): worker.restore.PROFILE_SHA}
        with patch.object(worker.restore.importlib, "import_module", return_value=profile):
            result = worker.restore._fresh_networks(ROOT, ["synthetic"], bindings, policy=POLICY)
        self.assertEqual(result, ("G", "D"))
        self.assertEqual(calls, [(["synthetic"], dict(model_capability=worker.restore.MODEL_CAPABILITY))])
        with patch.object(worker.restore.importlib, "import_module", side_effect=AssertionError("factory reached")):
            with self.assertRaises(ValueError):
                worker.restore._fresh_networks(ROOT, [], {}, policy=POLICY)


class SampleTests(SafeTest):
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
        ids = ["synthetic-train-" + str(i) for i in range(48)]
        ids[8] = identity["sampleId"]
        membership = binding("train.json", dict(split="train", sampleIds=ids))
        plan = dict(datasetManifest=dataset, trainSplit=membership)
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
                sample, actual_order, reader = worker.load_failure_sample(Mapping(), manifest, plan, resource=lambda: None, programs=programs)
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
                worker.load_failure_sample(Mapping(), manifest, plan, resource=lambda: None, programs=invalid)
        blobs[CANONICAL_PROGRAM["path"]] = b"// changed canonical bytes"
        with patch.object(worker, "_profile", return_value=profile), self.assertRaisesRegex(ValueError, "SHA"):
            worker.load_failure_sample(Mapping(), manifest, plan, resource=lambda: None, programs=programs)
        self.assertEqual(sample["sampleId"], worker.restore.SAMPLE_ID)
        self.assertEqual(actual_order, order)
        self.assertFalse(any("validation" in path for path in calls))
        with self.assertRaisesRegex(ValueError, "undeclared"):
            reader.read(dict(path="private/validation.png", sha256="a"*64))


if __name__ == "__main__": unittest.main()
