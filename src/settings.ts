import { App, PluginSettingTab, Setting, TFile, TFolder } from 'obsidian'
import StrapiExporterPlugin from './main'

export class StrapiExporterSettingTab extends PluginSettingTab {
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
		// Display settings fields
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
						this.updateImageCounts()
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
						this.updateImageCounts()
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
						this.updateImageCounts()
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
						this.updateImageCounts()
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
							this.updateImageCounts()
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
							this.updateImageCounts()
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
							this.updateImageCounts()
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
							this.updateImageCounts()
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

		this.updateImageCounts()
	}

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
		const mainImageFolder = this.app.vault.getAbstractFileByPath(
			this.plugin.settings.mainImage
		)
		if (mainImageFolder instanceof TFolder) {
			const mainImageCount = await this.countImagesInFolder(
				this.plugin.settings.mainImage
			)
			this.mainImageCountEl.setText(`Detected images: ${mainImageCount}`)
		}

		const mainGaleryFolder = this.app.vault.getAbstractFileByPath(
			this.plugin.settings.mainGalery
		)
		if (mainGaleryFolder instanceof TFolder) {
			const mainGaleryCount = await this.countImagesInFolder(
				this.plugin.settings.mainGalery
			)
			this.mainGaleryCountEl.setText(`Detected images: ${mainGaleryCount}`)
		}

		const additionalImageFolder = this.app.vault.getAbstractFileByPath(
			this.plugin.settings.additionalImage
		)
		if (additionalImageFolder instanceof TFolder) {
			const additionalImageCount = await this.countImagesInFolder(
				this.plugin.settings.additionalImage
			)
			this.additionalImageCountEl.setText(
				`Detected images: ${additionalImageCount}`
			)
		}

		const additionalGaleryFolder = this.app.vault.getAbstractFileByPath(
			this.plugin.settings.additionalGalery
		)
		if (additionalGaleryFolder instanceof TFolder) {
			const additionalGaleryCount = await this.countImagesInFolder(
				this.plugin.settings.additionalGalery
			)
			this.additionalGaleryCountEl.setText(
				`Detected images: ${additionalGaleryCount}`
			)
		}
	}
}
