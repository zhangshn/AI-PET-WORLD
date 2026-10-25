"""Private synthetic storage tests, not an authenticated real training fixture.

Packets are explicitly injected through the component's private unit mechanism;
its genuine gate/bridge proof is tested in the separately frozen component suite.
Here the real old snapshot/codec/writer/verifier run on synthetic tensors only.
"""
import copy
import gzip
import inspect
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
from ai_painter.complete_world import parameter0_training_same_call_storage_v1 as storage
from ai_painter.complete_world import parameter0_training_same_call_capture_v1 as component
from ai_painter.complete_world import object_support_structure_failure_capture_v1 as capture

SYNTHETIC_DETAILS = dict(realModelForwards=0,realModelAutogradCalls=0,optimizerSteps=0,
    toyForwards=0,toyAutogradCalls=0,privateInjectedPackets=0,genuineComponentPackets=0,
    realOriginalWriterCalls=0,realOriginalVerifierCalls=0)


def setUpModule():
    torch.set_num_threads(2)
    if torch.get_num_interop_threads() != 2: torch.set_num_interop_threads(2)
    if torch.cuda.is_initialized(): raise RuntimeError("CUDA forbidden")
    for obj,name in ((torch.nn.Module,"__call__"),(torch.autograd,"grad"),(torch.cuda,"_lazy_init"),(torch.optim.Optimizer,"__init__")):
        guard=patch.object(obj,name,side_effect=AssertionError("forbidden real computation/optimizer/CUDA"))
        guard.start();unittest.addModuleCleanup(guard.stop)


