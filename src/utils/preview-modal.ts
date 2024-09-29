import { App, Modal } from 'obsidian'
import { AnalyzedContent } from './types'

export class PreviewModal extends Modal {
	private content: AnalyzedContent
	private onConfirm: () => void

	constructor(app: App, content: AnalyzedContent, onConfirm: () => void) {
		super(app)
		this.content = content
		this.onConfirm = onConfirm
	}

	onOpen() {
		const { contentEl } = this
		contentEl.createEl('h2', { text: 'Preview Content' })

		const previewEl = contentEl.createEl('pre')
		previewEl.setText(JSON.stringify(this.content, null, 2))

		const buttonContainer = contentEl.createDiv('button-container')

		const confirmButton = buttonContainer.createEl('button', {
			text: 'Confirm',
		})
		confirmButton.addEventListener('click', () => {
			this.close()
			this.onConfirm()
		})

		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' })
		cancelButton.addEventListener('click', () => this.close())
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}

export function showPreviewToUser(
	app: App,
	content: AnalyzedContent
): Promise<boolean> {
	return new Promise(resolve => {
		new PreviewModal(app, content, () => resolve(true)).open()
	})
}
