import type {
  WorldVisualAiImageCandidate,
  WorldVisualFactManifest,
  WorldVisualReviewCheck,
  WorldVisualReviewReport,
} from "../world-visual-painter-schema"
import { WORLD_VISUAL_MVP_TARGET_POLICY } from "../visual-target-policy"

export function buildWorldVisualReviewReport(input: {
  factManifest: WorldVisualFactManifest
  aiImageCandidate: WorldVisualAiImageCandidate | null
}): WorldVisualReviewReport {
  const checks = buildReviewChecks(input)
  const score = Math.round(
    checks.reduce((sum, check) => sum + check.score, 0) / checks.length
  )
  const status = checks.every((check) => check.passed)
    ? "passed_candidate"
    : "failed"

  return {
    status,
    canShowToPlayer: false,
    reason:
      status === "passed_candidate"
        ? {
            zh: "AI 位图候选图通过视觉审核，可进入 ApprovedFrame 构建；在 ApprovedFrame 生成前仍禁止展示。",
            en: "The AI bitmap candidate passed Visual Judge and may enter ApprovedFrame building. It remains hidden until ApprovedFrame exists.",
          }
        : {
            zh: "视觉审核未通过：缺少真正的 AI 位图候选图，或候选图未满足事实一致性、原创安全、画面质量要求，因此禁止展示。",
            en: "Visual review failed: a real AI bitmap candidate is missing, or the candidate does not meet fact consistency, originality safety, and visual quality requirements.",
          },
    score,
    checks,
    requiredChecks: [
      {
        zh: "必须有 AI 图像生成模型或授权导入流程产出的 PNG/WebP/JPG 位图候选图。",
        en: "A PNG/WebP/JPG bitmap candidate from an AI image model or authorized import flow is required.",
      },
      {
        zh: "候选图不能篡改世界事实，只能补充视觉细节。",
        en: "The candidate must not rewrite world facts and may only add visual detail.",
      },
      {
        zh: "候选图不能复制未授权第三方作品，只能使用授权数据或抽象设计原则。",
        en: "The candidate must not copy unlicensed third-party works and may only use licensed data or abstract design principles.",
      },
      WORLD_VISUAL_MVP_TARGET_POLICY.displayGate,
    ],
    fixInstructions: buildFixInstructions(checks),
    tags: [
      "visual_review",
      status,
      "ai_bitmap_candidate_required",
      "display_blocked_until_approved_frame",
      "no_programmatic_renderer",
    ],
  }
}

function buildReviewChecks(input: {
  factManifest: WorldVisualFactManifest
  aiImageCandidate: WorldVisualAiImageCandidate | null
}): WorldVisualReviewCheck[] {
  const candidate = input.aiImageCandidate
  const hasAiBitmapCandidate =
    Boolean(candidate) &&
    candidate?.canShowToPlayer === false &&
    candidate.width >= 1024 &&
    candidate.height >= 768 &&
    ["png", "webp", "jpg"].includes(candidate.imageFormat)
  const candidateHasAllowedLicense =
    candidate === null
      ? false
      : candidate.originalityConfirmed &&
        ["self_owned", "cc0", "commercial_license"].includes(candidate.license)
  const candidateKeepsFactLinks =
    candidate === null
      ? false
      : candidate.promptPackageId.length > 0 &&
        candidate.sourceFactIds.length === input.factManifest.sourceFactIds.length

  return [
    check(
      "ai_image_candidate",
      hasAiBitmapCandidate,
      hasAiBitmapCandidate ? 92 : 0,
      "AI 位图候选图",
      "AI image candidate",
      hasAiBitmapCandidate
        ? "已存在隐藏的 AI 位图候选图。"
        : "还没有 AI 图像生成模型产出的 PNG/WebP/JPG。",
      hasAiBitmapCandidate
        ? "A hidden AI bitmap candidate exists."
        : "No PNG/WebP/JPG from an AI image model exists."
    ),
    check(
      "candidate_fact_link",
      candidateKeepsFactLinks,
      candidateKeepsFactLinks ? 90 : 0,
      "候选图事实链",
      "Candidate fact links",
      candidateKeepsFactLinks
        ? "候选图保留了世界事实和 Prompt Package 来源链。"
        : "候选图缺少世界事实或 Prompt Package 来源链。",
      candidateKeepsFactLinks
        ? "The candidate keeps world fact and prompt package links."
        : "The candidate lacks world fact or prompt package links."
    ),
    check(
      "candidate_license",
      candidateHasAllowedLicense,
      candidateHasAllowedLicense ? 95 : 0,
      "候选图授权",
      "Candidate license",
      candidateHasAllowedLicense
        ? "候选图已确认自有、CC0 或商业授权，并确认不是直接复制未授权作品。"
        : "候选图缺少允许使用的授权确认，不能进入 ApprovedFrame。",
      candidateHasAllowedLicense
        ? "The candidate is confirmed as self-owned, CC0, or commercially licensed, and not a direct copy of an unlicensed work."
        : "The candidate lacks allowed license confirmation and cannot enter ApprovedFrame."
    ),
  ]
}

function check(
  id: string,
  passed: boolean,
  score: number,
  zhLabel: string,
  enLabel: string,
  zhEvidence: string,
  enEvidence: string
): WorldVisualReviewCheck {
  return {
    id,
    passed,
    score,
    label: { zh: zhLabel, en: enLabel },
    evidence: { zh: zhEvidence, en: enEvidence },
    tags: [id, passed ? "passed" : "failed"],
  }
}

function buildFixInstructions(
  checks: WorldVisualReviewCheck[]
): WorldVisualReviewReport["fixInstructions"] {
  return checks
    .filter((check) => !check.passed)
    .map((check) => {
      if (check.id === "ai_image_candidate") {
        return {
          zh: "接入 AI 图像生成模型或授权人工导入流程，生成真正的位图候选图。",
          en: "Connect an AI image model or authorized manual import flow to produce a real bitmap candidate.",
        }
      }

      if (check.id === "candidate_fact_link") {
        return {
          zh: "候选图必须绑定 sourceFactIds 和 promptPackageId。",
          en: "The candidate must bind sourceFactIds and promptPackageId.",
        }
      }

      if (check.id === "candidate_license") {
        return {
          zh: "候选图必须确认来源为自有、CC0 或商业授权，并确认没有直接复制未授权第三方作品。",
          en: "The candidate must be confirmed as self-owned, CC0, or commercially licensed, and must not directly copy unlicensed third-party work.",
        }
      }

      return {
        zh: `修正 ${check.label.zh}：${check.evidence.zh}`,
        en: `Fix ${check.label.en}: ${check.evidence.en}`,
      }
    })
}
