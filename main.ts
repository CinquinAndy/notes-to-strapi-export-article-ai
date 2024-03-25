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
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	strapiUrl: '',
	strapiApiToken: '',
	openaiApiKey: '',
	imageRecognitionApiKey: '',
	jsonTemplate: `{
    "title": "string",
    "content": "string",
    "description": "string"
  }`,
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
				console.log('content:', content)

				const imagePaths = this.extractImagePaths(content)
				console.log('imagePaths:', imagePaths)
				const imageBlobs = await this.getImageBlobs(imagePaths)
				console.log('imageBlobs perfect:', imageBlobs)

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

				console.log('*************************************')
				console.log('images blobs:', imageBlobs)
				console.log('images:', imageDescriptions)

				new Notice('Uploading images to Strapi...')

				const uploadedImages =
					await this.uploadImagesToStrapi(imageDescriptions)

				console.log('uploadedImages:', uploadedImages)
				new Notice('Replacing image paths...')

				const updatedContent = this.replaceImagePaths(content, uploadedImages)

				console.log('updatedContent:', updatedContent)
				await this.app.vault.modify(file, updatedContent)

				new Notice('Images uploaded and links updated successfully!')
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
				const response = await fetch(`${this.settings.strapiUrl}/upload`, {
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
					console.error(`Failed to upload image: ${imageBlob.name}`)
					console.error('Error response:', await response.json())
				}
			} catch (error) {
				new Notice(`Error uploading image: ${imageBlob.name}`)
				console.error(`Error uploading image: ${imageBlob.name}`, error)
			}
		}

		return uploadedImages
	}

	replaceImagePaths(
		content: string,
		uploadedImages: { [key: string]: { url: string; data: any } }
	): string {
		console.log('uploadedImages:', uploadedImages)
		console.log('content:', content)
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

		console.log(response)
		console.log(response.choices[0].message.content)
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

		console.log(completion)
		console.log(completion.choices[0].message.content)
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
	}
}
