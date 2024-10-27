import {
	App,
	DropdownComponent,
	Modal,
	Notice,
	Setting,
	TextAreaComponent,
	TextComponent,
	TFile,
} from 'obsidian'
import StrapiExporterPlugin from '../main'
import { uploadImageToStrapi } from '../utils/strapi-uploader'
import { Logger } from '../utils/logger'
import { RouteConfig } from '../types'
import { StructuredFieldAnalyzer } from '../services/field-analyzer'
import { ConfigurationGenerator } from '../services/configuration-generator'

export class Configuration {
	private fieldAnalyzer = new StructuredFieldAnalyzer()
	private configGenerator = new ConfigurationGenerator()
	private plugin: StrapiExporterPlugin
	private containerEl: HTMLElement
	private components: {
		schemaInput: TextAreaComponent | null
		schemaDescriptionInput: TextAreaComponent | null
		contentFieldInput: TextComponent | null
		configOutput: TextAreaComponent | null
		languageDropdown: DropdownComponent | null
		routeSelector: DropdownComponent | null
	} = {
		schemaInput: null,
		schemaDescriptionInput: null,
		contentFieldInput: null,
		configOutput: null,
		languageDropdown: null,
		routeSelector: null,
	}
	private currentRouteId: string
	private app: App

	constructor(plugin: StrapiExporterPlugin, containerEl: HTMLElement) {
		Logger.info('Configuration', '359. Initializing Configuration component')
		this.plugin = plugin
		this.containerEl = containerEl
		this.app = plugin.app
		this.currentRouteId = this.plugin.settings.routes[0]?.id || ''
		this.components = {
			schemaInput: null,
			schemaDescriptionInput: null,
			contentFieldInput: null,
			configOutput: null,
			languageDropdown: null,
			routeSelector: null,
		}
	}

	display(): void {
		Logger.info('Configuration', '360. Displaying configuration interface')
		const { containerEl } = this
		containerEl.empty()

		try {
			this.createHeader()
			this.addRouteSelector()
			this.addSchemaConfigSection()
			this.addContentFieldSection()
			this.addLanguageSection()
			this.addAutoConfigSection()

			Logger.info(
				'Configuration',
				'361. Configuration interface rendered successfully'
			)
		} catch (error) {
			Logger.error(
				'Configuration',
				'362. Error displaying configuration',
				error
			)
			this.showError('Failed to display configuration interface')
		}
	}

	private createHeader(): void {
		this.containerEl.createEl('h2', {
			text: 'Configuration',
			cls: 'configuration-title',
		})

		this.containerEl.createEl('p', {
			text: 'Configure your Strapi export settings and schema mappings.',
			cls: 'configuration-description',
		})
	}

	private addRouteSelector(): void {
		Logger.debug('Configuration', '363. Adding route selector')
		try {
			const routeSetting = new Setting(this.containerEl)
				.setName('Select Route')
				.setDesc('Choose the route to configure')
				.addDropdown(dropdown => {
					this.components.routeSelector = dropdown
					this.plugin.settings.routes.forEach(route => {
						dropdown.addOption(route.id, route.name)
					})
					dropdown.setValue(this.currentRouteId)
					dropdown.onChange(async value => {
						Logger.debug('Configuration', `364. Route changed to: ${value}`)
						this.currentRouteId = value
						await this.updateConfigurationFields()
					})
				})

			this.addRouteManagementButtons(routeSetting)
		} catch (error) {
			Logger.error(
				'Configuration',
				'365. Error setting up route selector',
				error
			)
		}
	}

	private addRouteManagementButtons(setting: Setting): void {
		setting
			.addButton(button =>
				button
					.setButtonText('New Route')
					.setTooltip('Create a new route configuration')
					.onClick(() => this.createNewRoute())
			)
			.addButton(button =>
				button
					.setButtonText('Delete')
					.setTooltip('Delete current route')
					.onClick(() => this.deleteCurrentRoute())
			)
	}

