import { Account } from '../../../src/lib/api' // eslint-disable-line @typescript-eslint/no-unused-vars
import { Account as ModelAccount, isGiteaAccount } from '../../../src/models/account'

// The linter import above is deliberately avoided; use the model directly.

const giteaAccount = () =>
  new ModelAccount(
    'amit',
    'https://git.concreteinfo.co.in/api/v1',
    'tok',
    [],
    '',
    1,
    'Amit'
  )

const giteaAccountWithProvider = () =>
  new ModelAccount(
    'amit',
    'https://git.concreteinfo.co.in/api/v1',
    'tok',
    [],
    '',
    1,
    'Amit',
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    'gitea'
  )

describe('Account provider discriminator', () => {
  it('defaults to GitHub (not Gitea) when provider is absent', () => {
    expect(isGiteaAccount(giteaAccount())).toBe(false)
  })

  it('marks provider=gitea accounts as Gitea', () => {
    expect(isGiteaAccount(giteaAccountWithProvider())).toBe(true)
  })

  it('withToken preserves provider', () => {
    const refreshed = giteaAccountWithProvider().withToken('tok2')

    expect(refreshed.provider).toEqual('gitea')
    expect(isGiteaAccount(refreshed)).toBe(true)
    expect(refreshed.token).toEqual('tok2')
  })

  it('withToken on a GitHub account yields a non-gitea account', () => {
    const refreshed = giteaAccount().withToken('tok2')

    expect(refreshed.provider).toBeUndefined()
    expect(isGiteaAccount(refreshed)).toBe(false)
  })
})
