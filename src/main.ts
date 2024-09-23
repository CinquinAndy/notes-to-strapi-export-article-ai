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
		await this.loadSettings()

		this.settingsTab = new UnifiedSettingsTab(this.app, this)
		this.addSettingTab(this.settingsTab)

		this.updateRibbonIcons()

		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				menu.addItem(item => {
					item
						.setTitle('Export to Strapi')
						.setIcon('upload')
						.onClick(async () => {
							if (file) {
								await this.processMarkdownContent(file)
							}
						})
				})
			})
		)
	}

	onunload() {
		// Clean up code here
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_STRAPI_EXPORTER_SETTINGS,
			await this.loadData()
		)
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}

	async processMarkdownContent(file: TFile) {
		// Call processMarkdownContent from image-processor.ts
		await processMarkdownContent(this.app, this.settings, file)
	}

	updateRibbonIcons() {
		// Remove existing icons
		Object.values(this.ribbonIcons).forEach(icon => icon.remove())
		this.ribbonIcons = {}

		// Add icons for each enabled route
		this.settings.routes.forEach(route => {
			if (route.enabled) {
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
		new Notice(`Exporting to Strapi using route: ${route.name}`)
		const activeFile = this.app.workspace.getActiveFile()
		if (activeFile) {
			await this.processMarkdownContent(activeFile)
		} else {
			new Notice('No active file to export')
		}
	}
}
