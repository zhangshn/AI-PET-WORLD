import type { TimeBranch } from "@/ai/destiny-core/ziwei-core/contracts"

export const ZIWEI_TIME_BRANCH_OPTIONS: Array<{
  value: TimeBranch
  label: string
}> = [
  { value: "zi", label: "子" },
  { value: "chou", label: "丑" },
  { value: "yin", label: "寅" },
  { value: "mao", label: "卯" },
  { value: "chen", label: "辰" },
  { value: "si", label: "巳" },
  { value: "wu", label: "午" },
  { value: "wei", label: "未" },
  { value: "shen", label: "申" },
  { value: "you", label: "酉" },
  { value: "xu", label: "戌" },
  { value: "hai", label: "亥" }
]
