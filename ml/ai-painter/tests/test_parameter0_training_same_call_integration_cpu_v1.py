"""Synthetic CPU wiring tests; no real training, entry activation or GPU."""
import ast
from contextlib import ExitStack, contextmanager
from copy import deepcopy
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import psutil
_process=psutil.Process(); _process.cpu_affinity(_process.cpu_affinity()[:2])
ROOT=Path(__file__).absolute().parents[3]
for folder in ("ml/ai-painter/scripts","ml/ai-painter/src"):
    sys.path.insert(0,str(ROOT/folder))
import torch
from torch import nn
import painter_stage4_decode2_rgb_output_training_same_call_profile_v1 as wired
from ai_painter.complete_world import parameter0_training_same_call_bridge_v1 as bridge

SYNTHETIC_DETAILS=dict(mockedPairs=0,syntheticGScopes=0,syntheticParameterChanges=0)


def setUpModule():
    torch.set_num_threads(2)
    if torch.get_num_interop_threads()!=2: torch.set_num_interop_threads(2)
    if torch.cuda.is_initialized(): raise RuntimeError("CUDA forbidden")
    for obj,name in ((torch.nn.Module,"__call__"),(torch.autograd,"grad"),(torch.cuda,"_lazy_init"),(torch.optim.Optimizer,"__init__")):
        guard=patch.object(obj,name,side_effect=AssertionError("forbidden real computation/optimizer/CUDA"))
        guard.start();unittest.addModuleCleanup(guard.stop)


class DummyOptimizer:
    def zero_grad(self,**kwargs): pass


class SyntheticScope:
    def __init__(self,events): self.events=events;self.packet=None;self.outcome={};self.active=False
    def __enter__(self):
        self.active=True;self.events.append("enter");SYNTHETIC_DETAILS["syntheticGScopes"]+=1;return self
    def __call__(self,stage,label,rows): self.events.append("event:"+stage)
    def __exit__(self,kind,error,tb):
        self.active=False;self.events.append("exit")
        self.outcome={"status":"successful_g_released_without_capture"} if error is None else {"status":"same_call_capture_unavailable"}
        return False


