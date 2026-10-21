"""Independent CPU adapter regressions; no real data, CUDA or training execution."""
import argparse
from contextlib import ExitStack
from copy import deepcopy
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import time
from types import SimpleNamespace
import unittest
import uuid
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[3]
sys.dont_write_bytecode = True
os.environ["CUDA_VISIBLE_DEVICES"] = ""
os.environ["OMP_NUM_THREADS"] = os.environ["MKL_NUM_THREADS"] = "2"
sys.path[:0] = [str(ROOT / "ml/ai-painter/src"), str(ROOT / "ml/ai-painter/scripts")]
import torch
torch.set_num_threads(2)
import decode1_entry_weight_quality_auth_v1 as auth
import painter_stage4_decode1_entry_weight_training_profile_v1 as profile
import painter_stage4_decode1_entry_weight_quality_worker_v1 as worker
import painter_stage4_decode1_entry_weight_lifecycle_v1 as lifecycle
import qualify_stage4_decode1_entry_weight_quality_gpu_v1 as qualifier
import decode1_entry_weight_quality_review_v1 as review
import ecology_quality_ranking_v1 as ranking
from ai_painter.complete_world import decode1_entry_weight_quality_checkpoint_v1 as codec
from ai_painter.complete_world import object_ecology_decode1_entry_weight_precision_v1 as identity
from ai_painter.complete_world import object_ecology_final_rgb_base_weight_precision_v1 as parent
from ai_painter.complete_world import object_decode1_entry_joint_priority_device_v1 as bridge
from ai_painter.complete_world import object_joint_rgb_structure_priority_update_cpu_v1 as frozen
from ai_painter.complete_world.stage4_semantic_transport_v2 import FORMAL_CONDITION_CHANNEL_ORDER as ORDER

RUN = "decode1-entry-quality-v1-synthetic"
OUTPUT = auth.ROOT_PREFIX + RUN
PACKAGE = {"path":".runtime/ai-painter/autonomous-closed-loop-packages/decode1-entry-quality-v1-package-synthetic/package.json","sha256":"b"*64}
PLAN = {"path":OUTPUT+"/quality-plan.json","sha256":"c"*64}
DATA = {"path":"synthetic/dataset.json","sha256":"d"*64}
PROGRAMS = {"own":{"path":"synthetic/own.py","sha256":"e"*64}}

def config():
    return codec.expected_configuration({"path":codec.PREVIEW_PATH,"sha256":"a"*64})

def rows(epoch=24):
    return [{"sampleId":"validation-"+str(i),"split":"validation","epoch":epoch,"fullRgbMae":.2,
        "objectCorrelations":{key:.1 for key in ("object_footprints","object_tree","object_rock","object_vegetation")}}
        for i in range(8)]

def rank(epoch=24):
    value=rows(epoch)
    return ranking.rank_validation_epoch(value,[r["sampleId"] for r in value],epoch=epoch,eligible_epochs=(epoch,))

def metadata_args():
    return dict(configuration=config(),run_id=RUN,package_binding=PACKAGE,dataset_binding=DATA,epoch=24,
        selection=rank(),counts={"generator":1152,"discriminator":1152},program_bindings=PROGRAMS,plan_binding=PLAN)

def state(network):
    return {n:hashlib.sha256(v.detach().cpu().contiguous().reshape(-1).view(torch.uint8).numpy().tobytes()).hexdigest()
        for n,v in network.state_dict().items()}

class AdmissionTests(unittest.TestCase):
    """Metadata/control cases are safe inside the real no-compute CPU harness."""
    def test_registered_corrected_source_selects_policy_binding_not_legacy(self):
        routes = [r for r in codec.registered_training_interfaces() if r["policy_value"]["sourceCandidate"] != auth.CANDIDATE]
        self.assertTrue(routes)
        for route in routes:
            self.assertEqual(auth.candidate_binding(route["capability"]), route["policy_value"]["sourceCandidate"])
            self.assertEqual(codec.expected_configuration({"path":route["preview_path"],"sha256":"a"*64},
                route["capability"])["sourceAssetsCandidate"], route["policy_value"]["sourceCandidate"])

    def test_corrected_diagnostic_cannot_fall_back_to_old_snapshot(self):
        bound={"path":".runtime/private-corrected/metadata.json","sha256":"a"*64}
        reader=SimpleNamespace(read=lambda *_:json.dumps({"frozenBindings":{"trainingDiagnostic":bound}}).encode())
        with patch.object(auth,"read_json",return_value={"frozenBindings":{"trainingDiagnostic":bound}}):
            self.assertEqual(auth.training_diagnostic(reader),bound)

    def test_corrected_sample_rejects_old_contribution_before_pixel_read(self):
        source={"path":"private.png","sha256":"a"*64};condition={"path":"conditions.json","sha256":"b"*64}
        row={"sampleId":"new-train","split":"train","image":source,"conditionPack":condition,"contribution":{}}
        identity={k:row[k] for k in ("sampleId","split","image","conditionPack")}
        with self.assertRaisesRegex(ValueError,"corrected source identity"):
            auth.load_corrected_sample(None,row,[],[],identity,None)

    def test_corrected_sample_rejects_wrong_rgb_before_pixel_read(self):
        row={"sampleId":"new-train","split":"train","image":{"path":"new.png","sha256":"a"*64},"conditionPack":{}}
        identity={**row,"image":{"path":"old.png","sha256":"b"*64}}
        with self.assertRaisesRegex(ValueError,"corrected source identity"):
            auth.load_corrected_sample(None,row,[],[],identity,None)

    def test_corrected_metadata_rejects_altered_split_or_channel_order(self):
        source={"samples":[{"sampleId":f"{split}-{i}","split":split}
            for split,count in auth.CORRECTED_SOURCE_COUNTS.items() for i in range(count)]}
        store={"manifest":{"schemaVersion":"ai-painter-stage4-source-correction-release-v1","sampleCount":64,
            "splitCounts":auth.CORRECTED_SOURCE_COUNTS,"identityPayload":{"channelOrder":["c0","c1"],"continuousChannelIds":["c0"]},
            "sourceIndex":{"path":"index"},"splits":{split:{"path":split} for split in auth.CORRECTED_SOURCE_COUNTS}},
            "condition":{"tensorContract":{"channelOrder":["c0","c1"],"typePartitions":{"continuous":["c0"]}}},"index":source}
        store.update({split:{"sampleIds":[row["sampleId"] for row in source["samples"] if row["split"]==split]}
            for split in auth.CORRECTED_SOURCE_COUNTS})
        reader=SimpleNamespace(json=lambda b:store[b["path"]]);plan={"datasetManifest":{"path":"manifest"},
            "trainSplit":{"path":"train"},"validationSplit":{"path":"validation"}}
        self.assertEqual(auth.select_rows(reader,plan,{"path":"condition"})[1],["c0","c1"])
        store["validation"]["sampleIds"][0]="train-0"
        with self.assertRaisesRegex(ValueError,"split partition"):
            auth.select_rows(reader,plan,{"path":"condition"})
        store["manifest"]["identityPayload"]["channelOrder"].reverse()
        with self.assertRaisesRegex(ValueError,"channels differ"):
            auth.select_rows(reader,plan,{"path":"condition"})

    def observation_scope(self,capability,*,change=None):
        route=auth.execution_route(capability);values=codec.execution_values(capability)
        run=values["run_prefix"]+"private-observation"
        owned=route.root_prefix+run+"/cpu-entry";base=route.root_prefix+run+"/cpu-negative-inputs"
        binding={"path":route.root_prefix+run+"/cpu-request.json","sha256":"a"*64}
        request={"schema":"object-support-structure-quality-cpu-request-v1","capabilityVersion":capability,
            "configuration":{"capabilityVersion":capability},"outputRoot":owned,"runId":run,
            "packageId":values["package_prefix"]+"private-observation","formalSpecification":route.specification,"programBindings":PROGRAMS}
        declaration={"schema":"cpu-negative-input-declaration-v1","request":binding,"layout":_negative_observation_layout(base),
            "formalMapping":{"privateMetadataFixture":True},"linkMetadataReserveBytes":49152,"reserveIsMeasurement":False,
            "runId":run,"packageId":request["packageId"],"programBindings":PROGRAMS}
        if change=="unregistered-root":owned=owned.replace("decode1-entry-weight-quality", "unregistered-decode1-entry-weight-quality",1)
        elif change=="root-prefix-collision":owned=owned.replace("-executions/","-executions-other/",1)
        elif change=="wrong-entry-suffix":owned+="-other"
        elif change=="cross-run-base":base=base.replace(run,run+"-other",1)
        elif change=="wrong-declaration-schema":declaration["schema"]="old-declaration"
        elif change=="cross-run-request":binding={**binding,"path":binding["path"].replace(run,run+"-other",1)}
        stop=RuntimeError("private metadata verified; stop before physical fixture IO")
        current=sys.modules[__name__];reader=SimpleNamespace(root=ROOT)
        with ExitStack() as scope:
            scope.enter_context(patch.dict(os.environ,{"TD_TRAIN_ENTRY_CPU_OUTPUT_ROOT":owned}))
            scope.enter_context(patch.object(sys,"argv",[__file__,"--cpu-request",binding["path"],"--sha256",binding["sha256"]]))
            scope.enter_context(patch.object(auth,"Reader",return_value=reader))
            scope.enter_context(patch.object(current,"_read_negative_observation_json",return_value=(declaration,PLAN)))
            scope.enter_context(patch.object(current,"_negative_formal_mapping",return_value=declaration["formalMapping"]))
            scope.enter_context(patch.object(auth,"read_json",return_value=request))
            verified=scope.enter_context(patch.object(auth,"verify_programs"))
            physical=scope.enter_context(patch.object(current,"_current_negative_link",side_effect=stop))
            if change is None:
                with self.assertRaises(RuntimeError) as caught:_observe_negative_link("input",base,{})
                self.assertIs(caught.exception,stop)
                verified.assert_called_once_with(reader,PROGRAMS,capability_version=capability)
                physical.assert_called_once()
            else:
                expected="exact owned request path" if change=="cross-run-request" else "exact owned CPU observation declaration"
                with self.assertRaisesRegex(ValueError,expected):_observe_negative_link("input",base,{})
                physical.assert_not_called();verified.assert_not_called()

    def test_owned_observation_accepts_all_registered_route_metadata(self):
        for capability in (auth.CAPABILITY,codec.COMPLETION_CAPABILITY,codec.COMPLETION_V2_CAPABILITY,
                codec.SAME_CALL_CAPABILITY):
            with self.subTest(capability=capability):self.observation_scope(capability)

    def test_owned_observation_rejects_foreign_roots_cross_run_and_wrong_declaration(self):
        for capability in (auth.CAPABILITY,codec.COMPLETION_CAPABILITY,codec.COMPLETION_V2_CAPABILITY,
                codec.SAME_CALL_CAPABILITY):
            for change in ("unregistered-root","root-prefix-collision","wrong-entry-suffix","cross-run-base","wrong-declaration-schema","cross-run-request"):
                with self.subTest(capability=capability,change=change):self.observation_scope(capability,change=change)

    def identity_scope(self,capability,*,change=None):
        route=auth.execution_route(capability);values=codec.execution_values(capability)
        run=values["run_prefix"]+"private-identity"
        owned=route.root_prefix+run+"/cpu-entry";base=route.root_prefix+run+"/cpu-negative-inputs"
        if change=="unregistered-root":owned=owned.replace("decode1-entry-weight-quality","unregistered-decode1-entry-weight-quality",1)
        elif change=="root-prefix-collision":owned=owned.replace("-executions/","-executions-other/",1)
        elif change=="wrong-entry-suffix":owned+="-other"
        elif change=="cross-run-base":base=base.replace(run,run+"-other",1)
        stop=RuntimeError("private identity scope verified; stop before mapping or physical identity IO")
        with patch.dict(os.environ,{"TD_TRAIN_ENTRY_CPU_OUTPUT_ROOT":owned}):
            mapping=SimpleNamespace(check=unittest.mock.Mock(side_effect=stop))
            reader=SimpleNamespace(mapping=mapping)
            if change is None:
                with self.assertRaises(RuntimeError) as caught:_fixture_dual_identity(reader,base,ROOT)
                self.assertIs(caught.exception,stop);mapping.check.assert_called_once_with()
            else:
                with self.assertRaisesRegex(ValueError,"exact owned identity scope required"):
                    _fixture_dual_identity(reader,base,ROOT)
                mapping.check.assert_not_called()

    def test_owned_identity_accepts_all_registered_route_scopes_before_io(self):
        for capability in (auth.CAPABILITY,codec.COMPLETION_CAPABILITY,codec.COMPLETION_V2_CAPABILITY,
                codec.SAME_CALL_CAPABILITY):
            with self.subTest(capability=capability):self.identity_scope(capability)

    def test_owned_identity_rejects_foreign_roots_cross_run_and_wrong_suffix_before_io(self):
        for capability in (auth.CAPABILITY,codec.COMPLETION_CAPABILITY,codec.COMPLETION_V2_CAPABILITY,
                codec.SAME_CALL_CAPABILITY):
            for change in ("unregistered-root","root-prefix-collision","wrong-entry-suffix","cross-run-base"):
                with self.subTest(capability=capability,change=change):self.identity_scope(capability,change=change)

    def test_only_new_training_route(self):
        self.assertEqual(auth.execution_route().capability,profile.CAPABILITY)
        self.assertEqual(auth.execution_route().model_capability,identity.CAPABILITY)
        self.assertEqual(auth.execution_route().root_prefix,auth.ROOT_PREFIX)

    def test_old_joint_route_is_rejected(self):
        with self.assertRaises(ValueError): auth.execution_route("stage4_mvp256_dry_joint_object_priority_quality24_v1")

    def test_qualification_route_is_not_training(self):
        with self.assertRaises(ValueError): auth.execution_route(bridge.CAPABILITY)
        self.assertNotEqual(profile.CAPABILITY,bridge.CAPABILITY)
        self.assertEqual(bridge.UPDATE_RULE_ID,frozen.CANDIDATE_ID)

    def test_new_components_are_explicit(self):
        self.assertIs(auth.profile_components(),profile)
        self.assertIs(auth.checkpoint_components(),codec)
        self.assertIs(lifecycle._model_validator(),identity.validate_model_identity)

    def test_fake_component_is_rejected(self):
        with self.assertRaises(ValueError): profile._component_profile(SimpleNamespace(CAPABILITY=profile.CAPABILITY))

    def test_exact_profile_is_accepted(self):
        self.assertIs(profile._component_profile(None),profile)
        self.assertIs(profile._component_profile(profile),profile)

    def test_source256_and257_boundary(self):
        auth.validate_program_count({str(i):None for i in range(256)})
        with self.assertRaises(ValueError): auth.validate_program_count({str(i):None for i in range(257)})

    def test_no_joint260_exception(self):
        with self.assertRaises(ValueError): auth.validate_program_count({str(i):None for i in range(260)})
        self.assertEqual(auth.PROGRAM_MAX,1048576)

    def test_configuration_keeps_fixed_budget(self):
        value=config()
        self.assertEqual(value["gpuAdmissionSeconds"],720)
        self.assertEqual(value["executionCeiling"]["maxWallSeconds"],8400)
        self.assertEqual(value["executionCeiling"]["epochs"],24)
        self.assertEqual(value["checkpointSelection"]["eligibleEpochs"],[24])
        self.assertEqual(value["checkpointSelection"]["observationOnlyEpochs"],[12])

    def test_old_preview_policy_rejected(self):
        with self.assertRaises(ValueError):
            codec.expected_configuration({"path":codec.PREVIEW_PATH.replace("v6","v5"),"sha256":"a"*64})

    def test_no_validation_weight_updates(self):
        value=config()
        self.assertEqual(value["dataUse"]["weightUpdatesFrom"],["train"])
        self.assertEqual(value["dataUse"]["checkpointSelectionFrom"],["validation"])
        self.assertFalse(value["dataUse"]["challengeAndRegressionContentRead"])

    def test_configuration_mutation_rejected(self):
        value=config(); value["gpuAdmissionSeconds"]=721
        with self.assertRaises(ValueError): codec.validate_configuration(value)

    def test_old_checkpoint_configuration_rejected(self):
        value=config();value["capabilityVersion"]="stage4_mvp256_dry_joint_object_priority_quality24_v1"
        with self.assertRaises(ValueError): codec.validate_configuration(value)

    def test_epoch12_is_observation_only(self):
        value=metadata_args();value.update(epoch=12,selection=rank(12),counts={"generator":576,"discriminator":576})
        with self.assertRaises(ValueError): codec._metadata(**value)

    def test_partial_update_counts_rejected(self):
        value=metadata_args();value["counts"]["generator"]=1151
        with self.assertRaises(ValueError): codec._metadata(**value)

    def test_boolean_optimizer_count_rejected(self):
        value=metadata_args();value["counts"]["generator"]=True
        with self.assertRaises(ValueError): codec._metadata(**value)

    def test_new_checkpoint_metadata_does_not_grant_qualification(self):
        value=codec._metadata(**metadata_args())
        self.assertEqual(value["schema"],"decode1-entry-weight-quality-checkpoint-v1")
        self.assertFalse(value["checkpointQualified"])
        self.assertFalse(value["automaticResumeAllowed"])
        self.assertEqual(value["modelCapabilityVersion"],identity.CAPABILITY)

    def test_cross_run_checkpoint_plan_rejected(self):
        value=metadata_args();value["plan_binding"]={**PLAN,"path":OUTPUT+"-other/quality-plan.json"}
        with self.assertRaises(ValueError): codec._metadata(**value)

    def test_old_package_checkpoint_rejected(self):
        value=metadata_args();value["package_binding"]={**PACKAGE,"path":"old/package.json"}
        with self.assertRaises(ValueError): codec._metadata(**value)

    def test_duplicate_source_paths_rejected(self):
        value=metadata_args();value["program_bindings"]={**PROGRAMS,"alias":PROGRAMS["own"]}
        with self.assertRaises(ValueError): codec._metadata(**value)

    def test_gpu_admission720_training8400(self):
        plan={"capabilityVersion":profile.CAPABILITY,"configuration":config()}
        self.assertEqual(worker.ResourceGuard(PACKAGE,plan,gpu_gate=True).seconds,720)
        self.assertEqual(worker.ResourceGuard(PACKAGE,plan).seconds,8400)

    def test_deadline_fails_before_cuda(self):
        plan={"capabilityVersion":profile.CAPABILITY,"configuration":config()}
        guard=worker.ResourceGuard(PACKAGE,plan,started=0)
        with patch.object(worker.time,"monotonic",return_value=8401), patch.object(torch.cuda,"synchronize",side_effect=AssertionError("CUDA called")):
            with self.assertRaisesRegex(ValueError,"deadline"): guard()

    def test_resource_floor_accepts2048_below85(self):
        worker.require_gpu_resource_poll(free_bytes=2048*1024**2,uuid="GPU-12345678-1234-1234-1234-123456789abc",temperature=84,sampled_at="2026-10-18T00:00:00Z")

    def test_resource_error_retains_both_trigger_values(self):
        with self.assertRaisesRegex(ValueError,"GPU resource guard") as caught:
            worker.require_gpu_resource_poll(free_bytes=2047*1024**2,uuid="GPU-12345678-1234-1234-1234-123456789abc",temperature=85,sampled_at="2026-10-18T00:00:00Z")
        value=json.loads(str(caught.exception).split(": ",1)[1])
        self.assertEqual(value["triggered"],["free_vram_below_minimum","temperature_at_or_above_maximum"])
        self.assertEqual(value["freeVramMiB"],2047)
        self.assertEqual(value["temperatureC"],85)
        self.assertLessEqual(len(str(caught.exception).encode()),2048)

    def test_malformed_gpu_identity_retains_identity_error(self):
        with self.assertRaisesRegex(ValueError,"UUID"):
            worker.require_gpu_resource_poll(free_bytes=0,uuid="unknown",temperature=100,sampled_at="now")

    def test_training_observer_retains_original_error_and_partial_gradients(self):
        error=ValueError("synthetic first failure")
        model=torch.nn.Linear(1,1)
        def failing():
            callback=bridge._OBSERVER.get()
            callback("complete",bridge.COMPONENTS_IN_ORDER[0],(None,None))
            raise error
        with self.assertRaises(ValueError) as caught:
            worker.observed_pair(failing,model,observation_profile=profile)
        self.assertIs(caught.exception,error)
        self.assertEqual(error.object_support_gradient_evidence["gradientSetsAvailable"],1)
        self.assertIsNone(bridge._OBSERVER.get())

    def test_spoofed_observation_profile_rejected(self):
        with self.assertRaises(ValueError):
            worker.observed_pair(lambda:None,None,observation_profile=SimpleNamespace(CAPABILITY=profile.CAPABILITY))

    def test_review_requires_complete_checkpoint_and_same_new_profile(self):
        record={"epoch":24,"checkpoint":{"path":OUTPUT+"/checkpoint-24.pt","sha256":"f"*64},
            "selection":rank(),"counts":{"generator":1152,"discriminator":1152}}
        terminal={"schema":worker.TERMINAL_SCHEMA,"status":"training_completed_review_pending","executionState":"completed",
            "executionProfile":auth.PROFILE,"capabilityVersion":auth.CAPABILITY,"completedEpochs":24,
            "optimizerSteps":{"generator":1152,"discriminator":1152},"optimizerStepsGenerator":1152,"optimizerStepsDiscriminator":1152,
            "checkpointReloadVerified":True,"executionPackage":PACKAGE,"runId":RUN,"packageId":"decode1-entry-quality-v1-package-synthetic",
            "checkpoints":[record],"selectedCheckpointRecord":record}
        terminal.update({key:False for key in ("challengeContentRead","regressionContentRead","checkpointPromotable",
            "formalStage4QualificationAllowed","runtimePublicationAllowed")})
        self.assertEqual(review.selected_record(terminal,configuration=config()),record)
        terminal["executionProfile"]="bounded_joint_object_priority_quality24_v1"
        with self.assertRaises(ValueError): review.selected_record(terminal,configuration=config())

    def test_qualifier_uses_own_worker_and_same_protocol(self):
        self.assertIs(qualifier.worker,worker)
        self.assertIs(review.own_worker(),worker)
        self.assertEqual(worker.GPU_SCHEMA,"object-support-structure-quality-all-train-gpu-gate-v1")
        self.assertEqual(worker.CPU_SCHEMA,"object-support-structure-quality-entry-cpu-report-v1")

    def test_no_weakened_scope_or_schema(self):
        value=config()
        self.assertEqual(value["schema"],"object-support-structure-quality-configuration-v1")
        self.assertEqual(value["scope"]["resolution"],[256,192])
        self.assertEqual(value["scope"]["worldCount"],1)
        self.assertFalse(value["scope"]["waterFactPresent"])
        self.assertEqual(value["seed"],20260929)

    def test_policy_mutation_is_rejected(self):
        # Source JSON only. No raster or historical state is read.
        policy=json.loads((ROOT/codec.POLICY["path"]).read_bytes())
        codec.validate_execution_policy(policy,config())
        policy["phaseResources"]["programFileCountMaximum"]=260
        with self.assertRaises(ValueError): codec.validate_execution_policy(policy,config())

class CheckpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.guards=ExitStack()
        for owner,name in ((torch.nn.Module,"_call_impl"),(torch.cuda,"_lazy_init"),(torch.optim.Optimizer,"__init__")):
            cls.guards.enter_context(patch.object(owner,name,side_effect=AssertionError("real compute prohibited")))
        cls.model,cls.critic=profile.fresh_networks(ORDER)

    @classmethod
    def tearDownClass(cls): cls.guards.close()

    def test_fresh_seed_rng_graph_and_identity(self):
        rng=torch.get_rng_state().clone()
        model,critic=profile.fresh_networks(ORDER)
        self.assertTrue(torch.equal(rng,torch.get_rng_state()))
        self.assertEqual(state(model),state(self.model))
        self.assertEqual(state(critic),state(self.critic))
        parameters=tuple(model.named_parameters())
        self.assertEqual((len(parameters),sum(p.numel() for _,p in parameters)),(108,2242687))
        self.assertEqual(parameters[48][0],"core.core.terrain.decode_1.layers.0.weight")
        self.assertEqual(tuple(parameters[48][1].shape),(48,144,3,3))
        self.assertIs(type(model),identity.Decode1EntryWeightPrecisionEcologyRenderer)

    def test_cpu_carrier_preserves_real_parent_class_and_bytes(self):
        carrier=bridge._cpu_carrier(self.model)
        self.assertEqual(carrier.capability_version,parent.CAPABILITY)
        self.assertNotEqual(type(carrier),type(self.model))
        self.assertFalse(carrier.execution_qualified)
        bridge._verify_carrier(self.model,carrier)
        with torch.no_grad(): next(carrier.parameters()).flatten()[0].add_(1)
        with self.assertRaises(ValueError): bridge._verify_carrier(self.model,carrier)

    def test_complete_new_checkpoint_roundtrip_keeps_storage(self):
        raw=codec.encode(self.model,self.critic,**metadata_args())
        params=tuple((p,p.untyped_storage().data_ptr()) for net in (self.model,self.critic) for p in net.parameters())
        before=(state(self.model),state(self.critic))
        result=codec.reload(raw,model=self.model,critic=self.critic,**metadata_args())
        self.assertTrue(result["modelStateLoaded"])
        self.assertFalse(result["checkpointQualified"])
        self.assertEqual(before,(state(self.model),state(self.critic)))
        self.assertTrue(all(p.untyped_storage().data_ptr()==ptr for p,ptr in params))

    def test_completion_checkpoint_uses_own_identity_and_cannot_reload_as_legacy(self):
        for capability in (codec.COMPLETION_CAPABILITY,codec.COMPLETION_V2_CAPABILITY):
            arguments=metadata_args();values=codec.execution_values(capability);run=values["run_prefix"]+"private"
            output=values["root_prefix"]+run
            configuration=(CompletionV2AdmissionTests() if capability==codec.COMPLETION_V2_CAPABILITY else CompletionAdmissionTests()).configuration()[0]
            package={"path":".runtime/ai-painter/autonomous-closed-loop-packages/"+values["package_prefix"]+"private/package.json","sha256":"b"*64}
            arguments.update(configuration=configuration,run_id=run,package_binding=package,
                plan_binding={"path":output+"/quality-plan.json","sha256":"c"*64})
            raw=codec.encode(self.model,self.critic,**arguments)
            result=codec.reload(raw,model=self.model,critic=self.critic,**arguments)
            self.assertEqual(result["capabilityVersion"],capability)
            self.assertFalse(result["checkpointQualified"])
            with self.assertRaises(ValueError):codec.reload(raw,model=self.model,critic=self.critic,**metadata_args())

    def test_old_schema_and_partial_tensor_archive_rejected(self):
        raw=codec.encode(self.model,self.critic,**metadata_args())
        for mutation in ("schema","tensor"):
            payload=torch.load(io.BytesIO(raw),weights_only=True)
            if mutation=="schema": payload["schema"]="joint-object-priority-quality-checkpoint-v1"
            else: payload["generator"].pop(next(iter(payload["generator"])))
            stream=io.BytesIO();torch.save(payload,stream)
            before=(state(self.model),state(self.critic))
            with self.assertRaises(ValueError): codec.reload(stream.getvalue(),model=self.model,critic=self.critic,**metadata_args())
            self.assertEqual(before,(state(self.model),state(self.critic)))

    def test_failed_critic_install_rolls_back_generator_and_storage(self):
        source,source_critic=profile.fresh_networks(ORDER)
        with torch.no_grad(): next(source.parameters()).flatten()[0].add_(.25)
        raw=codec.encode(source,source_critic,**metadata_args())
        before=(state(self.model),state(self.critic))
        identities=tuple((v,v.untyped_storage().data_ptr()) for net in (self.model,self.critic)
            for v in (*net.parameters(),*net.buffers()))
        error=RuntimeError("synthetic critic install failure")
        def fail(*args): raise error
        handle=self.critic.register_load_state_dict_pre_hook(fail)
        try:
            with self.assertRaises(RuntimeError) as caught:
                codec.reload(raw,model=self.model,critic=self.critic,**metadata_args())
            self.assertIs(caught.exception,error)
            self.assertEqual(before,(state(self.model),state(self.critic)))
            self.assertTrue(all(v.untyped_storage().data_ptr()==ptr for v,ptr in identities))
        finally: handle.remove()

