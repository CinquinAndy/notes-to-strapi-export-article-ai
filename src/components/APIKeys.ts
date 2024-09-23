// src/components/APIKeys.ts
import { Setting } from 'obsidian'
import StrapiExporterPlugin from '../main'

export class APIKeys {
	private plugin: StrapiExporterPlugin
	private containerEl: HTMLElement

	constructor(plugin: StrapiExporterPlugin, containerEl: HTMLElement) {
		this.plugin = plugin
		this.containerEl = containerEl
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()

		containerEl.createEl('h2', { text: 'API Keys Configuration' })

		this.addStrapiSettings()
		this.addForVoyezSettings()
		this.addOpenAISettings()
	}

	private addStrapiSettings(): void {
		new Setting(this.containerEl)
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

		new Setting(this.containerEl)
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

	private addForVoyezSettings(): void {
		new Setting(this.containerEl)
			.setName('ForVoyez API Key')
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

	private addOpenAISettings(): void {
		new Setting(this.containerEl)
			.setName('OpenAI API Key')
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
	}
}