class Fixture:
    def __init__(self,base,capability=storage.CAPABILITY):
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
        node = self.model
        parts = component.TARGET_MODULE.split(".")
        for part in parts[:-1]:
            node.add_module(part,nn.Module()); node = node._modules[part]
        convolution = nn.Conv2d(31,48,3,padding=1)
        with torch.no_grad():
            convolution.weight.zero_(); convolution.bias.zero_()
        node.add_module(parts[-1],convolution)
        self.model.suffix = nn.ParameterList([nn.Parameter(torch.zeros(2229142))]+[nn.Parameter(torch.zeros(1)) for _ in range(105)])
        self.critic = nn.Linear(1,1)
        self.graph = [dict(name=n,shape=list(p.shape),dtype=str(p.dtype),elements=p.numel())
                      for n,p in self.model.named_parameters()]
        self.programs = {}
        for i,binding in enumerate(component.required_source_bindings()):
            self.programs[str(i)] = self.put(binding["path"],(ROOT/binding["path"]).read_bytes())
        self.programs["storage"] = self.put("storage.py",Path(storage.__file__).read_bytes())
        self.model_binding = self.put("model.json",dict(graph=self.graph,modelCapabilityVersion=storage.MODEL_CAPABILITY))
        self.source = self.put("synthetic-source.bin",b"not a real image")
        self.condition = self.put("synthetic-condition.json",dict(synthetic=True))
        self.record = dict(sampleId=storage.SAMPLE_ID,split="train",image=self.source,conditionPack=self.condition)
        self.index = self.put("source-index.json",dict(samples=[self.record]))
        self.dataset = self.put("dataset.json",dict(sourceIndex=self.index))
        self.split = self.put("train.json",dict(split="train",sampleIds=[storage.SAMPLE_ID if i==8 else "synthetic-train-"+str(i) for i in range(48)]))
        self.plan = dict(schema="object-support-structure-quality-plan-v1",runId="synthetic-new-run",
            packageId="synthetic-package",capabilityVersion=capability,
            configuration=dict(capabilityVersion=capability,modelCapabilityVersion=storage.MODEL_CAPABILITY,objectSupportStructureWeight=1,seed=20260929),
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
        self.context = dict(runId=self.plan["runId"],sampleId=storage.SAMPLE_ID,split="train",sampleIdentity=self.record,
            sampleBindings=dict(source=self.source,condition=self.condition),modelBinding=self.model_binding,
            programBindings=self.programs,executionPackage=self.package_binding,
            failurePosition=dict(epoch=1,zeroBasedEpochPosition=14,trainIndex=8,sampleId=storage.SAMPLE_ID),
            optimizerSteps=dict(generator=14,discriminator=15))
        self.error = ValueError("actual four-term total gradient identity differs at parameter 0")
        self.rows = []
        for value in (10,1,2,3,4):
            rows = [None]*108
            rows[0] = torch.full((48,31,3,3),float(value))
            self.rows.append(rows)
        self.rows[0][0][1,13,0,0] += .01
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
            epoch=1,zeroBasedEpochPosition=14,trainIndex=8,optimizerSteps=self.context["optimizerSteps"],
            modelBinding=self.model_binding)
        metadata = dict(schemaVersion="parameter0-training-same-call-capture-v1",identity=copy.deepcopy(identity),
            target=dict(parameterIndex=0,parameterName=component.TARGET_NAME,shape=[48,31,3,3],coordinate=[1,13,0,0],
                        inputChannel=13,outputChannel=1),productionGeometryVerified=True,
            originalFailure=dict(type="ValueError",message=str(self.error),sourceBindings=component.required_source_bindings(),fixedCoordinateClassification="fixed_coordinate_violating",fixedCoordinateViolating=True),
            fixedCoordinateClassification="fixed_coordinate_violating",fixedCoordinateViolating=True,referenceAllowed=False,localReferenceCalls=0,
            graphSha256=capture.digest(component._json(self.graph)),fixtureMeaning="private_injected_packet_not_training_trace")
        if change: change(metadata)
        tensors = dict(input=torch.zeros(1,1,192,256),weightWitness=self.model.get_parameter(component.TARGET_NAME).detach().clone())
        tensors.update({"adjoint."+label:torch.ones(1,1,192,256) for label in component.LABELS})
        tensors.update({"gradient."+label:rows[0].clone() for label,rows in zip(component.LABELS,self.rows)})
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
    capability = storage.CAPABILITY
    def setUp(self):
        approved = (ROOT/".runtime/ai-painter/controller-repair-reviews/registry-publication-repair-024-20261024/identity-mapping").resolve()
        candidate = Path(tempfile.tempdir).resolve() if tempfile.tempdir else None
        base = candidate if candidate is not None and candidate.is_relative_to(approved) else approved/"synthetic-fixtures"
        base.mkdir(parents=True,exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix="p0-storage-private-",dir=base)
        self.fixture = Fixture(Path(self.temp.name),self.capability)

    def tearDown(self):
        self.fixture.env.stop()
        self.temp.cleanup()
        self.assertFalse(torch.cuda.is_initialized())

    def test_legal_disk_save_original_readback_and_independent_manifest(self):
        f = self.fixture
        real_verify=capture.verify_capture
        checked=[]
        def audit_verify(*args,**kwargs):
            frame=inspect.currentframe().f_back
            try:
                while frame is not None:
                    if frame.f_code is storage.save_same_call_failure.__code__ and "committed" in frame.f_locals:
                        for name in ("failure_parts","encoded","raw","tensors"):
                            self.assertNotIn(name,frame.f_locals,"large caller buffer retained during final original readback")
                        checked.append(True)
                    frame=frame.f_back
            finally: del frame
            return real_verify(*args,**kwargs)
        with patch.object(capture,"verify_capture",side_effect=audit_verify):
            result = f.save(f.packet())
        self.assertEqual(checked,[True])
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
        new = f.mapping.path(f.output_root+"/parameter0-same-call")
        self.assertNotEqual((new/"manifest.json").stat().st_ino,(new/"manifest.pending.json").stat().st_ino)
        body=dict(runId=f.plan["runId"],optimizerSteps=f.context["optimizerSteps"],failurePosition=f.context["failurePosition"],originalError=capture.primary_error(f.error))
        storage.verify_same_call_failure(result,f.mapping,plan=f.plan,body=body)
        self.assertLessEqual(result["storageAccounting"]["targetBytesIncludingTerminalReserve"],storage.SIDECAR_MAXIMUM)
        original_primary=f.mapping.path(result["originalCapture"]["artifacts"]["primary"]["path"]).read_bytes()
        # The terminal verifier measures all extra/staging bytes, not only bindings.
        (new/"extra.tmp").write_bytes(b"x"*(storage.SIDECAR_MAXIMUM-(sum(p.stat().st_size for p in new.iterdir()))-storage.RESERVE+1))
        with self.assertRaisesRegex(ValueError,"aggregate target"):
            storage.verify_same_call_failure(result,f.mapping,plan=f.plan,body=body)
        self.assertEqual(f.mapping.path(result["originalCapture"]["artifacts"]["primary"]["path"]).read_bytes(),original_primary)


    def test_no_packet_and_other_parameter_preserve_original_capture(self):
        f = self.fixture
        f.error.args = ("actual four-term total gradient identity differs at parameter 88",)
        result = f.save(None)
        self.assertEqual(result["originalCapture"]["status"],"captured",result)
        self.assertEqual(result["sameCallCapture"]["status"],"not_captured",result)
        self.assertEqual(result["primaryError"],capture.primary_error(f.error))
        self.assertFalse(f.mapping.path(f.output_root+"/parameter0-same-call").exists())

    def test_fixed_coordinate_not_violating_is_evidence_not_reference_permission(self):
        f=self.fixture
        f.rows[0][0][1,13,0,0]=10.0
        f.rows[0][0][0,0,0,0] += .01
        def changed(metadata):
            for value in (metadata,metadata["originalFailure"]):
                value.update(fixedCoordinateClassification="fixed_coordinate_not_violating",fixedCoordinateViolating=False)
        encoded=component.encode_capture(f.packet(changed),original_failure_parts=(),execution_parts=())
        metadata=storage._decode(encoded["bytes"])
        tensors={"generator.parameter.0":f.model.get_parameter(component.TARGET_NAME).detach()}
        tensors.update({"gradient."+label+".0":row[0] for label,row in zip(component.LABELS,f.rows)})
        storage._match_packet(metadata,f.plan,f.context,{"graph":f.graph},tensors,f.error)
        self.assertFalse(metadata["referenceAllowed"])
        for field,value in (("referenceAllowed",True),("fixedCoordinateViolating",True),("localReferenceCalls",1)):
            tampered=copy.deepcopy(metadata);tampered[field]=value
            with self.assertRaises(ValueError):storage._match_packet(tampered,f.plan,f.context,{"graph":f.graph},tensors,f.error)

    def test_forged_packet_refused_after_original_is_saved(self):
        f=self.fixture; result=f.save(object())
        self.assertEqual(result["originalCapture"]["status"],"captured")
        self.assertEqual(result["status"],"capture_incomplete")
        self.assertIn("private live sealed",str(result["secondaryStorageFailures"]))
        self.assertEqual(result["primaryError"],capture.primary_error(f.error))

    def test_identity_rejects_counts_weight_model_and_sample_changes(self):
        f=self.fixture
        for key,value in (("optimizerSteps",dict(generator=15,discriminator=15)),("sampleId","other")):
            context=copy.deepcopy(f.context);context[key]=value
            with self.assertRaises(ValueError):storage._identity(f.mapping,f.ticket_binding,f.plan_binding,context,f.output)
        encoded=component.encode_capture(f.packet(),original_failure_parts=(),execution_parts=())
        metadata=storage._decode(encoded["bytes"])
        tensors={"generator.parameter.0":f.model.get_parameter(component.TARGET_NAME).detach()}
        tensors.update({"gradient."+label+".0":row[0] for label,row in zip(component.LABELS,f.rows)})
        for field in ("graphSha256","identity","target"):
            changed=copy.deepcopy(metadata);changed[field]=None
            with self.assertRaises(ValueError):storage._match_packet(changed,f.plan,f.context,{"graph":f.graph},tensors,f.error)

    def test_unapproved_links_and_expanded_bytes_are_rejected(self):
        f=self.fixture
        file=f.mapping.path(f.output_root+"/plain.bin");file.write_bytes(b"x")
        os.link(file,f.mapping.path(f.output_root+"/alias.bin"))
        with self.assertRaisesRegex(ValueError,"hardlink"):
            storage._scan(f.mapping,[f.output_root],f.output)
        with self.assertRaises(ValueError):storage._expanded_size(gzip.compress(b"x"*1000,mtime=0),999)

    def test_codec_workspace_real_byte_boundary_rejects_before_whole_file_read(self):
        from types import SimpleNamespace
        f=self.fixture
        maximum=storage.FAILURE_MAXIMUM-storage.CODEC_WORKSPACE_RESERVE
        files={f.output+"/tensors.pt":SimpleNamespace(st_size=maximum)}
        self.assertEqual(storage._codec_workspace(files,f.output),storage.FAILURE_MAXIMUM)
        files[f.output+"/primary.json"]=SimpleNamespace(st_size=1)
        with self.assertRaisesRegex(ValueError,"codec workspace"):
            storage._codec_workspace(files,f.output)
        real_scan=storage._scan
        def oversize(mapping,roots,output):
            total,actual=real_scan(mapping,roots,output)
            if output+"/tensors.pt" in actual:
                actual={**actual,output+"/synthetic-memory-pressure":SimpleNamespace(st_size=maximum+1)}
            return total,actual
        with patch.object(storage,"_scan",side_effect=oversize),patch.object(storage,"_read",side_effect=AssertionError("whole-file read must not occur")) as read:
            result=f.save(f.packet())
        self.assertEqual(result["originalCapture"]["status"],"captured")
        self.assertEqual(result["status"],"capture_incomplete")
        self.assertIn("codec workspace",str(result["secondaryStorageFailures"]))
        read.assert_not_called()


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


    def test_sealed_cross_run_identity_rejected_original_preserved(self):
        f = self.fixture
        packet = f.packet(lambda m:m["identity"].update(runId="other-run"))
        result = f.save(packet)
        self.assertEqual(result["status"],"capture_incomplete")
        self.assertEqual(result["originalCapture"]["status"],"captured")
        self.assertIn("sealed identity",str(result["secondaryStorageFailures"]))
        self.assertFalse(f.mapping.path(f.output_root+"/parameter0-same-call/target.bin").exists())

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
        f.rows[2][0][1,13,0,0] += 1
        result = f.save(packet)
        self.assertEqual(result["status"],"capture_incomplete")
        self.assertIn("sealed gradient",str(result["secondaryStorageFailures"]))

    def test_plan_digest_tamper_still_calls_original_saver_and_verifier(self):
        f = self.fixture
        f.mapping.path(f.plan_binding["path"]).write_bytes(b"{}")
        before = SYNTHETIC_DETAILS["realOriginalWriterCalls"]
        result = f.save(f.packet())
        self.assertEqual(SYNTHETIC_DETAILS["realOriginalWriterCalls"],before+1)
        self.assertEqual(result["status"],"capture_incomplete")
        self.assertEqual(result["primaryError"],capture.primary_error(f.error))
        self.assertTrue(result["secondaryStorageFailures"])




    def test_expansion_is_real_stream_count_not_compressed_size_or_caller_flag(self):
        raw = gzip.compress(bytes(2*1024**2),mtime=0)
        self.assertLess(len(raw),10000)
        self.assertEqual(storage._expanded_size(raw),2*1024**2)
        with self.assertRaisesRegex(ValueError,"expansion"): storage._expanded_size(raw,100000)
        with self.assertRaises(ValueError): storage._expanded_size(raw+gzip.compress(b"extra",mtime=0))




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





