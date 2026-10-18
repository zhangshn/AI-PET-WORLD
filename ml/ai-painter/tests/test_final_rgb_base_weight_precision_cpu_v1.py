"""CPU-only execution tests for the target-88 precision candidate; no GPU qualification."""
from collections import OrderedDict
from contextlib import ExitStack, redirect_stdout
from copy import deepcopy
import hashlib
import io
import itertools
import json
import os
import subprocess
from pathlib import Path
import sys
import time
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
os.environ["OMP_NUM_THREADS"] = os.environ["MKL_NUM_THREADS"] = "2"
os.environ["CUDA_VISIBLE_DEVICES"] = ""
ROOT = Path(__file__).absolute().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
STARTED = time.monotonic()
import torch
from torch import nn
from torch.nn import functional as F
from ai_painter.complete_world import final_rgb_base_weight_reduction_precision_v1 as operator
from ai_painter.complete_world import object_ecology_final_rgb_base_weight_precision_v1 as candidate
from ai_painter.complete_world import object_support_final_rgb_weight_priority_update_v1 as bridge
from ai_painter.complete_world import object_ecology_terrain_detail_weight_precision_v1 as parent
from ai_painter.complete_world import object_ecology_decode1_weight_precision_v1 as graph
from ai_painter.complete_world.decode1_weight_reduction_precision_v1 import Decode1WeightReductionConv
from ai_painter.complete_world.object_appearance_regime_input_cpu import encode_season, SEASONS
from ai_painter.complete_world.object_ecology_regime_input_cpu import encode_ecology, ECOLOGIES

_MEMORY_SAVE = torch.save


def synthetic_memory_save(value, stream, *args, **kwargs):
    assert isinstance(stream, io.BytesIO), "synthetic tests cannot write a serialized file"
    return _MEMORY_SAVE(value, stream, *args, **kwargs)

ORDER = tuple("terrain_grass terrain_water terrain_path_ground terrain_shoreline terrain_natural_boundary terrain_mud_patch terrain_tall_grass walkable collision object_footprints object_tree object_rock object_vegetation focal_area object_instance coordinate_x coordinate_y signed_distance_path signed_distance_water signed_distance_shoreline signed_distance_object_ground signed_distance_boundary moisture_proximity".split())


def digest(value):
    return hashlib.sha256(value.detach().contiguous().reshape(-1).view(torch.uint8).numpy().tobytes()).hexdigest()


def state(model):
    return {name: digest(value) for name, value in model.state_dict().items()}


def values(mask=(True, True, True), size=(4, 5)):
    rng = torch.Generator(device="cpu").manual_seed(20261014)
    return tuple(torch.randn(shape, generator=rng).requires_grad_(needed) for shape, needed in zip(
        ((1, 48, *size), (48, 48, 3, 3), (48,)), mask))


class PrecisionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        if torch.get_num_interop_threads() != 2:
            torch.set_num_interop_threads(2)
        import psutil
        process = psutil.Process()
        process.cpu_affinity(process.cpu_affinity()[:2])
        cls.rng = torch.get_rng_state().clone()
        cls.parent = parent.build_fresh_object_ecology_terrain_detail_weight_precision(condition_channel_order=ORDER)
        cls.model = candidate.build_fresh_object_ecology_final_rgb_base_weight_precision(condition_channel_order=ORDER)
        assert torch.equal(cls.rng, torch.get_rng_state())

    def setUp(self):
        self.assertLess(time.monotonic() - STARTED, 120)

    def test_8_masks_native_forward_input_bias_and_fp64_weight(self):
        native = torch.ops.aten.convolution_backward.default
        masks = []
        def observe(*args, **kwargs):
            masks.append(tuple(args[-1]))
            return native(*args, **kwargs)
        for mask in itertools.product((False, True), repeat=3):
            source = values(mask)
            baseline = tuple(v.detach().clone().requires_grad_(needed) for v, needed in zip(source, mask))
            output = operator.final_rgb_base_weight_reduction_precision(*source)
            expected = F.conv2d(*baseline, padding=1)
            self.assertEqual(digest(output), digest(expected))
            if not any(mask):
                self.assertFalse(output.requires_grad); continue
            upstream = torch.linspace(-.5, .5, output.numel()).reshape_as(output)
            with patch.object(torch.ops.aten.convolution_backward, "default", observe):
                gradients = torch.autograd.grad(output, tuple(v for v, needed in zip(source, mask) if needed), grad_outputs=upstream)
            original = torch.autograd.grad(expected, tuple(v for v, needed in zip(baseline, mask) if needed), grad_outputs=upstream)
            self.assertEqual(masks[-1], mask)
            for index, actual, ordinary in zip([i for i, needed in enumerate(mask) if needed], gradients, original):
                if index == 1:
                    columns = F.unfold(source[0].detach().double(), (3, 3), padding=1)
                    reference = (upstream.double().reshape(1, 48, -1) @ columns.transpose(1, 2)).reshape(48, 48, 3, 3).float()
                    self.assertEqual(digest(actual), digest(reference))
                else:
                    self.assertEqual(digest(actual), digest(ordinary))

    def test_analytic_impulse_and_operator_parameter_reuse(self):
        features, weight, bias = values((False, True, False), (3, 3))
        features.zero_(); features[0, 26, 1, 1] = 2
        output = operator.final_rgb_base_weight_reduction_precision(features, weight, bias)
        upstream = torch.zeros_like(output); upstream[0, 12, 1, 1] = 3
        gradient = torch.autograd.grad(output, weight, grad_outputs=upstream)[0]
        reference = torch.zeros_like(weight); reference[12, 26, 1, 1] = 6
        self.assertEqual(digest(gradient), digest(reference))
        original = self.parent.get_submodule(candidate.TARGET)
        replacement = operator.FinalRgbBaseWeightReductionConv(original)
        self.assertIs(replacement.weight, original.weight); self.assertIs(replacement.bias, original.bias)

    def test_operator_invalid_dtype_shape_alias_nonfinite_autocast_gradgrad(self):
        source = values()
        with self.assertRaises(ValueError): operator.final_rgb_base_weight_reduction_precision(source[0].double(), *source[1:])
        with self.assertRaises(ValueError): operator.final_rgb_base_weight_reduction_precision(source[0][:, :47].contiguous(), *source[1:])
        for index in range(3):
            wrong = list(values()); wrong[index] = wrong[index].detach().clone(); wrong[index].reshape(-1)[0] = float("nan")
            with self.assertRaises(ValueError): operator.final_rgb_base_weight_reduction_precision(*wrong)
        storage = torch.zeros(48 * 48 * 3 * 3)
        with self.assertRaises(ValueError): operator.final_rgb_base_weight_reduction_precision(
            storage[:48 * 4 * 4].reshape(1, 48, 4, 4), storage.reshape(48, 48, 3, 3), torch.zeros(48))
        with torch.autocast("cpu", dtype=torch.bfloat16), self.assertRaises(ValueError): operator.final_rgb_base_weight_reduction_precision(*source)
        output = operator.final_rgb_base_weight_reduction_precision(*source)
        with self.assertRaisesRegex(ValueError, "higher-order"): torch.autograd.grad(output.sum(), source[1], create_graph=True)

    def test_full_graph_only_target_initial_bytes_rng_independent_storage(self):
        model = self.model
        self.assertIn("original_device_fp64", operator.NUMERIC_RULE)
        self.assertNotIn("_cpu_", operator.NUMERIC_RULE)
        self.assertFalse(model.execution_qualified)
        named, previous = tuple(model.named_parameters()), tuple(self.parent.named_parameters())
        self.assertEqual(len(named), 108); self.assertEqual(sum(v.numel() for _, v in named), 2242687)
        self.assertEqual(named[88][0], candidate.TARGET + ".weight"); self.assertEqual(named[88][1].shape, (48, 48, 3, 3))
        for (name, value), (old_name, old_value) in zip(named, previous):
            self.assertEqual(name, old_name); self.assertEqual(digest(value), digest(old_value))
        old_modules, modules = graph._module_graph(self.parent), graph._module_graph(model)
        changes = [name for (name, cls, config), (old_name, old_cls, old_config) in zip(modules, old_modules)
                   if cls is not old_cls or config != old_config]
        self.assertEqual(changes, ["", candidate.TARGET])
        self.assertIs(type(model.get_submodule(graph.TARGET)), Decode1WeightReductionConv)
        self.assertIs(type(model.get_submodule(parent.TARGET)), parent.TerrainDetailWeightReductionConv)
        rng = torch.get_rng_state().clone()
        second = candidate.build_fresh_object_ecology_final_rgb_base_weight_precision(condition_channel_order=ORDER)
        self.assertTrue(torch.equal(rng, torch.get_rng_state()))
        for left, right in zip((*model.parameters(), *model.buffers()), (*second.parameters(), *second.buffers())):
            self.assertNotEqual(left.untyped_storage().data_ptr(), right.untyped_storage().data_ptr())
            self.assertEqual(digest(left), digest(right))
        for name, kind in (("regime_identity", "regime"), ("numeric_identity", "numeric"), ("ecology_identity", "ecology")):
            self.assertTrue(torch.equal(getattr(model, name), candidate.identity_bytes(kind)))
            self.assertFalse(torch.equal(getattr(model, name), getattr(self.parent, name)))

    def test_wrong_module_config_alias_type_identity_and_channel_order_rejected(self):
        with self.assertRaises(ValueError): candidate.validate_model_identity(self.parent)
        with self.assertRaises(ValueError): parent.validate_model_identity(self.model)
        target = self.model.get_submodule(candidate.TARGET)
        for key, value in (("padding", (0, 0)), ("stride", (2, 2)), ("groups", 2), ("padding_mode", "reflect")):
            saved = getattr(target, key); setattr(target, key, value)
            try:
                with self.assertRaises(ValueError): candidate.validate_model_identity(self.model)
            finally: setattr(target, key, saved)
        owner = self.model.get_submodule(candidate.TARGET.rsplit(".", 1)[0]); saved = owner._modules["2"]
        owner._modules["2"] = nn.Identity()
        try:
            with self.assertRaises(ValueError): candidate.validate_model_identity(self.model)
        finally: owner._modules["2"] = saved
        original_data = target.bias.detach(); target.bias.data = self.model.get_submodule(parent.TARGET).bias.detach()
        try:
            with self.assertRaises(ValueError): candidate.validate_model_identity(self.model)
        finally: target.bias.data = original_data
        self.model.numeric_identity[0] ^= 1
        try:
            with self.assertRaises(ValueError): candidate.validate_model_identity(self.model)
        finally: self.model.numeric_identity[0] ^= 1
        with self.assertRaises(ValueError): candidate.build_fresh_object_ecology_final_rgb_base_weight_precision(condition_channel_order=ORDER[::-1])

    def test_strict_cpu_state_preflight_rejects_old_state_and_restores_failed_install(self):
        before = state(self.model); current = self.model.state_dict(); key = candidate.TARGET + ".weight"
        with self.assertRaises(ValueError): self.model.load_state_dict(self.parent.state_dict())
        for wrong in (OrderedDict(reversed(tuple(current.items()))), {k: v for k, v in current.items() if k != key},
                      {**current, key: current[key].double()}, {**current, key: torch.full_like(current[key], float("inf"))}):
            with self.assertRaises(ValueError): self.model.load_state_dict(wrong)
        for kwargs in ({"strict": False}, {"assign": True}):
            with self.assertRaises(ValueError): self.model.load_state_dict(current, **kwargs)
        self.assertEqual(state(self.model), before)
        identity = tuple(id(v) for v in (*self.model.parameters(), *self.model.buffers()))
        parameter = self.model.get_submodule(candidate.TARGET).weight
        binding = graph._storage_identity(parameter)
        for late_error in (True, False):
            def fail(model, incompatible):
                parameter.data = parameter.detach().clone()
                if late_error: raise ValueError("late hook error")
            hook = self.model.register_load_state_dict_post_hook(fail)
            try:
                with self.assertRaises(ValueError): self.model.load_state_dict({**current, key: current[key] + .001})
            finally: hook.remove()
            self.assertEqual(state(self.model), before); self.assertEqual(graph._storage_identity(parameter), binding)
            self.assertEqual(tuple(id(v) for v in (*self.model.parameters(), *self.model.buffers())), identity)
        clone = {k: v.clone() for k, v in current.items()}; self.model.load_state_dict(clone)
        self.assertEqual(state(self.model), before)

    def test_micro_complete_forward_is_explicitly_blocked_by_inherited_256_contract(self):
        # Do not patch inherited shape/assembly rules to claim a miniature full G.
        with self.assertRaisesRegex(ValueError, "256x192"):
            self.model(torch.zeros(1, 23, 16, 16), [], appearance_regime=encode_season(SEASONS[0]),
                       ecology_regime=encode_ecology(ECOLOGIES[0]))

    def test_all_108_parameter_five_gradients_and_original_parent_projection(self):
        # Synthetic scalar graph; no full renderer, source-data or original Loss run.
        model = self.model; before = state(model); critic = nn.Identity().eval()
        energy = sum(p.square().mean() for p in model.parameters())
        structured, whole, core, support = energy*.001, energy*-.004, energy*.001, energy*.001
        total = ((structured + whole) + core) + support
        sample = {"split":"train","image":torch.zeros(3,192,256),"conditions":torch.zeros(23,192,256)}
        recorded = []
        with bridge.observe_generator_gradients(lambda stage,label,raw: recorded.append((stage,label,raw))):
            gradients,facts = bridge.compute_generator_candidate_gradients(model=model,critic=critic,sample=sample,
                actual_total=total,structured_objective=structured,whole_frame_fidelity=whole,
                object_core_rgb=core,object_support_structure=support)
        completed = [row for row in recorded if row[0]=="complete"]
        self.assertEqual([row[1] for row in completed],list(bridge.COMPONENTS_IN_ORDER))
        self.assertEqual([len(row[2]) for row in completed],[108]*5)
        self.assertEqual(facts["candidateId"],bridge.CANDIDATE_ID)
        self.assertEqual(facts["modelCapabilityVersion"],candidate.CAPABILITY)
        self.assertEqual(facts["autogradGradCalls"],5)
        self.assertFalse(facts["carrierQualificationInherited"])
        parameters,groups,_,_ = bridge.bind_parameters(model)
        carrier = bridge._cpu_carrier(model)
        self.assertIs(type(carrier),parent.TerrainDetailWeightPrecisionEcologyRenderer)
        self.assertEqual(carrier.capability_version,parent.CAPABILITY)
        copied = [tuple(v.detach().clone() for v in row[2]) for row in completed]
        reference,original_facts = bridge.frozen.apply_object_support_structure_priority_update_cpu(model=carrier,
            parameters=tuple(carrier.parameters()),total_gradients=copied[0],structured_gradients=copied[1],
            whole_frame_gradients=copied[2],core_gradients=copied[3],support_gradients=copied[4])
        self.assertEqual(facts["headDiagnostics"],original_facts["headDiagnostics"])
        owned = {i for indexes in groups.values() for i in indexes}
        for index,value in enumerate(gradients):
            self.assertEqual(digest(value),digest(reference[index]))
            if index not in owned:
                self.assertIs(value,completed[0][2][index])
        self.assertTrue(all(p.grad is None for p in parameters))
        self.assertEqual(state(model),before)

    def test_bridge_rejects_wrong_split_critic_scalar_and_parent_model(self):
        model=self.model; critic=nn.Identity().eval()
        energy=sum(p.square().mean() for p in model.parameters())
        kwargs=dict(model=model,critic=critic,sample={"split":"train","image":torch.zeros(3,192,256),"conditions":torch.zeros(23,192,256)},
            actual_total=((energy+energy)+energy)+energy,structured_objective=energy,
            whole_frame_fidelity=energy,object_core_rgb=energy,object_support_structure=energy)
        for changed in ({"model":self.parent},{"sample":{**kwargs["sample"],"split":"validation"}},
                {"sample":{**kwargs["sample"],"image":torch.zeros(3,16,16)}},
                {"critic":nn.Linear(2,2).eval()},{"actual_total":kwargs["actual_total"]+1},
                {"object_support_structure":energy.detach()}):
            with self.subTest(changed=list(changed)),self.assertRaises(ValueError):
                bridge.compute_generator_candidate_gradients(**{**kwargs,**changed})

    def test_original_gate_failure_at_88_is_not_bypassed_and_no_repair_expansion(self):
        parameters,_,_,_=bridge.bind_parameters(self.model)
        zeros=[torch.zeros_like(p) for p in parameters]
        actual=[v.clone() for v in zeros];actual[88][39,8,0,0]=1e-3
        with self.assertRaisesRegex(ValueError,"parameter 88"):
            bridge.apply_object_support_final_rgb_weight_priority_update_cpu(model=self.model,parameters=parameters,
                total_gradients=actual,structured_gradients=zeros,whole_frame_gradients=zeros,core_gradients=zeros,support_gradients=zeros)

    def test_parent_carrier_rejects_tampering_and_preserves_identity_buffers(self):
        carrier=bridge._cpu_carrier(self.model)
        for name in ("regime_identity","numeric_identity","ecology_identity"):
            self.assertEqual(digest(getattr(carrier,name)),digest(getattr(self.parent,name)))
            self.assertNotEqual(digest(getattr(carrier,name)),digest(getattr(self.model,name)))
        with torch.no_grad():next(carrier.parameters()).view(-1)[0]+=1
        with self.assertRaisesRegex(ValueError,"carrier"):
            bridge._check_carrier(self.model,carrier)
        with self.assertRaises(ValueError):
            bridge._check_carrier(self.model,self.model)

    def test_constructor_rejects_modified_parent_weights(self):
        from copy import deepcopy
        wrong=deepcopy(self.parent)
        with torch.no_grad():next(wrong.parameters()).view(-1)[0]+=1
        with self.assertRaisesRegex(ValueError,"pristine"):
            candidate.FinalRgbBaseWeightPrecisionEcologyRenderer(wrong)

    def test_candidate_cannot_inherit_execution_or_parent_checkpoint_qualification(self):
        for key in ("execution_qualified","parent_checkpoint_loaded"):
            setattr(self.model,key,True)
            try:
                with self.assertRaisesRegex(ValueError,"inactive"):
                    candidate.validate_model_identity(self.model)
            finally:
                delattr(self.model,key)

    def test_partial_autograd_failure_retains_raw_evidence_and_does_not_continue(self):
        model=self.model; energy=sum(p.square().mean() for p in model.parameters())
        kwargs=dict(model=model,critic=nn.Identity().eval(),sample={"split":"train","image":torch.zeros(3,192,256),"conditions":torch.zeros(23,192,256)},
            actual_total=((energy+energy)+energy)+energy,structured_objective=energy,
            whole_frame_fidelity=energy,object_core_rgb=energy,object_support_structure=energy)
        ordinary=torch.autograd.grad; calls=[]
        def fail(*args,**kw):
            calls.append(1)
            if len(calls)==3:raise RuntimeError("synthetic third VJP failure")
            return ordinary(*args,**kw)
        with patch.object(torch.autograd,"grad",fail),self.assertRaisesRegex(RuntimeError,"synthetic third") as ctx:
            bridge.compute_generator_candidate_gradients(**kwargs)
        self.assertEqual(len(calls),3)
        self.assertEqual(ctx.exception.object_support_gradient_evidence["gradientSetsAvailable"],2)

class WorkerBoundaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        sys.path.insert(0,str(ROOT/"ml/ai-painter/scripts"))
        import check_final_rgb_base_weight_precision_cpu_v1 as worker
        cls.worker=worker

    def test_registered_policy_abi_and_closed_scope_rejections(self):
        import copy
        p=json.loads((ROOT/self.worker.POLICY_PATH).read_text())
        r={"schemaVersion":"final-rgb-base-precision-cpu-request-v1","policy":{"path":self.worker.POLICY_PATH,"sha256":self.worker.POLICY_SHA256},
            "verificationRevision":2,"predecessorVerification":deepcopy(self.worker.PREDECESSOR),"deadlineUnixMs":time.time()*1000+1000}
        self.worker.validate_request(r,p)
        for key,value in (("limits",{**p["limits"],"fullGeneratorAutogradCalls":4}),
                ("target",{**p["target"],"parameterIndex":60}),("qualification",{**p["qualification"],"trainingAllowed":True}),
                ("resources",{**p["resources"],"automaticRetries":1}),("scope",{**p["scope"],"split":"validation"})):
            bad=copy.deepcopy(p);bad[key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):self.worker.validate_request(r,bad)
        with self.assertRaises(ValueError):self.worker.validate_request({**r,"deadlineUnixMs":0},p)
        old=json.loads((ROOT/self.worker.PREDECESSOR["policy"]["path"]).read_text())
        with self.assertRaises(ValueError):self.worker.validate_request({**r,"policy":self.worker.PREDECESSOR["policy"]},old)
        for key in ("policy","claim","failure","repairReview"):
            changed=deepcopy(p);changed["predecessorVerification"][key]["sha256"]="0"*64
            with self.subTest(predecessor=key),self.assertRaises(ValueError):self.worker.validate_request(r,changed)
        with self.assertRaises(ValueError):self.worker.validate_request({**r,"verificationRevision":1},p)

    def test_restricted_pickle_forbids_arbitrary_globals(self):
        import pickle,io
        with self.assertRaisesRegex(ValueError,"forbidden"):
            self.worker.FixtureUnpickler(io.BytesIO(pickle.dumps(os.system))).load()
        with self.assertRaises(ValueError):
            self.worker.FixtureUnpickler(io.BytesIO(b"")).persistent_load(("storage","DoubleStorage","0","cpu",10))

    def test_fixture_decoder_rejects_archive_expansion_and_wrong_target_before_tensor_use(self):
        import io,zipfile
        md={"labels":list(bridge.COMPONENTS_IN_ORDER),"parameterIndex":52,"parameterName":candidate.TARGET+".weight"}
        with self.assertRaises(ValueError):self.worker.decode_fixture(b"",md)
        md["parameterIndex"]=88
        stream=io.BytesIO()
        with zipfile.ZipFile(stream,"w",compression=zipfile.ZIP_DEFLATED) as z:z.writestr("x/data.pkl",b"x")
        with self.assertRaisesRegex(ValueError,"uncompressed"):
            self.worker.decode_fixture(stream.getvalue(),md)

    def test_single_sample_reader_refuses_state_archive_and_undeclared_source(self):
        class Mapping:
            project=ROOT
            def binding(self,b,maximum):raise AssertionError("unexpected file read")
        reader=self.worker.SingleSampleReader(Mapping(),lambda:None,[])
        b={"path":".runtime/old/tensors.pt","sha256":"a"*64}
        reader.allow(b)
        with self.assertRaisesRegex(ValueError,"state archive"):reader.read(b)
        with self.assertRaisesRegex(ValueError,"undeclared"):
            reader.read({"path":"data/other.json","sha256":"b"*64})

    def synthetic_sources(self):
        """All data lives in memory. Real seasonal/ecology binders remain active."""
        worker=self.worker
        class Mapping:
            project=ROOT
            def __init__(self):self.data={};self.reads=[];self.checks=0
            def check(self):self.checks+=1
            def put(self,name,value):
                raw=value if type(value) is bytes else (json.dumps(value,sort_keys=True,separators=(",",":"),allow_nan=False)+"\n").encode()
                self.data[name]=raw
                return {"path":name,"sha256":hashlib.sha256(raw).hexdigest()}
            def binding(self,b,maximum=2*1024**2):
                raw=self.data[b["path"]]
                if len(raw)>maximum or hashlib.sha256(raw).hexdigest()!=b["sha256"]:
                    raise ValueError("synthetic exact byte binding differs: "+b["path"])
                self.reads.append(b["path"])
                return raw
        mapping=Mapping()
        def put(name,value):return mapping.put("data/synthetic-finalrgb88/"+name,value)
        climate={"sourceId":"synthetic-climate","role":"regional_climate_and_monsoon_context","license":"synthetic test permission",
            "attribution":"synthetic fixture","acquisitionStatus":"test","visualTrainingTargetEligible":False}
        snapshot=put("snapshot.json",{"schemaVersion":"natural-home-visual-snapshot-v1","status":"provisional_owner_approved_profile_baseline",
            "snapshotId":"synthetic-snapshot","usage":{"originalImageCoverageBaseline":True},"isFinal":False,
            "environment":{"season":"dry_season","weather":"clear","lighting":"day","groundMoisture":"dry"}})
        regional=put("profile.json",{"synthetic":True})
        registry=put("registry.json",{"sources":[climate]})
        provenance={"seasonSnapshotPath":snapshot["path"],"seasonSnapshotSha256":snapshot["sha256"],
            "worldProfilePath":regional["path"],"worldProfileSha256":regional["sha256"],
            "sourceRegistryPath":registry["path"],"sourceRegistrySha256":registry["sha256"],"sources":[climate]}
        region={"sourceProvenance":provenance}
        canonical=hashlib.sha256(json.dumps(region,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()
        region["packageSha256"]=canonical
        region_binding=put("region.json",region)
        facts=put("facts.json",{"synthetic":True})
        visual=put("visual.json",{"synthetic":True})
        ecology={"season":"dry_season","landscapeType":"forested-low-mountain","snapshotId":"synthetic-snapshot"}
        material={"season":"dry_season","weather":"clear","lighting":"day","groundMoisture":"dry"}
        task=put("task.json",{"sourceBindings":{"naturalizedWorldFactsPath":facts["path"],"naturalizedWorldFactsSha256":facts["sha256"],
            "seasonSnapshotPath":snapshot["path"],"seasonSnapshotSha256":snapshot["sha256"],"regionalProfilePath":regional["path"],"regionalProfileSha256":regional["sha256"],
            "realEarthRegionSourcePackagePath":region_binding["path"],"realEarthRegionSourcePackageSha256":canonical},
            "directorPlan":{"singleMapEcologyPlan":ecology,"singleMapMaterialPlan":material}})
        channels=[{**put("channel-"+str(i)+".json",{"syntheticChannel":i}),"id":name} for i,name in enumerate(ORDER)]
        image=put("image.json",{"syntheticImage":True})
        pack=put("pack.json",{"categoricalConditions":{"ecologyPlan":ecology,"materialPlan":material},
            "sourceBindings":{"taskPackagePath":task["path"]},"objectInstanceTable":[]})
        identity={"sampleId":worker.SAMPLE_ID,"split":"train","image":image,"conditionPack":pack,"taskPackage":task,
            "visualFactManifestFile":visual,"channels":channels,"factHash":facts["sha256"]}
        row={"sampleId":worker.SAMPLE_ID,"split":"train","image":image,"conditionPack":pack,"regionSource":region_binding,
            "contribution":put("contribution.json",{}),"sourceRecord":put("record.json",{})}
        index=put("index.json",{"samples":[row]})
        manifest=put("manifest.json",{"sourceIndex":index,"identityPayload":{"channelOrder":list(ORDER),"continuousChannelIds":[]}})
        contract=put("contract.json",{"tensorContract":{"channelOrder":list(ORDER),"typePartitions":{"continuous":[]}}})
        # Historical bindings are deliberately not current source permissions.
        locator={"context":{"sampleIdentity":identity,"programBindings":{"unusedOldRole":{"path":"scripts/legacy-unused.mjs","sha256":"d"*64}}}}
        source_programs=[]
        for module in tuple(sys.modules.values()):
            name=getattr(module,"__file__",None)
            if not name:continue
            try:logical=Path(name).resolve().relative_to(ROOT.resolve()).as_posix()
            except ValueError:continue
            if logical.startswith(("ml/ai-painter/src/","ml/ai-painter/scripts/")) and logical.endswith(".py"):
                b=mapping.put(logical,(ROOT/logical).read_bytes())
                if b not in source_programs:source_programs.append(b)
        canonical_module=mapping.put(worker.SOURCE_SNAPSHOT_MODULE,(ROOT/worker.SOURCE_SNAPSHOT_MODULE).read_bytes())
        source_programs.append(canonical_module)
        def decoded_sample(reader,row,order,continuous):
            reader.read(row["image"]);reader.snapshot(identity["visualFactManifestFile"]["path"])
            return {"sampleId":worker.SAMPLE_ID,"split":"train","image":torch.zeros(3,192,256),
                "conditions":torch.zeros(23,192,256),"objectInstanceTable":[]},deepcopy(identity)
        return mapping,locator,source_programs,manifest,contract,decoded_sample

    def source_guard(self,fixture):
        _,_,_,manifest,contract,decoded=fixture
        stack=ExitStack()
        cpu=self.worker.profile.core.cpu
        stack.enter_context(patch.object(cpu,"MANIFEST",manifest))
        stack.enter_context(patch.object(cpu,"CONDITION_CONTRACT",contract))
        # Only the raster decoding boundary is synthetic. derive_regime_record,
        # bound_regime, bind_sample_ecology and both validators run unchanged.
        stack.enter_context(patch.object(cpu,"load_sample",decoded))
        return stack

    def test_loader_real_season_and_ecology_chain_uses_only_declared_source_snapshot(self):
        fixture=self.synthetic_sources();mapping,locator,programs,*_=fixture
        with self.source_guard(fixture):
            sample,order,reader=self.worker.load_train_sample(mapping,locator,lambda:None,programs)
        self.assertEqual(tuple(order),ORDER)
        self.assertEqual(reader.root,ROOT)
        self.assertEqual(digest(sample["appearance_regime"]),digest(encode_season("dry_season")))
        self.assertEqual(digest(sample["ecology_regime"]),digest(encode_ecology("forested-low-mountain")))
        self.assertGreaterEqual(mapping.reads.count(self.worker.SOURCE_SNAPSHOT_MODULE),5)
        self.assertIn(self.worker.SOURCE_SNAPSHOT_MODULE,reader.observed)
        self.assertNotIn("scripts/legacy-unused.mjs",reader.allowed)
        with self.assertRaisesRegex(ValueError,"undeclared source snapshot"):
            reader.snapshot("scripts/legacy-unused.mjs")
        with self.assertRaisesRegex(ValueError,"undeclared source snapshot"):
            reader.snapshot("scripts/lib/unregistered.mjs")

    def test_loader_rejects_missing_wrong_or_conflicting_current_module_binding(self):
        fixture=self.synthetic_sources();mapping,locator,programs,*_=fixture
        missing=[b for b in programs if b["path"]!=self.worker.SOURCE_SNAPSHOT_MODULE]
        wrong=[{**b,"sha256":"0"*64} if b["path"]==self.worker.SOURCE_SNAPSHOT_MODULE else b for b in programs]
        for bindings,message in ((missing,"undeclared source snapshot"),(wrong,"byte binding")):
            with self.subTest(message=message),self.source_guard(fixture),self.assertRaisesRegex(ValueError,message):
                self.worker.load_train_sample(mapping,locator,lambda:None,bindings)
        for bindings in ([programs[-1],programs[-1]], [{"path":".runtime/old/tensors.pt","sha256":"a"*64}],
                [{"path":"scripts/../escape.mjs","sha256":"a"*64}]):
            with self.assertRaises(ValueError):self.worker.SingleSampleReader(mapping,lambda:None,bindings)

    def test_full_main_authenticated_memory_request_runs_loader_chain_and_five_gradient_bridge(self):
        # Complete Python main/run_check control flow. Source binding and regime
        # chain are real; raster decoding, renderer and Loss are explicit test
        # fixtures. This is NOT a real 256x192 renderer/Loss acceptance run.
        worker=self.worker;fixture=self.synthetic_sources()
        mapping,locator,programs,*_=fixture
        # Use the real Node producer's current collector verbatim. No test-side
        # append of the canonical module may repair an incomplete producer.
        collector_script=("import fs from 'node:fs';"
            "import {collectSourceClosure,POLICY} from './scripts/check-ai-painter-final-rgb-base-weight-precision-cpu-v1.mjs';"
            "import {createReader} from './scripts/lib/ai-painter-stage4-dataset-audit.mjs';"
            "const root=process.cwd(),reader=createReader(root),p=reader.bound(POLICY);"
            "process.stdout.write(JSON.stringify(collectSourceClosure(root,reader,p,Date.now()+30000)));")
        collected=subprocess.run(["node","--input-type=module","-e",collector_script],cwd=ROOT,
            text=True,encoding="utf-8",capture_output=True,check=True,timeout=35)
        programs=json.loads(collected.stdout)
        for b in programs:
            self.assertEqual(mapping.put(b["path"],(ROOT/b["path"]).read_bytes()),b)
        module_rows=[b for b in programs if b["path"]==worker.SOURCE_SNAPSHOT_MODULE]
        self.assertEqual(len(module_rows),1,"actual Node producer omitted the required canonical module")
        self.assertEqual(module_rows[0]["sha256"],hashlib.sha256((ROOT/worker.SOURCE_SNAPSHOT_MODULE).read_bytes()).hexdigest())
        policy=json.loads((ROOT/worker.POLICY_PATH).read_text())
        locator_binding=mapping.put("data/synthetic-finalrgb88/locator.json",locator)
        labels=list(bridge.COMPONENTS_IN_ORDER)
        tensors={"input":torch.zeros(1,48,192,256)}
        tensors["input"][0,0,0,0]=1
        for label,coefficient in zip(labels,(10,1,2,3,4)):
            value=torch.zeros(1,48,192,256);value[0,0,0,0]=coefficient
            tensors["adjoint."+label]=value
            tensors["gradient."+label]=torch.full((48,48,3,3),float("nan"))
        metadata={"labels":labels,"parameterIndex":88,"parameterName":candidate.TARGET+".weight",
            "descriptors":{key:{"bytes":value.numel()*4,"shape":list(value.shape),"stride":list(value.stride()),
                "dtype":"torch.float32","sha256":digest(value)} for key,value in tensors.items()}}
        archive=io.BytesIO();torch.save(tensors,archive)
        fixtures={
            "originalGateFailure":mapping.put("data/synthetic-finalrgb88/original-failure.json",{"synthetic":True}),
            "tensors":mapping.put("data/synthetic-finalrgb88/target-capture.pt",archive.getvalue()),
            "metadata":mapping.put("data/synthetic-finalrgb88/capture.json",metadata),
            "contrastTensors":mapping.put("data/synthetic-finalrgb88/contrast.pt",b"synthetic provenance only; not decoded")}
        for b in fixtures.values():b["bytes"]=len(mapping.data[b["path"]])
        del tensors,archive
        policy["dataLocator"],policy["operatorFixture"]=locator_binding,fixtures
        p_binding=mapping.put(worker.POLICY_PATH,policy)
        for key in ("policy","claim","failure","repairReview"):
            b=worker.PREDECESSOR[key]
            self.assertEqual(mapping.put(b["path"],(ROOT/b["path"]).read_bytes()),b)
        for item in policy["sourceAlgorithmBindings"]:
            b=item["binding"];mapping.put(b["path"],(ROOT/b["path"]).read_bytes())
        formal=policy["formalSpecification"]
        mapping.put(formal["path"],(ROOT/formal["path"]).read_bytes())
        request={"schemaVersion":"final-rgb-base-precision-cpu-request-v1","runId":"synthetic-main-not-real-cpu-attempt",
            "policy":p_binding,"verificationRevision":2,"predecessorVerification":deepcopy(worker.PREDECESSOR),
            "programBindings":programs,"interpreter":{"path":sys.executable,
                "sha256":hashlib.sha256(Path(sys.executable).read_bytes()).hexdigest()},"deadlineUnixMs":time.time()*1000+110000}
        r_binding=mapping.put("data/synthetic-finalrgb88/request.json",request)
        forwards=[]
        def synthetic_forward(model,sample):
            worker.profile.validate_sample_ecology(sample)
            forwards.append(type(model).__name__)
            energy=sum(p.square().mean() for p in model.parameters())
            return torch.sigmoid(energy).expand(1,3,192,256)
        def synthetic_objective(critic,prediction,sample,table,order):
            value=prediction.mean()
            s,w,c,u=value*.001,value*-.004,value*.001,value*.001
            return ((s+w)+c)+u,{"v21UnchangedTotal":s,"wholeFrameFidelity":w,
                "objectCoreRgbWeighted":c,"objectSupportStructureWeighted":u}
        frozen_factory=worker.profile.fresh_networks
        def synthetic_networks(order):
            baseline,_=frozen_factory(order)
            return baseline,nn.Linear(1,1).eval()
        def interop(n):self.assertEqual((n,torch.get_num_interop_threads()),(2,2))
        output=io.StringIO()
        with self.source_guard(fixture),ExitStack() as guards:
            guards.enter_context(patch.object(worker.capture.RuntimeMap,"current",return_value=mapping))
            guards.enter_context(patch.object(worker,"LOCATOR",locator_binding))
            guards.enter_context(patch.object(worker,"FIXTURES",fixtures))
            guards.enter_context(patch.object(worker,"POLICY_SHA256",p_binding["sha256"]))
            guards.enter_context(patch.object(worker.profile,"fresh_networks",synthetic_networks))
            guards.enter_context(patch.object(worker.profile,"sample_forward",synthetic_forward))
            guards.enter_context(patch.object(worker,"train_object_support_structure_candidate_objective",synthetic_objective))
            guards.enter_context(patch.object(torch,"set_num_interop_threads",interop))
            guards.enter_context(patch.object(sys,"argv",[worker.__file__,"--request",r_binding["path"],"--request-sha256",r_binding["sha256"]]))
            with redirect_stdout(output):worker.main()
            result=json.loads(output.getvalue())
            self.assertEqual(result["counts"],worker.LIMITS)
            self.assertEqual(result["status"],"cpu_candidate_verified_inactive")
            self.assertEqual(result["verificationRevision"],2)
            self.assertEqual(result["predecessorVerification"],worker.PREDECESSOR)
            self.assertEqual(len(forwards),2)
            self.assertEqual(result["gradientFacts"]["autogradGradCalls"],5)
            self.assertEqual(result["gradientFacts"]["independentFullParameterGradientTensorCounts"],[108]*5)
            self.assertIn(worker.SOURCE_SNAPSHOT_MODULE,result["sourceReceipts"])
            self.assertFalse(result["trainingAllowed"])
            self.assertFalse(result["failedStateOrCheckpointLoaded"])
            # Complete main rejects a source omission before fixture work. It
            # neither consumes a real attempt nor falls back to old bindings.
            for bad_programs,message in (
                    ([b for b in programs if b["path"]!=worker.SOURCE_SNAPSHOT_MODULE],"missing required canonical snapshot module"),
                    ([{**b,"sha256":"0"*64} if b["path"]==worker.SOURCE_SNAPSHOT_MODULE else b for b in programs],"byte binding differs")):
                bad={**request,"programBindings":bad_programs}
                bad_binding=mapping.put(r_binding["path"],bad)
                with patch.object(sys,"argv",[worker.__file__,"--request",bad_binding["path"],"--request-sha256",bad_binding["sha256"]]),redirect_stdout(io.StringIO()) as log:
                    with self.assertRaisesRegex(ValueError,message):worker.main()
                rejected=json.loads(log.getvalue())
                self.assertEqual(rejected["counts"],{key:0 for key in worker.LIMITS})
                self.assertEqual(len(forwards),2)

    def test_positive_selective_fixture_decoding_never_uses_saved_gradient_values(self):
        # Synthetic in-memory archive only; no diagnostic/source file is opened.
        labels=list(bridge.COMPONENTS_IN_ORDER)
        wanted=["input"]+["adjoint."+label for label in labels]
        data={key:torch.full((1,48,192,256),i*.01) for i,key in enumerate(wanted)}
        for label in labels:
            data["gradient."+label]=torch.full((48,48,3,3),float("nan"))
        md={"labels":labels,"parameterIndex":88,"parameterName":candidate.TARGET+".weight",
            "descriptors":{key:{"bytes":9437184,"dtype":"torch.float32","shape":[1,48,192,256],
                "stride":[2359296,49152,256,1],"sha256":digest(data[key])} for key in wanted}}
        stream=io.BytesIO();torch.save(data,stream)
        actual=self.worker.decode_fixture(stream.getvalue(),md)
        self.assertEqual(list(actual),wanted)
        self.assertTrue(all(torch.equal(actual[key],data[key]) for key in wanted))
        md["descriptors"]["input"]["sha256"]="0"*64
        with self.assertRaisesRegex(ValueError,"descriptor"):
            self.worker.decode_fixture(stream.getvalue(),md)


if __name__ == "__main__":
    with ExitStack() as guard:
        guard.enter_context(patch.object(torch,"save",synthetic_memory_save))
        for obj, name in ((torch.cuda, "_lazy_init"), (torch.optim.Optimizer, "__init__"), (torch, "load")):
            guard.enter_context(patch.object(obj, name, side_effect=AssertionError("CPU component prohibited operation")))
        result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__]))
    assert not torch.cuda.is_initialized() and time.monotonic() - STARTED < 120
    print(json.dumps({"testsRun": result.testsRun, "passed": result.wasSuccessful(), "seconds": time.monotonic() - STARTED,
        "cpuThreads": torch.get_num_threads(), "cpuInteropThreads": torch.get_num_interop_threads(),
        "operatorSpatialShape": [4, 5], "microRendererShape": [16, 16], "microRendererForwardVerified": False,
        "syntheticFullParameterGradientsVerified": result.wasSuccessful(), "real256ForwardLossVerified": False,
        "optimizerUpdates": 0, "gpuInitialized": False, "sourceDataRead": False}))
    raise SystemExit(0 if result.wasSuccessful() else 1)
