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

export type ResourceUsageSummary = {
  status: "running" | "completed" | "failed"
  action: string
  durationSeconds: number
  sampleCount: number
  averageGpuUtilizationPercent: number
  maxGpuUtilizationPercent: number
  maxMemoryUsedMiB: number
  maxTemperatureCelsius: number
  averagePowerWatts: number
  electricity: { estimatedKwh: number; estimatedCny: number; cnyPerKwh: number }
  tokenLedger: { externalApiTokens: number; externalApiCostCny: number; localComputeTokens: number }
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
  training: { percent: number; inferenceReady: boolean }
}