class V2StorageTests(StorageTests):
    capability = storage.CAPABILITIES[1]

    def test_v2_storage_rejects_mixed_plan_configuration_identity(self):
        f=self.fixture
        f.plan["configuration"]["capabilityVersion"]=storage.CAPABILITY
        # Exercise the real identity branch directly; synthetic mapping updates
        # keep all earlier plan digest checks authentic to these fixture bytes.
        raw=json.dumps(f.plan,sort_keys=True).encode()
        f.mapping.path(f.plan_binding["path"]).write_bytes(raw)
        f.plan_binding["sha256"]=__import__("hashlib").sha256(raw).hexdigest()
        with self.assertRaisesRegex(ValueError,"exact RGB capture"):
            storage._identity(f.mapping,f.ticket_binding,f.plan_binding,f.context,f.output_root+"/gradient-failure")

class V3StorageTests(V2StorageTests):
    capability = storage.CAPABILITIES[2]

    def test_v3_storage_rejects_v2_plan_configuration_identity(self):
        f=self.fixture
        f.plan["configuration"]["capabilityVersion"]=storage.CAPABILITIES[1]
        raw=json.dumps(f.plan,sort_keys=True).encode()
        f.mapping.path(f.plan_binding["path"]).write_bytes(raw)
        f.plan_binding["sha256"]=__import__("hashlib").sha256(raw).hexdigest()
        with self.assertRaisesRegex(ValueError,"exact RGB capture"):
            storage._identity(f.mapping,f.ticket_binding,f.plan_binding,f.context,f.output_root+"/gradient-failure")


