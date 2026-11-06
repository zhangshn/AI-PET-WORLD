"""Fixed released train membership. Decoding has no model, subprocess or GPU dependency."""
from copy import deepcopy
import hashlib
from io import BytesIO
import json
from pathlib import Path

from .native_stage_geometry_v1 import NativeStageGeometry
from .object_appearance_regime_input_cpu import SEASONS
from .object_ecology_regime_input_cpu import ECOLOGIES
from .split_release import bound_json, canonical_bytes, read_bound

MANIFEST = {"path": "data/world-samples/ai-assisted-cold-start-dataset-packages/stage4-src64-4c32aee371b5fcaaa36b316199c7e7560892af7c0a5b908cfd6a6d44b4f0e6f7/manifest.json",
            "sha256": "499daf40061da91ce1e367ee5c4e3493491b5e5c1701806d8c4246502e73cd23"}
BASELINE = {"path": ".runtime/ai-painter/controller-repair-reviews/native-stage0-source-gate-219-20261103/cpu-ready.json",
            "sha256": "9e7b4f567faaba6a82c603a8c3b2c6fa205b48962afe017c86bf5fef2a8036f8"}
GEOMETRY = NativeStageGeometry(1)
ROLES = {"tree":"object_tree", "rock":"object_rock", "shrub":"object_vegetation", "grass_detail":"object_vegetation"}


