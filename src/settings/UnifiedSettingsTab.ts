// src/settings/UnifiedSettingsTab.ts
import { App, PluginSettingTab, Setting } from 'obsidian'
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

		this.contentContainer = containerEl.createDiv('content-container')
		this.updateContent()
	}

	createTabButtons(containerEl: HTMLElement): void {
		console.log('Creating tab buttons')
		const tabsContainer = containerEl.createDiv('nav-buttons-container')
		tabsContainer.style.marginBottom = '20px'
		tabsContainer.style.display = 'flex'
		tabsContainer.style.justifyContent = 'space-around'

		const createTabButton = (id: string, name: string) => {
			console.log(`Creating button for ${id}`)
			const btn = new Setting(tabsContainer).addButton(button =>
				button.setButtonText(name).onClick(() => {
					console.log(`${id} button clicked`)
					this.plugin.settings.currentTab = id
					this.updateContent()
				})
			)

			// Remove the setting name and description
			btn.nameEl.remove()
			btn.descEl.remove()

			// Style the button
			btn.settingEl.style.border = 'none'
			btn.settingEl.style.padding = '0'

			if (this.plugin.settings.currentTab === id) {
				btn.settingEl.addClass('is-active')
			}
		}

		createTabButton('dashboard', 'Dashboard')
		createTabButton('configuration', 'Configuration')
		createTabButton('apiKeys', 'API Keys')
		createTabButton('routes', 'Routes')
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
