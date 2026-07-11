export type TrainingAction =
  | "report_natural_home"
  | "report_natural_home_quality"
  | "full_natural_home"
  | "full_natural_home_structure_guided"
  | "full_natural_home_rgb_refiner"
  | "full_natural_home_v18_source_expert_bank"
  | "full_natural_home_v19_promoted_source"
  | "full_natural_home_v20_multisource_generalization"
  | "full_natural_home_v22_warning_focus"
  | "full_natural_home_v23_candidate_consolidation"
  | "full_natural_home_v24_diversity_generation"
  | "full_natural_home_v25_diversity_generalization"
  | "full_natural_home_v28_real_mask_remix"
  | "full_natural_home_v31_edge_refiner"
  | "full_natural_home_v32_patchgan_refiner"
  | "full_natural_home_v33_water_artifact_guard"
  | "full_natural_home_v34_water_stability"
  | "full_natural_home_v35_balanced_water_detail"
  | "full_natural_home_v36_balanced_generalization"
  | "full_natural_home_v37_water_failure_repair"
  | "full_natural_home_v38_water_edge_balance"
  | "full_natural_home_v39_failure_focus_repair"
  | "full_natural_home_v40_sharpness_lock_repair"
  | "full_natural_home_v41_v32_water_rescue"
  | "full_natural_home_v42_water_expert_fix"
  | "full_natural_home_v43_v32_failure_focus_repair"
  | "full_natural_home_v44_v32_stable_generalization"
  | "full_natural_home_v45_generalization"
  | "full_natural_home_v46_v45_failure_focus_repair"
  | "full_natural_home_v47_hard_failure_stabilization"
  | "full_natural_home_v48_split_expert_merge_gate"
  | "full_natural_home_v49_v32_diversity_sweep"
  | "full_natural_home_v50_diversity_water_gate"
  | "full_natural_home_v51_safe_candidate_pack"
  | "full_natural_home_v80_quality_preserving_water_repair"
  | "full_natural_home_v81_high_score_diversity_distillation"
  | "full_natural_home_v82_broad_structure_coverage"
  | "full_natural_home_v83_water_failure_repair"
  | "full_natural_home_v84_v82_safe_quality_continuation"
  | "full_natural_home_v85_v82_wide_variant_sweep"
  | "full_natural_home_v86_wide_candidate_distillation"
  | "full_natural_home_v87_quality_ledger"
  | "full_natural_home_v88_quality_allowlist_dataset"
  | "full_natural_home_v89_quality_allowlist_training"
  | "full_natural_home_v96_clean_multilayout"
  | "full_natural_home_v97_edge_boundary_repair"
  | "full_natural_home_v98_vj1_signal_repair"
  | "full_natural_home_v99_vj1_boundary_similarity_repair"
  | "full"
  | "full_multiscene"
  | "full_structure_guided"
  | "full_rgb_refiner"
  | "full_local_assets"
  | "full_discrete_assets"
  | "prepare_component_instances"
  | "prepare_training_expansion"
  | "full_autonomous_training"
  | "report_mvp_gap"
  | "full_game_map_material_slot_v46_runtime_frame"

export type ResourceUsageSummary = {
  status: "running" | "completed" | "failed"
  action: string
  durationSeconds: number
  telemetrySampleCount?: number
  sampleCount: number
  averageGpuUtilizationPercent: number
  maxGpuUtilizationPercent: number
  maxMemoryUsedMiB: number
  maxTemperatureCelsius: number
  averagePowerWatts: number
  electricity: { estimatedKwh: number; estimatedCny: number; cnyPerKwh: number }
  tokenLedger: { externalApiTokens: number; externalApiCostCny: number; localComputeTokens: number }
}

export type TrainingProcessEvent = {
  id: string
  timestamp: string
  action: string
  runId: string
  kind: string
  status: "running" | "success" | "failed" | "error" | "blocked" | "info"
  title: string
  titleZh?: string
  detail?: string
  detailZh?: string
  script?: string
  currentStep?: string
  error?: string | null
  errorZh?: string | null
  autoAnalysisVersion?: string
  resultScope?: string
  resultScopeZh?: string
  successMeaning?: string
  successMeaningZh?: string
  failureMeaning?: string
  failureMeaningZh?: string
  finalGameMapSuccess?: boolean
  finalGameMapMeaning?: string
  finalGameMapMeaningZh?: string
  canEnterWorld?: boolean
  worldEntryMeaning?: string
  worldEntryMeaningZh?: string
  evidenceRequirement?: string
  evidenceRequirementZh?: string
  nextAction?: string
  nextActionZh?: string
  resourceSessionId?: string
  archiveId?: string
  evidencePath?: string
}

