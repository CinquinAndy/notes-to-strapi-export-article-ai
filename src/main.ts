import { Notice, Plugin } from 'obsidian'
import { DEFAULT_STRAPI_EXPORTER_SETTINGS } from './constants'
import { RouteConfig, StrapiExporterSettings } from './types/settings'
import { UnifiedSettingsTab } from './settings/UnifiedSettingsTab'
import { debounce } from './utils/debounce'
import { processMarkdownContent } from './utils/image-processor'

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
		const route = this.settings.routes.find(r => r.id === routeId)
		if (!route) {
			new Notice('Route not found')
			return
		}

		console.log(`Exporting to Strapi using route: ${route.name}`)
		new Notice(`Exporting to Strapi using route: ${route.name}`)

		const processedContent = await processMarkdownContent(
			this.app,
			this.settings,
			routeId
		)
		if (!processedContent) {
			new Notice('Failed to process content')
			return
		}

		const finalContent = this.prepareFinalContent(processedContent, route)

		await this.sendToStrapi(finalContent, route)
	}

	private prepareFinalContent(processedContent: any, route: RouteConfig) {
		return {
			data: {
				...processedContent.content,
			},
		}
	}

	private async sendToStrapi(data: any, route: RouteConfig) {
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
				new Notice('Content successfully sent to Strapi!')
				console.log('Strapi response:', await response.json())
			} else {
				const errorData = await response.json()
				console.error('Strapi error response:', errorData)
				new Notice(
					`Failed to create content in Strapi. Error: ${errorData.error.message}`
				)
			}
		} catch (error) {
			console.error('Error sending to Strapi:', error)
			new Notice(`Error sending to Strapi: ${error.message}`)
		}
	}
}
