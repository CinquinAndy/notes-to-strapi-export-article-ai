import { Plugin } from 'obsidian'
import { StrapiExporterSettingTab } from './settings'
import { DEFAULT_STRAPI_EXPORTER_SETTINGS } from './constants'
import { processMarkdownContent } from './utils/image-processor'
import { StrapiExporterSettings } from './types/settings'

export default class StrapiExporterPlugin extends Plugin {
	settings: StrapiExporterSettings
	mainRibbonIconEl: HTMLElement
	additionalRibbonIconEl: HTMLElement

	async onload() {
		await this.loadSettings()

		/**
		 * Add the main ribbon icon to the top right corner of the Obsidian window
		 */
		this.addMainRibbonIcon()
		if (this.settings.enableAdditionalApiCall) {
			this.addAdditionalRibbonIcon()
		}

		// Add ribbon icons and event listeners
		/**
		 * Add a ribbon icon to the Markdown view (the little icon on the left side bar)
		 */
		this.addRibbonIcon(
			'upload',
			'Upload to Strapi and generate content with AI',
			async () => {
				await this.processMarkdownContent()
			}
		)

		/**
		 * Add a ribbon icon based on the settings (if enabled)
		 */
		if (this.settings.enableAdditionalApiCall) {
			this.addRibbonIcon(
				'link',
				'Upload to Strapi and generate additional content with AI',
				async () => {
					await this.processMarkdownContent(true)
				}
			)
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

	addMainRibbonIcon() {
		this.mainRibbonIconEl = this.addRibbonIcon(
			'upload',
			this.settings.mainRibbonIconTitle,
			async () => {
				await this.processMarkdownContent()
			}
		)
	}

	addAdditionalRibbonIcon() {
		this.additionalRibbonIconEl = this.addRibbonIcon(
			'link',
			this.settings.additionalRibbonIconTitle,
			async () => {
				await this.processMarkdownContent(true)
			}
		)
	}

	updateRibbonIcons() {
		if (this.mainRibbonIconEl) {
			this.mainRibbonIconEl.setAttribute(
				'aria-label',
				this.settings.mainRibbonIconTitle
			)
		}
		if (this.additionalRibbonIconEl) {
			this.additionalRibbonIconEl.setAttribute(
				'aria-label',
				this.settings.additionalRibbonIconTitle
			)
		}
	}
}
