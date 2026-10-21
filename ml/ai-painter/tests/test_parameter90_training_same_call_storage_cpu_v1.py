"""Private synthetic storage tests, not an authenticated real training fixture.

Packets are explicitly injected through the component's private unit mechanism;
its genuine gate/bridge proof is tested in the separately frozen component suite.
Here the real old snapshot/codec/writer/verifier run on synthetic tensors only.
"""
import copy
import gzip
import json
import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

import psutil
_process = psutil.Process()
_process.cpu_affinity(_process.cpu_affinity()[:2])
assert 0 < len(_process.cpu_affinity()) <= 2
ROOT = Path(__file__).absolute().parents[3]
import sys
sys.path.insert(0,str(ROOT/"ml/ai-painter/src"))
import torch
from torch import nn
from ai_painter.complete_world import parameter90_training_same_call_storage_v1 as storage
from ai_painter.complete_world import parameter90_training_same_call_capture_v1 as component
from ai_painter.complete_world import object_support_structure_failure_capture_v1 as capture
from ai_painter.complete_world.object_appearance_regime_bias_precision import PrecisionFinalRGBConv

SYNTHETIC_DETAILS = dict(realModelForwards=0,realModelAutogradCalls=0,optimizerSteps=0,
    toyForwards=0,toyAutogradCalls=0,privateInjectedPackets=0,genuineComponentPackets=0,
    realOriginalWriterCalls=0,realOriginalVerifierCalls=0)


def setUpModule():
    torch.set_num_threads(2)
    if torch.get_num_interop_threads() != 2: torch.set_num_interop_threads(2)
    if torch.cuda.is_initialized(): raise RuntimeError("CUDA forbidden")


