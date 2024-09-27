import { App, Modal, Notice, Setting, TFile, TFolder } from 'obsidian'
import { uploadImageToStrapi } from './strapi-uploader'
import { StrapiExporterSettings } from '../types/settings'

export class ImageFieldsModal extends Modal {
	imageFields: string[]
	onSubmit: (imageValues: Record<string, string | string[]>) => void
	imageValues: Record<string, string | string[]> = {}
	app: App
	settings: StrapiExporterSettings
	imagePreviewEl: HTMLElement

	constructor(
		app: App,
		imageFields: string[],
		onSubmit: (imageValues: Record<string, string | string[]>) => void,
		settings: StrapiExporterSettings,
		existingValues: Record<string, string>
	) {
		super(app)
		this.app = app
		this.imageFields = imageFields
		this.onSubmit = onSubmit
		this.settings = settings
		this.imageValues = { ...existingValues }
		console.log('ImageFieldsModal constructed with fields:', imageFields)
	}

	async onOpen() {
		const { contentEl } = this
		contentEl.empty()
		console.log('ImageFieldsModal opened')

		contentEl.createEl('h2', { text: 'Fill Image Fields' })

		this.imagePreviewEl = contentEl.createEl('div', { cls: 'image-preview' })

		for (const field of this.imageFields) {
			console.log(`Creating setting for field: ${field}`)
			const setting = new Setting(contentEl)
				.setName(field)
				.addDropdown(async dropdown => {
					console.log(`Populating dropdown for field: ${field}`)
					const images = await this.getImagesInRepo()
					console.log(`Found ${images.length} images in repo`)
					dropdown.addOption('', 'Select an image')
					images.forEach(img => {
						console.log(`Adding option: ${img.path}`)
						dropdown.addOption(img.path, img.name)
					})
					dropdown.onChange(async value => {
						if (value) {
							const file = this.app.vault.getAbstractFileByPath(value)
							if (file instanceof TFile) {
								const uploadedImage = await uploadImageToStrapi(
									file,
									file.name,
									this.settings,
									this.app
								)
								if (uploadedImage && uploadedImage.url) {
									this.imageValues[field] = uploadedImage.url
									this.updateImagePreview(uploadedImage.url)
								}
							}
						} else {
							delete this.imageValues[field]
							this.updateImagePreview('')
						}
					})
				})
				.addButton(btn =>
					btn.setButtonText('Upload New').onClick(() => {
						console.log(`Upload New clicked for ${field}`)
						this.uploadNewImage(field)
					})
				)

			if (field.toLowerCase().includes('gallery')) {
				setting.addButton(btn =>
					btn.setButtonText('Add to Gallery').onClick(() => {
						console.log(`Add to Gallery clicked for ${field}`)
						this.addToGallery(field)
					})
				)
			}
		}

		new Setting(contentEl).addButton(btn =>
			btn
				.setButtonText('Submit')
				.setCta()
				.onClick(() => {
					console.log('Submit button clicked. Image values:', this.imageValues)
					this.close()
					this.onSubmit(this.imageValues)
				})
		)
	}

	async getImagesInRepo(): Promise<TFile[]> {
		console.log('Getting images in repo')
		const images: TFile[] = []
		const recurse = (folder: TFolder) => {
			folder.children.forEach(child => {
				if (
					child instanceof TFile &&
					child.extension.match(/png|jpe?g|gif|svg|bmp|webp/i)
				) {
					console.log(`Found image: ${child.path}`)
					images.push(child)
				} else if (child instanceof TFolder) {
					recurse(child)
				}
			})
		}
		recurse(this.app.vault.getRoot())
		console.log(`Total images found: ${images.length}`)
		return images
	}

	updateImagePreview(url: string) {
		this.imagePreviewEl.empty()
		if (url) {
			this.imagePreviewEl.createEl('img', {
				attr: {
					src: url,
					alt: 'Preview',
					style: 'max-width: 200px; max-height: 200px;',
				},
			})
		}
	}

	async uploadNewImage(field: string) {
		console.log(`Uploading new image for ${field}`)
		const file = await this.app.fileManager.getNewFileParent('')
		console.log(`New file parent: ${file.path}`)
		const newFile = await this.app.vault.create(`${file.path}/${field}.png`, '')
		console.log(`New file created: ${newFile.path}`)
		const uploadedImage = await uploadImageToStrapi(
			newFile,
			newFile.name,
			this.settings,
			this.app
		)
		if (uploadedImage && uploadedImage.url) {
			console.log(`New image uploaded successfully. URL:`, uploadedImage.url)
			this.imageValues[field] = uploadedImage.url
		} else {
			console.error(`Failed to upload new image for ${field}`)
		}
	}

	async addToGallery(field: string) {
		console.log(`Adding to gallery for ${field}`)
		const file = await this.app.fileManager.getNewFileParent('')
		console.log(`New file parent for gallery: ${file.path}`)
		const newFile = await this.app.vault.create(
			`${file.path}/gallery_${Date.now()}.png`,
			''
		)
		console.log(`New gallery file created: ${newFile.path}`)
		const uploadedImage = await uploadImageToStrapi(
			newFile,
			newFile.name,
			this.settings,
			this.app
		)
		if (uploadedImage && uploadedImage.url) {
			console.log(
				`Gallery image uploaded successfully. URL:`,
				uploadedImage.url
			)
			if (!Array.isArray(this.imageValues[field])) {
				this.imageValues[field] = []
			}
			;(this.imageValues[field] as string[]).push(uploadedImage.url)
		} else {
			console.error(`Failed to upload gallery image for ${field}`)
		}
	}

	onClose() {
		console.log('ImageFieldsModal closed')
		const { contentEl } = this
		contentEl.empty()
	}
}
