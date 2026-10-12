"""Synthetic adapter checks; no real model/data/GPU or publication claim."""
from copy import deepcopy
import io
import unittest
from unittest.mock import patch
from types import SimpleNamespace
import torch
from ai_painter.complete_world import detail_weight_managed_checkpoint as codec
import painter_stage4_v24_dry_single_world_checkpoint_worker as shared


def configuration():
    import json
    candidate=json.loads((shared.ROOT / codec.CANDIDATE_PATH).read_bytes())
    return {"schema":"detail-weight-managed-configuration-v1","capabilityVersion":codec.CAPABILITY,
        "sourceCandidate":{"path":codec.CANDIDATE_PATH,"sha256":"a"*64},"formalSpecification":{"path":codec.SPEC_PATH,"sha256":codec.SPEC_SHA},
        "executionCeiling":deepcopy(shared.RESOURCE_CEILING),"checkpointSelection":deepcopy(shared.SELECTION_CONTRACT),
        "scope":candidate["scope"],"dataUse":candidate["dataUse"],"seed":20260929,"gpuAdmissionSeconds":600,
        "freshInitializationOnly":True,"historicalCheckpointMayInitialize":False,"automaticResumeAllowed":False,
        "optimizer":deepcopy(shared.v24.core.TRAINING["optimizer"])}


def selection(epoch=24):
    return {"epoch":epoch,"worstApplicableObjectCorrelation":.1,"meanValidationRgbMae":.2,
        "applicableImageCounts":{r:1 for r in shared.OBJECT_CHANNELS},"rank":[.1,-.2,-epoch],
        "qualificationGranted":False,"checkpointPromotionEligible":False}


class ConfigurationTests(unittest.TestCase):
    def test_normative_configuration_and_strict_actual_counts(self):
        c=configuration();codec.validate_selection(c,"synthetic-run",24,selection(),{"generator":1152,"discriminator":1152})
        for counts in ({"generator":True,"discriminator":1152},{"generator":1151,"discriminator":1152},{"generator":1152.,"discriminator":1152}):
            with self.assertRaises(ValueError):codec.validate_selection(c,"synthetic-run",24,selection(),counts)
        for key,value in (("executionCeiling",{}),("checkpointSelection",{}),("automaticResumeAllowed",True),("seed",True),("gpuAdmissionSeconds",601)):
            changed={**c,key:value}
            with self.assertRaises(ValueError):codec.validate_configuration(changed)
    def test_rank_epoch_and_binding_rejections(self):
        for epoch,rank in ((23,selection()),(36,selection()),(True,selection())):
            with self.assertRaises(ValueError):codec.validate_selection(configuration(),"synthetic-run",epoch,rank,{"generator":1152,"discriminator":1152})
        for path in ("../outside","/outside","C:/outside","a//b"):
            with self.assertRaises(ValueError):codec.exact_binding({"path":path,"sha256":"a"*64})
    def test_reload_postcheck_failure_restores_both_destinations(self):
        # Tiny tensors exercise transaction rollback; the production identity validator is never weakened.
        model=torch.nn.Linear(1,1,bias=False);critic=torch.nn.Linear(1,1,bias=False)
        old=[n.weight.detach().clone() for n in (model,critic)]
        graph=lambda n:[{"name":k,"shape":list(p.shape),"dtype":str(p.dtype)} for k,p in n.named_parameters()]
        def state(s,ref,label):
            if list(s)!=list(ref):raise ValueError("keys")
            return {k:v.clone() for k,v in s.items()}
        def installed(n,s,label):
            if not all(torch.equal(n.state_dict()[k],v) for k,v in s.items()):raise ValueError("postload bytes")
        strict=SimpleNamespace(_graph=graph,_state=state,_critic=lambda c:c.state_dict(),_require_installed_state=installed)
        c=configuration(); b={"path":".runtime/synthetic/package.json","sha256":"a"*64};d={"path":"data/synthetic/manifest.json","sha256":"b"*64}
        payload={"schema":codec.SCHEMA,"capabilityVersion":codec.CAPABILITY,"architecture":"synthetic","numericRule":"synthetic",
            "configuration":c,"configurationSha256":codec.configuration_digest(c),"runId":"synthetic-run","executionPackage":b,"datasetManifest":d,
            "epoch":24,"selection":selection(),"counts":{"generator":1152,"discriminator":1152},"automaticResumeAllowed":False,"checkpointQualified":False,
            "graph":{"generator":graph(model),"discriminator":graph(critic)},"generator":{"weight":torch.full_like(model.weight,3)},"discriminator":{"weight":torch.full_like(critic.weight,4)}}
        stream=io.BytesIO();torch.save(payload,stream)
        with patch.object(codec,"components",return_value=(torch,strict,lambda m:None,"synthetic","synthetic")),patch.object(critic,"load_state_dict",return_value=None):
            with self.assertRaisesRegex(ValueError,"postload bytes"):
                codec.reload(stream.getvalue(),model=model,critic=critic,configuration=c,run_id="synthetic-run",package_binding=b,dataset_binding=d,epoch=24,selection=selection(),counts=payload["counts"])
        self.assertTrue(torch.equal(model.weight,old[0]));self.assertTrue(torch.equal(critic.weight,old[1]))