class SyntheticGradientTests(unittest.TestCase):
    def test_five_scalar_vjps_use_frozen_carrier_no_forward_or_optimizer(self):
        with ExitStack() as guards:
            for owner,name in ((torch.nn.Module,"_call_impl"),(torch.cuda,"_lazy_init"),(torch.optim.Optimizer,"__init__")):
                guards.enter_context(patch.object(owner,name,side_effect=AssertionError("real compute prohibited")))
            model,critic=profile.fresh_networks(ORDER)
            for parameter in critic.parameters(): parameter.requires_grad_(False)
            critic.eval()
            parameters,groups,season,ecology=bridge.bind_parameters(model)
            base=sum(p.sum() for p in parameters)
            # Opposed priority/other terms exercise the real frozen projection.
            structured=base*.5;whole=base*.25;core=-base*2;support=base*.125
            total=((structured+whole).float()+core).float()+support
            observed=[]
            sample={"split":"train","image":torch.zeros(3,192,256),"conditions":torch.zeros(23,192,256)}
            with bridge.observe_generator_gradients(lambda stage,label,values:observed.append((label,values)) if stage=="complete" else None):
                result,facts=bridge.compute_generator_candidate_gradients(model=model,critic=critic,sample=sample,
                    actual_total=total,structured_objective=structured,whole_frame_fidelity=whole,
                    object_core_rgb=core,object_support_structure=support)
            self.assertEqual([name for name,_ in observed],list(bridge.COMPONENTS_IN_ORDER))
            self.assertEqual([len(values) for _,values in observed],[108]*5)
            self.assertEqual(facts["candidateId"],bridge.CAPABILITY)
            self.assertEqual(facts["modelCapabilityVersion"],identity.CAPABILITY)
            owned={i for indexes in groups.values() for i in indexes}
            self.assertTrue(all(result[i] is observed[0][1][i] for i in range(108) if i not in owned))
            self.assertTrue(all(p.grad is None for p in model.parameters()))
            self.assertEqual(facts["arithmeticCarrierCapabilityVersion"],parent.CAPABILITY)
            self.assertTrue(all(value["branch"]=="conflict_projected" for value in facts["headDiagnostics"].values()))

def component_suite():
    return unittest.TestSuite(unittest.defaultTestLoader.loadTestsFromTestCase(test)
        for test in (AdmissionTests,CompletionAdmissionTests,CompletionV2AdmissionTests,SameCallAdmissionTests,RegisteredInterfaceAdmissionTests,SameCallRouteTests,CheckpointTests,SyntheticGradientTests,LifecycleTests,HarnessProtocolTests,GateAndAuthorityTests))

class _CpuResult(unittest.TextTestResult):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,**kwargs);self.passed_items=[]
    def addSuccess(self,test):
        super().addSuccess(test);self.passed_items.append({"test":test.id(),"status":"passed"})

import ctypes
from ctypes import wintypes
from datetime import datetime, timezone
import subprocess
from ai_painter.complete_world import object_support_structure_failure_capture_v1 as capture

_TEST_JUNCTION_REMOVE = os.rmdir
_TEST_JUNCTION_READLINK = os.readlink
_CPU_OBSERVATION_CLOCK = time.monotonic
_CPU_OBSERVATION_PAUSE = time.sleep
class _FixtureWindowsMetadata:
    """Read-only identity queries on one no-follow metadata handle, fixtures only."""
    class FullIdentity(ctypes.Structure):
        _fields_ = [("volume", ctypes.c_uint64), ("file", ctypes.c_ubyte * 16)]

    class LegacyIdentity(ctypes.Structure):
        _fields_ = [("attributes", wintypes.DWORD), ("creation", wintypes.FILETIME),
            ("access", wintypes.FILETIME), ("write", wintypes.FILETIME), ("volume", wintypes.DWORD),
            ("sizeHigh", wintypes.DWORD), ("sizeLow", wintypes.DWORD), ("links", wintypes.DWORD),
            ("indexHigh", wintypes.DWORD), ("indexLow", wintypes.DWORD)]

    class AttributeTag(ctypes.Structure):
        _fields_ = [("attributes", wintypes.DWORD), ("tag", wintypes.DWORD)]

    def __init__(self):
        self.kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        self.kernel.CreateFileW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
            ctypes.c_void_p, wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
        self.kernel.CreateFileW.restype = wintypes.HANDLE
        self.kernel.GetFileInformationByHandle.argtypes = [wintypes.HANDLE, ctypes.POINTER(self.LegacyIdentity)]
        self.kernel.GetFileInformationByHandle.restype = wintypes.BOOL
        self.kernel.GetFileInformationByHandleEx.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
        self.kernel.GetFileInformationByHandleEx.restype = wintypes.BOOL
        self.kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        self.kernel.CloseHandle.restype = wintypes.BOOL

    def open(self, path):
        # FILE_READ_ATTRIBUTES, SHARE_READ|WRITE|DELETE, OPEN_EXISTING;
        # BACKUP_SEMANTICS|OPEN_REPARSE_POINT inspects a junction itself.
        handle = self.kernel.CreateFileW(str(path), 0x80, 7, None, 3, 0x02200000, None)
        if handle == ctypes.c_void_p(-1).value:
            raise ctypes.WinError(ctypes.get_last_error())
        return handle

    def read(self, handle):
        full, legacy, tag = self.FullIdentity(), self.LegacyIdentity(), self.AttributeTag()
        for kind, value in ((18, full), (9, tag)):
            if not self.kernel.GetFileInformationByHandleEx(handle, kind, ctypes.byref(value), ctypes.sizeof(value)):
                raise ctypes.WinError(ctypes.get_last_error())
        if not self.kernel.GetFileInformationByHandle(handle, ctypes.byref(legacy)):
            raise ctypes.WinError(ctypes.get_last_error())
        auth.require(legacy.attributes == tag.attributes, "fixture handle attributes differ")
        return {"python": (int(full.volume), int.from_bytes(bytes(full.file), "little")),
            "node": (int(legacy.volume), (int(legacy.indexHigh) << 32) | int(legacy.indexLow)),
            "attributes": int(tag.attributes), "tag": int(tag.tag)}

    def close(self, handle):
        if not self.kernel.CloseHandle(handle):
            raise ctypes.WinError(ctypes.get_last_error())


_FIXTURE_WINDOWS_API = _FixtureWindowsMetadata() if os.name == "nt" else None


def _owned_prefix_ok(owned):
    return type(owned) is str and any(owned.startswith(auth.execution_route(cap).root_prefix)
        for cap in (auth.CAPABILITY,codec.COMPLETION_CAPABILITY,codec.COMPLETION_V2_CAPABILITY,
            codec.SAME_CALL_CAPABILITY,*[row["capability"] for row in codec.registered_training_interfaces()]))


def _fixture_dual_identity(reader, base, path, expected=None):
    """Verify both complete identities from the same actual, scoped Windows object."""
    owned = os.environ.get("TD_TRAIN_ENTRY_CPU_OUTPUT_ROOT")
    auth.require(owned is not None, "current owned CPU identity required")
    auth.require(_owned_prefix_ok(owned) and owned.endswith("/cpu-entry") and
        base == owned.rsplit("/", 1)[0] + "/cpu-negative-inputs", "exact owned identity scope required")
    reader.mapping.check()
    runtime = reader.root / ".runtime"
    allowed = {reader.root, runtime, reader.mapping.physical_runtime, reader.path(base)}
    junctions = {runtime}
    for slot in _negative_observation_layout(base)["links"]:
        parent = reader.path(slot["path"].rsplit("/", 1)[0])
        link = parent / slot["path"].rsplit("/", 1)[1]
        allowed.update((parent, link, reader.path(slot["target"])))
        junctions.add(link)
    auth.require(type(path) is type(reader.root) and path.is_absolute() and path in allowed and
        _FIXTURE_WINDOWS_API is not None, "unsupported or out-of-scope fixture identity")
    before = path.lstat()
    identity = capture._file_identity(before)
    auth.require(expected is None or identity == expected, "fixture full Python capture differs")
    reparse = path in junctions
    auth.require(bool(getattr(before, "st_file_attributes", 0) & 0x400) == reparse and
        (getattr(before, "st_reparse_tag", 0) == 0xA0000003 if reparse else auth.stat.S_ISDIR(before.st_mode)),
        "fixture actual path kind differs")
    handle = _FIXTURE_WINDOWS_API.open(path)
    try:
        actual = _FIXTURE_WINDOWS_API.read(handle)
        auth.require(actual["python"] == (before.st_dev, before.st_ino) and
            actual["python"][0] > 0 and actual["python"][1] > 0 and actual["node"][0] > 0 and
            actual["node"][1] == actual["python"][1], "fixture full handle/path identity differs or unsupported")
        auth.require(bool(actual["attributes"] & 0x10) and bool(actual["attributes"] & 0x400) == reparse and
            actual["tag"] == (0xA0000003 if reparse else 0), "fixture handle reparse kind differs")
        auth.require(capture._file_identity(path.lstat()) == identity and
            _FIXTURE_WINDOWS_API.read(handle) == actual, "fixture path/handle changed during identity query")
        return {"pythonIdentity": str(actual["python"][0]) + ":" + str(actual["python"][1]),
            "nodeIdentity": str(actual["node"][0]) + ":" + str(actual["node"][1])}
    finally:
        _FIXTURE_WINDOWS_API.close(handle)


def _ordinary_test_directory_identity(path):
    info = path.lstat()
    auth.require(path.is_absolute() and auth.stat.S_ISDIR(info.st_mode) and
        not getattr(info, "st_file_attributes", 0) & 0x400, "fixture ordinary directory required")
    return info.st_dev, info.st_ino


def _test_junction_target_matches(link, target):
    actual = _TEST_JUNCTION_READLINK(link)
    if actual.startswith("\\\\?\\"):
        actual = actual[4:]
    return actual == str(target)  # Exact declared path, without following the link.


def _record_created_test_junction(link, target, private_root, result):
    """Capture only the successful creation's validated current file identity."""
    auth.require(result.returncode == 0, "fixture junction creation failed; unknown link retained")
    auth.require(link.is_absolute() and target.is_absolute() and link.parent.is_relative_to(private_root) and
        target.is_relative_to(private_root), "fixture junction outside private root")
    directories = {}
    for child in (link.parent, target):
        current = child
        while True:
            directories[current] = _ordinary_test_directory_identity(current)
            if current == private_root:
                break
            auth.require(current.is_relative_to(private_root), "fixture directory outside private root")
            current = current.parent
    info = link.lstat()
    auth.require(getattr(info, "st_file_attributes", 0) & 0x400 and
        getattr(info, "st_reparse_tag", 0) == 0xA0000003, "actual directory junction required")
    auth.require(_test_junction_target_matches(link, target), "fixture junction target differs")
    identity = capture._file_identity(info)
    auth.require(capture._file_identity(link.lstat()) == identity, "fixture junction changed during capture")
    return {"linkIdentity": identity, "directories": tuple(directories.items())}


def _remove_created_test_junction(link, target, private_root, record):
    if record is None:
        return False  # No successful validated creation: do not inspect or remove it.
    auth.require(link.is_absolute() and target.is_absolute() and link.parent.is_relative_to(private_root) and
        target.is_relative_to(private_root), "fixture cleanup outside private root")
    for directory, identity in record["directories"]:
        auth.require(_ordinary_test_directory_identity(directory) == identity, "fixture directory identity changed; retained")
    info = link.lstat()
    auth.require(capture._file_identity(info) == record["linkIdentity"], "fixture link identity changed; unknown link retained")
    auth.require(getattr(info, "st_file_attributes", 0) & 0x400 and
        getattr(info, "st_reparse_tag", 0) == 0xA0000003 and _test_junction_target_matches(link, target), "fixture cleanup redirect differs; retained")
    auth.require(capture._file_identity(link.lstat()) == record["linkIdentity"], "fixture link changed before cleanup; retained")
    _TEST_JUNCTION_REMOVE(link)  # Nonrecursive removal of this same validated link only.
    return True


