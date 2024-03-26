import OpenAI from 'openai'
import {
	App,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from 'obsidian'

/**
 * The settings for the plugin
 */
interface MyPluginSettings {
	strapiUrl: string
	strapiApiToken: string
	openaiApiKey: string
	jsonTemplate: string
	jsonTemplateDescription: string
	strapiArticleCreateUrl: string
	strapiContentAttributeName: string
}

/**
 * The default settings for the plugin
 */
const DEFAULT_SETTINGS: MyPluginSettings = {
	strapiUrl: '',
	strapiApiToken: '',
	openaiApiKey: '',
	jsonTemplate: `{
    "data": {
      "title": "string",
      "seo_title": "string",
      "seo_description": "string",
      "slug": "string",
      "excerpt": "string",
      "links": [
        {
          "id": "number",
          "label": "string",
          "url": "string"
        }
      ],
      "subtitle": "string",
      "type": "string",
      "rank": "number",
      "tags": [
        {
          "id": "number",
          "name": "string"
        }
      ],
      "locale": "string"
    }
  }`,
	jsonTemplateDescription: `{
    "data": {
      "title": "Title of the item, as a short string",
      "seo_title": "SEO optimized title, as a short string",
      "seo_description": "SEO optimized description, as a short string",
      "slug": "URL-friendly string derived from the title",
      "excerpt": "A short preview or snippet from the content",
      "links": "Array of related links with ID, label, and URL",
      "subtitle": "Subtitle or secondary title, as a short string",
      "type": "Category or type of the item, as a short string",
      "rank": "Numerical ranking or order priority, as a number",
      "tags": "Array of associated tags with ID and name",
      "locale": "Locale or language code, as a short string"
    }
  }`,
	strapiArticleCreateUrl: '',
	strapiContentAttributeName: '',
}

/**
 * The main plugin class
 */
export default class MyPlugin extends Plugin {
	settings: MyPluginSettings

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
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
				if (!activeView) {
					new Notice('No active Markdown view')
					return
				}

				/** ****************************************************************************
				 * Check if all the settings are configured
				 * *****************************************************************************
				 */
				if (!this.settings.strapiUrl || !this.settings.strapiApiToken) {
					new Notice(
						'Please configure Strapi URL and API token in the plugin settings'
					)
					return
				}

				if (!this.settings.openaiApiKey) {
					new Notice('Please configure OpenAI API key in the plugin settings')
					return
				}

				if (!this.settings.jsonTemplate) {
					new Notice('Please configure JSON template in the plugin settings')
					return
				}

				if (!this.settings.jsonTemplateDescription) {
					new Notice(
						'Please configure JSON template description in the plugin settings'
					)
					return
				}

				if (!this.settings.strapiArticleCreateUrl) {
					new Notice(
						'Please configure Strapi article create URL in the plugin settings'
					)
					return
				}

				if (!this.settings.strapiContentAttributeName) {
					new Notice(
						'Please configure Strapi content attribute name in the plugin settings'
					)
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
				/**
				 * Read the content of the file
				 */
				content = await this.app.vault.read(file)

				// check if the content has any images to process
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
					const uploadedImages =
						await this.uploadImagesToStrapi(imageDescriptions)

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
				/**
				 * Parse the JSON template and description
				 */
				const jsonTemplate = JSON.parse(this.settings.jsonTemplate)
				const jsonTemplateDescription = JSON.parse(
					this.settings.jsonTemplateDescription
				)

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
						if present the locale need to be 'fr' and the content in french, and generate at least 8 tags if present in the schema too.
						if present the rank need to be 999
						Méta Description : Rédigez une méta description attrayante incluant le mot-clé principal, 
						qui incite à cliquer sur l'article depuis les résultats de recherche.
						Optimisation pour les Lecteurs et les Moteurs de Recherche : Rédigez un contenu qui est non seulement optimisé 
						pour les moteurs de recherche mais aussi engageant et informatif pour les lecteurs. 
						Le contenu doit répondre à leurs questions ou résoudre un problème`

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

				/**
				 * Parse the generated article content
				 */
				let articleContent = JSON.parse(
					completion.choices[0].message.content ?? '{}'
				)
				/**
				 * Add the content to the article content
				 */
				articleContent = {
					data: {
						...articleContent.data,
						[this.settings.strapiContentAttributeName]: content,
					},
				}

				new Notice('Article content generated successfully!')
				try {
					const response = await fetch(this.settings.strapiArticleCreateUrl, {
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
		)
		ribbonIconEl.addClass('my-plugin-ribbon-class')

		this.addSettingTab(new MyExportSettingTab(this.app, this))
	}

	onunload() {}

	/**
	 * Load the settings for the plugin
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
	}

	/**
	 * Save the settings for the plugin
	 */
	async saveSettings() {
		await this.saveData(this.settings)
	}

	/**
	 * Extract the image paths from the content
	 * @param content
	 */
	extractImagePaths(content: string): string[] {
		/**
		 * Extract the image paths from the content
		 */
		const imageRegex = /!\[\[([^\[\]]*\.(png|jpe?g|gif|bmp|webp))\]\]/gi
		const imagePaths: string[] = []
		let match

		while ((match = imageRegex.exec(content)) !== null) {
			imagePaths.push(match[1])
		}

		return imagePaths
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
		// get all the files in the vault
		const files = this.app.vault.getAllLoadedFiles()
		// get the image files name from the vault
		const fileNames = files.map(file => file.name)
		// filter the image files, and get all the images files paths
		const imageFiles = imagePaths.filter(path => fileNames.includes(path))
		// get the image blobs, find it, and return the blob
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
		// upload the images to Strapi
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

			// upload the image to Strapi
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
	async getImageDescription(imageBlob: Blob, openai: OpenAI) {
		// get the image description using the OpenAI API ( using gpt 4 vision preview model )
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
							// encode imageBlob as base64
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
		// alt text, caption, and title for the image, based on the description of the image
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
}

/**
 * The settings tab for the plugin
 */
class MyExportSettingTab extends PluginSettingTab {
	plugin: MyPlugin

	constructor(app: App, plugin: MyPlugin) {
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
	}
}
