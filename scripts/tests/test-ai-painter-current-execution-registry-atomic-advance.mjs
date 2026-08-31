import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import test from "node:test"
import {
  CURRENT_EXECUTION_REGISTRY_PATH,
  CURRENT_EXECUTION_REGISTRY_ROOT,
  advanceCurrentExecutionRegistry,
  finalizePreparedCurrentExecutionRegistryAdvance,
  initializeCurrentExecutionRegistry,
  prepareCurrentExecutionRegistryAdvance,
  readCurrentExecutionRegistry,
  recoverExpiredActiveExecutionToFailedClosed,
  recoverPreparedCurrentExecutionRegistryAdvance,
} from "../../src/server/ai-painter-current-execution-registry.mjs"

const TEST_PROCESS_IDENTITY = "registry-atomic-test-process-start"
const TEST_ACTIVE_PROCESS_START_IDENTITY = currentProcessStartIdentity()
const REGISTRY_DEPENDENCY_SCHEMA =
  "ai-painter-current-execution-registry-dependency-manifest-v1"

test("generic advance publishes the registry last and verifies every local projection", async () => {
  await withFixture(async ({ root, advance }) => {
    const before = await readCurrentExecutionRegistry(root)
    const result = await advanceCurrentExecutionRegistry({
      ...advance,
      _testHooks: hooks(),
    })
    assert.equal(result.ok, true)
    assert.equal(result.registry.registryRevision, 2)
    assert.equal(result.registry.taskGoal, "Execute cpu_readonly_fixture task fixture-next-task within the bound AI Painter capability lifecycle.")
    assert.equal(result.registry.priority, 5)
    assert.equal(result.registry.queueStatus, "ready")
    assert.equal(result.registry.nextMachineAction, "fixture-next-task")
    assert.match(result.registry.queuedAtUtc, /^\d{4}-\d{2}-\d{2}T/u)
    assert.equal(result.registry.supersedes.currentSha256, before.registrySha256)
    assert.equal(await exists(root, writerClaimPath()), false)
    assert.equal((await registryEvents(root)).length, 2)

    const transactionRoot = transactionRootFor(result.registry.transactionId)
    assert.equal(await exists(root, `${transactionRoot}/current.staged.json`), true)
    assert.equal(await exists(root, `${transactionRoot}/registry-event.staged.jsonl`), true)
    assert.equal(await exists(root, `${transactionRoot}/dependency-manifest.json`), true)
    const committed = await readJson(root, `${transactionRoot}/transaction.json`)
    assert.equal(committed.status, "committed")
    assert.equal(committed.dependencyVerification.status, "verified")
  })
})

test("ready task control metadata requires an executable next machine action", async () => {
  await withFixture(async ({ advance }) => {
    await assert.rejects(
      advanceCurrentExecutionRegistry({
        ...advance,
        taskGoal: "Adjudicate a bound Stage4 failure without restarting training.",
        priority: 1,
        queueStatus: "ready",
        nextMachineAction: null,
        _testHooks: hooks(),
      }),
      /registry_ready_task_next_machine_action_missing/,
    )
  })
})

test("terminal evidence accepts every formal terminal execution state", async (context) => {
  for (const executionState of ["completed", "failed_closed", "blocked_policy_boundary"]) {
    await context.test(executionState, async () => {
      await withFixture(async ({ root, advance }) => {
        const terminal = await readJson(root, advance.terminalEvidencePath)
        terminal.executionState = executionState
        await writeJson(root, advance.terminalEvidencePath, terminal)
        const result = await advanceCurrentExecutionRegistry({
          ...advance,
          _testHooks: hooks(),
        })
        assert.equal(result.ok, true)
        assert.equal(result.currentTaskTerminal.executionState, executionState)
      })
    })
  }
  await context.test("nonterminal state rejected", async () => {
    await withFixture(async ({ root, advance }) => {
      const terminal = await readJson(root, advance.terminalEvidencePath)
      terminal.executionState = "executing"
      await writeJson(root, advance.terminalEvidencePath, terminal)
      await assert.rejects(
        advanceCurrentExecutionRegistry({ ...advance, _testHooks: hooks() }),
        /advanced_terminal_not_completed/,
      )
    })
  })
})

test("active execution is published only with bound lock, live heartbeat and program lineage", async () => {
  await withFixture(async ({ root, advance }) => {
    const activeExecution = await createActiveExecution(root, {
      ...advance,
      executionState: "preflight",
    })
    const result = await advanceCurrentExecutionRegistry({
      ...advance,
      executionState: "preflight",
      activity: "preflight",
      queueStatus: "running",
      nextMachineAction: null,
      activeExecution,
      _testHooks: hooks(),
    })
    assert.equal(result.ok, true)
    assert.deepEqual(result.registry.activeExecution, activeExecution)
    assert.equal(result.registry.queueStatus, "running")

    const heartbeat = await readJson(root, activeExecution.heartbeat.path)
    heartbeat.heartbeatAtUtc = new Date(Date.now() - 61_000).toISOString()
    await writeJson(root, activeExecution.heartbeat.path, heartbeat)
    const stale = await readCurrentExecutionRegistry(root)
    assert.equal(stale.ok, false)
    assert.equal(stale.errorCode, "registry_active_execution_heartbeat_expired")
  })
})