def _negative_observation_layout(base):
    return {"root": base, "links": [
        {"name": "reader", "path": base + "/reader-link", "target": base + "/reader-target"},
        {"name": "snapshot", "path": base + "/snapshot-link", "target": base + "/snapshot-target"},
        {"name": "program", "path": base + "/program-project/scripts/lib", "target": base + "/program-target"}]}


def _read_negative_observation_json(reader, logical):
    path = reader.path(logical)
    before = path.lstat()
    auth.require(auth.stat.S_ISREG(before.st_mode) and not getattr(before, "st_file_attributes", 0) & 0x400 and
        0 <= before.st_size <= auth.CONTROL_JSON_MAX, "ordinary bounded CPU observation JSON required")
    with path.open("rb") as stream:
        raw = stream.read(before.st_size + 1)
    auth.require(len(raw) == before.st_size, "CPU observation bytes changed")
    binding = {"path": logical, "sha256": hashlib.sha256(raw).hexdigest()}
    auth.require(reader.mapping.binding(binding, maximum=before.st_size) == raw and
        capture._file_identity(reader.path(logical).lstat()) == capture._file_identity(before), "CPU observation file changed")
    value = auth.decode(raw)
    auth.require(type(value) is dict, "CPU observation object required")
    return value, binding


def _wait_negative_observation(reader, logical, deadline):
    while True:
        auth.require(_CPU_OBSERVATION_CLOCK() < deadline, "current parent CPU link observation deadline")
        try:
            reader.path(logical).lstat()  # Do not follow a receipt redirect to test existence.
        except FileNotFoundError:
            _CPU_OBSERVATION_PAUSE(.025)
            continue
        return _read_negative_observation_json(reader, logical)


def _validate_negative_observation(value, declaration, name, base, identity, created_seconds):
    """A synchronization record only; neither schema can mint native authority."""
    schemas = {"cpu-negative-input-declaration-v1": "cpu-negative-input-live-observation-v1"}
    auth.require(declaration.get("schema") in schemas and declaration.get("layout") == _negative_observation_layout(base),
        "current CPU observation declaration/layout differs")
    slots = [slot for slot in declaration["layout"]["links"] if slot["name"] == name]
    auth.require(len(slots) == 1 and type(value) is dict and set(value) ==
        {"schema", "callIdentity", "request", "link", "observedAtUtc"}, "exact CPU observation fields required")
    auth.require(value["schema"] == schemas[declaration["schema"]] and
        type(declaration.get("callIdentity")) is str and bool(declaration["callIdentity"]) and
        value["callIdentity"] == declaration["callIdentity"] and
        auth.exact_binding(value["request"]) == auth.exact_binding(declaration["request"]),
        "current retained parent call/request differs")
    link = value["link"]
    auth.require(type(link) is dict and set(link) == {"name", "path", "target", "observedIdentity", "present"} and
        all(link.get(k) == v for k, v in slots[0].items()) and link["present"] is True and
        link["observedIdentity"] == identity, "current retained parent link identity/path/target differs")
    stamp = datetime.fromisoformat(value["observedAtUtc"].replace("Z", "+00:00"))
    auth.require(stamp.tzinfo is not None and -5 <= (datetime.now(timezone.utc) - stamp).total_seconds() <= 10 and
        stamp.timestamp() >= created_seconds - .002, "current parent CPU observation stale/future")


def _current_negative_link(reader, name, base, record):
    auth.require(type(record) is dict and set(record) == {"linkIdentity", "directories"}, "successful current junction capture required")
    slot = next((v for v in _negative_observation_layout(base)["links"] if v["name"] == name), None)
    auth.require(slot is not None, "exact CPU observation slot required")
    private_root = reader.path(base).resolve()
    # Reader.path intentionally rejects the negative link; locate it from its ordinary parent.
    link = reader.path(slot["path"].rsplit("/", 1)[0]) / slot["path"].rsplit("/", 1)[1]
    target = reader.path(slot["target"])
    auth.require(link.is_absolute() and target.is_absolute() and link.parent.is_relative_to(private_root) and
        target.is_relative_to(private_root), "CPU observation outside private root")
    auth.require(type(record["linkIdentity"]) is tuple and len(record["linkIdentity"]) == 5 and
        type(record["directories"]) is tuple and {private_root, link.parent, target} <=
        {directory for directory, identity in record["directories"]}, "CPU observation captured directory identities required")
    for directory, expected in record["directories"]:
        auth.require(_ordinary_test_directory_identity(directory) == expected, "CPU observation directory identity changed")
    info = link.lstat()
    auth.require(capture._file_identity(info) == record["linkIdentity"] and
        getattr(info, "st_file_attributes", 0) & 0x400 and getattr(info, "st_reparse_tag", 0) == 0xA0000003 and
        _test_junction_target_matches(link, target), "CPU observation actual link identity/target changed")
    auth.require(capture._file_identity(link.lstat()) == record["linkIdentity"], "CPU observation link changed during validation")
    return info


def _negative_formal_mapping(reader, base):
    reader.mapping.check()
    def identity(path):
        return _fixture_dual_identity(reader, base, path)["nodeIdentity"]
    runtime = reader.root / ".runtime"
    return {"projectPhysical": str(reader.root.resolve()), "projectIdentity": identity(reader.root),
        "runtimeIdentity": identity(runtime), "physicalRuntime": str(reader.mapping.physical_runtime),
        "physicalRuntimeIdentity": identity(reader.mapping.physical_runtime), "physicalInputRoot": str(reader.path(base))}


def _observe_negative_link(name, base, creation_record):
    reader = auth.Reader(ROOT)
    deadline = _CPU_OBSERVATION_CLOCK() + 10
    owned = os.environ.get("TD_TRAIN_ENTRY_CPU_OUTPUT_ROOT")
    declaration, declaration_binding = _read_negative_observation_json(reader, base + "/input-declaration.json")
    auth.require(owned is not None, "current owned CPU observation required")
    auth.require(_owned_prefix_ok(owned) and owned.endswith("/cpu-entry") and
        base == owned.rsplit("/", 1)[0] + "/cpu-negative-inputs" and
        declaration.get("schema") == "cpu-negative-input-declaration-v1", "exact owned CPU observation declaration")
    expected_request = auth.exact_binding({"path": sys.argv[sys.argv.index("--cpu-request") + 1],
        "sha256": sys.argv[sys.argv.index("--sha256") + 1]})
    auth.require(expected_request["path"] == owned.rsplit("/", 1)[0] + "/cpu-request.json", "exact owned request path")
    receipt_root = owned
    auth.require(declaration.get("request") == expected_request and declaration.get("layout") == _negative_observation_layout(base) and
        declaration.get("formalMapping") == _negative_formal_mapping(reader, base) and
        declaration.get("linkMetadataReserveBytes") == 49152 and declaration.get("reserveIsMeasurement") is False,
        "current CPU declaration request/mapping/reserve differs")
    request = auth.read_json(reader, expected_request)
    auth.require(request.get("schema") == "object-support-structure-quality-cpu-request-v1" and
        request.get("outputRoot") == owned and declaration.get("runId") == request.get("runId") and
        declaration.get("packageId") == request.get("packageId"), "current owned request identity differs")
    auth.require(request.get("formalSpecification") == _request_route(request).specification and
        declaration.get("programBindings") == request.get("programBindings"), "current CPU observation source declaration differs")
    auth.verify_programs(reader, request["programBindings"],capability_version=_request_route(request).capability)
    info = _current_negative_link(reader, name, base, creation_record)
    slot = next(v for v in _negative_observation_layout(base)["links"] if v["name"] == name)
    link = reader.path(slot["path"].rsplit("/", 1)[0]) / slot["path"].rsplit("/", 1)[1]
    dual = _fixture_dual_identity(reader, base, link, creation_record["linkIdentity"])
    value, receipt_binding = _wait_negative_observation(reader, receipt_root + "/negative-observation-" + name + ".json", deadline)
    _validate_negative_observation(value, declaration, name, base, dual["nodeIdentity"], info.st_ctime_ns / 1e9)
    _current_negative_link(reader, name, base, creation_record)
    auth.require(_fixture_dual_identity(reader, base, link, creation_record["linkIdentity"]) == dual,
        "fixture dual identity changed after parent acknowledgement")
    reader.read(declaration_binding, auth.CONTROL_JSON_MAX)
    auth.require(_CPU_OBSERVATION_CLOCK() < deadline, "current parent CPU link observation deadline")
    return receipt_binding


