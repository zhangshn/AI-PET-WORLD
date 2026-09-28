"""V10 fixed-single-world carrier and smaller crop; frozen V9 loss formulas."""
from pathlib import Path
import random

from ai_painter.complete_world.native_rgb_aperiodic_detail_renderer import (
    RESPONSIBILITY_IDENTITIES, build_native_complete_rgb_aperiodic_detail_renderer,
)
from ai_painter_stage4_mvp_native_rgb_detail_recovery_renderer_v9 import detail_recovery_objective
from ai_painter_stage4_mvp_native_rgb_object_crop_renderer_v8 import OBJECT_CROP_IDENTITIES
from ai_painter_stage4_mvp_native_rgb_renderer_v6 import digest, project_file, read_json, validate_binding

CAPABILITY_VERSION = 'stage4_mvp_native_complete_rgb_aperiodic_detail_renderer_v10'
ARCHITECTURE_ID = 'stage4_native_complete_rgb_aperiodic_detail_renderer_v4'
CONTRACT_ID = 'stage4-mvp-native-complete-rgb-aperiodic-detail-renderer-v10-contract-v1'
CONTRACT_PATH = 'data/ai-painter/system-governance/stage4-mvp-native-complete-rgb-aperiodic-detail-renderer-v10-contract.json'


def load_contract(root: Path):
    data = project_file(root, CONTRACT_PATH).read_bytes()
    contract = read_json(project_file(root, CONTRACT_PATH), 'V10 contract')
    expected = {'schemaVersion': CONTRACT_ID, 'contractId': CONTRACT_ID,
                'status': 'cpu_candidate_not_execution_qualified',
                'capabilityVersion': CAPABILITY_VERSION, 'architectureId': ARCHITECTURE_ID,
                'automaticRetry': False}
    if any(contract.get(k) != v for k, v in expected.items()):
        raise ValueError('V10 contract identity changed')
    for key in ('datasetBinding', 'parentFailureEvidence'):
        validate_binding(root, contract[key], key)
    for key in ('semanticAndUpperAesthetic', 'minimumDetail'):
        validate_binding(root, contract['reviewBindings'][key], key)
    renderer = contract['renderer']
    expected = {'inputConditionChannels': 23, 'outputChannels': 3, 'baseChannels': 48,
                'aperiodicFeatureScales': [2,4,8,16,32], 'featuresPerScale': 4,
                'aperiodicFeatureCount': 20, 'basisSeed': 20260928,
                'basisSeedScope': 'fixed_mvp_single_world_coordinate_basis_not_arbitrary_world_seed',
                'featureGenerator': 'deterministic_bilinearly_interpolated_2d_coordinate_hash',
                'randomInputAllowed': False, 'referenceRgbAtInferenceAllowed': False,
                'staticMapOrTileCompositionAllowed': False,
                'responsibilityIdentities': list(RESPONSIBILITY_IDENTITIES)}
    if any(renderer.get(k) != v for k,v in expected.items()):
        raise ValueError('V10 renderer contract changed')
    curriculum = contract['trainingCurriculum']
    expected = {'epochCount':24, 'exactOptimizerSteps':2304, 'objectCropSize':[64,64],
                'fullFrameUpdatesPerSamplePerEpoch':1, 'objectCropUpdatesPerSamplePerEpoch':1,
                'objectCropIdentities':list(OBJECT_CROP_IDENTITIES), 'freshInitializationRequired':True,
                'v9CheckpointReuseAllowed':False, 'persistentDerivedTrainingImagesAllowed':False}
    if any(curriculum.get(k) != v for k,v in expected.items()):
        raise ValueError('V10 training scope changed')
    return contract, digest(data)


def build_renderer(root: Path):
    contract, _ = load_contract(root)
    order = read_json(project_file(root, contract['conditionContract']['path']), 'conditions')['tensorContract']['channelOrder']
    return build_native_complete_rgb_aperiodic_detail_renderer(condition_channel_order=order,
        base_channels=48, scales=contract['renderer']['aperiodicFeatureScales'])


def deterministic_object_crop(sample, *, responsibility_indices, epoch, sample_index, seed, crop_size=(64,64)):
    """Select a real supported object pixel, not the mean of disconnected objects.

    Only the target slicing reads RGB. Selection consumes authoritative masks;
    global coordinates and all 23 channels are sliced without renormalization.
    """
    import torch
    conditions, target = sample['conditions'], sample['image']
    if conditions.ndim != 3 or target.ndim != 3 or conditions.shape[-2:] != target.shape[-2:]:
        raise ValueError('V10 crop expects aligned CHW tensors')
    height, width = conditions.shape[-2:]
    if tuple(crop_size) != (64,64) or min(height,width) < 64:
        raise ValueError('V10 crop must be 64x64')
    generator = random.Random(seed + epoch*100003 + sample_index*997)
    offset = (epoch-1+sample_index) % len(OBJECT_CROP_IDENTITIES)
    for step in range(len(OBJECT_CROP_IDENTITIES)):
        identity = OBJECT_CROP_IDENTITIES[(offset+step) % len(OBJECT_CROP_IDENTITIES)]
        points = torch.nonzero(conditions[responsibility_indices[identity]] > .5, as_tuple=False)
        if points.numel():
            cy, cx = [int(v) for v in points[generator.randrange(len(points))]]
            top, left = max(0,min(height-64,cy-32)), max(0,min(width-64,cx-32))
            cropped = {**sample, 'image':target[:,top:top+64,left:left+64].contiguous(),
                       'conditions':conditions[:,top:top+64,left:left+64].contiguous()}
            count = int((cropped['conditions'][responsibility_indices[identity]] > .5).count_nonzero())
            if count <= 0:
                raise ValueError('V10 crop lost its selected object')
            return cropped, {'identity':identity, 'left':left, 'top':top, 'width':64, 'height':64,
                             'centerPixel':[cx,cy], 'maskNonzero':count, 'globalCoordinatesPreserved':True}
    raise ValueError('V10 train sample lacks object support')


def carrier_measurements(basis):
    import torch
    value = basis.double()
    value = value-value.mean((-1,-2),keepdim=True)
    energy = torch.fft.fft2(value).abs().square()
    total = energy.sum((-1,-2))
    if not bool((total > 0).all()):
        raise ValueError('carrier collapsed')
    axial = (energy[...,0,:].sum(-1)+energy[...,:,0].sum(-1))/total
    peak = energy.flatten(-2).max(-1).values/total
    dx = (value[...,1:]-value[...,:-1]).abs().mean((-1,-2))
    dy = (value[...,1:,:]-value[...,:-1,:]).abs().mean((-1,-2))
    return {'meanAxialFftEnergyFraction':float(axial.mean()),
            'maximumAxialFftEnergyFraction':float(axial.max()),
            'maximumSingleFrequencyEnergyFraction':float(peak.max()),
            'minimumHorizontalVariation':float(dx.min()), 'minimumVerticalVariation':float(dy.min())}


def require_carrier(measured, rules):
    pairs = [('meanAxialFftEnergyFraction','meanAxialFftEnergyFractionMaximumExclusive'),
             ('maximumAxialFftEnergyFraction','perChannelAxialFftEnergyFractionMaximumExclusive'),
             ('maximumSingleFrequencyEnergyFraction','perChannelSingleFrequencyEnergyFractionMaximumExclusive')]
    if any(not measured[m] < rules[r] for m,r in pairs) or any(measured[k] <= 0 for k in ('minimumHorizontalVariation','minimumVerticalVariation')):
        raise ValueError('V10 carrier fails frozen non-axial input criteria')