test("active execution rejects identity, path, process, lineage and TTL defects", async (context) => {
  const cases = [
    ["capability mismatch", async ({ activeExecution }) => {
      activeExecution.capabilityVersion = "different-capability"
    }, /registry_active_execution_capability_mismatch/],
    ["package mismatch", async ({ activeExecution }) => {
      activeExecution.packageId = "different-package"
    }, /registry_active_execution_package_mismatch/],
    ["run mismatch", async ({ activeExecution }) => {
      activeExecution.runId = "different-run"
    }, /registry_active_execution_run_mismatch/],
    ["absolute lock path", async ({ root, activeExecution }) => {
      activeExecution.lock.path = absolute(root, activeExecution.lock.path)
    }, /absolute_path_forbidden/],
    ["parent heartbeat path", async ({ activeExecution }) => {
      activeExecution.heartbeat.path = "../outside-heartbeat.json"
    }, /parent_path_forbidden/],
    ["invalid process id", async ({ activeExecution }) => {
      activeExecution.processId = 0
    }, /registry_active_execution_pid_invalid/],
    ["active process start mismatch", async ({ activeExecution }) => {
      activeExecution.processStartIdentity = "different-process-start"
    }, /registry_active_execution_process_start_identity_mismatch/],
    ["blank process start", async ({ activeExecution }) => {
      activeExecution.processStartIdentity = " "
    }, /registry_active_execution_process_start_invalid/],
    ["process start mismatch", async ({ root, activeExecution }) => {
      const heartbeat = await readJson(root, activeExecution.heartbeat.path)
      heartbeat.processStartIdentity = "different-process-start"
      await writeJson(root, activeExecution.heartbeat.path, heartbeat)
    }, /registry_active_execution_heartbeat_process_start_mismatch/],
    ["program lineage hash mismatch", async ({ root, activeExecution }) => {
      await appendFileAt(root, activeExecution.programLineage.runner.path, "// tampered\n")
    }, /registry_active_execution_program_runner_hash_mismatch/],
    ["absolute program lineage path", async ({ root, activeExecution }) => {
      activeExecution.programLineage.runner.path = absolute(root, activeExecution.programLineage.runner.path)
    }, /absolute_path_forbidden/],
    ["invalid heartbeat TTL", async ({ activeExecution }) => {
      activeExecution.heartbeat.ttlSeconds = 0
    }, /registry_active_execution_heartbeat_ttl_invalid/],
    ["lock identity mismatch", async ({ root, activeExecution }) => {
      const lock = await readJson(root, activeExecution.lock.path)
      lock.runId = "different-run"
      await writeJson(root, activeExecution.lock.path, lock)
      activeExecution.lock.sha256 = await sha256File(root, activeExecution.lock.path)
    }, /registry_active_execution_lock_run_mismatch/],
  ]
  for (const [name, mutate, expected] of cases) {
    await context.test(name, async () => {
      await withFixture(async ({ root, advance }) => {
        const activeExecution = await createActiveExecution(root, {
          ...advance,
          executionState: "preflight",
        })
        await mutate({ root, advance, activeExecution })
        await assert.rejects(
          advanceCurrentExecutionRegistry({
            ...advance,
            executionState: "preflight",
            activity: "preflight",
            queueStatus: "running",
            nextMachineAction: null,
            activeExecution,
            _testHooks: hooks(),
          }),
          expected,
        )
      })
    })
  }
})

test("finalization rechecks mutable heartbeat freshness before current publication", async () => {
  await withFixture(async ({ root, advance }) => {
    const activeExecution = await createActiveExecution(root, {
      ...advance,
      executionState: "preflight",
    })
    const prepared = await prepareCurrentExecutionRegistryAdvance({
      ...advance,
      executionState: "preflight",
      activity: "preflight",
      queueStatus: "running",
      nextMachineAction: null,
      activeExecution,
      _testHooks: hooks(),
    })
    const heartbeat = await readJson(root, activeExecution.heartbeat.path)
    heartbeat.heartbeatAtUtc = new Date(Date.now() - 61_000).toISOString()
    await writeJson(root, activeExecution.heartbeat.path, heartbeat)
    await assert.rejects(
      finalizePreparedCurrentExecutionRegistryAdvance({
        projectRoot: root,
        transactionId: prepared.transactionId,
        _testHooks: hooks(),
      }),
      /registry_active_execution_heartbeat_expired/,
    )
    const current = await readCurrentExecutionRegistry(root)
    assert.equal(current.registry.registryRevision, 1)
  })
})

test("expired active recovery verifies dead process and publishes only failed-closed state", async () => {
  await withFixture(async ({ root, advance }) => {
    const activeExecution = await createActiveExecution(root, {
      ...advance,
      executionState: "preflight",
    })
    const active = await advanceCurrentExecutionRegistry({
      ...advance,
      executionState: "preflight",
      activity: "preflight",
      queueStatus: "running",
      nextMachineAction: null,
      activeExecution,
      _testHooks: hooks(),
    })
    await expireActiveHeartbeat(root, activeExecution)
    const stale = await readCurrentExecutionRegistry(root)
    assert.equal(stale.ok, false)
    assert.equal(stale.errorCode, "registry_active_execution_heartbeat_expired")
    const recovery = await createExpiredActiveRecoveryEvidence(root, active.registry)
    const recovered = await recoverExpiredActiveExecutionToFailedClosed({
      projectRoot: root,
      capabilityVersion: active.registry.capabilityVersion,
      packageId: active.registry.packageId,
      runId: active.registry.runId,
      taskCapsulePath: recovery.capsulePath,
      terminalEvidencePath: recovery.terminalPath,
      expectedPreviousRegistryRevision: active.registry.registryRevision,
      expectedPreviousRegistrySha256: await sha256File(root, CURRENT_EXECUTION_REGISTRY_PATH),
      _testHooks: recoveryHooks("dead"),
    })
    assert.equal(recovered.ok, true)
    assert.equal(recovered.registry.executionState, "failed_closed")
    assert.equal(recovered.registry.queueStatus, "failed_closed")
    assert.equal(recovered.registry.activeExecution, null)
    assert.equal(recovered.registry.capabilityVersion, active.registry.capabilityVersion)
    assert.equal(recovered.registry.packageId, active.registry.packageId)
    assert.equal(recovered.registry.runId, active.registry.runId)
  })
})

