import { App, PluginSettingTab, Notice } from 'obsidian'
import StrapiExporterPlugin from '../main'
import { Dashboard } from '../components/Dashboard'
import { Configuration } from '../components/Configuration'
import { APIKeys } from '../components/APIKeys'
import { Routes } from '../components/Routes'

interface TabDefinition {
	id: string
	name: string
	icon?: string
	description?: string
	component?: any
}

export class UnifiedSettingsTab extends PluginSettingTab {
	plugin: StrapiExporterPlugin
	private components: {
		dashboard?: Dashboard
		configuration?: Configuration
		apiKeys?: APIKeys
		routes?: Routes
	} = {}
	private contentContainer: HTMLElement

	private readonly tabs: TabDefinition[] = [
		{
			id: 'dashboard',
			name: 'Dashboard',
			icon: 'gauge',
			description: 'Overview and status',
		},
		{
			id: 'configuration',
			name: 'Configuration',
			icon: 'settings',
			description: 'Configure export settings',
		},
		{
			id: 'apiKeys',
			name: 'API Keys',
			icon: 'key',
			description: 'Manage API credentials',
		},
		{
			id: 'routes',
			name: 'Routes',
			icon: 'git-branch',
			description: 'Configure export routes',
		},
	]

	constructor(app: App, plugin: StrapiExporterPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		try {
			const { containerEl } = this
			containerEl.empty()

			this.createHeader()
			this.createTabNavigation()
			this.createContentContainer()
			this.updateContent()
		} catch (error) {
			this.showError('Failed to display settings' + error.message)
		}
	}

	private createHeader(): void {
		const headerEl = this.containerEl.createDiv('settings-header')

		headerEl.createEl('h1', {
			text: 'Strapi Exporter Settings',
			cls: 'settings-title',
		})

		headerEl.createEl('p', {
			text: 'Configure your Strapi export settings and manage your integrations.',
			cls: 'settings-description',
		})
	}

	private createTabNavigation(): void {
		const navContainer = this.containerEl.createDiv('strapi-exporter-nav')

		this.tabs.forEach(tab => {
			this.createTabButton(navContainer, tab)
		})
	}

	private createTabButton(container: HTMLElement, tab: TabDefinition): void {
		const button = container.createEl('button', {
			cls: 'strapi-exporter-nav-button',
		})

		// Icon if provided
		if (tab.icon) {
			button.createSpan({
				cls: `nav-icon ${tab.icon}`,
				attr: { 'aria-hidden': 'true' },
			})
		}

		// Button text
		button.createSpan({
			text: tab.name,
			cls: 'nav-text',
		})

		// Add tooltip with description
		if (tab.description) {
			button.setAttribute('aria-label', tab.description)
			button.setAttribute('title', tab.description)
		}

		// Set active state
		if (this.plugin.settings.currentTab === tab.id) {
			button.addClass('is-active')
		}

		// Add click handler
		button.addEventListener('click', () => {
			this.handleTabChange(tab.id, container, button)
		})
	}

	private createContentContainer(): void {
		this.contentContainer = this.containerEl.createDiv(
			'strapi-exporter-content'
		)
	}

	private handleTabChange(
		tabId: string,
		container: HTMLElement,
		button: HTMLElement
	): void {
		try {
			this.plugin.settings.currentTab = tabId
			this.updateActiveButton(container, button)
			this.updateContent()
		} catch (error) {
			this.showError('Failed to change tab' + error.message)
		}
	}

	private updateActiveButton(
		container: HTMLElement,
		activeButton: HTMLElement
	): void {
		container.findAll('.strapi-exporter-nav-button').forEach(btn => {
			btn.removeClass('is-active')
		})
		activeButton.addClass('is-active')
	}

	private updateContent(): void {
		try {
			this.contentContainer.empty()
			const currentTab = this.plugin.settings.currentTab

			// Always reinitialize component to ensure fresh container reference
			this.initializeComponent(currentTab)

			this.components[currentTab]?.display()
		} catch (error) {
			this.showError('Failed to update content' + error.message)
		}
	}

	private initializeComponent(tabId: string): void {
		switch (tabId) {
			case 'dashboard':
				this.components.dashboard = new Dashboard(
					this.plugin,
					this.contentContainer
				)
				break
			case 'configuration':
				this.components.configuration = new Configuration(
					this.plugin,
					this.contentContainer
				)
				break
			case 'apiKeys':
				this.components.apiKeys = new APIKeys(
					this.plugin,
					this.contentContainer
				)
				break
			case 'routes':
				this.components.routes = new Routes(this.plugin, this.contentContainer)
				break
			default:
				throw new Error(`Unknown tab: ${tabId}`)
		}
	}

	private showError(message: string): void {
		new Notice(`Settings Error: ${message}`)
	}
}
