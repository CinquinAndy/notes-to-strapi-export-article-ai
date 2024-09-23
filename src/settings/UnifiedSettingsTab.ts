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

	constructor(app: App, plugin: StrapiExporterPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()

		this.createTabButtons(containerEl)

		const contentContainer = containerEl.createDiv('content-container')
		this.updateContent(contentContainer)
	}

	createTabButtons(containerEl: HTMLElement): void {
		const tabsContainer = containerEl.createDiv('nav-buttons-container')
		tabsContainer.style.marginBottom = '20px'

		const createTabButton = (id: string, name: string) => {
			const btn = new Setting(tabsContainer).setName(name).addButton(button =>
				button.setButtonText(name).onClick(() => {
					this.plugin.settings.currentTab = id
					this.display()
				})
			)

			if (this.plugin.settings.currentTab === id) {
				btn.settingEl.addClass('is-active')
			}
		}

		createTabButton('dashboard', 'Dashboard')
		createTabButton('configuration', 'Configuration')
		createTabButton('apiKeys', 'API Keys')
		createTabButton('routes', 'Routes')
	}

	updateContent(containerEl: HTMLElement): void {
		switch (this.plugin.settings.currentTab) {
			case 'dashboard':
				if (!this.dashboard) {
					this.dashboard = new Dashboard(this.plugin, containerEl)
				}
				this.dashboard.display()
				break
			case 'configuration':
				if (!this.configuration) {
					this.configuration = new Configuration(this.plugin, containerEl)
				}
				this.configuration.display()
				break
			case 'apiKeys':
				if (!this.apiKeys) {
					this.apiKeys = new APIKeys(this.plugin, containerEl)
				}
				this.apiKeys.display()
				break
			case 'routes':
				if (!this.routes) {
					this.routes = new Routes(this.plugin, containerEl)
				}
				this.routes.display()
				break
		}
	}
}
