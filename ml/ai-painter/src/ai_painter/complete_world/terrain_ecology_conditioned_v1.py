"""INACTIVE DRAFT: explicit terrain ecology candidate; no execution qualification."""
import hashlib
import torch
from torch import nn
from ai_painter.complete_world import object_ecology_decode1_entry_weight_precision_v1 as prior
from ai_painter.complete_world import object_ecology_decode1_weight_precision_v1 as graph_api
from ai_painter.complete_world import object_ecology_regime_conditioned as ecology
from ai_painter.complete_world import object_appearance_regime_bias_precision as seasonal
from ai_painter.complete_world.object_ecology_regime_input_cpu import require,validate_ecology,validate_regime,ECOLOGIES
from ai_painter.complete_world.object_appearance_regime_input_cpu import SEASONS
from ai_painter.complete_world.terrain_ecology_projection_v1 import (
    TerrainEcologyStem,TerrainEcologyProjection,_TERRAIN_PROJECTION,NUMERIC_RULE as PROJECTION_RULE,
)

CAPABILITY='stage4_mvp256_dry_terrain_ecology_stem_decoder_precision_v1'
ARCHITECTURE=prior.STEM_DECODER_ARCHITECTURE+'_zero_initialized_seven_way_terrain_ecology_projection_v1'
NUMERIC_RULE=prior.STEM_DECODER_RULE+'|'+PROJECTION_RULE
PROJECTION_PARAMETER='terrain_ecology_projection.weight'
PARAMETER_COUNT=109
PARAMETER_ELEMENTS=2243023

def identity_bytes(kind):
    require(kind in ('regime','numeric','ecology'),'unknown terrain ecology identity kind')
    return torch.tensor(list(hashlib.sha256('|'.join((kind,CAPABILITY,ARCHITECTURE,NUMERIC_RULE,*SEASONS,*ECOLOGIES)).encode()).digest()),dtype=torch.uint8,device='cpu')

def _reference(order):
    graph,modules,forward,support,aggregation=prior._reference(order,stem=True,stem_inner=True,decode2_inner=True)
    modules=tuple((name,TerrainEcologyConditionedRenderer if not name else TerrainEcologyStem if name==prior.STEM_TARGET else cls,config) for name,cls,config in modules)
    return ((*graph,(PROJECTION_PARAMETER,(48,7),torch.float32)),
            (*modules,('terrain_ecology_projection',TerrainEcologyProjection,(('in_features',7),('out_features',48)))),
            forward,support,aggregation)

