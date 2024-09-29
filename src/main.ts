import { Notice, Plugin } from 'obsidian'
import { DEFAULT_STRAPI_EXPORTER_SETTINGS } from './constants'
import {
	RouteConfig,
	StrapiExporterSettings,
	AnalyzedContent,
} from './types/settings'
import { UnifiedSettingsTab } from './settings/UnifiedSettingsTab'
import { debounce } from './utils/debounce'
import { analyzeFile } from './utils/analyse-file'
import { processImages } from './utils/process-images'
import { showPreviewToUser } from './utils/preview-modal'

export default class StrapiExporterPlugin extends Plugin {
	settings: StrapiExporterSettings
	ribbonIcons: Map<string, HTMLElement> = new Map()
	settingsTab: UnifiedSettingsTab
	debouncedUpdateRibbonIcons: () => Promise<void>

	async onload() {
		console.log('StrapiExporterPlugin loading')
		await this.loadSettings()
		this.loadStyles()

		this.debouncedUpdateRibbonIcons = debounce(
			this.updateRibbonIcons.bind(this),
			300
		)

		this.settingsTab = new UnifiedSettingsTab(this.app, this)
		this.addSettingTab(this.settingsTab)

		this.updateRibbonIcons()

		console.log('StrapiExporterPlugin loaded')
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings)
	}

	async exportToStrapi(routeId: string) {
		console.log(`Starting export to Strapi for route: ${routeId}`)
		const route = this.settings.routes.find(r => r.id === routeId)
		if (!route) {
			console.error(`Route not found: ${routeId}`)
			new Notice('Export failed: Route not found')
			return
		}

		const activeFile = this.app.workspace.getActiveFile()
		if (!activeFile) {
			new Notice('No active file')
			return
		}

		new Notice(`Preparing content for export using route: ${route.name}`)

		try {
			const analyzedContent = await analyzeFile(activeFile, this.app, route)
			const processedContent = await processImages(
				analyzedContent,
				this.app,
				this.settings
			)

			const userConfirmed = await showPreviewToUser(this.app, processedContent)
			if (!userConfirmed) {
				new Notice('Export cancelled by user')
				return
			}

			await this.sendToStrapi(processedContent, route)
			new Notice('Export to Strapi completed successfully')
		} catch (error) {
			console.error('Error during export to Strapi:', error)
			new Notice(`Export failed: ${error.message}`)
		}
	}

	async sendToStrapi(content: AnalyzedContent, route: RouteConfig) {
		console.log(`Sending data to Strapi for route: ${route.name}`)
		try {
			const response = await fetch(
				`${this.settings.strapiUrl}/api/${route.contentType}`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${this.settings.strapiApiToken}`,
					},
					body: JSON.stringify({ data: content }),
				}
			)

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(
					errorData.error.message || 'Failed to send content to Strapi'
				)
			}

			const responseData = await response.json()
			console.log('Strapi response:', responseData)
			new Notice('Content successfully sent to Strapi!')
		} catch (error) {
			console.error('Error sending to Strapi:', error)
			throw new Error(`Failed to send content to Strapi: ${error.message}`)
		}
	}
}
