/**
 * 当前文件负责：定义紫微人格输出面板使用的局部类型。
 */

export type NumericObjectView = object

export type PairDebugItemView = {
  pairLabel: string
}

export type ZiweiDebugView = {
  hitPairs: PairDebugItemView[]
  supportPairs: PairDebugItemView[]
}