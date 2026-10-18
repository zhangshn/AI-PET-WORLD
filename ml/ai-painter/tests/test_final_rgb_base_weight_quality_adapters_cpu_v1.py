"""New-route admission and private synthetic CPU checks; never a production entry."""
from collections import OrderedDict
from contextlib import ExitStack
from copy import deepcopy
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT=Path(__file__).absolute().parents[3]
sys.path[:0]=[str(ROOT/"ml/ai-painter/src"),str(ROOT/"ml/ai-painter/scripts")]
sys.dont_write_bytecode=True
os.environ["CUDA_VISIBLE_DEVICES"]=""
os.environ["OMP_NUM_THREADS"]=os.environ["MKL_NUM_THREADS"]="2"
import torch
torch.set_num_threads(2)
from torch import nn
import object_support_structure_quality_auth_v1 as auth
import painter_stage4_object_support_structure_quality_worker_v1 as worker
import painter_stage4_final_rgb_base_weight_training_profile_v1 as profile
import painter_stage4_object_support_structure_training_profile_v1 as old_profile
import painter_stage4_object_support_structure_lifecycle_v1 as loop
import qualify_stage4_object_support_structure_quality_gpu_v1 as qualifier
import review_stage4_object_support_structure_quality_cpu_v1 as review
from ai_painter.complete_world import final_rgb_base_weight_quality_checkpoint_v1 as codec
from ai_painter.complete_world import object_support_final_rgb_weight_priority_update_device_v1 as device
from ai_painter.complete_world import object_support_structure_checkpoint_v1 as old_codec
from ai_painter.complete_world import object_ecology_final_rgb_base_weight_precision_v1 as model_identity
from ai_painter.complete_world import object_ecology_terrain_detail_weight_precision_v1 as parent_identity
from ai_painter.complete_world import object_ecology_decode1_weight_precision_v1 as graph
from ai_painter.complete_world.stage4_semantic_transport_v2 import FORMAL_CONDITION_CHANNEL_ORDER as ORDER

PREVIEW={"path":codec.PREVIEW_PATH,"sha256":"a"*64}


def digest(value):
    return hashlib.sha256(value.detach().cpu().contiguous().reshape(-1).view(torch.uint8).numpy().tobytes()).hexdigest()


def state(model):
    return {key:digest(value) for key,value in model.state_dict().items()}


def selection():
    import ecology_quality_ranking_v1 as ranking
    rows=[{"sampleId":"synthetic-"+str(i),"split":"validation","epoch":24,"fullRgbMae":.2,
        "objectCorrelations":{key:.1 for key in ("object_footprints","object_tree","object_rock","object_vegetation")}} for i in range(8)]
    return ranking.rank_validation_epoch(rows,[r["sampleId"] for r in rows],epoch=24,eligible_epochs=(24,))


def checkpoint_args():
    b=lambda name:{"path":name,"sha256":"b"*64}
    return dict(configuration=codec.expected_configuration(PREVIEW),run_id="synthetic-finalrgb-run",
        package_binding=b(".runtime/synthetic/package.json"),dataset_binding=b("data/synthetic/manifest.json"),
        epoch=24,selection=selection(),counts={"generator":1152,"discriminator":1152},
        program_bindings={"synthetic":b("ml/ai-painter/scripts/synthetic.py")},plan_binding=b(".runtime/synthetic/quality-plan.json"))


