// src/settings/UnifiedSettingsTab.ts
import { App, PluginSettingTab } from 'obsidian'
import StrapiExporterPlugin from '../main'
import { Dashboard } from '../components/Dashboard'
import { Configuration } from '../components/Configuration'
import { APIKeys } from '../components/APIKeys'
import { Routes } from '../components/Routes'

export class UnifiedSettingsTab extends PluginSettingTab {
	plugin: StrapiExporterPlugin
	private dashboard: Dashboard
	private configuration: Configuration
	private apiKeys: APIKeys
	private routes: Routes
	private contentContainer: HTMLElement

	constructor(app: App, plugin: StrapiExporterPlugin) {
		super(app, plugin)
		this.plugin = plugin
		console.log('UnifiedSettingsTab constructed')
	}

	display(): void {
		console.log('UnifiedSettingsTab display called')
		const { containerEl } = this
		containerEl.empty()

		this.createTabButtons(containerEl)

		this.contentContainer = containerEl.createDiv('strapi-exporter-content')
		this.updateContent()
	}

	createTabButtons(containerEl: HTMLElement): void {
		console.log('Creating tab buttons')
		const tabsContainer = containerEl.createDiv('strapi-exporter-nav')

		const createTabButton = (id: string, name: string) => {
			console.log(`Creating button for ${id}`)
			const btn = tabsContainer.createEl('button', {
				text: name,
				cls: 'strapi-exporter-nav-button',
			})

			btn.addEventListener('click', () => {
				console.log(`${id} button clicked`)
				this.plugin.settings.currentTab = id
				this.updateContent()
				this.updateActiveButton(tabsContainer, btn)
			})

			if (this.plugin.settings.currentTab === id) {
				btn.addClass('is-active')
			}
		}

		createTabButton('dashboard', 'Dashboard')
		createTabButton('configuration', 'Configuration')
		createTabButton('apiKeys', 'API Keys')
		createTabButton('routes', 'Routes')
	}

	updateActiveButton(
		tabsContainer: HTMLElement,
		activeButton: HTMLElement
	): void {
		tabsContainer.findAll('.strapi-exporter-nav-button').forEach(btn => {
			btn.removeClass('is-active')
		})
		activeButton.addClass('is-active')
	}

	updateContent(): void {
		console.log(`Updating content for tab: ${this.plugin.settings.currentTab}`)
		this.contentContainer.empty()

		switch (this.plugin.settings.currentTab) {
			case 'dashboard':
				if (!this.dashboard) {
					this.dashboard = new Dashboard(this.plugin, this.contentContainer)
				}
				this.dashboard.display()
				break
			case 'configuration':
				if (!this.configuration) {
					this.configuration = new Configuration(
						this.plugin,
						this.contentContainer
					)
				}
				this.configuration.display()
				break
			case 'apiKeys':
				if (!this.apiKeys) {
					this.apiKeys = new APIKeys(this.plugin, this.contentContainer)
				}
				this.apiKeys.display()
				break
			case 'routes':
				if (!this.routes) {
					this.routes = new Routes(this.plugin, this.contentContainer)
				}
				this.routes.display()
				break
			default:
				console.error(`Unknown tab: ${this.plugin.settings.currentTab}`)
		}
	}
}