test("expired active recovery rejects live, unexpired, cross-identity and untrusted evidence", async (context) => {
  const cases = [
    ["live process", async ({ root, active, activeExecution, recovery }) => {
      await expireActiveHeartbeat(root, activeExecution)
      return {
        options: baseExpiredRecoveryOptions(root, active, recovery, recoveryHooks("active")),
        expected: /registry_expired_active_recovery_source_not_verified/,
      }
    }],
    ["unexpired heartbeat", async ({ root, active, recovery }) => ({
      options: baseExpiredRecoveryOptions(root, active, recovery, recoveryHooks("dead")),
      expected: /registry_expired_active_recovery_source_not_verified/,
    })],
    ["cross package", async ({ root, active, activeExecution, recovery }) => {
      await expireActiveHeartbeat(root, activeExecution)
      return {
        options: {
          ...baseExpiredRecoveryOptions(root, active, recovery, recoveryHooks("dead")),
          packageId: "different-package",
        },
        expected: /registry_expired_active_recovery_source_not_verified/,
      }
    }],
    ["cross run", async ({ root, active, activeExecution, recovery }) => {
      await expireActiveHeartbeat(root, activeExecution)
      return {
        options: {
          ...baseExpiredRecoveryOptions(root, active, recovery, recoveryHooks("dead")),
          runId: "different-run",
        },
        expected: /registry_expired_active_recovery_source_not_verified/,
      }
    }],
    ["path escape", async ({ root, active, activeExecution, recovery }) => {
      await expireActiveHeartbeat(root, activeExecution)
      return {
        options: {
          ...baseExpiredRecoveryOptions(root, active, recovery, recoveryHooks("dead")),
          terminalEvidencePath: "../outside-terminal.json",
        },
        expected: /parent_path_forbidden/,
      }
    }],
    ["lineage tamper", async ({ root, active, activeExecution, recovery }) => {
      await expireActiveHeartbeat(root, activeExecution)
      await appendFileAt(root, activeExecution.programLineage.runner.path, "// tampered\n")
      return {
        options: baseExpiredRecoveryOptions(root, active, recovery, recoveryHooks("dead")),
        expected: /registry_expired_active_recovery_source_not_verified/,
      }
    }],
    ["lock tamper", async ({ root, active, activeExecution, recovery }) => {
      await expireActiveHeartbeat(root, activeExecution)
      const lock = await readJson(root, activeExecution.lock.path)
      lock.packageId = "different-package"
      await writeJson(root, activeExecution.lock.path, lock)
      return {
        options: baseExpiredRecoveryOptions(root, active, recovery, recoveryHooks("dead")),
        expected: /registry_expired_active_recovery_source_not_verified/,
      }
    }],
  ]
  for (const [name, arrange] of cases) {
    await context.test(name, async () => {
      await withFixture(async ({ root, advance }) => {
        const activeExecution = await createActiveExecution(root, {
          ...advance,
          executionState: "preflight",
        })
        const active = await advanceCurrentExecutionRegistry({
          ...advance,
          executionState: "preflight",
          activity: "preflight",
          queueStatus: "running",
          nextMachineAction: null,
          activeExecution,
          _testHooks: hooks(),
        })
        const recovery = await createExpiredActiveRecoveryEvidence(root, active.registry)
        const arranged = await arrange({ root, active, activeExecution, recovery })
        await assert.rejects(
          recoverExpiredActiveExecutionToFailedClosed(arranged.options),
          arranged.expected,
        )
      })
    })
  }
})

test("expired active recovery survives power loss after durable registry prepare", async () => {
  await withFixture(async ({ root, advance }) => {
    const activeExecution = await createActiveExecution(root, {
      ...advance,
      executionState: "preflight",
    })
    const active = await advanceCurrentExecutionRegistry({
      ...advance,
      executionState: "preflight",
      activity: "preflight",
      queueStatus: "running",
      nextMachineAction: null,
      activeExecution,
      _testHooks: hooks(),
    })
    await expireActiveHeartbeat(root, activeExecution)
    const recovery = await createExpiredActiveRecoveryEvidence(root, active.registry)
    const crashHooks = recoveryHooks("dead", "after_prepare_database_commit")
    await assert.rejects(
      recoverExpiredActiveExecutionToFailedClosed({
        ...baseExpiredRecoveryOptions(root, active, recovery, crashHooks),
      }),
      /injected_after_prepare_database_commit/,
    )
    const claim = await readJson(root, writerClaimPath())
    const recovered = await recoverPreparedCurrentExecutionRegistryAdvance({
      projectRoot: root,
      transactionId: claim.transactionId,
      _testHooks: hooks({ probe: "dead" }),
    })
    assert.equal(recovered.ok, true)
    assert.equal(recovered.registry.executionState, "failed_closed")
    assert.equal(recovered.registry.activeExecution, null)
  })
})

test("prepare is private: reader remains on the old current and no implicit recovery occurs", async () => {
  await withFixture(async ({ root, advance }) => {
    const before = await readCurrentExecutionRegistry(root)
    const prepared = await prepareCurrentExecutionRegistryAdvance({
      ...advance,
      _testHooks: hooks(),
    })
    const during = await readCurrentExecutionRegistry(root)
    assert.equal(during.ok, true)
    assert.equal(during.registrySha256, before.registrySha256)
    assert.equal(during.registry.registryRevision, 1)
    assert.equal(await exists(root, writerClaimPath()), true)
    assert.equal(
      sqliteTransactionStatus(root, prepared.transactionId),
      "prepared",
    )

    const published = await finalizePreparedCurrentExecutionRegistryAdvance({
      projectRoot: root,
      transactionId: prepared.transactionId,
      _testHooks: hooks(),
    })
    assert.equal(published.registry.registryRevision, 2)
  })
})

