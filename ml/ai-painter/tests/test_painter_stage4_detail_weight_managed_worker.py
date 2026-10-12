"""Bounded tiny CPU updates and distinct simulated failures."""
import unittest
from unittest.mock import patch
from types import SimpleNamespace
import torch
import painter_stage4_detail_weight_managed_worker as worker
from test_detail_weight_managed_checkpoint import configuration


update_event=lambda stage,kind:None


class WorkerTests(unittest.TestCase):
    def test_binding_rejects_escape_and_unproven_hash(self):
        for value in ({"path":"../x","sha256":"a"*64},{"path":"a","sha256":"a"*63},{"path":"a","sha256":"a"*64,"passed":True}):
            with self.assertRaises(ValueError):worker.binding(value)
    def test_real_tiny_D_then_G_partial_counts_and_original_error(self):
        g=torch.nn.Linear(1,1,bias=False);d=torch.nn.Linear(1,1,bias=False)
        g.train(False);d.train(False);entry=torch.get_rng_state().clone();calls={"pairs":0,"generator":0,"discriminator":0}
        class Pair:
            def perform_pair(self,model,critic,sample,order,go,do,counts,ledger,resource,unused):
                calls["pairs"]+=1
                do.zero_grad(set_to_none=True);loss=critic.weight.square().sum();update_event("attempt","discriminatorGradient");loss.backward();update_event("complete","discriminatorGradient");do.step()
                calls["discriminator"]+=1;counts["discriminator"]+=1;ledger["discriminator"]+=1
                if calls["pairs"]==2:raise RuntimeError("injected after actual D")
                go.zero_grad(set_to_none=True);loss=model.weight.square().sum();update_event("attempt","generatorGradient");loss.backward();update_event("complete","generatorGradient");go.step()
                calls["generator"]+=1;counts["generator"]+=1;ledger["generator"]+=1
        train=[{"sampleId":str(i),"split":"train"} for i in range(48)]
        shared=SimpleNamespace(_validate_samples=lambda t,v:None)
        with patch.object(worker,"runtime",return_value=(torch,Pair(),shared,None)):
            with self.assertRaisesRegex(RuntimeError,"injected after actual D") as raised:
                worker.training_loop(model=g,critic=d,train=train,validation=[],order=[],configuration=configuration(),package_binding={},plan={"runId":"synthetic-run"},resource=lambda:None,checkpoint_sink=lambda *a:None,progress_sink=lambda *a,**k:None,profile=Pair())
        self.assertEqual(raised.exception.actual_optimizer_counts,{"generator":1,"discriminator":2})
        self.assertEqual(raised.exception.completed_epochs,0);self.assertEqual(calls,{"pairs":2,"generator":1,"discriminator":2})
        self.assertFalse(g.training);self.assertFalse(d.training);self.assertTrue(torch.equal(entry,torch.get_rng_state()))
    def test_resource_failure_precedes_optimizer_construction_dispatch(self):
        g=torch.nn.Linear(1,1);d=torch.nn.Linear(1,1);pair=SimpleNamespace(perform_pair=lambda *a: self.fail("pair dispatched"))
        def resource():raise RuntimeError("synthetic budget exhausted")
        with patch.object(worker,"runtime",return_value=(torch,pair,SimpleNamespace(_validate_samples=lambda *a:None),None)):
            with self.assertRaisesRegex(RuntimeError,"budget exhausted") as raised:
                worker.training_loop(model=g,critic=d,train=[{"sampleId":str(i)} for i in range(48)],validation=[],order=[],configuration={},package_binding={},plan={},resource=resource,checkpoint_sink=lambda *a:None,progress_sink=lambda *a,**k:None,profile=pair)
        self.assertEqual(raised.exception.actual_optimizer_counts,{"generator":0,"discriminator":0})

    def test_simulated_stale_heartbeat_and_reused_pid_are_rejected(self):
        import json
        from datetime import datetime,timezone
        active={"capabilityVersion":worker.CAPABILITY,"runId":"synthetic-run","packageId":"synthetic-package","processId":21,"processStartIdentity":"21:original","executionState":"executing","programLineage":{"worker":{"path":worker.PATH,"sha256":"a"*64}},"lock":{"path":".runtime/synthetic/lock.json","sha256":"b"*64},"heartbeat":{"path":".runtime/synthetic/heartbeat.json","ttlSeconds":120}}
        current={"registryRevision":4,**{k:active[k] for k in ("capabilityVersion","runId","packageId")},"activeExecution":active}
        lock={"schemaVersion":"ai-painter-current-active-execution-lock-v1",**{k:active[k] for k in ("capabilityVersion","runId","packageId","processId","processStartIdentity")}}
        heart={"schemaVersion":"ai-painter-current-active-execution-heartbeat-v1",**lock,"executionState":"executing","ttlSeconds":120,"heartbeatAtUtc":datetime.fromtimestamp(1000,tz=timezone.utc).isoformat().replace("+00:00","Z")};heart["schemaVersion"]="ai-painter-current-active-execution-heartbeat-v1"
        reader=SimpleNamespace(path=lambda p:SimpleNamespace(read_bytes=lambda:json.dumps(current if p.endswith("current.json") else heart).encode()),json=lambda b:lock)
        shared=SimpleNamespace(managed_worker=SimpleNamespace(process_identity=lambda pid:"21:reused"))
        spec={"packageIdentity":"synthetic-package"};plan={"runId":"synthetic-run","programBindings":active["programLineage"]}
        with patch.object(worker,"load_package",return_value=(reader,spec,plan,{})),patch.object(worker,"runtime",return_value=(None,None,shared,None)),patch.object(worker.time,"time",return_value=1121):
            with self.assertRaisesRegex(ValueError,"PID reused"):worker.authenticate_live({})
            shared.managed_worker.process_identity=lambda pid:"21:original"
            with self.assertRaisesRegex(ValueError,"heartbeat stale"):worker.authenticate_live({})

    def test_simulated_legacy_package_cannot_borrow_current_capability(self):
        old={"schemaVersion":"ai-painter-stage4-mvp256-dry-v24-execution-package-v1","capabilityVersion":worker.CAPABILITY,"maxInfrastructureRecoveryAttempts":0}
        reader=SimpleNamespace(json=lambda b:old)
        with patch.object(worker,"runtime",return_value=(None,None,None,SimpleNamespace(Reader=lambda root:reader))):
            with self.assertRaisesRegex(ValueError,"same immutable"):worker.load_package({"path":".runtime/synthetic/package.json","sha256":"a"*64})
