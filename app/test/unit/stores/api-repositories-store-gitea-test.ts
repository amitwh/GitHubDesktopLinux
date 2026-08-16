import { AccountsStore } from '../../../src/lib/stores/accounts-store'
import { ApiRepositoriesStore } from '../../../src/lib/stores/api-repositories-store'
import { Account } from '../../../src/models/account'

jest.mock('../../../src/lib/gitea', () => ({
  GiteaAPI: {
    fromAccount: jest.fn().mockReturnValue({
      streamUserRepositories: jest.fn(
        async (onPage: (page: ReadonlyArray<any>) => void) => {
          onPage([
            { name: 'one', clone_url: 'https://git.example.com/amit/one.git' },
            { name: 'two', clone_url: 'https://git.example.com/amit/two.git' },
          ])
        }
      ),
    }),
  },
}))

jest.mock('../../../src/lib/api', () => ({
  API: {
    fromAccount: jest.fn(),
  },
  fetchUser: jest.fn(),
  getEnterpriseAPIURL: (endpoint: string) => endpoint,
  getDotComAPIEndpoint: () => 'https://api.github.com',
  getHTMLURL: (endpoint: string) => endpoint,
}))

const dataStore = {
  getItem: () => '',
  setItem: () => {},
}

const secureStore = {
  getItem: async () => 'tk',
  setItem: async () => {},
  deleteItem: async () => {},
}

const giteaAccount = new Account(
  'amit',
  'https://git.example.com/api/v1',
  'tk',
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

describe('ApiRepositoriesStore — gitea dispatch', () => {
  it('loads repositories through GiteaAPI for gitea accounts', async () => {
    const accountsStore = new AccountsStore(
      dataStore as any,
      secureStore as any
    )
    const store = new ApiRepositoriesStore(accountsStore)

    await store.loadRepositories(giteaAccount)

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GiteaAPI } = require('../../../src/lib/gitea')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { API } = require('../../../src/lib/api')

    expect(GiteaAPI.fromAccount).toHaveBeenCalled()
    expect(API.fromAccount).not.toHaveBeenCalled()

    const state = store.getState().get(giteaAccount)
    expect(state?.loading).toBe(false)
    expect(state?.repositories).toHaveLength(2)
    expect(state?.repositories[0].clone_url).toEqual(
      'https://git.example.com/amit/one.git'
    )
  })
})
