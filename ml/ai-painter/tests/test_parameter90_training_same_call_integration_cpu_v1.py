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
import painter_stage4_decode1_entry_same_call_training_profile_v1 as wired
from ai_painter.complete_world import parameter90_training_same_call_bridge_v1 as bridge

SYNTHETIC_DETAILS=dict(mockedPairs=0,syntheticGScopes=0,syntheticParameterChanges=0)


def setUpModule():
    torch.set_num_threads(2)
    if torch.get_num_interop_threads()!=2: torch.set_num_interop_threads(2)
    if torch.cuda.is_initialized(): raise RuntimeError("CUDA forbidden")


class DummyOptimizer:
    def zero_grad(self,**kwargs): pass


class SyntheticScope:
    def __init__(self,events): self.events=events;self.packet=None;self.outcome={};self.active=False
    def __enter__(self):
        self.active=True;self.events.append("enter");SYNTHETIC_DETAILS["syntheticGScopes"]+=1;return self
    def __call__(self,stage,label,rows): self.events.append("event:"+stage)
    def __exit__(self,kind,error,tb): self.active=False;self.events.append("exit");return False


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

    def exercise(self,implementation,*,failure=None):
        events=[];scope=SyntheticScope(events)
        model=nn.Linear(1,1,bias=False);model.condition_channel_order=("x",)
        critic=nn.Linear(1,1,bias=False)
        counts=dict(generator=0,discriminator=0);ledger=dict(sampleId="s",generator=0,discriminator=0)
        primary=RuntimeError("original-"+str(failure))
        def forward(m,s,**kwargs):
            phase="G" if torch.is_grad_enabled() else "D"
            events.append(phase)
            self.assertEqual(scope.active,phase=="G" and implementation is wired.perform_pair)
            if failure=="D" and phase=="D": raise primary
            return torch.tensor(2.)
        def update_d(*args): counts["discriminator"]+=1;events.append("Dcommit")
        def candidate(*args):
            events.append("gradients")
            callback=wired.gradient_bridge._OBSERVER.get()
            if callback:
                for label in bridge.capture.LABELS: callback("complete",label,())
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
            kwargs={} if implementation is api.perform_pair else dict(same_call_context=lambda *a:scope)
            result=error=None
            try: result=implementation(model,critic,{"sampleId":"s","split":"train"},("x",),DummyOptimizer(),DummyOptimizer(),counts,ledger,lambda:None,None,**kwargs)
            except BaseException as caught: error=caught
        SYNTHETIC_DETAILS["mockedPairs"]+=1
        if failure:self.assertIs(error,primary)
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

    def test_lifecycle_wiring_uses_existing_three_callbacks_without_starting(self):
        import painter_stage4_decode1_entry_weight_lifecycle_v1 as lifecycle
        context=bridge.auth.Context(None,{"path":"package","sha256":"a"*64},{},dict(configuration={"seed":1}))
        fake=type("Bridge",(),dict(pair_runner=lambda self:None,capture_sink=lambda self:None,sample_context=lambda self:None))()
        with patch.object(bridge,"TrainingSameCallBridge",return_value=fake) as create,patch.object(lifecycle,"training_loop",return_value="synthetic") as run:
            result=bridge.training_loop_with_same_call_capture(context=context,model=object(),critic=object(),train=[],validation=[],order=(),plan_binding={},execution_binding={},resource=lambda:None,checkpoint_sink=lambda:None,progress_sink=lambda:None)
        self.assertEqual(result,"synthetic");create.assert_called_once()
        for key,method in (("pair_runner",fake.pair_runner),("capture_sink",fake.capture_sink),("context_for_sample",fake.sample_context)):
            self.assertEqual(run.call_args.kwargs[key],method)
        self.assertEqual(run.call_args.kwargs["plan"],context.plan)




