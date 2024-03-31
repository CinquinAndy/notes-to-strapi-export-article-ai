import {
	App,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	TFolder,
} from 'obsidian'
import {
	DEFAULT_STRAPI_EXPORTER_SETTINGS,
	StrapiExporterSettings,
} from './settings/strapiExporterSettings'
import { OpenAI } from 'openai'
import { checkSettings } from './settings/settingsUtils'
import {
	extractImagePaths,
	hasUnexportedImages,
	replaceImagePaths,
} from './utils/markdownUtils'
import { getImageDescription } from './api/openaiAPI'
import { uploadImagesToStrapi } from './api/strapiAPI'
import {
	getGaleryImageBlobs,
	getImageBlob,
	getImageBlobs,
} from './utils/imageUtils'

/**
 * The main plugin class
 */
export default class StrapiExporterPlugin extends Plugin {
	settings: StrapiExporterSettings

	/**
	 * The main entry point for the plugin
	 */
	async onload() {
		await this.loadSettings()

		/**
		 * Add a ribbon icon to the Markdown view (the little icon on the left side bar)
		 */
		const ribbonIconEl = this.addRibbonIcon(
			'upload',
			'Upload images to Strapi and update links in Markdown content, then generate article content using OpenAI',
			async (evt: MouseEvent) => {
				await this.processMarkdownContent()
			}
		)
		ribbonIconEl.addClass('strapi-exporter-ribbon-class')

		/**
		 * Add an additional ribbon icon based on the settings
		 */
		if (this.settings.enableAdditionalApiCall) {
			const additionalRibbonIconEl = this.addRibbonIcon(
				'link',
				'Upload images to Strapi and update links in Markdown content, then generate additional content using OpenAI',
				async (evt: MouseEvent) => {
					await this.processMarkdownContent(true)
				}
			)
			additionalRibbonIconEl.addClass('strapi-exporter-additional-ribbon-class')
		}

		this.addSettingTab(new StrapiExporterSettingTab(this.app, this))
	}

	onunload() {}

