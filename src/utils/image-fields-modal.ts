import { App, Modal, Setting } from 'obsidian'

export class ImageFieldsModal extends Modal {
	imageFields: string[]
	onSubmit: (imageValues: Record<string, string>) => void
	imageValues: Record<string, string> = {}

	constructor(
		app: App,
		imageFields: string[],
		onSubmit: (imageValues: Record<string, string>) => void
	) {
		super(app)
		this.imageFields = imageFields
		this.onSubmit = onSubmit
	}

	onOpen() {
		const { contentEl } = this

		contentEl.createEl('h2', { text: 'Fill Image Fields' })

		this.imageFields.forEach(field => {
			new Setting(contentEl).setName(field).addText(text =>
				text
					.setPlaceholder('Enter image URL or drag & drop image')
					.onChange(value => {
						this.imageValues[field] = value
					})
			)
		})

		new Setting(contentEl).addButton(btn =>
			btn
				.setButtonText('Submit')
				.setCta()
				.onClick(() => {
					this.close()
					this.onSubmit(this.imageValues)
				})
		)
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}
