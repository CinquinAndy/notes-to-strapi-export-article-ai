import { App, PluginSettingTab, Notice } from 'obsidian'
import StrapiExporterPlugin from '../main'
import { Dashboard } from '../components/Dashboard'
import { Configuration } from '../components/Configuration'
import { APIKeys } from '../components/APIKeys'
import { Routes } from '../components/Routes'
import { Logger } from '../utils/logger'

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
		Logger.info('Settings', '451. UnifiedSettingsTab constructed')
	}

	display(): void {
		Logger.info('Settings', '452. Displaying settings tab')
		try {
			const { containerEl } = this
			containerEl.empty()

			this.createHeader()
			this.createTabNavigation()
			this.createContentContainer()
			this.updateContent()

			Logger.info('Settings', '453. Settings tab displayed successfully')
		} catch (error) {
			Logger.error('Settings', '454. Error displaying settings tab', error)
			this.showError('Failed to display settings')
		}
	}

	private createHeader(): void {
		Logger.debug('Settings', '455. Creating settings header')
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
		Logger.debug('Settings', '456. Creating tab navigation')

		const navContainer = this.containerEl.createDiv('strapi-exporter-nav')

		this.tabs.forEach(tab => {
			this.createTabButton(navContainer, tab)
		})
	}

	private createTabButton(container: HTMLElement, tab: TabDefinition): void {
		Logger.debug('Settings', `457. Creating button for tab: ${tab.id}`)

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
		Logger.debug('Settings', '458. Creating content container')
		this.contentContainer = this.containerEl.createDiv(
			'strapi-exporter-content'
		)
	}

	private handleTabChange(
		tabId: string,
		container: HTMLElement,
		button: HTMLElement
	): void {
		Logger.info('Settings', `459. Handling tab change to: ${tabId}`)

		try {
			this.plugin.settings.currentTab = tabId
			this.updateActiveButton(container, button)
			this.updateContent()

			Logger.debug('Settings', '460. Tab change handled successfully')
		} catch (error) {
			Logger.error(
				'Settings',
				`461. Error handling tab change to ${tabId}`,
				error
			)
			this.showError('Failed to change tab')
		}
	}

	private updateActiveButton(
		container: HTMLElement,
		activeButton: HTMLElement
	): void {
		Logger.debug('Settings', '462. Updating active button state')

		container.findAll('.strapi-exporter-nav-button').forEach(btn => {
			btn.removeClass('is-active')
		})
		activeButton.addClass('is-active')
	}

	private updateContent(): void {
		Logger.info(
			'Settings',
			`463. Updating content for tab: ${this.plugin.settings.currentTab}`
		)

		try {
			this.contentContainer.empty()
			const currentTab = this.plugin.settings.currentTab

			if (!this.components[currentTab]) {
				this.initializeComponent(currentTab)
			}

			this.components[currentTab]?.display()
			Logger.debug('Settings', '464. Content updated successfully')
		} catch (error) {
			Logger.error('Settings', '465. Error updating content', error)
			this.showError('Failed to update content')
		}
	}

	private initializeComponent(tabId: string): void {
		Logger.debug('Settings', `466. Initializing component for: ${tabId}`)

		try {
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
					this.components.routes = new Routes(
						this.plugin,
						this.contentContainer
					)
					break
				default:
					Logger.error('Settings', `467. Unknown tab: ${tabId}`)
					throw new Error(`Unknown tab: ${tabId}`)
			}
		} catch (error) {
			Logger.error(
				'Settings',
				`468. Error initializing component for ${tabId}`,
				error
			)
			throw error
		}
	}

	private showError(message: string): void {
		Logger.error('Settings', '469. Showing error message', { message })
		new Notice(`Settings Error: ${message}`)
	}
}
