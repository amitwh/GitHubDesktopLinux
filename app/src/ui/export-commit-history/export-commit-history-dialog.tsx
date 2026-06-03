import * as React from 'react'
import { Dialog, DialogContent, DialogFooter, DialogError } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { Select } from '../lib/select'
import { Row } from '../lib/row'
import { Dispatcher } from '../dispatcher'
import { Repository } from '../../models/repository'
import {
  exportCommitHistory,
  PandocFormat,
} from '../../lib/commit-export'

interface IExportCommitHistoryDialogProps {
  readonly dispatcher: Dispatcher
  readonly repository: Repository
  readonly onDismissed: () => void
}

interface IExportCommitHistoryDialogState {
  readonly format: PandocFormat
  readonly includeHash: boolean
  readonly includeAuthor: boolean
  readonly includeDate: boolean
  readonly includeMessage: boolean
  readonly includeStats: boolean
  readonly isExporting: boolean
  readonly exportError: Error | null
}

const formats: Array<{ label: string; value: PandocFormat }> = [
  { label: 'Markdown (.md)', value: 'markdown' as PandocFormat },
  { label: 'PDF (.pdf)', value: 'pdf' },
  { label: 'Word (.docx)', value: 'docx' },
  { label: 'HTML (.html)', value: 'html' },
  { label: 'ODT (.odt)', value: 'odt' },
]

export class ExportCommitHistoryDialog extends React.Component<
  IExportCommitHistoryDialogProps,
  IExportCommitHistoryDialogState
> {
  public constructor(props: IExportCommitHistoryDialogProps) {
    super(props)

    this.state = {
      format: 'pdf',
      includeHash: true,
      includeAuthor: true,
      includeDate: true,
      includeMessage: true,
      includeStats: false,
      isExporting: false,
      exportError: null,
    }
  }

  private onFormatChange = (event: React.FormEvent<HTMLSelectElement>) => {
    const value = event.currentTarget.value as PandocFormat
    this.setState({ format: value })
  }

  private onIncludeHashChange = (event: React.FormEvent<HTMLInputElement>) => {
    this.setState({ includeHash: event.currentTarget.checked })
  }

  private onIncludeAuthorChange = (event: React.FormEvent<HTMLInputElement>) => {
    this.setState({ includeAuthor: event.currentTarget.checked })
  }

  private onIncludeDateChange = (event: React.FormEvent<HTMLInputElement>) => {
    this.setState({ includeDate: event.currentTarget.checked })
  }

  private onIncludeMessageChange = (event: React.FormEvent<HTMLInputElement>) => {
    this.setState({ includeMessage: event.currentTarget.checked })
  }

  private onIncludeStatsChange = (event: React.FormEvent<HTMLInputElement>) => {
    this.setState({ includeStats: event.currentTarget.checked })
  }

  private onExport = async () => {
    const { repository } = this.props
    const {
      format,
      includeHash,
      includeAuthor,
      includeDate,
      includeMessage,
      includeStats,
    } = this.state

    this.setState({ isExporting: true, exportError: null })

    try {
      const { ipcRenderer } = await import('../../lib/ipc-renderer')
      const outputPath: string | undefined = await ipcRenderer.invoke(
        'show-save-dialog',
        {
          defaultPath: `${repository.name}-commits.${format === 'markdown' ? 'md' : format}`,
          filters: [
            { name: 'All Files', extensions: ['*'] },
          ],
        }
      )

      if (outputPath === undefined) {
        this.setState({ isExporting: false })
        return
      }

      await exportCommitHistory(repository, {
        format,
        outputPath,
        includeHash,
        includeAuthor,
        includeDate,
        includeMessage,
        includeStats,
      })

      this.props.onDismissed()
    } catch (err) {
      this.setState({ isExporting: false, exportError: err as Error })
    }
  }

  public render() {
    const {
      format,
      includeHash,
      includeAuthor,
      includeDate,
      includeMessage,
      includeStats,
      isExporting,
      exportError,
    } = this.state

    return (
      <Dialog
        id="export-commit-history"
        title={__DARWIN__ ? 'Export Commit History' : 'Export commit history'}
        onDismissed={this.props.onDismissed}
        onSubmit={this.onExport}
        loading={isExporting}
      >
        <DialogContent>
          <Row>
            <Select label="Format" value={format} onChange={this.onFormatChange}>
              {formats.map(f => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </Row>

          <Row>
            <Checkbox
              label="Include commit hash"
              value={includeHash ? CheckboxValue.On : CheckboxValue.Off}
              onChange={this.onIncludeHashChange}
            />
          </Row>

          <Row>
            <Checkbox
              label="Include author"
              value={includeAuthor ? CheckboxValue.On : CheckboxValue.Off}
              onChange={this.onIncludeAuthorChange}
            />
          </Row>

          <Row>
            <Checkbox
              label="Include date"
              value={includeDate ? CheckboxValue.On : CheckboxValue.Off}
              onChange={this.onIncludeDateChange}
            />
          </Row>

          <Row>
            <Checkbox
              label="Include commit message"
              value={includeMessage ? CheckboxValue.On : CheckboxValue.Off}
              onChange={this.onIncludeMessageChange}
            />
          </Row>

          <Row>
            <Checkbox
              label="Include diff stats"
              value={includeStats ? CheckboxValue.On : CheckboxValue.Off}
              onChange={this.onIncludeStatsChange}
            />
          </Row>

          {exportError && (
            <DialogError>{exportError.message}</DialogError>
          )}
        </DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={isExporting ? 'Exporting…' : 'Export'}
            okButtonDisabled={isExporting}
            onCancelButtonClick={this.props.onDismissed}
            onOkButtonClick={this.onExport}
          />
        </DialogFooter>
      </Dialog>
    )
  }
}
