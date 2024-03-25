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
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	strapiUrl: '',
	strapiApiToken: '',
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
				const imageBlobs = await this.getImageBlobs(imagePaths, file.path)
				console.log('imageBlobs perfect:', imageBlobs)

				/**
				new Notice('Uploading images to Strapi...')

				const uploadedImages = await this.uploadImagesToStrapi(imageBlobs)

				console.log('uploadedImages:', uploadedImages)
				new Notice('Replacing image paths...')

				const updatedContent = this.replaceImagePaths(content, uploadedImages)

				await this.app.vault.modify(file, updatedContent)

				new Notice('Images uploaded and links updated successfully!')
				 */
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
		imageBlobs: { path: string; blob: Blob; name: string }[]
	): Promise<{ [key: string]: string }> {
		const uploadedImages: { [key: string]: string } = {}

		for (const imagePath of imageBlobs) {
			const formData = new FormData()
			formData.append('files', imagePath.blob, imagePath.path)

			console.log("formData.get('files'):", formData.get('files'))

			try {
				console.log('Uploading image:', imagePath, formData)
				const response = await fetch(`${this.settings.strapiUrl}/api/upload`, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${this.settings.strapiApiToken}`,
					},
					body: formData,
				})

				if (response.ok) {
					const data = await response.json()
					uploadedImages[imagePath.name] = data[0].url
				} else {
					new Notice(`Failed to upload image: ${imagePath}`)
					console.error(`Failed to upload image: ${imagePath}`)
					console.error('Error response:', await response.json())
				}
			} catch (error) {
				new Notice(`Error uploading image: ${imagePath}`)
				console.error(`Error uploading image: ${imagePath}`, error)
			}
		}

		return uploadedImages
	}

	replaceImagePaths(
		content: string,
		uploadedImages: { [key: string]: string }
	): string {
		for (const [localPath, remotePath] of Object.entries(uploadedImages)) {
			const markdownImageRegex = new RegExp(`!\\[\\[${localPath}\\]\\]`, 'g')
			content = content.replace(markdownImageRegex, `![](${remotePath})`)
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
	}
}
