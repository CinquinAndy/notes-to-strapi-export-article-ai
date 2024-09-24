import {
	Setting,
	TextAreaComponent,
	ButtonComponent,
	Notice,
	DropdownComponent,
	TextComponent,
} from 'obsidian'
import StrapiExporterPlugin from '../main'
import OpenAI from 'openai'

export class Configuration {
	private plugin: StrapiExporterPlugin
	private containerEl: HTMLElement
	private schemaInput: TextAreaComponent
	private schemaDescriptionInput: TextAreaComponent
	private contentFieldInput: TextComponent
	private configOutput: TextAreaComponent
	private languageDropdown: DropdownComponent
	private routeSelector: DropdownComponent
	private currentRouteId: string

	constructor(plugin: StrapiExporterPlugin, containerEl: HTMLElement) {
		this.plugin = plugin
		this.containerEl = containerEl
		this.currentRouteId = this.plugin.settings.routes[0]?.id || ''
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()

		containerEl.createEl('h2', { text: 'Configuration' })

		this.addRouteSelector()
		this.addSchemaConfigSection()
		this.addContentFieldSection()
		this.addLanguageSection()
		this.addAutoConfigSection()
	}

	private addRouteSelector(): void {
		new Setting(this.containerEl)
			.setName('Select Route')
			.setDesc('Choose the route to configure')
			.addDropdown(dropdown => {
				this.routeSelector = dropdown
				this.plugin.settings.routes.forEach(route => {
					dropdown.addOption(route.id, route.name)
				})
				dropdown.setValue(this.currentRouteId)
				dropdown.onChange(async value => {
					this.currentRouteId = value
					this.updateConfigurationFields()
				})
			})
	}

	private updateConfigurationFields(): void {
		const currentRoute = this.plugin.settings.routes.find(
			route => route.id === this.currentRouteId
		)
		if (currentRoute) {
			this.schemaInput.setValue(currentRoute.schema || '')
			this.configOutput.setValue(currentRoute.generatedConfig || '')
			this.languageDropdown.setValue(currentRoute.language || 'en')
		}
	}

	private addLanguageSection(): void {
		new Setting(this.containerEl)
			.setName('Target Language')
			.setDesc('Select the target language for the exported content')
			.addDropdown(dropdown => {
				this.languageDropdown = dropdown
				dropdown
					.addOption('en', 'English')
					.addOption('fr', 'French')
					.addOption('es', 'Spanish')
					.addOption('de', 'German')
					.addOption('it', 'Italian')
					.addOption('zh', 'Chinese')
					.addOption('ja', 'Japanese')
					.addOption('ko', 'Korean')
					.addOption('pt', 'Portuguese')
					.addOption('ru', 'Russian')
					.addOption('ar', 'Arabic')
					.addOption('hi', 'Hindi')
					.setValue(this.getCurrentRouteLanguage())
					.onChange(async value => {
						await this.updateCurrentRouteConfig('language', value)
					})
			})
	}

	private addAutoConfigSection(): void {
		new Setting(this.containerEl)
			.setName('Auto-Configure')
			.setDesc('Automatically configure fields using OpenAI (Experimental)')
			.addButton((button: ButtonComponent) => {
				button
					.setButtonText('Generate Configuration')
					.setCta()
					.onClick(() => this.generateConfiguration())
			})

		new Setting(this.containerEl)
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

		new Setting(this.containerEl)
			.setName('Apply Configuration')
			.setDesc('Use this configuration for the plugin')
			.addButton((button: ButtonComponent) => {
				button
					.setButtonText('Apply')
					.setCta()
					.onClick(() => this.applyConfiguration())
			})
	}

	private addSchemaConfigSection(): void {
		new Setting(this.containerEl)
			.setName('Strapi Schema')
			.setDesc('Paste your complete Strapi schema JSON here')
			.addTextArea(text => {
				this.schemaInput = text
				text.setValue(this.getCurrentRouteSchema()).onChange(async value => {
					await this.updateCurrentRouteConfig('schema', value)
				})
				text.inputEl.rows = 10
				text.inputEl.cols = 50
			})

		new Setting(this.containerEl)
			.setName('Schema Description')
			.setDesc('Provide descriptions for each field in the schema')
			.addTextArea(text => {
				this.schemaDescriptionInput = text
				text
					.setValue(this.getCurrentRouteSchemaDescription())
					.onChange(async value => {
						await this.updateCurrentRouteConfig('schemaDescription', value)
					})
				text.inputEl.rows = 10
				text.inputEl.cols = 50
			})
	}

