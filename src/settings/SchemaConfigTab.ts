import { App, PluginSettingTab, Setting, TextAreaComponent } from 'obsidian'
import StrapiExporterPlugin from '../main'
import { OpenAI } from 'openai'

export class SchemaConfigTab extends PluginSettingTab {
	plugin: StrapiExporterPlugin
	schemaInput: TextAreaComponent
	descriptionInput: TextAreaComponent
	configOutput: TextAreaComponent

	constructor(app: App, plugin: StrapiExporterPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()

		containerEl.createEl('h2', {
			text: 'Strapi Schema Configuration Assistant',
		})

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
