import type { Account, AccountKind, CreateAccountInput } from '../../types/finance-domain'

export type AccountDraft = {
  name: string
  kind: AccountKind | string
  openingBalance: string
  color: string
}

type PendingLock = {
  tryAcquire: () => boolean
  release: () => void
}

type AccountActions = {
  createAccount: (input: CreateAccountInput) => Promise<unknown>
  updateAccount: (accountId: string, input: CreateAccountInput) => Promise<unknown>
}

type OperationResult = {
  status: 'success' | 'invalid' | 'pending' | 'cancelled' | 'rejected'
  message?: string
}

const DELETE_ACCOUNT_REFERENCE_ERROR = 'This account is used by one or more transactions and cannot be deleted.'

export function parseSignedMinorUnits(value: string): number | null {
  if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(value)) return null
  const amount = Number(value)
  const minor = Math.round(amount * 100)
  if (!Number.isFinite(amount) || !Number.isSafeInteger(minor)) return null
  return minor === 0 ? 0 : minor
}

export function accountPayloadFromDraft(draft: AccountDraft): { payload: CreateAccountInput | null; error: string } {
  const name = draft.name.trim()
  if (!name) return { payload: null, error: 'Account name is required.' }
  if (name.length > 80) return { payload: null, error: 'Account name must be 80 characters or fewer.' }
  if (draft.kind !== 'asset' && draft.kind !== 'liability') {
    return { payload: null, error: 'Choose a valid account type.' }
  }
  const openingBalanceMinor = parseSignedMinorUnits(draft.openingBalance)
  if (openingBalanceMinor === null) {
    return { payload: null, error: 'Enter a valid opening balance with no more than two decimal places.' }
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(draft.color)) {
    return { payload: null, error: 'Enter a valid six-digit hex color.' }
  }
  return {
    payload: { name, kind: draft.kind, openingBalanceMinor, color: draft.color },
    error: '',
  }
}

export function accountDraftFromAccount(account: Account): AccountDraft {
  return {
    name: account.name,
    kind: account.kind,
    openingBalance: (account.openingBalanceMinor / 100).toFixed(2),
    color: account.color,
  }
}

export async function saveAccount(options: AccountActions & {
  draft: AccountDraft
  accountId: string | null
  lock: PendingLock
  setPending?: (pending: boolean) => void
}): Promise<OperationResult> {
  const { payload, error } = accountPayloadFromDraft(options.draft)
  if (!payload) return { status: 'invalid', message: error }
  if (!options.lock.tryAcquire()) return { status: 'pending' }
  options.setPending?.(true)
  try {
    if (options.accountId) await options.updateAccount(options.accountId, payload)
    else await options.createAccount(payload)
    return { status: 'success' }
  } catch {
    return { status: 'rejected', message: 'Unable to save the account. Please try again.' }
  } finally {
    options.setPending?.(false)
    options.lock.release()
  }
}

export async function deleteAccountWithConfirmation(options: {
  account: Account
  deleteAccount: (accountId: string) => Promise<unknown>
  confirmDelete: (message: string) => boolean
  lock: PendingLock
  setPending?: (pending: boolean) => void
}): Promise<OperationResult> {
  if (!options.confirmDelete(`Delete account "${options.account.name}"?`)) return { status: 'cancelled' }
  if (!options.lock.tryAcquire()) return { status: 'pending' }
  options.setPending?.(true)
  try {
    await options.deleteAccount(options.account.id)
    return { status: 'success' }
  } catch (cause) {
    const message = cause instanceof Error && cause.message === DELETE_ACCOUNT_REFERENCE_ERROR
      ? DELETE_ACCOUNT_REFERENCE_ERROR
      : 'Unable to delete the account. Please try again.'
    return { status: 'rejected', message }
  } finally {
    options.setPending?.(false)
    options.lock.release()
  }
}
