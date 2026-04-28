import Link from "next/link"

/**
 * 当前文件负责：AI-PET-WORLD 正式首页入口。
 */

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#07070a] text-white">
      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col items-center justify-center px-6 py-20 text-center">
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute left-1/4 top-1/4 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative z-10 max-w-4xl">
          <p className="mb-6 text-sm font-semibold tracking-[0.35em] text-zinc-500">
            AI-PET-WORLD ALPHA
          </p>

          <h1 className="mb-8 text-5xl font-black leading-tight tracking-tight md:text-7xl">
            一个会自己运转的
            <br />
            AI 生命世界
          </h1>

          <p className="mx-auto mb-12 max-w-2xl text-lg leading-8 text-zinc-400">
            宠物拥有自主意识、时间流动、情绪变化与长期成长轨迹。
            你不是传统养成游戏里的操作者，而是这个世界的观察者。
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/world"
              className="rounded-2xl bg-white px-8 py-4 text-base font-bold text-black shadow-[0_0_40px_rgba(255,255,255,0.12)] transition-transform hover:scale-105"
            >
              进入世界
            </Link>

            <Link
              href="/personality-test"
              className="rounded-2xl border border-zinc-700 px-8 py-4 text-base font-bold text-zinc-300 transition-colors hover:border-zinc-400 hover:text-white"
            >
              人格实验室
            </Link>
          </div>

          <div className="mt-16 grid gap-4 text-left md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
              <p className="mb-3 text-sm font-bold text-zinc-300">
                自主生命
              </p>
              <p className="text-sm leading-6 text-zinc-500">
                宠物不是按钮触发的动画，而是根据状态、时间、刺激与个体差异自主行动。
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
              <p className="mb-3 text-sm font-bold text-zinc-300">
                持续世界
              </p>
              <p className="text-sm leading-6 text-zinc-500">
                世界会持续推进，环境、事件、行为和生命阶段共同构成可观察的变化。
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
              <p className="mb-3 text-sm font-bold text-zinc-300">
                观察体验
              </p>
              <p className="text-sm leading-6 text-zinc-500">
                用户主要通过管家与世界建立连接，观察宠物如何自然成长，而不是直接控制宠物。
              </p>
            </div>
          </div>

          <div className="mt-12 text-sm leading-7 text-zinc-600">
            <p>当前阶段：Alpha 世界验证</p>
            <p>当前目标：让用户在 3 分钟内感知“这个世界是活的”。</p>
          </div>
        </div>
      </section>
    </main>
  )
}