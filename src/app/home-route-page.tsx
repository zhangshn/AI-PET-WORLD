import Link from "next/link"

/**
 * 当前文件职责：AI-PET-WORLD 正式首页入口。
 */

export default function HomeRoutePage() {
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
            AI 管家驱动的
            <br />
            自主像素世界
          </h1>

          <p className="mx-auto mb-12 max-w-2xl text-lg leading-8 text-zinc-400">
            你提交出生信息，系统将紫微斗数映射为管家的灵魂与长期人格。
            管家会自主观察、建设、沟通和成长；你不是直接操作者，而是这个世界的源头与长期关系参与者。
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/create-world"
              className="rounded-2xl bg-white px-8 py-4 text-base font-bold text-black shadow-[0_0_40px_rgba(255,255,255,0.12)] transition-transform hover:scale-105"
            >
              创建世界
            </Link>

            <Link
              href="/world"
              className="rounded-2xl border border-zinc-700 px-8 py-4 text-base font-bold text-zinc-300 transition-colors hover:border-zinc-400 hover:text-white"
            >
              进入世界
            </Link>
          </div>

          <div className="mt-16 grid gap-4 text-left md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
              <p className="mb-3 text-sm font-bold text-zinc-300">
                管家灵魂
              </p>
              <p className="text-sm leading-6 text-zinc-500">
                出生信息不是装饰标签，而是管家长期人格、观察方式、建设偏好和沟通节奏的源头。
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
              <p className="mb-3 text-sm font-bold text-zinc-300">
                自主世界
              </p>
              <p className="text-sm leading-6 text-zinc-500">
                世界由规则、资源、空间、生态、痕迹和记忆持续推进，画面只表现事实，不创造事实。
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
              <p className="mb-3 text-sm font-bold text-zinc-300">
                P-Phone 关系
              </p>
              <p className="text-sm leading-6 text-zinc-500">
                你通过游戏手机与管家沟通。建议不是命令，管家可以接受、延后、调整或拒绝。
              </p>
            </div>
          </div>

          <div className="mt-12 text-sm leading-7 text-zinc-600">
            <p>当前阶段：Alpha 世界主链验证</p>
            <p>当前目标：让出生信息真正贯穿管家、世界生成和后续运行。</p>
          </div>
        </div>
      </section>
    </main>
  )
}
