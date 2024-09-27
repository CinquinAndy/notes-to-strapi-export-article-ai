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
		console.log('16. ImageFieldsModal constructed with fields:', imageFields)
	}

	async onOpen() {
		console.log('17. ImageFieldsModal opened')
		const { contentEl } = this

		contentEl.createEl('h2', { text: 'Fill Image Fields' })

		for (const field of this.imageFields) {
			console.log(`18. Creating setting for field: ${field}`)
			const setting = new Setting(contentEl)
				.setName(field)
				.addDropdown(async dropdown => {
					console.log(`19. Populating dropdown for field: ${field}`)
					const images = await this.getImagesInRepo()
					console.log(`20. Found ${images.length} images in repo`)
					dropdown.addOption('', 'Select an image')
					images.forEach(img => {
						console.log(`21. Adding option: ${img.path}`)
						dropdown.addOption(img.path, img.name)
					})
					dropdown.onChange(async value => {
						console.log(
							`22. Dropdown changed for ${field}. Selected value:`,
							value
						)
						if (value) {
							const file = this.app.vault.getAbstractFileByPath(value)
							console.log('23. Retrieved file:', file)
							if (file instanceof TFile) {
								console.log(`24. Uploading file: ${file.path}`)
								const uploadedImage = await uploadImageToStrapi(
									file.path,
									file.name,
									this.settings,
									this.app
								)
								if (uploadedImage && uploadedImage.url) {
									console.log(
										`25. Image uploaded successfully. URL:`,
										uploadedImage.url
									)
									this.imageValues[field] = uploadedImage.url
								} else {
									console.error(`26. Failed to upload image for ${field}`)
								}
							} else {
								console.error(`27. Selected file is not a TFile:`, file)
							}
						} else {
							console.log(`28. No image selected for ${field}`)
						}
					})
				})
				.addButton(btn =>
					btn.setButtonText('Upload New').onClick(() => {
						console.log(`29. Upload New clicked for ${field}`)
						this.uploadNewImage(field)
					})
				)

			if (field.toLowerCase().includes('gallery')) {
				setting.addButton(btn =>
					btn.setButtonText('Add to Gallery').onClick(() => {
						console.log(`30. Add to Gallery clicked for ${field}`)
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
					console.log(
						'31. Submit button clicked. Image values:',
						this.imageValues
					)
					this.close()
					this.onSubmit(this.imageValues)
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

	async uploadNewImage(field: string) {
		console.log(`35. Uploading new image for ${field}`)
		const file = await this.app.fileManager.getNewFileParent('')
		console.log(`36. New file parent: ${file.path}`)
		const newFile = await this.app.vault.create(`${file.path}/${field}.png`, '')
		console.log(`37. New file created: ${newFile.path}`)
		const uploadedImage = await uploadImageToStrapi(
			newFile,
			newFile.name,
			this.settings,
			this.app
		)
		if (uploadedImage && uploadedImage.url) {
			console.log(
				`38. New image uploaded successfully. URL:`,
				uploadedImage.url
			)
			this.imageValues[field] = uploadedImage.url
		} else {
			console.error(`39. Failed to upload new image for ${field}`)
		}
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