def run_owned_negative_inputs(reader, request, request_binding):
    """Only this new call's three declared private junctions; never old arenas."""
    auth.require(os.name == "nt" and request["outputRoot"] == _request_route(request).root_prefix + request["runId"] + "/cpu-entry",
        "current Windows CPU fixture scope required")
    base = _request_route(request).root_prefix + request["runId"] + "/cpu-negative-inputs"
    declaration, _ = _read_negative_observation_json(reader, base + "/input-declaration.json")
    auth.require(declaration.get("schema") == "cpu-negative-input-declaration-v1"
        and declaration.get("request") == request_binding and declaration.get("layout") == _negative_observation_layout(base)
        and declaration.get("programBindings") == request["programBindings"], "current parent fixture declaration required")
    private_root = reader.path(base).resolve(strict=True)
    observations = []
    for slot in declaration["layout"]["links"]:
        name = slot["name"]
        link, target = reader.path(slot["path"]), reader.path(slot["target"])
        auth.require(not link.exists() and not link.is_symlink() and target.is_dir()
            and link.parent.is_relative_to(private_root) and target.is_relative_to(private_root), "fresh private fixture paths required")
        raw = b"{}"
        if name == "program":
            raw, _ = reader.snapshot(auth.CANONICAL_REGION_PROGRAM)
        filename = "real-earth-region-governance.mjs" if name == "program" else "source.json"
        worker.write(ROOT, slot["target"] + "/" + filename, raw)
        if name == "program":
            # Map this private fixture project to this call's private data only.
            original_plan = reader.read(auth.FROZEN_PLAN, auth.CONTROL_JSON_MAX)
            worker.write(ROOT, base + "/program-data/hot/runtime/" + auth.FROZEN_PLAN["path"].removeprefix(".runtime/"), original_plan)
        quote = lambda value: "'" + str(value).replace("'", "''") + "'"
        command = "New-Item -ItemType Junction -Path " + quote(link) + " -Target " + quote(target) + " -ErrorAction Stop | Out-Null"
        record, primary = None, None
        try:
            result = subprocess.run(["C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe", "-NoProfile",
                "-NonInteractive", "-Command", command], capture_output=True, text=True, timeout=10,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            record = _record_created_test_junction(link, target, private_root, result)
            observed = _observe_negative_link(name, base, record)
            if name == "program":
                private_data, private_project = reader.path(base + "/program-data"), reader.path(base + "/program-project")
                with patch.dict(os.environ, {"AI_PET_WORLD_DATA_ROOT": str(private_data)}):
                    isolated = auth.Reader(private_project)
                    try: isolated.snapshot(auth.CANONICAL_REGION_PROGRAM)
                    except ValueError as error: auth.require("redirection" in str(error), "wrong program rejection")
                    else: raise AssertionError("program junction was accepted")
            else:
                logical = slot["path"] + "/" + filename
                actions = [lambda: reader.read({"path": logical, "sha256": hashlib.sha256(raw).hexdigest()})]
                if name == "snapshot": actions.append(lambda: reader.snapshot(logical))
                for action in actions:
                    try: action()
                    except ValueError as error: auth.require("redirection" in str(error), "wrong reader/snapshot rejection")
                    else: raise AssertionError("descendant junction was accepted")
            observations.append({"name": name, "observation": observed, "redirectRejected": True})
        except BaseException as error:
            primary = error
            raise
        finally:
            try:
                _remove_created_test_junction(link, target, private_root, record)
                auth.require((target / filename).read_bytes() == raw, "fixture target bytes changed")
            except BaseException as cleanup_error:
                if primary is None: raise
                primary.secondary_fixture_cleanup_error = str(cleanup_error)[:2048]
    return observations

def run_node_entry_regression(reader, request, started):
    """Same owned CPU namespace enables the retained three real SQLite cases."""
    stream_root = reader.path(request["outputRoot"] + "/stream-failure-fixtures")
    auth.require(os.environ.get("AI_PAINTER_STREAM_REPAIR_COMPONENT_ROOT") == str(stream_root)
        and stream_root.is_dir() and not stream_root.is_symlink(), "retained native stream fixture root required")
    entry = request["programBindings"]["entryTests"]
    auth.require(entry["path"] == auth.ROLES["entryTests"], "exact current Node entry test required")
    reader.read(entry, auth.PROGRAM_MAX)
    remaining = 240 - (time.monotonic() - started)
    auth.require(remaining > 0, "CPU Node regression has no remaining deadline")
    environment = {**os.environ, "CUDA_VISIBLE_DEVICES": "",
        "T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT": request["outputRoot"]}
    node = subprocess.run([request["runtimeIdentity"]["node"]["absolutePath"], "--test", "--test-reporter=tap",
        str(ROOT / entry["path"])], cwd=ROOT, env=environment, capture_output=True, text=True, encoding="utf-8", timeout=remaining,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    worker.write(ROOT, request["outputRoot"] + "/node-stdout.txt", node.stdout.encode())
    worker.write(ROOT, request["outputRoot"] + "/node-stderr.txt", node.stderr.encode())
    auth.require(node.returncode == 0, "actual current Node entry regression failed")
    for name in ("dispatch", "finalization", "failure"):
        logical = request["outputRoot"] + "/r/" + name + "/fixture-proof.json"
        value, binding = _read_negative_observation_json(reader, logical)
        auth.require(value.get("fixtureKind") == "actual-isolated-registry-IO-and-SHA-not-production"
            and value.get("publicRegistryCodeMocked") is False and value.get("readerMocked") is False
            and value.get("nativeCalls") == 0 and value.get("gpuCalls") == 0
            and value.get("productionRegistryWrites") == 0, "actual private registry regression missing")
        reader.read(binding, auth.CONTROL_JSON_MAX)
    return node.returncode

def _request_route(request):
    capability=request.get("configuration",{}).get("capabilityVersion",request.get("capabilityVersion",auth.CAPABILITY))
    route=auth.execution_route(capability)
    auth.require(request.get("capabilityVersion",route.capability)==route.capability,"CPU route identity conflict")
    return route


def _request_plan(request, **bindings):
    route=_request_route(request)
    return {**request, **bindings, "capabilityVersion":route.capability,
        "outputRoot":route.root_prefix + request["runId"]}


def validation_loader_regression(reader, request, closure_binding, closure):
    """Real eight original validation loads; no forward/grad/optimizer or selection."""
    _request_route(request)
    from diagnose_stage4_mvp256_dry_appearance_regime_gradient_cpu import DIAGNOSTIC
    candidate = auth.read_json(reader, auth.candidate_binding(_request_route(request).capability))
    plan = _request_plan(request, dataClosure=closure_binding,
        trainSplit=candidate["frozenBindings"]["trainSplit"], validationSplit=candidate["frozenBindings"]["validationSplit"])
    auth.require(auth.same_json(auth.verify_data_closure(reader, plan), closure), "actual current closure differs")
    rows = sorted((row for row in auth.read_json(reader, DIAGNOSTIC)["rows"] if row["split"] == "validation"),
        key=lambda row: row["ordinal"])
    expected = {row["identity"]["visualFactManifestFile"]["path"]: row["identity"]["visualFactManifestFile"] for row in rows}
    auth.require(len(rows) == len(expected) == 8 and [row["sampleId"] for row in rows] == closure["splitSampleIds"]["validation"],
        "original validation loader order differs")
    seen = {}
    actual_reader = auth.Reader(ROOT)

    class LoaderReader:
        def __init__(self): self.root = actual_reader.root
        def read(self, binding, maximum=auth.SOURCE_JSON_MAX): return actual_reader.read(binding, maximum)
        def json(self, binding): return actual_reader.json(binding)
        def unchanged(self): actual_reader.unchanged()
        def snapshot(self, logical):
            raw, binding = reader.snapshot(logical)
            auth.require(actual_reader.read(binding, auth.PROGRAM_MAX if logical == auth.CANONICAL_REGION_PROGRAM
                else auth.SOURCE_JSON_MAX) == raw, "actual loader snapshot bytes changed")
            if logical in expected:
                auth.require(auth.same_json(binding, expected[logical]), "actual validation visual binding differs")
                seen[logical] = {**binding, "bytes": len(raw)}
            return raw, binding

    loaded, order = worker.load_samples(LoaderReader(), plan, splits=("validation",))
    samples = loaded["validation"]
    auth.require(set(loaded) == {"validation"} and len(order) == 23 and set(seen) == set(expected)
        and [sample["sampleId"] for sample in samples] == closure["splitSampleIds"]["validation"], "actual eight validation loads required")
    for sample, row in zip(samples, rows):
        auth.require(sample["split"] == "validation", "actual validation sample split differs")
        for key, shape in (("conditions", [23, 192, 256]), ("image", [3, 192, 256]), ("appearance_regime", [4]), ("ecology_regime", [7])):
            value = sample[key]
            auth.require(list(value.shape) == shape and value.device.type == "cpu" and not value.requires_grad,
                "actual validation tensor shape/device differs")
        image = row["identity"]["image"]
        auth.require(actual_reader.observed.get(image["path"]) == image["sha256"]
            and image["path"] not in reader._source_snapshot_bindings, "actual validation RGB read/closure differs")
    train_rows = (row for row in auth.read_json(reader, DIAGNOSTIC)["rows"] if row["split"] == "train")
    auth.require(all(row["identity"]["image"]["path"] not in actual_reader.observed for row in train_rows),
        "validation loader must not read train RGB")
    actual_reader.unchanged()
    proof = {"schema": "quality-validation-loader-regression-v1", "status": "actual8_validation_loaded_cpu",
        "sampleIds": [sample["sampleId"] for sample in samples],
        "visualManifests": [seen[row["identity"]["visualFactManifestFile"]["path"]] for row in rows],
        "originalRgb": [row["identity"]["image"] for row in rows], "closureBindings": len(closure["bindings"]),
        "validationRgbReadByLoaderTest": True, "validationRgbReadByClosure": closure["validationRgbRead"],
        "validationRgbInSnapshotClosure": False, "trainRgbReadByLoaderTest": False,
        "challengeContentRead": False, "regressionContentRead": False, "weightOptimization": False,
        "checkpointSelection": False, "gpuQualification": False, "sourceReader": "actual_recomputed_Reader", "qualified": False}
    return worker.write(ROOT, request["outputRoot"] + "/validation-loader-regression.json", proof)


def completion_admission_test_case(capability):
    if codec.execution_values(capability).get('interface_contract'):
        return type('CurrentRegisteredInterfaceAdmissionTests',(RegisteredInterfaceAdmissionTests,),{'_registered_capability':capability})
    if capability == codec.SAME_CALL_CAPABILITY:
        return SameCallAdmissionTests
    return CompletionV2AdmissionTests if capability == codec.COMPLETION_V2_CAPABILITY else CompletionAdmissionTests


def cpu_request(binding):
    """Fresh current-package metadata plus bounded regression, never old CPU replay."""
    started = time.monotonic()
    torch.set_num_threads(2)
    if torch.get_num_interop_threads() != 2:
        torch.set_num_interop_threads(2)
    import psutil
    process = psutil.Process(); process.cpu_affinity(process.cpu_affinity()[:2])
    reader = auth.Reader(ROOT)
    request = auth.read_json(reader, binding)
    route=_request_route(request)
    auth.require(request.get("capabilityVersion",route.capability)==route.capability,"CPU route identity conflict")
    auth.require(request.get("schema") == "object-support-structure-quality-cpu-request-v1"
        and request.get("modelCapabilityVersion") == route.model_capability
        and request.get("outputRoot") == route.root_prefix + request["runId"] + "/cpu-entry", "own new CPU request required")
    for key in ("runId", "packageId"):
        auth.require(type(request.get(key)) is str and auth.re.fullmatch(r"[a-z0-9][a-z0-9-]{7,127}", request[key]), "CPU Run/package ID invalid")
    execution_values=codec.execution_values(route.capability)
    auth.require(request["runId"].startswith(execution_values["run_prefix"]) and request["packageId"].startswith(execution_values["package_prefix"]),
        "new CPU Run/package prefixes required")
    auth.require(request["runId"] != request["packageId"] and binding["path"] == route.root_prefix + request["runId"] + "/cpu-request.json",
        "same Run CPU request required")
    auth.verify_programs(reader, request["programBindings"],capability_version=route.capability)
    auth.require(auth.same_json(request["configuration"], auth.configuration(reader,capability_version=route.capability))
        and auth.same_json(request["runtimeIdentity"], auth.runtime_identity(ROOT)), "current CPU inputs/runtime differ")
    worker.write(ROOT, request["outputRoot"] + "/consumed.json", {"request": binding, "attempt": 1, "retries": 0})
    candidate = auth.read_json(reader, auth.candidate_binding(route.capability))
    auth.require("modelBinding" not in request and request.get("formalSpecification") == route.specification
        and request.get("datasetManifest") == candidate["frozenBindings"]["datasetManifest"], "current model bootstrap/dataset required")
    calls = {key: 0 for key in ("moduleForwardCalls", "autogradCalls", "optimizerConstructionAttempts", "optimizerUpdates", "cudaInitializationAttempts")}
    def forbidden(key):
        def fail(*args, **kwargs):
            calls[key] += 1
            raise AssertionError("CPU protocol prohibited " + key)
        return fail
    output = io.StringIO()
    with ExitStack() as scope:
        for obj, name, key in ((torch.nn.Module, "_call_impl", "moduleForwardCalls"), (torch.autograd, "grad", "autogradCalls"),
            (torch.autograd, "backward", "autogradCalls"), (torch.optim.Optimizer, "__init__", "optimizerConstructionAttempts"),
            (torch.optim.Optimizer, "step", "optimizerUpdates"), (torch.cuda, "_lazy_init", "cudaInitializationAttempts"),
            (torch.cuda, "init", "cudaInitializationAttempts")):
            scope.enter_context(patch.object(obj, name, forbidden(key)))
        scope.enter_context(patch.dict(os.environ, {"TD_TRAIN_ENTRY_CPU_OUTPUT_ROOT": request["outputRoot"]}))
        actual = auth.derive_model_metadata(reader, candidate["frozenBindings"]["datasetManifest"],capability_version=route.capability)
        auth.require(request["modelIdentityOutput"] == route.root_prefix + request["runId"] + "/model-identity.json", "same Run model output required")
        model_binding = worker.write(ROOT, request["modelIdentityOutput"], actual)
        closure = auth.derive_data_closure(ROOT, route.capability)
        closure_binding = worker.write(ROOT, route.root_prefix + request["runId"] + "/data-closure.json", closure)
        negative_inputs = run_owned_negative_inputs(reader, request, binding)
        validation_binding = validation_loader_regression(reader, request, closure_binding, closure)
        suite = unittest.defaultTestLoader.loadTestsFromTestCase(AdmissionTests)
        if codec.execution_values(route.capability)["completion"]:
            suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(completion_admission_test_case(route.capability)))
        suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(SameCallRouteTests))
        result = unittest.TextTestRunner(stream=output, verbosity=2, resultclass=_CpuResult).run(suite)
        node_exit_code = run_node_entry_regression(reader, request, started)
    worker.write(ROOT, request["outputRoot"] + "/python-output.txt", output.getvalue().encode())
    auth.require(time.monotonic() - started < 240 and result.wasSuccessful() and not result.skipped
        and not any(calls.values()) and not torch.cuda.is_initialized(), "current CPU regression failed")
    reader.unchanged()
    report = {"schema": worker.CPU_SCHEMA, "status": "passed", "passed": result.testsRun, "failed": 0,
        "errors": 0, "skipped": 0, "synthetic": True, "gpuInitialized": False, "actualCalls": calls,
        "request": binding, "programBindings": request["programBindings"], "configuration": request["configuration"],
        "runtimeIdentity": request["runtimeIdentity"], "modelBinding": model_binding, "initialModel": actual,
        "dataClosure": closure_binding, "negativeInputs": negative_inputs, "validationLoaderRegression": validation_binding,
        "items": result.passed_items,
        "nativeCleanupClaimed": False, "formalStage4QualificationAllowed": False, "runtimePublicationAllowed": False,
        "nodeExitCode": node_exit_code, "newGpuOrTrainingExecuted": False, "elapsedSeconds": time.monotonic() - started}
    worker.verify_cpu_report(report, request, _request_plan(request, modelBinding=model_binding))
    return worker.write(ROOT, request["outputRoot"] + "/cpu-report.json", report)




