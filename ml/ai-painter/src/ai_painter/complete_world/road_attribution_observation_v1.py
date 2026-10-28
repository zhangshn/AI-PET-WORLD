"""Scoped zero-update measurements; original forward/objectives/gates are delegated."""
from contextlib import ExitStack, nullcontext
import hashlib
import json
import random
from unittest.mock import patch

import numpy as np
import torch
from torch.nn import functional as F

MEASUREMENTS = ('existing_path_fact_rgb', 'boundary_path_rgb', 'original_background_auxiliary')
FACTS = ('terrain_water', 'terrain_path_ground', 'terrain_shoreline', 'object_footprints')


def require(value, message):
    if not value:
        raise ValueError(message)


def projected_boundary_mask(expected):
    require(expected.dtype == torch.bool and tuple(expected.shape) == (768, 1024), 'projected road geometry')
    bands = torch.zeros_like(expected)
    definitions = (('north', (slice(0, 6), slice(None))), ('east', (slice(None), slice(-6, None))),
                   ('south', (slice(-6, None), slice(None))), ('west', (slice(None), slice(0, 6))))
    sides = []
    for side, selection in definitions:
        if bool(expected[selection].any()):
            bands[selection] = True
            sides.append(side)
    mask = expected & bands
    counts = mask.reshape(192, 4, 256, 4).sum((1, 3))
    return mask, counts, sides


def measurement_targets(prediction, sample, order, parts, background, evidence, reference, expected):
    require(tuple(prediction.shape) == (1, 3, 192, 256), 'native prediction geometry')
    require(tuple(reference.shape) == (1, 3, 768, 1024) and not reference.requires_grad, 'original projected RGB')
    terms, path = [], None
    predicted = F.avg_pool2d(prediction.float(), 3, stride=1, padding=1, count_include_pad=False)
    target = F.avg_pool2d(sample['image'][None].float(), 3, stride=1, padding=1, count_include_pad=False)
    for role in FACTS:
        mask = (sample['conditions'][None, list(order).index(role):list(order).index(role)+1] > .5).float()
        if bool(mask.any()):
            support = F.max_pool2d(mask, 3, stride=1, padding=1)
            term = ((predicted-target).abs()*support).sum() / (support.sum()*3).clamp_min(1)
            terms.append(term)
            if role == 'terrain_path_ground':
                path = term
    aggregate = torch.stack(terms).mean() if terms else prediction.sum()*0
    require(torch.equal(aggregate.detach(), parts['factRegionCoarseRgbMae'].detach()), 'original fact aggregate differs')
    road = .25 * path / len(terms) if path is not None else prediction.sum()*0
    mask, coverage, sides = projected_boundary_mask(expected)
    projected = prediction.repeat_interleave(4, -2).repeat_interleave(4, -1)
    boundary = ((projected-reference).abs()*mask[None, None]).sum() / (mask.sum()*3).clamp_min(1)
    require(all(x.shape == torch.Size([]) and bool(torch.isfinite(x.detach())) for x in (road, boundary, background)),
            'finite scalar measurements')
    quantized = prediction.detach().clamp(0, 1).mul(255).round().to(torch.uint8)
    difference = (prediction.detach()-quantized.float()/255).abs()
    original_support = evidence['visibleObjectSupportMasks']
    union = torch.zeros((1, 1, 192, 256), dtype=torch.bool, device=prediction.device)
    for value in original_support.values():
        union |= value.bool()
    facts = {'factRoleCount': len(terms), 'nativeRoadApplicable': path is not None,
             'projectedBoundaryPixels': int(mask.sum()), 'requiredSides': sides,
             'nativeCoverageHistogram': [int((coverage == i).sum()) for i in range(17)],
             'boundaryObjectSupportProjectedPixels': int((mask & union[0, 0].repeat_interleave(4, 0).repeat_interleave(4, 1)).sum()),
             'quantizationDifference': {'maximum': float(difference.max()), 'mean': float(difference.mean())},
             'coordinateSpace': '1024x768_audit_band6_nearest4_native_prediction',
             'boundaryIsDiagnosticOnly': True}
    return dict(zip(MEASUREMENTS, (road, boundary, background))), facts, quantized


