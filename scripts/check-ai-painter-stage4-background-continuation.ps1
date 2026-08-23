param([Parameter(Mandatory = $true)][string]$RunId)

$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$node = (Get-Command node.exe).Source
$fixture = Join-Path $root "scripts\fixtures\ai-painter-stage4-background-survival-fixture.mjs"
$testRoot = Join-Path $root ".runtime\ai-painter\stage4-background-continuation-cpu-regressions\$RunId"
$output = Join-Path $testRoot "survival.jsonl"
$hostExecutionId = "AI-PET-WORLD-Stage4-Disconnect-Test-$RunId"
if (Test-Path -LiteralPath $testRoot) { throw "cpu_fixture_output_exists" }
New-Item -ItemType Directory -Path $testRoot | Out-Null

$positive = [ordered]@{}
$negative = [ordered]@{}
try {
  $commandLine = '"' + $node + '" "' + $fixture + '" "' + $output + '"'
  $created = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $commandLine; CurrentDirectory = $root }
  if ($created.ReturnValue -ne 0) { throw "wmi_fixture_create_failed:$($created.ReturnValue)" }
  $positive.process_brokered = $created.ProcessId -gt 0
  Start-Sleep -Seconds 1
  $positive.launcher_returned_before_worker_finished = (Test-Path -LiteralPath $output) -and ((Get-Content -LiteralPath $output).Count -eq 1)
  Start-Sleep -Seconds 5
  $lines = @(Get-Content -LiteralPath $output | ForEach-Object { $_ | ConvertFrom-Json })
  $positive.worker_survived_launcher_exit = $lines.Count -eq 2 -and $lines[1].status -eq "fixture_survived_launcher_exit"
  $positive.worker_pid_stable = $lines.Count -eq 2 -and $lines[0].pid -eq $lines[1].pid
  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($lines[0].pid)" -ErrorAction SilentlyContinue
  $negative.worker_not_child_of_checker = $lines[0].pid -ne $PID
  $negative.absolute_job_path_validation_present = (Select-String -LiteralPath (Join-Path $root "scripts\run-ai-painter-stage4-stage0-to-80-background-worker.mjs") -Pattern "background_job_path_invalid" -Quiet)
  $negative.output_reuse_validation_present = (Select-String -LiteralPath (Join-Path $root "scripts\run-ai-painter-stage4-stage0-to-80-background.mjs") -Pattern "background_job_namespace_exists" -Quiet)
  $negative.runner_hash_validation_present = (Select-String -LiteralPath (Join-Path $root "scripts\run-ai-painter-stage4-stage0-to-80-background-worker.mjs") -Pattern "background_continuation_runner_identity_mismatch" -Quiet)
  $negative.logical_job_path_passed_to_broker = (Select-String -LiteralPath (Join-Path $root "scripts\run-ai-painter-stage4-stage0-to-80-background.mjs") -Pattern '"-JobPath", project\(jobPath\)' -Quiet)
  if (@($positive.Values) -contains $false -or @($negative.Values) -contains $false) { throw "background_disconnect_regression_failed" }
  $report = [ordered]@{ schemaVersion = "ai-painter-stage4-background-continuation-cpu-report-v1"; status = "passed_background_continuation_disconnect_regression"; runId = $RunId; positive = $positive; negative = $negative; hostExecutionId = $hostExecutionId; brokeredProcessId = [int]$created.ProcessId; output = $output; recordedAtUtc = (Get-Date).ToUniversalTime().ToString("o") }
  $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $testRoot "cpu-report.json") -Encoding utf8
  $report | ConvertTo-Json -Depth 8
}
finally {}
