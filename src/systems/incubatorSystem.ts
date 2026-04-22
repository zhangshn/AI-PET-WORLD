/**
 * ======================================================
 * AI-PET-WORLD
 * Incubator System
 * ======================================================
 *
 * 当前文件负责：
 * 1. 管理孵化器中的胚胎
 * 2. 推进胚胎孵化进度
 * 3. 管理孵化稳定度
 * 4. 判断是否可以完成孵化
 *
 * 正确业务逻辑：
 * - 胚胎阶段没有人格
 * - 孵化器只负责“生命能否顺利诞生”
 * - 人格不会在这里生成，也不会在这里预存
 * - 人格只在出生那一刻，由外部调用核心模块生成
 * ======================================================
 */

import { IncubatorState } from "../types/incubator"

export class IncubatorSystem {
  /**
   * 当前孵化器状态
   */
  private incubator: IncubatorState

  constructor() {
    /**
     * 初始化孵化器
     *
     * 当前默认：
     * - 孵化器里有一个胚胎
     * - 名字先作为出生后的宠物名字占位
     * - 初始进度较低
     * - 初始稳定度较高
     */
    this.incubator = {
      hasEmbryo: true,
      embryoName: "Mochi",
      progress: 0,
      stability: 85,
      status: "incubating",
    }
  }

  /**
   * ======================================================
   * 每个世界 Tick 的自然变化
   *
   * 逻辑说明：
   * - 即使没有额外照看，胚胎也会缓慢成长
   * - 但稳定度会有轻微自然损耗
   * - 这样管家的照看才有意义
   * ======================================================
   */
  update() {
    if (!this.incubator.hasEmbryo) {
      return
    }

    if (this.incubator.status === "hatched") {
      return
    }

    /**
     * 自然孵化推进
     */
    this.incubator.progress += 3

    /**
     * 稳定度自然损耗
     */
    this.incubator.stability -= 1

    this.clampValues()
    this.refreshStatus()

    console.log(
      `孵化器状态：进度=${this.incubator.progress} 稳定度=${this.incubator.stability} 状态=${this.incubator.status}`
    )
  }

  /**
   * ======================================================
   * 管家照看孵化器
   *
   * 效果：
   * - 增加孵化进度
   * - 提升稳定度
   *
   * 业务说明：
   * - 管家照看的是孵化器，不是直接“塑造人格”
   * - 这里不参与人格生成
   * ======================================================
   */
  care(amountProgress: number, amountStability: number) {
    if (!this.incubator.hasEmbryo) {
      return
    }

    if (this.incubator.status === "hatched") {
      return
    }

    this.incubator.progress += amountProgress
    this.incubator.stability += amountStability

    this.clampValues()
    this.refreshStatus()
  }

  /**
   * ======================================================
   * 判断当前是否已经达到可孵化状态
   *
   * 条件：
   * - progress >= 100
   * - stability >= 60
   * - 尚未标记为 hatched
   * ======================================================
   */
  canHatch(): boolean {
    return (
      this.incubator.hasEmbryo &&
      this.incubator.progress >= 100 &&
      this.incubator.stability >= 60 &&
      this.incubator.status !== "hatched"
    )
  }

  /**
   * ======================================================
   * 正式完成孵化
   *
   * 这里只负责切换孵化状态并返回宠物名
   * 不负责生成宠物人格
   * ======================================================
   */
  hatch(): string | null {
    if (!this.canHatch()) {
      return null
    }

    this.incubator.status = "hatched"

    return this.incubator.embryoName
  }

  /**
   * ======================================================
   * 判断孵化器中是否还有未出生胚胎
   * ======================================================
   */
  hasActiveEmbryo(): boolean {
    return this.incubator.hasEmbryo && this.incubator.status !== "hatched"
  }

  /**
   * ======================================================
   * 获取当前孵化器状态
   * 返回副本，防止外部直接修改
   * ======================================================
   */
  getIncubator(): IncubatorState {
    return { ...this.incubator }
  }

  /**
   * ======================================================
   * 限制数值范围
   * ======================================================
   */
  private clampValues() {
    if (this.incubator.progress < 0) {
      this.incubator.progress = 0
    }

    if (this.incubator.progress > 100) {
      this.incubator.progress = 100
    }

    if (this.incubator.stability < 0) {
      this.incubator.stability = 0
    }

    if (this.incubator.stability > 100) {
      this.incubator.stability = 100
    }
  }

  /**
   * ======================================================
   * 根据当前进度和稳定度刷新状态
   * ======================================================
   */
  private refreshStatus() {
    if (this.incubator.status === "hatched") {
      return
    }

    if (this.incubator.progress >= 100 && this.incubator.stability >= 60) {
      this.incubator.status = "ready_to_hatch"
      return
    }

    this.incubator.status = "incubating"
  }
}