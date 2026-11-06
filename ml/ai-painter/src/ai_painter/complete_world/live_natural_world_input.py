"""Independently read an immutable condition snapshot for the current formal first world."""
from copy import deepcopy
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import re
import sqlite3

from .natural_world_input_v1 import NaturalWorldModelInput, _Reader, _digest

WORLD="mvp-natural-world-001"
STORE="data/world-runtime/mvp-natural-owner-001/"+WORLD+".json"
ARCHIVE=".runtime/ai-painter/natural-world-live-map-inputs/"+WORLD
REGISTRY="data/ai-painter/system-governance/ai-painter-capability-release-registry-v2.json"
PROFILES={"sakaerat-weather-153-runtime-v3","sakaerat-weather-153-rolling-v4","sakaerat-weather-153-scheduled-v5"}
HASH=re.compile(r"[0-9a-f]{64}")


def need(ok,message):
    if not ok:raise ValueError(message)


def descriptor_head(binding):
    name=binding.get("path") if isinstance(binding,dict) else None
    prefix=ARCHIVE+"/"
    need(isinstance(name,str) and name.startswith(prefix) and name.endswith("/input.json"),"unregistered live snapshot location")
    value=name[len(prefix):-len("/input.json")]
    need(HASH.fullmatch(value) is not None,"invalid immutable head identity")
    return value


def read_dynamic(reader,root,relative,limit):
    # The only replaceable authority records are the fixed registry and lifecycle
    # status. Resolve the permitted runtime mount once, without following links beneath it.
    if relative.startswith(".runtime/"):
        physical=(Path(root)/".runtime").resolve()/relative[len(".runtime/"):]
    else:
        physical=Path(root).resolve()/relative
    need(physical.resolve(strict=True)==physical and physical.stat().st_nlink==1 and physical.stat().st_size<=limit,
         "unsafe local authority record")
    b=physical.read_bytes()
    return json.loads(reader.bytes({"path":relative,"sha256":sha256(b).hexdigest()},limit))


