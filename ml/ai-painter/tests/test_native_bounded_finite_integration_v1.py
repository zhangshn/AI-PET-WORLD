"""Targeted CPU operator/error regression for the registered finite call sites."""
from contextlib import ExitStack, contextmanager
import ast
import importlib
import inspect
from pathlib import Path
import unittest
from unittest import mock

import torch
from ai_painter.complete_world.bounded_finite_validation_v1 import bounded_all_finite
from ai_painter.complete_world.native_stage_geometry_v1 import NativeStageGeometry

COUNTS = {'decode1_entry_weight_reduction_precision_v1':1,'decode1_entry_bounded_weight_vjp_v1':3,
          'native_training_bounded_weight_vjp_v1':3,'stem_weight_reduction_precision_v1':4,
          'stem_inner_weight_reduction_precision_v1':1,'decode2_inner_weight_reduction_precision_v1':4,
          'decode1_weight_reduction_precision_v1':1,'detail_weight_reduction_precision':1,
          'rgb_bias_reduction_precision':4,'terrain_ecology_projection_v1':2}
MODULES = {name:importlib.import_module('ai_painter.complete_world.'+name) for name in COUNTS}
TEST_EVIDENCE = []


@contextmanager
def predicates(reference, calls):
    with ExitStack() as stack:
        for name,module in MODULES.items():
            def predicate(value, owner=name):
                calls.append((owner,tuple(value.shape),str(value.dtype)))
                return bool(torch.isfinite(value).all()) if reference else bounded_all_finite(value)
            stack.enter_context(mock.patch.object(module,'bounded_all_finite',side_effect=predicate))
        yield


def inputs(channels, outputs, kernel=3):
    x=((torch.arange(channels*6,dtype=torch.float32).reshape(1,channels,2,3).remainder(13)-6)/256).requires_grad_()
    w=torch.nn.Parameter((torch.arange(outputs*channels*kernel*kernel,dtype=torch.float32).reshape(outputs,channels,kernel,kernel).remainder(7)-3)/128)
    b=torch.nn.Parameter(torch.arange(outputs,dtype=torch.float32).remainder(5)/64)
    return x,w,b


def operators():
    entry=MODULES['decode1_entry_bounded_weight_vjp_v1']
    native=MODULES['native_training_bounded_weight_vjp_v1']
    stem=MODULES['stem_weight_reduction_precision_v1']
    decode=MODULES['decode2_inner_weight_reduction_precision_v1']
    rgb=MODULES['rgb_bias_reduction_precision']
    def rgb_operator(x,w,b):
        rgb._validate(x,w,b)
        return rgb._CudaRGBBiasReduction.apply(x,w,b)
    result=[('entry144',144,48,3,entry.decode1_entry_bounded_weight_vjp),
            ('stem31',31,48,3,stem.stem_weight_reduction_precision),
            ('decode2_inner96',96,96,3,decode.decode2_inner_weight_reduction_precision),
            ('rgb_autograd_CPU',48,3,1,rgb_operator)]
    for target in native.REGISTERED_TARGETS:
        channels=native._spec(target)[1]
        result.append(('native_'+str(native._spec(target)[0]),channels,48,3,
                       lambda x,w,b,target=target:native._NativeTrainingBoundedWeightVjp.apply(x,w,b,target)))
    return result


class TensorSubclass(torch.Tensor):
    pass


