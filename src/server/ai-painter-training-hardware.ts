import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";
import type { CurrentTrainingDashboardSnapshot } from "@/server/ai-painter-current-training-types";
import { object, arrayObjects, text, number, type JsonObject } from "@/server/ai-painter-training-progress-projection";

// Read-only, bounded host observation. No training or admission decisions.
const execFileAsync = promisify(execFile);

export async function readGpu(options: { includeProcessDetails?: boolean } = {}): Promise<CurrentTrainingDashboardSnapshot["gpu"]> {
  const unavailable = (reason: string): CurrentTrainingDashboardSnapshot["gpu"] => ({
    available: false,
    name: "GPU读数不可用",
    memoryTotalMiB: null,
    memoryUsedMiB: null,
    utilizationPercent: null,
    temperatureCelsius: null,
    driver: "--",
    activeComputeProcessCount: null,
    ...(options.includeProcessDetails ? { computeProcesses: null } : {}),
    observationIssues: [reason],
  });
  try {
    const { stdout } = await execFileAsync(
      "nvidia-smi",
      [
        "--query-gpu=name,memory.total,memory.used,utilization.gpu,temperature.gpu,driver_version",
        "--format=csv,noheader,nounits",
      ],
      { windowsHide: true, timeout: 5_000 },
    );
    const rows = stdout.trim().split(/\r?\n/).filter(Boolean);
    if (rows.length !== 1) return unavailable(rows.length > 1
      ? "gpu_multiple_rows_unsupported" : "gpu_observation_empty");
    const fields = rows[0].split(",").map((value) => value.trim());
    if (fields.length !== 6 || !fields[0]) return unavailable("gpu_observation_invalid");
    const [name, total, used, utilization, temperature, driver] = fields;
    const observationIssues: string[] = [];
    const metric = (value: string, field: string, maximum = Infinity) => {
      const parsed = /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : NaN;
      if (!Number.isFinite(parsed) || parsed > maximum) {
        observationIssues.push(`gpu_${field}_unavailable`);
        return null;
      }
      return parsed;
    };
    const processResult = await execFileAsync(
      "nvidia-smi",
      [options.includeProcessDetails ? "--query-compute-apps=pid,process_name,used_memory" : "--query-compute-apps=pid", "--format=csv,noheader,nounits"],
      { windowsHide: true, timeout: 5_000 },
    ).catch(() => null);
    let activeComputeProcessCount: number | null = null;
    let computeProcesses: CurrentTrainingDashboardSnapshot["gpu"]["computeProcesses"] = null;
    if (processResult === null) {
      observationIssues.push("gpu_process_query_failed");
    } else if (options.includeProcessDetails) {
      const rows = processResult.stdout.trim().split(/\r?\n/).filter(Boolean);
      const unique = new Map<number, { pid: number; processName: string; usedMemoryMiB: number | null }>();
      const valid = rows.every(row => {
        const fields = row.split(",").map(value => value.trim());
        if (fields.length < 3) return false;
        const rawPid = fields[0], rawMemory = fields.at(-1)!;
        const pid = /^\d+$/.test(rawPid) ? Number(rawPid) : NaN;
        const processName = fields.slice(1, -1).join(",").trim();
        if (!Number.isSafeInteger(pid) || pid <= 0 || !processName) return false;
        const memory = /^\d+(?:\.\d+)?$/.test(rawMemory) ? Number(rawMemory) : NaN;
        const usedMemoryMiB = Number.isFinite(memory) ? memory : null;
        const previous = unique.get(pid);
        if (previous && (previous.processName !== processName || previous.usedMemoryMiB !== usedMemoryMiB)) return false;
        unique.set(pid, { pid, processName, usedMemoryMiB });
        return true;
      });
      if (valid) {
        computeProcesses = [...unique.values()];
        activeComputeProcessCount = computeProcesses.length;
      } else {
        observationIssues.push("gpu_process_observation_invalid");
      }
    } else {
      const pids = processResult.stdout.trim().split(/\r?\n/).map(value => value.trim()).filter(Boolean);
      if (pids.every(value => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0)) {
        activeComputeProcessCount = new Set(pids.map(Number)).size;
      } else {
        observationIssues.push("gpu_process_observation_invalid");
      }
    }
    return {
      available: true,
      name,
      memoryTotalMiB: metric(total, "memory_total"),
      memoryUsedMiB: metric(used, "memory_used"),
      utilizationPercent: metric(utilization, "utilization", 100),
      temperatureCelsius: metric(temperature, "temperature"),
      driver,
      activeComputeProcessCount,
      ...(options.includeProcessDetails ? { computeProcesses } : {}),
      observationIssues,
    };
  } catch {
    return unavailable("gpu_query_failed");
  }
}