	private async createNewRoute(): Promise<void> {
		Logger.info('Configuration', '366. Creating new route')
		try {
			const newRoute: RouteConfig = {
				// Base properties
				id: `route-${Date.now()}`,
				name: 'New Route',

				// Strapi configuration
				schema: '',
				schemaDescription: '',
				contentType: 'articles', // Default content type
				contentField: 'content',

				// UI configuration
				icon: 'file-text', // Default icon
				description: 'New export route',
				subtitle: '',

				// Route settings
				url: '',
				enabled: true,
				language: 'en',

				// Mappings and instructions
				fieldMappings: {},
				additionalInstructions: '',
			}

			Logger.debug(
				'Configuration',
				'Created new route with default values',
				newRoute
			)

			this.plugin.settings.routes.push(newRoute)
			await this.plugin.saveSettings()
			this.currentRouteId = newRoute.id
			this.display()
			new Notice('New route created successfully')
		} catch (error) {
			Logger.error('Configuration', '367. Error creating new route', error)
			this.showError('Failed to create new route')
		}
	}

	private async deleteCurrentRoute(): Promise<void> {
		Logger.info('Configuration', '368. Deleting route')
		try {
			if (this.plugin.settings.routes.length <= 1) {
				new Notice('Cannot delete the only route')
				return
			}

			const routeIndex = this.plugin.settings.routes.findIndex(
				route => route.id === this.currentRouteId
			)

			if (routeIndex !== -1) {
				this.plugin.settings.routes.splice(routeIndex, 1)
				await this.plugin.saveSettings()
				this.currentRouteId = this.plugin.settings.routes[0].id
				this.display()
				new Notice('Route deleted successfully')
			}
		} catch (error) {
			Logger.error('Configuration', '369. Error deleting route', error)
			this.showError('Failed to delete route')
		}
	}

	private addSchemaConfigSection(): void {
		Logger.debug('Configuration', '370. Adding schema configuration section')
		try {
			new Setting(this.containerEl)
				.setName('Strapi Schema')
				.setDesc('Paste your complete Strapi schema JSON here')
				.addTextArea(text => {
					this.components.schemaInput = text
					text.setValue(this.getCurrentRouteSchema()).onChange(async value => {
						await this.updateCurrentRouteConfig('schema', value)
					})
					text.inputEl.rows = 10
					text.inputEl.cols = 50
				})

			new Setting(this.containerEl)
				.setName('Schema Description')
				.setDesc('Provide descriptions for each field in the schema')
				.addTextArea(text => {
					this.components.schemaDescriptionInput = text
					text
						.setValue(this.getCurrentRouteSchemaDescription())
						.onChange(async value => {
							await this.updateCurrentRouteConfig('schemaDescription', value)
						})
					text.inputEl.rows = 10
					text.inputEl.cols = 50
				})
		} catch (error) {
			Logger.error(
				'Configuration',
				'371. Error setting up schema configuration',
				error
			)
		}
	}

	private addContentFieldSection(): void {
		Logger.debug('Configuration', '372. Adding content field section')
		try {
			new Setting(this.containerEl)
				.setName('Content Field Name')
				.setDesc(
					'Enter the name of the field where the main article content should be inserted'
				)
				.addText(text => {
					this.components.contentFieldInput = text
					text
						.setValue(this.getCurrentRouteContentField())
						.setPlaceholder('content')
						.onChange(async value => {
							await this.updateCurrentRouteConfig('contentField', value)
						})
				})
		} catch (error) {
			Logger.error(
				'Configuration',
				'373. Error setting up content field section',
				error
			)
		}
	}

	private addLanguageSection(): void {
		Logger.debug('Configuration', '374. Adding language section')
		try {
			new Setting(this.containerEl)
				.setName('Target Language')
				.setDesc('Select the target language for the exported content')
				.addDropdown(dropdown => {
					this.components.languageDropdown = dropdown
					const languages = this.getAvailableLanguages()
					Object.entries(languages).forEach(([code, name]) => {
						dropdown.addOption(code, name)
					})
					dropdown
						.setValue(this.getCurrentRouteLanguage())
						.onChange(async value => {
							await this.updateCurrentRouteConfig('language', value)
						})
				})
		} catch (error) {
			Logger.error(
				'Configuration',
				'375. Error setting up language section',
				error
			)
		}
	}