class BridgeBindingTests(unittest.TestCase):
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
        model_binding=reader.add("model.json",{"graph":[]})
        image=reader.add("image.synthetic",b"not a real image")
        condition=reader.add("condition.synthetic",b"not real conditions")
        train=[]
        for i in range(48):
            identity=dict(sampleId="sample-"+str(i),split="train",image=image,conditionPack=condition)
            train.append(dict(sampleId=identity["sampleId"],split="train",_ecology_regime_binding=SimpleNamespace(reader=reader,identity_json=json.dumps(identity))))
        split=reader.add("train.json",dict(split="train",sampleIds=[s["sampleId"] for s in train]))
        plan=dict(outputRoot=".runtime/synthetic-wiring",runId="synthetic-run",packageId="synthetic-package",
            configuration={"seed":1},programBindings=programs,modelBinding=model_binding,trainSplit=split)
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
        indexes=list(range(48));random.Random(2).shuffle(indexes)
        sample=train[indexes[0]]
        with patch.object(bridge.profile.original,"validate_sample_ecology"),patch.object(bridge.capture,"Parameter90TrainingSameCallCapture",return_value="synthetic") as create:
            self.assertEqual(runner.same_call_context(model,sample,dict(generator=0,discriminator=1),lambda:None),"synthetic")
            identity=create.call_args.kwargs["identity"]
            self.assertEqual(identity["runId"],context.plan["runId"])
            self.assertEqual(identity["trainIndex"],indexes[0]);self.assertEqual(identity["epoch"],1)
            with self.assertRaises(ValueError):runner.same_call_context(model,sample,dict(generator=0,discriminator=0),lambda:None)
            with self.assertRaises(ValueError):runner.same_call_context(object(),sample,dict(generator=0,discriminator=1),lambda:None)
            with self.assertRaises(ValueError):runner.same_call_context(model,train[indexes[1]],dict(generator=0,discriminator=1),lambda:None)

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
        error.parameter90_same_call_packet=object()
        from ai_painter.complete_world import parameter90_training_same_call_storage_v1 as storage
        with patch.object(bridge.auth,"verify_live_context",side_effect=ValueError("stale binding")),patch.object(storage,"save_same_call_failure",return_value={"status":"capture_incomplete"}) as save:
            result=runner.capture_sink(error,model=model,critic=object(),context={})
        self.assertIs(save.call_args.args[0],error)
        self.assertIsNone(save.call_args.kwargs["packet"])
        self.assertEqual(result["sameCallBridgeSecondaryFailures"][0]["message"],"stale binding")



class CpuDriverContractTests(unittest.TestCase):
    def test_fixed_cpu_integration_contract_rejects_omitted_suite_or_drift(self):
        import importlib.util
        path=ROOT/"ml/ai-painter/scripts/check_parameter90_training_same_call_integration_cpu_v1.py"
        spec=importlib.util.spec_from_file_location("parameter90_integration_worker_contract",path)
        worker=importlib.util.module_from_spec(spec);sys.modules[spec.name]=worker;spec.loader.exec_module(worker)
        bind=lambda p:dict(path=p,sha256="a"*64)
        sources={worker.DRIVER,worker.COMPONENT,worker.TEST,worker.LOADER,*worker.EXTRA_TESTS,
            "ml/ai-painter/scripts/check_parameter90_training_same_call_capture_cpu_v1.py",
            "ml/ai-painter/scripts/painter_stage4_decode1_entry_same_call_training_profile_v1.py",
            "ml/ai-painter/src/ai_painter/complete_world/parameter90_training_same_call_bridge_v1.py",
            "ml/ai-painter/src/ai_painter/complete_world/parameter90_training_same_call_storage_v1.py"}
        policy=dict(schemaVersion="ai-painter-parameter90-training-same-call-integration-cpu-policy-v1",
            status="registered_cpu_integration_validation_only",scope="training_same_call_integration_synthetic_cpu_only",
            formalSpecification=deepcopy(worker.SPEC),designBinding=deepcopy(worker.DESIGN),
            resources=deepcopy(worker.LIMITS),captureBudget=deepcopy(worker.CAPTURE_BUDGET),
            target=deepcopy(worker.TARGET),outputRoot=worker.OUTPUT,
            comparison=dict(atol=1e-6,rtol=1e-5,gradientLabels=list(bridge.capture.LABELS),
                fp32Order="(((structured.float()+whole.float()).float()+core.float()).float()+support.float())",originalGateKept=True),
            executionBoundary=dict(syntheticCpuOnly=True,gpu=False,training=False,productionIntegrated=False,oldRunReplay=False,originalDataRead=False),
            executionHost=bind("scripts/check-ai-painter-parameter90-training-same-call-integration-cpu-v1.mjs"),
            executionHostTests=bind("scripts/tests/ai-painter-parameter90-training-same-call-integration-cpu-v1.test.mjs"),
            programBindings=[bind(p) for p in sorted(sources)],
            containmentProgramBindings={k:bind("private/"+k) for k in ("owner","nativeBridge","nativeOwnerSource","pathResolver","storageConfiguration","operatorSession","candidateRegistration")},
            interpreter=dict(absolutePath=str(ROOT/"ml/ai-painter/.venv/Scripts/python.exe"),sha256="a"*64))
        self.assertTrue(worker.validate_policy(policy))
        for logical in sources:
            value=deepcopy(policy);value["programBindings"]=[b for b in value["programBindings"] if b["path"]!=logical]
            with self.assertRaises(ValueError):worker.validate_policy(value)
        for key in worker.LIMITS:
            value=deepcopy(policy);value["resources"][key]+=1
            with self.assertRaises(ValueError):worker.validate_policy(value)
        value=deepcopy(policy);value["executionBoundary"]["training"]=True
        with self.assertRaises(ValueError):worker.validate_policy(value)

if __name__=="__main__": unittest.main()