export async function readHardware(): Promise<
  CurrentTrainingDashboardSnapshot["hardware"]
> {
  const hardwareScript = String.raw`
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$hardwareCpuRows = @(Get-CimInstance Win32_Processor)
$hardwareOsRow = Get-CimInstance Win32_OperatingSystem
$hardwareDiskRows = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
  $hardwareDiskTotal = if ($null -ne $_.Size) { [double]$_.Size } else { $null }
  $hardwareDiskFree = if ($null -ne $_.FreeSpace) { [double]$_.FreeSpace } else { $null }
  $hardwareDiskUsed = if ($null -ne $hardwareDiskTotal -and $null -ne $hardwareDiskFree) { $hardwareDiskTotal - $hardwareDiskFree } else { $null }
  [pscustomobject]@{
    name = [string]$_.DeviceID
    volumeName = if ($_.VolumeName) { [string]$_.VolumeName } else { $null }
    fileSystem = if ($_.FileSystem) { [string]$_.FileSystem } else { $null }
    totalGiB = if ($null -ne $hardwareDiskTotal) { [math]::Round($hardwareDiskTotal / 1GB, 2) } else { $null }
    usedGiB = if ($null -ne $hardwareDiskUsed) { [math]::Round($hardwareDiskUsed / 1GB, 2) } else { $null }
    freeGiB = if ($null -ne $hardwareDiskFree) { [math]::Round($hardwareDiskFree / 1GB, 2) } else { $null }
    usagePercent = if ($hardwareDiskTotal -gt 0 -and $null -ne $hardwareDiskUsed) { [math]::Round(($hardwareDiskUsed / $hardwareDiskTotal) * 100, 1) } else { $null }
  }
})
$hardwareAdapterRows = @(Get-NetAdapter -Physical -ErrorAction SilentlyContinue | ForEach-Object {
  [pscustomobject]@{
    name = [string]$_.Name
    status = [string]$_.Status
    linkSpeed = if ($_.LinkSpeed) { [string]$_.LinkSpeed } else { $null }
    interfaceDescription = if ($_.InterfaceDescription) { [string]$_.InterfaceDescription } else { $null }
  }
})
$hardwareCpuLoad = @($hardwareCpuRows | Where-Object { $null -ne $_.LoadPercentage } | ForEach-Object { [double]$_.LoadPercentage })
$hardwareCpuCurrentClock = @($hardwareCpuRows | Where-Object { $null -ne $_.CurrentClockSpeed } | ForEach-Object { [double]$_.CurrentClockSpeed })
$hardwareCpuMaxClock = @($hardwareCpuRows | Where-Object { $null -ne $_.MaxClockSpeed } | ForEach-Object { [double]$_.MaxClockSpeed })
$hardwarePhysicalCoreCounts = @($hardwareCpuRows | Where-Object { $null -ne $_.NumberOfCores } | ForEach-Object { [int]$_.NumberOfCores })
$hardwareLogicalCoreCounts = @($hardwareCpuRows | Where-Object { $null -ne $_.NumberOfLogicalProcessors } | ForEach-Object { [int]$_.NumberOfLogicalProcessors })
$hardwareMemoryTotalMiB = if ($null -ne $hardwareOsRow.TotalVisibleMemorySize) { [math]::Round(([double]$hardwareOsRow.TotalVisibleMemorySize) / 1024, 0) } else { $null }
$hardwareMemoryAvailableMiB = if ($null -ne $hardwareOsRow.FreePhysicalMemory) { [math]::Round(([double]$hardwareOsRow.FreePhysicalMemory) / 1024, 0) } else { $null }
$hardwareMemoryUsedMiB = if ($null -ne $hardwareMemoryTotalMiB -and $null -ne $hardwareMemoryAvailableMiB) { $hardwareMemoryTotalMiB - $hardwareMemoryAvailableMiB } else { $null }
$hardwareSnapshot = [pscustomobject]@{
  capturedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
  cpu = [pscustomobject]@{
    model = [string]($hardwareCpuRows | Select-Object -First 1 -ExpandProperty Name)
    loadPercent = if ($hardwareCpuLoad.Count -gt 0) { [math]::Round(($hardwareCpuLoad | Measure-Object -Average).Average, 1) } else { $null }
    physicalCoreCount = if ($hardwareCpuRows.Count -gt 0 -and $hardwarePhysicalCoreCounts.Count -eq $hardwareCpuRows.Count) { [int](($hardwarePhysicalCoreCounts | Measure-Object -Sum).Sum) } else { $null }
    logicalProcessorCount = if ($hardwareCpuRows.Count -gt 0 -and $hardwareLogicalCoreCounts.Count -eq $hardwareCpuRows.Count) { [int](($hardwareLogicalCoreCounts | Measure-Object -Sum).Sum) } else { $null }
    currentClockMhz = if ($hardwareCpuCurrentClock.Count -gt 0) { [math]::Round(($hardwareCpuCurrentClock | Measure-Object -Average).Average, 0) } else { $null }
    maxClockMhz = if ($hardwareCpuMaxClock.Count -gt 0) { [math]::Round(($hardwareCpuMaxClock | Measure-Object -Average).Average, 0) } else { $null }
    packageCount = if ($hardwareCpuRows.Count -gt 0) { [int]$hardwareCpuRows.Count } else { $null }
  }
  memory = [pscustomobject]@{
    totalMiB = $hardwareMemoryTotalMiB
    usedMiB = $hardwareMemoryUsedMiB
    availableMiB = $hardwareMemoryAvailableMiB
    usagePercent = if ($hardwareMemoryTotalMiB -gt 0 -and $null -ne $hardwareMemoryUsedMiB) { [math]::Round(($hardwareMemoryUsedMiB / $hardwareMemoryTotalMiB) * 100, 1) } else { $null }
  }
  disks = $hardwareDiskRows
  networkAdapters = $hardwareAdapterRows
  system = [pscustomobject]@{
    osCaption = [string]$hardwareOsRow.Caption
    version = [string]$hardwareOsRow.Version
    buildNumber = [string]$hardwareOsRow.BuildNumber
    architecture = [string]$hardwareOsRow.OSArchitecture
    hostname = [string]$hardwareOsRow.CSName
    uptimeSeconds = if ($null -ne $hardwareOsRow.LastBootUpTime) { [math]::Floor(((Get-Date) - $hardwareOsRow.LastBootUpTime).TotalSeconds) } else { $null }
  }
}
$hardwareSnapshot | ConvertTo-Json -Compress -Depth 6
`;
  try {
    const { stdout } = await execFileAsync(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", hardwareScript],
      { windowsHide: true, timeout: 5_000, maxBuffer: 1024 * 1024 },
    );
    const parsed = JSON.parse(stdout.trim()) as JsonObject;
    const cpu = object(parsed.cpu);
    const memory = object(parsed.memory);
    const system = object(parsed.system);
    const observationIssues: string[] = [];
    const observedNumber = (value: unknown, field: string) => {
      const observed = number(value);
      if (observed === null || observed < 0) {
        observationIssues.push(`hardware_${field}_unavailable`);
        return null;
      }
      return observed;
    };
    return {
      capturedAtUtc: text(parsed.capturedAtUtc) ?? new Date().toISOString(),
      observationSource: "windows_cim",
      observationIssues,
      cpu: {
        model: text(cpu?.model) ?? "未知CPU",
        loadPercent: observedNumber(cpu?.loadPercent, "cpu_load"),
        physicalCoreCount: observedNumber(cpu?.physicalCoreCount, "physical_core_count"),
        logicalProcessorCount: observedNumber(cpu?.logicalProcessorCount, "logical_processor_count"),
        currentClockMhz: observedNumber(cpu?.currentClockMhz, "cpu_current_clock"),
        maxClockMhz: observedNumber(cpu?.maxClockMhz, "cpu_max_clock"),
        packageCount: observedNumber(cpu?.packageCount, "cpu_package_count"),
      },
      memory: {
        totalMiB: observedNumber(memory?.totalMiB, "memory_total"),
        usedMiB: observedNumber(memory?.usedMiB, "memory_used"),
        availableMiB: observedNumber(memory?.availableMiB, "memory_available"),
        usagePercent: observedNumber(memory?.usagePercent, "memory_usage"),
      },
      disks: arrayObjects(parsed.disks).map((disk, index) => ({
        name: text(disk.name) ?? "--",
        volumeName: text(disk.volumeName),
        fileSystem: text(disk.fileSystem),
        totalGiB: observedNumber(disk.totalGiB, `disk_${index}_total`),
        usedGiB: observedNumber(disk.usedGiB, `disk_${index}_used`),
        freeGiB: observedNumber(disk.freeGiB, `disk_${index}_free`),
        usagePercent: observedNumber(disk.usagePercent, `disk_${index}_usage`),
      })),
      networkAdapters: arrayObjects(parsed.networkAdapters).map((adapter) => ({
        name: text(adapter.name) ?? "--",
        status: text(adapter.status) ?? "Unknown",
        linkSpeed: text(adapter.linkSpeed),
        interfaceDescription: text(adapter.interfaceDescription),
      })),
      system: {
        osCaption: text(system?.osCaption) ?? os.type(),
        version: text(system?.version) ?? "--",
        buildNumber: text(system?.buildNumber) ?? "--",
        architecture: text(system?.architecture) ?? os.arch(),
        hostname: text(system?.hostname) ?? os.hostname(),
        uptimeSeconds: number(system?.uptimeSeconds) ?? Math.floor(os.uptime()),
      },
    };
  } catch {
    return fallbackHardware();
  }
}

