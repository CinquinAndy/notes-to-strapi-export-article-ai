import { Notice, Setting, TextComponent } from 'obsidian'
import StrapiExporterPlugin from '../main'
import { RouteConfig } from '../types'

interface RouteField {
	name: string
	description: string
	type: 'text' | 'toggle'
	key: keyof RouteConfig
	placeholder?: string
	icon?: string
}

export class Routes {
	private plugin: StrapiExporterPlugin
	private containerEl: HTMLElement

	private routeFields: RouteField[] = [
		{
			name: 'Name',
			description: 'Enter a name for this route',
			type: 'text',
			key: 'name',
			placeholder: 'My Export Route',
		},
		{
			name: 'Icon',
			description: 'Enter an icon name (e.g., "upload", "link", "star")',
			type: 'text',
			key: 'icon',
			placeholder: 'upload',
		},
		{
			name: 'URL',
			description: 'Enter the Strapi API endpoint URL for this route',
			type: 'text',
			key: 'url',
			placeholder: '/api/articles',
		},
		{
			name: 'Subtitle',
			description: 'Enter a brief subtitle for this route',
			type: 'text',
			key: 'subtitle',
			placeholder: 'Export to articles collection',
		},
	]

	constructor(plugin: StrapiExporterPlugin, containerEl: HTMLElement) {
		this.plugin = plugin
		this.containerEl = containerEl
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()

		try {
			this.createHeader()
			this.createRoutesList()
			this.addNewRouteButton()
		} catch (error) {
			this.showError('Failed to display routes configuration' + error.message)
		}
	}

	private createHeader(): void {
		const headerEl = this.containerEl.createEl('div', { cls: 'routes-header' })

		headerEl.createEl('h2', {
			text: 'Routes Configuration',
			cls: 'routes-title',
		})

		headerEl.createEl('p', {
			text: 'Configure export routes for different content types.',
			cls: 'routes-description',
		})
	}

	private createRoutesList(): void {
		const routesContainer = this.containerEl.createDiv('routes-list')

		this.plugin.settings.routes.forEach((route, index) => {
			this.createRouteConfigSettings(route, index, routesContainer)
		})
	}

	private createTextComponent(
		text: TextComponent,
		route: RouteConfig,
		field: keyof RouteConfig
	): TextComponent {
		return text.setValue(route[field] as string).onChange(async value => {
			try {
				await this.updateRouteField(route, field, value)
			} catch (error) {
				this.showError(`Failed to update ${String(field)}` + error.message)
			}
		})
	}

	private createRouteConfigSettings(
		route: RouteConfig,
		index: number,
		container: HTMLElement
	): void {
		try {
			const routeEl = container.createEl('div', {
				cls: 'route-config',
			})

			// Route header with toggle
			this.createRouteHeader(routeEl, route, index)

			// Route fields
			this.routeFields.forEach(field => {
				this.createRouteField(routeEl, route, field)
			})

			// Delete button
			this.addDeleteButton(routeEl, index)
		} catch (error) {
			this.showError(
				`Failed to create settings for route ${index + 1}` + error.message
			)
		}
	}

	private createRouteHeader(
		routeEl: HTMLElement,
		route: RouteConfig,
		index: number
	): void {
		new Setting(routeEl)
			.setName(`Route ${index + 1}: ${route.name}`)
			.setDesc('Configure route settings')
			.addToggle(toggle =>
				toggle.setValue(route.enabled).onChange(async value => {
					try {
						await this.updateRouteEnabled(route, value)
					} catch (error) {
						this.showError('Failed to update route state' + error.message)
					}
				})
			)
	}

	private createRouteField(
		routeEl: HTMLElement,
		route: RouteConfig,
		field: RouteField
	): void {
		new Setting(routeEl)
			.setName(field.name)
			.setDesc(field.description)
			.addText(text => {
				text.setPlaceholder(field.placeholder || '')
				return this.createTextComponent(text, route, field.key)
			})
	}

	private addDeleteButton(routeEl: HTMLElement, index: number): void {
		new Setting(routeEl).addButton(button =>
			button
				.setButtonText('Delete Route')
				.setWarning()
				.onClick(async () => {
					try {
						await this.deleteRoute(index)
					} catch (error) {
						this.showError('Failed to delete route' + error.message)
					}
				})
		)
	}

	private async updateRouteField(
		route: RouteConfig,
		field: keyof RouteConfig,
		value: string | boolean
	): Promise<void> {
		if (field === 'enabled') {
			route[field] = value as boolean
		} else {
			const stringFields: (keyof RouteConfig)[] = [
				'id',
				'name',
				'icon',
				'url',
				'contentType',
				'contentField',
				'additionalInstructions',
				'description',
				'subtitle',
				'schema',
				'schemaDescription',
				'language',
			]

			if (stringFields.includes(field)) {
				;(route[field] as string) = value as string
			}
		}

		await this.plugin.saveSettings()

		if (field === 'icon' || field === 'enabled') {
			await this.plugin.debouncedUpdateRibbonIcons()
		}
	}

	private async updateRouteEnabled(
		route: RouteConfig,
		value: boolean
	): Promise<void> {
		route.enabled = value
		await this.plugin.saveSettings()
		this.plugin.updateRibbonIcons()
	}

	private async deleteRoute(index: number): Promise<void> {
		if (this.plugin.settings.routes.length <= 1) {
			new Notice('Cannot delete the only route')
			return
		}

		this.plugin.settings.routes.splice(index, 1)
		await this.plugin.saveSettings()
		this.plugin.updateRibbonIcons()
		this.display()
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
						try {
							await this.createNewRoute()
						} catch (error) {
							this.showError('Failed to create new route' + error.message)
						}
					})
			)
	}

	private async createNewRoute(): Promise<void> {
		const newRoute: RouteConfig = {
			generatedConfig: '',
			id: `route-${Date.now()}`,
			name: 'New Route',
			icon: 'star',
			url: '',
			contentType: '',
			contentField: '',
			additionalInstructions: '',
			enabled: true,
			description: '',
			subtitle: '',
			schema: '',
			schemaDescription: '',
			language: '',
			fieldMappings: {},
		}

		this.plugin.settings.routes.push(newRoute)
		await this.plugin.saveSettings()
		this.display()
	}

	private showError(message: string): void {
		new Notice(message)
	}
}