export type TrainingProcessLedger = {
  schemaVersion: "ai-painter-training-process-ledger-v1"
  updatedAt: string | null
  events: TrainingProcessEvent[]
  summary: {
    total: number
    running: number
    success: number
    failed: number
    error: number
    blocked: number
    info: number
    lastEvent: TrainingProcessEvent | null
  }
}

export type Progress = {
  system: {
    gpuAvailable: boolean
    name: string
    memoryTotalMiB: number
    memoryUsedMiB: number
    utilizationPercent: number
    temperatureCelsius: number
    driver: string
  }
  model: { name: string; framework: string; ownership?: string }
  dataset: { formalSceneSamples: number; bootstrapSamples: number; imageSize?: string; conditionChannels?: number }
  multiscene: { samples: number; inferenceReady: boolean; reviewStatus: string }
  structureGuided: {
    summary: { bestStructureIoU?: number } | null
    latest: { epoch?: number } | null
    checkpointReady: boolean
    inferenceReady: boolean
  }
  rgbRefiner: { summary: { bestValidationLoss?: number } | null; checkpointReady: boolean; inferenceReady: boolean }
  localAssets: { compositeReady: boolean; reviewStatus: string }
  discreteAssets: {
    latestByCategory: Record<string, { epoch?: number } | null>
    compositeReady: boolean
    reviewStatus: string
  }
  componentReadiness: {
    readyChannelCount?: number
    blockedChannelCount?: number
    canStartAutonomousTraining?: boolean
  } | null
  trainingExpansion: { manifest: { sampleCount?: number } | null }
  autonomousTraining: {
    latestDiscrete: unknown | null
    reviewStatus: string
    structureSummary: { bestStructureIoU?: number } | null
  }
  mvpGap: { missingRealAssetChannels?: string[]; assetSummary?: { totalUsableAssets?: number } } | null
  visualUnitV0: {
    schemaVersion: "visual-unit-v0"
    status: "schema_ready_registry_seeded"
    currentMvpUnitCount: number
    futureUnitCount: number
    approvedUnitCount: number
    missingForDynamicWorld: string[]
    nextModule: string
  }
  visualUnitData: {
    schemaVersion: "visual-unit-data-v0"
    status: string
    formalWorldDisplay: boolean
    trainingReadySampleCount: number
    sampleCount: number
    nextRequiredWork?: string[]
  } | null
  naturalHomeReadiness: {
    canStartTraining?: boolean
    eligibleSampleCount?: number
    blockedSampleCount?: number
    sourceSampleCount?: number
    goalZh?: string
  } | null
  naturalHomeQuality: {
    status?: "mvp_ready" | "experiment_only" | "blocked" | string
    sampleCount?: number
    minimumExperimentSampleCount?: number
    minimumMvpSampleCount?: number
    blockedSampleCount?: number
    forbiddenPixelTotal?: number
    conflictPixelTotal?: number
    missingVarietyChannels?: string[]
    optionalLowVarietyChannels?: string[]
    canTrainExperiment?: boolean
    canTrainMvpV1?: boolean
    nextActions?: string[]
  } | null
  naturalHomeTraining: {
    datasetManifest?: { sampleCount?: number; trainCount?: number; validationCount?: number } | null
    summary?: { bestSelectionLoss?: number } | null
    latest?: { epoch?: number } | null
    inferenceReady?: boolean
  } | null
  naturalHomeStructure: {
    summary?: { bestSelectionLoss?: number; bestStructureIoU?: number } | null
    latest?: { epoch?: number } | null
    checkpointReady?: boolean
    inferenceReady?: boolean
    structurePreviewReady?: boolean
  } | null
  naturalHomeRefiner: {
    summary?: { bestValidationLoss?: number } | null
    latest?: { epoch?: number } | null
    checkpointReady?: boolean
    inferenceReady?: boolean
  } | null
  naturalHomeSourceExpertBank: {
    latest?: {
      status?: string
      sourceCount?: number
      contactSheet?: string
      rows?: Array<{
        sourceId?: string
        status?: string
        trainCount?: number
        validationCount?: number
        diagnosis?: {
          mae?: number
          psnr?: number
          sharpnessRatio?: number
          edgeDensityRatio?: number
        }
      }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomePromotedSource: {
    latest?: {
      status?: string
      sourceCount?: number
      contactSheet?: string
      rows?: Array<{
        sourceId?: string
        status?: string
        trainCount?: number
        validationCount?: number
        diagnosis?: {
          mae?: number
          psnr?: number
          sharpnessRatio?: number
          edgeDensityRatio?: number
        }
      }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeMultisourceGeneralization: {
    latest?: {
      status?: string
      sourceCount?: number
      contactSheet?: string
      rows?: Array<{
        sourceId?: string
        status?: string
        trainCount?: number
        validationCount?: number
        diagnosis?: {
          mae?: number
          psnr?: number
          sharpnessRatio?: number
          edgeDensityRatio?: number
        }
      }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeWarningFocus: {
    latest?: {
      status?: string
      sourceCount?: number
      contactSheet?: string
      rows?: Array<{
        sourceId?: string
        status?: string
        trainCount?: number
        validationCount?: number
        diagnosisStatus?: string
        mae?: number
        psnr?: number
        sharpnessRatio?: number
        edgeDensityRatio?: number
      }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeCandidateConsolidation: {
    latest?: {
      status?: string
      sourceCount?: number
      contactSheet?: string
      rows?: Array<{
        sourceId?: string
        status?: string
        trainCount?: number
        validationCount?: number
        diagnosisStatus?: string
        mae?: number
        psnr?: number
        sharpnessRatio?: number
        edgeDensityRatio?: number
      }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeDiversityGeneration: {
    latest?: {
      status?: string
      sourceCount?: number
      sampleCount?: number
      contactSheet?: string
      rows?: Array<{
        sourceId?: string
        status?: string
        styleSourceId?: string
        generated?: string
        contactSheet?: string
      }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeDiversityGeneralization: {
    latest?: {
      status?: string
      sourceCount?: number
      sampleCount?: number
      contactSheet?: string
      rows?: Array<{
        sourceId?: string
        status?: string
        styleSourceId?: string
        generated?: string
        contactSheet?: string
      }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeDiversityRefiner?: {
    latest?: {
      status?: string
      sampleCount?: number
      contactSheet?: string
      rows?: Array<{ sampleId?: string; status?: string; generated?: string; contactSheet?: string }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV27AugmentedDiversity?: {
    datasetManifest?: { sampleCount?: number; trainCount?: number; validationCount?: number } | null
    structureSummary?: { bestStructureIoU?: number; bestSelectionLoss?: number; trainSampleCount?: number; validationSampleCount?: number } | null
    refinerSummary?: { bestValidationLoss?: number; epochs?: number; steps?: number; trainSampleCount?: number; validationSampleCount?: number } | null
    latest?: {
      status?: string
      sampleCount?: number
      contactSheet?: string
      rows?: Array<{ sampleId?: string; status?: string; generated?: string; contactSheet?: string }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV28RealMaskRemix?: {
    datasetManifest?: { sampleCount?: number; trainCount?: number; validationCount?: number } | null
    structureSummary?: { bestStructureIoU?: number; bestSelectionLoss?: number; trainSampleCount?: number; validationSampleCount?: number } | null
    refinerSummary?: { bestValidationLoss?: number; epochs?: number; steps?: number; trainSampleCount?: number; validationSampleCount?: number } | null
    latest?: {
      status?: string
      sampleCount?: number
      contactSheet?: string
      rows?: Array<{ sampleId?: string; status?: string; generated?: string; contactSheet?: string }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV33WaterArtifactGuard?: {
    latest?: {
      status?: string
      sampleCount?: number
      rowCount?: number
      contactSheet?: string
      rows?: Array<{ sampleId?: string; sourceId?: string; status?: string; generated?: string; contactSheet?: string }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV34WaterStability?: {
    latest?: {
      status?: string
      sampleCount?: number
      rowCount?: number
      contactSheet?: string
      rows?: Array<{ sampleId?: string; sourceId?: string; status?: string; generated?: string; contactSheet?: string }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV35BalancedWaterDetail?: {
    latest?: {
      status?: string
      sampleCount?: number
      rowCount?: number
      contactSheet?: string
      rows?: Array<{ sampleId?: string; sourceId?: string; status?: string; generated?: string; contactSheet?: string }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV36BalancedGeneralization?: {
    latest?: {
      status?: string
      sampleCount?: number
      rowCount?: number
      contactSheet?: string
      rows?: Array<{ sampleId?: string; sourceId?: string; status?: string; generated?: string; contactSheet?: string }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV37WaterFailureRepair?: {
    latest?: {
      status?: string
      sampleCount?: number
      rowCount?: number
      contactSheet?: string
      rows?: Array<{ sampleId?: string; sourceId?: string; status?: string; generated?: string; contactSheet?: string }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV38WaterEdgeBalance?: {
    latest?: {
      status?: string
      sampleCount?: number
      rowCount?: number
      contactSheet?: string
      rows?: Array<{ sampleId?: string; sourceId?: string; status?: string; generated?: string; contactSheet?: string }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV39FailureFocusRepair?: {
    datasetManifest?: {
      status?: string
      baseTrainCount?: number
      weightedTrainCount?: number
      failedFocusCount?: number
      lowPassFocusCount?: number
      contactSheet?: string
    } | null
    trainingSummary?: { epochs?: number; steps?: number; trainSampleCount?: number; validationSampleCount?: number } | null
    trainingLatest?: { epoch?: number; step?: number } | null
    latest?: {
      status?: string
      sampleCount?: number
      rowCount?: number
      contactSheet?: string
      rows?: Array<{ sampleId?: string; sourceId?: string; status?: string; generated?: string; contactSheet?: string }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV40SharpnessLockRepair?: {
    trainingSummary?: { epochs?: number; steps?: number; trainSampleCount?: number; validationSampleCount?: number } | null
    trainingLatest?: { epoch?: number; step?: number } | null
    latest?: {
      status?: string
      sampleCount?: number
      rowCount?: number
      contactSheet?: string
      rows?: Array<{ sampleId?: string; sourceId?: string; status?: string; generated?: string; contactSheet?: string }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV41V32WaterRescue?: {
    trainingSummary?: { epochs?: number; steps?: number; trainSampleCount?: number; validationSampleCount?: number } | null
    trainingLatest?: { epoch?: number; step?: number } | null
    latest?: {
      status?: string
      sampleCount?: number
      rowCount?: number
      contactSheet?: string
      rows?: Array<{ sampleId?: string; sourceId?: string; status?: string; generated?: string; contactSheet?: string }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV42WaterExpertFix?: {
    latest?: {
      status?: string
      sampleCount?: number
      rowCount?: number
      contactSheet?: string
      rows?: Array<{ sampleId?: string; sourceId?: string; status?: string; generated?: string; contactSheet?: string }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV43V32FailureFocusRepair?: {
    datasetManifest?: {
      status?: string
      baseTrainCount?: number
      weightedTrainCount?: number
      failedFocusCount?: number
      lowPassFocusCount?: number
      contactSheet?: string
    } | null
    trainingSummary?: { epochs?: number; steps?: number; trainSampleCount?: number; validationSampleCount?: number } | null
    trainingLatest?: { epoch?: number; step?: number } | null
    latest?: {
      status?: string
      sampleCount?: number
      rowCount?: number
      contactSheet?: string
      rows?: Array<{ sampleId?: string; sourceId?: string; status?: string; generated?: string; contactSheet?: string }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV44V32StableGeneralization?: {
    trainingSummary?: { epochs?: number; steps?: number; trainSampleCount?: number; validationSampleCount?: number } | null
    trainingLatest?: { epoch?: number; step?: number } | null
    latest?: {
      status?: string
      sampleCount?: number
      rowCount?: number
      contactSheet?: string
      rows?: Array<{ sampleId?: string; sourceId?: string; status?: string; generated?: string; contactSheet?: string }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV45Generalization?: {
    datasetManifest?: {
      status?: string
      uniqueCopiedSampleCount?: number
      baseTrainCount?: number
      weightedTrainCount?: number
      validationCount?: number
      sourceCoverageCount?: number
      contactSheet?: string
    } | null
    trainingSummary?: { epochs?: number; steps?: number; trainSampleCount?: number; validationSampleCount?: number } | null
    trainingLatest?: { epoch?: number; step?: number } | null
    latest?: {
      status?: string
      sampleCount?: number
      rowCount?: number
      contactSheet?: string
      rows?: Array<{ sampleId?: string; sourceId?: string; status?: string; generated?: string; contactSheet?: string }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV46V45FailureFocusRepair?: {
    datasetManifest?: {
      status?: string
      baseTrainCount?: number
      baseValidationCount?: number
      weightedTrainCount?: number
      failedFocusCount?: number
      lowPassFocusCount?: number
      contactSheet?: string
    } | null
    trainingSummary?: { epochs?: number; steps?: number; trainSampleCount?: number; validationSampleCount?: number } | null
    trainingLatest?: { epoch?: number; step?: number } | null
    latest?: {
      status?: string
      sampleCount?: number
      rowCount?: number
      contactSheet?: string
      rows?: Array<{ sampleId?: string; sourceId?: string; status?: string; generated?: string; contactSheet?: string }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV47HardFailureStabilization?: {
    datasetManifest?: {
      status?: string
      baseTrainCount?: number
      baseValidationCount?: number
      weightedTrainCount?: number
      failedFocusCount?: number
      lowPassFocusCount?: number
      contactSheet?: string
    } | null
    trainingSummary?: { epochs?: number; steps?: number; trainSampleCount?: number; validationSampleCount?: number } | null
    trainingLatest?: { epoch?: number; step?: number } | null
    latest?: {
      status?: string
      sampleCount?: number
      rowCount?: number
      contactSheet?: string
      rows?: Array<{ sampleId?: string; sourceId?: string; status?: string; generated?: string; contactSheet?: string }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV48SplitExpertMergeGate?: {
    latest?: {
      status?: string
      sampleCount?: number
      rowCount?: number
      contactSheet?: string
      summary?: {
        rowCount?: number
        passedForNextTraining?: number
        rejectedTrainingCandidate?: number
        acceptedRepairCount?: number
        keptSourceCount?: number
        averageScore?: number
        bestScore?: number
        worstScore?: number
      }
      rows?: Array<{ sampleId?: string; sourceId?: string; status?: string; generated?: string; contactSheet?: string }>
    } | null
    repairLatest?: {
      status?: string
      sampleCount?: number
      rowCount?: number
      contactSheet?: string
      rows?: Array<{ sampleId?: string; sourceId?: string; status?: string; generated?: string; contactSheet?: string }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV49V32DiversitySweep?: {
    latest?: {
      status?: string
      sampleCount?: number
      rowCount?: number
      contactSheet?: string
      summary?: {
        rowCount?: number
        passedForNextTraining?: number
        rejectedTrainingCandidate?: number
        averageScore?: number
        bestScore?: number
        worstScore?: number
      }
      rows?: Array<{ sampleId?: string; sourceId?: string; status?: string; generated?: string; contactSheet?: string }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV50DiversityWaterGate?: {
    latest?: {
      status?: string
      contactSheet?: string
      summary?: {
        rowCount?: number
        trainingPassRows?: number
        strictPassRows?: number
        reviewRows?: number
        rejectedRows?: number
        sourceAverageScore?: number
        strictAverageScore?: number
      }
      diversity?: {
        uniqueSourceCount?: number
        uniqueVariantCount?: number
        coveredChannels?: string[]
        missingRequiredChannels?: string[]
        topologyCounts?: Record<string, number>
      }
      waterGate?: {
        status?: string
        blockingWaterFailureCount?: number
        warningWaterFailureCount?: number
      }
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV51SafeCandidatePack?: {
    latest?: {
      status?: string
      contactSheet?: string
      summary?: {
        safeRowCount?: number
        requiredSafeRows?: number
        averageScore?: number
        bestScore?: number
        worstScore?: number
        uniqueSourceCount?: number
        uniqueVariantCount?: number
      }
      rows?: Array<{ sampleId?: string; sourceId?: string; status?: string; generated?: string; target?: string }>
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV87QualityLedger?: {
    latest?: {
      status?: string
      stageId?: string
      contactSheet?: string
      summary?: {
        allowRowCount?: number
        negativeRowCount?: number
        failureCodeCount?: number
        status?: string
      }
      files?: {
        nextTrainingAllowList?: string
        negativeExamples?: string
        failureTaxonomy?: string
      }
      trainingPolicy?: {
        nextTrainingTargetSource?: string
        negativeExampleUsage?: string
        negativeExamplesMayTrainAsTarget?: boolean
      }
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV88QualityAllowlistDataset?: {
    latest?: {
      status?: string
      stageId?: string
      contactSheet?: string
      sampleCount?: number
      trainSampleCount?: number
      validationSampleCount?: number
      negativeExampleCount?: number
      trainingPolicy?: {
        targetSource?: string
        negativeExampleUsage?: string
        negativeExamplesMayTrainAsTarget?: boolean
      }
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV89QualityAllowlistTraining?: {
    trainingSummary?: {
      status?: string
      trainingVersion?: string
      modelVersion?: string
      epochs?: number
      steps?: number
      bestGeneratorLoss?: number
      bestValidationLoss?: number
      device?: string
      parameterCount?: number
    } | null
    trainingLatest?: {
      epoch?: number
      step?: number
      generatorLoss?: number
      discriminatorLoss?: number
      validationLoss?: number
      seconds?: number
      device?: string
    } | null
    latest?: {
      status?: string
      stageId?: string
      contactSheet?: string
      sampleCount?: number
      rowCount?: number
      summary?: {
        rowCount?: number
        passedForNextTraining?: number
        reviewCandidate?: number
        rejectedTrainingCandidate?: number
        averageScore?: number
        bestScore?: number
        worstScore?: number
      }
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV96CleanMultilayout?: {
    datasetLatest?: {
      status?: string
      stageId?: string
      contactSheet?: string
      sampleCount?: number
      trainSampleCount?: number
      validationSampleCount?: number
      focusSourceCount?: number
      focusCopySampleCount?: number
    } | null
    trainingSummary?: {
      status?: string
      trainingVersion?: string
      modelVersion?: string
      epochs?: number
      steps?: number
      bestGeneratorLoss?: number
      bestValidationLoss?: number
      device?: string
      parameterCount?: number
    } | null
    trainingLatest?: {
      epoch?: number
      step?: number
      generatorLoss?: number
      discriminatorLoss?: number
      validationLoss?: number
      seconds?: number
      device?: string
    } | null
    generationLatest?: {
      status?: string
      stageId?: string
      contactSheet?: string
      sampleCount?: number
    } | null
    latest?: {
      status?: string
      stageId?: string
      contactSheet?: string
      sampleCount?: number
      rowCount?: number
      summary?: {
        rowCount?: number
        passedForNextTraining?: number
        reviewCandidate?: number
        rejectedTrainingCandidate?: number
        averageScore?: number
        bestScore?: number
        worstScore?: number
      }
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV97EdgeBoundaryRepair?: {
    datasetLatest?: {
      status?: string
      stageId?: string
      contactSheet?: string
      sampleCount?: number
      trainSampleCount?: number
      validationSampleCount?: number
      focusSourceCount?: number
      focusCopySampleCount?: number
    } | null
    trainingSummary?: {
      status?: string
      trainingVersion?: string
      modelVersion?: string
      epochs?: number
      steps?: number
      bestGeneratorLoss?: number
      bestValidationLoss?: number
      device?: string
      parameterCount?: number
    } | null
    trainingLatest?: {
      epoch?: number
      step?: number
      generatorLoss?: number
      discriminatorLoss?: number
      validationLoss?: number
      seconds?: number
      device?: string
    } | null
    generationLatest?: {
      status?: string
      stageId?: string
      contactSheet?: string
      sampleCount?: number
    } | null
    latest?: {
      status?: string
      stageId?: string
      contactSheet?: string
      sampleCount?: number
      rowCount?: number
      summary?: {
        rowCount?: number
        passedForNextTraining?: number
        reviewCandidate?: number
        rejectedTrainingCandidate?: number
        averageScore?: number
        bestScore?: number
        worstScore?: number
      }
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV98Vj1SignalRepair?: {
    datasetLatest?: {
      status?: string
      stageId?: string
      contactSheet?: string
      sampleCount?: number
      trainSampleCount?: number
      validationSampleCount?: number
      focusSourceCount?: number
      focusCopySampleCount?: number
    } | null
    trainingSummary?: {
      status?: string
      trainingVersion?: string
      modelVersion?: string
      epochs?: number
      steps?: number
      bestGeneratorLoss?: number
      bestValidationLoss?: number
      device?: string
      parameterCount?: number
    } | null
    trainingLatest?: {
      epoch?: number
      step?: number
      generatorLoss?: number
      discriminatorLoss?: number
      validationLoss?: number
      seconds?: number
      device?: string
    } | null
    generationLatest?: {
      status?: string
      stageId?: string
      contactSheet?: string
      sampleCount?: number
    } | null
    latest?: {
      status?: string
      stageId?: string
      contactSheet?: string
      sampleCount?: number
      rowCount?: number
      summary?: {
        rowCount?: number
        passedForNextTraining?: number
        reviewCandidate?: number
        rejectedTrainingCandidate?: number
        averageScore?: number
        bestScore?: number
        worstScore?: number
      }
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeV99Vj1BoundarySimilarityRepair?: {
    datasetLatest?: {
      status?: string
      stageId?: string
      contactSheet?: string
      sampleCount?: number
      trainSampleCount?: number
      validationSampleCount?: number
      focusSourceCount?: number
      focusCopySampleCount?: number
    } | null
    trainingSummary?: {
      status?: string
      trainingVersion?: string
      modelVersion?: string
      epochs?: number
      steps?: number
      bestGeneratorLoss?: number
      bestValidationLoss?: number
      device?: string
      parameterCount?: number
    } | null
    trainingLatest?: {
      epoch?: number
      step?: number
      generatorLoss?: number
      discriminatorLoss?: number
      validationLoss?: number
      seconds?: number
      device?: string
    } | null
    generationLatest?: {
      status?: string
      stageId?: string
      contactSheet?: string
      sampleCount?: number
    } | null
    latest?: {
      status?: string
      stageId?: string
      contactSheet?: string
      sampleCount?: number
      rowCount?: number
      summary?: {
        rowCount?: number
        passedForNextTraining?: number
        reviewCandidate?: number
        rejectedTrainingCandidate?: number
        averageScore?: number
        bestScore?: number
        worstScore?: number
      }
    } | null
    inferenceReady?: boolean
  } | null
  naturalHomeBestTrainingCandidate?: {
    stage: string
    title: string
    latest?: {
      status?: string
      sampleCount?: number
      rowCount?: number
      contactSheet?: string
    } | null
    summary?: {
      rowCount?: number
      passedForNextTraining?: number
      reviewCandidate?: number
      rejectedTrainingCandidate?: number
      averageScore?: number
      bestScore?: number
      worstScore?: number
    }
  } | null
  trainingQualityGate: {
    status?: "passed_for_next_training" | "warning_keep_candidate" | "failed_keep_for_history" | string
    canPromoteToWorld?: false
    canEnterNextTraining?: boolean
    overallScore?: number
    summary?: {
      rowCount?: number
      passedCount?: number
      warningCount?: number
      failedCount?: number
      noteZh?: string
    }
    rows?: Array<{
      sourceId?: string
      status?: "passed" | "warning" | "failed" | string
      score?: number
      mae?: number | null
      psnr?: number | null
      sharpnessRatio?: number | null
      edgeDensityRatio?: number | null
      reasons?: string[]
    }>
  } | null
  control: {
    status: "idle" | "running" | "completed" | "failed"
    action: string | null
    currentStep: string | null
    error: string | null
  }
  resourceUsage?: {
    current: ResourceUsageSummary | null
    latest: ResourceUsageSummary | null
    history: ResourceUsageSummary[]
  }
  trainingProcessLedger?: TrainingProcessLedger
  gameMapRuntimeFrame?: {
    ready: boolean
    canShowInWorld: boolean
    status: string
    imageUrl: string | null
    recordId: string | null
    worldId: string | null
    tick: number | null
    formalJudge: {
      passed: boolean
      status: string | null
      issues: number
      metrics: {
        edgeDensity: number
        washedGrassHazeRatio: number
        pathContaminationRatio: number
        pathBlackCraterRatio: number
      }
    } | null
  }
  trainingRunArchive?: {
    ready: boolean
    status: string | null
    runId: string | null
    action: string | null
    materialFiles: number
    materialPassed: boolean
    formalVisualJudgePassed: boolean
    manualReviewStatus: string | null
    manifestPath: string | null
    compositeImagePath: string | null
    visualDeltaReview: {
      status: string | null
      priorityIssueCount: number
      targetSlots: string[]
      nextAction: string | null
      reportPath: string | null
    } | null
  }
  training: { percent: number; inferenceReady: boolean }
}