class ProfileTests(unittest.TestCase):
    def tearDown(self): self.assertFalse(torch.cuda.is_initialized())

    def test_pair_numerical_body_is_bound_predecessor_with_only_g_scope(self):
        original_path=ROOT/bridge.PROFILE_SOURCE
        self.assertEqual(hashlib.sha256(original_path.read_bytes()).hexdigest(),bridge.PROFILE_SHA)
        old=next(n for n in ast.parse(original_path.read_bytes()).body if isinstance(n,ast.FunctionDef) and n.name=="perform_pair")
        new=next(n for n in ast.parse(Path(wired.__file__).read_bytes()).body if isinstance(n,ast.FunctionDef) and n.name=="perform_pair")
        class Normalize(ast.NodeTransformer):
            def visit_With(self,node):
                if isinstance(node.items[0].context_expr,ast.Call) and isinstance(node.items[0].context_expr.func,ast.Name) and node.items[0].context_expr.func.id=="_same_call_scope":
                    return [self.visit(n) for n in node.body]
                return self.generic_visit(node)
            def visit_Attribute(self,node):
                if isinstance(node.value,ast.Name) and node.value.id=="original" and node.attr=="_component_profile":
                    return ast.Name(id="_component_profile",ctx=ast.Load())
                return self.generic_visit(node)
        new=Normalize().visit(new)
        new.args.kwonlyargs.pop();new.args.kw_defaults.pop()
        self.assertEqual(ast.dump(new,include_attributes=False),ast.dump(old,include_attributes=False))

    def exercise(self,implementation,*,failure=None,observation_fault=None):
        events=[];scope=SyntheticScope(events)
        model=nn.Linear(1,1,bias=False);model.condition_channel_order=("x",)
        critic=nn.Linear(1,1,bias=False)
        counts=dict(generator=0,discriminator=0);ledger=dict(sampleId="s",generator=0,discriminator=0)
        primary=RuntimeError("original-"+str(failure))
        def forward(m,s,**kwargs):
            phase="G" if torch.is_grad_enabled() else "D"
            events.append(phase)
            self.assertEqual(scope.active,phase=="G" and implementation is wired.perform_pair and observation_fault != "constructor")
            if failure=="D" and phase=="D": raise primary
            return torch.tensor(2.)
        def update_d(*args): counts["discriminator"]+=1;events.append("Dcommit")
        def candidate(*args,**kwargs):
            self.assertEqual(kwargs.get("support_structure_weight"),1.0)
            events.append("gradients")
            callback=wired.gradient_bridge._OBSERVER.get()
            for label in bridge.capture.LABELS:
                events.append("vjp:"+label)
                if callback: callback("complete",label,())
            if failure=="G": raise primary
            return torch.tensor(3.),(),{}
        def commit(**kwargs):
            self.assertFalse(scope.active);events.append("Gcommit")
            if failure=="commit": raise primary
            counts["generator"]+=1
        api=wired.original
        with ExitStack() as stack:
            for obj,name,replacement in (
                (api,"_bound_device",lambda m,s:s),(api,"sample_forward",forward),
                (api,"_generator_candidate",candidate),
                (wired.inherited.v24,"_critic_mode_snapshot",lambda c:()),
                (wired.inherited.v24,"_restore_critic_mode_snapshot",lambda e:None),
                (wired.inherited.v24,"_require_critic_phase",lambda *a,**k:None)):
                stack.enter_context(patch.object(obj,name,replacement))
            for module in ({wired,api}):
                for name,replacement in (
                    ("_phase",lambda *a:None),("_critic_state",lambda c:"frozen"),
                    ("_d_objective",lambda *a:(torch.tensor(1.),{})),
                    ("_update_discriminator",update_d),("commit_generator_step",commit)):
                    stack.enter_context(patch.object(module,name,replacement))
            def factory(*args):
                if observation_fault == "constructor": raise RuntimeError("synthetic constructor failure")
                return scope
            kwargs={} if implementation is api.perform_pair else dict(same_call_context=factory)
            if observation_fault == "observer":
                class Unavailable(SyntheticScope):
                    def __exit__(self,*args):
                        super().__exit__(*args)
                        self.outcome={"status":"same_call_capture_unavailable","reason":"synthetic hook failure"}
                        return False
                scope=Unavailable(events)
            result=error=None
            try: result=implementation(model,critic,{"sampleId":"s","split":"train"},("x",),DummyOptimizer(),DummyOptimizer(),counts,ledger,lambda:None,None,support_structure_weight=1.0,**kwargs)
            except BaseException as caught: error=caught
        SYNTHETIC_DETAILS["mockedPairs"]+=1
        if failure:self.assertIs(error,primary)
        elif observation_fault:
            self.assertIsNotNone(error)
            self.assertEqual(counts,dict(generator=0,discriminator=1))
            self.assertEqual(events.count("G"),1)
            self.assertEqual(events.count("gradients"),1)
            self.assertEqual([v[4:] for v in events if v.startswith("vjp:")],list(bridge.capture.LABELS))
            self.assertNotIn("Gcommit",events)
        else:self.assertIsNone(error)
        return events,counts,ledger,result,error,scope

    def test_boundaries_and_original_numerical_schedule_match(self):
        old=self.exercise(wired.original.perform_pair)
        new=self.exercise(wired.perform_pair)
        filtered=[e for e in new[0] if e not in ("enter","exit") and not e.startswith("event:")]
        self.assertEqual(old[0],filtered)
        self.assertEqual(old[1:4],new[1:4])
        self.assertLess(new[0].index("Dcommit"),new[0].index("enter"))
        self.assertLess(new[0].index("exit"),new[0].index("Gcommit"))

    def test_all_failure_exits_keep_primary_and_release_before_commit(self):
        for failure in ("D","G","commit"):
            with self.subTest(failure=failure):
                events,counts,ledger,result,error,scope=self.exercise(wired.perform_pair,failure=failure)
                self.assertFalse(scope.active)
                if failure=="D":self.assertNotIn("enter",events)
                if failure=="G":self.assertNotIn("Gcommit",events)
                self.assertEqual(counts["generator"],0)

    def test_two_independent_successful_pairs_do_not_keep_context(self):
        for _ in range(2):
            row=self.exercise(wired.perform_pair)
            self.assertFalse(row[-1].active)
            self.assertEqual(row[1],dict(generator=1,discriminator=1))

    def test_observation_faults_run_original_g_then_stop_before_commit(self):
        for fault in ("constructor","observer"):
            with self.subTest(fault=fault):
                row=self.exercise(wired.perform_pair,observation_fault=fault)
                self.assertEqual(row[4].parameter0_same_call_outcome["status"],"same_call_capture_unavailable")
                self.assertFalse(row[-1].active)

    def test_observation_faults_do_not_replace_original_g_failure(self):
        for fault in ("constructor","observer"):
            with self.subTest(fault=fault):
                self.exercise(wired.perform_pair,failure="G",observation_fault=fault)

    def test_no_context_uses_original_observer_unchanged(self):
        seen=[]
        with wired.gradient_bridge.observe_generator_gradients(lambda *args:seen.append(args)):
            original=wired.gradient_bridge._OBSERVER.get()
            with wired._same_call_scope(None,None,None,None,None):
                self.assertIs(wired.gradient_bridge._OBSERVER.get(),original)
        self.assertIsNone(wired.gradient_bridge._OBSERVER.get())

    def test_existing_gradient_observer_is_composed_and_reset(self):
        events=[];scope=SyntheticScope(events);seen=[]
        with wired.gradient_bridge.observe_generator_gradients(lambda *a:seen.append(a)):
            outer=wired.gradient_bridge._OBSERVER.get()
            with wired._same_call_scope(lambda *a:scope,None,None,{},lambda:None):
                wired.gradient_bridge._OBSERVER.get()("complete","label",())
            self.assertIs(wired.gradient_bridge._OBSERVER.get(),outer)
        self.assertEqual(len(seen),1);self.assertIn("event:complete",events)

    def test_bridge_refuses_untyped_or_inactive_execution_context(self):
        with self.assertRaises(ValueError): bridge.TrainingSameCallBridge(object(),[],None,plan_binding={},execution_binding={})
        context=bridge.auth.Context(object(),{}, {}, {})
        failure=RuntimeError("inactive")
        with patch.object(bridge.auth,"verify_live_context",side_effect=failure) as check:
            with self.assertRaises(RuntimeError) as caught:bridge.TrainingSameCallBridge(context,[],None,plan_binding={},execution_binding={})
        self.assertIs(caught.exception,failure);check.assert_called_once_with(context,expected_phase="training")

    def test_source_role_collision_rejected(self):
        a=dict(path="x.py",sha256="a"*64);b=dict(path="x.py",sha256="b"*64)
        with self.assertRaises(ValueError):bridge._unique_bindings(dict(a=a,b=b))