class NativeBoundedFiniteIntegrationTests(unittest.TestCase):
    def outcome(self, action, reference):
        calls=[]
        with predicates(reference,calls):
            try:action();result=('ok',None)
            except Exception as error:result=(type(error).__name__,str(error))
        return result,calls

    def test_exact_registered_site_counts(self):
        for name,expected in COUNTS.items():
            tree=ast.parse(inspect.getsource(MODULES[name]))
            count=0
            for node in tree.body:
                if isinstance(node,ast.FunctionDef) and node.name=='_bounded_finite_compatible':continue
                count+=sum(isinstance(v,ast.Call) and isinstance(v.func,ast.Name)
                           and v.func.id in ('bounded_all_finite','_bounded_finite_compatible') for v in ast.walk(node))
            self.assertEqual(count,expected,name)
        TEST_EVIDENCE.append({'case':'registered_sites','files':10,'predicates':24})

    def test_actual_small_operators_forward_and_all_gradients(self):
        for label,channels,outputs,kernel,operator in operators():
            values=[];orders=[]
            for reference in (True,False):
                x,w,b=inputs(channels,outputs,kernel);calls=[]
                with predicates(reference,calls):
                    y=operator(x,w,b)
                    dy=(torch.arange(y.numel(),dtype=torch.float32).reshape(y.shape).remainder(11)-5)/32
                    gradients=torch.autograd.grad(y,(x,w,b),grad_outputs=dy)
                values.append((y.detach(),*(g.detach() for g in gradients)));orders.append(calls)
            self.assertEqual(orders[0],orders[1],label)
            for before,after in zip(*values):
                self.assertTrue(torch.equal(before.contiguous().view(torch.uint8),after.contiguous().view(torch.uint8)),label)
                self.assertTrue(bool(torch.isfinite(after).all()),label)
            TEST_EVIDENCE.append({'case':label,'canvas':[2,3],'outputAndInputWeightBiasGradientBytesEqual':True,
                                  'helperCalls':len(orders[1]),'validationOrderEqual':True,'CUDAExecuted':False})

    def test_validators_reject_with_original_order_and_messages(self):
        cases=[('decode1_entry_weight_reduction_precision_v1',144,48),('stem_weight_reduction_precision_v1',31,48),
               ('stem_inner_weight_reduction_precision_v1',48,48),('decode2_inner_weight_reduction_precision_v1',96,96),
               ('decode1_weight_reduction_precision_v1',48,48),('detail_weight_reduction_precision',68,48),
               ('rgb_bias_reduction_precision',48,3)]
        count=0
        for name,channels,out in cases:
            module=MODULES[name];kernel=1 if out==3 else 3
            for kind in ('nan','inf','negative_inf','dtype','layout','sparse','type'):
                def action():
                    x,w,b=inputs(channels,out,kernel)
                    if kind in ('nan','inf','negative_inf'):
                        x=x.detach();x[0,0,0,0]={'nan':float('nan'),'inf':float('inf'),'negative_inf':-float('inf')}[kind]
                    elif kind=='dtype':x=x.detach().to(torch.float64)
                    elif kind=='layout':x=x.detach().transpose(2,3)
                    elif kind=='sparse':x=x.detach().to_sparse()
                    elif kind=='type':x=[]
                    module._validate(x,w,b)
                old,order_old=self.outcome(action,True);new,order_new=self.outcome(action,False)
                self.assertEqual(old,new,(name,kind));self.assertEqual(order_old,order_new,(name,kind))
                self.assertEqual(new[0],'ValueError',(name,kind))
                count+=1
        TEST_EVIDENCE.append({'case':'validator_errors','checks':count,'originalErrorTextAndShortCircuitOrderEqual':True})

    def test_actual_operator_nonfinite_result_adjoint_and_requested_gradients(self):
        count=0
        for label,channels,outputs,kernel,operator in operators():
            for kind in ('forward_overflow','nan_adjoint','inf_adjoint','negative_inf_adjoint','gradient_overflow'):
                def action():
                    x,w,b=inputs(channels,outputs,kernel)
                    if kind=='forward_overflow':
                        x=torch.full_like(x,torch.finfo(torch.float32).max,requires_grad=True)
                        w=torch.nn.Parameter(torch.full_like(w,torch.finfo(torch.float32).max))
                    elif kind=='gradient_overflow':
                        x=torch.zeros_like(x,requires_grad=True)
                        w=torch.nn.Parameter(torch.full_like(w,torch.finfo(torch.float32).max))
                        b=torch.nn.Parameter(torch.zeros_like(b))
                    y=operator(x,w,b)
                    if kind!='forward_overflow':
                        value={'nan_adjoint':float('nan'),'inf_adjoint':float('inf'),
                               'negative_inf_adjoint':-float('inf'),'gradient_overflow':torch.finfo(torch.float32).max}[kind]
                        torch.autograd.grad(y,(x,w,b),grad_outputs=torch.full_like(y,value))
                before,order_before=self.outcome(action,True);after,order_after=self.outcome(action,False)
                self.assertEqual(before,after,(label,kind));self.assertEqual(order_before,order_after,(label,kind))
                self.assertEqual(after[0],'ValueError',(label,kind));self.assertIn('finite',after[1],(label,kind))
                count+=1
        TEST_EVIDENCE.append({'case':'operator_nonfinite_errors','checks':count,'originalErrorsAndOrderEqual':True})

    def test_rgb_detail_and_target56_tensor_subclass_compatibility(self):
        for name,channels,outputs in (('rgb_bias_reduction_precision',48,3),('detail_weight_reduction_precision',68,48)):
            module=MODULES[name];x,w,b=inputs(channels,outputs,1 if outputs==3 else 3)
            values=tuple(v.detach().as_subclass(TensorSubclass) for v in (x,w,b))
            with mock.patch.object(module,'bounded_all_finite',side_effect=AssertionError('subclass reached exact helper')) as exact:
                module._validate(*values);self.assertTrue(module._bounded_finite_compatible(values[0]));exact.assert_not_called()
        rgb=MODULES['rgb_bias_reduction_precision'];x,w,b=inputs(48,3,1)
        ctx=type('Context',(),{'saved_tensors':(x,w,b),'output_shape':(1,3,2,3),'needs_input_grad':(True,True,True)})()
        dy=torch.ones(1,3,2,3).as_subclass(TensorSubclass)
        with torch.no_grad():
            gradients=rgb._CudaRGBBiasReduction.backward(ctx,dy)
        self.assertTrue(all(bool(torch.isfinite(v).all()) for v in gradients))
        native=MODULES['native_training_bounded_weight_vjp_v1'];target=next(t for t in native.REGISTERED_TARGETS if native._spec(t)[0]==56)
        x,w,b=inputs(68,48);x=x.detach().as_subclass(TensorSubclass)
        class Context:
            def save_for_backward(self,*values):self.saved_tensors=values
        def exact_supported(value):
            self.assertIn(type(value),(torch.Tensor,torch.nn.Parameter))
            return bounded_all_finite(value)
        with mock.patch.object(native,'bounded_all_finite',side_effect=exact_supported):
            y=native._NativeTrainingBoundedWeightVjp.forward(Context(),x,w,b,target)
            self.assertTrue(bool(torch.isfinite(y).all()))
        TEST_EVIDENCE.append({'case':'legal_tensor_subclasses','RGBValidatorAndAdjoint':True,'detailValidator':True,'target56Forward':True,'legacyPredicatePreserved':True})

    def test_native_projection_minimum_registered_operator(self):
        module=MODULES['terrain_ecology_projection_v1'];geometry=NativeStageGeometry(0);code=torch.tensor([0,0,1,0,0,0,0],dtype=torch.float32)
        results=[];orders=[]
        for reference in (True,False):
            weight=torch.nn.Parameter(torch.arange(336,dtype=torch.float32).reshape(48,7)/4096);calls=[]
            with predicates(reference,calls):
                output=module._NativeStageTerrainEcologyProjection.apply(weight,code,geometry)
                dy=torch.ones_like(output)/1024
                gradient,=torch.autograd.grad(output,(weight,),grad_outputs=dy)
            results.append((output.detach(),gradient.detach()));orders.append(calls)
        self.assertEqual(orders[0],orders[1])
        self.assertTrue(all(torch.equal(a.contiguous().view(torch.uint8),b.contiguous().view(torch.uint8)) for a,b in zip(*results)))
        for value in (float('nan'),float('inf'),-float('inf')):
            def action():
                weight=torch.nn.Parameter(torch.zeros(48,7));output=module._NativeStageTerrainEcologyProjection.apply(weight,code,geometry)
                torch.autograd.grad(output,(weight,),grad_outputs=torch.full_like(output,value))
            before=self.outcome(action,True);after=self.outcome(action,False)
            self.assertEqual(before,after);self.assertEqual(after[0][0],'ValueError');self.assertIn('adjoint',after[0][1])
        TEST_EVIDENCE.append({'case':'native_projection_only','geometryStage':0,'shape':[1,48,192,256],
                              'outputWeightGradientBytesEqual':True,'adjointNaNInfErrorsEqual':True,'fullModel':False})


if __name__=='__main__':unittest.main()
