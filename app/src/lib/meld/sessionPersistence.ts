import { IMeldEditState } from '../../models/meld-edit'

/**
 * In-memory cache of live edits for active Meld sessions, keyed by
 * `${repositoryID}:${filePath}:${mode}`. The cache holds optimistic
 * edits only — they become real on disk only when the user clicks
 * Save, which delegates to the dispatcher and writes through git.
 *
 * No localStorage / disk persistence in 1b. Closing the Meld window
 * without saving is treated as a Discard.
 */
export class MeldSessionPersistence {
  /**
   * Compose the cache key for a given (repository, file, mode) tuple.
   * Exposed as a static method so callers (and tests) can compute the
   * same key without having to instantiate the persistence.
   */
  public static keyFor(
    repositoryID: number,
    filePath: string,
    mode: 'working' | 'commit' | 'merge'
  ): string {
    return `${repositoryID}:${filePath}:${mode}`
  }

  private readonly sessions = new Map<string, IMeldEditState>()

  public getEditState(key: string): IMeldEditState | undefined {
    return this.sessions.get(key)
  }

  public setEditState(key: string, state: IMeldEditState): void {
    this.sessions.set(key, state)
  }

  public clearEditState(key: string): void {
    this.sessions.delete(key)
  }

  /** Test/diagnostic helper. Not part of the public production API. */
  public _size(): number {
    return this.sessions.size
  }
}
