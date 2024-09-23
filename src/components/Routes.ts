// src/components/Routes.ts
import { Setting, TextComponent, TextAreaComponent } from 'obsidian'
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
			.setName(`Route ${index + 1}: ${route.name}`)
			.setDesc('Configure route settings')
			.addToggle(toggle =>
				toggle.setValue(route.enabled).onChange(async value => {
					route.enabled = value
					await this.plugin.saveSettings()
					this.plugin.updateRibbonIcons()
				})
			)

		new Setting(routeEl)
			.setName('Name')
			.setDesc('Enter a name for this route')
			.addText(text => this.createTextComponent(text, route, 'name'))

		new Setting(routeEl)
			.setName('Icon')
			.setDesc('Enter an icon name (e.g., "upload", "link", "star")')
			.addText(text => this.createTextComponent(text, route, 'icon'))

		new Setting(routeEl)
			.setName('URL')
			.setDesc('Enter the Strapi API endpoint URL for this route')
			.addText(text => this.createTextComponent(text, route, 'url'))

		new Setting(routeEl)
			.setName('Subtitle')
			.setDesc('Enter a brief subtitle for this route')
			.addText(text => this.createTextComponent(text, route, 'subtitle'))

		new Setting(routeEl)
			.setName('Description')
			.setDesc('Provide a detailed description of this route')
			.addTextArea(text =>
				this.createTextAreaComponent(text, route, 'description')
			)

		new Setting(routeEl).addButton(button =>
			button
				.setButtonText('Delete Route')
				.setWarning()
				.onClick(async () => {
					this.plugin.settings.routes.splice(index, 1)
					await this.plugin.saveSettings()
					this.plugin.updateRibbonIcons()
					this.display()
				})
		)
	}

	private createTextComponent(
		text: TextComponent,
		route: RouteConfig,
		field: keyof RouteConfig
	): TextComponent {
		return text.setValue(route[field] as string).onChange(async value => {
			route[field] = value
			await this.plugin.saveSettings()
			if (field === 'name' || field === 'icon') {
				this.plugin.debouncedUpdateRibbonIcons()
			}
		})
	}

	private createTextAreaComponent(
		text: TextAreaComponent,
		route: RouteConfig,
		field: keyof RouteConfig
	): TextAreaComponent {
		return text.setValue(route[field] as string).onChange(async value => {
			route[field] = value
			await this.plugin.saveSettings()
		})
	}

	private addNewRouteButton(): void {
		new Setting(this.containerEl)
			.setName('Add New Route')
			.setDesc('Create a new route configuration')
			.addButton(button =>
				button
					.setButtonText('Add Route')
					.setCta()
					.onClick(async () => {
						const newRoute: RouteConfig = {
							id: `route-${Date.now()}`,
							name: 'New Route',
							icon: 'star',
							url: '',
							description: '',
							subtitle: '',
							enabled: true,
						}
						this.plugin.settings.routes.push(newRoute)
						await this.plugin.saveSettings()
						this.display()
					})
			)
	}
}