class AdmissionTests(unittest.TestCase):
    """No Module call/autograd/optimizer/CUDA: safe inside own CPU preparation."""
    @classmethod
    def setUpClass(cls):
        cls.model,cls.critic=profile.fresh_networks(ORDER)
        cls.config=codec.expected_configuration(PREVIEW)

    def test_01_only_two_trusted_routes(self):
        self.assertEqual(auth.execution_route().capability,auth.CAPABILITY)
        self.assertEqual(auth.execution_route(codec.CAPABILITY).model_capability,model_identity.CAPABILITY)
        for wrong in (None,"unknown",model_identity.CAPABILITY):
            with self.assertRaises(ValueError):auth.execution_route(wrong)

    def test_02_frozen_cpu_sources_kept(self):
        p=json.loads((ROOT/auth.FINAL_RGB_POLICY["path"]).read_text())
        for b in p["modelBoundary"]["frozenCpuSources"]:
            self.assertEqual(hashlib.sha256((ROOT/b["path"]).read_bytes()).hexdigest(),b["sha256"])

    def test_03_runtime_selects_real_new_profile(self):
        self.assertIs(worker.runtime(codec.CAPABILITY)[1],profile)
        self.assertIs(worker.runtime()[1],old_profile)
        self.assertIs(auth.checkpoint_components(codec.CAPABILITY),codec)
        self.assertIs(auth.checkpoint_components(),old_codec)

    def test_04_full_fresh_graph_and_bytes_preserved(self):
        parent=parent_identity.build_fresh_object_ecology_terrain_detail_weight_precision(condition_channel_order=ORDER)
        left,right=tuple(self.model.named_parameters()),tuple(parent.named_parameters())
        self.assertEqual(len(left),108);self.assertEqual(sum(p.numel() for _,p in left),2242687)
        self.assertTrue(all(n==m and digest(v)==digest(w) for (n,v),(m,w) in zip(left,right)))
        changes=[n for (n,cls,cfg),(m,other,config) in zip(graph._module_graph(self.model),graph._module_graph(parent)) if cls is not other or cfg!=config]
        self.assertEqual(changes,["",model_identity.TARGET])

    def test_05_fresh_factory_preserves_rng_and_independent_storage(self):
        rng=torch.get_rng_state().clone();other,critic=profile.fresh_networks(ORDER)
        self.assertTrue(torch.equal(rng,torch.get_rng_state()))
        self.assertEqual(state(other),state(self.model))
        self.assertEqual(state(critic),state(self.critic))
        self.assertTrue(all(a is not b and a.untyped_storage()._cdata!=b.untyped_storage()._cdata for a,b in zip(other.parameters(),self.model.parameters())))

    def test_06_original_parent_carrier_retains_own_identity(self):
        carrier=device._cpu_carrier(self.model)
        parent_identity.validate_model_identity(carrier)
        self.assertNotEqual(carrier.capability_version,self.model.capability_version)
        self.assertFalse(carrier.execution_qualified)
        for name in ("numeric_identity","regime_identity","ecology_identity"):
            self.assertNotEqual(digest(getattr(carrier,name)),digest(getattr(self.model,name)))

    def test_07_carrier_parameter_tampering_rejected(self):
        carrier=device._cpu_carrier(self.model)
        with torch.no_grad():next(carrier.parameters()).view(-1)[0]+=1
        with self.assertRaises(ValueError):device._verify_carrier(self.model,carrier)

    def test_08_old_model_rejected_by_new_device_binder(self):
        parent=parent_identity.build_fresh_object_ecology_terrain_detail_weight_precision(condition_channel_order=ORDER)
        with self.assertRaises(ValueError):device.bind_parameters(parent)

    def test_09_new_configuration_has_exact_current_contracts(self):
        self.assertEqual(self.config["gpuAdmissionSeconds"],720)
        self.assertEqual(old_codec.expected_configuration()["gpuAdmissionSeconds"],600)
        codec.validate_configuration(self.config)
        self.assertEqual(self.config["schema"],old_codec.CONFIGURATION_SCHEMA)
        self.assertEqual(self.config["executionPolicy"],auth.FINAL_RGB_POLICY)
        self.assertEqual(self.config["formalSpecification"],auth.FINAL_RGB_SPECIFICATION)
        self.assertEqual(self.config["trainingPreviewPolicy"],PREVIEW)
        self.assertEqual(self.config["integrationPolicy"],old_codec.POLICY)

    def test_10_old_configuration_rejected(self):
        with self.assertRaises(ValueError):codec.validate_configuration(old_codec.expected_configuration())

    def test_11_changed_optimizer_or_resource_rejected(self):
        for key,sub,value in (("optimizer","generatorLearningRate",.1),("executionCeiling","epochs",25),("executionCeiling","maxWallSeconds",8401)):
            bad=deepcopy(self.config);bad[key][sub]=value
            with self.assertRaises(ValueError):codec.validate_configuration(bad)
        for seconds in (600,721,True,"720"):
            bad=deepcopy(self.config);bad["gpuAdmissionSeconds"]=seconds
            with self.assertRaises(ValueError):codec.validate_configuration(bad)

    def test_12_preview_unknown_version_rejected(self):
        for p in ("data/arbitrary.json",PREVIEW["path"].replace("v3","v2")):
            with self.assertRaises(ValueError):codec.expected_configuration({"path":p,"sha256":"a"*64})

    def test_13_execution_policy_exact_values(self):
        p=json.loads((ROOT/auth.FINAL_RGB_POLICY["path"]).read_text())
        codec.validate_execution_policy(p,self.config)
        self.assertEqual(p["phaseResources"]["gpuAdmissionSeconds"],720)
        for seconds in (600,721):
            bad=deepcopy(p);bad["phaseResources"]["gpuAdmissionSeconds"]=seconds
            with self.assertRaises(ValueError):codec.validate_execution_policy(bad,self.config)
        p["gpuAdmission"]["generatorAutogradPerSample"]=4
        with self.assertRaises(ValueError):codec.validate_execution_policy(p,self.config)

    def test_14_checkpoint_new_metadata_and_own_model_reference(self):
        kwargs=checkpoint_args();raw=codec.encode(self.model,self.critic,**kwargs)
        payload=torch.load(io.BytesIO(raw),weights_only=True)
        self.assertEqual(payload["schema"],"final-rgb-base-weight-quality-checkpoint-v1")
        self.assertEqual(payload["modelCapabilityVersion"],model_identity.CAPABILITY)
        self.assertEqual(payload["architecture"],model_identity.ARCHITECTURE)
        self.assertFalse(payload["checkpointQualified"])

    def test_15_checkpoint_strict_roundtrip_keeps_objects_and_storage(self):
        model,critic=profile.fresh_networks(ORDER);kwargs=checkpoint_args()
        raw=codec.encode(self.model,self.critic,**kwargs)
        before=[(id(p),p.untyped_storage()._cdata) for n in (model,critic) for p in n.parameters()]
        codec.reload(raw,model=model,critic=critic,**kwargs)
        self.assertEqual(before,[(id(p),p.untyped_storage()._cdata) for n in (model,critic) for p in n.parameters()])
        self.assertEqual(state(model),state(self.model));self.assertEqual(state(critic),state(self.critic))

    def test_16_checkpoint_old_metadata_or_partial_state_rejected(self):
        kwargs=checkpoint_args();raw=codec.encode(self.model,self.critic,**kwargs)
        payload=torch.load(io.BytesIO(raw),weights_only=True)
        for mutate in (lambda p:p.update(schema=old_codec.SCHEMA),lambda p:p["generator"].pop(next(iter(p["generator"]))),lambda p:p.update(runId="other")):
            bad=deepcopy(payload);mutate(bad);buffer=io.BytesIO();torch.save(bad,buffer)
            with self.assertRaises(ValueError):codec.reload(buffer.getvalue(),model=self.model,critic=self.critic,**kwargs)

    def test_17_checkpoint_late_failure_rolls_back_both_networks(self):
        model,critic=profile.fresh_networks(ORDER);kwargs=checkpoint_args()
        raw=codec.encode(self.model,self.critic,**kwargs);before=(state(model),state(critic))
        parameter=next(model.parameters());storage=parameter.untyped_storage()._cdata
        def fail(*args):
            parameter.data=parameter.detach().clone()
            raise ValueError("synthetic late install failure")
        handle=critic.register_load_state_dict_post_hook(fail)
        try:
            with self.assertRaises(ValueError):codec.reload(raw,model=model,critic=critic,**kwargs)
        finally:handle.remove()
        self.assertEqual(before,(state(model),state(critic)))
        self.assertEqual(storage,parameter.untyped_storage()._cdata)

    def test_18_checkpoint_never_accepts_old_generator_type(self):
        model=parent_identity.build_fresh_object_ecology_terrain_detail_weight_precision(condition_channel_order=ORDER)
        with self.assertRaises(ValueError):codec.encode(model,self.critic,**checkpoint_args())

    def test_19_only_final_epoch_checkpoint_eligible(self):
        kwargs=checkpoint_args()
        codec.validate_selection(self.config,kwargs["run_id"],24,kwargs["selection"],kwargs["counts"])
        with self.assertRaises(ValueError):codec.validate_selection(self.config,kwargs["run_id"],12,kwargs["selection"],{"generator":576,"discriminator":576})

    def test_20_explicit_engine_rejects_unknown_component(self):
        with self.assertRaises(ValueError):old_profile._component_profile(object())
        self.assertIs(old_profile._component_profile(None),old_profile)
        self.assertIs(old_profile._component_profile(profile),profile)

    def test_21_lifecycle_profile_and_codec_select_exact_new_route(self):
        self.assertIs(loop.profile_components(codec.CAPABILITY),profile)
        self.assertIs(loop._codec(codec.CAPABILITY),codec)
        with self.assertRaises(ValueError):loop.profile_components("other")

    def test_22_new_source_roles_are_unique_and_historical_roles_not_required(self):
        roles=auth.required_program_roles(codec.CAPABILITY)
        self.assertEqual(roles["finalRgbCheckpoint"],"ml/ai-painter/src/ai_painter/complete_world/final_rgb_base_weight_quality_checkpoint_v1.py")
        self.assertNotEqual(roles["managedCheckpoint"],roles["finalRgbCheckpoint"])
        self.assertNotIn("frozenProjectManifest",roles)
        self.assertEqual(len(roles),len(set(roles.values())))

    def test_23_qualifier_counts_remain_five_G_one_D(self):
        counts=qualifier.Calls();counts.begin()
        for kind,n in (("forward",1),("generator",5),("discriminator",1)):
            for _ in range(n):counts.event("attempt",kind,None);counts.event("complete",kind,None)
        with self.assertRaises(ValueError):counts.event("attempt","generator",None)
        self.assertEqual(counts.counts["generatorCompleted"],5)

    def test_24_inactive_flags_cannot_self_qualify(self):
        self.assertFalse(self.model.execution_qualified);self.assertFalse(self.model.parent_checkpoint_loaded)
        self.assertFalse(profile.EXECUTION_QUALIFIED);self.assertFalse(codec.EXECUTION_QUALIFIED)

    def test_25_actual_current_configuration_hashes_registered_metadata_only(self):
        reader=auth.Reader(ROOT)
        value=auth.derive_configuration(reader,capability_version=codec.CAPABILITY)
        codec.validate_configuration(value)
        self.assertEqual(value["executionPolicy"],auth.FINAL_RGB_POLICY)
        self.assertIn(codec.PREVIEW_PATH,reader.observed)
        self.assertTrue(all(not name.endswith(".pt") for name in reader.observed))
        self.assertEqual(value["formalSpecification"],auth.FINAL_RGB_SPECIFICATION)

    def test_26_new_gpu_gate_rejects_old_identity_and_incomplete_counts(self):
        ids=["synthetic-"+str(i) for i in range(48)]
        binding={"path":".runtime/synthetic-new/gpu-gate.json","sha256":"a"*64}
        package={"path":".runtime/synthetic-new/package.json","sha256":"b"*64}
        plan={"capabilityVersion":codec.CAPABILITY,"outputRoot":".runtime/synthetic-new","runId":"synthetic-run",
            "packageId":"synthetic-package","programBindings":{},"trainSplit":{"path":"data/train.json","sha256":"c"*64},
            "modelBinding":{"path":"data/model.json","sha256":"d"*64}}
        gate={"schema":worker.GPU_SCHEMA,"status":"passed","capabilityVersion":codec.CAPABILITY,
            "executionProfile":auth.execution_route(codec.CAPABILITY).profile,"runId":plan["runId"],"packageId":plan["packageId"],
            "executionPackage":package,"programBindings":{},"actualCounts":{k+s:n for k,n in (("forward",48),("generator",240),("discriminator",48)) for s in ("Attempted","Completed")},
            "deviceIdentity":{"ordinal":0,"uuid":"GPU-11111111-1111-1111-1111-111111111111"},
            "cases":[{"sampleId":sid,"passed":True,"proof":{"callCounts":{"generatorForwards":1,"generatorForwardCompleted":1,
                "generatorAutograd":5,"discriminatorAutograd":1},"optimizerCreated":False,"optimizerUpdates":0}} for sid in ids],
            "optimizerSteps":0,"checkpointLoaded":False,"checkpointWritten":False,"initialState":{},"finalState":{},"initialCpuState":{}}
        class Reader:
            def read(self,b,maximum=0):return json.dumps(gate if b==binding else {"sampleIds":ids} if b==plan["trainSplit"] else {"initialState":{}}).encode()
        worker.verify_gpu_gate(Reader(),plan,package,binding)
        gate["capabilityVersion"]=auth.CAPABILITY
        with self.assertRaises(ValueError):worker.verify_gpu_gate(Reader(),plan,package,binding)
        gate["capabilityVersion"]=codec.CAPABILITY;gate["actualCounts"]["generatorCompleted"]=239
        with self.assertRaises(ValueError):worker.verify_gpu_gate(Reader(),plan,package,binding)


    def review_terminal(self,capability):
        route=auth.execution_route(capability);args=checkpoint_args()
        record={"epoch":24,"selection":args["selection"],"counts":args["counts"],
            "checkpoint":{"path":".runtime/synthetic/checkpoint24.pt","sha256":"c"*64}}
        return {"schema":review.TERMINAL_SCHEMA,"status":"training_completed_review_pending","executionState":"completed",
            "executionProfile":route.profile,"capabilityVersion":capability,"completedEpochs":24,
            "optimizerSteps":args["counts"],"optimizerStepsGenerator":1152,"optimizerStepsDiscriminator":1152,
            "checkpointReloadVerified":True,"challengeContentRead":False,"regressionContentRead":False,
            "checkpointPromotable":False,"formalStage4QualificationAllowed":False,"runtimePublicationAllowed":False,
            "executionPackage":args["package_binding"],"packageId":"synthetic-package","runId":args["run_id"],
            "checkpoints":[record],"selectedCheckpointRecord":record}

    def test_27_new_review_accepts_own_completed_terminal_and_rejects_old_identity(self):
        terminal=self.review_terminal(codec.CAPABILITY)
        with patch.object(codec,"validate_selection",wraps=codec.validate_selection) as validated:
            self.assertEqual(review.selected_record(terminal,configuration=self.config),terminal["selectedCheckpointRecord"])
            self.assertEqual(validated.call_count,1)
        for key,value in (("capabilityVersion",auth.CAPABILITY),("executionProfile",auth.PROFILE),
                ("optimizerStepsGenerator",1151),("completedEpochs",12),("checkpointReloadVerified",False)):
            bad=deepcopy(terminal);bad[key]=value
            with self.assertRaises(ValueError):review.selected_record(bad,configuration=self.config)
        with self.assertRaises(ValueError):review.selected_record(terminal,configuration=old_codec.expected_configuration())

    def test_28_old_review_still_accepts_own_terminal_and_rejects_new_identity(self):
        terminal=self.review_terminal(auth.CAPABILITY)
        self.assertEqual(review.selected_record(terminal,configuration=old_codec.expected_configuration()),terminal["selectedCheckpointRecord"])
        with self.assertRaises(ValueError):review.selected_record(terminal,configuration=self.config)

    def test_29_timing_policy_cannot_add_numerical_work_or_change_limits(self):
        policy=json.loads((ROOT/auth.FINAL_RGB_POLICY["path"]).read_bytes())
        codec.validate_execution_policy(policy,self.config)
        for key,value in (("maxFileBytes",32769),("additionalAutogradCalls",1),("additionalCudaSynchronization",1),
                ("canGrantQualification",True),("nestedTimingsMayBeAddedAsIndependentGpuCosts",True)):
            bad=deepcopy(policy);bad["qualificationObservation"][key]=value
            with self.assertRaises(ValueError):codec.validate_execution_policy(bad,self.config)
        history=policy["supersededExecutionRevision"]
        with self.assertRaises(ValueError):codec.validate_execution_policy(json.loads((ROOT/history["path"]).read_bytes()),self.config)
        reader=auth.Reader(ROOT);auth.derive_configuration(reader,capability_version=codec.CAPABILITY)
        self.assertIn(history["path"],reader.observed)
        self.assertIn(history["formalSpecificationSnapshot"]["path"],reader.observed)


