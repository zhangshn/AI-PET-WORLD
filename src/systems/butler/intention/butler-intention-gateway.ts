/**
 * 当前文件负责：统一导出管家意图形成与状态解释相关入口。
 *
 * intention 属于第 7 层：自主驱动层。
 * 它只负责管家为何靠近、等待、解释、保护、提供机会或不行动的意图与状态解释，
 * 不直接执行行为。
 */

export {
  deriveButlerMood,
} from "./state-interpretation/butler-state-interpretation-gateway"