import { Setting, Notice } from 'obsidian'
import StrapiExporterPlugin from '../main'

interface ConfigStatus {
	key: string
	status: boolean
	description: string
}

interface QuickLink {
	name: string
	description: string
	targetTab: string
	icon?: string
}

export class Dashboard {
	private plugin: StrapiExporterPlugin
	private containerEl: HTMLElement

	constructor(plugin: StrapiExporterPlugin, containerEl: HTMLElement) {
		this.plugin = plugin
		this.containerEl = containerEl
	}

	display(): void {
		try {
			const { containerEl } = this
			containerEl.empty()

			this.createHeader()
			this.addSummary()
			this.addQuickLinks()
		} catch (error) {
			new Notice('Error displaying dashboard' + error.message)
		}
	}

	private createHeader(): void {
		const headerEl = this.containerEl.createEl('div', {
			cls: 'dashboard-header',
		})
		headerEl.createEl('h2', {
			text: 'Strapi Exporter Dashboard',
			cls: 'dashboard-title',
		})

		headerEl.createEl('p', {
			text: 'Overview of your Strapi export configuration and quick access to settings.',
			cls: 'dashboard-description',
		})
	}

	private addSummary(): void {
		const summaryEl = this.containerEl.createEl('div', {
			cls: 'dashboard-summary',
		})

		const configStatus = this.getConfigurationStatus()
		summaryEl.createEl('h3', {
			text: 'Configuration Status',
			cls: 'dashboard-section-title',
		})

		this.createStatusList(summaryEl, configStatus)
	}

	private createStatusList(
		container: HTMLElement,
		statuses: ConfigStatus[]
	): void {
		const statusList = container.createEl('ul', { cls: 'status-list' })

		statuses.forEach(({ key, status, description }) => {
			const listItem = statusList.createEl('li', { cls: 'status-item' })

			// Status icon
			listItem.createSpan({
				text: status ? '✅ ' : '❌ ',
				cls: `status-icon ${status ? 'status-ok' : 'status-error'}`,
			})

			// Status text
			const textContainer = listItem.createSpan({ cls: 'status-text' })
			textContainer.createSpan({ text: key, cls: 'status-key' })
			textContainer.createSpan({ text: description, cls: 'status-description' })
		})
	}

	private addQuickLinks(): void {
		const quickLinksEl = this.containerEl.createEl('div', {
			cls: 'dashboard-quick-links',
		})

		quickLinksEl.createEl('h3', {
			text: 'Quick Links',
			cls: 'dashboard-section-title',
		})

		this.quickLinks.forEach(link => {
			this.createQuickLink(quickLinksEl, link)
		})
	}

	private createQuickLink(container: HTMLElement, link: QuickLink): void {
		new Setting(container)
			.setName(link.name)
			.setDesc(link.description)
			.addButton(button => {
				button
					.setButtonText(`Go to ${link.name}`)
					.setCta()
					.onClick(() => {
						this.navigateToTab(link.targetTab)
					})
			})
	}

	private navigateToTab(tab: string): void {
		try {
			this.plugin.settings.currentTab = tab
			this.plugin.settingsTab.display()
		} catch (error) {
			new Notice(`Failed to navigate to ${tab}` + error.message)
		}
	}

	private getConfigurationStatus(): ConfigStatus[] {
		const { settings } = this.plugin
		return [
			{
				key: 'Strapi URL',
				status: !!settings.strapiUrl,
				description: 'Connection to your Strapi instance',
			},
			{
				key: 'Strapi API Token',
				status: !!settings.strapiApiToken,
				description: 'Authentication token for Strapi API',
			},
			{
				key: 'ForVoyez API Key',
				status: !!settings.forvoyezApiKey,
				description: 'API key for ForVoyez integration',
			},
			{
				key: 'OpenAI API Key',
				status: !!settings.openaiApiKey,
				description: 'API key for AI-powered features',
			},
			{
				key: 'Schema Configured',
				status: settings.routes.some(route => !!route.schema),
				description: 'Strapi schema configuration',
			},
			{
				key: 'Routes Configured',
				status: settings.routes.length > 0,
				description: 'Export route configuration',
			},
		]
	}

	private readonly quickLinks: QuickLink[] = [
		{
			name: 'Configuration',
			description: 'Set up your Strapi schema and field mappings',
			targetTab: 'configuration',
			icon: 'settings',
		},
		{
			name: 'API Keys',
			description: 'Configure your API keys',
			targetTab: 'apiKeys',
			icon: 'key',
		},
		{
			name: 'Routes',
			description: 'Manage your export routes',
			targetTab: 'routes',
			icon: 'git-branch',
		},
	]
}