def load_live_natural_world_input(*,root,descriptor_binding,stage=2):
    need(stage==2,"only registered native geometry is supported")
    head=descriptor_head(descriptor_binding);root=Path(root);reader=_Reader(root)
    desc=reader.json(descriptor_binding)
    need(desc["schemaVersion"]=="natural-world-live-map-input-v1" and desc["qualification"]=="current_conditions_only"
         and desc["nativeShape"]==[1,23,768,1024] and desc["stage"]==2,"invalid native live snapshot")
    need(desc["head"]=={"path":STORE,"sha256":head},"wrong live Store")
    saved=reader.json(desc["head"])
    need(saved["worldId"]==WORLD and saved["ownerId"]=="mvp-natural-owner-001" and saved["playerId"]=="mvp-natural-player-001","foreign world namespace")
    identity={k:saved[k] for k in ("ownerId","playerId","worldId","worldSeed","worldProfileId","regionId")}
    need(identity==desc["identity"],"wrong visual world identity")
    current=[saved[k] for k in ("tick","stateVersion","eventCursor")]
    need(current==[desc[k] for k in ("tick","stateVersion","eventCursor")],"stale visual snapshot")
    need(desc["factHash"]==saved["worldFactsPayloadSha256"] and desc["statePayloadSha256"]==saved["statePayloadSha256"]
         and desc["recordContentSha256"]==saved["recordContentSha256"],"Store digest fields differ")
    evolution=saved["worldState"]["payload"]["environment"]["evolution"];commit=evolution["commit"]
    prior_key=commit["businessKey"]
    area=STORE+".evolution/"
    need(HASH.fullmatch(prior_key) and HASH.fullmatch(commit["eventSha256"]),"invalid native event identity")
    def pathcheck(binding,expected):
        need(binding["path"]==expected,"native provenance path differs: "+expected)
        return reader.json(binding)
    event=pathcheck(desc["event"],area+prior_key+"."+commit["eventSha256"]+".event.json")
    receipt=pathcheck(desc["receipt"],area+prior_key+".receipt.json")
    need(event["eventKind"]=="evolution" and event["identity"]==receipt["identity"]==identity and event["businessKey"]==receipt["businessKey"]==prior_key
         and receipt["fileSha256"]==head and receipt["eventSha256"]==event["eventSha256"]==commit["eventSha256"],"unverified head receipt")
    need(current==[receipt["tick"],receipt["stateVersion"],receipt["eventCursor"]]==[event["toTick"],event["toStateVersion"],event["cursor"]],"event clock differs")
    need(pathcheck(desc["currentSnapshot"],area+prior_key+"."+head+".record.json")==saved,"immutable native Store copy differs")
    before_sha=event["before"]["expectedFileSha256"]
    before=pathcheck(desc["previousSnapshot"],area+prior_key+"."+before_sha+".before.json")
    need(desc["previousSnapshot"]["sha256"]==before_sha and all(before[k]==identity[k] for k in identity),"wrong prior world snapshot")
    previous=before["worldState"]["payload"]["environment"]["evolution"]["commit"]
    pe=pathcheck(desc["priorEvent"],area+previous["businessKey"]+"."+previous["eventSha256"]+".event.json")
    pr=pathcheck(desc["priorReceipt"],area+previous["businessKey"]+".receipt.json")
    need(pr["fileSha256"]==before_sha and pe["eventSha256"]==pr["eventSha256"]==previous["eventSha256"]==event["previousEventSha256"]
         and pe["identity"]==pr["identity"]==identity and event["fromTick"]==before["tick"] and event["fromStateVersion"]==before["stateVersion"],
         "prior head receipt differs")
    scope=event["evidence"]["capabilityRef"];version=scope["version"]
    need(version in PROFILES and scope["id"]=="data/ai-painter/capability-releases/"+version+"/release.json","unsupported event authority")
    def from_ref(value):return {"path":value["id"],"sha256":value["sha256"]}
    need(desc["capabilityRelease"]==from_ref(scope),"foreign evolution release")
    release=reader.json(desc["capabilityRelease"]);registry=read_dynamic(reader,root,REGISTRY,1<<21)
    need(release["capabilityReleaseIdentity"]==release["modelCapabilityVersion"]==version,"weather release identity differs")
    need(set(release["bindings"])=={"datasetRelease","modelArtifact","reviewContract","runtimeInterfaceContract","conditionContract"},
         "weather release binding roles differ")
    matches=[r for r in registry["releaseRecords"] if r["capabilityReleaseIdentity"]==version]
    need(len(matches)==1 and matches[0]["status"]=="released_trusted" and matches[0]["releasePath"]==scope["id"] and matches[0]["releaseSha256"]==scope["sha256"]
         and release["capabilityScope"]=="world_evolution" and release["ticketIssuer"] is None,"weather release not trusted")
    adjudication=reader.json(release["machineReleaseAdjudication"])
    need(adjudication["status"]=="released" and adjudication["capabilityReleaseIdentity"]==version and adjudication["capabilityScope"]=="world_evolution"
         and matches[0]["machineReleaseAdjudicationSha256"]==release["machineReleaseAdjudication"]["sha256"]
         and adjudication["bindingSetSha256"]==matches[0]["bindingSetSha256"]==_digest(release["bindings"]),"weather adjudication differs")
    for r in release["bindings"].values():reader.verify({"path":r["path"],"sha256":r["sha256"]})
    ledger=(root/".runtime").resolve()/"ai-painter/capability-release-ledger.sqlite"
    need(ledger.resolve(strict=True)==ledger and ledger.stat().st_nlink==1,"weather ledger path differs")
    dbconn=sqlite3.connect(ledger.as_uri()+"?mode=ro",uri=True)
    try:
        evidence=dbconn.execute("SELECT release_path,release_sha256,registry_revision,owner_decision_used FROM releases WHERE capability_release_identity=?",(version,)).fetchall()
    finally:dbconn.close()
    need(evidence==[(scope["id"],scope["sha256"],matches[0]["registryRevision"],0)],"weather ledger differs")
    lifecycle=".runtime/ai-painter/capability-lifecycle/"+version
    state=read_dynamic(reader,root,lifecycle+"/state.json",65536)
    db=(root/(lifecycle+"/lifecycle.sqlite")).resolve(strict=True)
    need(db.is_relative_to((root/".runtime").resolve()) and db.stat().st_nlink==1,"weather lifecycle database path differs")
    conn=sqlite3.connect(db.as_uri()+"?mode=ro",uri=True)
    try:sql=conn.execute("SELECT state FROM capabilities WHERE capability_version=?",(version,)).fetchall()
    finally:conn.close()
    need(sql==[("released",)] and state["state"]=="released" and state["releaseIdentity"]==version,"weather capability rolled back or inactive")
    for k,role in (("modelRef","modelArtifact"),("policyRef","reviewContract")):
        selected=event["evidence"][k] if k=="modelRef" else event[k]
        registered=release["bindings"][role]
        need(from_ref(selected)=={v:registered[v] for v in ("path","sha256")},"event authority binding differs")
    need(desc["weatherInput"]==from_ref(event["evidence"]["inputRef"]) and desc["weatherOutput"]==from_ref(event["evidence"]["outputRef"]),"model evidence differs")
    wi,wo=reader.json(desc["weatherInput"]),reader.json(desc["weatherOutput"])
    weather=evolution["weather"]
    need(wi["before"]["fileSha256"]==before_sha and wi["identity"]==identity and wi["interval"]==event["interval"]==weather["period"]
         and wo["inputSha256"]==desc["weatherInput"]["sha256"] and wo["checkpointSha256"]==event["evidence"]["modelRef"]["sha256"]
         and wo["values"]==weather["values"] and wo["modelForwards"]==1 and wo["trainingUpdates"]==0,"weather-model evidence differs")
    need(weather==desc["weather"] and weather["origin"]=="model_predicted" and desc["logicalEndUtc"]==evolution["logicalEndUtc"]
         and desc["encodedDailyWeatherFields"]==[],"unregistered weather appearance")
    facts=saved["worldFacts"]["payload"]
    need(facts==before["worldFacts"]["payload"] and _digest(facts)==desc["geometrySha256"],"weather changed spatial facts")
    def stored(role):
        found=[r for r in saved["sourceBindings"] if r["role"]==role]
        need(len(found)==1,"ambiguous/missing initial source "+role)
        return {"path":found[0]["uri"],"sha256":found[0]["fileSha256"]}
    origins=desc["creation"]
    roles={"natural_source_fact_release","natural_generated_facts","world_director","visual_generation_task","condition_package"}
    need(set(origins)==roles and all(b==stored(k) for k,b in origins.items()),"creation source binding differs")
    generated=reader.json(origins["natural_generated_facts"]);task=reader.json(origins["visual_generation_task"])
    director=reader.json(origins["world_director"]);pack=reader.json(origins["condition_package"]);initial=reader.json(origins["natural_source_fact_release"])
    need(all(generated["geometry"][k]==v for k,v in facts.items()) and generated["identity"]==identity and task["spatialLayers"]==facts
         and director==task["directorPlan"] and initial["generatedFactsBinding"]["sha256"]==origins["natural_generated_facts"]["sha256"],"creation geometry differs")
    need(saved["worldState"]["payload"]["objects"]==facts["objectFootprints"] and saved["worldState"]["payload"]["resources"]==[],"unsupported object state")
    need(desc["contract"]=={"path":pack["identityBindings"]["conditionContractPath"],"sha256":pack["identityBindings"]["conditionContractSha256"]},
         "wrong spatial channel contract")
    contract=reader.json(desc["contract"]);order=contract["tensorContract"]["channelOrder"]
    need(len(set(order))==23 and order==[c["id"] for c in desc["channels"]],"wrong channel order")
    regime=desc["renderInputs"]
    need(regime["season"]==generated["environment"]["seasonScenario"]==saved["worldState"]["payload"]["environment"]["seasonScenario"]
         and regime["regionalLandscapeType"]==generated["regionalLandscapeType"]==director["singleMapEcologyPlan"]["regionalLandscapeType"],"regime differs")
    table=[dict(value=i+1,**{k:o[k] for k in ("objectId","kind","footprint","blocksMovement")}) for i,o in enumerate(facts["objectFootprints"])]
    need(table==desc["objectInstanceTable"]==pack["objectInstanceTable"],"object identity table differs")
    from PIL import Image
    import torch
    import numpy as np
    from .native_stage_geometry_v1 import NativeStageGeometry
    from .object_appearance_regime_input_cpu import encode_season
    from .object_ecology_regime_input_cpu import encode_ecology
    from .object_instance_supervision_cpu import ROLE_BY_KIND,iter_object_views
    need(all(o["kind"] in ROLE_BY_KIND for o in table),"unsupported object class")
    channels=[]
    for c in desc["channels"]:
        name=c["id"];old=stored("condition_channel_"+name)
        need(c["initialSpatialSource"]==old and c["path"]==ARCHIVE+"/"+head+"/channels/"+name+".png","wrong channel source or archive")
        with Image.open(BytesIO(reader.bytes(c))) as image,Image.open(BytesIO(reader.bytes(old))) as initial_im:
            need(image.mode==initial_im.mode=="L" and image.format==initial_im.format=="PNG" and image.size==initial_im.size==(1024,768),"non-native spatial channel")
            pixels=image.tobytes()
            need(sha256(pixels).hexdigest()==c["pixelSha256"] and initial_im.tobytes()==pixels,"unverified weather-invariant spatial pixels")
            channels.append(torch.from_numpy(np.frombuffer(pixels,dtype=np.uint8).copy()).reshape(768,1024).float().div(255))
    tensor=torch.stack(channels).contiguous();geometry=NativeStageGeometry(2)
    need(tensor.dtype==torch.float32 and tensor.device.type=="cpu" and not tensor.requires_grad and bool(torch.isfinite(tensor).all())
         and sum(1 for _ in iter_object_views(tensor,table,order,geometry=geometry))==len(table),"native instance/tensor mismatch")
    reader.verify(desc["head"])
    return NaturalWorldModelInput(conditions=tensor.unsqueeze(0),instance_table=deepcopy(table),appearance_regime=encode_season(regime["season"]["season"]),
        ecology_regime=encode_ecology(regime["regionalLandscapeType"]),geometry=geometry,identity=deepcopy(identity),
        provenance={"scope":"current_committed_world_conditions","tick":current[0],"stateVersion":current[1],"eventCursor":current[2],
          "snapshot":dict(descriptor_binding),"eventSha256":event["eventSha256"],"factHash":desc["factHash"],"release":from_ref(scope),
          "committedWeather":weather,"weatherFieldsEncoded":[],"executionQualificationGranted":False},consumed_bindings=reader.receipts)