test("global writer claim admits one concurrent writer and rejects the loser", async () => {
  await withFixture(async ({ root, advance }) => {
    const outcomes = await Promise.allSettled([
      prepareCurrentExecutionRegistryAdvance({ ...advance, _testHooks: hooks() }),
      prepareCurrentExecutionRegistryAdvance({ ...advance, _testHooks: hooks() }),
    ])
    assert.equal(outcomes.filter((item) => item.status === "fulfilled").length, 1)
    const loser = outcomes.find((item) => item.status === "rejected")
    assert.match(String(loser.reason?.message), /registry_global_writer_claim_conflict/)
    const winner = outcomes.find((item) => item.status === "fulfilled").value
    await finalizePreparedCurrentExecutionRegistryAdvance({
      projectRoot: root,
      transactionId: winner.transactionId,
      _testHooks: hooks(),
    })
  })
})

test("database begin, insert and commit failures abort preparation and release the writer claim", async (context) => {
  for (const faultPoint of [
    "before_prepare_database_begin",
    "after_prepare_transaction_insert",
    "before_prepare_database_commit",
  ]) {
    await context.test(faultPoint, async () => {
      await withFixture(async ({ root, advance }) => {
        const before = await readCurrentExecutionRegistry(root)
        let failedTransactionId = null
        await assert.rejects(
          prepareCurrentExecutionRegistryAdvance({
            ...advance,
            _testHooks: hooks({
              failAt: faultPoint,
              observe(_point, detail) {
                failedTransactionId = detail.transactionId
              },
            }),
          }),
          new RegExp(`injected_${faultPoint}`),
        )
        assert.match(
          failedTransactionId,
          /^current-execution-registry-advance-/u,
        )
        assert.equal(await exists(root, writerClaimPath()), false)
        assert.equal(sqliteTransactionStatus(root, failedTransactionId), undefined)
        const aborted = await readJson(
          root,
          `${transactionRootFor(failedTransactionId)}/transaction.aborted.json`,
        )
        assert.equal(aborted.status, "aborted_before_durable_prepare")
        assert.equal(aborted.errorCode, `injected_${faultPoint}`)
        const unchanged = await readCurrentExecutionRegistry(root)
        assert.equal(unchanged.registrySha256, before.registrySha256)

        const retry = await advanceCurrentExecutionRegistry({
          ...advance,
          _testHooks: hooks(),
        })
        assert.equal(retry.registry.registryRevision, 2)
      })
    })
  }
})

test("explicit recovery rejects an active writer and accepts a dead writer", async () => {
  await withFixture(async ({ root, advance }) => {
    const prepared = await prepareCurrentExecutionRegistryAdvance({
      ...advance,
      _testHooks: hooks(),
    })
    await assert.rejects(
      recoverPreparedCurrentExecutionRegistryAdvance({
        projectRoot: root,
        transactionId: prepared.transactionId,
        _testHooks: hooks({ probe: "active" }),
      }),
      /registry_writer_claim_active/,
    )
    const recovered = await recoverPreparedCurrentExecutionRegistryAdvance({
      projectRoot: root,
      transactionId: prepared.transactionId,
      _testHooks: hooks({ probe: "dead" }),
    })
    assert.equal(recovered.registry.registryRevision, 2)
    assert.equal(await exists(root, writerClaimPath()), false)
  })
})

test("indeterminate claim liveness fails closed without publishing", async () => {
  await withFixture(async ({ root, advance }) => {
    const before = await readCurrentExecutionRegistry(root)
    const prepared = await prepareCurrentExecutionRegistryAdvance({
      ...advance,
      _testHooks: hooks(),
    })
    await assert.rejects(
      recoverPreparedCurrentExecutionRegistryAdvance({
        projectRoot: root,
        transactionId: prepared.transactionId,
        _testHooks: hooks({ probe: "indeterminate" }),
      }),
      /registry_writer_claim_liveness_indeterminate/,
    )
    const after = await readCurrentExecutionRegistry(root)
    assert.equal(after.registrySha256, before.registrySha256)
  })
})

test("power loss after SQLite commit recovers while current.json remains the final marker", async () => {
  await withFixture(async ({ root, advance }) => {
    const before = await readCurrentExecutionRegistry(root)
    const prepared = await prepareCurrentExecutionRegistryAdvance({
      ...advance,
      _testHooks: hooks(),
    })
    await assert.rejects(
      finalizePreparedCurrentExecutionRegistryAdvance({
        projectRoot: root,
        transactionId: prepared.transactionId,
        _testHooks: hooks({ failAt: "after_database_committed" }),
      }),
      /injected_after_database_committed/,
    )
    assert.equal(sqliteTransactionStatus(root, prepared.transactionId), "committed")
    const interrupted = await readCurrentExecutionRegistry(root)
    assert.equal(interrupted.registrySha256, before.registrySha256)

    const recovered = await recoverPreparedCurrentExecutionRegistryAdvance({
      projectRoot: root,
      transactionId: prepared.transactionId,
      _testHooks: hooks({ probe: "dead" }),
    })
    assert.equal(recovered.registry.registryRevision, 2)
  })
})

test("power loss after current publish only completes bookkeeping and releases the claim", async () => {
  await withFixture(async ({ root, advance }) => {
    const prepared = await prepareCurrentExecutionRegistryAdvance({
      ...advance,
      _testHooks: hooks(),
    })
    await assert.rejects(
      finalizePreparedCurrentExecutionRegistryAdvance({
        projectRoot: root,
        transactionId: prepared.transactionId,
        _testHooks: hooks({ failAt: "after_current_publish" }),
      }),
      /injected_after_current_publish/,
    )
    const visible = await readCurrentExecutionRegistry(root)
    assert.equal(visible.ok, true)
    assert.equal(visible.registry.registryRevision, 2)
    assert.equal(await exists(root, writerClaimPath()), true)

    const recovered = await recoverPreparedCurrentExecutionRegistryAdvance({
      projectRoot: root,
      transactionId: prepared.transactionId,
      _testHooks: hooks({ probe: "dead" }),
    })
    assert.equal(recovered.registrySha256, visible.registrySha256)
    assert.equal(await exists(root, writerClaimPath()), false)
    assert.equal(
      (await registryEvents(root)).filter(
        (event) => event.transactionId === prepared.transactionId,
      ).length,
      1,
    )
  })
})

