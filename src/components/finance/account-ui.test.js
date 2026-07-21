import { describe, expect, it, vi } from 'vitest'
import * as accountUi from './account-ui'
import { createPendingLock } from './finance-ui'

const persisted = {
  id: 'account-1', userId: 'user-1', name: 'Main Bank', kind: 'asset',
  openingBalanceMinor: -12345, color: '#2aa883', createdAt: '', updatedAt: '',
}

describe('account management boundary', () => {
  it('parses signed finite safe minor units with at most two decimals', () => {
    expect(accountUi.parseSignedMinorUnits).toBeTypeOf('function')
    expect(accountUi.parseSignedMinorUnits('0')).toBe(0)
    expect(accountUi.parseSignedMinorUnits('-123.45')).toBe(-12345)
    expect(accountUi.parseSignedMinorUnits('+10.5')).toBe(1050)
    for (const value of ['', '1.001', '1e3', 'Infinity', 'NaN', '900719925474099.99']) {
      expect(accountUi.parseSignedMinorUnits(value)).toBeNull()
    }
  })

  it('trims and validates name, kind, opening balance, and six-digit hex color', () => {
    expect(accountUi.accountPayloadFromDraft).toBeTypeOf('function')
    expect(accountUi.accountPayloadFromDraft({
      name: '  Main Bank  ', kind: 'asset', openingBalance: '-123.45', color: '#2Aa883',
    })).toEqual({
      payload: { name: 'Main Bank', kind: 'asset', openingBalanceMinor: -12345, color: '#2Aa883' }, error: '',
    })
    expect(accountUi.accountPayloadFromDraft({ name: ' ', kind: 'asset', openingBalance: '0', color: '#2aa883' }).error).toMatch(/name/i)
    expect(accountUi.accountPayloadFromDraft({ name: 'x'.repeat(81), kind: 'asset', openingBalance: '0', color: '#2aa883' }).error).toMatch(/80/)
    expect(accountUi.accountPayloadFromDraft({ name: 'Bank', kind: 'other', openingBalance: '0', color: '#2aa883' }).error).toMatch(/type/i)
    expect(accountUi.accountPayloadFromDraft({ name: 'Bank', kind: 'asset', openingBalance: '1.001', color: '#2aa883' }).error).toMatch(/balance/i)
    expect(accountUi.accountPayloadFromDraft({ name: 'Bank', kind: 'asset', openingBalance: '0', color: 'green' }).error).toMatch(/color/i)
  })

  it('starts edits from persisted values and orchestrates create versus update payloads', async () => {
    expect(accountUi.accountDraftFromAccount).toBeTypeOf('function')
    expect(accountUi.saveAccount).toBeTypeOf('function')
    expect(accountUi.accountDraftFromAccount(persisted)).toEqual({
      name: 'Main Bank', kind: 'asset', openingBalance: '-123.45', color: '#2aa883',
    })
    const createAccount = vi.fn().mockResolvedValue({})
    const updateAccount = vi.fn().mockResolvedValue({})
    const draft = { name: '  Savings ', kind: 'liability', openingBalance: '10.50', color: '#ABCDEF' }
    await accountUi.saveAccount({ draft, accountId: null, createAccount, updateAccount, lock: createPendingLock() })
    await accountUi.saveAccount({ draft, accountId: 'account-1', createAccount, updateAccount, lock: createPendingLock() })
    const payload = { name: 'Savings', kind: 'liability', openingBalanceMinor: 1050, color: '#ABCDEF' }
    expect(createAccount).toHaveBeenCalledWith(payload)
    expect(updateAccount).toHaveBeenCalledWith('account-1', payload)
  })

  it('rejects invalid input and duplicate submissions without another store call', async () => {
    expect(accountUi.saveAccount).toBeTypeOf('function')
    const createAccount = vi.fn()
    const updateAccount = vi.fn()
    const invalid = await accountUi.saveAccount({
      draft: { name: '', kind: 'asset', openingBalance: '0', color: '#123456' },
      accountId: null, createAccount, updateAccount, lock: createPendingLock(),
    })
    expect(invalid.status).toBe('invalid')
    expect(createAccount).not.toHaveBeenCalled()

    let finish
    createAccount.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const lock = createPendingLock()
    const options = {
      draft: { name: 'Bank', kind: 'asset', openingBalance: '0', color: '#123456' },
      accountId: null, createAccount, updateAccount, lock,
    }
    const first = accountUi.saveAccount(options)
    expect((await accountUi.saveAccount(options)).status).toBe('pending')
    expect(createAccount).toHaveBeenCalledOnce()
    finish({})
    await expect(first).resolves.toMatchObject({ status: 'success' })
  })

  it('preserves a referenced account and returns the exact friendly delete message', async () => {
    expect(accountUi.deleteAccountWithConfirmation).toBeTypeOf('function')
    const accounts = [persisted]
    const message = 'This account is used by one or more transactions and cannot be deleted.'
    const deleteAccount = vi.fn().mockRejectedValue(new Error(message))
    const confirmDelete = vi.fn().mockReturnValue(true)
    const result = await accountUi.deleteAccountWithConfirmation({
      account: persisted, deleteAccount, confirmDelete, lock: createPendingLock(),
    })
    expect(confirmDelete).toHaveBeenCalledWith('Delete account "Main Bank"?')
    expect(result).toEqual({ status: 'rejected', message })
    expect(accounts).toEqual([persisted])
  })
})
