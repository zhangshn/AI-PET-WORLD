"use client"

import type { ReactNode } from "react"

import type {
  FullZiweiDynamicChartInput,
  ZiweiBirthInput,
  ZiweiDynamicDebugView,
  ZiweiDynamicFlowType
} from "@/ai/destiny-core/ziwei-core/contracts"

import { isZiweiDynamicFlowWithinSelectedDepth } from "../_lib/ziwei-dynamic-flow-depth"
import { ZIWEI_TIME_BRANCH_OPTIONS } from "../_lib/ziwei-form-options"
import styles from "../_styles/ziwei-page.module.css"

export interface ZiweiFormState extends Required<Pick<
  ZiweiBirthInput,
  "year" | "month" | "day" | "hour" | "gender"
>> {
  minute: number
  currentAge: number
  currentYear: number
  currentLunarMonth: number
  currentLunarDay: number
  currentTimeBranch: FullZiweiDynamicChartInput["currentTimeBranch"]
}

const LUNAR_MONTH_OPTIONS = [
  "正月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "冬月",
  "腊月"
] as const

const LUNAR_DAY_OPTIONS = [
  "初一",
  "初二",
  "初三",
  "初四",
  "初五",
  "初六",
  "初七",
  "初八",
  "初九",
  "初十",
  "十一",
  "十二",
  "十三",
  "十四",
  "十五",
  "十六",
  "十七",
  "十八",
  "十九",
  "二十",
  "廿一",
  "廿二",
  "廿三",
  "廿四",
  "廿五",
  "廿六",
  "廿七",
  "廿八",
  "廿九",
  "三十"
] as const

const LIMIT_COLUMN_COUNT = 10

export function BirthInputPanel(props: {
  form: ZiweiFormState
  onChange: (form: ZiweiFormState) => void
}) {
  const update = <Key extends keyof ZiweiFormState>(
    key: Key,
    value: ZiweiFormState[Key]
  ) => {
    props.onChange({
      ...props.form,
      [key]: value
    })
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>排盘输入</h2>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.form}>
          <div className={styles.fieldGrid}>
            <NumberField label="年" value={props.form.year} onChange={(value) => update("year", value)} />
            <NumberField label="月" value={props.form.month} onChange={(value) => update("month", value)} />
            <NumberField label="日" value={props.form.day} onChange={(value) => update("day", value)} />
            <NumberField label="时" value={props.form.hour} onChange={(value) => update("hour", value)} />
            <NumberField label="分" value={props.form.minute} onChange={(value) => update("minute", value)} />
            <label className={styles.field}>
              <span className={styles.label}>性别</span>
              <select
                className={styles.select}
                value={props.form.gender}
                onChange={(event) => update("gender", event.target.value as ZiweiFormState["gender"])}
              >
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
            </label>
          </div>
        </div>
      </div>
    </section>
  )
}

