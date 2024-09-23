import { Plugin } from 'obsidian'
import { StrapiExporterSettingTab } from './settings'
import { DEFAULT_STRAPI_EXPORTER_SETTINGS } from './constants'
import { processMarkdownContent } from './utils/image-processor'
import { StrapiExporterSettings } from './types/settings'
import { IconConfigTab } from './settings/IconConfigTab'
import { SchemaConfigTab } from './settings/SchemaConfigTab'

export default class StrapiExporterPlugin extends Plugin {
	settings: StrapiExporterSettings
	ribbonIcons: { [key: string]: HTMLElement } = {}

	async onload() {
		await this.loadSettings()

		await this.loadSettings()

		this.addSettingTab(new StrapiExporterSettingTab(this.app, this))
		this.addSettingTab(new IconConfigTab(this.app, this))
		this.addSettingTab(new SchemaConfigTab(this.app, this))

		this.updateRibbonIcons()

		this.addSettingTab(new StrapiExporterSettingTab(this.app, this))
	}

	onunload() {}

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

	async processMarkdownContent(useAdditionalCallAPI = false) {
		// Call processMarkdownContent from image-processor.ts
		await processMarkdownContent(this.app, this.settings, useAdditionalCallAPI)
	}

	updateRibbonIcons() {
		// Remove existing icons
		Object.values(this.ribbonIcons).forEach(icon => icon.remove())
		this.ribbonIcons = {}

		// Add configured icons
		this.settings.icons.forEach(iconConfig => {
			if (iconConfig.enabled) {
				this.ribbonIcons[iconConfig.id] = this.addRibbonIcon(
					iconConfig.icon,
					iconConfig.title,
					() => this.processMarkdownContent(iconConfig.id)
				)
			}
		})
	}
}
