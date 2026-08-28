const finalGameMapMeaningZh =
  "不是最终地图结论。只有已发布能力版本内的完整 RuntimeFrame 通过材料质量闸门、FormalVisualJudge、能力发布身份重算和 /world 原子写入闸门，才算最终游戏地图成功；正常运行不设置Owner逐次终审。"
const finalGameMapMeaning =
  "This is not a final map verdict. A final map succeeds only when a complete RuntimeFrame from a released capability passes the material-quality gate, FormalVisualJudge, recomputed capability-release identity, and the atomic /world write gate; normal operation has no per-run Owner review."

export function enrichTrainingProcessLedgerEvent(event) {
  const scope = inferResultScope(event)
  const meanings = buildMeanings(event, scope)
  const canEnterWorld = inferWorldEntry(event)

  return {
    ...event,
    autoAnalysisVersion: "ai-painter-training-ledger-auto-analysis-v2",
    resultScope: scope.value,
    resultScopeZh: scope.zh,
    successMeaning: meanings.success,
    successMeaningZh: meanings.successZh,
    failureMeaning: meanings.failure,
    failureMeaningZh: meanings.failureZh,
    finalGameMapSuccess: false,
    finalGameMapMeaning,
    finalGameMapMeaningZh,
    canEnterWorld,
    worldEntryMeaning: canEnterWorld
      ? "The local release pipeline recorded this RuntimeFrame as machine-verified and eligible for the atomic /world write transition."
      : "This event does not authorize the frame to enter /world as a visible player-facing map.",
    worldEntryMeaningZh: canEnterWorld
      ? "本地发布流水线已将该 RuntimeFrame 登记为机器验证通过，可进入 /world 原子写入转换。"
      : "该事件不授权画面作为玩家可见地图进入 /world。",
    evidenceRequirement:
      "The event must point to durable evidence such as run-report.json, material-quality-report.json, formal-visual-judge.json, capability-release identity, an archived image, or a world-write transaction.",
    evidenceRequirementZh:
      "该事件必须指向持久证据，例如 run-report.json、material-quality-report.json、formal-visual-judge.json、能力发布身份、归档图片或世界写入事务。",
    nextAction: meanings.nextAction,
    nextActionZh: meanings.nextActionZh,
  }
}

function inferResultScope(event) {
  const kind = String(event.kind ?? "")
  const step = `${event.currentStep ?? ""} ${event.detail ?? ""} ${event.detailZh ?? ""} ${event.title ?? ""}`

  if (/owner/i.test(step)) {
    return { value: "legacy_owner_record", zh: "历史人工记录（非现行发布闸门）" }
  }
  if (/FormalVisualJudge|formal-visual-judge|formal_visual_judge/i.test(step)) {
    return { value: "formal_visual_judge_gate", zh: "正式画面机器评审闸门" }
  }
  if (/judge:game-map-material-quality|material-quality|material_quality/i.test(step)) {
    return { value: "material_quality_gate", zh: "材料质量机器评审闸门" }
  }
  if (/write:game-map-composite-runtime-frame|Composite RuntimeFrame|composite_runtime/i.test(step)) {
    return { value: "runtime_frame_composite_gate", zh: "完整 RuntimeFrame 合成与写入闸门" }
  }
  if (/train:game-map-material-slot/i.test(step)) {
    return { value: "model_training_step", zh: "本地小模型训练步骤" }
  }
  if (/run:game-map-material-slot-inference|inference/i.test(step)) {
    return { value: "model_inference_step", zh: "本地小模型推理步骤" }
  }
  if (/assemble:game-map-material-slot/i.test(step)) {
    return { value: "model_assembly_step", zh: "本地小模型合并步骤" }
  }
  if (/archive|归档/i.test(step)) {
    return { value: "archive_step", zh: "训练结果归档步骤" }
  }
  if (kind.includes("command")) {
    return { value: "command_step", zh: "训练命令步骤" }
  }
  if (kind.includes("run")) {
    return { value: "repair_runner", zh: "修复训练控制器流程" }
  }
  return { value: "process_event", zh: "程序事件" }
}