	/**
	 * Load the settings for the plugin
	 */
	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_STRAPI_EXPORTER_SETTINGS,
			await this.loadData()
		)
	}

	/**
	 * Save the settings for the plugin
	 */
	async saveSettings() {
		await this.saveData(this.settings)
	}

	/**
	 * Process the Markdown content
	 * @param useAdditionalCallAPI Whether to use the additional Call api settings
	 */
	async processMarkdownContent(useAdditionalCallAPI = false) {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
		if (!activeView) {
			new Notice('No active Markdown view')
			return
		}

		/** ****************************************************************************
		 * Check if all the settings are configured
		 * *****************************************************************************
		 */
		if (!checkSettings(this.settings, useAdditionalCallAPI)) {
			return
		}

		/** ****************************************************************************
		 * Process the Markdown content
		 * *****************************************************************************
		 */
		const file = activeView.file
		let content = ''
		if (!file) {
			new Notice('No file found in active view...')
			return
		}

		/************************************************************
		 * Check if the content has any images to process
		 ************************************************************/
		const imagePath = useAdditionalCallAPI
			? this.settings.additionalImage
			: this.settings.mainImage
		const galeryFolderPath = useAdditionalCallAPI
			? this.settings.additionalGalery
			: this.settings.mainGalery

		const imageBlob = await getImageBlob(this.app, imagePath)
		const galeryImageBlobs = await getGaleryImageBlobs(
			this.app,
			galeryFolderPath
		)

		/**
		 * Read the content of the file
		 */
		content = await this.app.vault.read(file)

		// Check if the content has any images to process
		const flag = hasUnexportedImages(content)
		/**
		 * Initialize the OpenAI API
		 */
		const openai = new OpenAI({
			apiKey: this.settings.openaiApiKey,
			dangerouslyAllowBrowser: true,
		})

		/**
		 * Process the images in the content, upload them to Strapi, and update the links,
		 * only if there are images in the content
		 * that are not already uploaded to Strapi
		 */
		if (flag) {
			const imagePaths = extractImagePaths(content)
			const imageBlobs = await getImageBlobs(this.app, imagePaths)

			new Notice('Getting image descriptions...')
			const imageDescriptions = await Promise.all(
				imageBlobs.map(async imageBlob => {
					const description = await getImageDescription(imageBlob.blob, openai)
					return {
						blob: imageBlob.blob,
						name: imageBlob.name,
						path: imageBlob.path,
						description,
					}
				})
			)

			new Notice('Uploading images to Strapi...')
			const uploadedImages = await uploadImagesToStrapi(
				imageDescriptions,
				this.settings.strapiUrl,
				this.settings.strapiApiToken
			)

			new Notice('Replacing image paths...')
			content = replaceImagePaths(content, uploadedImages)
			await this.app.vault.modify(file, content)
			new Notice('Images uploaded and links updated successfully!')
		} else {
			new Notice(
				'No local images found in the content... Skip the image processing...'
			)
		}

		/**
		 * Generate article content using OpenAI
		 */
		new Notice('Generating article content...')
		let jsonTemplate: any
		let jsonTemplateDescription: any
		let url: any
		let contentAttributeName: any

		if (useAdditionalCallAPI) {
			jsonTemplate = JSON.parse(this.settings.additionalJsonTemplate)
			jsonTemplateDescription = JSON.parse(
				this.settings.additionalJsonTemplateDescription
			)
			url = this.settings.additionalUrl
			contentAttributeName = this.settings.additionalContentAttributeName
		} else {
			jsonTemplate = JSON.parse(this.settings.jsonTemplate)
			jsonTemplateDescription = JSON.parse(
				this.settings.jsonTemplateDescription
			)
			url = this.settings.strapiArticleCreateUrl
			contentAttributeName = this.settings.strapiContentAttributeName
		}

		const imageFullPathProperty = useAdditionalCallAPI
			? this.settings.additionalImageFullPathProperty
			: this.settings.mainImageFullPathProperty
		const galeryFullPathProperty = useAdditionalCallAPI
			? this.settings.additionalGaleryFullPathProperty
			: this.settings.mainGaleryFullPathProperty

		/**
		 * Add the content, image, and gallery to the article content based on the settings
		 */
		const articleContent = {
			data: {
				...(imageBlob &&
					imageFullPathProperty && {
						[imageFullPathProperty]: imageBlob.path,
					}),
				...(galeryUploadedImageIds.length > 0 &&
					galeryFullPathProperty && {
						[galeryFullPathProperty]: galeryUploadedImageIds,
					}),
			},
		}

		new Notice('Article content generated successfully!')
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.settings.strapiApiToken}`,
				},
				body: JSON.stringify({
					...articleContent,
					data: {
						...articleContent.data,
						[contentAttributeName]: content,
					},
				}),
			})

			if (response.ok) {
				new Notice('Article created successfully in Strapi!')
			} else {
				new Notice('Failed to create article in Strapi.')
			}
		} catch (error) {
			new Notice('Error creating article in Strapi.')
		}

		new Notice(
			'Check your API content now, the article is created & uploaded ! 🎉'
		)
	}

	/**
	 * Get the image blobs from the image paths
	 * @param imagePaths
	 */
	async getImageBlobs(
		imagePaths: string[]
	): Promise<{ path: string; blob: Blob; name: string }[]> {
		// Get all the files in the vault
		const files = this.app.vault.getAllLoadedFiles()
		// Get the image files name from the vault
		const fileNames = files.map(file => file.name)
		// Filter the image files, and get all the images files paths
		const imageFiles = imagePaths.filter(path => fileNames.includes(path))
		// Get the image blobs, find it, and return the blob
		return await Promise.all(
			imageFiles.map(async path => {
				const file = files.find(file => file.name === path)
				if (file instanceof TFile) {
					const blob = await this.app.vault.readBinary(file)
					return {
						name: path,
						blob: new Blob([blob], { type: 'image/png' }),
						path: file.path,
					}
				}
				return {
					name: '',
					blob: new Blob(),
					path: '',
				}
			})
		)
	}

	/**
	 * Get the image blobs from the image paths
	 * @param imagePath
	 */
	async getImageBlob(
		imagePath: string
	): Promise<{ path: string; blob: Blob; name: string } | null> {
		const file = this.app.vault.getAbstractFileByPath(imagePath)
		if (file instanceof TFile) {
			const blob = await this.app.vault.readBinary(file)
			return {
				name: file.name,
				blob: new Blob([blob], { type: 'image/png' }),
				path: file.path,
			}
		}
		return null
	}

	/**
	 * Get the image blobs from the image paths
	 * @param folderPath
	 */
	async getGaleryImageBlobs(
		folderPath: string
	): Promise<{ path: string; blob: Blob; name: string }[]> {
		const folder = this.app.vault.getAbstractFileByPath(folderPath)
		if (folder instanceof TFolder) {
			const files = folder.children.filter(
				file =>
					file instanceof TFile &&
					file.extension.match(/^(jpg|jpeg|png|gif|bmp|webp)$/i) &&
					!file.parent?.name.includes('alreadyUpload')
			)
			return Promise.all(
				files.map(async file => {
					const blob = await this.app.vault.readBinary(file as TFile)
					return {
						name: file.name,
						blob: new Blob([blob], { type: 'image/png' }),
						path: file.path,
					}
				})
			)
		}
		return []
	}

	async uploadGaleryImagesToStrapi(
		imageBlobs: { path: string; blob: Blob; name: string }[]
	): Promise<number[]> {
		const uploadedImageIds: number[] = []

		for (const imageBlob of imageBlobs) {
			const formData = new FormData()
			formData.append('files', imageBlob.blob, imageBlob.name)

			try {
				const response = await fetch(`${this.settings.strapiUrl}/api/upload`, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${this.settings.strapiApiToken}`,
					},
					body: formData,
				})

				if (response.ok) {
					const data = await response.json()
					uploadedImageIds.push(data[0].id)
				} else {
					new Notice(`Failed to upload galery image: ${imageBlob.name}`)
				}
			} catch (error) {
				new Notice(`Error uploading galery image: ${imageBlob.name}`)
			}
		}

		return uploadedImageIds
	}
}

