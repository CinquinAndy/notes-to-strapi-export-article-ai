// src/components/Configuration.ts
import { Setting, TextAreaComponent } from 'obsidian'
import StrapiExporterPlugin from '../main'
import { OpenAI } from 'openai'

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
		this.addRouteConfigSection()
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
			.addButton(button =>
				button
					.setButtonText('Generate Configuration')
					.onClick(() => this.generateConfiguration())
			)

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
			.addButton(button =>
				button.setButtonText('Apply').onClick(() => this.applyConfiguration())
			)
	}

	private addRouteConfigSection(): void {
		// Implementation for route configuration
		// This will include selecting a route and configuring its schema and field descriptions
	}

	private async generateConfiguration(): Promise<void> {
		// Implementation for generating configuration using OpenAI
	}

	private async applyConfiguration(): Promise<void> {
		// Implementation for applying the generated configuration
	}
}