function fallbackHardware(): CurrentTrainingDashboardSnapshot["hardware"] {
  const cpuRows = os.cpus();
  const totalMiB = Math.round(os.totalmem() / 1024 / 1024);
  const availableMiB = Math.round(os.freemem() / 1024 / 1024);
  const usedMiB = totalMiB - availableMiB;
  return {
    capturedAtUtc: new Date().toISOString(),
    observationSource: "node_os_fallback",
    observationIssues: ["windows_hardware_query_unavailable", "physical_cpu_topology_unavailable", "maximum_cpu_clock_unavailable", "disk_and_network_inventory_unavailable"],
    cpu: {
      model: cpuRows[0]?.model ?? "未知CPU",
      loadPercent: null,
      physicalCoreCount: null,
      logicalProcessorCount: cpuRows.length || null,
      currentClockMhz: cpuRows[0]?.speed ?? null,
      maxClockMhz: null,
      packageCount: null,
    },
    memory: {
      totalMiB,
      usedMiB,
      availableMiB,
      usagePercent: totalMiB
        ? Math.round((usedMiB / totalMiB) * 1_000) / 10
        : null,
    },
    disks: [],
    networkAdapters: [],
    system: {
      osCaption: os.type(),
      version: os.release(),
      buildNumber: "--",
      architecture: os.arch(),
      hostname: os.hostname(),
      uptimeSeconds: Math.floor(os.uptime()),
    },
  };
}
