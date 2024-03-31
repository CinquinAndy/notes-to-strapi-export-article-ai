import OpenAI from 'openai'
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
		 * Process the Markdown content
		 * *****************************************************************************
		 */
		new Notice('All settings are ok, processing Markdown content...')
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
		const articleContent = JSON.parse(
			completion.choices[0].message.content ?? '{}'
		)
		/**
		 * Upload the gallery images to Strapi
		 */
		const galeryUploadedImageIds =
			await this.uploadGaleryImagesToStrapi(galeryImageBlobs)

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

	replaceImagePaths(
		content: string,
		uploadedImages: { [key: string]: { url: string; data: any } }
	): string {}

	async getImageBlob(
		imagePath: string
	): Promise<{ path: string; blob: Blob; name: string } | null> {}

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

// class StrapiExporterSettingTab extends PluginSettingTab {
//
// 	plugin: StrapiExporterPlugin
//
// 	constructor(app: App, plugin: StrapiExporterPlugin) {
// 		super(app, plugin)
// 		this.plugin = plugin
// 	}
//
//
//
// 	// Update image counts
// 	updateImageCounts()
//
//
// }