	private addAutoConfigSection(): void {
		Logger.debug('Configuration', '376. Adding auto-config section')
		try {
			new Setting(this.containerEl)
				.setName('Auto-Configure')
				.setDesc('Automatically configure fields using OpenAI (Experimental)')
				.addButton(button => {
					button
						.setButtonText('Generate Configuration')
						.setCta()
						.onClick(() => this.generateConfiguration())
				})

			new Setting(this.containerEl)
				.setName('Generated Configuration')
				.setDesc(
					'The generated configuration will appear here. You can edit it if needed.'
				)
				.addTextArea(text => {
					this.components.configOutput = text
					if (text) {
						text
							.setValue(this.plugin.settings.generatedConfig || '')
							.onChange(async value => {
								this.plugin.settings.generatedConfig = value
								await this.plugin.saveSettings()
							})
						text.inputEl.rows = 10
						text.inputEl.cols = 50
					}
				})

			new Setting(this.containerEl)
				.setName('Apply Configuration')
				.setDesc('Use this configuration for the plugin')
				.addButton(button => {
					button
						.setButtonText('Apply')
						.setCta()
						.onClick(() => this.applyConfiguration())
				})
		} catch (error) {
			Logger.error(
				'Configuration',
				'377. Error setting up auto-config section',
				error
			)
		}
	}

	private async generateConfiguration(): Promise<void> {
		Logger.info('Configuration', '378. Generating configuration')
		try {
			const currentRoute = this.plugin.settings.routes.find(
				route => route.id === this.currentRouteId
			)

			if (!currentRoute) {
				throw new Error('Current route not found')
			}

			const config = await this.configGenerator.generateConfiguration({
				schema: currentRoute.schema,
				language: currentRoute.language,
				additionalInstructions: currentRoute.additionalInstructions,
			})

			if (this.components.configOutput) {
				this.components.configOutput.setValue(JSON.stringify(config, null, 2))
				await this.updateCurrentRouteConfig(
					'generatedConfig',
					JSON.stringify(config)
				)
			}

			new Notice('Configuration generated successfully!')
		} catch (error) {
			Logger.error(
				'Configuration',
				'379. Error generating configuration',
				error
			)
			new Notice(`Failed to generate configuration: ${error.message}`)
		}
	}

	private async applyConfiguration(): Promise<void> {
		Logger.info('Configuration', '380. Applying generated configuration')
		try {
			if (!this.components.configOutput) {
				Logger.error(
					'Configuration',
					'Configuration output component is not initialized'
				)
				throw new Error('Configuration component not initialized')
			}

			const configValue = this.components.configOutput.getValue()
			const config = JSON.parse(configValue)

			const currentRoute = this.plugin.settings.routes.find(
				route => route.id === this.currentRouteId
			)

			if (currentRoute) {
				currentRoute.fieldMappings = config.fieldMappings
				currentRoute.additionalInstructions = config.additionalInstructions
				currentRoute.contentField = config.contentField

				const imageFields = await this.identifyImageFields(configValue)

				if (imageFields.length > 0) {
					Logger.debug('Configuration', '381. Image fields detected', {
						count: imageFields.length,
					})
					new Notice('Image fields detected. Opening image selection modal...')
					await this.openImageSelectionModal(imageFields, currentRoute)
				}

				await this.plugin.saveSettings()
				new Notice('Configuration applied successfully!')
			} else {
				throw new Error('Current route not found')
			}
		} catch (error) {
			Logger.error('Configuration', '382. Error applying configuration', error)
			new Notice(`Failed to apply configuration: ${error.message}`)
		}
	}

	// Utility methods
	private getAvailableLanguages(): Record<string, string> {
		return {
			en: 'English',
			fr: 'French',
			es: 'Spanish',
			de: 'German',
			it: 'Italian',
			zh: 'Chinese',
			ja: 'Japanese',
			ko: 'Korean',
			pt: 'Portuguese',
			ru: 'Russian',
			ar: 'Arabic',
			hi: 'Hindi',
		}
	}

