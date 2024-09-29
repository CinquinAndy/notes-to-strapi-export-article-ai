import { App, Modal, Notice, Setting, TFile, TFolder } from 'obsidian'
import { uploadImageToStrapi } from './strapi-uploader'
import { StrapiExporterSettings } from '../types/settings'
import OpenAI from 'openai'

export class ImageFieldsModal extends Modal {
	imageFields: string[]
	onSubmit: (imageValues: Record<string, string | string[]>) => void
	imageValues: Record<string, string | string[]> = {}
	app: App
	settings: StrapiExporterSettings

	constructor(
		app: App,
		imageFields: string[],
		onSubmit: (imageValues: Record<string, string>) => void,
		settings: StrapiExporterSettings
	) {
		super(app)
		this.app = app
		this.imageFields = imageFields
		this.onSubmit = onSubmit
		this.settings = settings
		this.imageValues = {}
	}

	async onOpen() {
		console.log('16. ImageFieldsModal opened')
		const { contentEl } = this
		contentEl.empty()

		contentEl.createEl('h2', { text: 'Select Images for Fields' })

		for (const field of this.imageFields) {
			this.createImageField(contentEl, field)
		}

		new Setting(contentEl).addButton(btn =>
			btn
				.setButtonText('Submit')
				.setCta()
				.onClick(() => {
					console.log(
						'29. Submit button clicked. Image values:',
						this.imageValues
					)
					this.close()
					this.onSubmit(this.imageValues)
				})
		)
	}

	private createImageField(containerEl: HTMLElement, field: string) {
		const setting = new Setting(containerEl)
			.setName(field)
			.setDesc(`Select an image for ${field}`)

		setting.addDropdown(async dropdown => {
			console.log(`18. Populating dropdown for field: ${field}`)
			const images = await this.getImagesInRepo()
			console.log(`19. Found ${images.length} images in repo`)
			dropdown.addOption('', 'Select an image')
			images.forEach(img => {
				console.log(`20. Adding option: ${img.path}`)
				dropdown.addOption(img.path, img.name)
			})
			dropdown.onChange(value => {
				console.log(`21. Dropdown changed for ${field}. Selected value:`, value)
				if (value) {
					this.imageValues[field] = value
					console.log(
						`22. Updated imageValues for ${field}:`,
						this.imageValues[field]
					)
				} else {
					console.log(`23. No image selected for ${field}`)
					delete this.imageValues[field]
				}
			})
		})

		setting.addButton(btn =>
			btn.setButtonText('Upload New').onClick(() => {
				console.log(`24. Upload New clicked for ${field}`)
				this.uploadNewImage(field)
			})
		)
	}

	async getImagesInRepo(): Promise<TFile[]> {
		console.log('32. Getting images in repo')
		const images: TFile[] = []
		const recurse = (folder: TFolder) => {
			folder.children.forEach(child => {
				if (
					child instanceof TFile &&
					child.extension.match(/png|jpe?g|gif|svg|bmp|webp/i)
				) {
					console.log(`33. Found image: ${child.path}`)
					images.push(child)
				} else if (child instanceof TFolder) {
					recurse(child)
				}
			})
		}
		recurse(this.app.vault.getRoot())
		console.log(`34. Total images found: ${images.length}`)
		return images
	}

	private async handleImageSelection(field: string, value: string) {
		const file = this.app.vault.getAbstractFileByPath(value)
		console.log('24. Retrieved file:', file)
		if (file instanceof TFile) {
			console.log(`25. Uploading file: ${file.path}`)
			const uploadedImage = await uploadImageToStrapi(
				file.path,
				file.name,
				this.settings,
				this.app
			)
			if (uploadedImage && uploadedImage.url) {
				console.log(`26. Image uploaded successfully. URL:`, uploadedImage.url)
				this.imageValues[field] = uploadedImage.url
			} else {
				console.error(`27. Failed to upload image for ${field}`)
			}
		} else {
			console.error(`28. Selected file is not a TFile:`, file)
		}
	}

	private async uploadNewImage(field: string) {
		console.log(`25. Uploading new image for ${field}`)
		const file = await this.app.fileManager.getNewFileParent('')
		console.log(`26. New file parent: ${file.path}`)
		const newFile = await this.app.vault.create(`${file.path}/${field}.png`, '')
		console.log(`27. New file created: ${newFile.path}`)
		this.imageValues[field] = newFile.path
		console.log(
			`28. Updated imageValues for ${field}:`,
			this.imageValues[field]
		)
	}

	async addToGallery(field: string) {
		console.log(`40. Adding to gallery for ${field}`)
		const file = await this.app.fileManager.getNewFileParent('')
		console.log(`41. New file parent for gallery: ${file.path}`)
		const newFile = await this.app.vault.create(
			`${file.path}/gallery_${Date.now()}.png`,
			''
		)
		console.log(`42. New gallery file created: ${newFile.path}`)
		const uploadedImage = await uploadImageToStrapi(
			newFile,
			newFile.name,
			this.settings,
			this.app
		)
		if (uploadedImage && uploadedImage.url) {
			console.log(
				`43. Gallery image uploaded successfully. URL:`,
				uploadedImage.url
			)
			if (!Array.isArray(this.imageValues[field])) {
				this.imageValues[field] = []
			}
			;(this.imageValues[field] as string[]).push(uploadedImage.url)
		} else {
			console.error(`44. Failed to upload gallery image for ${field}`)
		}
	}

	onClose() {
		console.log('45. ImageFieldsModal closed')
		const { contentEl } = this
		contentEl.empty()
	}
}