class SameCallRouteTests(unittest.TestCase):
    """Real bridge construction; only live/source/sample admission is synthetic."""
    CAPABILITY = "stage4_mvp256_dry_decode1_entry_weight_quality24_same_call_v1"

    def test_registered_same_call_cpu_request_selects_own_identity_cases(self):
        route = auth.execution_route(codec.SAME_CALL_CAPABILITY)
        self.assertEqual(route.capability, self.CAPABILITY)
        values = codec.execution_values(route.capability)
        self.assertIs(values["same_call_capture"], True)
        self.assertIs(values["completion"], True)
        self.assertIs(values["qualification_completion"], True)
        policy = json.loads((ROOT/values["policy"]["path"]).read_bytes())
        configuration = codec.expected_configuration({"path":values["preview_path"],
            "sha256":policy["trainingPreviewPolicy"]["sha256"]}, route.capability)
        self.assertIsNone(configuration["gpuAdmissionSeconds"])
        plan = {"capabilityVersion":route.capability, "configuration":configuration, "outputRoot":OUTPUT}
        with patch.object(auth, "read_json", return_value=policy):
            self.assertIsNone(worker.ResourceGuard(PACKAGE, plan, started=0, gpu_gate=True).seconds)
        self.assertIs(completion_admission_test_case(route.capability), SameCallAdmissionTests)
        self.assertEqual(completion_admission_test_case(route.capability).CAPABILITY, route.capability)
        self.assertIs(completion_admission_test_case(codec.COMPLETION_V2_CAPABILITY), CompletionV2AdmissionTests)
        for capability in (auth.CAPABILITY, codec.COMPLETION_CAPABILITY):
            self.assertIs(completion_admission_test_case(capability), CompletionAdmissionTests)

    def fixture(self):
        from ai_painter.complete_world import parameter90_training_same_call_bridge_v1 as same_call
        train = [{"sampleId":"synthetic-same-call-"+str(i), "split":"train"} for i in range(48)]
        plan = {"capabilityVersion":self.CAPABILITY, "trainSplit":DATA, "runId":RUN,
            "outputRoot":OUTPUT, "modelBinding":{"path":OUTPUT+"/model-identity.json", "sha256":"f"*64},
            "programBindings":PROGRAMS}
        reader = SimpleNamespace(mapping=object(),
            json=lambda binding: {"split":"train", "sampleIds":[s["sampleId"] for s in train]})
        context = auth.Context(reader, PACKAGE, {}, plan)
        model = SimpleNamespace(named_parameters=lambda: [])
        preview = SimpleNamespace(observe=lambda *args: None)
        arguments = dict(profile=profile, plan_binding=PLAN, execution_binding=PACKAGE,
            preview=preview, capture_sink=object(), context_for_sample=object())
        return same_call, context, train, model, arguments

    def admitted(self):
        same_call, context, train, model, arguments = self.fixture()
        guards = self.enterContext(ExitStack())
        live = guards.enter_context(patch.object(same_call.auth, "verify_live_context"))
        guards.enter_context(patch.object(same_call.TrainingSameCallBridge, "_authenticate_bindings"))
        guards.enter_context(patch.object(same_call.TrainingSameCallBridge, "_sample_identity",
            side_effect=lambda sample: dict(sample, image=DATA, conditionPack=DATA)))
        guards.enter_context(patch.object(codec, "execution_values", return_value={"same_call_capture":True}))
        callbacks = worker.training_loop_callbacks(context, train, model, **arguments)
        live.assert_called_once_with(context, expected_phase="training")
        return same_call, context, train, model, arguments, callbacks

    def test_exact_route_constructs_real_bridge_and_all_three_bound_callbacks(self):
        same_call, context, train, model, arguments, callbacks = self.admitted()
        self.assertEqual(set(callbacks), {"pair_runner", "capture_sink", "context_for_sample"})
        actual = callbacks["pair_runner"].__self__
        self.assertIs(type(actual), same_call.TrainingSameCallBridge)
        self.assertIs(actual.context, context); self.assertIs(actual.model, model)
        self.assertEqual(actual.train, tuple(train)); self.assertIs(actual.preview, arguments["preview"])
        self.assertEqual(actual.plan_binding, PLAN); self.assertEqual(actual.execution_binding, PACKAGE)
        self.assertIs(callbacks["capture_sink"].__self__, actual)
        self.assertIs(callbacks["context_for_sample"].__self__, actual)
        self.assertEqual(callbacks["context_for_sample"].__func__, same_call.TrainingSameCallBridge.sample_context)

    def test_old_routes_keep_original_runner_sink_and_context_without_bridge(self):
        same_call, context, train, model, arguments = self.fixture()
        for capability in (auth.CAPABILITY, codec.COMPLETION_CAPABILITY, codec.COMPLETION_V2_CAPABILITY,
                self.CAPABILITY+"-not-the-route"):
            context.plan["capabilityVersion"] = capability
            with self.subTest(capability=capability), patch.object(same_call, "TrainingSameCallBridge",
                    side_effect=AssertionError("legacy route must not construct bridge")), \
                    patch.object(codec, "execution_values", side_effect=AssertionError("legacy route unchanged")), \
                    patch.object(worker, "observed_pair", return_value="synthetic-old-pair") as observed:
                callbacks = worker.training_loop_callbacks(context, train, model, **arguments)
                self.assertIs(callbacks["capture_sink"], arguments["capture_sink"])
                self.assertIs(callbacks["context_for_sample"], arguments["context_for_sample"])
                self.assertEqual(callbacks["pair_runner"]("synthetic-argument"), "synthetic-old-pair")
                observed.assert_called_once_with(profile.perform_pair, model, "synthetic-argument",
                    prediction_observer=arguments["preview"].observe, observation_profile=profile)

    def test_new_route_requires_true_codec_flag(self):
        same_call, context, train, model, arguments = self.fixture()
        for value in ({}, {"same_call_capture":False}, {"same_call_capture":1}):
            with self.subTest(value=value), patch.object(codec, "execution_values", return_value=value), \
                    patch.object(same_call, "TrainingSameCallBridge") as constructor:
                with self.assertRaisesRegex(ValueError, "exact same-call execution route"):
                    worker.training_loop_callbacks(context, train, model, **arguments)
                constructor.assert_not_called()

    def test_real_constructor_rejects_wrong_context_and_wrong_train_sequence(self):
        same_call, context, train, model, arguments, _ = self.admitted()
        with self.assertRaisesRegex(ValueError, "authentic execution context"):
            worker.training_loop_callbacks(SimpleNamespace(plan=context.plan), train, model, **arguments)
        with self.assertRaisesRegex(ValueError, "exact48 unique train"):
            worker.training_loop_callbacks(context, train[:-1], model, **arguments)
        with self.assertRaisesRegex(ValueError, "actual train sequence"):
            worker.training_loop_callbacks(context, list(reversed(train)), model, **arguments)

    def test_real_constructor_admission_failure_is_not_replaced(self):
        same_call, context, train, model, arguments = self.fixture()
        first = PermissionError("synthetic live admission failure")
        with patch.object(codec, "execution_values", return_value={"same_call_capture":True}), \
                patch.object(same_call.auth, "verify_live_context", side_effect=first):
            with self.assertRaises(PermissionError) as caught:
                worker.training_loop_callbacks(context, train, model, **arguments)
        self.assertIs(caught.exception, first)

    def test_real_three_callbacks_preserve_pair_first_error_and_secondary_admission(self):
        same_call, context, train, model, arguments, callbacks = self.admitted()
        first = ValueError("synthetic original G failure")
        with patch.object(same_call.profile, "perform_pair", side_effect=first) as pair:
            with self.assertRaises(ValueError) as caught:
                callbacks["pair_runner"](model, "synthetic-critic")
        self.assertIs(caught.exception, first)
        self.assertIs(callbacks["pair_runner"].__self__.last_failure, first)
        self.assertIs(pair.call_args.kwargs["same_call_context"].__self__, callbacks["pair_runner"].__self__)
        self.assertIs(pair.call_args.kwargs["prediction_observer"], arguments["preview"].observe)
        bound_context = callbacks["context_for_sample"](train[0], {"sampleId":train[0]["sampleId"], "trainIndex":0})
        from ai_painter.complete_world import parameter90_training_same_call_storage_v1 as storage
        receipt = {"status":"capture_incomplete", "primaryError":{"type":"ValueError", "message":str(first)}}
        with patch.object(same_call.auth, "verify_live_context", side_effect=RuntimeError("synthetic later admission")), \
                patch.object(storage, "save_same_call_failure", return_value=receipt) as save:
            actual = callbacks["capture_sink"](first, model=model, critic="synthetic-critic", context=bound_context)
        self.assertIs(actual, receipt); self.assertIs(save.call_args.args[0], first)
        self.assertIsNone(save.call_args.kwargs["packet"])
        self.assertEqual(actual["primaryError"]["message"], str(first))
        self.assertEqual(actual["sameCallBridgeSecondaryFailures"][0]["message"], "synthetic later admission")


class LifecycleTests(unittest.TestCase):
    """Exercise schedule/evidence with inert pair/optimizer dependencies only."""
    def exercise(self, *, fail_pair=False, fail_reload=False,completion=False):
        model,critic=profile.fresh_networks(ORDER)
        train=[{"sampleId":"train-"+str(i),"split":"train"} for i in range(48)]
        validation=[{"sampleId":"validation-"+str(i),"split":"validation"} for i in range(8)]
        configuration=(CompletionV2AdmissionTests() if completion==2 else CompletionAdmissionTests()).configuration()[0] if completion else config()
        values=codec.execution_values(configuration["capabilityVersion"])
        run=values["run_prefix"]+"private" if completion else RUN
        output=codec.execution_values(configuration["capabilityVersion"])["root_prefix"]+run
        package_id=values["package_prefix"]+"private" if completion else "decode1-entry-quality-v1-package-synthetic"
        package={**PACKAGE,"path":".runtime/ai-painter/autonomous-closed-loop-packages/"+package_id+"/package.json"} if completion else PACKAGE
        plan_binding={**PLAN,"path":output+"/quality-plan.json"}
        plan={"capabilityVersion":configuration["capabilityVersion"],"configuration":configuration,"runId":run,
            "packageId":package_id,"outputRoot":output,
            "modelBinding":{"path":output+"/model-identity.json","sha256":"f"*64},
            "datasetManifest":DATA,"programBindings":PROGRAMS,
            "finalCpuAcceptance":{"path":output+"/cpu-acceptance.json","sha256":"a"*64}}
        trace={"pairs":0,"checkpoints":[],"observations":[],"validations":[],"reloaded":0,"capture":[]}
        first=ValueError("synthetic pair failure")
        def pair(model,critic,sample,order,go,do,counts,ledger,resource,forward,**kwargs):
            trace["pairs"]+=1
            counts["discriminator"]+=1;ledger["discriminator"]+=1
            if fail_pair and counts["generator"]==607:
                raise first
            counts["generator"]+=1;ledger["generator"]+=1
        def optimizer(parameters,**kwargs):
            self.assertEqual(kwargs,dict(lr=.0001,betas=(.9,.999),eps=1e-8,weight_decay=.01,foreach=False,fused=False))
            return SimpleNamespace(synthetic=True)
        def validate(model,samples,order,*,epoch):
            self.assertEqual([s["sampleId"] for s in samples],[r["sampleId"] for r in rows(epoch)])
            trace["validations"].append(epoch)
            return rank(epoch),rows(epoch)
        def sink(epoch,raw):
            if epoch is None: return trace["raw"]
            self.assertEqual(epoch,24)
            trace["raw"]=raw
            binding={"path":output+"/checkpoint-24.pt","sha256":hashlib.sha256(raw).hexdigest()}
            trace["checkpoints"].append(binding)
            return binding
        def observation(epoch,value):
            self.assertFalse(value["checkpointSelectionEligible"])
            trace["observations"].append(value)
            return {"path":output+"/epoch-observation-12.json","sha256":"e"*64}
        def reload(raw,**kwargs):
            trace["reloaded"]+=1
            if fail_reload: raise first
            return codec.reload(raw,**kwargs)
        def capture(error,**kwargs):
            trace["capture"].append(kwargs["context"])
            return {"status":"captured","primaryError":{"type":type(error).__name__,"message":str(error)}}
        arguments=dict(model=model,critic=critic,train=train,validation=validation,order=ORDER,
            configuration=configuration,package_binding=package,plan=plan,plan_binding=plan_binding,
            resource=lambda:None,checkpoint_sink=sink,progress_sink=lambda *args,**kwargs:None,
            pair_runner=pair,validation_runner=validate,optimizer_factory=optimizer,
            observation_sink=observation,checkpoint_reloader=reload,capture_sink=capture,
            context_for_sample=lambda sample,position:{"sampleId":sample["sampleId"]})
        with ExitStack() as guards:
            for owner,name in ((torch.nn.Module,"_call_impl"),(torch.cuda,"_lazy_init"),(torch.optim.Optimizer,"__init__"),(torch.autograd,"grad")):
                guards.enter_context(patch.object(owner,name,side_effect=AssertionError("real training prohibited")))
            before=(state(model),state(critic))
            if fail_pair or fail_reload:
                with self.assertRaises(ValueError) as caught: lifecycle.training_loop(**arguments)
                self.assertIs(caught.exception,first)
                result=worker.terminal(first,None,PACKAGE,plan,{"path":OUTPUT+"/gpu-acceptance.json","sha256":"c"*64})
                self.assertEqual(result["status"],"failed_closed")
                self.assertEqual(len(trace["capture"]),1)
            else:
                result=lifecycle.training_loop(**arguments)
            self.assertEqual(before,(state(model),state(critic)))
        return result,trace

    def test_inert24_round_schedule_only_epoch24_checkpoint_and_strict_reload(self):
        result,trace=self.exercise()
        self.assertEqual(trace["pairs"],1152)
        self.assertEqual(trace["validations"],[12,24])
        self.assertEqual(len(trace["checkpoints"]),1)
        self.assertEqual(trace["reloaded"],1)
        self.assertEqual(result["optimizerSteps"],{"generator":1152,"discriminator":1152})
        self.assertEqual(result["epochObservations"][0]["epoch"],12)
        self.assertEqual(result["selectedCheckpointRecord"]["epoch"],24)

    def test_completion_inert24_rounds_keeps1152_and_strict_same_route_reload(self):
        for version in (1,2):
            result,trace=self.exercise(completion=version)
            self.assertEqual(trace["pairs"],1152);self.assertEqual(trace["validations"],[12,24])
            self.assertEqual(result["optimizerSteps"],{"generator":1152,"discriminator":1152})
            self.assertEqual(len(trace["checkpoints"]),1);self.assertEqual(trace["reloaded"],1)
            self.assertTrue(result["checkpointReloadVerified"])
            self.assertFalse(result["formalStage4QualificationAllowed"])

    def test_midpoint_and_actual_partial_counts_survive_first_failure_no_retry(self):
        result,trace=self.exercise(fail_pair=True)
        self.assertEqual(trace["pairs"],608)
        self.assertEqual(result["optimizerSteps"],{"generator":607,"discriminator":608})
        self.assertEqual(result["completedEpochs"],12)
        self.assertEqual(len(result["epochObservations"]),1)
        self.assertEqual(result["checkpoints"],[])
        self.assertEqual(result["automaticRetries"],0)
        self.assertEqual(result["failurePosition"]["epoch"],13)

    def test_final_checkpoint_is_retained_when_reload_fails(self):
        result,trace=self.exercise(fail_reload=True)
        self.assertEqual(len(result["checkpoints"]),1)
        self.assertEqual(trace["reloaded"],1)
        self.assertFalse(result["checkpointReloadVerified"])
        self.assertEqual(len(result["epochObservations"]),1)
        self.assertEqual(result["optimizerSteps"],{"generator":1152,"discriminator":1152})