test("recovery repairs a partial registry JSONL event atomically", async () => {
  await withFixture(async ({ root, advance }) => {
    const prepared = await prepareCurrentExecutionRegistryAdvance({
      ...advance,
      _testHooks: hooks(),
    })
    const staged = await readFileAt(
      root,
      `${prepared.transactionRoot}/registry-event.staged.jsonl`,
    )
    await appendFileAt(root, eventsPath(), staged.subarray(0, 31))
    const recovered = await recoverPreparedCurrentExecutionRegistryAdvance({
      projectRoot: root,
      transactionId: prepared.transactionId,
      _testHooks: hooks({ probe: "dead" }),
    })
    assert.equal(recovered.registry.registryRevision, 2)
    assert.equal(
      (await registryEvents(root)).filter(
        (event) => event.transactionId === prepared.transactionId,
      ).length,
      1,
    )
  })
})

test("recovery accepts an already complete event and removes a matching duplicate fragment", async () => {
  await withFixture(async ({ root, advance }) => {
    const prepared = await prepareCurrentExecutionRegistryAdvance({
      ...advance,
      _testHooks: hooks(),
    })
    const staged = await readFileAt(
      root,
      `${prepared.transactionRoot}/registry-event.staged.jsonl`,
    )
    await appendFileAt(root, eventsPath(), staged)
    await appendFileAt(root, eventsPath(), staged.subarray(0, 19))
    const recovered = await recoverPreparedCurrentExecutionRegistryAdvance({
      projectRoot: root,
      transactionId: prepared.transactionId,
      _testHooks: hooks({ probe: "dead" }),
    })
    assert.equal(recovered.registry.registryRevision, 2)
    assert.equal(
      (await registryEvents(root)).filter(
        (event) => event.transactionId === prepared.transactionId,
      ).length,
      1,
    )
  })
})

test("staged bytes are rehashed during recovery and tampering fails closed", async () => {
  await withFixture(async ({ root, advance }) => {
    const before = await readCurrentExecutionRegistry(root)
    const prepared = await prepareCurrentExecutionRegistryAdvance({
      ...advance,
      _testHooks: hooks(),
    })
    await appendFileAt(root, `${prepared.transactionRoot}/current.staged.json`, " ")
    await assert.rejects(
      recoverPreparedCurrentExecutionRegistryAdvance({
        projectRoot: root,
        transactionId: prepared.transactionId,
        _testHooks: hooks({ probe: "dead" }),
      }),
      /registry_staged_current_hash_mismatch/,
    )
    const after = await readCurrentExecutionRegistry(root)
    assert.equal(after.registrySha256, before.registrySha256)
  })
})

test("incomplete external dependencies block publication", async () => {
  await withFixture(async ({ root, advance }) => {
    const before = await readCurrentExecutionRegistry(root)
    const dependency = await createExternalDependencies(root, {
      outerState: "artifacts_staged",
    })
    const prepared = await prepareCurrentExecutionRegistryAdvance({
      ...advance,
      dependencyManifest: dependency.manifest,
      _testHooks: hooks(),
    })
    await assert.rejects(
      finalizePreparedCurrentExecutionRegistryAdvance({
        projectRoot: root,
        transactionId: prepared.transactionId,
        _testHooks: hooks(),
      }),
      /registry_dependency_outer_journal_incomplete/,
    )
    const after = await readCurrentExecutionRegistry(root)
    assert.equal(after.registrySha256, before.registrySha256)
    assert.equal(sqliteTransactionStatus(root, prepared.transactionId), "prepared")
  })
})

test("complete external receipt, plan, event, latest and SQLite catalog are read back before publish", async () => {
  await withFixture(async ({ root, advance }) => {
    const dependency = await createExternalDependencies(root, {
      outerState: "event_committed",
    })
    const result = await advanceCurrentExecutionRegistry({
      ...advance,
      dependencyManifest: dependency.manifest,
      _testHooks: hooks(),
    })
    assert.equal(result.registry.registryRevision, 2)
    const committed = await readJson(
      root,
      `${transactionRootFor(result.registry.transactionId)}/transaction.json`,
    )
    assert.equal(committed.dependencyVerification.mode, "external")
    assert.equal(
      committed.dependencyVerification.programEventId,
      dependency.event.id,
    )
  })
})

test("external dependency outer journal bytes are immutable at registry commit", async () => {
  await withFixture(async ({ root, advance }) => {
    const before = await readCurrentExecutionRegistry(root)
    const dependency = await createExternalDependencies(root, {
      outerState: "event_committed",
    })
    await appendFileAt(root, dependency.manifest.outerJournal.path, " ")
    await assert.rejects(
      advanceCurrentExecutionRegistry({
        ...advance,
        dependencyManifest: dependency.manifest,
        _testHooks: hooks(),
      }),
      /registry_dependency_outer_journal_hash_mismatch/,
    )
    const after = await readCurrentExecutionRegistry(root)
    assert.equal(after.registrySha256, before.registrySha256)
  })
})

