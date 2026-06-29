"use client"

import type {
  FullZiweiDynamicChartInput,
  ZiweiBirthInput
} from "@/ai/destiny-core/ziwei-core/contracts"

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

export function BirthInputPanel(props: {
  form: ZiweiFormState
  loading: boolean
  onChange: (form: ZiweiFormState) => void
  onSubmit: () => void
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

          <div className={styles.fieldGrid}>
            <NumberField label="当前年龄" value={props.form.currentAge} onChange={(value) => update("currentAge", value)} />
            <NumberField label="流年" value={props.form.currentYear} onChange={(value) => update("currentYear", value)} />
            <NumberField label="流月" value={props.form.currentLunarMonth} onChange={(value) => update("currentLunarMonth", value)} />
            <NumberField label="流日" value={props.form.currentLunarDay} onChange={(value) => update("currentLunarDay", value)} />
            <label className={styles.field}>
              <span className={styles.label}>流时</span>
              <select
                className={styles.select}
                value={props.form.currentTimeBranch}
                onChange={(event) => update("currentTimeBranch", event.target.value as ZiweiFormState["currentTimeBranch"])}
              >
                {ZIWEI_TIME_BRANCH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            className={styles.button}
            disabled={props.loading}
            type="button"
            onClick={props.onSubmit}
          >
            {props.loading ? "排盘中" : "排盘"}
          </button>
        </div>
      </div>
    </section>
  )
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
