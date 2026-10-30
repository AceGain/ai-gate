import { t } from '@/i18n'
import type { MessageKey } from '@/i18n'
import { ApiError } from './api'

const errorKeys: Readonly<Record<string, MessageKey>> = {
  PROVIDER_NOT_FOUND: 'errors.providerNotFound',
  ENDPOINT_NOT_FOUND: 'errors.endpointNotFound',
  KEY_NOT_FOUND: 'errors.keyNotFound',
  MODEL_NOT_FOUND: 'errors.modelNotFound',
  DUPLICATE_PROVIDER_CODE: 'validation.duplicateProviderCode',
  DUPLICATE_MODEL_CODE: 'validation.duplicateModelCode',
  DUPLICATE_ENDPOINT: 'validation.duplicateEndpointType',
  INVALID_REQUEST: 'validation.checkForm',
  INVALID_IMPORT_PAYLOAD: 'errors.invalidImportPayload',
  INVALID_BINDINGS: 'errors.invalidBindings',
  MISSING_BASE_ENDPOINT: 'errors.missingBaseEndpoint',
  MISSING_MODELS_ENDPOINT: 'errors.missingModelsEndpoint',
  MISSING_GENERATE_ENDPOINT: 'errors.missingGenerateEndpoint',
  NO_ACTIVE_KEYS: 'errors.noActiveKeys',
  KEY_INACTIVE: 'errors.keyInactive',
  UPSTREAM_TIMEOUT: 'errors.upstreamTimeout',
  UPSTREAM_UNREACHABLE: 'errors.upstreamUnreachable',
  UPSTREAM_ERROR: 'errors.upstreamError',
  UPSTREAM_INVALID_RESPONSE: 'errors.upstreamInvalidResponse',
  INTERNAL_ERROR: 'errors.internalError',
}

/** Raw backend/upstream diagnostics remain available on ApiError.detail. */
export function apiErrorMessage(error: unknown, fallback: MessageKey = 'errors.backendUnavailable'): string {
  const key = error instanceof ApiError ? errorKeys[error.code] : undefined
  return t(key ?? fallback)
}