class BridgeBindingTests(unittest.TestCase):
    capability = bridge.CAPABILITY
    def fixture(self):
        from types import SimpleNamespace
        class Reader:
            root=ROOT
            def __init__(self):self.values={};self.mapping=object()
            def add(self,path,value):
                raw=value if type(value) is bytes else json.dumps(value,sort_keys=True).encode()
                self.values[path]=raw
                return dict(path=path,sha256=hashlib.sha256(raw).hexdigest())
            def read(self,binding):
                raw=self.values[binding["path"]]
                if hashlib.sha256(raw).hexdigest()!=binding["sha256"]:raise ValueError("fixture binding changed")
                return raw
            def json(self,binding):return json.loads(self.read(binding))
            def unchanged(self):pass
        reader=Reader();programs={}
        logicals={bridge.PROFILE_SOURCE,*bridge.REQUIRED,*(p for p,s in bridge.capture.SOURCE_BINDINGS)}
        for i,path in enumerate(sorted(logicals)):programs[str(i)]=reader.add(path,(ROOT/path).read_bytes())
        model_binding=reader.add("model.json",{"graph":[],"modelCapabilityVersion":bridge.MODEL_CAPABILITY})
        image=reader.add("image.synthetic",b"not a real image")
        condition=reader.add("condition.synthetic",b"not real conditions")
        train=[]
        for i in range(48):
            identity=dict(sampleId=bridge.SAMPLE_ID if i==8 else "sample-"+str(i),split="train",image=image,conditionPack=condition)
            train.append(dict(sampleId=identity["sampleId"],split="train",_ecology_regime_binding=SimpleNamespace(reader=reader,identity_json=json.dumps(identity))))
        split=reader.add("train.json",dict(split="train",sampleIds=[s["sampleId"] for s in train]))
        plan=dict(outputRoot=".runtime/synthetic-wiring",runId="synthetic-run",packageId="synthetic-package",
            capabilityVersion=self.capability,
            configuration={"seed":20260929,"objectSupportStructureWeight":1,"capabilityVersion":self.capability,"modelCapabilityVersion":bridge.MODEL_CAPABILITY},programBindings=programs,modelBinding=model_binding,trainSplit=split)
        plan_binding=reader.add(plan["outputRoot"]+"/quality-plan.json",plan)
        package=dict(outputRoot=plan["outputRoot"],packageIdentity=plan["packageId"],inputEvidence=[plan_binding])
        package_binding=reader.add("package.json",package)
        ticket=reader.add(plan["outputRoot"]+"/capture-execution.json",dict(schema="object-support-structure-failure-capture-execution-v1",
            runId=plan["runId"],outputRoot=plan["outputRoot"],executionPackage=package_binding,
            programBindings=programs,modelBinding=model_binding))
        return bridge.auth.Context(reader,package_binding,package,plan),train,object(),plan_binding,ticket

    def construct(self,fixture):
        context,train,model,plan,ticket=fixture
        with patch.object(bridge.auth,"verify_live_context") as check,patch.object(bridge.profile.original,"validate_sample_ecology"):
            result=bridge.TrainingSameCallBridge(context,train,model,plan_binding=plan,execution_binding=ticket)
        check.assert_called_once_with(context,expected_phase="training")
        return result

    def test_bound_plan_split_and_reader_derive_step_labels_not_caller_claims(self):
        fixture=self.fixture();context,train,model,plan,ticket=fixture
        runner=self.construct(fixture)
        import random
        indexes=list(range(48));random.Random(20260930).shuffle(indexes)
        sample=train[indexes[14]]
        with patch.object(bridge.profile.original,"validate_sample_ecology"),patch.object(bridge.capture,"Parameter0TrainingSameCallCapture",return_value="synthetic") as create:
            self.assertEqual(runner.same_call_context(model,sample,dict(generator=14,discriminator=15),lambda:None),"synthetic")
            identity=create.call_args.kwargs["identity"]
            self.assertEqual(identity["runId"],context.plan["runId"])
            self.assertEqual(identity["trainIndex"],indexes[14]);self.assertEqual(identity["epoch"],1)
            with self.assertRaises(ValueError):runner.same_call_context(model,sample,dict(generator=14,discriminator=14),lambda:None)
            with self.assertRaises(ValueError):runner.same_call_context(object(),sample,dict(generator=14,discriminator=15),lambda:None)
            with self.assertRaises(ValueError):runner.same_call_context(model,train[indexes[1]],dict(generator=14,discriminator=15),lambda:None)

    def test_changed_split_source_digest_and_foreign_sample_reader_reject(self):
        fixture=self.fixture();context,train,model,plan,ticket=fixture
        with patch.object(bridge.auth,"verify_live_context"),patch.object(bridge.profile.original,"validate_sample_ecology"):
            with self.assertRaises(ValueError):bridge.TrainingSameCallBridge(context,list(reversed(train)),model,plan_binding=plan,execution_binding=ticket)
            train[0]["_ecology_regime_binding"].reader=object()
            with self.assertRaises(ValueError):bridge.TrainingSameCallBridge(context,train,model,plan_binding=plan,execution_binding=ticket)
        fixture=self.fixture();context,train,model,plan,ticket=fixture
        b=context.plan["programBindings"][next(k for k,v in context.plan["programBindings"].items() if v["path"]==bridge.REQUIRED[0])]
        context.reader.values[b["path"]]+=b"# changed"
        with patch.object(bridge.auth,"verify_live_context"),patch.object(bridge.profile.original,"validate_sample_ecology"):
            with self.assertRaises(ValueError):bridge.TrainingSameCallBridge(context,train,model,plan_binding=plan,execution_binding=ticket)

    def test_capture_sink_still_delegates_original_error_when_live_recheck_fails(self):
        fixture=self.fixture();context,train,model,plan,ticket=fixture
        runner=self.construct(fixture);error=RuntimeError("original training error");runner.last_failure=error
        error.parameter0_same_call_packet=object()
        from ai_painter.complete_world import parameter0_training_same_call_storage_v1 as storage
        with patch.object(bridge.auth,"verify_live_context",side_effect=ValueError("stale binding")),patch.object(storage,"save_same_call_failure",return_value={"status":"capture_incomplete"}) as save:
            result=runner.capture_sink(error,model=model,critic=object(),context={})
        self.assertIs(save.call_args.args[0],error)
        self.assertIsNone(save.call_args.kwargs["packet"])
        self.assertEqual(result["sameCallBridgeSecondaryFailures"][0]["message"],"stale binding")




