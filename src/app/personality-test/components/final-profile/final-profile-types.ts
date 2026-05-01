/**
 * 当前文件负责：定义最终人格展示面板使用的局部类型。
 */

export type NumericObjectView = object

export type FinalPersonalityProfileView = {
  labels: string[]
  summary: string
  vector: NumericObjectView
  bias: {
    petBehaviorBias: NumericObjectView
    butlerBehaviorBias: NumericObjectView
    buildingBias: NumericObjectView
  }
}