"""INACTIVE DRAFT: seven-way ecology projection into the terrain stem.

No training route imports this file. Forward uses FP32; its sole weight VJP
reduces the spatial adjoint in FP64 before one conversion to FP32.
"""
from contextvars import ContextVar
import torch
from torch import nn
from ai_painter.complete_world.object_ecology_regime_input_cpu import require, validate_ecology
from ai_painter.complete_world import object_ecology_regime_conditioned as ecology
from ai_painter.complete_world.stem_weight_reduction_precision_v1 import (
    StemWeightReductionConv, stem_weight_reduction_precision,
)

NUMERIC_RULE='terrain_ecology_48x7_fp32_linear_forward_fp64_spatial_weight_vjp_once_fp32_v1'
_TERRAIN_PROJECTION=ContextVar('terrain_ecology_projection_v1',default=None)

def _validate(weight, code):
    require(type(weight) in (torch.Tensor,nn.Parameter) and type(code) is torch.Tensor,
            'projection tensors required')
    require(weight.shape==(48,7) and code.shape==(7,) and not code.requires_grad,
            'projection shape/non-gradient code differs')
    require(weight.device.type in ('cpu','cuda') and code.device==weight.device
            and all(v.dtype==torch.float32 and v.layout==torch.strided and v.is_contiguous()
                    and bool(torch.isfinite(v.detach()).all()) for v in (weight,code)),
            'projection finite contiguous FP32/device differs')
    require(bool(((code==0)|(code==1)).all()) and float(code.sum())==1,
            'projection one-hot ecology required')
    require(not torch.is_autocast_enabled('cpu') and not torch.is_autocast_enabled('cuda'),
            'projection autocast prohibited')
    if weight.is_cuda:
        require(torch.backends.cuda.matmul.fp32_precision=='ieee'
                and torch.backends.cudnn.conv.fp32_precision=='ieee','projection IEEE FP32 required')

class _TerrainEcologyProjection(torch.autograd.Function):
    @staticmethod
    def forward(ctx, weight, code):
        _validate(weight,code);ctx.save_for_backward(weight,code)
        result=(weight @ code).reshape(1,48,1,1).expand(1,48,192,256).contiguous()
        require(bool(torch.isfinite(result).all()),'projection nonfinite forward')
        return result

    @staticmethod
    def backward(ctx, gradient):
        require(not torch.is_grad_enabled(),'projection higher-order derivatives prohibited')
        weight,code=ctx.saved_tensors;_validate(weight,code)
        require(type(gradient) is torch.Tensor and gradient.shape==(1,48,192,256)
                and gradient.device==weight.device and gradient.dtype==torch.float32
                and gradient.layout==torch.strided and bool(torch.isfinite(gradient.detach()).all()),
                'projection adjoint differs')
        result=None
        if ctx.needs_input_grad[0]:
            spatial=gradient.to(torch.float64).sum(dim=(0,2,3))
            result=(spatial[:,None]*code.to(torch.float64)[None,:]).to(torch.float32)
            require(result.shape==weight.shape and bool(torch.isfinite(result).all()),
                    'projection nonfinite weight VJP')
        return result,None

class TerrainEcologyProjection(nn.Module):
    def __init__(self):
        super().__init__();self.in_features,self.out_features=7,48
        self.weight=nn.Parameter(torch.zeros((48,7),device='cpu',dtype=torch.float32))

    def forward(self,code):
        validate_ecology(code)
        return _TerrainEcologyProjection.apply(self.weight,code.to(self.weight.device))

class TerrainEcologyStem(nn.Module):
    def __init__(self,original):
        super().__init__()
        require(type(original) is StemWeightReductionConv and original.weight.device.type=='cpu',
                'terrain ecology requires original precision stem')
        self.weight,self.bias=original.weight,original.bias
        for name in ('in_channels','out_channels','kernel_size','stride','padding','dilation','groups','padding_mode'):
            setattr(self,name,getattr(original,name))
        self.training=original.training

    def forward(self,features):
        projection=_TERRAIN_PROJECTION.get()
        require(type(projection) is TerrainEcologyProjection
                and projection.weight.device==features.device,'missing exact terrain ecology context')
        result=stem_weight_reduction_precision(features,self.weight,self.bias)
        require(result.shape==(1,48,192,256),'terrain ecology native geometry differs')
        return result+projection(ecology._ECOLOGY.get())
