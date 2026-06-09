import assert from "node:assert/strict"

import {
  executeRealImageWithExecutorShell,
  readRealImageExecutorShellConfig,
  readRealImageExecutorShellHealth,
  runRealImageExecutorShellDryRun,
} from "../services/local-image-model/real-image-executor-shell.mjs"
import { readRealImageRunnerImplementationHealth } from "../services/local-image-model/real-image-runner-implementation.mjs"

main()

async function main() {
  printTitle("AI-PET-WORLD real image executor shell test")

  testExecutorShellDefaultDisabled()
  testExecutorShellEnabledWithoutCommandBlocked()
  testExecutorShellInvalidArgsBlocked()
  testExecutorShellConfigReadyButStillDoesNotExecute()
  await testExecutorShellDryRunDoesNotExecute()
  await testExecutorShellGenerateDoesNotExecute()
  testRunnerImplementationExposesExecutorShell()

  console.log("")
  console.log("RESULT: real image executor shell test passed.")
}

function testExecutorShellDefaultDisabled() {
  const health = readRealImageExecutorShellHealth()

  assert.equal(health.ok, false)
  assert.equal(health.status, "real_image_executor_shell_disabled")
  assert.equal(health.enabled, false)
  assert.equal(health.commandConfigured, false)
  assert.equal(health.canExecuteCommand, false)
  assert.equal(health.canGenerateRealBitmap, false)
  assert.equal(health.willExecuteCommand, false)
  assert.equal(health.canShowToPlayer, false)

  printCheck("executor shell default disabled")
}

function testExecutorShellEnabledWithoutCommandBlocked() {
  const health = readRealImageExecutorShellHealth({
    enabled: true,
  })

  assert.equal(health.ok, false)
  assert.equal(health.status, "real_image_executor_shell_command_missing")
  assert.equal(health.enabled, true)
  assert.equal(health.commandConfigured, false)
  assert.equal(health.canExecuteCommand, false)
  assert.equal(health.willExecuteCommand, false)

  printCheck("executor shell enabled without command blocked")
}

function testExecutorShellInvalidArgsBlocked() {
  const health = readRealImageExecutorShellHealth({
    enabled: true,
    command: "node",
    argsJson: "{bad json",
  })

  assert.equal(health.ok, false)
  assert.equal(health.status, "real_image_executor_shell_args_invalid")
  assert.equal(health.enabled, true)
  assert.equal(health.commandConfigured, true)
  assert.equal(health.argsValid, false)
  assert.equal(health.canExecuteCommand, false)

  printCheck("executor shell invalid args blocked")
}

function testExecutorShellConfigReadyButStillDoesNotExecute() {
  const health = readRealImageExecutorShellHealth({
    enabled: true,
    command: "node",
    argsJson: JSON.stringify(["mock-runner.mjs"]),
    timeoutMs: 10_000,
  })

  assert.equal(health.ok, false)
  assert.equal(
    health.status,
    "real_image_executor_shell_ready_but_execution_not_connected"
  )
  assert.equal(health.enabled, true)
  assert.equal(health.commandConfigured, true)
  assert.equal(health.argsValid, true)
  assert.equal(health.timeoutMs, 10_000)
  assert.equal(health.executorConnected, false)
  assert.equal(health.canExecuteCommand, false)
  assert.equal(health.willExecuteCommand, false)
  assert.equal(health.canShowToPlayer, false)

  const config = readRealImageExecutorShellConfig({
    enabled: true,
    command: "node",
    argsJson: ["mock-runner.mjs"],
  })

  assert.equal(config.enabled, true)
  assert.equal(config.command, "node")
  assert.deepEqual(config.args, ["mock-runner.mjs"])
  assert.equal(config.argsValid, true)

  printCheck("executor shell config ready but still does not execute")
}

async function testExecutorShellDryRunDoesNotExecute() {
  const dryRun = await runRealImageExecutorShellDryRun({
    enabled: true,
    command: "node",
    argsJson: JSON.stringify(["mock-runner.mjs"]),
  })

  assert.equal(dryRun.ok, false)
  assert.equal(dryRun.enabled, true)
  assert.equal(dryRun.commandConfigured, true)
  assert.equal(dryRun.canExecuteCommand, false)
  assert.equal(dryRun.willExecuteCommand, false)
  assert.equal(dryRun.willReturnStdoutJson, false)
  assert.equal(dryRun.willReturnImageUrl, false)
  assert.equal(dryRun.canShowToPlayer, false)

  printCheck("executor shell dry-run does not execute")
}

async function testExecutorShellGenerateDoesNotExecute() {
  const generate = await executeRealImageWithExecutorShell({
    enabled: true,
    command: "node",
    argsJson: JSON.stringify(["mock-runner.mjs"]),
  })

  assert.equal(generate.ok, false)
  assert.equal(generate.status, "real_image_executor_shell_execution_not_connected")
  assert.equal(generate.enabled, true)
  assert.equal(generate.commandConfigured, true)
  assert.equal(generate.didExecuteCommand, false)
  assert.equal(generate.didWriteOutputFile, false)
  assert.equal(generate.didReturnStdoutJson, false)
  assert.equal(generate.canShowToPlayer, false)

  printCheck("executor shell generate does not execute")
}

function testRunnerImplementationExposesExecutorShell() {
  const health = readRealImageRunnerImplementationHealth()

  assert.equal(health.ok, false)
  assert.equal(health.version, "implementation-not-connected-3")
  assert.equal(health.executorShell.status, "real_image_executor_shell_disabled")
  assert.equal(health.executorShell.canExecuteCommand, false)
  assert.equal(health.inputContract.mustUseExecutorShell, true)
  assert.equal(health.canShowToPlayer, false)

  printCheck("runner implementation exposes executor shell")
}

function printTitle(title) {
  console.log("")
  console.log("=".repeat(title.length))
  console.log(title)
  console.log("=".repeat(title.length))
}

function printCheck(name) {
  console.log(`[passed] ${name}`)
}