class V4StorageTests(V3StorageTests):
    capability = storage.CAPABILITIES[3]

    def test_v4_storage_rejects_v3_plan_configuration_identity(self):
        f=self.fixture
        f.plan["configuration"]["capabilityVersion"]=storage.CAPABILITIES[2]
        raw=json.dumps(f.plan,sort_keys=True).encode()
        f.mapping.path(f.plan_binding["path"]).write_bytes(raw)
        f.plan_binding["sha256"]=__import__("hashlib").sha256(raw).hexdigest()
        with self.assertRaisesRegex(ValueError,"exact RGB capture"):
            storage._identity(f.mapping,f.ticket_binding,f.plan_binding,f.context,f.output_root+"/gradient-failure")


class V5StorageTests(V4StorageTests):
    capability = storage.CAPABILITIES[4]

    def test_v5_storage_rejects_v4_plan_configuration_identity(self):
        f=self.fixture
        f.plan["configuration"]["capabilityVersion"]=storage.CAPABILITIES[3]
        raw=json.dumps(f.plan,sort_keys=True).encode()
        f.mapping.path(f.plan_binding["path"]).write_bytes(raw)
        f.plan_binding["sha256"]=__import__("hashlib").sha256(raw).hexdigest()
        with self.assertRaisesRegex(ValueError,"exact RGB capture"):
            storage._identity(f.mapping,f.ticket_binding,f.plan_binding,f.context,f.output_root+"/gradient-failure")


if __name__ == "__main__": unittest.main()
