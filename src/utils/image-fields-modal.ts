import { App, Modal, Setting, TFile, TFolder, Notice } from 'obsidian'
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
		console.log('ImageFieldsModal constructed with fields:', imageFields)
	}

	async onOpen() {
		console.log('ImageFieldsModal opened')
		const { contentEl } = this

		contentEl.createEl('h2', { text: 'Fill Image Fields' })

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
						console.log(`Dropdown changed for ${field}. Selected value:`, value)
						if (value) {
							const file = this.app.vault.getAbstractFileByPath(value)
							console.log('Retrieved file:', file)
							if (file instanceof TFile) {
								console.log(`Uploading file: ${file.path}`)
								const uploadedImage = await uploadImageToStrapi(
									file.path, // Passez le chemin du fichier au lieu du TFile
									file.name,
									this.settings,
									this.app
								)
								if (uploadedImage) {
									console.log(
										`Image uploaded successfully. URL:`,
										uploadedImage.url
									)
									this.imageValues[field] = uploadedImage.url
								} else {
									console.error(`Failed to upload image for ${field}`)
								}
							} else {
								console.error(`Selected file is not a TFile:`, file)
							}
						} else {
							console.log(`No image selected for ${field}`)
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
		if (uploadedImage) {
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
		if (uploadedImage) {
			console.log(
				`Gallery image uploaded successfully. URL:`,
				uploadedImage.url
			)
			if (!this.imageValues[field]) {
				this.imageValues[field] = []
			}
			if (Array.isArray(this.imageValues[field])) {
				;(this.imageValues[field] as string[]).push(uploadedImage.url)
			}
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