class Fixture:
    def __init__(self,base):
        self.project = base/"project"
        self.project.mkdir()
        self.data = base/"data"
        (self.data/"hot/runtime").mkdir(parents=True)
        self.env = patch.dict(os.environ,AI_PET_WORLD_DATA_ROOT=str(self.data))
        self.env.start()
        self.mapping = capture.RuntimeMap.current(self.project)
        self.output_root = ".runtime/synthetic-new-run"
        self.mapping.path(self.output_root).mkdir()
        self.output = self.output_root+"/gradient-failure"
        self.model = nn.Module()
        self.model.prefix = nn.ParameterList([nn.Parameter(torch.zeros(2242435))]+
                                            [nn.Parameter(torch.zeros(1)) for _ in range(89)])
        node = self.model
        parts = component.TARGET_MODULE.split(".")
        for part in parts[:-1]:
            node.add_module(part,nn.Module()); node = node._modules[part]
        convolution = PrecisionFinalRGBConv(nn.Conv2d(48,3,1))
        with torch.no_grad():
            convolution.weight.zero_(); convolution.bias.zero_()
        node.add_module(parts[-1],convolution)
        self.model.suffix = nn.ParameterList([nn.Parameter(torch.zeros(1)) for _ in range(16)])
        self.critic = nn.Linear(1,1)
        self.graph = [dict(name=n,shape=list(p.shape),dtype=str(p.dtype),elements=p.numel())
                      for n,p in self.model.named_parameters()]
        self.programs = {}
        for i,binding in enumerate(component.required_source_bindings()):
            self.programs[str(i)] = self.put(binding["path"],(ROOT/binding["path"]).read_bytes())
        self.programs["storage"] = self.put("storage.py",Path(storage.__file__).read_bytes())
        self.model_binding = self.put("model.json",dict(graph=self.graph))
        self.source = self.put("synthetic-source.bin",b"not a real image")
        self.condition = self.put("synthetic-condition.json",dict(synthetic=True))
        self.record = dict(sampleId="synthetic-train-0",split="train",image=self.source,conditionPack=self.condition)
        self.index = self.put("source-index.json",dict(samples=[self.record]))
        self.dataset = self.put("dataset.json",dict(sourceIndex=self.index))
        self.split = self.put("train.json",dict(split="train",sampleIds=["synthetic-train-"+str(i) for i in range(48)]))
        self.plan = dict(schema="object-support-structure-quality-plan-v1",runId="synthetic-new-run",
            packageId="synthetic-package",capabilityVersion="synthetic-storage-no-activation",
            outputRoot=self.output_root,programBindings=self.programs,modelBinding=self.model_binding,
            trainSplit=self.split,datasetManifest=self.dataset)
        self.plan_binding = self.put(self.output_root+"/quality-plan.json",self.plan)
        self.package = dict(schemaVersion="ai-painter-autonomous-closed-loop-package-v1",packageIdentity="synthetic-package",
            capabilityVersion=self.plan["capabilityVersion"],outputRoot=self.output_root,
            programLineage={k:v["sha256"] for k,v in self.programs.items()},inputEvidence=[self.plan_binding])
        self.package_binding = self.put("package.json",self.package)
        self.ticket = dict(schema="object-support-structure-failure-capture-execution-v1",runId=self.plan["runId"],
            outputRoot=self.output_root,modelBinding=self.model_binding,programBindings=self.programs,
            executionPackage=self.package_binding)
        self.ticket_binding = self.put(self.output_root+"/capture-execution.json",self.ticket)
        self.context = dict(runId=self.plan["runId"],sampleId="synthetic-train-0",split="train",sampleIdentity=self.record,
            sampleBindings=dict(source=self.source,condition=self.condition),modelBinding=self.model_binding,
            programBindings=self.programs,executionPackage=self.package_binding,
            failurePosition=dict(epoch=1,zeroBasedEpochPosition=0,trainIndex=0,sampleId="synthetic-train-0"),
            optimizerSteps=dict(generator=0,discriminator=1))
        self.error = ValueError("actual four-term total gradient identity differs at parameter 90")
        self.rows = []
        for value in (10,1,2,3,4):
            rows = [None]*108
            rows[90] = torch.full((3,48,1,1),float(value))
            self.rows.append(rows)
        self.rows[0][90][0,1,0,0] += .01
        self.error.object_support_gradient_evidence = dict(parameterNames=[r["name"] for r in self.graph],
            componentsInOrder=list(component.LABELS),rawGradients=self.rows,gradientSetsAvailable=5)

    def put(self,logical,value):
        raw = value if type(value) is bytes else capture.json_bytes(value)
        path = self.mapping.path(logical)
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_bytes(raw)
        return dict(path=logical,sha256=capture.digest(raw))

    def packet(self,change=None):
        identity = dict(runId=self.plan["runId"],packageId=self.plan["packageId"],sampleId=self.context["sampleId"],
            epoch=1,zeroBasedEpochPosition=0,trainIndex=0,optimizerSteps=self.context["optimizerSteps"],
            modelBinding=self.model_binding)
        metadata = dict(schemaVersion="parameter90-training-same-call-capture-v1",identity=copy.deepcopy(identity),
            target=dict(parameterIndex=90,parameterName=component.TARGET_NAME,shape=[3,48,1,1],coordinate=[0,1,0,0],
                        inputChannel=1,outputChannel=0),productionGeometryVerified=True,
            originalFailure=dict(type="ValueError",message=str(self.error),sourceBindings=component.required_source_bindings()),
            graphSha256=capture.digest(component._json(self.graph)),fixtureMeaning="private_injected_packet_not_training_trace")
        if change: change(metadata)
        tensors = dict(input=torch.zeros(1,1,192,256),weightWitness=self.model.get_parameter(component.TARGET_NAME).detach().clone())
        tensors.update({"adjoint."+label:torch.ones(1,1,192,256) for label in component.LABELS})
        tensors.update({"gradient."+label:rows[90].clone() for label,rows in zip(component.LABELS,self.rows)})
        SYNTHETIC_DETAILS["privateInjectedPackets"] += 1
        return component._issue_packet(metadata,tensors)

    def save(self,packet,**overrides):
        options = dict(packet=packet,model=self.model,critic=self.critic,context=self.context,mapping=self.mapping,
            output=self.output,execution_binding=self.ticket_binding,plan_binding=self.plan_binding,
            output_roots=[self.output_root])
        options.update(overrides)
        real_save,real_verify = capture.capture_failure,capture.verify_capture
        def saved(*args,**kwargs):
            SYNTHETIC_DETAILS["realOriginalWriterCalls"] += 1
            return real_save(*args,**kwargs)
        def verified(*args,**kwargs):
            SYNTHETIC_DETAILS["realOriginalVerifierCalls"] += 1
            return real_verify(*args,**kwargs)
        with patch.object(capture,"capture_failure",side_effect=saved),patch.object(capture,"verify_capture",side_effect=verified):
            return storage.save_same_call_failure(self.error,**options)


