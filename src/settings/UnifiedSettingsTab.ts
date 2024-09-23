import {
	App,
	PluginSettingTab,
	Setting,
	TextAreaComponent,
	Notice,
	ButtonComponent,
} from 'obsidian'
import StrapiExporterPlugin from '../main'
import { OpenAI } from 'openai'
import { IconConfig } from '../types/settings'

export class UnifiedSettingsTab extends PluginSettingTab {
	plugin: StrapiExporterPlugin
	schemaInput: TextAreaComponent
	descriptionInput: TextAreaComponent
	configOutput: TextAreaComponent
	currentTab: string = 'auto'

	constructor(app: App, plugin: StrapiExporterPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()

		this.createTabButtons(containerEl)

		const contentContainer = containerEl.createDiv('content-container')
		this.updateContent(contentContainer)
	}

	createTabButtons(containerEl: HTMLElement): void {
		const tabsContainer = containerEl.createDiv('nav-buttons-container')
		tabsContainer.style.marginBottom = '20px'

		const createTabButton = (id: string, name: string) => {
			const btn = new ButtonComponent(tabsContainer)
				.setButtonText(name)
				.onClick(() => {
					this.currentTab = id
					this.display()
				})

			if (this.currentTab === id) {
				btn.buttonEl.addClass('is-active')
			}
		}

		createTabButton('auto', 'Auto Configuration')
		createTabButton('manual', 'Manual Configuration')
		createTabButton('icons', 'Icons')
	}

	updateContent(containerEl: HTMLElement): void {
		switch (this.currentTab) {
			case 'auto':
				this.displayAutoConfigTab(containerEl)
				break
			case 'manual':
				this.displayManualConfigTab(containerEl)
				break
			case 'icons':
				this.displayIconsConfigTab(containerEl)
				break
		}
	}

	displayAutoConfigTab(containerEl: HTMLElement): void {
		containerEl.createEl('h2', { text: 'Auto Configuration' })

		this.addSchemaConfigSection(containerEl)
	}

	displayManualConfigTab(containerEl: HTMLElement): void {
		containerEl.createEl('h2', { text: 'Manual Configuration' })

		this.addGeneralSettings(containerEl)
	}

	displayIconsConfigTab(containerEl: HTMLElement): void {
		containerEl.createEl('h2', { text: 'Icons Configuration' })

		this.addIconConfigSection(containerEl)
	}

	addGeneralSettings(containerEl: HTMLElement): void {
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
			.setName('Strapi API token')
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
			.setName('OpenAI API key')
			.setDesc('Enter your OpenAI API key')
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
			.setName('ForVoyez API key')
			.setDesc('Enter your ForVoyez API key')
			.addText(text =>
				text
					.setPlaceholder('Enter your ForVoyez API key')
					.setValue(this.plugin.settings.forvoyezApiKey)
					.onChange(async value => {
						this.plugin.settings.forvoyezApiKey = value
						await this.plugin.saveSettings()
					})
			)
	}

	addSchemaConfigSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Strapi Schema')
			.setDesc('Paste your Strapi schema JSON here')
			.addTextArea(text => {
				this.schemaInput = text
				text
					.setValue(this.plugin.settings.strapiSchema || '')
					.onChange(async value => {
						this.plugin.settings.strapiSchema = value
						await this.plugin.saveSettings()
					})
				text.inputEl.rows = 10
				text.inputEl.cols = 50
			})

		new Setting(containerEl)
			.setName('Schema Description')
			.setDesc(
				'Provide additional description or context for the schema fields'
			)
			.addTextArea(text => {
				this.descriptionInput = text
				text
					.setValue(this.plugin.settings.schemaDescription || '')
					.onChange(async value => {
						this.plugin.settings.schemaDescription = value
						await this.plugin.saveSettings()
					})
				text.inputEl.rows = 5
				text.inputEl.cols = 50
			})

		new Setting(containerEl)
			.setName('Generate Configuration')
			.setDesc(
				'Use OpenAI to generate a configuration based on the schema and description'
			)
			.addButton(button =>
				button.setButtonText('Generate').onClick(async () => {
					await this.generateConfiguration()
				})
			)

		new Setting(containerEl)
			.setName('Generated Configuration')
			.setDesc(
				'The generated configuration will appear here. You can edit it if needed.'
			)
			.addTextArea(text => {
				this.configOutput = text
				text
					.setValue(this.plugin.settings.generatedConfig || '')
					.onChange(async value => {
						this.plugin.settings.generatedConfig = value
						await this.plugin.saveSettings()
					})
				text.inputEl.rows = 10
				text.inputEl.cols = 50
			})

