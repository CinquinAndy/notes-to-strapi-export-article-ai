import { Notice, Plugin } from 'obsidian'
import { DEFAULT_STRAPI_EXPORTER_SETTINGS } from './constants'
import { RouteConfig, StrapiExporterSettings } from './types/settings'
import { UnifiedSettingsTab } from './settings/UnifiedSettingsTab'
import { debounce } from './utils/debounce'
import { processMarkdownContent } from './utils/image-processor'
import { PreviewModal } from './utils/preview-modal'

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

	onunload() {
		console.log('StrapiExporterPlugin unloading')
		this.removeAllIcons()
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

	loadStyles() {
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

	updateRibbonIcons() {
		console.log('Updating ribbon icons')
		this.removeAllIcons()

		this.settings.routes.forEach(route => {
			if (route.enabled) {
				console.log(`Adding ribbon icon for route: ${route.name}`)
				this.addIconForRoute(route)
			}
		})
	}

	removeAllIcons() {
		console.log('Removing all icons')
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
		console.log(`Starting export to Strapi for route: ${routeId}`)
		const route = this.settings.routes.find(r => r.id === routeId)
		if (!route) {
			console.error(`Route not found: ${routeId}`)
			new Notice('Export failed: Route not found')
			return
		}

		new Notice(`Preparing content for export using route: ${route.name}`)

		try {
			const processedContent = await processMarkdownContent(
				this.app,
				this.settings,
				routeId
			)
			if (!processedContent) {
				throw new Error('Failed to process content')
			}

			const finalContent = { data: processedContent }

			// Show preview and wait for confirmation
			await new Promise<void>(resolve => {
				new PreviewModal(this.app, finalContent, async () => {
					await this.sendToStrapi(finalContent, route)
					resolve()
				}).open()
			})

			console.log('Export to Strapi completed successfully')
		} catch (error) {
			console.error('Error during export to Strapi:', error)
			new Notice(`Export failed: ${error.message}`)
		}
	}

	async sendToStrapi(data: any, route: RouteConfig) {
		console.log(`Sending data to Strapi for route: ${route.name}`)
		try {
			const response = await fetch(route.url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.settings.strapiApiToken}`,
				},
				body: JSON.stringify(data),
			})

			if (response.ok) {
				const responseData = await response.json()
				console.log('Strapi response:', responseData)
				new Notice('Content successfully sent to Strapi!')
			} else {
				const errorData = await response.json()
				console.error('Strapi error response:', errorData)
				throw new Error(
					`Failed to create content in Strapi: ${errorData.error.message}`
				)
			}
		} catch (error) {
			console.error('Error sending to Strapi:', error)
			throw new Error(`Error sending to Strapi: ${error.message}`)
		}
	}
}