test("external dependency outer journal operation identity is immutable", async () => {
  await withFixture(async ({ root, advance }) => {
    const before = await readCurrentExecutionRegistry(root)
    const dependency = await createExternalDependencies(root, {
      outerState: "event_committed",
    })
    await writeJson(root, dependency.manifest.outerJournal.path, {
      schemaVersion: "fixture-outer-journal-v1",
      operationId: "fixture-registry-dependency-operation-replaced",
      state: "event_committed",
    })
    dependency.manifest.outerJournal.sha256 = await sha256File(
      root,
      dependency.manifest.outerJournal.path,
    )
    await assert.rejects(
      advanceCurrentExecutionRegistry({
        ...advance,
        dependencyManifest: dependency.manifest,
        _testHooks: hooks(),
      }),
      /registry_dependency_outer_journal_operation_mismatch/,
    )
    const after = await readCurrentExecutionRegistry(root)
    assert.equal(after.registrySha256, before.registrySha256)
  })
})

test("external dependency outer journal hash and operation are mandatory", async () => {
  for (const missingField of ["sha256", "operationId"]) {
    await withFixture(async ({ root, advance }) => {
      const dependency = await createExternalDependencies(root, {
        outerState: "event_committed",
      })
      delete dependency.manifest.outerJournal[missingField]
      await assert.rejects(
        advanceCurrentExecutionRegistry({
          ...advance,
          dependencyManifest: dependency.manifest,
          _testHooks: hooks(),
        }),
        new RegExp(`registry_dependency_outer_journal_${missingField === "sha256" ? "hash" : "operation"}_missing`),
      )
    })
  }
})

test("retired dependency-input manifests are rejected before registry preparation", async () => {
  await withFixture(async ({ root, advance }) => {
    const before = await readCurrentExecutionRegistry(root)
    await assert.rejects(
      advanceCurrentExecutionRegistry({
        ...advance,
        dependencyManifest: {
          schemaVersion: "ai-painter-current-execution-dependency-input-v1",
          entries: [],
        },
        _testHooks: hooks(),
      }),
      /registry_dependency_manifest_schema_invalid/,
    )
    const after = await readCurrentExecutionRegistry(root)
    assert.equal(after.registrySha256, before.registrySha256)
    assert.equal((await registryEvents(root)).length, 1)
  })
})