class AdditionalContractTests(BridgeBindingTests):
    def test_non_target_steps_never_install_or_read_sample(self):
        fixture=self.fixture();runner=self.construct(fixture)
        with patch.object(runner,"_sample_identity",side_effect=AssertionError("non-target source read")), patch.object(bridge.capture,"Parameter0TrainingSameCallCapture") as create:
            for g in (0,13,15,62,1151):
                self.assertIsNone(runner.same_call_context(fixture[2],{},dict(generator=g,discriminator=g+1),lambda:None))
        create.assert_not_called()

    def test_target_is_one_shot_even_if_constructor_fails(self):
        f=self.fixture();runner=self.construct(f)
        with patch.object(bridge.profile.original,"validate_sample_ecology"),patch.object(bridge.capture,"Parameter0TrainingSameCallCapture",side_effect=ValueError("observer-constructor")) as create:
            with self.assertRaisesRegex(ValueError,"observer-constructor"):
                runner.same_call_context(f[2],f[1][8],dict(generator=14,discriminator=15),lambda:None)
            with self.assertRaisesRegex(ValueError,"already consumed"):
                runner.same_call_context(f[2],f[1][8],dict(generator=14,discriminator=15),lambda:None)
        self.assertEqual(create.call_count,1)

    def test_constructor_observation_fault_preserves_original_g_error(self):
        primary=ValueError("original gate")
        def create(*args):raise RuntimeError("capture unavailable")
        with self.assertRaises(ValueError) as caught:
            with wired._same_call_scope(create,None,None,{},lambda:None):raise primary
        self.assertIs(caught.exception,primary)
        self.assertEqual(str(primary),"original gate")
        self.assertIn("capture unavailable",primary.parameter0_same_call_outcome["reason"])

    def test_constructor_resource_and_control_faults_propagate(self):
        for primary in (RuntimeError("resource"),KeyboardInterrupt("stop")):
            def resource():raise primary
            def create(*args):args[-1]()
            with self.assertRaises(type(primary)) as caught:
                with wired._same_call_scope(create,None,None,{},resource):self.fail("must not run G")
            self.assertIs(caught.exception,primary)

    def test_none_factory_result_keeps_original_observer(self):
        callback=lambda *args:None
        with wired.gradient_bridge.observe_generator_gradients(callback):
            with wired._same_call_scope(lambda *args:None,None,None,{},lambda:None):
                self.assertIs(wired.gradient_bridge._OBSERVER.get(),callback)

    def test_actual_bridge_pair_forces_weight1_and_rejects_caller_override(self):
        f=self.fixture();runner=self.construct(f)
        with patch.object(bridge.profile,"perform_pair",return_value="synthetic") as call:
            self.assertEqual(runner.pair_runner(f[2]),"synthetic")
            self.assertEqual(call.call_args.kwargs["support_structure_weight"],1.0)
            self.assertEqual(call.call_args.kwargs["same_call_context"],runner.same_call_context)
            for key,value in (("components",None),("same_call_context",None),("support_structure_weight",1.0)):
                with self.assertRaises(ValueError):runner.pair_runner(f[2],**{key:value})

    def test_duplicate_same_digest_source_rejected(self):
        b=dict(path="x",sha256="a"*64)
        with self.assertRaises(ValueError):bridge._unique_bindings(dict(a=b,b=b))

    def test_real_worker_dispatch_selects_exact_three_callbacks(self):
        import painter_stage4_decode1_entry_weight_quality_worker_v1 as worker
        from types import SimpleNamespace
        fake=SimpleNamespace(pair_runner=object(),capture_sink=object(),sample_context=object())
        f=self.fixture()
        with patch.object(bridge,"TrainingSameCallBridge",return_value=fake) as create:
            value=worker.training_loop_callbacks(f[0],f[1],f[2],profile=object(),plan_binding=f[3],execution_binding=f[4],preview=None,capture_sink=None,context_for_sample=None)
        self.assertEqual(value,dict(pair_runner=fake.pair_runner,capture_sink=fake.capture_sink,context_for_sample=fake.sample_context))
        create.assert_called_once()



