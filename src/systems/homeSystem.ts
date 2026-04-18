/**
 * ======================================================
 * AI-PET-WORLD
 * Home System
 *
 * 功能：
 * 1. 管理家园建造状态
 * 2. 在管家建造时推进进度
 * 3. 建造完成后更新状态
 * ======================================================
 */

import { HomeState } from "../types/home"

export class HomeSystem {
  /**
   * 当前家园状态
   */
  private home: HomeState

  constructor() {
    this.home = {
      level: 1,
      progress: 0,
      status: "not_started"
    }
  }

  /**
   * ======================================================
   * 推进建造进度
   * ======================================================
   */
  build(amount: number) {
    /**
     * 如果已经完成，就不再继续建造
     */
    if (this.home.status === "completed") {
      return
    }

    /**
     * 一旦开始建造，状态切换为 building
     */
    if (this.home.progress === 0) {
      this.home.status = "building"
    }

    this.home.progress += amount

    if (this.home.progress >= 100) {
      this.home.progress = 100
      this.home.status = "completed"
    }
  }

  /**
   * ======================================================
   * 获取家园状态
   * 返回副本，避免外部直接修改
   * ======================================================
   */
  getHome(): HomeState {
    return { ...this.home }
  }
}