export function FlowTimePicker(props: {
  form: ZiweiFormState
  dynamicDebug?: ZiweiDynamicDebugView
  selectedFlowType: ZiweiDynamicFlowType
  onChange: (form: ZiweiFormState) => void
  onSelectFlowType?: (flowType: ZiweiDynamicFlowType) => void
  onCommitFlowTime?: (form: ZiweiFormState, flowType: ZiweiDynamicFlowType) => void
}) {
  const updateFlowAge = (age: number): ZiweiFormState => {
    const nextForm = {
      ...props.form,
      currentAge: age,
      currentYear: props.form.year + age
    }

    props.onChange(nextForm)

    return nextForm
  }
  const selectFlowType = (flowType: ZiweiDynamicFlowType) => {
    props.onSelectFlowType?.(flowType)
  }
  const isFlowTimeSelected = (
    flowType: Extract<
      ZiweiDynamicFlowType,
      "daYun" | "liuNian" | "liuYue" | "liuRi" | "liuShi"
    >
  ) => {
    return isZiweiDynamicFlowWithinSelectedDepth({
      selectedFlowType: props.selectedFlowType,
      targetFlowType: flowType
    })
  }
  const selectFlowAge = (
    age: number,
    flowType: Extract<ZiweiDynamicFlowType, "daYun" | "liuNian">
  ) => {
    const nextForm = updateFlowAge(age)

    props.onCommitFlowTime?.(nextForm, flowType)
  }
  const selectDaYunAge = (range: { startAge: number; endAge: number }) => {
    const isCurrentRange =
      props.form.currentAge >= range.startAge &&
      props.form.currentAge <= range.endAge

    if (props.selectedFlowType === "daYun" && isCurrentRange) {
      selectFlowType("natal")
      return
    }

    selectFlowAge(range.startAge, "daYun")
  }
  const updateFlowValue = <Key extends keyof ZiweiFormState>(
    key: Key,
    value: ZiweiFormState[Key],
    flowType: Extract<ZiweiDynamicFlowType, "liuYue" | "liuRi" | "liuShi">
  ) => {
    const nextForm = {
      ...props.form,
      [key]: value
    }

    props.onChange(nextForm)
    props.onCommitFlowTime?.(nextForm, flowType)
  }
  const shiftFlowDecade = (offset: number) => {
    const nextAge = Math.max(1, props.form.currentAge + offset)

    selectFlowAge(nextAge, "liuNian")
  }
  const limitStartAge = props.dynamicDebug?.startAge ?? 1
  const ageWindowStart = getAgeWindowStart({
    currentAge: props.form.currentAge,
    limitStartAge
  })
  const flowYears = Array.from({ length: LIMIT_COLUMN_COUNT }, (_, index) => {
    const age = ageWindowStart + index

    return {
      age,
      year: props.form.year + age
    }
  })
  const limitRanges = Array.from({ length: LIMIT_COLUMN_COUNT }, (_, index) => {
    const startAge = limitStartAge + index * 10

    return {
      startAge,
      endAge: startAge + 9
    }
  })

  return (
    <section className={styles.flowTimePicker}>
      <div className={styles.flowTimeHeader}>
        <span>流动时间</span>
        <strong>
          {props.form.currentYear} 年 · {props.form.currentAge} 岁 ·{" "}
          {LUNAR_MONTH_OPTIONS[props.form.currentLunarMonth - 1] ??
            `${props.form.currentLunarMonth}月`}
          {LUNAR_DAY_OPTIONS[props.form.currentLunarDay - 1] ??
            `${props.form.currentLunarDay}日`}
        </strong>
        {props.dynamicDebug ? (
          <small>
            流年斗君：{props.dynamicDebug.douJunPalaceLabel} · 当前小限：
            {props.dynamicDebug.xiaoXianPalaceLabel} ·{" "}
            {props.dynamicDebug.xiaoXianDirectionLabel}
          </small>
        ) : null}
      </div>

      <div className={styles.flowTimeTable}>
        <FlowTimeRow label="大限">
          {limitRanges.map((range) => (
            <button
              className={`${styles.flowTimeCell} ${
                isFlowTimeSelected("daYun") &&
                props.form.currentAge >= range.startAge &&
                props.form.currentAge <= range.endAge
                  ? styles.flowTimeCellActive
                  : ""
              }`}
              key={range.startAge}
              onClick={() => selectDaYunAge(range)}
              type="button"
            >
              <strong>{range.startAge}~{range.endAge}</strong>
              <span>限</span>
            </button>
          ))}
        </FlowTimeRow>

        <FlowTimeRow
          label="流年小限"
          leadingControl={
            <button
              aria-label="上一组流年"
              className={styles.flowTimeArrowButton}
              onClick={() => shiftFlowDecade(-10)}
              type="button"
            >
              ‹
            </button>
          }
          trailingControl={
            <button
              aria-label="下一组流年"
              className={styles.flowTimeArrowButton}
              onClick={() => shiftFlowDecade(10)}
              type="button"
            >
              ›
            </button>
          }
        >
          {flowYears.map((item) => (
            <button
              className={`${styles.flowTimeCell} ${
                isFlowTimeSelected("liuNian") &&
                item.year === props.form.currentYear
                  ? styles.flowTimeCellActive
                  : ""
              }`}
              key={item.year}
              onClick={() => selectFlowAge(item.age, "liuNian")}
              type="button"
            >
              <strong>{item.year}年</strong>
              <span>{item.age}岁</span>
            </button>
          ))}
        </FlowTimeRow>

        <FlowTimeRow label="流月">
          {LUNAR_MONTH_OPTIONS.map((label, index) => {
            const value = index + 1

            return (
              <button
                className={`${styles.flowTimeCell} ${
                  isFlowTimeSelected("liuYue") &&
                  value === props.form.currentLunarMonth
                  ? styles.flowTimeCellActive
                  : ""
                }`}
                key={label}
                onClick={() =>
                  updateFlowValue("currentLunarMonth", value, "liuYue")
                }
                type="button"
              >
                <strong>{label}</strong>
              </button>
            )
          })}
        </FlowTimeRow>

        <FlowTimeRow label="流日">
          {LUNAR_DAY_OPTIONS.map((label, index) => {
            const value = index + 1

            return (
              <button
                className={`${styles.flowTimeCell} ${
                isFlowTimeSelected("liuRi") &&
                value === props.form.currentLunarDay
                  ? styles.flowTimeCellActive
                  : ""
                }`}
                key={label}
                onClick={() =>
                  updateFlowValue("currentLunarDay", value, "liuRi")
                }
                type="button"
              >
                <strong>{label}</strong>
              </button>
            )
          })}
        </FlowTimeRow>

        <FlowTimeRow label="流时">
          {ZIWEI_TIME_BRANCH_OPTIONS.map((option) => (
            <button
              className={`${styles.flowTimeCell} ${
                isFlowTimeSelected("liuShi") &&
                option.value === props.form.currentTimeBranch
                  ? styles.flowTimeCellActive
                  : ""
              }`}
              key={option.value}
              onClick={() =>
                updateFlowValue("currentTimeBranch", option.value, "liuShi")
              }
              type="button"
            >
              <strong>{option.label}时</strong>
            </button>
          ))}
        </FlowTimeRow>
      </div>
    </section>
  )
}

function FlowTimeRow(props: {
  label: string
  children: ReactNode
  leadingControl?: ReactNode
  trailingControl?: ReactNode
}) {
  return (
    <div className={styles.flowTimeRow}>
      <div className={styles.flowTimeRowLabel}>{props.label}</div>
      {props.leadingControl}
      <div className={styles.flowTimeCells}>{props.children}</div>
      {props.trailingControl}
    </div>
  )
}

function getAgeWindowStart(params: {
  currentAge: number
  limitStartAge: number
}): number {
  if (params.currentAge <= params.limitStartAge) {
    return params.limitStartAge
  }

  const offset = (params.currentAge - params.limitStartAge) % 10

  return params.currentAge - offset
}

function NumberField(props: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{props.label}</span>
      <input
        className={styles.input}
        type="number"
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value))}
      />
    </label>
  )
}