def _tensor_bytes(value):
    return value.detach().cpu().contiguous().numpy().tobytes()


def state_snapshot(model, critic):
    networks = []
    for network in (model, critic):
        digest = hashlib.sha256()
        for name, value in network.state_dict().items():
            digest.update(json.dumps([name, str(value.dtype), list(value.shape)]).encode())
            digest.update(_tensor_bytes(value))
        networks.append({'sha256': digest.hexdigest(),
            'parameters': [(name, id(p), p.untyped_storage()._cdata, p._version, p.requires_grad,
                            id(p.grad), None if p.grad is None else hashlib.sha256(_tensor_bytes(p.grad)).hexdigest())
                           for name, p in network.named_parameters()],
            'buffers': [(name, id(b), b.untyped_storage()._cdata, b._version) for name, b in network.named_buffers()],
            'modes': [(id(m), m.training) for m in network.modules()]})
    numpy = np.random.get_state()
    device = next(model.parameters()).device
    rng = {'torch': hashlib.sha256(_tensor_bytes(torch.get_rng_state())).hexdigest(), 'python': repr(random.getstate()),
           'numpy': [numpy[0], hashlib.sha256(numpy[1].tobytes()).hexdigest(), *numpy[2:]],
           'cuda': hashlib.sha256(_tensor_bytes(torch.cuda.get_rng_state(device))).hexdigest() if device.type == 'cuda' else None}
    backend = [torch.are_deterministic_algorithms_enabled(), torch.is_deterministic_algorithms_warn_only_enabled(),
               torch.backends.mkldnn.enabled, torch.backends.mkldnn.deterministic,
               torch.backends.cuda.matmul.fp32_precision, torch.backends.cudnn.conv.fp32_precision]
    return {'networks': networks, 'rng': rng, 'backend': backend}


def vector_summary(left, right, groups):
    result = {}
    for name, indexes in groups.items():
        dot = norm_l = norm_r = 0.0
        left_unused=right_unused=left_zero=right_zero=0
        for i in indexes:
            a, b = left[i], right[i]
            left_unused+=int(a is None);right_unused+=int(b is None)
            if a is not None:
                require(bool(torch.isfinite(a).all()), 'nonfinite left summary gradient')
                left_zero+=int(not bool(a.count_nonzero()))
            if b is not None:
                require(bool(torch.isfinite(b).all()), 'nonfinite right summary gradient')
                right_zero+=int(not bool(b.count_nonzero()))
            if a is not None:
                aa = a.double(); norm_l += float((aa*aa).sum())
            if b is not None:
                bb = b.double(); norm_r += float((bb*bb).sum())
            if a is not None and b is not None:
                dot += float((aa*bb).sum())
        denominator = (norm_l*norm_r)**.5
        result[name] = {'dot': dot, 'leftL2': norm_l**.5, 'rightL2': norm_r**.5,
                        'cosine': dot/denominator if denominator else None,
                        'leftUnusedTensorCount':left_unused,'rightUnusedTensorCount':right_unused,
                        'leftConnectedZeroTensorCount':left_zero,'rightConnectedZeroTensorCount':right_zero,
                        'status': 'applicable' if denominator else 'unknown_zero_norm'}
    return result


