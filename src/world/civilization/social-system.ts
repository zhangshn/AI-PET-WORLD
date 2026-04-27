/**
 * 当前文件负责：定义世界文明中的基础社会关系结构。
 */

export type SocialRelationType =
  | "neutral"
  | "trusted"
  | "needed"
  | "replaceable"
  | "conflicted"

export type WorldSocialRelation = {
  fromId: string
  toId: string
  relation: SocialRelationType
  trust: number
  familiarity: number
}

export type WorldSocialState = {
  relations: WorldSocialRelation[]
}

export function createEmptyWorldSocialState(): WorldSocialState {
  return {
    relations: [],
  }
}

export function upsertWorldSocialRelation(
  state: WorldSocialState,
  relation: WorldSocialRelation
): WorldSocialState {
  const exists = state.relations.some(
    (item) => item.fromId === relation.fromId && item.toId === relation.toId
  )

  return {
    relations: exists
      ? state.relations.map((item) =>
          item.fromId === relation.fromId && item.toId === relation.toId
            ? relation
            : item
        )
      : [...state.relations, relation],
  }
}