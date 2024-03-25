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

interface MyPluginSettings {
	strapiUrl: string
	strapiApiToken: string
	openaiApiKey: string
	imageRecognitionApiKey: string
	jsonTemplate: string
	jsonTemplateDescription: string
	strapiArticleCreateUrl: string
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	strapiUrl: '',
	strapiApiToken: '',
	openaiApiKey: '',
	imageRecognitionApiKey: '',
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
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings

	async onload() {
		await this.loadSettings()

		const ribbonIconEl = this.addRibbonIcon(
			'italic-glyph',
			'Upload images to Strapi and update links in Markdown content',
			async (evt: MouseEvent) => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
				if (!activeView) {
					new Notice('No active Markdown view')
					return
				}

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

				if (!this.settings.imageRecognitionApiKey) {
					new Notice(
						'Please configure Image Recognition API key in the plugin settings'
					)
					return
				}

				if (!this.settings.jsonTemplate) {
					new Notice('Please configure JSON template in the plugin settings')
					return
				}

				new Notice('Processing Markdown content...')

				const file = activeView.file
				if (!file) {
					new Notice('No file found in active view...')
					return
				}
				const content = await this.app.vault.read(file)

				// check if the content has any images to process
				const flag = this.hasUnexportedImages(content)
				if (flag) {
					const imagePaths = this.extractImagePaths(content)
					const imageBlobs = await this.getImageBlobs(imagePaths)

					new Notice('Getting image descriptions...')
					const openai = new OpenAI({
						apiKey: this.settings.openaiApiKey,
						dangerouslyAllowBrowser: true,
					})

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

					new Notice('Uploading images to Strapi...')
					const uploadedImages =
						await this.uploadImagesToStrapi(imageDescriptions)

					new Notice('Replacing image paths...')
					const updatedContent = this.replaceImagePaths(content, uploadedImages)
					await this.app.vault.modify(file, updatedContent)

					new Notice('Images uploaded and links updated successfully!')
				} else {
					new Notice(
						'No local images found in the content... Skip the image processing...'
					)
				}

				new Notice('Generating article content...')
				const jsonTemplate = JSON.parse(this.settings.jsonTemplate)
				const jsonTemplateDescription = JSON.parse(
					this.settings.jsonTemplateDescription
				)

				const articlePrompt = `You are an SEO expert. Generate an article based on the following template and field descriptions:

						Template:
						${JSON.stringify(jsonTemplate, null, 2)}
						
						Field Descriptions:
						${JSON.stringify(jsonTemplateDescription, null, 2)}
						
						The main content of the article should be based on the following text:
						${updatedContent}
						
						Please provide the generated article content as a JSON object following the given template structure.`

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

				console.log(completion.choices[0].message.content)
				const articleContent = JSON.parse(
					completion.choices[0].message.content ?? '{}'
				)

				console.log('articleContent:', articleContent)

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

				new Notice('Article content generated successfully!')

				// TODO: Send the generated article content to Strapi using the appropriate API route
			}
		)
		ribbonIconEl.addClass('my-plugin-ribbon-class')

		this.addSettingTab(new MyExportSettingTab(this.app, this))
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}

	extractImagePaths(content: string): string[] {
		const imageRegex = /!\[\[([^\[\]]*\.(png|jpe?g|gif|bmp|webp))\]\]/gi
		const imagePaths: string[] = []
		let match

		while ((match = imageRegex.exec(content)) !== null) {
			imagePaths.push(match[1])
		}

		return imagePaths
	}

	hasUnexportedImages(content: string): boolean {
		const imageRegex = /!\[\[([^\[\]]*\.(png|jpe?g|gif|bmp|webp))\]\]/gi
		return imageRegex.test(content)
	}

	async getImageBlobs(
		imagePaths: string[]
	): Promise<{ path: string; blob: Blob; name: string }[]> {
		const files = this.app.vault.getAllLoadedFiles()
		const fileNames = files.map(file => file.name)
		const imageFiles = imagePaths.filter(path => fileNames.includes(path))
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
		const uploadedImages: {
			[key: string]: { url: string; data: any }
		} = {}

		for (const imageBlob of imageBlobs) {
			const formData = new FormData()
			formData.append('files', imageBlob.blob, imageBlob.name)
			formData.append(
				'fileInfo',
				JSON.stringify({
					name: imageBlob.description.name,
					alternativeText: imageBlob.description.alternativeText,
					caption: imageBlob.description.caption,
				})
			)

			try {
				console.log('Uploading image:', imageBlob, formData)
				const response = await fetch(`${this.settings.strapiUrl}/api/upload`, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${this.settings.strapiApiToken}`,
					},
					body: formData,
				})

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
	): string {
		for (const [localPath, imageData] of Object.entries(uploadedImages)) {
			const markdownImageRegex = new RegExp(`!\\[\\[${localPath}\\]\\]`, 'g')
			content = content.replace(
				markdownImageRegex,
				`![${imageData.data.alternativeText}](${imageData.url})`
			)
		}
		return content
	}

	async getImageDescription(imageBlob: Blob, openai: OpenAI) {
		const response = await openai.chat.completions.create({
			model: 'gpt-4-vision-preview',
			messages: [
				{
					role: 'user',
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

class MyExportSettingTab extends PluginSettingTab {
	plugin: MyPlugin

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()

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
			.setName('Image Recognition API Key')
			.setDesc('Enter your API key for image recognition')
			.addText(text =>
				text
					.setPlaceholder('Enter your image recognition API key')
					.setValue(this.plugin.settings.imageRecognitionApiKey)
					.onChange(async value => {
						this.plugin.settings.imageRecognitionApiKey = value
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
	}
}