class QualificationTimingTests(unittest.TestCase):
    """Synthetic events and private metadata only; no CUDA/model operations."""
    def setUp(self):
        self.scope=ExitStack();self.addCleanup(self.scope.close)
        for owner,name in ((torch.nn.Module,"_call_impl"),(torch.autograd,"grad"),(torch.autograd,"backward"),
                (torch.optim.Optimizer,"__init__"),(torch.cuda,"_lazy_init"),(torch.cuda,"Event"),(torch.cuda,"synchronize")):
            self.scope.enter_context(patch.object(owner,name,side_effect=AssertionError("timing tests prohibit numerical execution")))

    def fixture(self, *, create=True):
        temp=tempfile.TemporaryDirectory(prefix="finalrgb-timing-synthetic-");self.addCleanup(temp.cleanup)
        base=Path(temp.name);root=base/"project";root.mkdir();data=base/"data";(data/"hot/runtime").mkdir(parents=True)
        self.scope.enter_context(patch.dict(os.environ,{"AI_PET_WORLD_DATA_ROOT":str(data),
            "DETAIL_WEIGHT_OUTPUT_ROOTS":"[]","DETAIL_WEIGHT_OUTPUT_MAX":"16777216"}))
        reader=auth.Reader(root);route=auth.execution_route(codec.CAPABILITY)
        output=route.root_prefix+"synthetic-timing-run";reader.path(output).mkdir(parents=True)
        policy_path=reader.path(auth.FINAL_RGB_POLICY["path"]);policy_path.parent.mkdir(parents=True)
        policy_path.write_bytes((ROOT/auth.FINAL_RGB_POLICY["path"]).read_bytes())
        plan={"runId":"synthetic-timing-run","packageId":"synthetic-timing-package","outputRoot":output,
            "capabilityVersion":route.capability,"executionProfile":route.profile,"executionPolicy":route.execution_policy,
            "configuration":codec.expected_configuration(PREVIEW)}
        package={"packageIdentity":plan["packageId"],"capabilityVersion":route.capability,"outputRoot":output}
        raw=json.dumps(package).encode();bound={"path":".runtime/ai-painter/autonomous-closed-loop-packages/"+plan["packageId"]+"/package.json",
            "sha256":hashlib.sha256(raw).hexdigest()}
        package_path=reader.path(bound["path"]);package_path.parent.mkdir(parents=True);package_path.write_bytes(raw)
        context=auth.Context(reader,bound,package,plan);clock=[101.]
        self.scope.enter_context(patch.object(qualifier.time,"monotonic",side_effect=lambda:clock[0]))
        obs=qualifier.QualificationObservation(context,qualifier.Calls(),100.,101.) if create else None
        return context,clock,obs

    def events(self,obs):
        obs.calls.begin();obs.enter_sample("synthetic-0",0)
        for kind,n in (("forward",1),("discriminator",1),("generator",5)):
            for _ in range(n):obs.event("attempt",kind,None);obs.event("complete",kind,None)

    def test_initial_record_has_authenticated_identity_and_host_coverage(self):
        context,clock,obs=self.fixture();record=json.loads(context.reader.path(obs.logical).read_bytes())
        self.assertEqual(record["schemaVersion"],"ai-painter-gpu-qualification-timing-v1")
        self.assertEqual(record["executionPackage"],context.package_binding)
        self.assertEqual(record["aggregates"]["initial_authentication"]["hostSeconds"],1.)
        self.assertEqual(record["completedSamples"],0);self.assertFalse(record["canGrantQualification"])
        self.assertIn("after_module_imports",record["clockOrigin"])
        self.assertLessEqual(context.reader.path(obs.logical).stat().st_size,32768)
        self.assertFalse(context.reader.path(obs.pending_logical).exists())

    def test_actual_event_counts_post_vjp_and_sample_completion(self):
        context,clock,obs=self.fixture();self.events(obs)
        self.assertEqual(obs.completed,0);self.assertIn("post_vjp_processing",obs.active)
        clock[0]+=2.;obs.probe_returned();obs.complete_sample();obs.finish()
        record=json.loads(context.reader.path(obs.logical).read_bytes())
        self.assertEqual(record["completedSamples"],1);self.assertEqual(record["lastEvent"]["sample"]["sampleId"],"synthetic-0")
        self.assertEqual(record["actualCounts"],{k+s:n for k,n in (("forward",1),("generator",5),("discriminator",1)) for s in ("Attempted","Completed")})
        self.assertEqual(record["aggregates"]["post_vjp_processing"]["hostSeconds"],2.)
        self.assertEqual(record["optimizerConstruction"],0);self.assertEqual(record["optimizerUpdates"],0)

    def test_resource_called_once_and_nested_spans_not_independent_gpu_cost(self):
        context,clock,obs=self.fixture();seen=[]
        def resource():seen.append(True);clock[0]+=3.
        def data():obs.resource(resource);clock[0]+=2.;return "value"
        self.assertEqual(obs.measure("data_load",data),"value");self.assertEqual(seen,[True])
        self.assertEqual(obs.aggregates["resource_checks"]["hostSeconds"],3.)
        self.assertEqual(obs.aggregates["data_load"]["hostSeconds"],5.)
        self.assertFalse(obs.snapshot()["nestedTimingsMayBeAddedAsIndependentGpuCosts"])

    def test_regressing_clock_fails_closed(self):
        context,clock,obs=self.fixture();clock[0]=100.
        with self.assertRaisesRegex(ValueError,"clock regressed"):obs.enter_sample("synthetic",0)

    def test_file_ceiling_rejects_before_staging_or_overwrite(self):
        context,clock,obs=self.fixture();before=context.reader.path(obs.logical).read_bytes()
        with patch.object(obs,"snapshot",return_value={"padding":"x"*32768}):
            with self.assertRaisesRegex(ValueError,"32768"):obs.publish()
        self.assertEqual(context.reader.path(obs.logical).read_bytes(),before)
        self.assertFalse(context.reader.path(obs.pending_logical).exists())

    def test_accounting_preserves_original_phase_reserve(self):
        context,clock,obs=self.fixture()
        with patch.object(worker.capture,"directory_bytes",return_value=16777216):
            with self.assertRaisesRegex(ValueError,"reserve exhausted"):obs.publish()
        self.assertFalse(context.reader.path(obs.pending_logical).exists())

    def test_wrong_context_root_package_and_later_output_mutation_rejected(self):
        context,clock,obs=self.fixture(create=False)
        context.plan["outputRoot"]=".runtime/arbitrary"
        with self.assertRaisesRegex(ValueError,"plan identity"):qualifier.QualificationObservation(context,qualifier.Calls(),100.,101.)
        context.plan["outputRoot"]=auth.execution_route(codec.CAPABILITY).root_prefix+context.plan["runId"]
        wrong=auth.Context(context.reader,{"path":".runtime/arbitrary/package.json","sha256":"a"*64},context.package,context.plan)
        with self.assertRaisesRegex(ValueError,"package identity"):qualifier.QualificationObservation(wrong,qualifier.Calls(),100.,101.)
        obs=qualifier.QualificationObservation(context,qualifier.Calls(),100.,101.)
        obs.logical=".runtime/arbitrary/gpu-qualification-timing.json"
        with self.assertRaisesRegex(ValueError,"output path"):obs.publish()

    def test_existing_observation_is_not_replayed_or_backfilled(self):
        context,clock,obs=self.fixture();before=context.reader.path(obs.logical).read_bytes()
        with self.assertRaisesRegex(ValueError,"no replay"):qualifier.QualificationObservation(context,qualifier.Calls(),100.,101.)
        self.assertEqual(context.reader.path(obs.logical).read_bytes(),before)

    def test_failed_atomic_replace_keeps_original_and_bounded_stage(self):
        context,clock,obs=self.fixture();before=context.reader.path(obs.logical).read_bytes()
        with patch.object(qualifier.os,"replace",side_effect=OSError("synthetic sharing failure")):
            with self.assertRaises(OSError):obs.publish()
        self.assertEqual(context.reader.path(obs.logical).read_bytes(),before)
        self.assertLessEqual(context.reader.path(obs.pending_logical).stat().st_size,32768)

    def test_transient_windows_replace_retries_only_same_stage_within_original_deadline(self):
        context,clock,obs=self.fixture();original=qualifier.os.replace;seen=[]
        error=PermissionError("synthetic sharing violation");error.winerror=32
        def replace(source,target):
            seen.append((source,target))
            if len(seen)==1:raise error
            original(source,target)
        with patch.object(qualifier.os,"replace",side_effect=replace),patch.object(qualifier.time,"sleep",side_effect=lambda n:clock.__setitem__(0,clock[0]+n)):
            obs.publish()
        self.assertEqual(len(seen),2);self.assertEqual(seen[0],seen[1]);self.assertAlmostEqual(clock[0],101.01)
        self.assertFalse(context.reader.path(obs.pending_logical).exists())

    def test_replacement_uses720_not600_and_retains_attempt_and_deadline_bounds(self):
        context,clock,obs=self.fixture();clock[0]=701.
        obs.publish()
        record=json.loads(context.reader.path(obs.logical).read_bytes())
        self.assertIn("native720seconds",record["coverage"])
        self.assertEqual(obs.seconds,720)
        context.reader.path(obs.pending_logical).write_bytes(context.reader.path(obs.logical).read_bytes())
        error=PermissionError("synthetic sharing violation");error.winerror=32
        with patch.object(qualifier.os,"replace",side_effect=error) as replace,patch.object(qualifier.time,"sleep",side_effect=lambda n:clock.__setitem__(0,clock[0]+n)):
            with self.assertRaises(PermissionError) as caught:obs._replace(context.reader.path(obs.pending_logical),context.reader.path(obs.logical))
        self.assertIs(caught.exception,error);self.assertEqual(replace.call_count,5)
        self.assertAlmostEqual(clock[0],701.15)
        clock[0]=820.
        with patch.object(qualifier.os,"replace") as replace:
            with self.assertRaisesRegex(TimeoutError,"deadline"):obs._replace(context.reader.path(obs.pending_logical),context.reader.path(obs.logical))
        replace.assert_not_called()

    def test_resource_guard_selects_exact_candidate_budget_before_any_cuda_operation(self):
        for capability,seconds in ((codec.CAPABILITY,720),(auth.CAPABILITY,600)):
            configuration=codec.expected_configuration(PREVIEW) if capability==codec.CAPABILITY else old_codec.expected_configuration()
            plan={"capabilityVersion":capability,"configuration":configuration}
            guard=worker.ResourceGuard({},plan,started=100.,gpu_gate=True)
            self.assertEqual(guard.seconds,seconds)
            self.assertEqual(worker.ResourceGuard({},plan,started=100.).seconds,8400)
            for bad_seconds in (600 if seconds==720 else 720,seconds+1,True,str(seconds)):
                bad=deepcopy(plan);bad["configuration"]["gpuAdmissionSeconds"]=bad_seconds
                with self.assertRaisesRegex(ValueError,"budget"):worker.ResourceGuard({},bad,started=100.,gpu_gate=True)
            with patch.object(worker.time,"monotonic",return_value=100.+seconds),patch.object(worker,"runtime_for_plan",return_value=(torch,None,None)):
                with self.assertRaisesRegex(ValueError,"deadline"):guard()

    def test_setup_deadline_is720_only_for_authenticated_final_rgb_configuration(self):
        for capability,elapsed,reaches_cuda in ((codec.CAPABILITY,601.,True),(codec.CAPABILITY,719.999,True),
                (codec.CAPABILITY,720.,False),(auth.CAPABILITY,599.999,True),(auth.CAPABILITY,600.,False)):
            context,clock,_=self.fixture(create=False);clock[0]=100.
            route=auth.execution_route(capability)
            config=codec.expected_configuration(PREVIEW) if capability==codec.CAPABILITY else old_codec.expected_configuration()
            plan={**context.plan,"capabilityVersion":capability,"executionProfile":route.profile,
                "outputRoot":route.root_prefix+context.plan["runId"],"configuration":config,
                "modelBinding":{"path":"data/synthetic-model.json","sha256":"a"*64}}
            bound=auth.Context(context.reader,context.package_binding,{**context.package,"capabilityVersion":capability},plan)
            def fresh(order):
                clock[0]=100.+elapsed
                return object(),object()
            cuda=SimpleNamespace(is_available=lambda:(_ for _ in ()).throw(RuntimeError("synthetic CUDA boundary reached")))
            runtime=SimpleNamespace(set_num_threads=lambda n:None,cuda=cuda)
            shared=SimpleNamespace(v24=SimpleNamespace(core=SimpleNamespace(cpu=SimpleNamespace(state_hash=lambda n:"synthetic-state"))))
            with ExitStack() as scope:
                for owner,name,value in ((worker,"authenticate_live",lambda *a,**k:bound),
                        (worker,"runtime_for_plan",lambda p:(runtime,SimpleNamespace(fresh_networks=fresh),shared)),
                        (worker,"write",lambda *a,**k:None),(worker,"load_samples",lambda *a:([],ORDER)),
                        (worker.auth,"read_json",lambda *a:{"initialState":{"generator":"synthetic-state","discriminator":"synthetic-state"}}),
                        (qualifier,"observation_for_context",lambda *a:None)):
                    scope.enter_context(patch.object(owner,name,value))
                expected="synthetic CUDA boundary reached" if reaches_cuda else "GPU setup deadline exhausted"
                with self.assertRaisesRegex(RuntimeError if reaches_cuda else ValueError,expected):
                    qualifier.run(context.package_binding,root=context.reader.root)

    def test_original_error_retained_when_secondary_observation_write_fails(self):
        context,clock,obs=self.fixture();primary=RuntimeError("original data error")
        def failed():raise primary
        with patch.object(obs,"publish",side_effect=[None,OSError("secondary observation write")]):
            with self.assertRaises(RuntimeError) as caught:obs.measure("data_load",failed)
        self.assertIs(caught.exception,primary)
        with patch.object(obs,"publish",side_effect=OSError("later write")):obs.finish(primary)
        self.assertEqual(primary.qualification_observation_error["message"],"secondary observation write")

    def test_failure_after_fifth_vjp_keeps_counts_without_claiming_completed_sample(self):
        context,clock,obs=self.fixture();self.events(obs);obs.finish(RuntimeError("synthetic CPU gate failure"))
        record=json.loads(context.reader.path(obs.logical).read_bytes())
        self.assertEqual(record["actualCounts"]["generatorCompleted"],5)
        self.assertEqual(record["completedSamples"],0)
        self.assertEqual(record["aggregates"]["post_vjp_processing"]["failed"],1)
        self.assertFalse(record["uncommittedCountsReconstructed"])

    def test_old_capability_creates_no_observation_file(self):
        context,clock,obs=self.fixture(create=False);context.plan["capabilityVersion"]=auth.CAPABILITY
        self.assertIsNone(qualifier.observation_for_context(context,qualifier.Calls(),100.,101.))
        self.assertEqual(list(context.reader.path(context.plan["outputRoot"]).iterdir()),[])

    def test_synthetic_qualifier_routes_keep48_fiveG_oneD_and_original_resource_calls(self):
        for capability,fail in ((auth.CAPABILITY,False),(auth.CAPABILITY,True),(codec.CAPABILITY,False),(codec.CAPABILITY,True)):
            context,clock,_=self.fixture(create=False)
            route=auth.execution_route(capability)
            plan={**context.plan,"capabilityVersion":capability,"executionProfile":route.profile,
                "outputRoot":route.root_prefix+context.plan["runId"],"programBindings":{},
                "modelBinding":{"path":"data/synthetic-model.json","sha256":"a"*64}}
            if capability==auth.CAPABILITY:plan["configuration"]=old_codec.expected_configuration()
            package={**context.package,"capabilityVersion":capability,"outputRoot":plan["outputRoot"]}
            bound=auth.Context(context.reader,context.package_binding,package,plan)
            outputs={};resources=[];snapshots=[]
            primary=RuntimeError("synthetic probe failed after fifth VJP")
            class Network:
                def parameters(self):return ()
                def to(self,device):return self
            def probe(model,critic,sample,order,resource,*,event,failure_evidence):
                for kind,n in (("forward",1),("discriminator",1),("generator",5)):
                    for _ in range(n):
                        resource();event("attempt",kind,None)
                        resource();event("complete",kind,None)
                resource()
                if fail:raise primary
                return {"passed":True}
            profile=SimpleNamespace(fresh_networks=lambda order:(Network(),Network()),zero_update_probe=probe)
            fake_torch=SimpleNamespace(set_num_threads=lambda n:None,cuda=SimpleNamespace(is_available=lambda:True,
                is_bf16_supported=lambda:True,set_per_process_memory_fraction=lambda n:None,set_device=lambda n:None))
            shared=SimpleNamespace(v24=SimpleNamespace(core=SimpleNamespace(cpu=SimpleNamespace(state_hash=lambda n:"synthetic-state"))))
            class Guard:
                device_identity={"ordinal":0,"uuid":"synthetic-identity"}
                def __init__(self,*args,**kwargs):pass
                def __call__(self):resources.append(True)
            def observation_factory(ctx,calls,started,finished):
                if capability==auth.CAPABILITY:return None
                obs=qualifier.QualificationObservation.__new__(qualifier.QualificationObservation)
                # Constructor still validates the full real private fixture; only repeated writes are stubbed.
                context.reader.path(plan["outputRoot"]).mkdir(parents=True,exist_ok=True)
                qualifier.QualificationObservation.__init__(obs,ctx,calls,started,finished)
                def publish():
                    snapshots[:]=[obs.snapshot()]
                    if fail and obs.status=="failed_closed":raise OSError("synthetic secondary timing failure")
                obs.publish=publish
                return obs
            with ExitStack() as scope:
                replacements=((worker,"authenticate_live",lambda *a,**kw:bound),
                    (worker,"runtime_for_plan",lambda p:(fake_torch,profile,shared)),
                    (worker,"write",lambda root,path,value,**kw:outputs.setdefault(path,value)),
                    (worker,"load_samples",lambda *a:([{"sampleId":"synthetic-"+str(i)} for i in range(48)],ORDER)),
                    (worker.auth,"read_json",lambda reader,b:json.loads((ROOT/auth.FINAL_RGB_POLICY["path"]).read_bytes())
                        if b==auth.FINAL_RGB_POLICY else {"initialState":{"generator":"synthetic-state","discriminator":"synthetic-state"}}),
                    (worker,"ResourceGuard",Guard),(qualifier,"observation_for_context",observation_factory))
                for owner,name,value in replacements:scope.enter_context(patch.object(owner,name,value))
                if fail:
                    with self.assertRaises(RuntimeError) as caught:qualifier.run(context.package_binding,root=context.reader.root)
                    self.assertIs(caught.exception,primary)
                else:qualifier.run(context.package_binding,root=context.reader.root)
            gate=outputs[plan["outputRoot"]+("/gpu-failure.json" if fail else "/gpu-gate.json")]
            multiplier=1 if fail else 48
            self.assertEqual(gate["actualCounts"],{k+s:n*multiplier for k,n in (("forward",1),("generator",5),("discriminator",1)) for s in ("Attempted","Completed")})
            self.assertEqual(len(resources),16 if fail else 769);self.assertEqual(gate["optimizerSteps"],0)
            if not fail:self.assertEqual(gate["deviceIdentity"],Guard.device_identity)
            else:self.assertEqual(gate["originalError"]["message"],str(primary))
            self.assertFalse(any(name.endswith("/gpu-qualification-timing.json") for name in outputs))
            if capability==codec.CAPABILITY:
                self.assertEqual(snapshots[0]["completedSamples"],0 if fail else 48)
                if fail:self.assertEqual(gate["qualificationObservationError"]["message"],"synthetic secondary timing failure")
            elif fail:self.assertNotIn("qualificationObservationError",gate)