function buildMeanings(event, scope) {
  const status = String(event.status ?? "")
  const commandLike = scope.value.endsWith("_step") || scope.value === "command_step"
  const gateLike = scope.value.endsWith("_gate")

  if (status === "info" || status === "running") {
    return {
      success:
        "No success has been decided yet. This records that the program started or reported progress.",
      successZh: "还没有判定成功；这只表示程序已经启动或记录了一个进度事件。",
      failure:
        "If no matching completed, blocked, or failed event appears later, inspect the evidence file and control state.",
      failureZh: "如果后面没有对应的完成、阻断或失败事件，需要检查证据文件和训练控制状态。",
      nextAction: "Wait for the next program-written completed, blocked, or failed event.",
      nextActionZh: "等待程序自动写入下一条完成、阻断或失败事件。",
    }
  }

  if (status === "success" && commandLike) {
    return {
      success:
        "The command or step exited successfully with exitCode=0. This only proves that this program step finished.",
      successZh: "命令或步骤以 exitCode=0 完成；它只证明这个程序步骤完成了。",
      failure:
        "Failure would mean the command exited non-zero, crashed, or did not produce the required evidence.",
      failureZh: "失败表示命令非 0 退出、崩溃，或没有产出必需证据。",
      nextAction: "Continue to the next command or quality gate. Do not treat this as final map approval.",
      nextActionZh: "继续进入下一条命令或质量闸门；不要把它当作最终地图通过。",
    }
  }

  if (status === "success" && gateLike) {
    return {
      success:
        "This specific gate passed its programmed checks. It is still only one gate in the full map pipeline.",
      successZh: "该闸门通过了程序化检查；它仍然只是完整地图流水线中的一个闸门。",
      failure:
        "Failure would mean the gate found a blocking issue and must prevent promotion to the next stage.",
      failureZh: "失败表示闸门发现阻断问题，必须禁止进入下一阶段。",
      nextAction: "Continue to the next gate and keep the evidence path attached to the run.",
      nextActionZh: "继续进入下一道闸门，并保留本次运行的证据路径。",
    }
  }

  if (status === "failed" || status === "error" || status === "blocked") {
    return {
      success:
        "This event is not a success. It records a failed, errored, or blocked program result.",
      successZh: "这条事件不是成功；它记录的是失败、错误或阻断结果。",
      failure:
        gateLike
          ? "The gate found quality issues and blocked promotion. This is a normal quality failure record, not automatically a system crash."
          : "The program step failed, errored, or was blocked. The evidence path must explain the exact command, exit code, issue code, or missing artifact.",
      failureZh: gateLike
        ? "闸门发现质量问题并阻断晋级；这是正常的质量失败记录，不自动等于系统崩溃。"
        : "程序步骤失败、报错或被阻断；证据路径必须说明具体命令、退出码、问题码或缺失产物。",
      nextAction:
        "Use the evidence file, issue codes, and archived images to repair the algorithm, data dictionary, or material generator before the next run.",
      nextActionZh:
        "根据证据文件、问题码和归档图片修复算法、数据字典或素材生成器，然后再进入下一轮训练。",
    }
  }

  return {
    success: "Success means only this event's own scope passed.",
    successZh: "成功只代表这条事件自身范围通过。",
    failure: "Failure means this event's own scope did not pass.",
    failureZh: "失败只代表这条事件自身范围未通过。",
    nextAction: "Inspect the evidence path and continue according to the plan.",
    nextActionZh: "检查证据路径，并按计划继续。",
  }
}

function inferWorldEntry(event) {
  const status = String(event.status ?? "")
  const text = `${event.currentStep ?? ""} ${event.detail ?? ""} ${event.title ?? ""}`
  return status === "success" && /world_page_ready|Composite RuntimeFrame was written/i.test(text)
}
