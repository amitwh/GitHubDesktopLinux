import { AccountsStore } from '../../../src/lib/stores/accounts-store'
import { isGiteaAccount } from '../../../src/models/account'

jest.mock('../../../src/lib/api', () => ({
  API: {
    fromAccount: jest.fn(),
  },
  fetchUser: jest.fn(async () => {
    throw new Error('fetchUser must not be called for gitea accounts')
  }),
  getEnterpriseAPIURL: (endpoint: string) => endpoint,
  getDotComAPIEndpoint: () => 'https://api.github.com',
  getHTMLURL: (endpoint: string) => endpoint,
}))

jest.mock('../../../src/lib/gitea', () => ({
  GiteaAPI: jest.fn().mockImplementation(() => ({
    fetchGiteaUser: jest.fn(async () => ({
      login: 'amit',
      id: 1,
      full_name: 'Amit Haridas',
      avatar_url: 'https://git.example.com/avatars/1',
      email: 'amit@example.com',
    })),
  })),
}))

const users = JSON.stringify([
  {
    token: '',
    login: 'amit',
    endpoint: 'https://git.example.com/api/v1',
    emails: [],
    avatarURL: '',
    id: 1,
    name: 'old name',
    provider: 'gitea',
  },
])

const dataStore = {
  getItem: () => users,
  setItem: jest.fn(),
}

const secureStore = {
  getItem: async () => 'tk',
  setItem: async () => {},
  deleteItem: async () => {},
}

describe('AccountsStore — gitea persistence + refresh', () => {
  it('restores the provider flag from storage (persistence round-trip)', async () => {
    const store = new AccountsStore(dataStore as any, secureStore as any)
    const accounts = await store.getAll()

    expect(accounts).toHaveLength(1)
    expect(isGiteaAccount(accounts[0])).toBe(true)
    expect(accounts[0].login).toEqual('amit')
  })

  it('refreshes gitea accounts via GiteaAPI instead of fetchUser', async () => {
    const store = new AccountsStore(dataStore as any, secureStore as any)

    await store.refresh()

    const accounts = await store.getAll()
    expect(accounts).toHaveLength(1)
    expect(isGiteaAccount(accounts[0])).toBe(true)
    expect(accounts[0].name).toEqual('Amit Haridas')

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fetchUser } = require('../../../src/lib/api')
    expect(fetchUser).not.toHaveBeenCalled()
  })
})
