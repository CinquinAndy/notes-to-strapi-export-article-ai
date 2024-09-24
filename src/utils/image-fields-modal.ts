import { App, Modal, Setting, TFile, TFolder } from 'obsidian'
import { uploadImageToStrapi } from './strapi-uploader'
import { StrapiExporterSettings } from '../types/settings'

export class ImageFieldsModal extends Modal {
	imageFields: string[]
	onSubmit: (imageValues: Record<string, string | string[]>) => void
	imageValues: Record<string, string | string[]> = {}
	app: App
	settings: StrapiExporterSettings

	constructor(
		app: App,
		imageFields: string[],
		onSubmit: (imageValues: Record<string, string | string[]>) => void,
		settings: StrapiExporterSettings
	) {
		super(app)
		this.app = app
		this.imageFields = imageFields
		this.onSubmit = onSubmit
		this.settings = settings
	}

	async onOpen() {
		const { contentEl } = this

		contentEl.createEl('h2', { text: 'Fill Image Fields' })

		for (const field of this.imageFields) {
			const setting = new Setting(contentEl)
				.setName(field)
				.addDropdown(async dropdown => {
					const images = await this.getImagesInRepo()
					dropdown.addOption('', 'Select an image')
					images.forEach(img => dropdown.addOption(img.path, img.name))
					dropdown.onChange(async value => {
						if (value) {
							const file = this.app.vault.getAbstractFileByPath(value)
							if (file instanceof TFile) {
								const uploadedImage = await uploadImageToStrapi(
									file,
									this.app,
									this.settings
								)
								if (uploadedImage) {
									this.imageValues[field] = uploadedImage.url
								}
							}
						}
					})
				})
				.addButton(btn =>
					btn
						.setButtonText('Upload New')
						.onClick(() => this.uploadNewImage(field))
				)

			if (field.toLowerCase().includes('gallery')) {
				setting.addButton(btn =>
					btn
						.setButtonText('Add to Gallery')
						.onClick(() => this.addToGallery(field))
				)
			}
		}

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

	async getImagesInRepo(): Promise<TFile[]> {
		const images: TFile[] = []
		const recurse = (folder: TFolder) => {
			folder.children.forEach(child => {
				if (
					child instanceof TFile &&
					child.extension.match(/png|jpe?g|gif|svg|webp/i)
				) {
					images.push(child)
				} else if (child instanceof TFolder) {
					recurse(child)
				}
			})
		}
		recurse(this.app.vault.getRoot())
		return images
	}

	async uploadNewImage(field: string) {
		const file = await this.app.fileManager.getNewFileParent('')
		const newFile = await this.app.vault.create(`${file.path}/${field}.png`, '')
		const uploadedImage = await uploadImageToStrapi(
			newFile,
			this.app,
			this.settings
		)
		if (uploadedImage) {
			this.imageValues[field] = uploadedImage.url
		}
	}

	async addToGallery(field: string) {
		const file = await this.app.fileManager.getNewFileParent('')
		const newFile = await this.app.vault.create(
			`${file.path}/gallery_${Date.now()}.png`,
			''
		)
		const uploadedImage = await uploadImageToStrapi(
			newFile,
			this.app,
			this.settings
		)
		if (uploadedImage) {
			if (!this.imageValues[field]) {
				this.imageValues[field] = []
			}
			if (Array.isArray(this.imageValues[field])) {
				// no prettier
				// @ts-ignore
				// prettier-ignore
				;(this.imageValues[field] as string[]).push(uploadedImage.url)
			}
		}
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}
