import { App, Notice, PluginSettingTab, Setting } from 'obsidian'
import StrapiExporterPlugin from './main'
import { validateJsonTemplate } from './utils/validators'

export class StrapiExporterSettingTab extends PluginSettingTab {
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
		containerEl.createEl('h1', { text: 'Strapi & OpenAI Settings' })
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

		containerEl.createEl('h1', { text: 'Strapi Settings - Call 1' })

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
						if (validateJsonTemplate(value)) {
							this.plugin.settings.jsonTemplate = value
							await this.plugin.saveSettings()
							new Notice('JSON template saved successfully. (valid !)')
						} else {
							new Notice(
								'Invalid JSON template. Please enter a valid JSON template.'
							)
						}
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

		containerEl.createEl('h2', { text: 'Main Image Settings' })

		new Setting(containerEl)
			.setName('Enable Main Image')
			.setDesc('Toggle the main image')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.mainButtonImageEnabled)
					.onChange(async value => {
						this.plugin.settings.mainButtonImageEnabled = value
						await this.plugin.saveSettings()
						this.display()
					})
			)

		if (this.plugin.settings.mainButtonImageEnabled) {
			// Display main image settings
			containerEl.createEl('p', {
				text: 'For the plugin to detect images and galleries, ensure the following folder structure:',
			})

			containerEl.createEl('ul', {
				text: '- Article file (e.g., article.md)',
			})
			containerEl.createEl('ul', {
				text: '- Main image folder (name: image)',
			})

			containerEl.createEl('p', {
				text: 'The plugin will detect images in the main image (for this api call)',
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
		}

		containerEl.createEl('h2', { text: 'Main Gallery Settings' })

		new Setting(containerEl)
			.setName('Enable Main Gallery')
			.setDesc('Toggle the main gallery')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.mainButtonGalleryEnabled)
					.onChange(async value => {
						this.plugin.settings.mainButtonGalleryEnabled = value
						await this.plugin.saveSettings()
						this.display()
					})
			)

		if (this.plugin.settings.mainButtonGalleryEnabled) {
			containerEl.createEl('p', {
				text: 'For the plugin to detect galleries, ensure the following folder structure:',
			})

			containerEl.createEl('ul', {
				text: '- Article file (e.g., article.md)',
			})
			containerEl.createEl('ul', {
				text: '- Main gallery folder (name: gallery)',
			})

			containerEl.createEl('p', {
				text: 'The plugin will detect images in the main gallery folders. (for this api call)',
			})

			new Setting(containerEl)
				.setName('Main Gallery Full Path Property')
				.setDesc(
					'Enter the full path property for the main gallery in the final call'
				)
				.addText(text =>
					text
						.setPlaceholder('data.attributes.gallery')
						.setValue(this.plugin.settings.mainGalleryFullPathProperty)
						.onChange(async value => {
							this.plugin.settings.mainGalleryFullPathProperty = value
							await this.plugin.saveSettings()
						})
				)
		}

		containerEl.createEl('h1', {
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
							if (validateJsonTemplate(value)) {
								this.plugin.settings.additionalJsonTemplate = value
								await this.plugin.saveSettings()
								new Notice('JSON template saved successfully. (valid !)')
							} else {
								new Notice(
									'Invalid additional JSON template. Please enter a valid JSON template.'
								)
							}
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

			containerEl.createEl('h2', { text: 'Additional Call api Image Settings' })

			new Setting(containerEl)
				.setName('Enable Additional Call API Image')
				.setDesc('Toggle the additional Call API image')
				.addToggle(toggle =>
					toggle
						.setValue(this.plugin.settings.additionalButtonImageEnabled)
						.onChange(async value => {
							this.plugin.settings.additionalButtonImageEnabled = value
							await this.plugin.saveSettings()
							this.display()
						})
				)

			if (this.plugin.settings.additionalButtonImageEnabled) {
				containerEl.createEl('p', {
					text: 'For the plugin to detect images and galleries, ensure the following folder structure:',
				})

				containerEl.createEl('ul', {
					text: '- Article file (e.g., article.md)',
				})
				containerEl.createEl('ul', {
					text: '- Main image folder (name: image)',
				})

				containerEl.createEl('p', {
					text: 'The plugin will detect images in the main image (for this api call)',
				})

				new Setting(containerEl)
					.setName('Additional Call API Image Full Path Property')
					.setDesc(
						'Enter the full path property for the additional Call API image in the final call'
					)
					.addText(text =>
						text
							.setPlaceholder('image_presentation')
							.setValue(this.plugin.settings.additionalImageFullPathProperty)
							.onChange(async value => {
								this.plugin.settings.additionalImageFullPathProperty = value
								await this.plugin.saveSettings()
							})
					)
			}

			containerEl.createEl('h2', {
				text: 'Additional Call API Gallery Settings',
			})

			new Setting(containerEl)
				.setName('Enable Additional Call API Gallery')
				.setDesc('Toggle the additional Call API gallery')
				.addToggle(toggle =>
					toggle
						.setValue(this.plugin.settings.additionalButtonGalleryEnabled)
						.onChange(async value => {
							this.plugin.settings.additionalButtonGalleryEnabled = value
							await this.plugin.saveSettings()
							this.display()
						})
				)

			if (this.plugin.settings.additionalButtonGalleryEnabled) {
				containerEl.createEl('p', {
					text: 'For the plugin to detect galleries, ensure the following folder structure:',
				})

				containerEl.createEl('ul', {
					text: '- Article file (e.g., article.md)',
				})
				containerEl.createEl('ul', {
					text: '- Main gallery folder (name: gallery)',
				})

				containerEl.createEl('p', {
					text: 'The plugin will detect images in the main gallery folders. (for this api call)',
				})

				new Setting(containerEl)
					.setName('Additional Call API Gallery Full Path Property')
					.setDesc(
						'Enter the full path property for the additional Call API gallery in the final call'
					)
					.addText(text =>
						text
							.setPlaceholder('galery')
							.setValue(this.plugin.settings.additionalGalleryFullPathProperty)
							.onChange(async value => {
								this.plugin.settings.additionalGalleryFullPathProperty = value
								await this.plugin.saveSettings()
							})
					)
			}
		}
	}
}