class HarnessProtocolTests(unittest.TestCase):
    def test_metadata_only_cpu_request_produces_node_compatible_report(self):
        candidate={"frozenBindings":{"datasetManifest":DATA,"trainSplit":{"path":"synthetic/train.json","sha256":"b"*64},
            "validationSplit":{"path":"synthetic/validation.json","sha256":"c"*64}}}
        request={"schema":"object-support-structure-quality-cpu-request-v1","runId":RUN,
            "packageId":"decode1-entry-quality-v1-package-synthetic","outputRoot":OUTPUT+"/cpu-entry",
            "modelCapabilityVersion":identity.CAPABILITY,"configuration":config(),"programBindings":PROGRAMS,
            "modelIdentityOutput":OUTPUT+"/model-identity.json","formalSpecification":auth.SPECIFICATION,
            "datasetManifest":DATA,"runtimeIdentity":{"synthetic":True}}
        request_binding={"path":OUTPUT+"/cpu-request.json","sha256":"d"*64}
        reader=SimpleNamespace(root=ROOT,unchanged=lambda:None)
        stored={}
        def write(root,path,value,**kwargs):
            stored[path]=value
            raw=value if type(value) is bytes else json.dumps(value,sort_keys=True).encode()
            return {"path":path,"sha256":hashlib.sha256(raw).hexdigest()}
        def read(reader,binding):
            return request if binding==request_binding else candidate
        with ExitStack() as guards:
            for owner,name,value in ((auth,"Reader",lambda root:reader),(auth,"read_json",read),
                    (auth,"verify_programs",lambda *args,**kwargs:None),(auth,"configuration",lambda *args,**kwargs:config()),
                    (auth,"runtime_identity",lambda *args:request["runtimeIdentity"]),
                    (auth,"derive_model_metadata",lambda *args,**kwargs:{"modelCapabilityVersion":identity.CAPABILITY}),
                    (auth,"derive_data_closure",lambda *args:{"synthetic":True}),
                    (worker,"write",write)):
                guards.enter_context(patch.object(owner,name,value))
            current=sys.modules[__name__]
            guards.enter_context(patch.object(current,"run_owned_negative_inputs",return_value=[]))
            guards.enter_context(patch.object(current,"validation_loader_regression",return_value={"path":"synthetic/loader.json","sha256":"e"*64}))
            guards.enter_context(patch.object(current,"run_node_entry_regression",return_value=0))
            result=cpu_request(request_binding)
        report=stored[result["path"]]
        self.assertGreaterEqual(report["passed"],20)
        self.assertFalse(any(report["actualCalls"].values()))
        self.assertEqual(report["modelBinding"]["path"],request["modelIdentityOutput"])
        self.assertEqual(report["dataClosure"]["path"],OUTPUT+"/data-closure.json")
        self.assertEqual(report["nodeExitCode"],0)
        self.assertEqual(len(report["items"]),report["passed"])
        self.assertFalse(report["nativeCleanupClaimed"])


class GateAndAuthorityTests(unittest.TestCase):
    def test_same_package_full48_gate_rejects_relabelled_old_identity_and_partial_counts(self):
        ids=["train-"+str(i) for i in range(48)]
        initial={"generator":"a"*64,"discriminator":"b"*64}
        plan={"outputRoot":OUTPUT,"capabilityVersion":auth.CAPABILITY,"runId":RUN,
            "packageId":"decode1-entry-quality-v1-package-synthetic","programBindings":PROGRAMS,
            "trainSplit":{"path":"synthetic/train.json","sha256":"a"*64},
            "modelBinding":{"path":OUTPUT+"/model-identity.json","sha256":"c"*64}}
        gate_binding={"path":OUTPUT+"/gpu-gate.json","sha256":"f"*64}
        proof={"callCounts":{"generatorForwards":1,"generatorForwardCompleted":1,"generatorAutograd":5,"discriminatorAutograd":1},
            "optimizerCreated":False,"optimizerUpdates":0}
        gate={"schema":worker.GPU_SCHEMA,"status":"passed","capabilityVersion":auth.CAPABILITY,
            "executionProfile":auth.PROFILE,"runId":RUN,"packageId":plan["packageId"],"executionPackage":PACKAGE,
            "programBindings":PROGRAMS,"actualCounts":{kind+suffix:value for kind,value in
                (("forward",48),("generator",240),("discriminator",48)) for suffix in ("Attempted","Completed")},
            "deviceIdentity":{"ordinal":0,"uuid":"GPU-12345678-1234-1234-1234-123456789abc"},
            "cases":[{"sampleId":sid,"passed":True,"proof":deepcopy(proof)} for sid in ids],
            "optimizerSteps":0,"checkpointLoaded":False,"checkpointWritten":False,"initialState":initial,
            "finalState":initial,"initialCpuState":initial}
        def read(reader,binding):
            if binding==gate_binding:return reader.gate
            if binding==plan["trainSplit"]:return {"sampleIds":ids}
            if binding==plan["modelBinding"]:return {"initialState":initial}
            raise AssertionError("unbound synthetic read")
        reader=SimpleNamespace(gate=gate)
        with patch.object(auth,"read_json",side_effect=read):
            self.assertIs(worker.verify_gpu_gate(reader,plan,PACKAGE,gate_binding),gate)
            for key,value in (("capabilityVersion",bridge.CAPABILITY),("executionProfile","bounded_joint_object_priority_quality24_v1"),
                    ("executionPackage",{**PACKAGE,"sha256":"0"*64}),("runId",RUN+"-other"),
                    ("actualCounts",{**gate["actualCounts"],"generatorCompleted":239}),("checkpointWritten",True)):
                reader.gate={**gate,key:value}
                with self.subTest(key=key),self.assertRaises(ValueError):worker.verify_gpu_gate(reader,plan,PACKAGE,gate_binding)

    def test_real_policy_shape_with_target48_byte_receipts_and_distinct_joint_evidence(self):
        policy_raw=(ROOT/codec.POLICY["path"]).read_bytes()
        policy=json.loads(policy_raw)
        formal_raw=(ROOT/"data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.96-f33115ca.txt").read_bytes()
        self.assertEqual(hashlib.sha256(formal_raw).hexdigest(),auth.SPECIFICATION["sha256"])
        preview={"schemaVersion":"ai-painter-training-preview-observation-policy-v6",
            "scope":{"capabilityVersion":auth.CAPABILITY,"modelCapabilityVersion":identity.CAPABILITY,"outputRootPrefix":auth.ROOT_PREFIX},
            "programBindings":{key:{"path":auth.ROLES[role],"sha256":"a"*64} for key,role in
                (("component","previewComponent"),("storage","previewStorage"),("tests","previewTests"),("storageTests","previewStorageTests"))}}
        preview_raw=json.dumps(preview).encode()
        values={auth.SPECIFICATION["path"]:formal_raw,codec.POLICY["path"]:policy_raw,codec.PREVIEW_PATH:preview_raw,
            policy["priorCpuEvidence"]["acceptance"]["path"]:json.dumps({"status":"cpu_candidate_verified_inactive_scope_closed","candidate":identity.CAPABILITY}).encode(),
            policy["priorCpuEvidence"]["terminal"]["path"]:b'{"status":"cpu_candidate_verified_inactive"}',
            policy["jointRuleCpuEvidence"]["acceptance"]["path"]:b'{"status":"cpu_affinity_startup_repair_closed_real_cpu_verified_inactive","realExecution":{"status":"real_cpu_verified_inactive"}}'}
        reads=[]
        class Reader:
            def read(self,binding,maximum=None):
                # Actual registered target48 receipts carry a third byte-count
                # field; they must be reduced to an exact immutable binding.
                codec.exact_binding(binding);reads.append(binding["path"])
                return values.get(binding["path"],b"{}")
            def path(self,logical):
                self_logical=logical
                return SimpleNamespace(lstat=lambda:SimpleNamespace(st_mode=auth.stat.S_IFREG,st_size=len(values[self_logical])),
                    read_bytes=lambda:values[self_logical])
            def unchanged(self):pass
        with patch.object(auth,"_file_identity",return_value=(1,2,3,4,5)),patch.object(auth,"verify_progress_publication_policy"):
            value=auth.derive_configuration(Reader())
        self.assertEqual(value["capabilityVersion"],auth.CAPABILITY)
        self.assertIn(policy["priorCpuEvidence"]["terminal"]["path"],reads)
        self.assertIn(policy["priorCpuEvidence"]["request"]["path"],reads)
        self.assertIn(policy["jointRuleCpuEvidence"]["terminal"]["path"],reads)
        self.assertEqual(len({p for p in reads if p.endswith("terminal.json")}),2)