		new Setting(containerEl)
			.setName('Apply Configuration')
			.setDesc('Use this configuration for the plugin')
			.addButton(button =>
				button.setButtonText('Apply').onClick(async () => {
					await this.applyConfiguration()
				})
			)
	}

	addIconConfigSection(containerEl: HTMLElement): void {
		this.plugin.settings.icons.forEach((iconConfig, index) => {
			this.createIconConfigSettings(containerEl, iconConfig, index)
		})

		new Setting(containerEl)
			.setName('Add New Icon')
			.setDesc('Add a new icon configuration')
			.addButton(button =>
				button.setButtonText('+').onClick(async () => {
					this.plugin.settings.icons.push({
						id: `icon-${Date.now()}`,
						icon: 'star',
						title: 'New Icon',
						enabled: true,
					})
					await this.plugin.saveSettings()
					this.display()
				})
			)
	}

	createIconConfigSettings(
		containerEl: HTMLElement,
		iconConfig: IconConfig,
		index: number
	): void {
		const iconSetting = new Setting(containerEl)
			.setName(`Icon ${index + 1}`)
			.setDesc('Configure icon settings')
			.addText(text =>
				text
					.setPlaceholder('Icon name')
					.setValue(iconConfig.icon)
					.onChange(async value => {
						iconConfig.icon = value
						await this.plugin.saveSettings()
						this.plugin.updateRibbonIcons()
					})
			)
			.addText(text =>
				text
					.setPlaceholder('Icon title')
					.setValue(iconConfig.title)
					.onChange(async value => {
						iconConfig.title = value
						await this.plugin.saveSettings()
						this.plugin.updateRibbonIcons()
					})
			)
			.addToggle(toggle =>
				toggle.setValue(iconConfig.enabled).onChange(async value => {
					iconConfig.enabled = value
					await this.plugin.saveSettings()
					this.plugin.updateRibbonIcons()
				})
			)

		if (index > 1) {
			iconSetting.addButton(button =>
				button
					.setIcon('trash')
					.setTooltip('Delete this icon')
					.onClick(async () => {
						this.plugin.settings.icons.splice(index, 1)
						await this.plugin.saveSettings()
						this.plugin.updateRibbonIcons()
						this.display()
					})
			)
		}
	}

	async generateConfiguration() {
		const openai = new OpenAI({
			apiKey: this.plugin.settings.openaiApiKey,
			dangerouslyAllowBrowser: true,
		})

		const prompt = `
        Given the following Strapi schema and description, generate a configuration for an Obsidian plugin that will export notes to this Strapi schema. The configuration should include field mappings, any necessary transformations, and explanations for each field.

        Schema:
        ${this.schemaInput.getValue()}

        Description:
        ${this.descriptionInput.getValue()}

        Please provide the configuration as a JSON object with the following structure:
        {
            "fieldMappings": {
                "strapiFieldName": {
                    "obsidianField": "string (e.g., 'title', 'body', 'frontmatter.category')",
                    "transformation": "string (any necessary transformation logic)",
                    "description": "string (explanation of this field)"
                }
            },
            "additionalInstructions": "string (any additional instructions for using this configuration)"
        }
        `

		try {
			const response = await openai.chat.completions.create({
				model: 'gpt-3.5-turbo',
				messages: [{ role: 'user', content: prompt }],
				max_tokens: 1000,
			})

			this.configOutput.setValue(response.choices[0].message.content || '')
			this.plugin.settings.generatedConfig = this.configOutput.getValue()
			await this.plugin.saveSettings()
		} catch (error) {
			console.error('Error generating configuration:', error)
			this.configOutput.setValue(
				'Error generating configuration. Please check your OpenAI API key and try again.'
			)
		}
	}

	async applyConfiguration() {
		try {
			const config = JSON.parse(this.configOutput.getValue())
			this.plugin.settings.fieldMappings = config.fieldMappings
			this.plugin.settings.additionalInstructions =
				config.additionalInstructions
			await this.plugin.saveSettings()
			new Notice('Configuration applied successfully!')
		} catch (error) {
			console.error('Error applying configuration:', error)
			new Notice(
				'Error applying configuration. Please check the JSON format and try again.'
			)
		}
	}
}
