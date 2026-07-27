import * as React from 'react'

import { Branch } from '../../models/branch'
import { Repository } from '../../models/repository'
import { Dispatcher } from '../dispatcher'

interface ICompareWithBranchDialogProps {
  readonly dispatcher: Dispatcher
  readonly repository: Repository
  readonly branches: ReadonlyArray<Branch>
  readonly onDismissed: () => void
}

/**
 * Deferred picker — shell for the full SearchableBranchList UI.
 *
 * The original Slice 3 spec asks for a search TextBox + scrollable branch
 * list that lets the user pick which branch to compare HEAD against. The
 * minimum viable flow used today instead routes through the existing
 * History tab branch-list filter UI (`dispatcher.showHistory(false, true)`),
 * which already provides an interactive BranchList with fuzzy filtering and
 * click-to-compare. The full modal picker is deferred to a follow-up so
 * Stage 3C stays small and reuses the proven BranchList component rather
 * than duplicating its filter/selection logic in a new dialog shell.
 *
 * To upgrade to the full picker:
 *   1. Render a `<Dialog>` with a `<TextBox>` filter wired to local state.
 *   2. Filter `props.branches` against the filter text using the same
 *      fuzzy-find helper that `app/src/lib/app-state.ts` uses for the
 *      History tab branch list.
 *   3. Render each branch as a row that, on click, calls
 *      `dispatcher.openCompareView(repository, branch.name)` and then
 *      `props.onDismissed()`.
 *   4. Sort currently checked-out branches (tip matches `branchesState.tip`)
 *      to the bottom of the list.
 *   5. Mount this component via `PopupType.CompareWithBranch` in
 *      `app.tsx`'s `popupContent` switch.
 */
export class CompareWithBranchDialog extends React.Component<ICompareWithBranchDialogProps> {
  public render() {
    // Deferred picker — see the JSDoc above. Rendering an empty fragment
    // keeps the type-checker happy and lets us ship the wiring (menu event,
    // dispatcher entry point) without blocking on the picker UI.
    return <></>
  }
}
