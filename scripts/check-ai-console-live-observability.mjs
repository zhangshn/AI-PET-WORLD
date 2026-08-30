import fs from "node:fs"
import path from "node:path"
import process from "node:process"

const root = process.cwd()
const files = {
  service: "src/server/ai-console-observability/local-observability.ts",
  telemetry: "src/server/ai-console-observability/training-telemetry-store.ts",
  endpoint: "src/app/api/ai-console/observability/live/route.ts",
  client: "src/app/ai-console/ai-console-live-observability.ts",
  status: "src/app/ai-console/ai-console-live-status.tsx",
  panel: "src/app/ai-console/ai-console-observability-panel.tsx",
  rootPage: "src/app/ai-console/page.tsx",
  workspace: "src/app/ai-console/ai-console-workspace.tsx",
  systemProjection: "src/server/ai-console/system-projection.ts",
  trainingProjection: "src/server/ai-console/training-observability-projection.ts",
}

const failures = []
const sources = {}
for (const [name, relativePath] of Object.entries(files)) {
  const absolutePath = path.join(root, ...relativePath.split("/"))
  if (!fs.existsSync(absolutePath)) {
    failures.push(`missing:${name}:${relativePath}`)
    sources[name] = ""
  } else {
    sources[name] = fs.readFileSync(absolutePath, "utf8")
  }
}

const required = {
  service: ["nvidia-smi", "temperature.gpu", "power.draw", "Get-CimInstance Win32_Process", "training_process_pattern_match", "sampleCpuUtilization", "targetRefreshIntervalMs = 250", "sampleSequence", "sampleCompletedAtUtc", "sampleDurationMs", "channelTimings", 'timestampPrecision: "milliseconds"'],
  telemetry: ["ai_console_training_telemetry_v1", "ai_console_training_telemetry_writer_v1", "training-telemetry-v1.sqlite", "BEGIN IMMEDIATE", "heartbeatAtUtc", "recordSha256"],
  endpoint: ["ai_console_live_observability_v2", "no-store", "sampleAiConsoleLiveObservability"],
  client: ["useSyncExternalStore", "setInterval", "targetRefreshIntervalMs = 250", "sessionStorage", "600", "roundTripDurationMs", "sampleCompletedAtUtc", "ai_console_live_observability_v2"],
  status: ["AiConsoleLiveStatus", "本机精确实时状态", "CPU", "内存", "GPU", "显存", "温度", "训练指标未上报", "sampleSequence", "AGE"],
  panel: ["训练实时仪表盘", "本机资源实时仪表盘", "250毫秒目标刷新", "毫秒时间合同", "GPU年龄", "Sparkline", "进程匹配，不等于正式Run"],
  systemProjection: ["gpuTemperatureCelsius", "gpuPowerDrawWatts", "detectedTrainingProcessCount"],
  trainingProjection: ["runId", "epoch", "loss", "detectedTrainingProcessCount"],
}

for (const [name, markers] of Object.entries(required)) {
  for (const marker of markers) {
    if (!sources[name]?.includes(marker)) failures.push(`marker_missing:${name}:${marker}`)
  }
}

if (!sources.rootPage.includes("<AiConsoleLiveStatus />")) failures.push("root_live_status_missing")
if (!sources.workspace.includes("<AiConsoleLiveStatus />")) failures.push("workspace_live_status_missing")
for (const marker of ['mode="resources"', 'mode="telemetry"', 'mode="training"']) {
  if (!sources.workspace.includes(marker)) failures.push(`workspace_panel_missing:${marker}`)
}

for (const [name, source] of Object.entries(sources)) {
  if (/ai-painter-progress|\/api\/ai-painter|data[\\/]ai-painter|\.runtime[\\/]ai-painter/u.test(source)) {
    failures.push(`legacy_coupling:${name}`)
  }
}

if (/POST|writeFile|appendFile|unlink|rename|rmSync/u.test(sources.endpoint)) failures.push("live_endpoint_not_readonly")
if (!sources.telemetry.includes("if (!existsSync(storePath))")) failures.push("telemetry_get_missing_no_create_boundary")
if (sources.client.includes("setInterval(poll, 2_000)")) failures.push("legacy_two_second_poll_present")

const result = {
  ok: failures.length === 0,
  schemaVersion: "ai_console_live_observability_check_v2",
  globalLiveStatusSurfaces: 2,
  professionalDashboards: 3,
  failures,
}

console.log(JSON.stringify(result, null, 2))
if (!result.ok) process.exitCode = 1
