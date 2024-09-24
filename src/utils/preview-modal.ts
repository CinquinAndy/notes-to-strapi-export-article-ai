import { Modal, App } from 'obsidian'

export class PreviewModal extends Modal {
	constructor(
		app: App,
		private content: any,
		private onConfirm: () => void
	) {
		super(app)
	}

	onOpen() {
		const { contentEl } = this
		contentEl.createEl('h2', {
			text: 'Preview of content to be sent to Strapi',
		})

		const pre = contentEl.createEl('pre')
		pre.setText(JSON.stringify(this.content, null, 2))
		pre.style.maxHeight = '400px'
		pre.style.overflow = 'auto'

		const buttonContainer = contentEl.createDiv('button-container')

		const confirmButton = buttonContainer.createEl('button', {
			text: 'Confirm and Send',
		})
		confirmButton.addEventListener('click', () => {
			this.close()
			this.onConfirm()
		})

		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' })
		cancelButton.addEventListener('click', () => {
			this.close()
		})
	}
}
