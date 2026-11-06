"""One retained Stage0 segment. The local service owns leasing and sealing."""
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import time

ROOT=Path(__file__).resolve().parents[3]
sys.path[:0]=[str(ROOT/"ml/ai-painter/scripts"),str(ROOT/"ml/ai-painter/src"),str(ROOT/"ml/ai-painter/.venv/Lib/site-packages")]
from ai_painter.complete_world import native_stage0_formal_contract as c


def cpu_segment(ticket, root, folder, inspect):
    import torch
    import prepare_native_stage0_training as entry
    from ai_painter.complete_world.native_stage0_training import position
    c.need(os.environ.get("CUDA_VISIBLE_DEVICES")=="" and not torch.cuda.is_initialized(),"CPU rehearsal initialized device")
    trial,dev=entry.dataset()
    n=ticket["segment"];start=ticket["startPair"];end=ticket["endPair"]
    previous=ticket["previous"]
    if previous is not None:
        fixture=c.read(c.bound(previous["checkpoint"],root/"segments"/f"{n-1:02d}"/"recovery.pt"))
        c.need(fixture=={"cpuFixture":True,"runId":c.RUN_ID,"virtualCursor":start,"actualOptimizerUpdates":0},"CPU previous fixture")
    rows=[]
    for i in range(start,end):
        pos=position(trial.ids,i)
        rows.append({"position":pos,"counts":{"generator":i+1,"discriminator":i+1},"ledger":{"sampleId":pos["sampleId"],"generator":1,"discriminator":1},
                     "fixtureOnly":True,"actualOptimizerUpdates":0})
    payload={"cpuFixture":True,"runId":c.RUN_ID,"virtualCursor":end,"actualOptimizerUpdates":0}
    ck=c.publish(folder/"recovery.pt",c.encoded(payload),root)
    c.need(c.read(c.bound(ck,folder/"recovery.pt"))==payload,"CPU fixture did not persist")
    states=c.state_digests(trial)
    verification={"independentCpuReconstruction":False,"cpuFixtureReopened":True,"deviceRngBytesVerified":False,"checkpoint":ck,"stateDigest":states}
    return {"schema":"native-stage0-formal-cpu-fixture-v1","scope":"cpu_rehearsal","optimizerUpdates":0,"modelForwards":0,"actualCounts":trial.counts,
            "counts":{"generator":end,"discriminator":end},"checkpoint":ck,"checkpointVerification":verification,
            "historySha256":trial.history_hash,"trainingRows":rows,"validation":None,"stateDigest":states,
            "developmentIds":dev,"peaks":inspect()}


def main():
    import torch
    import psutil
    import shutil
    sys.path.insert(0,str(ROOT/".runtime/ai-painter/controller-repair-reviews/native-p86-telemetry-196-20261103"))
    from safety import limit_tree
    c.need(len(sys.argv)==3 and sys.argv[1] in ("--segment","--cpu-segment","--verify-final"),"expected bounded segment command")
    cpu=sys.argv[1]=="--cpu-segment";n=int(sys.argv[2])
    c.need(str(n)==sys.argv[2] and len(sys.argv[2])<=2,"canonical segment number")
    root=c.CPU_RUN if cpu else c.RUN;folder=root/"segments"/f"{n:02d}"
    policy=c.WORK/"task-alignment.json" if cpu else c.POLICY
    final=sys.argv[1]=="--verify-final"
    policy_sha=c.binding(policy)["sha256"]
    t=c.final_ticket(n,policy_sha,time.time()) if final else c.verify_ticket(root,n,cpu=cpu,policy_sha=policy_sha,current_time=time.time())
    c.need(psutil.virtual_memory().available>= (10 if cpu else 13)*2**30 and shutil.disk_usage(root).free>=2*2**30,"entry headroom")
    inspect=limit_tree();torch.set_num_threads(2);torch.set_num_interop_threads(2)
    start=time.monotonic();started=c.now()
    try:
        if cpu:
            value=cpu_segment(t,root,folder,inspect)
        else:
            from ai_painter.complete_world.native_stage0_formal_device import device_segment,final_readback
            value=(final_readback if final else device_segment)(t,root,folder,inspect)
        value.update(runId=c.RUN_ID,phase=t["phase"],segment=n,startPair=t["startPair"],endPair=t["endPair"],
                     workerPid=os.getpid(),policySha256=policy_sha,ticket=c.binding(folder/("final-readback-ticket.json" if final else "ticket.json")),
                     startedAtUtc=started,finishedAtUtc=c.now(),elapsedSeconds=time.monotonic()-start)
        c.publish(folder/("final-readback-result.json" if final else "result.json"),c.encoded(value),root)
    except BaseException as exc:
        path=folder/("final-readback-failure.json" if final else "worker-failure.json")
        if not path.exists():
            try:c.publish(path,c.encoded({"pid":os.getpid(),"segment":n,"atUtc":c.now(),"errorType":type(exc).__name__,"detail":str(exc)[:4096]}),root)
            except Exception as secondary:
                exc.add_note("Could not write worker-failure metadata: "+str(secondary)[:400])
        raise


if __name__=="__main__":main()