	private validateOpenAIKey(): boolean {
		return (
			!!this.plugin.settings.openaiApiKey &&
			this.plugin.settings.openaiApiKey.startsWith('sk-')
		)
	}

	private generateOpenAIPrompt(): string {
		return `[Your prompt here - previous implementation]`
	}

	// ... [Rest of the utility methods]

	private showError(message: string): void {
		Logger.error('Configuration', '383. Error occurred', { message })
		new Notice(`Configuration Error: ${message}`)
	}

	// Route configuration getters
	private getCurrentRouteSchema(): string {
		return this.getCurrentRouteConfig('schema')
	}

	private getCurrentRouteSchemaDescription(): string {
		return this.getCurrentRouteConfig('schemaDescription')
	}

	private getCurrentRouteLanguage(): string {
		return this.getCurrentRouteConfig('language') || 'en'
	}

	private getCurrentRouteContentField(): string {
		return this.getCurrentRouteConfig('contentField') || 'content'
	}

	private getCurrentRouteConfig(key: string): string {
		const currentRoute = this.plugin.settings.routes.find(
			route => route.id === this.currentRouteId
		)
		return currentRoute?.[key] || ''
	}

	private async updateCurrentRouteConfig(
		key: string,
		value: string
	): Promise<void> {
		Logger.debug('Configuration', `384. Updating route config: ${key}`)
		try {
			const routeIndex = this.plugin.settings.routes.findIndex(
				route => route.id === this.currentRouteId
			)
			if (routeIndex !== -1) {
				this.plugin.settings.routes[routeIndex][key] = value
				await this.plugin.saveSettings()
			}
		} catch (error) {
			Logger.error(
				'Configuration',
				`385. Error updating route config: ${key}`,
				error
			)
			throw error
		}
	}

	private async updateConfigurationFields(): Promise<void> {
		Logger.debug('Configuration', '386. Updating configuration fields')
		try {
			const currentRoute = this.plugin.settings.routes.find(
				route => route.id === this.currentRouteId
			)
			if (currentRoute) {
				if (this.components.schemaInput) {
					this.components.schemaInput.setValue(currentRoute.schema || '')
				}
				if (this.components.languageDropdown) {
					this.components.languageDropdown.setValue(
						currentRoute.language || 'en'
					)
				}
			}
		} catch (error) {
			Logger.error(
				'Configuration',
				'387. Error updating configuration fields',
				error
			)
			this.showError('Failed to update configuration fields')
		}
	}

	private async identifyImageFields(
		generatedConfig: string
	): Promise<string[]> {
		Logger.debug('Configuration', '388. Identifying image fields')
		try {
			const analysis = await this.fieldAnalyzer.analyzeSchema(generatedConfig)
			return analysis.imageFields.map(field => field.fieldName)
		} catch (error) {
			Logger.error(
				'Configuration',
				'389. Error identifying image fields',
				error
			)
			new Notice('Error identifying image fields. Please try again.')
			return []
		}
	}

	private async openImageSelectionModal(
		imageFields: string[],
		currentRoute: RouteConfig
	): Promise<void> {
		Logger.debug('Configuration', '391. Opening image selection modal')
		const modal = new ImageSelectionModal(
			this.app,
			imageFields,
			async selections => {
				await this.handleImageSelections(selections, currentRoute)
			}
		)
		modal.open()
	}

	private async handleImageSelections(
		selections: Record<string, string>,
		currentRoute: RouteConfig
	): Promise<void> {
		Logger.info('Configuration', '392. Processing image selections')
		try {
			for (const [field, imagePath] of Object.entries(selections)) {
				if (imagePath) {
					Logger.debug(
						'Configuration',
						`393. Processing image for field: ${field}`
					)
					await this.processImageField(field, imagePath, currentRoute)
				}
			}
			await this.plugin.saveSettings()
			new Notice('Image configurations updated successfully')
		} catch (error) {
			Logger.error(
				'Configuration',
				'394. Error handling image selections',
				error
			)
			this.showError('Failed to process image selections')
		}
	}

