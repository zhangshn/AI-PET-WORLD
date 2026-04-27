/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Knowledge / Empty State
 *
 * 功能：
 * 预留 primarySector 为空宫时的知识层策略
 *
 * 说明：
 * - 当前先定义规则与标记
 * - 后续 mapper.ts 再真正接入这套逻辑
 * ======================================================
 */

/**
 * 主导区为空时的处理策略
 *
 * 当前建议：
 * - borrow_support：
 *   如果主导区为空，则从联动区借入主导信息
 *
 * 后续可扩展：
 * - keep_empty：
 *   保持空状态，不借主导
 * - weighted_support：
 *   按联动区权重混合借入
 */
export type EmptyPrimaryStrategy =
  | "borrow_support"

/**
 * 当前版本主导区为空的默认处理策略
 */
export const DEFAULT_EMPTY_PRIMARY_STRATEGY: EmptyPrimaryStrategy =
  "borrow_support"

/**
 * 空宫时的摘要提示
 *
 * 后续 mapper 如果命中空宫，可以把这句摘要加进去。
 */
export const EMPTY_PRIMARY_SUMMARY =
  "主导区为空，当前人格更多受联动结构影响。"