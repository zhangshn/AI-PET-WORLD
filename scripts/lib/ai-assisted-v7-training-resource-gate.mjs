export const V7_GPU_RESOURCE_LIMITS = Object.freeze({
  maximumIdleUtilizationPercent: 10,
  maximumNonTrainingMemoryUsedMiB: 3000,
  minimumFreeMemoryMiB: 4096,
})

export function evaluateV7TrainingGpuResourceGate(gpu, limits = V7_GPU_RESOURCE_LIMITS) {
  const issues = []
  if (gpu?.available !== true) issues.push("gpu_unavailable")
  if (!Number.isFinite(gpu?.pythonComputeProcessCount) || gpu.pythonComputeProcessCount !== 0) {
    issues.push("python_gpu_training_process_already_running")
  }
  if (!Number.isFinite(gpu?.utilizationPercent) || gpu.utilizationPercent > limits.maximumIdleUtilizationPercent) {
    issues.push("gpu_compute_busy_with_nontraining_workload")
  }
  if (!Number.isFinite(gpu?.memoryUsedMiB) || gpu.memoryUsedMiB > limits.maximumNonTrainingMemoryUsedMiB) {
    issues.push("gpu_memory_busy_with_nontraining_workload")
  }
  const freeMemoryMiB = Number(gpu?.memoryTotalMiB) - Number(gpu?.memoryUsedMiB)
  if (!Number.isFinite(freeMemoryMiB) || freeMemoryMiB < limits.minimumFreeMemoryMiB) {
    issues.push("gpu_free_memory_insufficient_for_v7_training")
  }
  return issues
}