async function withFixture(callback) {
  const root = await mkdtemp(path.join(os.tmpdir(), "ai-painter-registry-atomic-"))
  try {
    const fixture = await initializeFixture(root)
    await callback({ root, ...fixture })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

async function initializeFixture(root) {
  const planningRoot = ".runtime/fixture/current-plan"
  const formalRoot = ".runtime/fixture/current-formal"
  const candidatePath = `${planningRoot}/bounded-candidate.json`
  const taskTerminalPath = `${planningRoot}/phase-terminal.json`
  const taskCapsulePath = `${planningRoot}/local-task-capsule.json`
  const latestTrainingTerminalPath = `${formalRoot}/phase-terminal.json`
  const recordedAtUtc = "2026-08-29T01:00:00.000Z"

  await writeJson(root, candidatePath, {
    schemaVersion: "stage4-post-decode-bounded-candidate-v1",
    status: "cpu_inactive_candidate_planned_not_implemented",
    selectedCandidate: { candidateKind: "fixture_candidate" },
    recordedAtUtc,
  })
  const candidateSha256 = await sha256File(root, candidatePath)
  await writeJson(root, taskTerminalPath, {
    schemaVersion: "stage4-post-decode-failure-bounded-planning-terminal-v1",
    executionState: "completed",
    status: "bounded_candidate_planning_completed",
    planningRunId: "fixture-current-plan",
    nextAction: "fixture_initial_task",
    candidate: { path: candidatePath, sha256: candidateSha256 },
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    recordedAtUtc,
  })
  await writeJson(root, taskCapsulePath, {
    schemaVersion: "ai-painter-local-task-capsule-v2",
    latestTerminal: {
      path: taskTerminalPath,
      sha256: await sha256File(root, taskTerminalPath),
    },
    recordedAtUtc,
  })
  await writeJson(root, latestTrainingTerminalPath, {
    schemaVersion: "stage4-post-decode-object-rgb-stage0-terminal-v1",
    executionState: "completed",
    status: "post_decode_object_rgb_stage0_real_visual_failure",
    runId: "fixture-current-formal",
    recordedAtUtc,
  })
  await writeJson(root, `${formalRoot}/execution-state.json`, {
    status: "completed",
    phase: "machine_review_completed",
    updatedAtUtc: recordedAtUtc,
  })
  await writeJson(root, `${formalRoot}/machine-review.json`, {
    previewCount: 6,
    previewPassCount: 2,
    previewFailCount: 4,
    recordedAtUtc,
  })
  await writeJson(root, `${formalRoot}/training-output/progress.json`, {
    phase: "training_completed",
    epoch: 40,
    epochTarget: 40,
    updatedAtUtc: recordedAtUtc,
  })

  const initial = await initializeCurrentExecutionRegistry({
    projectRoot: root,
    currentTaskCapsulePath: taskCapsulePath,
    currentTaskTerminalPath: taskTerminalPath,
    currentCandidatePath: candidatePath,
    latestTrainingTerminalPath,
    archivedEvidenceNamespaces: [".runtime/fixture/archive"],
  })
  assert.equal(initial.ok, true)

  const evidencePath = ".runtime/fixture/next/evidence.json"
  const terminalEvidencePath = ".runtime/fixture/next/phase-terminal.json"
  const nextTaskCapsulePath = ".runtime/fixture/next/local-task-capsule.json"
  await writeJson(root, evidencePath, {
    schemaVersion: "fixture-evidence-v1",
    status: "verified",
    recordedAtUtc,
  })
  const evidenceSha256 = await sha256File(root, evidencePath)
  await writeJson(root, terminalEvidencePath, {
    schemaVersion: "fixture-terminal-v1",
    executionState: "completed",
    status: "fixture_next_task_completed",
    recordedAtUtc,
  })
  await writeJson(root, nextTaskCapsulePath, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    integrity: { status: "verified" },
    evidence: [
      {
        kind: "fixture_evidence",
        path: evidencePath,
        sha256: evidenceSha256,
        sha256Verified: true,
      },
    ],
    recordedAtUtc,
  })
  return {
    advance: {
      projectRoot: root,
      capabilityVersion: "fixture-capability-v2",
      packageId: "fixture-package-v2",
      taskId: "fixture-next-task",
      taskKind: "cpu_readonly_fixture",
      runId: "fixture-next-run",
      lifecycleStage: "qualification",
      executionState: "package_materialized",
      activity: "ready",
      taskCapsulePath: nextTaskCapsulePath,
      terminalEvidencePath,
      expectedPreviousRegistryRevision: initial.registry.registryRevision,
      expectedPreviousRegistrySha256: initial.registrySha256,
    },
  }
}

async function createExternalDependencies(root, { outerState }) {
  const base = ".runtime/fixture/dependencies"
  const operationId = "fixture-registry-dependency-operation-1"
  const outerJournalPath = `${base}/outer-journal.json`
  const receiptPath = `${base}/receipt.json`
  const planPath = `${base}/plan.json`
  const ledgerPath = `${base}/events.jsonl`
  const latestPath = `${base}/latest.json`
  const catalogDatabasePath = `${base}/catalog.sqlite`
  const event = {
    id: "fixture-program-event-1",
    type: "fixture_registry_dependency_completed",
    recordedAtUtc: "2026-08-29T01:02:03.000Z",
  }
  await writeJson(root, outerJournalPath, {
    schemaVersion: "fixture-outer-journal-v1",
    operationId,
    state: outerState,
  })
  await writeJson(root, receiptPath, {
    schemaVersion: "fixture-receipt-v1",
    status: "committed",
  })
  await writeJson(root, planPath, {
    schemaVersion: "fixture-plan-v1",
    status: "updated",
  })
  await writeText(root, ledgerPath, `${JSON.stringify(event)}\n`)
  await writeJson(root, latestPath, { events: [event] })

  const receiptSha256 = await sha256File(root, receiptPath)
  const planSha256 = await sha256File(root, planPath)
  const outerJournalSha256 = await sha256File(root, outerJournalPath)
  const catalogPath = absolute(root, catalogDatabasePath)
  await mkdir(path.dirname(catalogPath), { recursive: true })
  const catalog = new DatabaseSync(catalogPath)
  try {
    catalog.exec(`
      CREATE TABLE program_events (event_id TEXT PRIMARY KEY, event_json TEXT NOT NULL);
      CREATE TABLE artifacts (logical_path TEXT PRIMARY KEY, sha256 TEXT NOT NULL);
    `)
    catalog.prepare("INSERT INTO program_events (event_id, event_json) VALUES (?, ?)")
      .run(event.id, JSON.stringify(event))
    catalog.prepare("INSERT INTO artifacts (logical_path, sha256) VALUES (?, ?)")
      .run(receiptPath, receiptSha256)
    catalog.prepare("INSERT INTO artifacts (logical_path, sha256) VALUES (?, ?)")
      .run(planPath, planSha256)
  } finally {
    catalog.close()
  }
  return {
    event,
    manifest: {
      schemaVersion: REGISTRY_DEPENDENCY_SCHEMA,
      mode: "external",
      outerJournal: {
        path: outerJournalPath,
        sha256: outerJournalSha256,
        requiredState: "event_committed",
        operationId,
      },
      bindings: [
        { role: "receipt", path: receiptPath, sha256: receiptSha256 },
        { role: "plan", path: planPath, sha256: planSha256 },
      ],
      programEvent: {
        event,
        eventId: event.id,
        ledgerPath,
        latestPath,
        catalogDatabasePath,
      },
      catalogArtifacts: [
        { logicalPath: receiptPath, sha256: receiptSha256 },
        { logicalPath: planPath, sha256: planSha256 },
      ],
    },
  }
}

async function createActiveExecution(root, {
  capabilityVersion,
  packageId,
  runId,
  executionState,
}) {
  const activeRoot = `.runtime/fixture/active/${runId}`
  const programPath = `${activeRoot}/programs/runner.mjs`
  const lockPath = `${activeRoot}/execution.lock.json`
  const heartbeatPath = `${activeRoot}/heartbeat.json`
  const processId = process.pid
  const processStartIdentity = TEST_ACTIVE_PROCESS_START_IDENTITY
  const ttlSeconds = 60
  await writeText(root, programPath, "export const fixtureRunner = true\n")
  await writeJson(root, lockPath, {
    schemaVersion: "ai-painter-current-active-execution-lock-v1",
    capabilityVersion,
    packageId,
    runId,
    processId,
    processStartIdentity,
  })
  await writeJson(root, heartbeatPath, {
    schemaVersion: "ai-painter-current-active-execution-heartbeat-v1",
    capabilityVersion,
    packageId,
    runId,
    executionState,
    processId,
    processStartIdentity,
    heartbeatAtUtc: new Date().toISOString(),
    ttlSeconds,
  })
  return {
    schemaVersion: "ai-painter-current-active-execution-v1",
    capabilityVersion,
    packageId,
    runId,
    executionState,
    processId,
    processStartIdentity,
    programLineage: {
      runner: { path: programPath, sha256: await sha256File(root, programPath) },
    },
    lock: { path: lockPath, sha256: await sha256File(root, lockPath) },
    heartbeat: { path: heartbeatPath, ttlSeconds },
  }
}

async function expireActiveHeartbeat(root, activeExecution) {
  const heartbeat = await readJson(root, activeExecution.heartbeat.path)
  heartbeat.heartbeatAtUtc = new Date(
    Date.now() - (activeExecution.heartbeat.ttlSeconds + 1) * 1000,
  ).toISOString()
  await writeJson(root, activeExecution.heartbeat.path, heartbeat)
}

async function createExpiredActiveRecoveryEvidence(root, registry) {
  const recoveryRoot = `.runtime/fixture/recovery/${registry.runId}`
  const reportPath = `${recoveryRoot}/recovery-report.json`
  const terminalPath = `${recoveryRoot}/phase-terminal.json`
  const capsulePath = `${recoveryRoot}/local-task-capsule.json`
  await writeJson(root, reportPath, {
    schemaVersion: "fixture-expired-active-recovery-report-v1",
    status: "expired_dead_execution_verified_failed_closed",
    capabilityVersion: registry.capabilityVersion,
    packageId: registry.packageId,
    runId: registry.runId,
    gpuReplayStarted: false,
    recordedAtUtc: new Date().toISOString(),
  })
  const reportSha256 = await sha256File(root, reportPath)
  await writeJson(root, terminalPath, {
    schemaVersion: "fixture-expired-active-recovery-terminal-v1",
    executionState: "failed_closed",
    status: "expired_active_execution_recovery_failed_closed",
    capabilityVersion: registry.capabilityVersion,
    packageId: registry.packageId,
    runId: registry.runId,
    recoveryReport: { path: reportPath, sha256: reportSha256 },
    gpuReplayStarted: false,
    recordedAtUtc: new Date().toISOString(),
  })
  await writeJson(root, capsulePath, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    integrity: { status: "verified" },
    evidence: [{
      kind: "expired_active_recovery_report",
      path: reportPath,
      sha256: reportSha256,
      sha256Verified: true,
    }],
    recordedAtUtc: new Date().toISOString(),
  })
  return { reportPath, terminalPath, capsulePath }
}

