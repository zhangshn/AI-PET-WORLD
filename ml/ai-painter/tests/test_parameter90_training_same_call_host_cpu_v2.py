"""CPU host-v2 DTO/fixture tests; synthetic files only, no model execution."""
import importlib.util
from pathlib import Path
from copy import deepcopy
import os
import sys
import tempfile
import unittest
from ai_painter.complete_world import parameter90_training_same_call_bridge_v1 as bridge

ROOT = Path(__file__).absolute().parents[3]
class CpuDriverContractTests(unittest.TestCase):
    def test_fixed_cpu_integration_contract_rejects_omitted_suite_or_drift(self):
        import importlib.util
        path=ROOT/"ml/ai-painter/scripts/check_parameter90_training_same_call_integration_cpu_v2.py"
        spec=importlib.util.spec_from_file_location("parameter90_integration_worker_contract",path)
        worker=importlib.util.module_from_spec(spec);sys.modules[spec.name]=worker;spec.loader.exec_module(worker)
        bind=lambda p:dict(path=p,sha256="a"*64)
        sources={worker.DRIVER,worker.COMPONENT,worker.TEST,worker.LOADER,*worker.EXTRA_TESTS,
            "ml/ai-painter/scripts/check_parameter90_training_same_call_capture_cpu_v1.py",
            "ml/ai-painter/scripts/painter_stage4_decode1_entry_same_call_training_profile_v1.py",
            "ml/ai-painter/src/ai_painter/complete_world/parameter90_training_same_call_bridge_v1.py",
            "ml/ai-painter/src/ai_painter/complete_world/parameter90_training_same_call_storage_v1.py"}
        policy=dict(schemaVersion="ai-painter-parameter90-training-same-call-integration-cpu-policy-v2",
            status="registered_cpu_integration_validation_only",scope="training_same_call_integration_synthetic_cpu_only",
            formalSpecification=deepcopy(worker.SPEC),designBinding=deepcopy(worker.DESIGN),
            resources=deepcopy(worker.LIMITS),captureBudget=deepcopy(worker.CAPTURE_BUDGET),
            target=deepcopy(worker.TARGET),outputRoot=worker.OUTPUT,
            comparison=dict(atol=1e-6,rtol=1e-5,gradientLabels=list(bridge.capture.LABELS),
                fp32Order="(((structured.float()+whole.float()).float()+core.float()).float()+support.float())",originalGateKept=True),
            executionBoundary=dict(syntheticCpuOnly=True,gpu=False,training=False,productionIntegrated=False,oldRunReplay=False,originalDataRead=False),
            executionHost=bind("scripts/check-ai-painter-parameter90-training-same-call-integration-cpu-v2.mjs"),
            executionHostTests=bind("scripts/tests/ai-painter-parameter90-training-same-call-integration-cpu-v2.test.mjs"),
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


    def test_private_fixture_hardlinks_count_each_name_but_do_not_grant_trust(self):
        path=ROOT/"ml/ai-painter/scripts/check_parameter90_training_same_call_integration_cpu_v2.py"
        spec=importlib.util.spec_from_file_location("p90_host_v2_fixture_contract",path)
        worker=importlib.util.module_from_spec(spec);sys.modules[spec.name]=worker;spec.loader.exec_module(worker)
        with tempfile.TemporaryDirectory(prefix="p90-v2-accountant-") as tmp:
            root=Path(tmp);(root/"one.bin").write_bytes(b"1234567")
            os.link(root/"one.bin",root/"two.bin")
            self.assertEqual(worker.fixture_bytes(root),14)
            with self.assertRaises(ValueError):
                worker.read_bound(root,dict(path="one.bin",sha256=worker.digest(b"1234567")))

    def test_private_fixture_link_target_is_not_counted_or_read(self):
        path=ROOT/"ml/ai-painter/scripts/check_parameter90_training_same_call_integration_cpu_v2.py"
        spec=importlib.util.spec_from_file_location("p90_host_v2_link_contract",path)
        worker=importlib.util.module_from_spec(spec);sys.modules[spec.name]=worker;spec.loader.exec_module(worker)
        with tempfile.TemporaryDirectory(prefix="p90-v2-links-") as tmp:
            root=Path(tmp);fixtures=root/"fixtures";fixtures.mkdir()
            foreign=root/"foreign";foreign.mkdir();(foreign/"not-owned.bin").write_bytes(b"x"*1024)
            link=fixtures/"redirect"
            if os.name=="nt":
                import subprocess
                done=subprocess.run(["cmd","/c","mklink","/J",str(link),str(foreign)],capture_output=True)
                self.assertEqual(done.returncode,0,done.stderr)
            else:
                link.symlink_to(foreign,target_is_directory=True)
            try:
                self.assertEqual(worker.fixture_bytes(fixtures),link.lstat().st_size)
            finally:
                if os.name=="nt": link.rmdir()
                else: link.unlink()

if __name__=="__main__": unittest.main()