class CompletionAdmissionTests(unittest.TestCase):
    """No model/forward/CUDA; also executed by the completion CPU preparation."""
    CAPABILITY=codec.COMPLETION_CAPABILITY

    def configuration(self):
        policy=json.loads((ROOT/codec.execution_values(self.CAPABILITY)["policy"]["path"]).read_bytes())
        preview={"path":codec.execution_values(self.CAPABILITY)["preview_path"],
            "sha256":policy["trainingPreviewPolicy"]["sha256"]}
        return codec.expected_configuration(preview,self.CAPABILITY),policy

    def fixture(self):
        base=os.environ.get("TD_TRAIN_ENTRY_CPU_OUTPUT_ROOT",
            ".runtime/ai-painter/controller-repair-reviews/completion-training-20261019/t-training/fixtures")
        logical=base+"/completion-"+uuid.uuid4().hex
        reader=auth.Reader(ROOT);reader.path(logical).mkdir(parents=True)
        values=codec.execution_values(self.CAPABILITY)
        plan={"capabilityVersion":self.CAPABILITY,"runId":values["run_prefix"]+"private",
            "packageId":values["package_prefix"]+"private","outputRoot":logical}
        return auth.Context(reader,PACKAGE,{},plan)

    def test_exact_policy_null_only_new_training_and_legacy_fixed8400(self):
        configuration,policy=self.configuration()
        self.assertIs(codec.validate_execution_policy(policy,configuration),policy)
        self.assertIsNone(configuration["executionCeiling"]["maxWallSeconds"])
        self.assertEqual(configuration["executionCeiling"]["trainingWallMode"],"completion")
        self.assertEqual(configuration["executionCeiling"]["epochs"],24)
        self.assertEqual(configuration["executionCeiling"]["generatorOptimizerSteps"],1152)
        self.assertEqual(configuration["executionCeiling"]["discriminatorOptimizerSteps"],1152)
        self.assertEqual(config()["executionCeiling"]["maxWallSeconds"],8400)
        self.assertNotIn("trainingWallMode",config()["executionCeiling"])
        for value in (8400,10**20,float("inf"),True):
            changed=deepcopy(configuration);changed["executionCeiling"]["maxWallSeconds"]=value
            with self.subTest(value=value),self.assertRaises(ValueError):codec.validate_configuration(changed)
        changed=deepcopy(configuration);changed["trainingPreviewPolicy"]["sha256"]="0"*64
        with self.assertRaisesRegex(ValueError,"preview SHA"):codec.validate_execution_policy(policy,changed)

    def test_resource_guard_beyond8400_keeps_disk_floor_and_admission720(self):
        configuration,policy=self.configuration()
        plan={"capabilityVersion":self.CAPABILITY,"configuration":configuration,"outputRoot":OUTPUT}
        with patch.object(auth,"read_json",return_value=policy):
            completion=worker.ResourceGuard(PACKAGE,plan,started=0)
            admission=worker.ResourceGuard(PACKAGE,plan,started=0,gpu_gate=True)
        legacy=worker.ResourceGuard(PACKAGE,{**plan,"capabilityVersion":auth.CAPABILITY,"configuration":config()},started=0)
        self.assertIsNone(completion.seconds);self.assertEqual(admission.seconds,None if codec.execution_values(self.CAPABILITY).get('qualification_completion') else 720);self.assertEqual(legacy.seconds,8400)
        with patch.object(worker.time,"monotonic",return_value=9001),patch.object(worker,"runtime_for_plan",return_value=(torch,None,None)):
            with self.assertRaisesRegex(ValueError,"own wall/CPU deadline"):legacy()
            with patch.object(worker.shutil,"disk_usage",return_value=SimpleNamespace(free=0)):
                with self.assertRaisesRegex(ValueError,"disk safety floor"):completion()

    def test_worker_timing_start_unknown_end_and_failed_terminal_actual_elapsed(self):
        context=self.fixture();logical=context.plan["outputRoot"]
        with patch.dict(os.environ,{"DETAIL_WEIGHT_OUTPUT_ROOTS":json.dumps([logical])}),patch.object(worker.time,"monotonic",return_value=104):
            record=worker.WorkerExecutionTiming(context,100,"2026-10-18T19:00:00+00:00")
            start=record.start();before=auth.read_json(context.reader,start)
            self.assertIsNone(before["endedAtUtc"]);self.assertIsNone(before["elapsedSeconds"])
            self.assertEqual(before["status"],"started")
            end=record.finish(ValueError("private first failure"));after=auth.read_json(auth.Reader(ROOT),end)
            self.assertEqual(after["elapsedSeconds"],4);self.assertIsNotNone(after["endedAtUtc"])
            self.assertEqual(after["status"],"failed_closed");self.assertIsNotNone(after["stopReason"])
            self.assertEqual(after["executionPackage"],PACKAGE);self.assertTrue(record.closed)
            with self.assertRaisesRegex(ValueError,"already closed"):record.finish()

    def test_worker_timing_replacement_failure_preserves_unknown_end_and_first_error(self):
        context=self.fixture();logical=context.plan["outputRoot"]
        with patch.dict(os.environ,{"DETAIL_WEIGHT_OUTPUT_ROOTS":json.dumps([logical])}),patch.object(worker.time,"monotonic",return_value=104):
            record=worker.WorkerExecutionTiming(context,100,"2026-10-18T19:00:00+00:00");start=record.start()
            first=PermissionError("private replace failure")
            with patch.object(worker.os,"replace",side_effect=first),self.assertRaises(PermissionError) as caught:record.finish()
            self.assertIs(caught.exception,first);self.assertEqual(record.binding,start)
            self.assertIsNone(auth.read_json(context.reader,start)["endedAtUtc"])
            self.assertFalse(record.closed)

    def test_worker_timing_retains_terminal_reserve(self):
        context=self.fixture();logical=context.plan["outputRoot"]
        with patch.dict(os.environ,{"DETAIL_WEIGHT_OUTPUT_ROOTS":json.dumps([logical]),"DETAIL_WEIGHT_OUTPUT_MAX":"65536"}):
            record=worker.WorkerExecutionTiming(context,time.monotonic(),"2026-10-18T19:00:00+00:00")
            with self.assertRaisesRegex(ValueError,"terminal reserve"):record.start()
            self.assertFalse(context.reader.path(record.logical).exists())

    def test_actual_worker_progress_factory_selects_null_only_for_own_completion_mode(self):
        context=self.fixture();plan=context.plan;logical=plan["outputRoot"]
        source_path="ml/ai-painter/src/ai_painter/complete_world/bounded_progress_publication_cpu_v2.py"
        source={"path":source_path,"sha256":hashlib.sha256((ROOT/source_path).read_bytes()).hexdigest()}
        guard=SimpleNamespace(seconds=None,started=time.monotonic()-9000)
        value={"epoch":1,"completedEpochs":0,"optimizerSteps":{"generator":1,"discriminator":1}}
        with patch.dict(os.environ,{"DETAIL_WEIGHT_OUTPUT_ROOTS":json.dumps([logical])}),patch.object(auth,"verify_progress_publication",return_value=source) as verified:
            publish=worker.progress_publisher(context.reader,plan,guard)
            self.assertEqual(publish(value,force=True),"published");verified.assert_called_once_with(context.reader,plan)
            actual=json.loads(context.reader.path(logical+"/progress.json").read_bytes())
            self.assertEqual(actual["capabilityVersion"],self.CAPABILITY)
            guard.seconds=8400
            with self.assertRaisesRegex(ValueError,"original progress execution deadline changed"):publish(value,force=True)

    def test_progress_publishes_committed_timing_without_model_or_gpu(self):
        context=self.fixture();plan=context.plan;logical=plan["outputRoot"]
        source_path="ml/ai-painter/src/ai_painter/complete_world/bounded_progress_publication_cpu_v2.py"
        source={"path":source_path,"sha256":hashlib.sha256((ROOT/source_path).read_bytes()).hexdigest()}
        guard=SimpleNamespace(seconds=None,started=time.monotonic())
        value={"epoch":1,"completedEpochs":0,"optimizerSteps":{"generator":1,"discriminator":2},
            "workerExecutionTiming":{"path":"untrusted-caller.json","sha256":"0"*64}}
        with patch.dict(os.environ,{"DETAIL_WEIGHT_OUTPUT_ROOTS":json.dumps([logical])}), \
                patch.object(auth,"verify_progress_publication",return_value=source), \
                patch.object(torch.cuda,"init",side_effect=AssertionError("GPU forbidden")), \
                patch.object(worker,"runtime_for_plan",side_effect=AssertionError("model forbidden")):
            timing=worker.WorkerExecutionTiming(context,guard.started,"2026-10-18T19:00:00+00:00")
            start=timing.start()
            publish=worker.progress_publisher(context.reader,plan,guard,worker_execution_timing=timing)
            self.assertEqual(publish(value,force=True),"published")
            actual=json.loads(context.reader.path(logical+"/progress.json").read_bytes())
            self.assertEqual(actual["workerExecutionTiming"],start)
            self.assertEqual((actual["optimizerStepsGenerator"],actual["optimizerStepsDiscriminator"]),(1,2))
            before=auth.read_json(auth.Reader(ROOT),actual["workerExecutionTiming"])
            self.assertEqual(before["status"],"started")
            self.assertIsNone(before["endedAtUtc"]);self.assertIsNone(before["elapsedSeconds"])
            end=timing.finish(ValueError("private first failure"))
            self.assertEqual(publish(value,state="failed_closed",force=True),"published")
            actual=json.loads(context.reader.path(logical+"/progress.json").read_bytes())
            self.assertEqual(actual["workerExecutionTiming"],end)
            after=auth.read_json(auth.Reader(ROOT),end)
            self.assertEqual(after["status"],"failed_closed");self.assertGreaterEqual(after["elapsedSeconds"],0)

    def test_progress_rejects_foreign_or_changed_timing_and_never_discovers_file(self):
        context=self.fixture();plan=context.plan;logical=plan["outputRoot"]
        source_path="ml/ai-painter/src/ai_painter/complete_world/bounded_progress_publication_cpu_v2.py"
        source={"path":source_path,"sha256":hashlib.sha256((ROOT/source_path).read_bytes()).hexdigest()}
        guard=SimpleNamespace(seconds=None,started=time.monotonic())
        value={"epoch":1,"completedEpochs":0,"optimizerSteps":{"generator":0,"discriminator":0}}
        with patch.dict(os.environ,{"DETAIL_WEIGHT_OUTPUT_ROOTS":json.dumps([logical])}), \
                patch.object(auth,"verify_progress_publication",return_value=source):
            timing=worker.WorkerExecutionTiming(context,guard.started,"2026-10-18T19:00:00+00:00")
            start=timing.start()
            publish=worker.progress_publisher(context.reader,plan,guard)
            self.assertEqual(publish({**value,"workerExecutionTiming":start},force=True),"published")
            self.assertNotIn("workerExecutionTiming",json.loads(context.reader.path(logical+"/progress.json").read_bytes()))
            for foreign in (SimpleNamespace(binding=start),worker.WorkerExecutionTiming(self.fixture(),guard.started,timing.started_at_utc)):
                with self.assertRaisesRegex(ValueError,"authenticated context"):
                    worker.progress_publisher(context.reader,plan,guard,worker_execution_timing=foreign)
            publish=worker.progress_publisher(context.reader,plan,guard,worker_execution_timing=timing)
            with context.reader.path(start["path"]).open("ab") as stream:stream.write(b"changed bytes")
            with self.assertRaises(ValueError):publish(value,force=True)
            self.assertNotIn("workerExecutionTiming",json.loads(context.reader.path(logical+"/progress.json").read_bytes()))


class CompletionV2AdmissionTests(CompletionAdmissionTests):
    CAPABILITY=codec.COMPLETION_V2_CAPABILITY

    def test_new_gpu_deadline_is_null_beyond720_but_disk_and_legacy_deadlines_remain(self):
        configuration,policy=self.configuration()
        plan={"capabilityVersion":self.CAPABILITY,"configuration":configuration,"outputRoot":OUTPUT}
        with patch.object(auth,"read_json",return_value=policy):guard=worker.ResourceGuard(PACKAGE,plan,started=0,gpu_gate=True)
        self.assertIsNone(guard.seconds)
        with patch.object(worker.time,"monotonic",return_value=9001),patch.object(worker,"runtime_for_plan",return_value=(torch,None,None)),patch.object(worker.shutil,"disk_usage",return_value=SimpleNamespace(free=0)):
            with self.assertRaisesRegex(ValueError,"disk safety floor"):guard()
        for cap in (auth.CAPABILITY,codec.COMPLETION_CAPABILITY):
            values=codec.execution_values(cap);preview={"path":values["preview_path"],"sha256":"a"*64}
            changed=codec.expected_configuration(preview,cap);changed.update(gpuAdmissionSeconds=None,gpuAdmissionWallMode="completion")
            with self.subTest(capability=cap),self.assertRaises(ValueError):codec.validate_configuration(changed)

    def test_qualification_timing_replace_beyond720_keeps_250ms_operation_and_first_error(self):
        context=self.fixture();directory=context.reader.path(context.plan["outputRoot"])
        pending=directory/"private-timing.pending";target=directory/"private-timing.json";pending.write_bytes(b'{}')
        record=object.__new__(qualifier.CoalescedQualificationObservation);record.started=time.monotonic()-9000;record.seconds=None
        record._replace(pending,target);self.assertEqual(target.read_bytes(),b'{}')
        pending.write_bytes(b'{}');record.seconds=720
        with self.assertRaisesRegex(TimeoutError,"timing replacement deadline exhausted"):record._replace(pending,target)
        self.assertTrue(pending.exists())
        record.seconds=None;first=PermissionError("private timing first failure");first.winerror=5
        with patch.object(record,"_stable"),patch.object(qualifier.os,"replace",side_effect=first),patch.object(qualifier.time,"sleep"):
            with self.assertRaises(PermissionError) as caught:record._replace(pending,target)
        self.assertIs(caught.exception,first)


class SameCallAdmissionTests(CompletionV2AdmissionTests):
    """Exercise the actual registered training identity, not its predecessor."""
    CAPABILITY=codec.SAME_CALL_CAPABILITY

    def test_actual_progress_factory_requires_authentication_before_component_or_write(self):
        from ai_painter.complete_world import bounded_progress_publication_cpu_v2 as publication
        context=self.fixture();guard=SimpleNamespace(seconds=None,started=time.monotonic())
        first=ValueError("private exact progress policy admission refused")
        with patch.object(auth,"verify_progress_publication",side_effect=first), \
                patch.object(publication,"BoundedProgressPublisher") as constructor:
            with self.assertRaises(ValueError) as caught:worker.progress_publisher(context.reader,context.plan,guard)
            self.assertIs(caught.exception,first);constructor.assert_not_called()
        self.assertFalse(context.reader.path(context.plan["outputRoot"]+"/progress.json").exists())

    def test_actual_progress_factory_rejects_component_digest_mismatch_before_write(self):
        context=self.fixture();guard=SimpleNamespace(seconds=None,started=time.monotonic())
        source={"path":"ml/ai-painter/src/ai_painter/complete_world/bounded_progress_publication_cpu_v2.py","sha256":"0"*64}
        with patch.object(auth,"verify_progress_publication",return_value=source):
            with self.assertRaisesRegex(ValueError,"actual imported progress component differs"):
                worker.progress_publisher(context.reader,context.plan,guard)
        self.assertFalse(context.reader.path(context.plan["outputRoot"]+"/progress.json").exists())


class RegisteredInterfaceAdmissionTests(SameCallAdmissionTests):
    """Actual current interface wiring, no model construction or CUDA calls."""
    def setUp(self):
        routes=codec.registered_training_interfaces()
        self.assertTrue(routes)
        self.CAPABILITY=getattr(type(self),'_registered_capability',routes[0]["capability"])
        self.assertIn(self.CAPABILITY,[row['capability'] for row in routes])

    def test_real_registered_progress_authentication_and_publication_without_model(self):
        context=self.fixture();plan=context.plan;configuration,policy=self.configuration()
        values=codec.execution_values(self.CAPABILITY)
        source_path="ml/ai-painter/src/ai_painter/complete_world/bounded_progress_publication_cpu_v2.py"
        source={"path":source_path,"sha256":hashlib.sha256((ROOT/source_path).read_bytes()).hexdigest()}
        plan.update(configuration=configuration,executionPolicy=values["policy"],interfacePolicy=values["policy"],
            entrypointSnapshot=values["entrypoint_snapshot"],programBindings={"progressPublication":source})
        logical=plan["outputRoot"];guard=SimpleNamespace(seconds=None,started=time.monotonic())
        with patch.dict(os.environ,{"DETAIL_WEIGHT_OUTPUT_ROOTS":json.dumps([logical])}), \
                patch.object(torch.cuda,"init",side_effect=AssertionError("GPU forbidden")), \
                patch.object(identity,"build_fresh_object_ecology_decode1_entry_weight_precision",side_effect=AssertionError("model construction forbidden")):
            publish=worker.progress_publisher(context.reader,plan,guard)
            self.assertEqual(publish({"epoch":1,"completedEpochs":0,"optimizerSteps":{"generator":0,"discriminator":0}},force=True),"published")
        recorded=json.loads(context.reader.path(logical+"/progress.json").read_bytes())
        self.assertEqual(recorded["capabilityVersion"],self.CAPABILITY)
        self.assertEqual((recorded["optimizerStepsGenerator"],recorded["optimizerStepsDiscriminator"]),(0,0))
        plan["entrypointSnapshot"]=dict(values["entrypoint_snapshot"],selection={})
        with self.assertRaisesRegex(ValueError,"frozen interface registration"):
            auth.verify_progress_publication(context.reader,plan)


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cpu-request")
    parser.add_argument("--sha256")
    args=parser.parse_args()
    worker.configure_cpu()
    if args.cpu_request:
        auth.require(args.sha256, "own bound CPU request required")
        print(json.dumps(cpu_request({"path":args.cpu_request,"sha256":args.sha256})))
    else:
        guards=ExitStack()
        # All component checkpoints remain strictly in-memory.
        original_load,original_save=torch.load,torch.save
        def memory_load(source,*args,**kwargs):
            assert isinstance(source,io.BytesIO), "filesystem weights prohibited"
            return original_load(source,*args,**kwargs)
        def memory_save(value,destination,*args,**kwargs):
            assert isinstance(destination,io.BytesIO), "filesystem checkpoints prohibited"
            return original_save(value,destination,*args,**kwargs)
        with guards:
            guards.enter_context(patch.object(torch,"load",side_effect=memory_load))
            guards.enter_context(patch.object(torch,"save",side_effect=memory_save))
            result=unittest.TextTestRunner(verbosity=2).run(component_suite())
        raise SystemExit(0 if result.wasSuccessful() and not result.skipped else 1)