function baseExpiredRecoveryOptions(root, active, recovery, testHooks) {
  return {
    projectRoot: root,
    capabilityVersion: active.registry.capabilityVersion,
    packageId: active.registry.packageId,
    runId: active.registry.runId,
    taskCapsulePath: recovery.capsulePath,
    terminalEvidencePath: recovery.terminalPath,
    expectedPreviousRegistryRevision: active.registry.registryRevision,
    expectedPreviousRegistrySha256: active.registrySha256,
    _testHooks: testHooks,
  }
}

function recoveryHooks(processStatus, failAt = null) {
  return {
    ...hooks({ failAt }),
    probeActiveExecutionProcess: () => processStatus === "active"
      ? { status: "active", identity: TEST_ACTIVE_PROCESS_START_IDENTITY }
      : { status: processStatus },
  }
}

function currentProcessStartIdentity() {
  if (process.platform === "win32") {
    const script = [
      "$ErrorActionPreference='Stop'",
      `$p=Get-CimInstance -ClassName Win32_Process -Filter \"ProcessId = ${process.pid}\" -ErrorAction Stop`,
      "if ($null -eq $p) { exit 3 }",
      "$p.CreationDate.ToUniversalTime().ToString('o')",
    ].join("; ")
    const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
    })
    assert.equal(result.status, 0, String(result.stderr))
    return `${process.pid}:${String(result.stdout).replace(/^\uFEFF/u, "").trim()}`
  }
  const result = spawnSync("ps", ["-o", "lstart=", "-p", String(process.pid)], {
    encoding: "utf8",
    timeout: 10_000,
  })
  assert.equal(result.status, 0, String(result.stderr))
  return `${process.pid}:${String(result.stdout).trim()}`
}

function hooks({ probe = null, failAt = null, observe = null } = {}) {
  return {
    currentProcessIdentity: TEST_PROCESS_IDENTITY,
    ...(probe === null
      ? {}
      : { probeClaimProcess: () => ({ status: probe }) }),
    ...(failAt === null
      ? {}
      : {
          onTransactionPoint(point, detail) {
            if (typeof observe === "function") observe(point, detail)
            if (point === failAt) throw new Error(`injected_${point}`)
          },
        }),
    ...(failAt === null && typeof observe === "function"
      ? { onTransactionPoint: observe }
      : {}),
  }
}

function sqliteTransactionStatus(root, transactionId) {
  const database = new DatabaseSync(
    absolute(root, `${CURRENT_EXECUTION_REGISTRY_ROOT}/registry.sqlite`),
    { readOnly: true },
  )
  try {
    return database
      .prepare("SELECT status FROM registry_transactions WHERE transaction_id = ?")
      .get(transactionId)?.status
  } finally {
    database.close()
  }
}

async function registryEvents(root) {
  const source = (await readFileAt(root, eventsPath())).toString("utf8")
  assert.equal(source.endsWith("\n"), true)
  return source
    .split(/\r?\n/u)
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line))
}

function writerClaimPath() {
  return `${CURRENT_EXECUTION_REGISTRY_ROOT}/writer.claim.json`
}

function eventsPath() {
  return `${CURRENT_EXECUTION_REGISTRY_ROOT}/events.jsonl`
}

function transactionRootFor(transactionId) {
  return `${CURRENT_EXECUTION_REGISTRY_ROOT}/transactions/${transactionId}`
}

async function writeJson(root, relativePath, value) {
  await writeText(root, relativePath, `${JSON.stringify(value, null, 2)}\n`)
}

async function writeText(root, relativePath, value) {
  const target = absolute(root, relativePath)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, value, "utf8")
}

async function appendFileAt(root, relativePath, value) {
  await appendFile(absolute(root, relativePath), value)
}

async function readJson(root, relativePath) {
  return JSON.parse((await readFileAt(root, relativePath)).toString("utf8"))
}

async function readFileAt(root, relativePath) {
  return readFile(absolute(root, relativePath))
}

async function sha256File(root, relativePath) {
  return createHash("sha256").update(await readFileAt(root, relativePath)).digest("hex")
}

async function exists(root, relativePath) {
  return readFileAt(root, relativePath).then(() => true, (error) => {
    if (error?.code === "ENOENT") return false
    throw error
  })
}

function absolute(root, relativePath) {
  return path.join(root, ...relativePath.split("/"))
}
