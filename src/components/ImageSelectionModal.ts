import { App, Modal, Setting } from 'obsidian'

export class ImageSelectionModal extends Modal {
	private selectedImages: string[] = []
	private onConfirm: (images: string[]) => void
	private isMultiple: boolean

	constructor(
		app: App,
		isMultiple: boolean,
		onConfirm: (images: string[]) => void
	) {
		super(app)
		this.isMultiple = isMultiple
		this.onConfirm = onConfirm
	}

	onOpen() {
		const { contentEl } = this
		contentEl.empty()

		contentEl.createEl('h2', {
			text: this.isMultiple ? 'Select Images' : 'Select an Image',
		})

		new Setting(contentEl)
			.setName('Image Selection')
			.setDesc(
				this.isMultiple ? 'Choose one or more images' : 'Choose an image'
			)
			.addButton(button =>
				button
					.setButtonText('Select Image(s)')
					.onClick(() => this.openFilePicker())
			)

		new Setting(contentEl).addButton(button =>
			button
				.setButtonText('Confirm')
				.setCta()
				.onClick(() => {
					this.close()
					this.onConfirm(this.selectedImages)
				})
		)
	}

	private async openFilePicker() {
		// Implement file picking logic here
		// This could use Obsidian's file suggestion API or a custom file browser
		// Update this.selectedImages with the chosen file path(s)
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}
