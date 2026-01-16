import { Notice, Plugin } from 'obsidian'
import { DEFAULT_STRAPI_EXPORTER_SETTINGS } from './constants'
import { RouteConfig, StrapiExporterSettings, AnalyzedContent } from './types'
import { UnifiedSettingsTab } from './settings/UnifiedSettingsTab'
import { debounce } from './utils/debounce'
import { analyzeFile } from './utils/analyse-file'
import { showPreviewToUser } from './utils/preview-modal'
import { processImages } from './utils/process-file'
import { StrapiExportService } from './services/strapi-export'

export default class StrapiExporterPlugin extends Plugin {
	settings: StrapiExporterSettings
	ribbonIcons: Map<string, HTMLElement> = new Map()
	settingsTab: UnifiedSettingsTab
	debouncedUpdateRibbonIcons: () => Promise<void>

	private loadStyles(): void {
		const styleElement = document.createElement('style')
		styleElement.id = 'strapi-exporter-styles'
		document.head.appendChild(styleElement)

		styleElement.textContent = `
			.strapi-exporter-nav {
				display: flex;
				justify-content: center;
				gap: 20px;
				margin-bottom: 20px;
			}

			.strapi-exporter-nav-button {
				padding: 10px 15px;
				border: none;
				background: none;
				cursor: pointer;
				font-size: 14px;
				color: var(--text-muted);
				transition: all 0.3s ease;
			}

			.strapi-exporter-nav-button:hover {
				color: var(--text-normal);
			}

			.strapi-exporter-nav-button.is-active {
				color: var(--text-accent);
				border-bottom: 2px solid var(--text-accent);
			}

			.strapi-exporter-content {
				padding: 20px;
			}
		`
	}

	async onload() {
		try {
			// Loading settings
			await this.loadSettings()

			// Loading styles
			this.loadStyles()

			// Configuring icon updates
			this.debouncedUpdateRibbonIcons = debounce(
				this.updateRibbonIcons.bind(this),
				300
			)

			// Setting up UI
			this.settingsTab = new UnifiedSettingsTab(this.app, this)
			this.addSettingTab(this.settingsTab)

			// Updating icons
			await this.updateRibbonIcons()
		} catch (error) {
			new Notice('Error loading Strapi Exporter plugin' + error.message)
		}
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}

	onunload() {
		this.removeAllIcons()
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_STRAPI_EXPORTER_SETTINGS,
			await this.loadData()
		)
	}

	updateRibbonIcons() {
		this.removeAllIcons()

		this.settings.routes.forEach(route => {
			if (route.enabled) {
				this.addIconForRoute(route)
			}
		})
	}

	removeAllIcons() {
		this.ribbonIcons.forEach((icon, routeId) => {
			if (icon && icon.parentNode) {
				icon.parentNode.removeChild(icon)
			}
		})
		this.ribbonIcons.clear()
	}

	addIconForRoute(route: RouteConfig) {
		const existingIcon = this.ribbonIcons.get(route.id)
		if (existingIcon && existingIcon.parentNode) {
			existingIcon.parentNode.removeChild(existingIcon)
		}

		const ribbonIconEl = this.addRibbonIcon(route.icon, route.name, () => {
			this.exportToStrapi(route.id)
		})
		this.ribbonIcons.set(route.id, ribbonIconEl)
	}

	async exportToStrapi(routeId: string) {
		// Route validation
		const route = this.settings.routes.find(r => r.id === routeId)
		if (!route) {
			new Notice('Export failed: Route not found')
			return
		}

		// Active file check
		const activeFile = this.app.workspace.getActiveFile()
		if (!activeFile) {
			new Notice('No active file')
			return
		}

		try {
			// File analysis
			const analyzedContent = await analyzeFile(activeFile, this.app, route)

			// Image processing
			const processedContent = await processImages(
				analyzedContent,
				this.app,
				this.settings
			)

			// User preview
			const userConfirmed = await showPreviewToUser(
				this.app,
				processedContent,
				this,
				route.id
			)

			if (!userConfirmed) {
				new Notice('Export cancelled by user')
				return
			}

			// Initialize Strapi export service
			const strapiExport = new StrapiExportService(
				this.settings,
				this.app,
				activeFile
			)

			// Export to Strapi
			await strapiExport.exportContent(processedContent, route)

			new Notice('Content successfully exported to Strapi!')
		} catch (error) {
			new Notice(`Export failed: ${error.message}`)
		}
	}

	async sendToStrapi(content: AnalyzedContent, route: RouteConfig) {
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
		new Notice('Content successfully sent to Strapi!')
	}
}
