param(
  [Parameter(Mandatory = $true)][string]$HostExecutionId,
  [Parameter(Mandatory = $true)][string]$NodePath,
  [Parameter(Mandatory = $true)][string]$WorkerPath,
  [Parameter(Mandatory = $true)][string]$JobPath,
  [Parameter(Mandatory = $true)][string]$JobSha256,
  [Parameter(Mandatory = $true)][string]$WorkingDirectory
)

$ErrorActionPreference = "Stop"
$commandLine = '"' + $NodePath + '" "' + $WorkerPath + '" --job "' + $JobPath + '" --job-sha256 "' + $JobSha256 + '"'
$result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
  CommandLine = $commandLine
  CurrentDirectory = $WorkingDirectory
}
if ($result.ReturnValue -ne 0 -or $result.ProcessId -le 0) {
  throw "wmi_background_process_create_failed:$($result.ReturnValue)"
}
Start-Sleep -Milliseconds 400
$process = Get-CimInstance Win32_Process -Filter "ProcessId=$($result.ProcessId)" -ErrorAction SilentlyContinue
if (-not $process) { throw "wmi_background_process_not_alive_after_start" }
$parent = Get-CimInstance Win32_Process -Filter "ProcessId=$($process.ParentProcessId)" -ErrorAction SilentlyContinue

[ordered]@{
  status = "stage4_background_process_brokered_and_started"
  hostExecutionId = $HostExecutionId
  processId = [int]$result.ProcessId
  parentProcessId = [int]$process.ParentProcessId
  parentProcessName = if ($parent) { [string]$parent.Name } else { $null }
  mechanism = "wmi_win32_process_create"
  workerPath = $WorkerPath
  jobPath = $JobPath
} | ConvertTo-Json -Depth 4
