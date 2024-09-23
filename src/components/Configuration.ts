// src/components/Configuration.ts
import { Setting, TextAreaComponent, ButtonComponent, Notice } from 'obsidian'
import StrapiExporterPlugin from '../main'
import OpenAI from 'openai'

export class Configuration {
	private plugin: StrapiExporterPlugin
	private containerEl: HTMLElement
	private schemaInput: TextAreaComponent
	private descriptionInput: TextAreaComponent
	private configOutput: TextAreaComponent

	constructor(plugin: StrapiExporterPlugin, containerEl: HTMLElement) {
		this.plugin = plugin
		this.containerEl = containerEl
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()

		containerEl.createEl('h2', { text: 'Configuration' })

		this.addSchemaConfigSection()
		this.addAutoConfigSection()
	}

	private addSchemaConfigSection(): void {
		new Setting(this.containerEl)
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

		new Setting(this.containerEl)
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

	private async generateConfiguration(): Promise<void> {
		const openai = new OpenAI({
			apiKey: this.plugin.settings.openaiApiKey,
			dangerouslyAllowBrowser: true,
		})

		const prompt = `
        Given the following Strapi schema and description, generate a comprehensive configuration for an Obsidian plugin that will export notes to this Strapi schema. The configuration should include field mappings, necessary transformations, and explanations for each field. Additionally, provide a template for the final JSON structure that will be sent to Strapi.

        Strapi Schema:
        ${this.schemaInput.getValue()}

        Schema Description:
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
            "additionalInstructions": "string (any additional instructions for using this configuration)",
            "strapiTemplate": {
                // Include here a complete template of the JSON structure to be sent to Strapi,
                // with placeholders for values that will be filled from Obsidian notes
            }
        }
        `

		try {
			new Notice('Generating configuration...')
			const response = await openai.chat.completions.create({
				model: 'gpt-4-mini',
				messages: [{ role: 'user', content: prompt }],
				response_format: { type: 'json_object' },
				max_tokens: 2000,
			})

			const generatedConfig = response.choices[0].message.content
			this.configOutput.setValue(generatedConfig || '')
			this.plugin.settings.generatedConfig = generatedConfig || ''
			await this.plugin.saveSettings()
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