class PrivateNumericalTests(unittest.TestCase):
    """Private synthetic gradients only; excluded from production CPU preparation."""
    def test_five_real_CPU_gradients_delegate_to_frozen_bridge(self):
        model,critic=profile.fresh_networks(ORDER);critic.eval().requires_grad_(False)
        energy=sum(p.square().mean() for p in model.parameters())
        s,w,c,u=energy*.001,energy*-.004,energy*.001,energy*.001
        sample={"split":"train","image":torch.zeros(3,192,256),"conditions":torch.zeros(23,192,256)}
        events=[]
        with device.observe_generator_gradients(lambda stage,label,rows:events.append((stage,label,rows))):
            values,facts=device.compute_generator_candidate_gradients(model=model,critic=critic,sample=sample,
                actual_total=((s+w)+c)+u,structured_objective=s,whole_frame_fidelity=w,object_core_rgb=c,object_support_structure=u)
        self.assertEqual(facts["candidateId"],codec.CAPABILITY)
        self.assertEqual(facts["modelCapabilityVersion"],model_identity.CAPABILITY)
        self.assertEqual([e[1] for e in events if e[0]=="complete"],list(device.COMPONENTS_IN_ORDER))
        self.assertEqual(len(values),108);self.assertTrue(all(p.grad is None for p in model.parameters()))
        self.assertFalse(torch.cuda.is_initialized())

    def scalar_context(self,model,critic):
        parameters,_,season,ecology=device.bind_parameters(model)
        sample={"sampleId":"synthetic-train","split":"train","image":torch.zeros(3,192,256),
            "conditions":torch.zeros(23,192,256),"objectInstanceTable":[],
            "appearance_regime":torch.tensor([1.,0.,0.,0.]),"ecology_regime":torch.tensor([1.,0.,0.,0.,0.,0.,0.])}
        def forward():
            return sum(((p[:,0]+1).square().sum() if i in (season,ecology) else (p+1).square().sum()) for i,p in enumerate(parameters))
        def objective(critic,predicted,*args):
            s,w,c,u=(predicted*v for v in (1.,.5,.25,.125))
            return ((s+w)+c)+u,{"v21UnchangedTotal":s,"wholeFrameFidelity":w,"objectCoreRgbWeighted":c,"objectSupportStructureWeighted":u}
        stack=ExitStack()
        stack.enter_context(patch.object(profile,"validate_sample_ecology"))
        stack.enter_context(patch.object(model,"forward",side_effect=forward))
        stack.enter_context(patch.object(profile,"sample_forward",side_effect=lambda *a,**kw:(model(),{"objectCount":0}) if kw.get("return_evidence") else model()))
        stack.enter_context(patch.object(old_profile,"_d_objective",side_effect=lambda *a:(sum(p.sum() for p in critic.parameters())*.001,{})))
        stack.enter_context(patch.object(profile,"train_object_support_structure_candidate_objective",side_effect=objective))
        return stack,sample

    def test_explicit_new_probe_runs_one_forward_five_G_one_D_without_updates(self):
        model,critic=profile.fresh_networks(ORDER);before=(state(model),state(critic))
        context,sample=self.scalar_context(model,critic)
        with context,patch.object(torch.autograd,"grad",wraps=torch.autograd.grad) as calls:
            result=profile.zero_update_probe(model,critic,sample,ORDER,lambda:None)
        self.assertEqual(calls.call_count,6)
        self.assertEqual(result["capabilityVersion"],codec.CAPABILITY)
        self.assertEqual(result["callCounts"],{"generatorForwards":1,"generatorForwardCompleted":1,"generatorAutograd":5,"discriminatorAutograd":1})
        self.assertEqual(before,(state(model),state(critic)))

    def test_new_observer_keeps_five_sets_when_G_commit_fails_and_preview_time_is_preserved(self):
        model,critic=profile.fresh_networks(ORDER);before=(state(model),state(critic))
        context,sample=self.scalar_context(model,critic)
        class Optimizer:
            def zero_grad(self,**kwargs):pass
        counts={"generator":0,"discriminator":0};ledger={"sampleId":sample["sampleId"],"generator":0,"discriminator":0}
        seen=[]
        class Preview:
            def observe(self,predicted,bound,actual):seen.append(actual)
        def d_commit(optimizer,loss,network,bound,kind,actual,limit,resource):actual[kind]+=1
        primary=RuntimeError("synthetic G commit failed after fifth VJP")
        pair=worker.training_pair_runner(profile,model,Preview())
        with context,patch.object(old_profile,"_update_discriminator",side_effect=d_commit),patch.object(old_profile,"commit_generator_step",side_effect=primary):
            with self.assertRaises(RuntimeError) as caught:
                pair(model,critic,sample,ORDER,Optimizer(),Optimizer(),counts,ledger,lambda:None,None)
        self.assertIs(caught.exception,primary)
        self.assertEqual(primary.object_support_gradient_evidence["gradientSetsAvailable"],5)
        self.assertEqual(seen,[{"generator":0,"discriminator":1}])
        self.assertEqual(counts,{"generator":0,"discriminator":1})
        self.assertEqual(before,(state(model),state(critic)))


if __name__=="__main__":
    began=time.monotonic()
    import psutil
    p=psutil.Process();p.cpu_affinity(p.cpu_affinity()[:2])
    if torch.get_num_interop_threads()!=2:torch.set_num_interop_threads(2)
    with patch.object(torch.cuda,"_lazy_init",side_effect=AssertionError("private CPU tests cannot initialize CUDA")):
        result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__]))
    print(json.dumps({"testsRun":result.testsRun,"passed":result.wasSuccessful(),"syntheticOnly":True,
        "productionCpuPreparationStarted":False,"gpuInitialized":torch.cuda.is_initialized(),"seconds":time.monotonic()-began}))
    raise SystemExit(0 if result.wasSuccessful() else 1)
