import { Notice, Plugin } from 'obsidian'
import { DEFAULT_STRAPI_EXPORTER_SETTINGS } from './constants'
import { RouteConfig, StrapiExporterSettings, AnalyzedContent } from './types'
import { UnifiedSettingsTab } from './settings/UnifiedSettingsTab'
import { debounce } from './utils/debounce'
import { analyzeFile } from './utils/analyse-file'
import { showPreviewToUser } from './utils/preview-modal'
import { processImages } from './utils/process-file'
import { Logger } from './utils/logger'

export default class StrapiExporterPlugin extends Plugin {
	settings: StrapiExporterSettings
	ribbonIcons: Map<string, HTMLElement> = new Map()
	settingsTab: UnifiedSettingsTab
	debouncedUpdateRibbonIcons: () => Promise<void>

	private loadStyles(): void {
		Logger.info('UI', '4a. Creating style element')
		const styleElement = document.createElement('style')
		styleElement.id = 'strapi-exporter-styles'
		document.head.appendChild(styleElement)

		Logger.info('UI', '4b. Setting CSS styles')
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
		Logger.info('UI', '4c. Styles loaded successfully')
	}

	async onload() {
		Logger.info('Plugin', '1. Plugin initialization started')

		try {
			// Loading settings
			Logger.info('Settings', '2. Loading plugin settings')
			await this.loadSettings()
			Logger.debug('Settings', '3. Settings loaded state', this.settings)

			// Loading styles
			Logger.info('UI', '4. Loading CSS styles')
			this.loadStyles()

			// Configuring icon updates
			Logger.info('UI', '5. Configuring debounced icon updates')
			this.debouncedUpdateRibbonIcons = debounce(
				this.updateRibbonIcons.bind(this),
				300
			)

			// Setting up UI
			Logger.info('UI', '6. Initializing settings tab')
			this.settingsTab = new UnifiedSettingsTab(this.app, this)
			this.addSettingTab(this.settingsTab)

			// Updating icons
			Logger.info('UI', '7. Performing initial icon update')
			await this.updateRibbonIcons()

			Logger.info('Plugin', '8. Plugin loaded successfully')
		} catch (error) {
			Logger.error('Plugin', 'Error during plugin loading', error)
			new Notice('Error loading Strapi Exporter plugin')
		}
	}

	async saveSettings() {
		Logger.info('Settings', '9. Starting settings save')
		try {
			await this.saveData(this.settings)
			Logger.info('Settings', '10. Settings saved successfully')
		} catch (error) {
			Logger.error('Settings', 'Error saving settings', error)
		}
	}

	onunload() {
		Logger.info('Plugin', '11. Beginning plugin unload')
		this.removeAllIcons()
		Logger.info('Plugin', '12. Plugin unloaded successfully')
	}

	async loadSettings() {
		Logger.info('Settings', '13. Starting settings load')
		this.settings = Object.assign(
			{},
			DEFAULT_STRAPI_EXPORTER_SETTINGS,
			await this.loadData()
		)
		Logger.debug('Settings', '14. Merged settings', this.settings)
	}

	updateRibbonIcons() {
		Logger.info('UI', '15. Updating toolbar icons')
		this.removeAllIcons()

		this.settings.routes.forEach(route => {
			if (route.enabled) {
				Logger.debug('UI', `16. Adding icon for route: ${route.name}`)
				this.addIconForRoute(route)
			}
		})
	}

	removeAllIcons() {
		Logger.info('UI', '17. Removing all icons')
		this.ribbonIcons.forEach((icon, routeId) => {
			if (icon && icon.parentNode) {
				Logger.debug('UI', `18. Removing icon: ${routeId}`)
				icon.parentNode.removeChild(icon)
			}
		})
		this.ribbonIcons.clear()
	}

	addIconForRoute(route: RouteConfig) {
		Logger.info('UI', `19. Adding/Updating icon for route: ${route.name}`)
		const existingIcon = this.ribbonIcons.get(route.id)
		if (existingIcon && existingIcon.parentNode) {
			Logger.debug('UI', `20. Replacing existing icon: ${route.id}`)
			existingIcon.parentNode.removeChild(existingIcon)
		}

		const ribbonIconEl = this.addRibbonIcon(route.icon, route.name, () => {
			this.exportToStrapi(route.id)
		})
		this.ribbonIcons.set(route.id, ribbonIconEl)
	}

	async exportToStrapi(routeId: string) {
		Logger.info('Export', `21. Starting Strapi export for route: ${routeId}`)

		// Route validation
		const route = this.settings.routes.find(r => r.id === routeId)
		if (!route) {
			Logger.error('Export', `22. Route not found: ${routeId}`)
			new Notice('Export failed: Route not found')
			return
		}

		// Active file check
		const activeFile = this.app.workspace.getActiveFile()
		if (!activeFile) {
			Logger.warn('Export', '23. No active file')
			new Notice('No active file')
			return
		}

		Logger.info(
			'Export',
			`24. Preparing content for export using route: ${route.name}`
		)
		new Notice(`Preparing content for export using route: ${route.name}`)

		try {
			// File analysis
			Logger.info('Export', '25. Starting file content analysis')
			const analyzedContent = await analyzeFile(activeFile, this.app, route)
			Logger.debug('Export', '26. Analyzed content', analyzedContent)

			// Image processing
			Logger.info('Export', '27. Processing images')
			const processedContent = await processImages(
				analyzedContent,
				this.app,
				this.settings
			)
			Logger.debug(
				'Export',
				'28. Content processed with images',
				processedContent
			)

			// User preview
			Logger.info('Export', '29. Displaying preview to user')
			const userConfirmed = await showPreviewToUser(this.app, processedContent)

			if (!userConfirmed) {
				Logger.info('Export', '30. Export cancelled by user')
				new Notice('Export cancelled by user')
				return
			}

			// Strapi submission
			Logger.info('Export', '31. Submitting to Strapi')
			await this.sendToStrapi(processedContent, route)
			Logger.info('Export', '32. Export completed successfully')
			new Notice('Export to Strapi completed successfully')
		} catch (error) {
			Logger.error('Export', '33. Error during export process', error)
			new Notice(`Export failed: ${error.message}`)
		}
	}

	async sendToStrapi(content: AnalyzedContent, route: RouteConfig) {
		Logger.info('Strapi', `34. Sending data to Strapi for route: ${route.name}`)

		try {
			// Request preparation
			Logger.debug('Strapi', '35. Preparing request', {
				url: `${this.settings.strapiUrl}/api/${route.contentType}`,
				contentType: route.contentType,
			})

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
				Logger.error('Strapi', '36. Strapi response error', errorData)
				throw new Error(
					errorData.error.message || 'Failed to send content to Strapi'
				)
			}

			const responseData = await response.json()
			Logger.info('Strapi', '37. Strapi response received successfully')
			Logger.debug('Strapi', '38. Response data', responseData)
			new Notice('Content successfully sent to Strapi!')
		} catch (error) {
			Logger.error('Strapi', '39. Error sending to Strapi', error)
			throw new Error(`Failed to send content to Strapi: ${error.message}`)
		}
	}
}