class RoadObservation:
    """One actual probe;3 extra VJPs precede the original5 without replacing them."""
    def __init__(self, model, critic, background, reference, expected, resource, *, enforce_identity=True):
        self.model, self.critic, self.background = model, critic, background
        self.reference, self.expected, self.resource = reference, expected, resource
        self.parameters = tuple(model.parameters()); self.critic_parameters = tuple(critic.parameters())
        self.counts = {k: 0 for k in ('generatorForwards', 'generatorForwardCompleted', 'criticForwards', 'criticForwardCompleted',
            'originalGeneratorVjpAttempted', 'originalGeneratorVjps', 'diagnosticGeneratorVjpAttempted',
            'diagnosticGeneratorVjps', 'discriminatorVjpAttempted', 'discriminatorVjps', 'autogradAttempted', 'allAutogradGradCalls')}
        self.scalars, self.diagnostics, self.comparisons = {}, {}, {}
        self.original_scalars = {}
        self.captured = {}; self.vectors = {}; self.raw_count = 0
        self.in_diagnostic = False; self.stack = None; self.state_unchanged = False; self.cleanup_verified = False
        self.enforce_identity = enforce_identity
        self.call_sequence = []
        self.prohibited_attempts = {'optimizerConstructorAttempted':0,'backwardAttempted':0}

    def _copy(self, gradients):
        require(len(gradients) == len(self.parameters), 'complete diagnostic gradient vector')
        require(all(v is None or bool(torch.isfinite(v).all()) for v in gradients), 'nonfinite observed gradient')
        return tuple(None if v is None else v.detach().cpu().clone() for v in gradients)

    def _compare(self, label, gradients):
        copied = self._copy(gradients)
        self.comparisons[label] = {key: vector_summary(vector, copied, self.groups) for key, vector in self.vectors.items()}
        for key,groups in self.comparisons[label].items():
            applicability=self.diagnostics['measurementApplicability'][key]
            for value in groups.values():
                value['measurementApplicability']=applicability
                if applicability=='not_applicable':
                    value['status']='not_applicable_mask'

    def event(self, stage, kind, gradients=None):
        if stage == 'complete' and kind == 'generator':
            labels = ('actualTotal', 'structuredObjective', 'wholeFrameFidelity', 'objectCoreRgb', 'objectSupportStructure')
            require(self.raw_count < 5, 'original gradient observation overflow')
            self._compare(labels[self.raw_count], gradients); self.raw_count += 1

    def __enter__(self):
        require(all(p.grad is None for net in (self.model, self.critic) for p in net.parameters()), 'clean .grad required')
        self.before = state_snapshot(self.model, self.critic)
        self.stack = ExitStack()
        parent = self.background.parent
        scope = parent.generator_fp32_scope(next(self.model.parameters()).device) if self.enforce_identity else nullcontext()
        with scope:
            parameters, heads, season, ecology = parent.bind_parameters(self.model)
        self.hooks_before = [(network, tuple(network._forward_pre_hooks), tuple(network._forward_hooks))
                             for network in (self.model,self.critic)]
        require(tuple(parameters) == self.parameters, 'original parameter objects')
        if self.enforce_identity:
            require(len(parameters) == 109 and sum(p.numel() for p in parameters) == 2243023, 'original109 model')
        owned = {i for values in heads.values() for i in values}
        named = tuple(self.model.named_parameters())
        self.groups = {'all': tuple(range(len(parameters))), 'objectHeads': tuple(sorted(owned)),
            'nonhead': tuple(i for i in range(len(parameters)) if i not in owned),
            'terrainByName': tuple(i for i, (name, _) in enumerate(named) if '.terrain.' in name),
            'season': (season,), 'ecology': (ecology,)}
        self.groups.update({'head:'+key: tuple(value) for key, value in heads.items()})
        original_forward, original_objective = self.background.sample_forward, parent.train_object_support_structure_candidate_objective
        original_targets, original_auxiliary = self.background.targets, self.background.auxiliary_loss
        original_compute, original_grad = parent.compute_generator_candidate_gradients, torch.autograd.grad
        self.originals = [(self.background, 'sample_forward', original_forward),
            (parent, 'train_object_support_structure_candidate_objective', original_objective),
            (self.background, 'targets', original_targets), (self.background, 'auxiliary_loss', original_auxiliary),
            (parent, 'compute_generator_candidate_gradients', original_compute), (torch.autograd, 'grad', original_grad)]
        def forward(*args, **kwargs):
            value = original_forward(*args, **kwargs)
            require(kwargs.get('return_evidence') is True and args[0] is self.model, 'authenticated evidence forward')
            self.captured['prediction'], self.captured['evidence'] = value
            return value
        def objective(*args, **kwargs):
            value = original_objective(*args, **kwargs); self.captured['parts'] = value[1]; return value
        def targets(*args, **kwargs):
            value = original_targets(*args, **kwargs); self.captured['backgroundMask'] = value[1]; return value
        def auxiliary(*args, **kwargs):
            value = original_auxiliary(*args, **kwargs); self.captured['background'] = value; return value
        def grad(*args, **kwargs):
            inputs = tuple(args[1] if len(args) > 1 else kwargs['inputs'])
            ids = tuple(map(id, inputs))
            if ids == tuple(map(id, self.parameters)):
                key = 'diagnosticGenerator' if self.in_diagnostic else 'originalGenerator'
            else:
                require(ids == tuple(map(id, self.critic_parameters)), 'unknown VJP parameters'); key = 'discriminator'
            self.resource(); self.counts[key+'VjpAttempted'] += 1; self.counts['autogradAttempted'] += 1
            self.call_sequence.append({'kind': key, 'retainGraph': bool(kwargs.get('retain_graph', False)),
                                       'createGraph': bool(kwargs.get('create_graph', False))})
            require(self.counts['autogradAttempted'] <= 9, 'VJP call ceiling')
            value = original_grad(*args, **kwargs)
            self.counts[key+'Vjps'] += 1; self.counts['allAutogradGradCalls'] += 1
            self.resource(); return value
        def compute(**kwargs):
            require(kwargs['model'] is self.model and kwargs['critic'] is self.critic, 'same compute context')
            require(not self.vectors, 'one compute entry')
            for key in ('actual_total','structured_objective','whole_frame_fidelity','object_core_rgb','object_support_structure'):
                self.original_scalars[key] = float(kwargs[key].detach())
            for key in ('v21UnchangedTotal','factRegionCoarseRgbMae'):
                self.original_scalars[key] = float(self.captured['parts'][key].detach()) if key in self.captured['parts'] else None
            values, facts, quantized = measurement_targets(self.captured['prediction'], kwargs['sample'],
                self.model.condition_channel_order, self.captured['parts'], self.captured['background'],
                self.captured['evidence'], self.reference, self.expected)
            self.diagnostics.update(facts); self.quantized = quantized.detach().cpu()
            mask = self.captured['backgroundMask'][0, 0]
            projected_support = mask.repeat_interleave(4, 0).repeat_interleave(4, 1)
            band, _, _ = projected_boundary_mask(self.expected)
            native_road = kwargs['sample']['conditions'][list(self.model.condition_channel_order).index('terrain_path_ground')] > .5
            self.diagnostics['backgroundIntersections'] = {'nativeSupport': int(mask.sum()),
                'nativeRoadCore': int((mask & native_road).sum()),
                'nativeRoadDilated': int((mask & F.max_pool2d(native_road[None,None].float(),3,1,1)[0,0].bool()).sum()),
                'projectedAuditRoad': int((projected_support & self.expected).sum()),
                'projectedAuditBand': int((projected_support & band).sum())}
            self.diagnostics['measurementApplicability'] = {
                'existing_path_fact_rgb':'applicable' if facts['nativeRoadApplicable'] else 'not_applicable',
                'boundary_path_rgb':'applicable' if facts['projectedBoundaryPixels'] else 'not_applicable',
                'original_background_auxiliary':'applicable' if bool(mask.any()) else 'not_applicable'}
            self.in_diagnostic = True
            try:
                for key in MEASUREMENTS:
                    self.scalars[key] = float(values[key].detach())
                    self.vectors[key] = self._copy(torch.autograd.grad(values[key], self.parameters,
                        retain_graph=True, create_graph=False, allow_unused=True))
            finally:
                self.in_diagnostic = False
            value = original_compute(**kwargs)
            self._compare('actualCandidate', value[0]); self.original_facts = value[1]
            return value
        def deny(kind):
            def blocked(*args, **kwargs):
                self.prohibited_attempts[kind] += 1
                raise RuntimeError('optimizer/backward prohibited in road diagnostic')
            return blocked
        def pre(label, ceiling):
            def hook(*args):
                self.resource(); self.counts[label+'Forwards'] += 1
                require(self.counts[label+'Forwards'] <= ceiling, label+' forward ceiling')
            return hook
        def post(label):
            def hook(*args): self.counts[label+'ForwardCompleted'] += 1
            return hook
        try:
            for obj, name, value in [(self.background,'sample_forward',forward),
                (parent,'train_object_support_structure_candidate_objective',objective),
                (self.background,'targets',targets),(self.background,'auxiliary_loss',auxiliary),
                (parent,'compute_generator_candidate_gradients',compute),(torch.autograd,'grad',grad),
                (torch.optim.Optimizer,'__init__',deny('optimizerConstructorAttempted')),
                (torch.Tensor,'backward',deny('backwardAttempted')),(torch.autograd,'backward',deny('backwardAttempted'))]:
                self.stack.enter_context(patch.object(obj, name, value))
            for network, label, ceiling in [(self.model,'generator',1),(self.critic,'critic',3)]:
                self.stack.callback(network.register_forward_pre_hook(pre(label,ceiling)).remove)
                self.stack.callback(network.register_forward_hook(post(label)).remove)
            return self
        except BaseException:
            self.stack.close(); raise

    def __exit__(self, kind, error, traceback):
        secondary = []
        try:
            self.stack.close()
            require(all(getattr(obj, name) is value for obj, name, value in self.originals), 'delegate restore differs')
            require(all(tuple(network._forward_pre_hooks)==pre and tuple(network._forward_hooks)==post
                        for network,pre,post in self.hooks_before), 'forward hook cleanup differs')
            self.cleanup_verified = True
        except BaseException as cleanup:
            secondary.append(str(cleanup))
        try:
            self.after = state_snapshot(self.model, self.critic)
            require(self.after == self.before, 'diagnostic state/RNG/mode/grad/buffer identity changed')
            require(self.background._FORWARD.get() is None, 'same-forward context leaked')
            require(not any(self.prohibited_attempts.values()), 'prohibited attempt observed')
            self.state_unchanged = True
        except BaseException as mutation:
            secondary.append(str(mutation))
        self.vectors.clear(); self.captured.clear()
        if secondary:
            if error is None:
                raise ValueError('; '.join(secondary))
            error.road_secondary_errors = secondary
        return False

    def summary(self):
        return {'counts': dict(self.counts), 'measurementScalars': dict(self.scalars),
            'originalLossScalars': self.original_scalars,
            'diagnostics': self.diagnostics, 'gradientComparisons': self.comparisons,
            'stateUnchanged': self.state_unchanged, 'cleanupVerified': self.cleanup_verified,
            'originalGradientSetsObserved': self.raw_count,
            'callSequence': self.call_sequence,
            'prohibitedAttempts': self.prohibited_attempts,
            'stateBeforeDigest': hashlib.sha256(json.dumps(self.before, sort_keys=True).encode()).hexdigest() if hasattr(self,'before') else None,
            'stateAfterDigest': hashlib.sha256(json.dumps(self.after, sort_keys=True).encode()).hexdigest() if hasattr(self,'after') else None,
            'optimizerCreations': 0, 'optimizerUpdates': 0, 'backwardCalls': 0}
