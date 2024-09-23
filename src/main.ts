// src/main.ts
import { Notice, Plugin } from 'obsidian'
import { DEFAULT_STRAPI_EXPORTER_SETTINGS } from './constants'
import { RouteConfig, StrapiExporterSettings } from './types/settings'
import { UnifiedSettingsTab } from './settings/UnifiedSettingsTab'
import { debounce } from './utils/debounce'

export default class StrapiExporterPlugin extends Plugin {
	settings: StrapiExporterSettings
	settingsTab: UnifiedSettingsTab
	debouncedUpdateRibbonIcons: () => Promise<void>

	async onload() {
		console.log('StrapiExporterPlugin loading')
		await this.loadSettings()

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
		this.removeRibbonIcons()

		this.settings.routes.forEach(route => {
			if (route.enabled) {
				console.log(`Adding ribbon icon for route: ${route.name}`)
				this.addRibbonIcon(route.icon, route.name, () => {
					this.exportToStrapi(route)
				})
			}
		})
	}

	removeRibbonIcons() {
		// Remove all ribbon icons added by this plugin
		// This is a placeholder - implement according to your ribbon icon management
	}

	async exportToStrapi(route: RouteConfig) {
		console.log(`Exporting to Strapi using route: ${route.name}`)
		new Notice(`Exporting to Strapi using route: ${route.name}`)
		// Implement export logic here
	}
}