	private async processImageField(
		field: string,
		imagePath: string,
		currentRoute: RouteConfig
	): Promise<void> {
		Logger.debug('Configuration', `395. Processing image field: ${field}`)
		try {
			const file = this.app.vault.getAbstractFileByPath(imagePath)
			if (!(file instanceof TFile)) {
				throw new Error(`File not found: ${imagePath}`)
			}

			const result = await uploadImageToStrapi(
				file,
				file.name,
				this.plugin.settings,
				this.app
			)

			if (result?.url) {
				// Initialiser le fieldMapping avec les propriétés requises
				if (!currentRoute.fieldMappings[field]) {
					currentRoute.fieldMappings[field] = {
						obsidianSource: 'frontmatter', // ou 'content' selon le cas
						type: 'string',
						format: 'url',
						required: false,
						transform: 'value => value', // transformation par défaut
						validation: {
							type: 'string',
							pattern: '^https?://.+',
						},
					}
				}

				// Mettre à jour la valeur
				currentRoute.fieldMappings[field].value = result.url

				Logger.debug(
					'Configuration',
					`396. Image processed successfully for: ${field}`
				)
			} else {
				throw new Error('Failed to upload image')
			}
		} catch (error) {
			Logger.error(
				'Configuration',
				`397. Error processing image field: ${field}`,
				error
			)
			throw error
		}
	}
}

class ImageSelectionModal extends Modal {
	private imageFields: string[]
	private onSubmit: (selections: Record<string, string>) => void
	private selections: Record<string, string> = {}

	constructor(
		app: App,
		imageFields: string[],
		onSubmit: (selections: Record<string, string>) => void
	) {
		super(app)
		this.imageFields = imageFields
		this.onSubmit = onSubmit
	}

	onOpen(): void {
		Logger.debug('ImageSelectionModal', '398. Opening image selection modal')
		const { contentEl } = this

		contentEl.createEl('h2', { text: 'Select Images for Fields' })

		this.imageFields.forEach(field => {
			Logger.debug(
				'ImageSelectionModal',
				`399. Creating field selector: ${field}`
			)
			this.createFieldSelector(contentEl, field)
		})

		this.createButtons(contentEl)
	}

	private createFieldSelector(container: HTMLElement, field: string): Setting {
		const setting = new Setting(container)
			.setName(field)
			.setDesc(`Select an image for ${field}`)
			.addButton(button =>
				button.setButtonText('Choose Image').onClick(async () => {
					Logger.debug(
						'ImageSelectionModal',
						`400. Selecting image for: ${field}`
					)
					const imagePath = await this.selectImage()
					if (imagePath) {
						this.selections[field] = imagePath
						button.setButtonText('Change Image')
						Logger.debug(
							'ImageSelectionModal',
							`401. Image selected for: ${field}`
						)
						new Notice(`Image selected for ${field}`)
					}
				})
			)

		return setting
	}

	private createButtons(container: HTMLElement): void {
		Logger.debug('ImageSelectionModal', '402. Creating modal buttons')
		const buttonContainer = container.createDiv('modal-button-container')

		new Setting(buttonContainer)
			.addButton(button =>
				button
					.setButtonText('Confirm')
					.setCta()
					.onClick(() => {
						Logger.debug('ImageSelectionModal', '403. Confirming selections')
						this.close()
						this.onSubmit(this.selections)
					})
			)
			.addButton(button =>
				button.setButtonText('Cancel').onClick(() => {
					Logger.debug('ImageSelectionModal', '404. Cancelling selection')
					this.close()
				})
			)
	}

	private async selectImage(): Promise<string | null> {
		// TODO: Implement file selection using Obsidian's API
		// This is a placeholder that should be replaced with actual file selection logic
		Logger.debug('ImageSelectionModal', '405. Image selection requested')
		return 'path/to/image.jpg'
	}

	onClose(): void {
		Logger.debug('ImageSelectionModal', '406. Closing modal')
		const { contentEl } = this
		contentEl.empty()
	}
}

export default Configuration
