// src/components/Routes.ts
import { Setting } from 'obsidian'
import StrapiExporterPlugin from '../main'
import { RouteConfig } from '../types/settings'

export class Routes {
	private plugin: StrapiExporterPlugin
	private containerEl: HTMLElement

	constructor(plugin: StrapiExporterPlugin, containerEl: HTMLElement) {
		this.plugin = plugin
		this.containerEl = containerEl
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()

		containerEl.createEl('h2', { text: 'Routes Configuration' })

		this.plugin.settings.routes.forEach((route, index) => {
			this.createRouteConfigSettings(route, index)
		})

		this.addNewRouteButton()
	}

	private createRouteConfigSettings(route: RouteConfig, index: number): void {
		const routeEl = this.containerEl.createEl('div', { cls: 'route-config' })

		new Setting(routeEl)
			.setName(`Route ${index + 1}`)
			.setDesc('Configure route settings')
			.addText(text =>
				text
					.setPlaceholder('Route name')
					.setValue(route.name)
					.onChange(async value => {
						route.name = value
						await this.plugin.saveSettings()
					})
			)
			.addText(text =>
				text
					.setPlaceholder('Icon name')
					.setValue(route.icon)
					.onChange(async value => {
						route.icon = value
						await this.plugin.saveSettings()
					})
			)
			.addText(text =>
				text
					.setPlaceholder('Route URL')
					.setValue(route.url)
					.onChange(async value => {
						route.url = value
						await this.plugin.saveSettings()
					})
			)
			.addDropdown(dropdown =>
				dropdown
					.addOption('en', 'English')
					.addOption('fr', 'French')
					.addOption('es', 'Spanish')
					// Add more language options as needed
					.setValue(route.language || 'en')
					.onChange(async value => {
						route.language = value
						await this.plugin.saveSettings()
					})
			)
			.addToggle(toggle =>
				toggle.setValue(route.enabled).onChange(async value => {
					route.enabled = value
					await this.plugin.saveSettings()
					this.plugin.updateRibbonIcons()
				})
			)

		new Setting(routeEl)
			.setName('Route Description')
			.setDesc('Provide a description for this route')
			.addTextArea(text =>
				text.setValue(route.description || '').onChange(async value => {
					route.description = value
					await this.plugin.saveSettings()
				})
			)

		new Setting(routeEl).addButton(button =>
			button
				.setIcon('trash')
				.setTooltip('Delete this route')
				.onClick(async () => {
					this.plugin.settings.routes.splice(index, 1)
					await this.plugin.saveSettings()
					this.plugin.updateRibbonIcons()
					this.display()
				})
		)
	}

	private addNewRouteButton(): void {
		new Setting(this.containerEl)
			.setName('Add New Route')
			.setDesc('Add a new route configuration')
			.addButton(button =>
				button.setButtonText('+').onClick(async () => {
					this.plugin.settings.routes.push({
						id: `route-${Date.now()}`,
						icon: 'star',
						name: 'New Route',
						description: '',
						enabled: true,
						url: '',
						language: 'en',
					})
					await this.plugin.saveSettings()
					this.display()
				})
			)
	}
}
