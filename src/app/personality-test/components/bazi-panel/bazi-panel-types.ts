/**
 * 当前文件负责：定义八字动力底盘展示组件使用的局部类型。
 */

export type BaziPillarView = {
  label: string
}

export type BaziProfileView = {
  chart: {
    yearPillar: BaziPillarView
    monthPillar: BaziPillarView
    dayPillar: BaziPillarView
    hourPillar?: BaziPillarView | null
    hasHour: boolean
  }
  dominantElements: string[]
}