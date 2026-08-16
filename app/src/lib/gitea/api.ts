import { Account } from '../../models/account'
import { IAPIRepository } from '../api'

/**
 * Minimal Gitea API client for the GitHub Desktop Linux fork's Gitea
 * integration (G1: account sign-in, repo browsing, cloning).
 *
 * Gitea's REST API (v1) is modeled on GitHub's, so repository payloads map
 * onto IAPIRepository with little translation. Auth uses a personal access
 * token sent via the `Authorization: token <PAT>` header.
 *
 * Spec: docs/superpowers/specs/2026-08-16-gitea-integration-design.md
 * Plan: docs/superpowers/plans/2026-08-16-gitea-g1-account-browse-clone.md
 */

const pageSize = 50

/** The subset of GET /api/v1/user the fork consumes. */
export interface IGiteaUser {
  readonly login: string
  readonly id: number
  readonly full_name: string
  readonly avatar_url: string
  readonly email: string
}

/**
 * Maps a Gitea repository payload onto the app's IAPIRepository shape.
 *
 * Gitea uses GitHub-compatible field names for these properties. The object
 * is cast to IAPIRepository because the upstream interface carries a few
 * GitHub-only fields that carry no meaning for Gitea and are left undefined;
 * consumers in the clone flow only read the fields mapped here.
 */
export function mapGiteaRepository(repo: any): IAPIRepository {
  return {
    name: repo.name,
    owner: repo.owner,
    full_name: repo.full_name,
    private: repo.private,
    html_url: repo.html_url,
    clone_url: repo.clone_url,
    fork: repo.fork,
    default_branch: repo.default_branch,
    description: repo.description,
    archived: repo.archived,
  } as IAPIRepository
}

export class GiteaAPI {
  public constructor(
    private readonly endpoint: string,
    private readonly token: string
  ) {}

  public static fromAccount(account: Account): GiteaAPI {
    return new GiteaAPI(account.endpoint, account.token)
  }

  private async request<T>(path: string): Promise<T> {
    const res = await fetch(`${this.endpoint}${path}`, {
      headers: { Authorization: `token ${this.token}` },
    })

    if (!res.ok) {
      throw new Error(
        `Gitea API request failed (${res.status}) for ${path}`
      )
    }

    return res.json() as Promise<T>
  }

  public fetchGiteaUser(): Promise<IGiteaUser> {
    return this.request<IGiteaUser>('/user')
  }

  /**
   * Streams the repositories the authenticated user has access to, one page
   * at a time. Gitea's default page size is 10, so an explicit limit is
   * always passed. Pagination stops at the first short or empty page.
   */
  public async streamUserRepositories(
    onPage: (page: ReadonlyArray<IAPIRepository>) => void
  ): Promise<void> {
    let page = 1

    for (;;) {
      const repos = await this.request<any[]>(
        `/user/repos?limit=${pageSize}&page=${page}`
      )

      if (repos.length === 0) {
        break
      }

      onPage(repos.map(mapGiteaRepository))

      if (repos.length < pageSize) {
        break
      }

      page++
    }
  }
}
