import { Notice, Setting, TextComponent } from 'obsidian'
import StrapiExporterPlugin from '../main'
import { RouteConfig } from '../types'
import { Logger } from '../utils/logger'

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
		Logger.info('Routes', '430. Initializing Routes component')
		this.plugin = plugin
		this.containerEl = containerEl
	}

	display(): void {
		Logger.info('Routes', '431. Displaying routes configuration')
		const { containerEl } = this
		containerEl.empty()

		try {
			this.createHeader()
			this.createRoutesList()
			this.addNewRouteButton()
			Logger.info('Routes', '432. Routes display completed')
		} catch (error) {
			Logger.error('Routes', '433. Error displaying routes', error)
			this.showError('Failed to display routes configuration')
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
		Logger.debug('Routes', '434. Creating routes list')

		const routesContainer = this.containerEl.createDiv('routes-list')

		this.plugin.settings.routes.forEach((route, index) => {
			Logger.debug('Routes', `435. Creating settings for route: ${route.name}`)
			this.createRouteConfigSettings(route, index, routesContainer)
		})
	}

	private createTextComponent(
		text: TextComponent,
		route: RouteConfig,
		field: keyof RouteConfig
	): TextComponent {
		Logger.debug(
			'Routes',
			`436. Creating text component for field: ${String(field)}`
		)

		return text.setValue(route[field] as string).onChange(async value => {
			try {
				await this.updateRouteField(route, field, value)
				Logger.debug(
					'Routes',
					`437. Field ${String(field)} updated successfully`
				)
			} catch (error) {
				Logger.error(
					'Routes',
					`438. Error updating field: ${String(field)}`,
					error
				)
				this.showError(`Failed to update ${String(field)}`)
			}
		})
	}

	private createRouteConfigSettings(
		route: RouteConfig,
		index: number,
		container: HTMLElement
	): void {
		Logger.debug('Routes', `439. Creating config settings for route ${index}`)

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

			Logger.debug(
				'Routes',
				`440. Route ${index} settings created successfully`
			)
		} catch (error) {
			Logger.error(
				'Routes',
				`441. Error creating route settings for index ${index}`,
				error
			)
			this.showError(`Failed to create settings for route ${index + 1}`)
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
						Logger.debug('Routes', `442. Route ${index} enabled state updated`)
					} catch (error) {
						Logger.error(
							'Routes',
							`443. Error updating route enabled state`,
							error
						)
						this.showError('Failed to update route state')
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
						Logger.info('Routes', `444. Route ${index} deleted successfully`)
					} catch (error) {
						Logger.error('Routes', `445. Error deleting route ${index}`, error)
						this.showError('Failed to delete route')
					}
				})
		)
	}

	private async updateRouteField(
		route: RouteConfig,
		field: keyof RouteConfig,
		value: string
	): Promise<void> {
		route[field] = value
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
			Logger.warn('Routes', '446. Attempted to delete only route')
			new Notice('Cannot delete the only route')
			return
		}

		this.plugin.settings.routes.splice(index, 1)
		await this.plugin.saveSettings()
		this.plugin.updateRibbonIcons()
		this.display()
	}

	private addNewRouteButton(): void {
		Logger.debug('Routes', '447. Adding new route button')

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
							Logger.info('Routes', '448. New route created successfully')
						} catch (error) {
							Logger.error('Routes', '449. Error creating new route', error)
							this.showError('Failed to create new route')
						}
					})
			)
	}

	private async createNewRoute(): Promise<void> {
		const newRoute: RouteConfig = {
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
		Logger.error('Routes', '450. Showing error message', { message })
		new Notice(message)
	}
}