def need(value, message):
    if not value:
        raise ValueError("native_stage1_source: "+message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def plane(raw, mode, resampling):
    import numpy as np
    from PIL import Image
    with Image.open(BytesIO(raw)) as image:
        need(image.format == "PNG" and image.mode == mode and image.size == (1024,768), "native PNG dimensions/mode")
        values = np.asarray(image.resize((GEOMETRY.width,GEOMETRY.height), resample=resampling), dtype=np.uint8)
        return values.copy()


def object_geometry(channels, table, order):
    """Check authoritative role masks and the original stage-scaled local patch from sampled instance labels."""
    import numpy as np
    label = channels[order.index("object_instance")]
    need(list(sorted(set(np.unique(label))-{0})) == list(range(1,len(table)+1)), "instance labels missing or foreign")
    need(np.array_equal(label>0,channels[order.index("object_footprints")]==255), "footprint membership")
    need(np.isin(channels[order.index("object_footprints")], [0,255]).all(), "non-binary footprints")
    for role in set(ROLES.values()):
        ids = [r["value"] for r in table if ROLES[r["kind"]] == role]
        need(np.array_equal(channels[order.index(role)],np.isin(label,ids).astype(np.uint8)*255),"object role "+role)
    rows = []
    for i,r in enumerate(table,1):
        need(r["value"] == i and r["kind"] in ROLES, "instance order")
        f = r["footprint"]; x,y,w,h = [f[k] for k in ("x","y","width","height")]
        need(all(type(v) is int for v in (x,y,w,h)) and min(x,y)>=0 and min(w,h)>0 and x+w<=1024 and y+h<=768,"source footprint")
        yy,xx = np.where(label==i)
        l,t,right,bottom = (int(xx.min()),int(yy.min()),int(xx.max()),int(yy.max()))
        centres = [float(GEOMETRY.native_pixel_centers(n)) for n in (l,t,right,bottom)]
        tol = GEOMETRY.native_half_pixel_tolerance
        need(centres[0]>=x-tol and centres[1]>=y-tol and centres[2]<=x+w+tol and centres[3]<=y+h+tol,"native core outside source footprint")
        radius=GEOMETRY.support_radius(ROLES[r["kind"]]);size=GEOMETRY.patch_size
        px=(l+right)//2-size//2;py=(t+bottom)//2-size//2
        support=[max(0,l-radius),max(0,t-radius),min(GEOMETRY.width,right+radius+1),min(GEOMETRY.height,bottom+radius+1)]
        need(px<=support[0] and py<=support[1] and px+size>=support[2] and py+size>=support[3],"object support outside valid local patch")
        rows.append({"objectId":r["objectId"],"value":i,"kind":r["kind"],"sourceFootprint":f,"corePixels":int(xx.size),
                     "coreBoundsInclusive":[l,t,right,bottom],"nativeCoreCentreBounds":centres,
                     "patch":[px,py,size,size],"supportRadius":radius,"supportBoundsExclusive":support})
    return rows


class NativeStage1TrainSource:
    """Use read_arrays for isolated verification or __getitem__ for the same sample as CPU tensors."""
    def __init__(self, root):
        self.root=Path(root).resolve()
        self.manifest=bound_json(self.root,MANIFEST)
        m=self.manifest
        self.ids=tuple(bound_json(self.root,m["splits"]["train"])["sampleIds"])
        rows=bound_json(self.root,m["sourceIndex"])["samples"]
        self._rows=tuple(r for r in rows if r["split"]=="train")
        need(len(self.ids)==len(set(self.ids))==48 and self.ids==tuple(r["sampleId"] for r in self._rows),"released training membership/order")
        baseline=bound_json(self.root,BASELINE)
        need(baseline["manifest"]==MANIFEST and baseline["trainMembership"]==m["splits"]["train"] and tuple(baseline["historicalTrainOrder"])==self.ids,"authenticated shared lineage")
        self._originals={r["id"]:r for r in baseline["inputs"]}
        self.order=tuple(m["identityPayload"]["channelOrder"]); self.continuous=frozenset(m["identityPayload"]["continuousChannelIds"])
        need(len(set(self.order))==23 and len(self.continuous)==8 and self.continuous < set(self.order),"channel policy")
        need(set(self._originals)==set(self.ids),"frozen source identities")

    def __len__(self):
        return len(self.ids)

    def _identity(self,row,pack):
        sid=row["sampleId"]
        record=bound_json(self.root,row["sourceRecord"])
        need(row["image"]["sha256"]==record["originalImage"]["sha256"],"original source RGB")
        if "sourceCorrection" in row:
            correction=bound_json(self.root,row["sourceCorrection"]);review=bound_json(self.root,row["sourceReview"])
            need(sid=="mvp64-slot164-objects-v5-20261020" and correction["parentSampleId"]==row["parentSampleId"]
                 and correction["conditionPack"]==row["conditionPack"] and correction["image"]["sha256"]==row["image"]["sha256"]
                 and review["inputImageSha256"]==row["image"]["sha256"] and review["recordId"]==sid and review["status"]=="review_passed","source correction")
            taskref=correction["task"]
        else:
            c=bound_json(self.root,row["contribution"])
            need(c["imageSha256"]==row["image"]["sha256"] and c["conditionPackFileSha256"]==row["conditionPack"]["sha256"]
                 and c["conditionPackPath"]==row["conditionPack"]["path"] and c["conditionWorldId"]==pack["worldId"],"source contribution")
            taskref={"path":c["taskPackagePath"],"sha256":c["taskPackageSha256"]}
        task=bound_json(self.root,taskref); sources=task["sourceBindings"]
        need(taskref["path"]==pack["sourceBindings"]["taskPackagePath"] and task["taskId"]==pack["taskId"] and
             task["taskSha256"]==pack["taskSha256"] and task["worldId"]==row["grouping"]["worldId"]==pack["worldId"] and task["tick"]==pack["tick"],"world/task mismatch")
        facts=bound_json(self.root,{"path":sources["naturalizedWorldFactsPath"],"sha256":sources["naturalizedWorldFactsSha256"]})
        need(facts["v7SlotBinding"]["slotId"]==row["capacitySlotId"],"original facts slot")
        table=pack["objectInstanceTable"]; objects=task["spatialLayers"]["objectFootprints"]
        need(bool(table) and len(table)==len(objects) and all(all(r[k]==o[k] for k in ("objectId","kind","footprint","blocksMovement"))
             for r,o in zip(table,objects)),"original object table")
        ecological=pack["categoricalConditions"]["ecologyPlan"]; material=pack["categoricalConditions"]["materialPlan"]
        snapshot=bound_json(self.root,{"path":sources["seasonSnapshotPath"],"sha256":sources["seasonSnapshotSha256"]})
        region=bound_json(self.root,row["regionSource"])
        need(row["regionSource"]["path"]==sources["realEarthRegionSourcePackagePath"] and region["packageSha256"]==sources["realEarthRegionSourcePackageSha256"]
             and ecological==task["directorPlan"]["singleMapEcologyPlan"] and material==task["directorPlan"]["singleMapMaterialPlan"]
             and snapshot["environment"]["season"]==ecological["season"]==material["season"],"source season/ecology")
        return taskref,ecological

    def read_arrays(self,index):
        import numpy as np
        from PIL import Image
        need(type(index) is int and 0<=index<len(self.ids),"training index")
        row=self._rows[index];sid=self.ids[index]
        orig=self._originals[sid]
        need(row["sampleId"]==sid and row["split"]=="train" and row["image"]==orig["image"] and row["conditionPack"]==orig["pack"],"training source pair")
        pack=bound_json(self.root,row["conditionPack"]);task,eco=self._identity(row,pack)
        need(tuple(ch["id"] for ch in pack["channels"])==self.order,"channel order")
        rgb=plane(read_bound(self.root,row["image"]),"RGB",Image.Resampling.LANCZOS)
        channels=[]
        for ch in pack["channels"]:
            need(ch["shape"]==[1,768,1024] and ch["dtype"]=="uint8","channel declaration")
            channels.append(plane(read_bound(self.root,ch),"L",Image.Resampling.BILINEAR if ch["id"] in self.continuous else Image.Resampling.NEAREST))
        table=deepcopy(pack["objectInstanceTable"]);views=object_geometry(channels,table,self.order)
        season=np.eye(len(SEASONS),dtype=np.float32)[SEASONS.index(eco["season"])]
        ecology=np.eye(len(ECOLOGIES),dtype=np.float32)[ECOLOGIES.index(eco["landscapeType"])]
        stage0table=sha(json.dumps(table,sort_keys=True).encode())
        need(orig["input"]["instanceTableSha256"]==stage0table and orig["input"]["appearance_regime"]==sha(season.tobytes())
             and orig["input"]["ecology_regime"]==sha(ecology.tobytes()),"cross-resolution metadata differs")
        target=np.ascontiguousarray(rgb.transpose(2,0,1),dtype=np.float32);target/=255
        cond=np.array(channels,dtype=np.float32);cond/=255
        return {"sampleId":sid,"split":"train","image":target,"conditions":cond,"appearance_regime":season,"ecology_regime":ecology,
                "worldId":pack["worldId"],"objectInstanceTable":table,"native_stage_geometry":GEOMETRY,"sourceImage":dict(row["image"]),
                "conditionPack":dict(row["conditionPack"]),"taskPackage":task,"geometryChecks":views,"corrected":"sourceCorrection" in row,
                "channelBindings":[{"id":ch["id"],"path":ch["path"],"sha256":ch["sha256"]} for ch in pack["channels"]]}

    def __getitem__(self,index):
        import torch
        from .native_rgb_structured_object_cpu_v17 import validate_bound_object_views
        sample=self.read_arrays(index)
        for k in ("image","conditions","appearance_regime","ecology_regime"):
            sample[k]=torch.from_numpy(sample[k])
        views=validate_bound_object_views(sample["conditions"],sample["objectInstanceTable"],self.order,geometry=GEOMETRY)
        need(len(views)==len(sample["geometryChecks"]),"native consumer object views")
        return sample

    def authenticated_training_sample(self,index):
        """Use on the training side when a native loss requires original private binding tokens.

        Original provenance validation may launch its registered Node canonicalizer. The
        isolated data-proof job only calls read_arrays and never enters this method.
        """
        import sys
        scripts=str(self.root/"ml/ai-painter/scripts")
        if scripts not in sys.path:
            sys.path.insert(0,scripts)
        from check_stage4_mvp_structured_object_v18_cpu_acceptance import BoundReader
        from painter_stage4_appearance_regime_probe import derive_regime_record
        from painter_stage4_decode1_entry_weight_training_profile_v1 import bind_sample_ecology, validate_sample_ecology
        sample=self[index]
        reader=BoundReader(self.root)
        identity={"sampleId":sample["sampleId"],"split":"train","worldId":sample["worldId"],
                  "conditionPack":sample["conditionPack"],"taskPackage":sample["taskPackage"]}
        regime,_,_=derive_regime_record(reader,identity)
        bound=bind_sample_ecology(reader,sample,identity,regime)
        season,ecology=validate_sample_ecology(bound)
        need(season.equal(sample["appearance_regime"]) and ecology.equal(sample["ecology_regime"]),"native training regime changed")
        return bound

    def describe(self,sample):
        table=sample["objectInstanceTable"]
        def h(x):return sha(x.tobytes())
        return {"kind":"sample","sampleId":sample["sampleId"],"worldId":sample["worldId"],"split":"train","geometry":list(GEOMETRY.identity()),
                "imageShape":list(sample["image"].shape),"conditionsShape":list(sample["conditions"].shape),"dtype":"float32",
                "imageSha256":h(sample["image"]),"conditionsSha256":h(sample["conditions"]),"channels":[{"id":k,"sha256":h(v),"source":b}
                    for k,v,b in zip(self.order,sample["conditions"],sample["channelBindings"])],"instanceTableSha256":sha(canonical_bytes(table)),
                "stage0InstanceTableSha256":sha(json.dumps(table,sort_keys=True).encode()),"objectCount":len(table),"geometryChecks":sample["geometryChecks"],
                "geometryChecksSha256":sha(canonical_bytes(sample["geometryChecks"])),"appearanceSha256":h(sample["appearance_regime"]),
                "ecologySha256":h(sample["ecology_regime"]),"corrected":sample["corrected"],"sourceImage":sample["sourceImage"],
                "conditionPack":sample["conditionPack"],"taskPackage":sample["taskPackage"]}