class TerrainEcologyConditionedRenderer(nn.Module):
    capability_version=CAPABILITY
    architecture_id=ARCHITECTURE
    numeric_rule=NUMERIC_RULE
    execution_qualified=False
    parent_checkpoint_loaded=False

    def __init__(self,fresh):
        super().__init__();prior.validate_model_identity(fresh)
        require(type(fresh) is prior.StemDecoderWeightPrecisionEcologyRenderer and next(fresh.parameters()).device.type=='cpu',
                'terrain ecology requires CPU source-created stem decoder')
        pristine=prior.build_fresh_object_ecology_stem_decoder_weight_precision(condition_channel_order=fresh.condition_channel_order)
        before=tuple(fresh.named_parameters())
        require(all(n==m and torch.equal(p.detach().view(torch.uint8),q.detach().view(torch.uint8))
                    for (n,p),(m,q) in zip(before,pristine.named_parameters())),
                'terrain ecology construction requires pristine weights')
        self.core=prior._fork_target(fresh.core,('core','terrain','base_stem','layers','0'),TerrainEcologyStem)
        self.object_rgb_heads=fresh.object_rgb_heads
        self.terrain_ecology_projection=TerrainEcologyProjection()
        self.condition_channel_order=fresh.condition_channel_order;self._parent_forward=fresh._parent_forward
        self.support_ownership_rule=fresh.support_ownership_rule;self.object_aggregation_rule=fresh.object_aggregation_rule
        for name,kind in (('regime_identity','regime'),('numeric_identity','numeric'),('ecology_identity','ecology')):
            self.register_buffer(name,identity_bytes(kind))
        after=tuple(self.named_parameters())
        require(len(after)==109 and all(n==m and p is q for (n,p),(m,q) in zip(before,after[:108]))
                and after[108][0]==PROJECTION_PARAMETER and not bool(after[108][1].count_nonzero()),
                'terrain ecology changed original parameter identities/order or nonzero projection')
        self.training=fresh.training

    def forward(self,conditions,instance_table,*,appearance_regime,ecology_regime,return_evidence=False):
        validate_model_identity(self)
        require(type(conditions) is torch.Tensor and conditions.shape==(1,23,192,256)
                and conditions.dtype==torch.float32 and conditions.device==next(self.parameters()).device,
                'terrain ecology condition geometry/device differs')
        require(not torch.is_autocast_enabled('cpu') and not torch.is_autocast_enabled('cuda'),
                'terrain ecology autocast prohibited')
        season,code=validate_regime(appearance_regime),validate_ecology(ecology_regime)
        st,et,pt=seasonal._REGIME.set(season),ecology._ECOLOGY.set(code),_TERRAIN_PROJECTION.set(self.terrain_ecology_projection)
        try:return self._parent_forward(self,conditions,instance_table,return_evidence=return_evidence)
        finally:
            _TERRAIN_PROJECTION.reset(pt);ecology._ECOLOGY.reset(et);seasonal._REGIME.reset(st)

    def load_state_dict(self,state_dict,strict=True,assign=False):
        validate_model_identity(self);expected=self.state_dict()
        require(next(self.parameters()).device.type=='cpu' and strict is True and assign is False
                and tuple(state_dict)==tuple(expected),'terrain ecology strict complete CPU state required')
        for key,value in state_dict.items():
            require(type(value) is torch.Tensor and value.device.type=='cpu' and not value.requires_grad
                    and value.layout==torch.strided and value.is_contiguous() and value.shape==expected[key].shape
                    and value.dtype==expected[key].dtype and bool(torch.isfinite(value).all()),'terrain ecology state differs: '+key)
        for name,kind in (('regime_identity','regime'),('numeric_identity','numeric'),('ecology_identity','ecology')):
            require(torch.equal(state_dict[name],identity_bytes(kind)),'old/foreign terrain ecology identity rejected')
        verified={k:v.detach().clone() for k,v in state_dict.items()};saved={k:v.detach().clone() for k,v in expected.items()}
        # Preserve the actual hook/parameter dictionaries: removable handles hold
        # weak references to these objects, so replacing them breaks removal.
        slots=[(m,dict(m.__dict__),{k:v.copy() for k,v in m.__dict__.items() if isinstance(v,(dict,set))}) for m in self.modules()]
        parameter_slots=[(p,p.requires_grad,p.grad) for p in self.parameters()]
        parameters,buffers=tuple(self.parameters()),tuple(self.buffers())
        data=[(v,v.detach(),graph_api._storage_identity(v)) for v in (*parameters,*buffers)]
        try:
            result=nn.Module.load_state_dict(self,verified,strict=True,assign=False);validate_model_identity(self)
            require(tuple(self.modules())==tuple(m for m,_,_ in slots)
                    and all(m.training==attrs['training'] for m,attrs,_ in slots),'terrain ecology install changed modules/modes')
            require(all(a is b for a,b in zip(self.parameters(),parameters)) and all(a is b for a,b in zip(self.buffers(),buffers))
                    and all(p.requires_grad==flag and p.grad is grad for p,flag,grad in parameter_slots),
                    'terrain ecology install changed identities/flags')
            require(all(graph_api._storage_identity(v)==sid for v,original,sid in data),'terrain ecology rebound storage')
            installed=self.state_dict();require(tuple(installed)==tuple(verified)
                    and all(torch.equal(installed[k].reshape(-1).view(torch.uint8),v.reshape(-1).view(torch.uint8)) for k,v in verified.items()),
                    'terrain ecology installed bytes differ')
            return result
        except BaseException:
            for module,attrs,containers in slots:
                module.__dict__.clear();module.__dict__.update(attrs)
                for key,values in containers.items():
                    attrs[key].clear();attrs[key].update(values)
            with torch.no_grad():
                for value,original,sid in data:value.data=original
                for key,value in expected.items():value.copy_(saved[key])
            for p,flag,grad in parameter_slots:p.requires_grad_(flag);p.grad=grad
            raise

