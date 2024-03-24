import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from 'obsidian'

interface MyPluginSettings {
	mySetting: string
	strapiApiToken: string
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default',
	strapiApiToken: '',
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings

	async onload() {
		await this.loadSettings()

		const ribbonIconEl = this.addRibbonIcon(
			'dice',
			'Sample Plugin',
			async (evt: MouseEvent) => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
				if (!activeView) {
					new Notice('No active Markdown view')
					return
				}
				const editor = activeView.editor
				const content = editor.getValue()

				// Extract image paths from the Markdown content
				const imagePaths = this.extractImagePaths(content)

				// Upload images to Strapi
				const uploadedImages = await this.uploadImagesToStrapi(imagePaths)

				// Replace local image paths with remote image URLs
				const updatedContent = this.replaceImagePaths(content, uploadedImages)

				// Update the Markdown content in the editor
				editor.setValue(updatedContent)

				new Notice('Images uploaded and links updated!')
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
		// Use a regular expression to extract image paths from the Markdown content
		const imageRegex = /!\[.*?\]\((.*?)\)/g
		const imagePaths: string[] = []
		let match
		while ((match = imageRegex.exec(content)) !== null) {
			imagePaths.push(match[1])
		}
		return imagePaths
	}

	async uploadImagesToStrapi(
		imagePaths: string[]
	): Promise<{ [key: string]: string }> {
		const uploadedImages: { [key: string]: string } = {}

		for (const imagePath of imagePaths) {
			const formData = new FormData()
			const imageFile = await this.readImageAsBlob(imagePath)
			formData.append('files', imageFile, imagePath)

			const response = await fetch('https://your-strapi-url/api/upload', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.settings.strapiApiToken}`,
				},
				body: formData,
			})

			if (response.ok) {
				const data = await response.json()
				uploadedImages[imagePath] = data[0].url
			} else {
				console.error(`Failed to upload image: ${imagePath}`)
			}
		}

		return uploadedImages
	}

	async readImageAsBlob(imagePath: string): Promise<Blob> {
		const response = await fetch(imagePath)
		const blob = await response.blob()
		return blob
	}

	replaceImagePaths(
		content: string,
		uploadedImages: { [key: string]: string }
	): string {
		for (const [localPath, remotePath] of Object.entries(uploadedImages)) {
			content = content.replace(localPath, remotePath)
		}
		return content
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
	}
}
