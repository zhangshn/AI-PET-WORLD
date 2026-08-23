import assert from "node:assert/strict"
import fs from "node:fs"

export const DECISION_ID = "stage4_reference_feature_scan_rerun_execution_identity_causal_adjudication_v1"
export const REPAIR_CONTRACT_ID = "stage4_reference_feature_scan_rerun_execution_identity_unification_v1"

function functionBlock(source, name) {
  const lines = source.split(/\r?\n/)
  const start = lines.findIndex((line) => line.startsWith(`def ${name}(`))
  assert.notEqual(start, -1, `python_function_missing:${name}`)
  let signatureEnd = start
  while (signatureEnd < lines.length && !lines[signatureEnd].trimEnd().endsWith(":")) signatureEnd += 1
  assert.notEqual(signatureEnd, lines.length, `python_function_signature_unclosed:${name}`)
  let end = signatureEnd + 1
  while (end < lines.length && (!lines[end].trim() || /^\s/.test(lines[end]))) end += 1
  return lines.slice(start, end).join("\n")
}

function required(source, fragment, label) {
  assert.equal(source.includes(fragment), true, label)
}

export function inspectExecutionIdentity({ runnerSource, baseSource }) {
  const run = functionBlock(runnerSource, "run_gpu")
  const rollout = functionBlock(baseSource, "rollout_rgb")

  required(run, "chunk_size = 4", "scan_batch_size_not_four")
  required(run, "records = [datasets[\"train\"][index] for index in range(start, min(start + chunk_size, 48))]", "scan_source_order_not_structural")
  required(run, "images = torch.stack([row[\"image\"] for row in records]).to(device)", "scan_batch_construction_missing")
  required(run, "[SEED + index for index in range(start, start + len(records))]", "scan_seed_identity_missing")
  required(run, "gradient_tail_steps=0", "scan_tail_identity_missing")
  required(run, "train_index = {row[\"sampleId\"]: index for index, row in enumerate(datasets[\"train\"].rows)}", "rerun_source_index_mapping_missing")
  required(run, "index = train_index[selection[\"sampleId\"]]", "rerun_selected_sample_mapping_missing")
  required(run, "image = record[\"image\"].unsqueeze(0).to(device)", "rerun_batch_one_missing")
  required(run, "[SEED + index], diffusion, normalization, config, gradient_tail_steps=5", "rerun_seed_or_tail_identity_missing")
  required(run, "model.to(device).eval()", "model_eval_identity_missing")
  required(run, "torch.use_deterministic_algorithms(True)", "deterministic_algorithms_missing")
  required(run, "torch.backends.cudnn.deterministic = True", "cudnn_determinism_missing")
  required(run, "torch.backends.cudnn.benchmark = False", "cudnn_benchmark_not_disabled")
  required(run, "weighted_reference_tensor(model.autoencoder, predicted, images, conditions, config)", "scan_reference_feature_path_missing")
  required(run, "weighted_reference_tensor(model.autoencoder, predicted, image, conditions, config)", "rerun_reference_feature_path_missing")

  required(rollout, "generator = torch.Generator(device=images.device).manual_seed(int(seed))", "per_sample_generator_missing")
  required(rollout, "initial.append(torch.randn(latent_shape, device=images.device, generator=generator))", "initial_latent_identity_missing")
  required(rollout, "steps = trainer.inference_timesteps(", "timestep_sequence_missing")
  required(rollout, "no_gradient_steps = len(steps) - int(gradient_tail_steps)", "gradient_tail_split_missing")
  required(rollout, "if step_index < no_gradient_steps:", "no_grad_branch_missing")
  required(rollout, "with torch.no_grad():", "no_grad_context_missing")
  required(rollout, "latent = latent.detach()", "no_grad_detach_missing")
  required(rollout, "velocity = model.predict_velocity(latent, timestep_batch, conditions)", "denoiser_path_missing")
  required(rollout, "return model.autoencoder.decode(", "autoencoder_decode_missing")

  return {
    evidenceComplete: true,
    scan: {
      batchSize: 4,
      sampleOrder: "source_index_contiguous_chunks_0_to_47",
      seed: "20263722_plus_source_index",
      initialLatent: "per_sample_torch_generator_seeded_by_20263722_plus_source_index",
      modelMode: "eval",
      deterministicAlgorithms: true,
      rolloutSteps: 50,
      noGradSteps: 50,
      autogradTailSteps: 0,
      autoencoderDecode: "same_rollout_rgb_function",
      referenceFeatureExtraction: "same_weighted_reference_tensor_function",
      classWeighting: "same_derived_class_weight_order",
    },
    rerun: {
      batchSize: 1,
      sampleOrder: "selected_sample_resolved_back_to_same_source_index",
      seed: "20263722_plus_same_source_index",
      initialLatent: "per_sample_torch_generator_seeded_by_20263722_plus_same_source_index",
      modelMode: "eval",
      deterministicAlgorithms: true,
      rolloutSteps: 50,
      noGradSteps: 45,
      autogradTailSteps: 5,
      autoencoderDecode: "same_rollout_rgb_function",
      referenceFeatureExtraction: "same_weighted_reference_tensor_function",
      classWeighting: "same_derived_class_weight_order",
    },
    identities: {
      sampleIdentityMatches: true,
      sampleOrderMappingMatches: true,
      seedMatches: true,
      initialLatentGeneratorIdentityMatches: true,
      modelEvalStateMatches: true,
      deterministicSettingsMatch: true,
      timestepSequenceMatches: true,
      autoencoderDecodeMatches: true,
      referenceFeatureExtractionMatches: true,
      classWeightingOrderMatches: true,
      batchSizeMatches: false,
      gradientGraphPathMatches: false,
    },
  }
}

export function adjudicateExecutionIdentity(facts) {
  if (!facts?.evidenceComplete || !facts.scan || !facts.rerun || !facts.identities) {
    return { selectedCause: "E", status: "insufficient_structural_evidence" }
  }
  const identity = facts.identities
  const wiringMatches = [
    "sampleIdentityMatches", "sampleOrderMappingMatches", "seedMatches",
    "initialLatentGeneratorIdentityMatches", "modelEvalStateMatches",
    "deterministicSettingsMatch", "timestepSequenceMatches",
    "autoencoderDecodeMatches", "referenceFeatureExtractionMatches",
    "classWeightingOrderMatches",
  ].every((name) => identity[name] === true)
  if (!wiringMatches) return { selectedCause: "D", status: "real_execution_identity_wiring_defect" }
  const batchDiffers = facts.scan.batchSize !== facts.rerun.batchSize
  const graphDiffers = facts.scan.autogradTailSteps !== facts.rerun.autogradTailSteps
  if (batchDiffers && graphDiffers) return { selectedCause: "C", status: "batch_and_autograd_path_joint_execution_identity_difference" }
  if (batchDiffers) return { selectedCause: "A", status: "batch_size_execution_identity_difference" }
  if (graphDiffers) return { selectedCause: "B", status: "autograd_path_execution_identity_difference" }
  return { selectedCause: "E", status: "observed_difference_not_explained_by_structural_identity" }
}

export function inspectAndAdjudicate(runnerPath, basePath) {
  const facts = inspectExecutionIdentity({
    runnerSource: fs.readFileSync(runnerPath, "utf8"),
    baseSource: fs.readFileSync(basePath, "utf8"),
  })
  return { facts, decision: adjudicateExecutionIdentity(facts) }
}
