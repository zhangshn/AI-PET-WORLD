"""Fixed local Stage0 execution domain, ticket and immutable boundary checks."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import threading

ROOT = Path(__file__).resolve().parents[5]
WORK = ROOT / ".runtime/ai-painter/controller-repair-reviews/native-stage0-formal-training-229-20261103"
RUN_ID = "stage0-native-256-formal-229"
RUN = ROOT / ".runtime/ai-painter/native-stage0-formal-training" / RUN_ID
CPU_RUN = WORK / "service/cpu-fixture"
POLICY = ROOT / "data/ai-painter/system-governance/ai-painter-native-stage0-formal-training-v1.json"
ACTIVE = ROOT / ".runtime/ai-painter/owned-worker-guards/active.json"
MIB = 2**20
WRITE_LOCK = threading.RLock()


def need(value, reason):
    if not value:
        raise ValueError("native_stage0_formal/" + reason)


def now():
    return datetime.now(timezone.utc).isoformat()


def timestamp(text):
    value = datetime.fromisoformat(text.replace("Z", "+00:00"))
    need(value.tzinfo is not None, "UTC timestamp missing offset")
    return value.timestamp()


def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def read(path, limit=2*MIB):
    need(path.is_file() and path.stat().st_size <= limit, "missing or oversized " + path.name)
    return json.loads(path.read_bytes())


def binding(path):
    with path.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    return {"path": path.relative_to(ROOT).as_posix(), "sha256": digest, "bytes": path.stat().st_size}


def bound(ref, expected):
    need(type(ref) is dict and ref == binding(expected), "immutable reference changed: " + expected.name)
    return expected


def usage(root):
    # The production RUN is an explicitly registered volume; descendants cannot redirect reads/writes.
    total = 0
    for directory, dirs, names in os.walk(root):
        for name in dirs:
            child = Path(directory)/name
            need(not child.is_symlink() and not (getattr(child.stat(follow_symlinks=False), "st_file_attributes", 0) & 1024), "redirected output directory")
        for name in names:
            p = Path(directory)/name
            try:
                s = p.stat(follow_symlinks=False)
            except FileNotFoundError:
                continue  # concurrent atomic heartbeat or verified service GC
            need(not (getattr(s,"st_file_attributes",0) & 1024), "redirected output file")
            total += s.st_size
    return total


def room(root, additional=0, reserve=0):
    used = usage(root)
    need(used + additional + reserve <= 128*MIB, "128MiB output budget")
    return used


def publish(path, raw, root, *, reserve=0, replace=False):
    need(path.is_relative_to(root) and isinstance(raw, bytes), "output location or bytes")
    with WRITE_LOCK:
        room(root, len(raw), reserve)
        temp = path.with_name("." + path.name + "." + str(os.getpid()) + ".pending")
        with temp.open("xb") as f:
            f.write(raw); f.flush(); os.fsync(f.fileno())
        if replace:
            os.replace(temp, path)
        else:
            # Windows os.rename refuses an existing destination and moves same-volume bytes without a second copy.
            need(os.name == "nt", "require registered Windows atomic publication")
            os.rename(temp,path)
    return binding(path)


def verify_ticket(root, segment, *, cpu, policy_sha, current_time):
    need(root == (CPU_RUN if cpu else RUN) and type(segment) is int and 1 <= segment <= (2 if cpu else 48), "ticket root/segment")
    directory=root/"segments"/f"{segment:02d}"; ticket_file=directory/"ticket.json"; t=read(ticket_file)
    phase="cpu_rehearsal" if cpu else "train"
    need(all(type(t[k]) is int for k in ("segment","startPair","endPair","ownerRunnerPid")) and t["runId"]==RUN_ID and t["phase"]==phase and t["segment"]==segment and
         t["startPair"]==(segment-1)*24 and t["endPair"]==segment*24 and t["policySha256"]==policy_sha,"ticket counted business identity")
    start,deadline,overall=[timestamp(t[k]) for k in ("issuedAtUtc","segmentDeadlineUtc","runDeadlineUtc")]
    need(start<=current_time<deadline<=overall and deadline-start<=840.001 and overall-start<=32400.001,"segment or overall window")
    owned=read(ACTIVE)
    need(type(t["ownerRunnerPid"]) is int and t["ownerRunnerPid"]==owned["runnerPid"] and owned["executableSha256"]==binding_external_python(),"live resource owner")
    previous=t["previous"]
    if segment==1:
        need(previous is None,"fresh run cannot accept a parent")
    else:
        prev=root/"segments"/f"{segment-1:02d}"
        seal=read(bound(previous["receipt"],prev/"seal.json"))
        result=read(bound(seal["result"],prev/"result.json"))
        own=read(bound(seal["ownership"],prev/"ownership.json"))
        o=own["receipt"];p=o["proof"]
        need(own["ok"] and o["ownerClosed"] and o["cleanupConfirmed"] and o["guardReleaseConfirmed"] and o["liveOwnerCleanupConfirmed"] and
             p["exitCode"]==p["activeProcessesAfterCleanup"]==0 and p["assignedBeforeResume"] and p["killOnJobClose"] and
             o["guard"]["identity"]==seal["guardIdentity"],"previous job not proven closed")
        need(seal["mode"]==phase and seal["runId"]==RUN_ID and seal["segment"]==segment-1 and seal["endPair"]==t["startPair"] and
             seal["workerPid"]==result["workerPid"]==p["rootPid"] and seal["checkpoint"]==result["checkpoint"]==previous["checkpoint"],"previous result identity")
        bound(previous["checkpoint"],prev/"recovery.pt")
    return t


def binding_external_python():
    import sys
    with open(sys.executable,"rb") as stream:
        return hashlib.file_digest(stream,"sha256").hexdigest()


def final_ticket(segment,policy_sha,current_time):
    need(segment==48,"only the final stage checkpoint is independently verified")
    folder=RUN/"segments/48"; t=read(folder/"final-readback-ticket.json")
    need(t["runId"]==RUN_ID and t["phase"]=="verify_final" and t["segment"]==48 and t["startPair"]==t["endPair"]==1152 and
         t["policySha256"]==policy_sha,"final readback identity")
    begin,stop,overall=(timestamp(t[k]) for k in ("issuedAtUtc","segmentDeadlineUtc","runDeadlineUtc"))
    need(begin<=current_time<stop<=overall and stop-begin<=120.001,"readback quota")
    guard=read(ACTIVE);need(t["ownerRunnerPid"]==guard["runnerPid"] and guard["executableSha256"]==binding_external_python(),"readback owner")
    prev=t["previous"];seal=read(bound(prev["receipt"],folder/"seal.json")); result=read(bound(seal["result"],folder/"result.json"))
    previous_job=read(bound(seal["ownership"],folder/"ownership.json"))
    rc=previous_job["receipt"]
    need(previous_job["ok"] and rc["cleanupConfirmed"] and rc["guardReleaseConfirmed"] and rc["proof"]["exitCode"]==rc["proof"]["activeProcessesAfterCleanup"]==0 and
         seal["runId"]==RUN_ID and seal["mode"]=="train" and seal["segment"]==48 and seal["endPair"]==1152 and
         seal["checkpoint"]==result["checkpoint"]==prev["checkpoint"] and result["counts"]=={"generator":1152,"discriminator":1152},"incomplete terminal training")
    bound(prev["checkpoint"],folder/"recovery.pt");return t


def primitive_modes(value):
    out=[]
    for net in value:
        row={}
        for group in ("modules","requiresGrad"):
            items=[]
            for name, flag in net[group]:
                need(type(name) is str and type(flag) is bool,"invalid native mode")
                items.append([name,flag])
            row[group]=items
        out.append(row)
    return out


def state_digests(trial):
    import torch
    from .native_stage0_training import rng,modes
    from .native_training_step_v6 import state_fingerprints
    values={"networks":[state_fingerprints(n.state_dict()) for n in (trial.g,trial.d)],
            "adamw":[state_fingerprints(o.state_dict()) for o in (trial.go,trial.do)],
            "rng":state_fingerprints(rng()),
            "cudaRng":state_fingerprints(torch.cuda.get_rng_state(0)) if next(trial.g.parameters()).is_cuda else None,
            "modes":primitive_modes(modes((trial.g,trial.d))),"counts":dict(trial.counts),"history":trial.history_hash}
    return {k:hashlib.sha256(encoded(v)).hexdigest() for k,v in values.items()}