	private addContentFieldSection(): void {
		new Setting(this.containerEl)
			.setName('Content Field Name')
			.setDesc(
				'Enter the name of the field where the main article content should be inserted (for exemple, it could be "content" or "data.article.content")'
			)
			.addText(text => {
				this.contentFieldInput = text
				text
					.setValue(this.getCurrentRouteContentField())
					.onChange(async value => {
						await this.updateCurrentRouteConfig('contentField', value)
					})
			})
	}

	private async generateConfiguration(): Promise<void> {
		const openai = new OpenAI({
			apiKey: this.plugin.settings.openaiApiKey,
			dangerouslyAllowBrowser: true,
		})

		const prompt = `
        Given the following Strapi schema, field descriptions, content field name, and target language, generate a comprehensive configuration for an Obsidian plugin that will export notes to this Strapi schema. The configuration should include field mappings, necessary transformations, and explanations for each field.

        Strapi Schema:
        ${this.schemaInput.getValue()}

        Field Descriptions:
        ${this.schemaDescriptionInput.getValue()}

        Content Field Name: ${this.contentFieldInput.getValue()}

        Target Language: ${this.getCurrentRouteLanguage()}

        Please provide the configuration as a JSON object with the following structure:
        {
            "fieldMappings": {
                "strapiFieldName": {
                    "obsidianField": "string (e.g., 'title', 'body', 'frontmatter.category')",
                    "transformation": "string (any necessary transformation logic)",
                    "description": "string (explanation of this field)"
                }
            },
            "additionalInstructions": "string (any additional instructions for using this configuration)",
            "contentField": "string (the name of the field where the main article content should be inserted)",
            "targetLanguage": "string (the target language code)"
        }

        For the content field, use "{{ARTICLE_CONTENT}}" as a placeholder in the transformation logic.
        `

		try {
			new Notice('Generating configuration...')
			const response = await openai.chat.completions.create({
				model: 'gpt-4o-mini',
				messages: [{ role: 'user', content: prompt }],
				response_format: { type: 'json_object' },
				max_tokens: 2000,
			})

			const generatedConfig = response.choices[0].message.content
			this.configOutput.setValue(generatedConfig || '')
			await this.updateCurrentRouteConfig(
				'generatedConfig',
				generatedConfig || ''
			)
			new Notice('Configuration generated successfully!')
		} catch (error) {
			console.error('Error generating configuration:', error)
			new Notice(
				'Error generating configuration. Please check your OpenAI API key and try again.'
			)
		}
	}

	private async applyConfiguration(): Promise<void> {
		try {
			const config = JSON.parse(this.configOutput.getValue())
			this.plugin.settings.fieldMappings = config.fieldMappings
			this.plugin.settings.additionalInstructions =
				config.additionalInstructions
			this.plugin.settings.strapiTemplate = config.strapiTemplate
			this.plugin.settings.targetLanguage =
				config.targetLanguage || this.plugin.settings.targetLanguage
			await this.plugin.saveSettings()
			new Notice('Configuration applied successfully!')
		} catch (error) {
			console.error('Error applying configuration:', error)
			new Notice(
				'Error applying configuration. Please check the JSON format and try again.'
			)
		}
	}

	private getCurrentRouteSchema(): string {
		const currentRoute = this.plugin.settings.routes.find(
			route => route.id === this.currentRouteId
		)
		return currentRoute?.schema || ''
	}

	private getCurrentRouteSchemaDescription(): string {
		const currentRoute = this.plugin.settings.routes.find(
			route => route.id === this.currentRouteId
		)
		return currentRoute?.schemaDescription || ''
	}

	private getCurrentRouteLanguage(): string {
		const currentRoute = this.plugin.settings.routes.find(
			route => route.id === this.currentRouteId
		)
		return currentRoute?.language || 'en'
	}

	private getCurrentRouteContentField(): string {
		const currentRoute = this.plugin.settings.routes.find(
			route => route.id === this.currentRouteId
		)
		return currentRoute?.contentField || 'content'
	}

	private async updateCurrentRouteConfig(
		key: string,
		value: string
	): Promise<void> {
		const routeIndex = this.plugin.settings.routes.findIndex(
			route => route.id === this.currentRouteId
		)
		if (routeIndex !== -1) {
			this.plugin.settings.routes[routeIndex][key] = value
			await this.plugin.saveSettings()
		}
	}
}
