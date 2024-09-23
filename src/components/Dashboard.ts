// src/components/Dashboard.ts
import { Setting } from 'obsidian'
import StrapiExporterPlugin from '../main'

export class Dashboard {
	private plugin: StrapiExporterPlugin
	private containerEl: HTMLElement

	constructor(plugin: StrapiExporterPlugin, containerEl: HTMLElement) {
		this.plugin = plugin
		this.containerEl = containerEl
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()

		containerEl.createEl('h2', { text: 'Strapi Exporter Dashboard' })

		this.addSummary()
		this.addQuickLinks()
	}

	private addSummary(): void {
		const summaryEl = this.containerEl.createEl('div', {
			cls: 'dashboard-summary',
		})

		const configStatus = this.getConfigurationStatus()
		summaryEl.createEl('h3', { text: 'Configuration Status' })

		const statusList = summaryEl.createEl('ul')
		for (const [key, value] of Object.entries(configStatus)) {
			const listItem = statusList.createEl('li')
			listItem.createSpan({ text: `${key}: ` })
			listItem.createSpan({
				text: value ? '✅' : '❌',
				cls: value ? 'status-ok' : 'status-error',
			})
		}
	}

	private addQuickLinks(): void {
		const quickLinksEl = this.containerEl.createEl('div', {
			cls: 'dashboard-quick-links',
		})
		quickLinksEl.createEl('h3', { text: 'Quick Links' })

		new Setting(quickLinksEl)
			.setName('Configuration')
			.setDesc('Set up your Strapi schema and field mappings')
			.addButton(button =>
				button.setButtonText('Go to Configuration').onClick(() => {
					this.plugin.settings.currentTab = 'configuration'
					this.plugin.settingsTab.display()
				})
			)

		new Setting(quickLinksEl)
			.setName('API Keys')
			.setDesc('Configure your API keys')
			.addButton(button =>
				button.setButtonText('Go to API Keys').onClick(() => {
					this.plugin.settings.currentTab = 'apiKeys'
					this.plugin.settingsTab.display()
				})
			)

		new Setting(quickLinksEl)
			.setName('Routes')
			.setDesc('Manage your export routes')
			.addButton(button =>
				button.setButtonText('Go to Routes').onClick(() => {
					this.plugin.settings.currentTab = 'routes'
					this.plugin.settingsTab.display()
				})
			)
	}

	private getConfigurationStatus(): { [key: string]: boolean } {
		const { settings } = this.plugin
		return {
			'Strapi URL': !!settings.strapiUrl,
			'Strapi API Token': !!settings.strapiApiToken,
			'ForVoyez API Key': !!settings.forvoyezApiKey,
			'OpenAI API Key': !!settings.openaiApiKey,
			'Schema Configured': !!settings.strapiSchema,
			'Routes Configured': settings.routes.length > 0,
		}
	}
}