class V2BridgeBindingTests(AdditionalContractTests):
    capability = bridge.CAPABILITIES[1]

    def test_v2_rejects_mixed_or_unknown_execution_identity(self):
        for wrong in (bridge.CAPABILITY, "unknown_training_capture"):
            fixture=self.fixture();context=fixture[0]
            context.plan["configuration"]["capabilityVersion"]=wrong
            with self.subTest(wrong=wrong),self.assertRaisesRegex(ValueError,"exact RGB capture"):
                self.construct(fixture)

class V3BridgeBindingTests(V2BridgeBindingTests):
    capability = bridge.CAPABILITIES[2]

    def test_v3_rejects_v2_execution_identity(self):
        fixture=self.fixture();fixture[0].plan["configuration"]["capabilityVersion"]=bridge.CAPABILITIES[1]
        with self.assertRaisesRegex(ValueError,"exact RGB capture"):
            self.construct(fixture)


class V4BridgeBindingTests(V3BridgeBindingTests):
    capability = bridge.CAPABILITIES[3]

    def test_v4_rejects_v3_execution_identity(self):
        fixture=self.fixture();fixture[0].plan["configuration"]["capabilityVersion"]=bridge.CAPABILITIES[2]
        with self.assertRaisesRegex(ValueError,"exact RGB capture"):
            self.construct(fixture)


class V5BridgeBindingTests(V4BridgeBindingTests):
    capability = bridge.CAPABILITIES[4]

    def test_v5_rejects_v4_execution_identity(self):
        fixture=self.fixture();fixture[0].plan["configuration"]["capabilityVersion"]=bridge.CAPABILITIES[3]
        with self.assertRaisesRegex(ValueError,"exact RGB capture"):
            self.construct(fixture)


if __name__ == "__main__":unittest.main()