class StrapiExporterSettingTab extends PluginSettingTab {
	mainImageCountEl: HTMLElement
	mainGaleryCountEl: HTMLElement
	additionalImageCountEl: HTMLElement
	additionalGaleryCountEl: HTMLElement
	plugin: StrapiExporterPlugin

	constructor(app: App, plugin: StrapiExporterPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()

		/** ****************************************************************************
		 * Add the settings for the plugin
		 * *****************************************************************************
		 */

		containerEl.createEl('h2', { text: 'Strapi & OpenAI Settings' })
		new Setting(containerEl)
			.setName('Strapi API Token')
			.setDesc('Enter your Strapi API token')
			.addText(text =>
				text
					.setPlaceholder('Enter your token')
					.setValue(this.plugin.settings.strapiApiToken)
					.onChange(async value => {
						this.plugin.settings.strapiApiToken = value
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName('OpenAI API Key')
			.setDesc('Enter your OpenAI API key for GPT-3')
			.addText(text =>
				text
					.setPlaceholder('Enter your OpenAI API key')
					.setValue(this.plugin.settings.openaiApiKey)
					.onChange(async value => {
						this.plugin.settings.openaiApiKey = value
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName('Additional Prompt')
			.setDesc(
				'Enter an optional additional prompt to customize the article content generation'
			)
			.addTextArea(text =>
				text
					.setPlaceholder('Enter your additional prompt here...')
					.setValue(this.plugin.settings.additionalPrompt)
					.onChange(async value => {
						this.plugin.settings.additionalPrompt = value
						await this.plugin.saveSettings()
					})
			)

		containerEl.createEl('h2', { text: 'Strapi Settings - Call 1' })

		new Setting(containerEl)
			.setName('Strapi URL')
			.setDesc('Enter your Strapi instance URL')
			.addText(text =>
				text
					.setPlaceholder('https://your-strapi-url')
					.setValue(this.plugin.settings.strapiUrl)
					.onChange(async value => {
						this.plugin.settings.strapiUrl = value
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName('JSON Template')
			.setDesc('Enter the JSON template for the fields needed')
			.addTextArea(text =>
				text
					.setPlaceholder('Enter your JSON template')
					.setValue(this.plugin.settings.jsonTemplate)
					.onChange(async value => {
						this.plugin.settings.jsonTemplate = value
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName('JSON Template Description')
			.setDesc('Enter the description for each field in the JSON template')
			.addTextArea(text =>
				text
					.setPlaceholder('Enter the field descriptions')
					.setValue(this.plugin.settings.jsonTemplateDescription)
					.onChange(async value => {
						this.plugin.settings.jsonTemplateDescription = value
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName('Strapi Article Create URL')
			.setDesc('Enter the URL to create articles in Strapi')
			.addText(text =>
				text
					.setPlaceholder('https://your-strapi-url/api/articles')
					.setValue(this.plugin.settings.strapiArticleCreateUrl)
					.onChange(async value => {
						this.plugin.settings.strapiArticleCreateUrl = value
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName('Strapi Content Attribute Name')
			.setDesc('Enter the attribute name for the content field in Strapi')
			.addText(text =>
				text
					.setPlaceholder('content')
					.setValue(this.plugin.settings.strapiContentAttributeName)
					.onChange(async value => {
						this.plugin.settings.strapiContentAttributeName = value
						await this.plugin.saveSettings()
					})
			)

		containerEl.createEl('h3', { text: 'Main Image Settings' })

		new Setting(containerEl)
			.setName('Enable Main Image')
			.setDesc('Toggle the main image')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.mainButtonImageEnabled)
					.onChange(async value => {
						this.plugin.settings.mainButtonImageEnabled = value
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName('Main Image Folder')
			.setDesc(
				'Enter the folder containing the main (absolute path from the root of the vault)'
			)
			.addText(text =>
				text
					.setPlaceholder('main-image')
					.setValue(this.plugin.settings.mainImage)
					.onChange(async value => {
						this.plugin.settings.mainImage = value
						await this.plugin.saveSettings()
					})
			)

		this.mainImageCountEl = containerEl.createEl('p', {
			text: 'Detected images: 0',
		})

		new Setting(containerEl)
			.setName('Main Image Full Path Property')
			.setDesc(
				'Enter the full path property for the main image in the final call'
			)
			.addText(text =>
				text
					.setPlaceholder('data.attributes.image')
					.setValue(this.plugin.settings.mainImageFullPathProperty)
					.onChange(async value => {
						this.plugin.settings.mainImageFullPathProperty = value
						await this.plugin.saveSettings()
					})
			)

		containerEl.createEl('h3', { text: 'Main Galery Settings' })

		new Setting(containerEl)
			.setName('Enable Main Galery')
			.setDesc('Toggle the main galery')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.mainButtonGaleryEnabled)
					.onChange(async value => {
						this.plugin.settings.mainButtonGaleryEnabled = value
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName('Main Galery Folder')
			.setDesc(
				'Enter the folder containing the main galery images (absolute path from the root of the vault)'
			)
			.addText(text =>
				text
					.setPlaceholder('main-galery')
					.setValue(this.plugin.settings.mainGalery)
					.onChange(async value => {
						this.plugin.settings.mainGalery = value
						await this.plugin.saveSettings()
					})
			)
		this.mainGaleryCountEl = containerEl.createEl('p', {
			text: 'Detected images: 0',
		})

		new Setting(containerEl)
			.setName('Main Galery Full Path Property')
			.setDesc(
				'Enter the full path property for the main galery in the final call'
			)
			.addText(text =>
				text
					.setPlaceholder('data.attributes.galery')
					.setValue(this.plugin.settings.mainGaleryFullPathProperty)
					.onChange(async value => {
						this.plugin.settings.mainGaleryFullPathProperty = value
						await this.plugin.saveSettings()
					})
			)

		containerEl.createEl('h2', {
			text: 'Strapi Settings - Call 2 - Additional call',
		})
		containerEl.createEl('p', {
			text: `(Be careful, when enabling this feature, you'll need to restart Obsidian to see the additional button in the ribbon menu.)`,
		})

		new Setting(containerEl)
			.setName('Enable Additional Call API')
			.setDesc(
				'Toggle the additional Call API, and display a new icon in the ribbon menu'
			)
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.enableAdditionalApiCall)
					.onChange(async value => {
						this.plugin.settings.enableAdditionalApiCall = value
						await this.plugin.saveSettings()
						this.display()
					})
			)

		if (this.plugin.settings.enableAdditionalApiCall) {
			new Setting(containerEl)
				.setName('Additional JSON Template')
				.setDesc(
					'Enter the JSON template for the fields needed for the additional api'
				)
				.addTextArea(text =>
					text
						.setPlaceholder('Enter your JSON template')
						.setValue(this.plugin.settings.additionalJsonTemplate)
						.onChange(async value => {
							this.plugin.settings.additionalJsonTemplate = value
							await this.plugin.saveSettings()
						})
				)

			new Setting(containerEl)
				.setName('Additional API JSON Template Description')
				.setDesc(
					'Enter the description for each field in the additional API JSON template'
				)
				.addTextArea(text =>
					text
						.setPlaceholder('Enter the field descriptions')
						.setValue(this.plugin.settings.additionalJsonTemplateDescription)
						.onChange(async value => {
							this.plugin.settings.additionalJsonTemplateDescription = value
							await this.plugin.saveSettings()
						})
				)

			new Setting(containerEl)
				.setName('Additional API URL')
				.setDesc('Enter the URL to create content for the additional API')
				.addText(text =>
					text
						.setPlaceholder('https://your-strapi-url/api/additional-content')
						.setValue(this.plugin.settings.additionalUrl)
						.onChange(async value => {
							this.plugin.settings.additionalUrl = value
							await this.plugin.saveSettings()
						})
				)

			new Setting(containerEl)
				.setName('Additional API Content Attribute Name')
				.setDesc(
					'Enter the attribute name for the content field for the additional API'
				)
				.addText(text =>
					text
						.setPlaceholder('content')
						.setValue(this.plugin.settings.additionalContentAttributeName)
						.onChange(async value => {
							this.plugin.settings.additionalContentAttributeName = value
							await this.plugin.saveSettings()
						})
				)

			containerEl.createEl('h3', { text: 'Additional Call api Image Settings' })

			new Setting(containerEl)
				.setName('Enable Additional Call API Image')
				.setDesc('Toggle the additional Call API image')
				.addToggle(toggle =>
					toggle
						.setValue(this.plugin.settings.additionalButtonImageEnabled)
						.onChange(async value => {
							this.plugin.settings.additionalButtonImageEnabled = value
							await this.plugin.saveSettings()
						})
				)

			new Setting(containerEl)
				.setName('Additional Call API Image Folder')
				.setDesc('Enter the folder containing the additional Call API image')
				.addText(text =>
					text
						.setPlaceholder('additional-image')
						.setValue(this.plugin.settings.additionalImage)
						.onChange(async value => {
							this.plugin.settings.additionalImage = value
							await this.plugin.saveSettings()
						})
				)

			this.additionalImageCountEl = containerEl.createEl('p', {
				text: 'Detected images: 0',
			})

			new Setting(containerEl)
				.setName('Additional Call API Image Full Path Property')
				.setDesc(
					'Enter the full path property for the additional Call API image in the final call'
				)
				.addText(text =>
					text
						.setPlaceholder('data.attributes.image')
						.setValue(this.plugin.settings.additionalImageFullPathProperty)
						.onChange(async value => {
							this.plugin.settings.additionalImageFullPathProperty = value
							await this.plugin.saveSettings()
						})
				)

			containerEl.createEl('h3', {
				text: 'Additional Call API Galery Settings',
			})

			new Setting(containerEl)
				.setName('Enable Additional Call API Galery')
				.setDesc('Toggle the additional Call API galery')
				.addToggle(toggle =>
					toggle
						.setValue(this.plugin.settings.additionalButtonGaleryEnabled)
						.onChange(async value => {
							this.plugin.settings.additionalButtonGaleryEnabled = value
							await this.plugin.saveSettings()
						})
				)

			new Setting(containerEl)
				.setName('Additional Call API Galery Folder')
				.setDesc(
					'Enter the folder containing the additional Call API galery images'
				)
				.addText(text =>
					text
						.setPlaceholder('additional-galery')
						.setValue(this.plugin.settings.additionalGalery)
						.onChange(async value => {
							this.plugin.settings.additionalGalery = value
							await this.plugin.saveSettings()
						})
				)

			this.additionalGaleryCountEl = containerEl.createEl('p', {
				text: 'Detected images: 0',
			})

			new Setting(containerEl)
				.setName('Additional Call API Galery Full Path Property')
				.setDesc(
					'Enter the full path property for the additional Call API galery in the final call'
				)
				.addText(text =>
					text
						.setPlaceholder('data.attributes.galery')
						.setValue(this.plugin.settings.additionalGaleryFullPathProperty)
						.onChange(async value => {
							this.plugin.settings.additionalGaleryFullPathProperty = value
							await this.plugin.saveSettings()
						})
				)
		}
	}

	// Update image counts
	updateImageCounts()

	// @ts-ignore
	async countImagesInFolder(folderPath: string): Promise<number> {
		const folder = this.app.vault.getAbstractFileByPath(folderPath)
		if (folder instanceof TFolder) {
			const files = folder.children.filter(
				file =>
					file instanceof TFile &&
					file.extension.match(/^(jpg|jpeg|png|gif|bmp|webp)$/i)
			)
			return files.length
		}
		return 0
	}

	async updateImageCounts() {
		const mainImageCount = await this.countImagesInFolder(
			this.plugin.settings.mainImage
		)
		const mainGaleryCount = await this.countImagesInFolder(
			this.plugin.settings.mainGalery
		)
		const additionalImageCount = await this.countImagesInFolder(
			this.plugin.settings.additionalImage
		)
		const additionalGaleryCount = await this.countImagesInFolder(
			this.plugin.settings.additionalGalery
		)

		this.mainImageCountEl.setText(`Detected images: ${mainImageCount}`)
		this.mainGaleryCountEl.setText(`Detected images: ${mainGaleryCount}`)
		this.additionalImageCountEl.setText(
			`Detected images: ${additionalImageCount}`
		)
		this.additionalGaleryCountEl.setText(
			`Detected images: ${additionalGaleryCount}`
		)
	}
}
