import { GiteaAPI, mapGiteaRepository } from '../../../src/lib/gitea'

const endpoint = 'https://git.example.com/api/v1'

const giteaUser = {
  login: 'amit',
  id: 1,
  full_name: 'Amit Haridas',
  avatar_url: 'https://git.example.com/avatars/1',
  email: 'a@b.c',
}

const giteaRepo = {
  name: 'demo',
  full_name: 'amit/demo',
  clone_url: 'https://git.example.com/amit/demo.git',
  html_url: 'https://git.example.com/amit/demo',
  private: false,
  fork: false,
  description: 'a demo repo',
  default_branch: 'main',
  archived: false,
  owner: { login: 'amit', id: 1, avatar_url: '' },
}

const ok = (data: any) => ({
  ok: true,
  status: 200,
  json: async () => data,
})

describe('GiteaAPI', () => {
  let fetchMock: jest.Mock

  beforeEach(() => {
    fetchMock = jest.fn()
    ;(global as any).fetch = fetchMock
  })

  afterEach(() => {
    delete (global as any).fetch
  })

  describe('fetchGiteaUser', () => {
    it('GETs /user with token auth', async () => {
      fetchMock.mockResolvedValueOnce(ok(giteaUser))

      const user = await new GiteaAPI(endpoint, 'tok').fetchGiteaUser()

      expect(fetchMock).toHaveBeenCalledWith(
        `${endpoint}/user`,
        { headers: { Authorization: 'token tok' } }
      )
      expect(user.login).toEqual('amit')
      expect(user.full_name).toEqual('Amit Haridas')
    })

    it('throws with status code on non-ok responses', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })

      await expect(
        new GiteaAPI(endpoint, 'tok').fetchGiteaUser()
      ).rejects.toThrow('401')
    })
  })

  describe('streamUserRepositories', () => {
    it('pages until a short page and maps each page', async () => {
      const fullPage = Array.from({ length: 50 }, (_, i) => ({
        ...giteaRepo,
        name: `repo-${i}`,
        full_name: `amit/repo-${i}`,
      }))
      fetchMock
        .mockResolvedValueOnce(ok(fullPage))
        .mockResolvedValueOnce(ok([giteaRepo]))

      const pages = new Array<ReadonlyArray<any>>()
      await new GiteaAPI(endpoint, 'tok').streamUserRepositories(page =>
        pages.push(page as ReadonlyArray<any>)
      )

      expect(pages).toHaveLength(2)
      expect(pages[0]).toHaveLength(50)
      expect(pages[1]).toHaveLength(1)
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        `${endpoint}/user/repos?limit=50&page=1`,
        expect.anything()
      )
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        `${endpoint}/user/repos?limit=50&page=2`,
        expect.anything()
      )
    })

    it('stops after the first short page without requesting another', async () => {
      fetchMock.mockResolvedValueOnce(ok([giteaRepo]))

      const pages = new Array<ReadonlyArray<any>>()
      await new GiteaAPI(endpoint, 'tok').streamUserRepositories(page =>
        pages.push(page as ReadonlyArray<any>)
      )

      expect(pages).toHaveLength(1)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('mapGiteaRepository', () => {
    it('maps GitHub-compatible fields', () => {
      const mapped = mapGiteaRepository(giteaRepo)

      expect(mapped.name).toEqual('demo')
      expect(mapped.clone_url).toContain('demo.git')
      expect(mapped.html_url).toEqual('https://git.example.com/amit/demo')
      expect(mapped.private).toBeFalse()
      expect((mapped as any).owner.login).toEqual('amit')
      expect((mapped as any).default_branch).toEqual('main')
    })
  })
})
