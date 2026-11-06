"""Reconstruct the native Painter input for the first committed weather day."""
from copy import deepcopy
from hashlib import sha256
from io import BytesIO
from pathlib import Path

from .natural_world_input_v1 import NaturalWorldModelInput, _Reader, _digest

OUTPUT = ".runtime/ai-painter/controller-repair-reviews/world-current-map-189-20261103/run"
DESCRIPTOR_PATH = OUTPUT + "/natural-current-input.json"
INITIAL_DESCRIPTOR_SHA = "088e9034df56fdc8569e8c786f9e293db15d516aed69ed61065819ec120301e8"
NATIVE_CONTRACT_SHA = "c8941c7730edb73c0b0a733bc877cf550184e2f3ab2adb08102fb0214d38cac2"
STORE_PATH = "data/world-runtime/mvp-natural-owner-001/mvp-natural-world-001.json"


def require(value, message):
    if not value:
        raise ValueError(message)


def load_current_natural_world_input(*, root, descriptor_binding, stage=2):
    require(stage == 2 and descriptor_binding.get("path")==DESCRIPTOR_PATH, "fixed native current-world descriptor required")
    reader=_Reader(Path(root))
    desc=reader.json(descriptor_binding)
    require(desc["schemaVersion"]=="natural-world-current-visual-input-v1" and desc["scope"]=="committed_first_weather_day_diagnostic"
            and desc["qualification"]=="diagnostic_input_only","current diagnostic scope differs")
    require((desc["stage"],desc["width"],desc["height"])==(2,1024,768),"native geometry differs")
    require(desc["initialDescriptor"]["sha256"]==INITIAL_DESCRIPTOR_SHA and desc["conditionContract"]["sha256"]==NATIVE_CONTRACT_SHA,
            "unregistered input lineage")
    require(desc["store"]["path"]==STORE_PATH,"wrong current Store")
    live=reader.json(desc["store"])
    original=reader.json(desc["initialDescriptor"])
    require(desc["initialTask"]==original["bindings"]["taskPackage"],"director lineage differs")
    task=reader.json(desc["initialTask"])
    require(original["tick"]==task["tick"]==0 and original["identity"]==desc["identity"],"wrong baseline world")
    require(all(live[k]==v for k,v in original["identity"].items()),"current Store identity differs")
    require(all(live[k]==desc[k] for k in ("tick","eventCursor","stateVersion","recordContentSha256","statePayloadSha256")) and
            (live["tick"],live["stateVersion"],live["eventCursor"],live["worldState"]["tick"],live["worldFacts"]["tick"])==(1,2,2,1,1),
            "current Store version differs")
    require(live["worldFactsPayloadSha256"]==desc["factHash"],"current fact identity differs")
    require(desc["weatherResult"]["path"]==".runtime/ai-painter/world-first-weather-runtime/v3/result.json","weather result path differs")
    result=reader.json(desc["weatherResult"])
    require(result["scope"]=="production" and result["receipt"]["identity"]==desc["identity"] and
            result["fileSha256"]==desc["store"]["sha256"] and
            [result[k] for k in ("tick","stateVersion","eventCursor")]==[1,2,2],"current weather transaction differs")
    require(desc["scopeRelease"]==result["scopeRelease"] and desc["scopeRelease"]["path"]==
            "data/ai-painter/capability-releases/sakaerat-weather-153-runtime-v3/release.json","weather release differs")
    release=reader.json(desc["scopeRelease"])
    require(release["capabilityScope"]=="world_evolution" and release["ticketIssuer"] is None,"weather release scope differs")
    evolution=live["worldState"]["payload"]["environment"]["evolution"]
    require(desc["currentWeather"]==evolution["weather"]==result["weather"] and desc["logicalEndUtc"]==evolution["logicalEndUtc"],
            "current weather facts differ")
    require(desc["weatherFieldsEncoded"]==[] and desc["temperatureOrRainOverlay"] is False,"unsupported weather rendering")
    facts=live["worldFacts"]["payload"]
    require(_digest(facts)==desc["geometrySha256"],"current spatial geometry digest differs")
    require(facts==task["spatialLayers"] and live["worldState"]["payload"]["objects"]==facts["objectFootprints"] and
            live["worldState"]["payload"]["resources"]==[],"spatial or object state differs")
    regime=desc["renderInputs"]
    require(regime["season"]==live["worldState"]["payload"]["environment"]["seasonScenario"]==original["ecology"]["seasonScenario"] and
            regime["regionalLandscapeType"]==task["directorPlan"]["singleMapEcologyPlan"]["regionalLandscapeType"]==original["ecology"]["regionalLandscapeType"],
            "appearance or ecology regime differs")
    contract=reader.json(desc["conditionContract"])
    order=contract["tensorContract"]["channelOrder"]
    require(len(set(order))==23 and order==[c["id"] for c in desc["channels"]]==[c["id"] for c in original["channels"]],"channel order differs")
    table=[dict(value=i+1,**{k:obj[k] for k in ("objectId","kind","footprint","blocksMovement")}) for i,obj in enumerate(facts["objectFootprints"])]
    require(table==desc["objectInstanceTable"]==original["objectInstanceTable"],"current object table differs")
    import numpy as np
    import torch
    from PIL import Image
    from .native_stage_geometry_v1 import NativeStageGeometry
    from .object_appearance_regime_input_cpu import encode_season
    from .object_ecology_regime_input_cpu import encode_ecology
    from .object_instance_supervision_cpu import iter_object_views

    tensors=[]
    for name,current,baseline in zip(order,desc["channels"],original["channels"]):
        require(current["path"]==f"{OUTPUT}/channels/{name}.png" and current["dtype"]=="uint8"
                and current["nativeShape"]==[1,768,1024] and current["kind"]==baseline["kind"],"current channel metadata differs")
        with Image.open(BytesIO(reader.bytes(current))) as image, Image.open(BytesIO(reader.bytes(baseline))) as old:
            require(image.format==old.format=="PNG" and image.size==old.size==(1024,768) and image.mode==old.mode=="L","channel image differs")
            pixels=image.tobytes()
            require(sha256(pixels).hexdigest()==current["pixelSha256"] and pixels==old.tobytes(),"spatial pixels differ from verified unchanged geometry")
            tensors.append(torch.from_numpy(np.frombuffer(pixels,dtype=np.uint8).copy()).reshape(768,1024).float().div(255))
    tensor=torch.stack(tensors).contiguous()
    geometry=NativeStageGeometry(2)
    require(tensor.shape==(23,768,1024) and tensor.device.type=="cpu" and tensor.dtype==torch.float32
            and not tensor.requires_grad and bool(torch.isfinite(tensor).all()),"native tensor differs")
    require(sum(1 for _ in iter_object_views(tensor,table,order,geometry=geometry))==len(table),"object instance missing in native channel")
    reader.verify(desc["store"])
    return NaturalWorldModelInput(conditions=tensor.unsqueeze(0),instance_table=deepcopy(table),
        appearance_regime=encode_season(regime["season"]["season"]),ecology_regime=encode_ecology(regime["regionalLandscapeType"]),
        geometry=geometry,identity=deepcopy(desc["identity"]),provenance={
            "scope":desc["scope"],"tick":1,"stateVersion":2,"eventCursor":2,"factHash":desc["factHash"],
            "statePayloadSha256":desc["statePayloadSha256"],"weather":deepcopy(desc["currentWeather"]),
            "descriptor":dict(descriptor_binding),"weatherFieldsEncoded":[],"executionQualificationGranted":False},
        consumed_bindings=reader.receipts)
