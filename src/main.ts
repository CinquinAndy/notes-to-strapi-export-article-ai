// src/main.ts
import { Notice, Plugin } from 'obsidian'
import { DEFAULT_STRAPI_EXPORTER_SETTINGS } from './constants'
import { processMarkdownContent } from './utils/image-processor'
import { RouteConfig, StrapiExporterSettings } from './types/settings'
import { UnifiedSettingsTab } from './settings/UnifiedSettingsTab'

export default class StrapiExporterPlugin extends Plugin {
	settings: StrapiExporterSettings
	ribbonIcons: { [key: string]: HTMLElement } = {}
	settingsTab: UnifiedSettingsTab

	async onload() {
		console.log('StrapiExporterPlugin loading')
		await this.loadSettings()

		this.settingsTab = new UnifiedSettingsTab(this.app, this)
		this.addSettingTab(this.settingsTab)

		this.updateRibbonIcons()

		console.log('StrapiExporterPlugin loaded')
	}

	onunload() {
		console.log('StrapiExporterPlugin unloaded')
	}

	async loadSettings() {
		console.log('Loading settings')
		this.settings = Object.assign(
			{},
			DEFAULT_STRAPI_EXPORTER_SETTINGS,
			await this.loadData()
		)
		console.log('Settings loaded:', this.settings)
	}

	async saveSettings() {
		console.log('Saving settings')
		await this.saveData(this.settings)
		console.log('Settings saved')
	}

	updateRibbonIcons() {
		console.log('Updating ribbon icons')
		// Remove existing icons
		Object.values(this.ribbonIcons).forEach(icon => icon.remove())
		this.ribbonIcons = {}

		// Add icons for each enabled route
		this.settings.routes.forEach(route => {
			if (route.enabled) {
				console.log(`Adding ribbon icon for route: ${route.name}`)
				this.ribbonIcons[route.id] = this.addRibbonIcon(
					route.icon,
					route.name,
					() => {
						this.exportToStrapi(route)
					}
				)
			}
		})
	}

	async exportToStrapi(route: RouteConfig) {
		console.log(`Exporting to Strapi using route: ${route.name}`)
		new Notice(`Exporting to Strapi using route: ${route.name}`)
		// Implement export logic here
	}
}