def validate_model_identity(model):
    require(type(model) is TerrainEcologyConditionedRenderer and model.capability_version==CAPABILITY
            and model.architecture_id==ARCHITECTURE and model.numeric_rule==NUMERIC_RULE
            and model.execution_qualified is False and model.parent_checkpoint_loaded is False,
            'exact inactive terrain ecology identity required')
    require(torch.get_num_threads()<=2,'terrain ecology CPU thread budget exceeded')
    graph,modules,forward,support,aggregation=_reference(tuple(model.condition_channel_order))
    named=tuple(model.named_parameters(remove_duplicate=False));parameters=tuple(model.parameters())
    require(tuple((n,tuple(p.shape),p.dtype) for n,p in named)==graph and len(named)==len(parameters)==109
            and sum(p.numel() for p in parameters)==PARAMETER_ELEMENTS
            and len({id(p) for p in parameters})==109 and len({p.untyped_storage().data_ptr() for p in parameters})==109
            and all(p.device==parameters[0].device and p.device.type in ('cpu','cuda') and p.layout==torch.strided
                    and p.is_contiguous() and bool(torch.isfinite(p.detach()).all()) for p in parameters),
            'terrain ecology canonical graph/finite/device/alias differs')
    require(graph_api._module_graph(model)==modules and model._parent_forward is forward
            and model.support_ownership_rule==support and model.object_aggregation_rule==aggregation,
            'terrain ecology exact modules/forward/ownership differ')
    require(tuple(n for n,_ in model.named_buffers())==('regime_identity','numeric_identity','ecology_identity'),
            'terrain ecology buffer graph differs')
    for name,kind in (('regime_identity','regime'),('numeric_identity','numeric'),('ecology_identity','ecology')):
        value=getattr(model,name)
        require(type(value) is torch.Tensor and value.device==parameters[0].device and value.dtype==torch.uint8
                and value.shape==(32,) and torch.equal(value.detach().cpu(),identity_bytes(kind)),
                'terrain ecology identity buffer differs')
    return model

def build_fresh_terrain_ecology_conditioned(*,condition_channel_order=prior.FORMAL_CONDITION_CHANNEL_ORDER):
    require(torch.get_num_threads()<=2,'terrain ecology CPU construction threads exceeded')
    with torch.device('cpu'),torch.random.fork_rng(devices=[]):
        fresh=prior.build_fresh_object_ecology_stem_decoder_weight_precision(condition_channel_order=condition_channel_order)
        model=TerrainEcologyConditionedRenderer(fresh)
    return validate_model_identity(model)

def migrate_original_d1_parameters_to_terrain_ecology(model):
    prior.validate_model_identity(model)
    require(type(model) is prior.Decode1EntryWeightPrecisionEcologyRenderer and next(model.parameters()).device.type=='cpu',
            'terrain ecology migration requires original D1 CPU source')
    original={k:v.detach().clone() for k,v in model.state_dict().items()}
    candidate=build_fresh_terrain_ecology_conditioned(condition_channel_order=model.condition_channel_order)
    state={k:v.detach().clone() for k,v in candidate.state_dict().items()}
    for name,value in model.named_parameters():
        require(state[name].shape==value.shape,'terrain ecology source parameter shape differs');state[name]=value.detach().clone()
    candidate.load_state_dict(state,strict=True)
    require(all(torch.equal(value.detach(),dict(candidate.named_parameters())[name].detach()) for name,value in model.named_parameters())
            and not bool(candidate.terrain_ecology_projection.weight.count_nonzero()),'terrain ecology migration differs')
    require(all(torch.equal(v,model.state_dict()[k]) for k,v in original.items()),'terrain ecology migration changed source')
    return candidate

def seasonal_parameter(model):
    validate_model_identity(model)
    return model.get_submodule(ecology.TARGET).season_branch.weight

def ecological_parameter(model):
    validate_model_identity(model)
    return model.get_submodule(ecology.TARGET).ecology_branch.weight
