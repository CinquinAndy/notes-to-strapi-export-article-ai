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

		const imageBlob = await this.getImageBlob(imagePath)
		const galeryImageBlobs = await this.getGaleryImageBlobs(galeryFolderPath)

		/**
		 * Read the content of the file
		 */
		content = await this.app.vault.read(file)

		// Check if the content has any images to process
		const flag = this.hasUnexportedImages(content)
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
			/**
			 * Extract the image paths from the content
			 */
			const imagePaths = this.extractImagePaths(content)

			/**
			 * Get the image blobs from the image paths
			 */
			const imageBlobs = await this.getImageBlobs(imagePaths)

			/**
			 * Get the image descriptions using the OpenAI API
			 */
			new Notice('Getting image descriptions...')
			const imageDescriptions = await Promise.all(
				imageBlobs.map(async imageBlob => {
					const description = await this.getImageDescription(
						imageBlob.blob,
						openai
					)
					return {
						blob: imageBlob.blob,
						name: imageBlob.name,
						path: imageBlob.path,
						description,
					}
				})
			)

			/**
			 * Upload the images to Strapi
			 */
			new Notice('Uploading images to Strapi...')
			const uploadedImages = await this.uploadImagesToStrapi(imageDescriptions)

			/**
			 * Replace the image paths in the content with the uploaded image URLs
			 */
			new Notice('Replacing image paths...')
			content = this.replaceImagePaths(content, uploadedImages)
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

		/**
		 * If the content is not present, get it from the active view
		 */
		content = await this.app.vault.read(file)

		/**
		 * Prompt for generating the article content
		 */
		const articlePrompt = `You are an SEO expert. Generate an article based on the following template and field descriptions:

		Template:
		${JSON.stringify(jsonTemplate, null, 2)}
		
		Field Descriptions:
		${JSON.stringify(jsonTemplateDescription, null, 2)}
		
		The main content of the article should be based on the following text and all the keywords around the domain of the text:
		----- CONTENT -----
		${content.substring(0, 500)}
		----- END CONTENT -----
		
		Please provide the generated article content as a JSON object following the given template structure.
		
		${this.settings.additionalPrompt ? `Additional Prompt: ${this.settings.additionalPrompt}` : ''}`

		/**
		 * Generate the article content using OpenAI
		 */
		const completion = await openai.chat.completions.create({
			model: 'gpt-3.5-turbo-0125',
			messages: [
				{
					role: 'user',
					content: articlePrompt,
				},
			],
			max_tokens: 2000,
			n: 1,
			stop: null,
		})

		const imageFullPathProperty = useAdditionalCallAPI
			? this.settings.additionalImageFullPathProperty
			: this.settings.mainImageFullPathProperty
		const galeryFullPathProperty = useAdditionalCallAPI
			? this.settings.additionalGaleryFullPathProperty
			: this.settings.mainGaleryFullPathProperty

		/**
		 * Parse the generated article content
		 */
		let articleContent = JSON.parse(
			completion.choices[0].message.content ?? '{}'
		)
		/**
		 * Upload the gallery images to Strapi
		 */
		const galeryUploadedImageIds =
			await this.uploadGaleryImagesToStrapi(galeryImageBlobs)

		// Rename the galery folder to "alreadyUpload"
		const galeryFolder = this.app.vault.getAbstractFileByPath(galeryFolderPath)
		if (galeryFolder instanceof TFolder) {
			await this.app.vault.rename(
				galeryFolder,
				galeryFolderPath.replace(/\/[^/]*$/, '/alreadyUpload')
			)
		}

		/**
		 * Add the content, image, and gallery to the article content based on the settings
		 */
		articleContent = {
			data: {
				...articleContent.data,
				[contentAttributeName]: content,
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
				body: JSON.stringify(articleContent),
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
	 * Check if the content has any unexported images
	 * @param content
	 */
	hasUnexportedImages(content: string): boolean {
		const imageRegex = /!\[\[([^\[\]]*\.(png|jpe?g|gif|bmp|webp))\]\]/gi
		return imageRegex.test(content)
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
	 * Upload the images to Strapi
	 * @param imageBlobs
	 */
	async uploadImagesToStrapi(
		imageBlobs: {
			path: string
			blob: Blob
			name: string
			description: {
				name: string
				alternativeText: string
				caption: string
			}
		}[]
	): Promise<{ [key: string]: { url: string; data: any } }> {
		// Upload the images to Strapi
		const uploadedImages: {
			[key: string]: { url: string; data: any }
		} = {}

		/**
		 * Upload the images to Strapi
		 */
		for (const imageBlob of imageBlobs) {
			const formData = new FormData()
			/**
			 * Append the image blob and the image description to the form data
			 */
			formData.append('files', imageBlob.blob, imageBlob.name)
			formData.append(
				'fileInfo',
				JSON.stringify({
					name: imageBlob.description.name,
					alternativeText: imageBlob.description.alternativeText,
					caption: imageBlob.description.caption,
				})
			)

			// Upload the image to Strapi
			try {
				const response = await fetch(`${this.settings.strapiUrl}/api/upload`, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${this.settings.strapiApiToken}`,
					},
					body: formData,
				})

				/**
				 * If the response is ok, add the uploaded image to the uploaded images object
				 */
				if (response.ok) {
					const data = await response.json()
					uploadedImages[imageBlob.name] = {
						url: data[0].url,
						data: data[0],
					}
				} else {
					new Notice(`Failed to upload image: ${imageBlob.name}`)
				}
			} catch (error) {
				new Notice(`Error uploading image: ${imageBlob.name}`)
			}
		}

		return uploadedImages
	}

	/**
	 * Replace the image paths in the content with the uploaded image URLs
	 * @param content
	 * @param uploadedImages
	 */
	replaceImagePaths(
		content: string,
		uploadedImages: { [key: string]: { url: string; data: any } }
	): string {
		/**
		 * Replace the image paths in the content with the uploaded image URLs
		 */
		for (const [localPath, imageData] of Object.entries(uploadedImages)) {
			const markdownImageRegex = new RegExp(`!\\[\\[${localPath}\\]\\]`, 'g')
			content = content.replace(
				markdownImageRegex,
				`![${imageData.data.alternativeText}](${imageData.url})`
			)
		}
		return content
	}

	/**
	 * Get the description of the image using OpenAI
	 * @param imageBlob
	 * @param openai
	 */
	getImageDescription = async (imageBlob: Blob, openai: OpenAI) => {
		// Get the image description using the OpenAI API (using gpt 4 vision preview model)
		const response = await openai.chat.completions.create({
			model: 'gpt-4-vision-preview',
			messages: [
				{
					role: 'user',
					// @ts-ignore
					content: [
						{
							type: 'text',
							text: `What's in this image? make it simple, i just want the context and an idea(think about alt text)`,
						},
						{
							type: 'image_url',
							// Encode imageBlob as base64
							image_url: `data:image/png;base64,${btoa(
								new Uint8Array(await imageBlob.arrayBuffer()).reduce(
									(data, byte) => data + String.fromCharCode(byte),
									''
								)
							)}`,
						},
					],
				},
			],
		})

		new Notice(response.choices[0].message.content ?? 'no response content...')
		new Notice(
			`prompt_tokens: ${response.usage?.prompt_tokens} // completion_tokens: ${response.usage?.completion_tokens} // total_tokens: ${response.usage?.total_tokens}`
		)

		// gpt-3.5-turbo-0125
		// Generate alt text, caption, and title for the image, based on the description of the image
		const completion = await openai.chat.completions.create({
			model: 'gpt-3.5-turbo-0125',
			messages: [
				{
					role: 'user',
					content: `You are an SEO expert and you are writing alt text, caption, and title for this image. The description of the image is: ${response.choices[0].message.content}.
				Give me a title (name) for this image, an SEO-friendly alternative text, and a caption for this image.
				Generate this information and respond with a JSON object using the following fields: name, alternativeText, caption.
				Use this JSON template: {"name": "string", "alternativeText": "string", "caption": "string"}.`,
				},
			],
			max_tokens: 750,
			n: 1,
			stop: null,
		})

		new Notice(
			completion.choices[0].message.content ?? 'no response content...'
		)
		new Notice(
			`prompt_tokens: ${completion.usage?.prompt_tokens} // completion_tokens: ${completion.usage?.completion_tokens} // total_tokens: ${completion.usage?.total_tokens}`
		)

		return JSON.parse(completion.choices[0].message.content?.trim() || '{}')
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