class StorageTests(unittest.TestCase):
    def setUp(self):
        approved = (ROOT/".runtime/ai-painter/controller-repair-reviews/parameter90-review-20261019/same-call-integration-cpu").resolve()
        candidate = Path(tempfile.tempdir).resolve() if tempfile.tempdir else None
        base = candidate if candidate is not None and candidate.is_relative_to(approved) else approved/"worker-delivery"
        base.mkdir(parents=True,exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix="p90-storage-private-",dir=base)
        self.fixture = Fixture(Path(self.temp.name))

    def tearDown(self):
        self.fixture.env.stop()
        self.temp.cleanup()
        self.assertFalse(torch.cuda.is_initialized())

    def test_legal_disk_save_original_readback_and_independent_manifest(self):
        f = self.fixture
        result = f.save(f.packet())
        self.assertEqual(result["status"],"captured",result)
        self.assertEqual(result["sameCallCapture"]["status"],"captured",result)
        manifest,_ = capture.verify_capture(result["originalCapture"],f.mapping)
        self.assertNotIn("sameCallCapture",manifest)
        target = result["sameCallCapture"]["artifacts"]["target"]
        raw = f.mapping.binding({k:target[k] for k in ("path","sha256")})
        self.assertEqual(storage._decode(raw)["identity"]["runId"],f.plan["runId"])
        with self.assertRaises(ValueError): storage._decode(raw[:-1]+bytes([raw[-1]^1]))
        self.assertGreater(result["storageAccounting"]["archiveExpandedBytes"],0)
        old = f.mapping.path(f.output)
        self.assertEqual((old/"manifest.json").stat().st_ino,(old/"manifest.pending.json").stat().st_ino)
        new = f.mapping.path(f.output_root+"/parameter90-same-call")
        self.assertNotEqual((new/"manifest.json").stat().st_ino,(new/"manifest.pending.json").stat().st_ino)

    def test_no_packet_and_other_parameter_preserve_original_capture(self):
        f = self.fixture
        f.error.args = ("actual four-term total gradient identity differs at parameter 88",)
        result = f.save(None)
        self.assertEqual(result["originalCapture"]["status"],"captured",result)
        self.assertEqual(result["sameCallCapture"]["status"],"not_captured",result)
        self.assertEqual(result["primaryError"],capture.primary_error(f.error))

    def test_genuine_component_seal_to_actual_original_and_new_writer(self):
        f = self.fixture
        identity = dict(runId=f.plan["runId"],packageId=f.plan["packageId"],sampleId=f.context["sampleId"],
            epoch=1,zeroBasedEpochPosition=0,trainIndex=0,optimizerSteps=f.context["optimizerSteps"],modelBinding=f.model_binding)
        # Synthetic model admission only. Real public context, fixed full-size
        # planes, actual PrecisionFinalRGBConv, five toy VJPs and original gate.
        with patch.object(component.model_identity,"validate_model_identity",return_value=None), \
             patch.object(component.gate_module,"bind_parameters",side_effect=lambda m:(tuple(m.parameters()),{},106,107)), \
             patch.object(component.gate_module,"_validate_model_and_parameters",side_effect=lambda m,p:(tuple(p),{})):
            observer = component.Parameter90TrainingSameCallCapture(f.model,identity=identity,graph=f.graph,
                source_bindings=component.required_source_bindings())
            rows = []
            try:
                with observer:
                    prediction = f.model.get_submodule(component.TARGET_MODULE)(torch.full((1,48,192,256),.00001))
                    SYNTHETIC_DETAILS["toyForwards"] += 1
                    parts = [(prediction*scale).sum() for scale in (.25,.5,.125,.0625)]
                    losses = (((parts[0]+parts[1])+parts[2])+parts[3],*parts)
                    for i,(label,loss) in enumerate(zip(component.LABELS,losses)):
                        observer("attempt",label,None)
                        values = list(torch.autograd.grad(loss,tuple(f.model.parameters()),retain_graph=i < 4,allow_unused=True))
                        SYNTHETIC_DETAILS["toyAutogradCalls"] += 1
                        if i == 0:
                            values[90] = values[90].clone(); values[90][0,1,0,0] += .01
                        observer("complete",label,values)
                        rows.append(tuple(values))
                    component.gate_module.apply_object_joint_rgb_structure_priority_update_cpu(model=f.model,
                        parameters=tuple(f.model.parameters()),total_gradients=rows[0],structured_gradients=rows[1],
                        whole_frame_gradients=rows[2],core_gradients=rows[3],support_gradients=rows[4])
            except ValueError as error:
                f.error = error
            self.assertEqual(observer.outcome["status"],"sealed_same_call_target_failure",observer.outcome)
        f.error.object_support_gradient_evidence = dict(parameterNames=[r["name"] for r in f.graph],
            componentsInOrder=list(component.LABELS),rawGradients=rows,gradientSetsAvailable=5)
        f.error.__traceback__ = None
        result = f.save(observer.packet)
        self.assertEqual(result["status"],"captured",result)
        self.assertEqual(result["sameCallCapture"]["status"],"captured")
        self.assertIsNone(observer.model)
        self.assertFalse(f.model.get_submodule(component.TARGET_MODULE)._forward_hooks)
        SYNTHETIC_DETAILS["genuineComponentPackets"] += 1

    def test_derived_identity_schema_may_differ_but_common_authority_must_match(self):
        f = self.fixture
        f.context["sampleIdentity"] = {**f.record,"channels":["synthetic-channel"],"worldId":"synthetic-world",
            "factHash":"not-a-source-index-field","objectCount":1,"ordinal":0}
        plan,_ = storage._identity(f.mapping,f.ticket_binding,f.plan_binding,f.context,f.output)
        self.assertEqual(plan,f.plan)
        for field,value in (("sampleId","other"),("split","validation"),("image",f.condition),("conditionPack",f.source)):
            context = copy.deepcopy(f.context)
            context["sampleIdentity"][field] = value
            with self.assertRaisesRegex(ValueError,"sample identity"):
                storage._identity(f.mapping,f.ticket_binding,f.plan_binding,context,f.output)

    def test_common_ordinal_mismatch_rejected_when_both_schemas_have_it(self):
        f = self.fixture
        f.record["ordinal"] = 0
        f.index = f.put("source-index.json",dict(samples=[f.record]))
        f.plan["datasetManifest"] = f.put("dataset.json",dict(sourceIndex=f.index))
        f.plan_binding = f.put(f.output_root+"/quality-plan.json",f.plan)
        f.package["inputEvidence"] = [f.plan_binding]
        f.package_binding = f.put("package.json",f.package)
        f.ticket["executionPackage"] = f.package_binding
        f.ticket_binding = f.put(f.output_root+"/capture-execution.json",f.ticket)
        f.context["executionPackage"] = f.package_binding
        f.context["sampleIdentity"] = {**f.record,"ordinal":1,"factHash":"derived-schema"}
        with self.assertRaisesRegex(ValueError,"ordinal"):
            storage._identity(f.mapping,f.ticket_binding,f.plan_binding,f.context,f.output)

    def test_sealed_cross_run_identity_rejected_original_preserved(self):
        f = self.fixture
        packet = f.packet(lambda m:m["identity"].update(runId="other-run"))
        result = f.save(packet)
        self.assertEqual(result["status"],"capture_incomplete")
        self.assertEqual(result["originalCapture"]["status"],"captured")
        self.assertIn("sealed identity",str(result["secondaryStorageFailures"]))
        self.assertFalse(f.mapping.path(f.output_root+"/parameter90-same-call/target.bin").exists())

    def test_sealed_gradient_or_weight_digest_mismatch_rejected(self):
        f = self.fixture
        packet = f.packet()
        with torch.no_grad(): f.model.get_parameter(component.TARGET_NAME).add_(1)
        result = f.save(packet)
        self.assertEqual(result["status"],"capture_incomplete")
        self.assertIn("weight witness",str(result["secondaryStorageFailures"]))

    def test_actual_original_gradient_bytes_must_match_seal(self):
        f = self.fixture
        packet = f.packet()
        f.rows[2][90][0,1,0,0] += 1
        result = f.save(packet)
        self.assertEqual(result["status"],"capture_incomplete")
        self.assertIn("sealed gradient",str(result["secondaryStorageFailures"]))

    def test_plan_digest_tamper_still_calls_original_saver_and_verifier(self):
        f = self.fixture
        f.mapping.path(f.plan_binding["path"]).write_bytes(b"{}")
        before = SYNTHETIC_DETAILS["realOriginalWriterCalls"]
        result = f.save(None)
        self.assertEqual(SYNTHETIC_DETAILS["realOriginalWriterCalls"],before+1)
        self.assertEqual(result["status"],"capture_incomplete")
        self.assertEqual(result["primaryError"],capture.primary_error(f.error))
        self.assertTrue(result["secondaryStorageFailures"])

    def test_train_source_identity_tamper_rejected(self):
        f = self.fixture
        f.context["sampleBindings"]["source"] = f.condition
        result = f.save(None)
        self.assertEqual(result["status"],"capture_incomplete")
        self.assertIn("source/condition",str(result["secondaryStorageFailures"]))

    def test_expanded_view_limit_rejects_sidecar_but_keeps_original_capture(self):
        f = self.fixture
        result = f.save(None,maximum_output_bytes=2*1024**2)
        self.assertEqual(result["status"],"capture_incomplete")
        self.assertEqual(result["originalCapture"]["status"],"captured")
        self.assertTrue(f.mapping.path(f.output+"/tensors.pt").exists())
        self.assertEqual(result["primaryError"],capture.primary_error(f.error))

    def test_entropy_archive_views_replace_representation_instead_of_double_count(self):
        f = self.fixture
        with torch.no_grad(): f.model.prefix[0][:262144].copy_(torch.rand(262144))
        payload,metadata = capture.collect_snapshot(f.error,model=f.model,critic=f.critic,graph=f.graph,context=f.context)
        raw = capture.archive_bytes(payload)
        expanded = storage._expanded_size(raw)
        self.assertGreater(len(raw),512*1024)
        ceiling = expanded+512*1024
        with patch.object(storage,"FAILURE_MAXIMUM",ceiling): result = f.save(None)
        self.assertEqual(result["status"],"captured",result)
        observed = result["storageAccounting"]
        self.assertLessEqual(observed["failureDiskViewBytesIncludingReserve"],ceiling)
        self.assertLessEqual(observed["failureExpandedViewBytesIncludingReserve"],ceiling)
        self.assertGreater(observed["failureLogicalFileBytes"]+observed["archiveExpandedBytes"]+storage.RESERVE,ceiling)

    def test_expansion_is_real_stream_count_not_compressed_size_or_caller_flag(self):
        raw = gzip.compress(bytes(2*1024**2),mtime=0)
        self.assertLess(len(raw),10000)
        self.assertEqual(storage._expanded_size(raw),2*1024**2)
        with self.assertRaisesRegex(ValueError,"expansion"): storage._expanded_size(raw,100000)
        with self.assertRaises(ValueError): storage._expanded_size(raw+gzip.compress(b"extra",mtime=0))

    def test_scan_counts_pending_and_rejects_arbitrary_hardlinks(self):
        f = self.fixture
        result = f.save(None)
        _,files = storage._scan(f.mapping,[f.output_root],f.output)
        expected = sum(info.st_size for name,info in files.items() if name.startswith(f.output+"/") or
                       name.startswith(f.output_root+"/parameter90-same-call/"))
        self.assertEqual(result["storageAccounting"]["failureLogicalFileBytes"],expected)
        os.link(f.mapping.path(f.output+"/primary.json"),f.mapping.path(f.output_root+"/foreign-link.json"))
        with self.assertRaisesRegex(ValueError,"hardlink"): storage._scan(f.mapping,[f.output_root],f.output)

    def test_original_manifest_link_pair_cannot_be_replaced_by_independent_copy(self):
        f = self.fixture
        f.save(None)
        committed = f.mapping.path(f.output+"/manifest.json")
        raw = committed.read_bytes()
        committed.unlink()
        committed.write_bytes(raw)
        with self.assertRaisesRegex(ValueError,"pair"):
            storage._scan(f.mapping,[f.output_root],f.output)

    def test_repeat_consumption_never_overwrites_original_or_sidecar(self):
        f = self.fixture
        first = f.save(f.packet())
        original_path = f.mapping.path(f.output+"/primary.json")
        primary = original_path.read_bytes()
        side_path = f.mapping.path(first["sameCallCapture"]["artifacts"]["target"]["path"])
        side = side_path.read_bytes()
        second = f.save(f.packet())
        self.assertEqual(second["status"],"capture_incomplete")
        self.assertEqual(original_path.read_bytes(),primary)
        self.assertEqual(side_path.read_bytes(),side)

    def test_sidecar_write_failure_keeps_original_error_and_original_bytes(self):
        f = self.fixture
        original_open = Path.open
        def opened(path,*args,**kwargs):
            if path.name == "target.bin": raise PermissionError("synthetic sidecar write denied")
            return original_open(path,*args,**kwargs)
        with patch.object(Path,"open",new=opened): result = f.save(f.packet())
        self.assertEqual(result["status"],"capture_incomplete")
        self.assertEqual(result["originalCapture"]["status"],"captured")
        self.assertEqual(result["primaryError"],capture.primary_error(f.error))
        self.assertIn("synthetic sidecar write denied",str(result["secondaryStorageFailures"]))

    def test_late_validation_error_revokes_new_manifest_not_original_failure(self):
        f = self.fixture
        original, calls = storage._identity,[0]
        def identity(*args,**kwargs):
            calls[0] += 1
            if calls[0] == 2: raise RuntimeError("synthetic late source change")
            return original(*args,**kwargs)
        with patch.object(storage,"_identity",side_effect=identity): result = f.save(f.packet())
        self.assertEqual(result["status"],"capture_incomplete")
        self.assertEqual(result["originalCapture"]["status"],"captured")
        side = f.output_root+"/parameter90-same-call/"
        self.assertFalse(f.mapping.path(side+"manifest.json").exists())
        self.assertTrue(f.mapping.path(side+"manifest.not-accepted.json").exists())
        self.assertEqual(result["primaryError"],capture.primary_error(f.error))

    def test_internal_directory_symlink_or_junction_refused(self):
        f = self.fixture
        foreign = Path(self.temp.name)/"foreign"
        foreign.mkdir()
        link = f.mapping.path(f.output_root+"/parameter90-same-call")
        if os.name == "nt":
            import subprocess
            completed = subprocess.run(["cmd","/c","mklink","/J",str(link),str(foreign)],capture_output=True)
            self.assertEqual(completed.returncode,0,completed.stderr)
        else: link.symlink_to(foreign,target_is_directory=True)
        try:
            result = f.save(None)
            self.assertEqual(result["status"],"capture_incomplete")
            self.assertFalse(list(foreign.iterdir()))
        finally:
            if os.name == "nt": link.rmdir()
            else: link.unlink()


if __name__ == "__main__": unittest.main()
