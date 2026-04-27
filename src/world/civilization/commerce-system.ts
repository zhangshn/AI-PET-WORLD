/**
 * 当前文件负责：定义世界资源流通与未来交易系统基础结构。
 */

export type CommerceResourceType =
  | "food"
  | "water"
  | "wood"
  | "medicine"
  | "building_material"

export type CommerceResourceStack = {
  type: CommerceResourceType
  amount: number
}

export type CommerceState = {
  resources: CommerceResourceStack[]
  marketUnlocked: boolean
}

export function createInitialCommerceState(): CommerceState {
  return {
    marketUnlocked: false,
    resources: [
      {
        type: "food",
        amount: 20,
      },
      {
        type: "water",
        amount: 20,
      },
      {
        type: "wood",
        amount: 10,
      },
    ],
  }
}

export function addCommerceResource(input: {
  state: CommerceState
  type: CommerceResourceType
  amount: number
}): CommerceState {
  const exists = input.state.resources.some((item) => item.type === input.type)

  return {
    ...input.state,
    resources: exists
      ? input.state.resources.map((item) =>
          item.type === input.type
            ? {
                ...item,
                amount: item.amount + input.amount,
              }
            : item
        )
      : [
          ...input.state.resources,
          {
            type: input.type,
            amount: input.amount,
          },
        ],
  }
}