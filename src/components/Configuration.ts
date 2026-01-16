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
import { RouteConfig } from '../types'
import { StructuredFieldAnalyzer } from '../services/field-analyzer'
import { ConfigurationGenerator } from '../services/configuration-generator'

export class Configuration {
	private fieldAnalyzer: StructuredFieldAnalyzer
	private configGenerator: ConfigurationGenerator
	private readonly plugin: StrapiExporterPlugin
	private readonly containerEl: HTMLElement
	private readonly components: {
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
	private readonly app: App

	constructor(plugin: StrapiExporterPlugin, containerEl: HTMLElement) {
		this.plugin = plugin
		this.containerEl = containerEl
		this.app = plugin.app
		// Use persisted route ID or default to first route
		this.currentRouteId =
			this.plugin.settings.currentConfigRouteId ||
			this.plugin.settings.routes[0]?.id ||
			''

		// Initialiser les services avec la clé API
		this.initializeServices()

		this.components = {
			schemaInput: null,
			schemaDescriptionInput: null,
			contentFieldInput: null,
			configOutput: null,
			languageDropdown: null,
			routeSelector: null,
		}
	}

	/**
	 * Initialize or reinitialize services with current API key
	 */
	private initializeServices(): void {
		if (!this.plugin.settings.openaiApiKey) {
			return
		}

		this.fieldAnalyzer = new StructuredFieldAnalyzer({
			openaiApiKey: this.plugin.settings.openaiApiKey,
		})

		this.configGenerator = new ConfigurationGenerator({
			openaiApiKey: this.plugin.settings.openaiApiKey,
		})
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()

		try {
			this.createHeader()
			this.addRouteSelector()
			this.addSchemaConfigSection()
			this.addContentFieldSection()
			this.addLanguageSection()
			this.addAutoConfigSection()
		} catch (error) {
			this.showError(
				'Failed to display configuration interface' + error.message
			)
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
					this.currentRouteId = value
					// Persist the selected route ID
					this.plugin.settings.currentConfigRouteId = value
					await this.plugin.saveSettings()
					await this.updateConfigurationFields()
				})
			})

		this.addRouteManagementButtons(routeSetting)
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
		try {
			const newRoute: RouteConfig = {
				// Base properties
				id: `route-${Date.now()}`,
				name: 'New Route',

				// Strapi configuration
				schema: '',
				schemaDescription: '',
				generatedConfig: '',
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

			this.plugin.settings.routes.push(newRoute)
			await this.plugin.saveSettings()
			this.currentRouteId = newRoute.id
			this.display()
			new Notice('New route created successfully')
		} catch (error) {
			this.showError('Failed to create new route' + error.message)
		}
	}

	private async deleteCurrentRoute(): Promise<void> {
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
			this.showError('Failed to delete route' + error.message)
		}
	}

	/**
	 * Updates schema input handler
	 */
	private addSchemaConfigSection(): void {
		try {
			// Strapi Schema Input
			new Setting(this.containerEl)
				.setName('Strapi Schema')
				.setDesc('Paste your complete Strapi schema JSON here')
				.addTextArea(text => {
					this.components.schemaInput = text
					text.setValue(this.getCurrentRouteSchema()).onChange(async value => {
						// Validate JSON format
						JSON.parse(value)
						await this.updateCurrentRouteConfig('schema', value)
					})
					text.inputEl.rows = 10
					text.inputEl.cols = 50
				})

			// Schema Description Input
			new Setting(this.containerEl)
				.setName('Schema Description')
				.setDesc('Provide descriptions for each field in the schema')
				.addTextArea(text => {
					this.components.schemaDescriptionInput = text
					text
						.setValue(this.getCurrentRouteSchemaDescription())
						.onChange(async value => {
							JSON.parse(value)
							await this.updateCurrentRouteConfig('schemaDescription', value)
						})
					text.inputEl.rows = 10
					text.inputEl.cols = 50
				})
		} catch (error) {
			this.showError(
				'Failed to set up schema configuration section' + error.message
			)
		}
	}

	private addContentFieldSection(): void {
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
	}

	private addLanguageSection(): void {
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
	}

	private addAutoConfigSection(): void {
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
				text
					.setValue(this.getCurrentRouteGeneratedConfig())
					.onChange(async value => {
						await this.updateCurrentRouteConfig('generatedConfig', value)
					})
				text.inputEl.rows = 10
				text.inputEl.cols = 50
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
	}

	private async generateConfiguration(): Promise<void> {
		try {
			const currentRoute = this.plugin.settings.routes.find(
				route => route.id === this.currentRouteId
			)

			if (!currentRoute) {
				throw new Error('Current route not found')
			}

			// Validate OpenAI API key
			if (!this.plugin.settings.openaiApiKey) {
				throw new Error(
					'OpenAI API key not configured. Please configure it in settings.'
				)
			}

			// Get both schema and schema description
			const schema = currentRoute.schema
			const schemaDescription = currentRoute.schemaDescription

			if (!schema || !schemaDescription) {
				throw new Error('Both schema and schema description are required')
			}

			// Generate configuration using the new service
			const config = await this.configGenerator.generateConfiguration({
				schema,
				schemaDescription,
				language: currentRoute.language,
				additionalInstructions: currentRoute.additionalInstructions,
			})

			if (this.components.configOutput) {
				// Format the output configuration
				const formattedConfig = JSON.stringify(config, null, 2)

				// Update the UI and save
				await this.updateCurrentRouteConfig('generatedConfig', formattedConfig)

				this.components.configOutput.setValue(formattedConfig)

				new Notice('Configuration generated successfully!')
			}
		} catch (error) {
			let errorMessage = 'Failed to generate configuration'

			if (error instanceof SyntaxError) {
				errorMessage = 'Invalid JSON format in schema or description'
			} else if (error instanceof Error) {
				errorMessage = error.message
			}

			new Notice(errorMessage)
		}
	}

	/**
	 * Apply the generated configuration
	 */
	private async applyConfiguration(): Promise<void> {
		try {
			if (!this.components.configOutput) {
				throw new Error('Configuration output not initialized')
			}

			const configValue = this.components.configOutput.getValue()

			// Validate configuration format
			const config = JSON.parse(configValue)

			const currentRoute = this.plugin.settings.routes.find(
				route => route.id === this.currentRouteId
			)

			if (!currentRoute) {
				throw new Error('Current route not found')
			}

			// Update route with new configuration
			currentRoute.fieldMappings = config.fieldMappings || {}
			currentRoute.additionalInstructions = config.additionalInstructions || ''
			currentRoute.contentField = config.contentField || 'content'

			await this.plugin.saveSettings()
			new Notice('Configuration applied successfully!')
		} catch (error) {
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

	private showError(message: string): void {
		new Notice(`Configuration Error: ${message}`)
	}

	private getCurrentRouteGeneratedConfig(): string {
		return this.getCurrentRouteConfig('generatedConfig')
	}

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
		const routeIndex = this.plugin.settings.routes.findIndex(
			route => route.id === this.currentRouteId
		)
		if (routeIndex !== -1) {
			this.plugin.settings.routes[routeIndex][key] = value
			await this.plugin.saveSettings()
		}
	}

	private async updateConfigurationFields(): Promise<void> {
		try {
			const currentRoute = this.plugin.settings.routes.find(
				route => route.id === this.currentRouteId
			)
			if (currentRoute) {
				if (this.components.schemaInput) {
					this.components.schemaInput.setValue(currentRoute.schema || '')
				}
				if (this.components.schemaDescriptionInput) {
					this.components.schemaDescriptionInput.setValue(
						currentRoute.schemaDescription || ''
					)
				}
				if (this.components.configOutput) {
					this.components.configOutput.setValue(
						currentRoute.generatedConfig || ''
					)
				}
				if (this.components.languageDropdown) {
					this.components.languageDropdown.setValue(
						currentRoute.language || 'en'
					)
				}
				if (this.components.contentFieldInput) {
					this.components.contentFieldInput.setValue(
						currentRoute.contentField || 'content'
					)
				}
			}
		} catch (error) {
			this.showError('Failed to update configuration fields' + error.message)
		}
	}

	private async identifyImageFields(
		generatedConfig: string
	): Promise<string[]> {
		try {
			const analysis = await this.fieldAnalyzer.analyzeSchema(generatedConfig)
			return analysis.imageFields.map(field => field.fieldName)
		} catch (error) {
			new Notice(
				'Error identifying image fields. Please try again.' + error.message
			)
			return []
		}
	}

	private async openImageSelectionModal(
		imageFields: string[],
		currentRoute: RouteConfig
	): Promise<void> {
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
		try {
			for (const [field, imagePath] of Object.entries(selections)) {
				if (imagePath) {
					await this.processImageField(field, imagePath, currentRoute)
				}
			}
			await this.plugin.saveSettings()
			new Notice('Image configurations updated successfully')
		} catch (error) {
			this.showError('Failed to process image selections' + error.message)
		}
	}

	private async processImageField(
		field: string,
		imagePath: string,
		currentRoute: RouteConfig
	): Promise<void> {
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

			currentRoute.fieldMappings[field].value = result.url
		} else {
			throw new Error('Failed to upload image')
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
		const { contentEl } = this

		contentEl.createEl('h2', { text: 'Select Images for Fields' })

		this.imageFields.forEach(field => {
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
					const imagePath = await this.selectImage()
					if (imagePath) {
						this.selections[field] = imagePath
						button.setButtonText('Change Image')
						new Notice(`Image selected for ${field}`)
					}
				})
			)

		return setting
	}

	private createButtons(container: HTMLElement): void {
		const buttonContainer = container.createDiv('modal-button-container')

		new Setting(buttonContainer)
			.addButton(button =>
				button
					.setButtonText('Confirm')
					.setCta()
					.onClick(() => {
						this.close()
						this.onSubmit(this.selections)
					})
			)
			.addButton(button =>
				button.setButtonText('Cancel').onClick(() => {
					this.close()
				})
			)
	}

	private async selectImage(): Promise<string | null> {
		// TODO: Implement file selection using Obsidian's API
		// This is a placeholder that should be replaced with actual file selection logic
		return 'path/to/image.jpg'
	}

	onClose(): void {
		const { contentEl } = this
		contentEl.empty()
	}
}

export default Configuration
