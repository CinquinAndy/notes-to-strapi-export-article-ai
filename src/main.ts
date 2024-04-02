import { Plugin } from 'obsidian'
import { StrapiExporterSettingTab } from './settings'
import { DEFAULT_STRAPI_EXPORTER_SETTINGS } from './constants'
import { processMarkdownContent } from './utils/image-processor'
import { StrapiExporterSettings } from './types/settings'

export default class StrapiExporterPlugin extends Plugin {
	settings: StrapiExporterSettings

	async onload() {
		await this.loadSettings()

		// Add ribbon icons and event listeners
		/**
		 * Add a ribbon icon to the Markdown view (the little icon on the left side bar)
		 */
		const ribbonIconEl = this.addRibbonIcon(
			'upload',
			'Upload images to Strapi and update links in Markdown content, then generate article content using OpenAI',
			async (evt: MouseEvent) => {
				await this.processMarkdownContent()
			}
		)
		ribbonIconEl.addClass('strapi-exporter-ribbon-class')

		/**
		 * Add a ribbon icon based on the settings (if enabled)
		 */
		if (this.settings.enableAdditionalApiCall) {
			const additionalRibbonIconEl = this.addRibbonIcon(
				'link',
				'Upload images to Strapi and update links in Markdown content, then generate additional content using OpenAI',
				async (evt: MouseEvent) => {
					await this.processMarkdownContent(true)
				}
			)
			additionalRibbonIconEl.addClass('strapi-exporter-additional-ribbon-class')
		}

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
}
