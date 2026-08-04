import {
  consumeOwnerAuthorization,
  OwnerAuthorizationCoreError,
  verifyOwnerAuthorization,
} from "@/server/project-owner-authorization-core.mjs"

const AUTHORIZATION_PATH_HEADER = "x-ai-pet-world-owner-authorization-path"
const AUTHORIZATION_SHA_HEADER = "x-ai-pet-world-owner-authorization-sha256"
const OWNER_COMMAND_HEADER = "x-ai-pet-world-owner-command-ref"
const AUTHORIZATION_SCOPE_HEADER = "x-ai-pet-world-owner-authorization-scope"
const AUTHORIZED_ACTION_HEADER = "x-ai-pet-world-owner-authorized-action"

export type OwnerWriteAuthorizationExpectation = {
  action: string
  target: unknown
  payload: unknown
}

export type OwnerWriteAuthorizationClaim = {
  action: string
  authorizationId: string
  authorizationPath: string
  authorizationSha256: string
  ownerCommandRef: string
  scope: string
  signerKeyId: string
  targetSha256: string
  payloadSha256: string
  consumptionPath: string
}

export class OwnerWriteAuthorizationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 403,
  ) {
    super(message)
  }
}

export async function claimOwnerWriteAuthorization(
  request: Request,
  expectation: OwnerWriteAuthorizationExpectation,
): Promise<OwnerWriteAuthorizationClaim> {
  const providedAction = requiredHeader(request, AUTHORIZED_ACTION_HEADER)
  if (providedAction !== expectation.action) {
    throw new OwnerWriteAuthorizationError("Owner授权动作与当前写操作不匹配。", "owner_authorized_action_mismatch")
  }

  try {
    const verified = verifyOwnerAuthorization({
      root: process.cwd(),
      authorizationPath: requiredHeader(request, AUTHORIZATION_PATH_HEADER),
      providedSha256: requiredHeader(request, AUTHORIZATION_SHA_HEADER),
      ownerCommandRef: requiredHeader(request, OWNER_COMMAND_HEADER),
      scope: requiredHeader(request, AUTHORIZATION_SCOPE_HEADER),
      expectation: {
        ...expectation,
        method: request.method.toUpperCase(),
        route: new URL(request.url).pathname,
      },
    })
    const consumptionPath = consumeOwnerAuthorization(verified, { root: process.cwd() })
    return { ...verified, consumptionPath }
  } catch (error) {
    if (error instanceof OwnerAuthorizationCoreError) {
      throw new OwnerWriteAuthorizationError(error.message, error.code, error.status)
    }
    throw error
  }
}

function requiredHeader(request: Request, name: string) {
  const value = request.headers.get(name)?.trim()
  if (!value) throw new OwnerWriteAuthorizationError(`缺少Owner授权请求头：${name}`, "owner_authorization_header_missing")
  return value
}
