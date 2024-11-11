import { Setting, Notice, TextComponent } from 'obsidian'
import StrapiExporterPlugin from '../main'
import { Logger } from '../utils/logger'

/**
 * Represents a field validator for API keys
 */
interface APIKeyValidator {
	validate: (key: string) => boolean
	pattern: RegExp
	message: string
}

/**
 * Component for handling API key input fields with validation
 */
class APIKeyField {
	private setting: Setting
	private textComponent: TextComponent
	private validationEl: HTMLElement

	constructor(
		containerEl: HTMLElement,
		private options: {
			name: string
			desc: string
			placeholder: string
			value: string
			settingKey: string
			type: 'text' | 'password' | 'url'
			onChange: (value: string) => Promise<void>
			validator?: APIKeyValidator
		}
	) {
		Logger.debug('APIKeyField', `Creating field: ${options.name}`)
		this.createField(containerEl)
	}

	/**
	 * Creates the input field with validation
	 */
	private createField(containerEl: HTMLElement): void {
		Logger.debug('APIKeyField', 'Setting up field elements')

		// Create main setting component
		this.setting = new Setting(containerEl)
			.setName(this.options.name)
			.setDesc(this.options.desc)

		// Add text input
		this.setting.addText(text => {
			this.textComponent = text
			this.setupTextComponent(text)
			return text
		})

		// Create validation message element
		this.setupValidation()
	}

	/**
	 * Sets up the text component with its properties and event handlers
	 */
	private setupTextComponent(text: TextComponent): void {
		text
			.setPlaceholder(this.options.placeholder)
			.setValue(this.options.value)
			.onChange(async newValue => {
				try {
					await this.options.onChange(newValue)
					Logger.debug('APIKeyField', `Value updated for: ${this.options.name}`)
				} catch (error) {
					Logger.error(
						'APIKeyField',
						`Update failed for: ${this.options.name}`,
						error
					)
					new Notice(`Failed to update ${this.options.name}: ${error.message}`)
				}
			})

		// Handle password type fields
		if (this.options.type === 'password') {
			text.inputEl.type = 'password'
			text.inputEl.addClass('api-key-input')
		}

		// Add blur event for validation
		text.inputEl.addEventListener('blur', () => this.validate())
	}

	/**
	 * Sets up the validation message element
	 */
	private setupValidation(): void {
		this.validationEl = this.setting.settingEl.createDiv('validation-message')
		this.validationEl.hide()
	}

	/**
	 * Validates the current field value
	 * @returns boolean indicating if the value is valid
	 */
	public validate(): boolean {
		const value = this.getValue()
		Logger.debug('APIKeyField', `Validating field: ${this.options.name}`)

		if (!this.options.validator) {
			return true
		}

		const isValid = this.options.validator.validate(value)
		this.updateValidationUI(isValid)

		return isValid
	}

	/**
	 * Updates the validation UI elements based on validation result
	 */
	private updateValidationUI(isValid: boolean): void {
		if (isValid) {
			this.validationEl.hide()
			this.validationEl.empty()
		} else {
			this.validationEl.show()
			this.validationEl.setText(this.options.validator?.message || '')
			this.validationEl.toggleClass('invalid', true)
		}
	}

	/**
	 * Gets the current value of the field
	 */
	public getValue(): string {
		return this.textComponent.getValue()
	}

	/**
	 * Sets the value of the field
	 */
	public setValue(value: string): void {
		this.textComponent.setValue(value)
		this.validate()
	}

	/**
	 * Clears the field value
	 */
	public clear(): void {
		this.setValue('')
		this.validationEl.hide()
	}
}

/**
 * Class for managing API key settings in Obsidian
 */
export class APIKeys {
	private readonly validators: Record<string, APIKeyValidator>

	constructor(
		private plugin: StrapiExporterPlugin,
		private containerEl: HTMLElement
	) {
		Logger.debug('APIKeys', 'Initializing API Keys management')
		this.validators = this.initializeValidators()
	}

	/**
	 * Initializes field validators
	 */
	private initializeValidators(): Record<string, APIKeyValidator> {
		return {
			strapiUrl: {
				validate: (url: string) => /^https?:\/\/.+/.test(url),
				pattern: /^https?:\/\/.+/,
				message: 'Must be a valid URL starting with http:// or https://',
			},
			strapiApiToken: {
				validate: (token: string) => token.length >= 32,
				pattern: /.{32,}/,
				message: 'Must be at least 32 characters long',
			},
			openaiApiKey: {
				validate: (key: string) => /^sk-[A-Za-z0-9]{32,}$/.test(key),
				pattern: /^sk-[A-Za-z0-9]{32,}$/,
				message: 'Must start with "sk-" followed by at least 32 characters',
			},
		}
	}

	display(): void {
		Logger.info('APIKeys', '279. Displaying API Keys configuration')
		const { containerEl } = this
		containerEl.empty()

		this.createHeader()
		this.addStrapiSettings()
		this.addForVoyezSettings()
		this.addOpenAISettings()
		this.addValidationButton()

		Logger.debug('APIKeys', '280. API Keys configuration rendered')
	}

	private createHeader(): void {
		Logger.debug('APIKeys', '281. Creating header section')
		const header = this.containerEl.createEl('div', { cls: 'api-keys-header' })

		header.createEl('h2', { text: 'API Keys Configuration' })
		header.createEl('p', {
			text: 'Configure your API keys for various services. All keys are stored locally and encrypted.',
			cls: 'api-keys-description',
		})
	}

	private addStrapiSettings(): void {
		Logger.debug('APIKeys', '282. Adding Strapi settings')

		// Strapi URL Setting
		this.createSettingField({
			name: 'Strapi URL',
			desc: 'Enter your Strapi instance URL (e.g. https://your-strapi-url)',
			placeholder: 'https://your-strapi-url',
			value: this.plugin.settings.strapiUrl,
			settingKey: 'strapiUrl',
			type: 'url',
		})

		// Strapi API Token Setting
		this.createSettingField({
			name: 'Strapi API Token',
			desc: 'Enter your Strapi API token',
			placeholder: 'Enter your token',
			value: this.plugin.settings.strapiApiToken,
			settingKey: 'strapiApiToken',
			type: 'password',
		})
	}

	private addForVoyezSettings(): void {
		Logger.debug('APIKeys', '283. Adding ForVoyez settings')

		this.createSettingField({
			name: 'ForVoyez API Key',
			desc: 'Enter your ForVoyez API key',
			placeholder: 'Enter your ForVoyez API key',
			value: this.plugin.settings.forvoyezApiKey,
			settingKey: 'forvoyezApiKey',
			type: 'password',
		})
	}

	private addOpenAISettings(): void {
		Logger.debug('APIKeys', '284. Adding OpenAI settings')

		this.createSettingField({
			name: 'OpenAI API Key',
			desc: 'Enter your OpenAI API key',
			placeholder: 'Enter your OpenAI API key',
			value: this.plugin.settings.openaiApiKey,
			settingKey: 'openaiApiKey',
			type: 'password',
		})
	}

	private createSettingField({
		name,
		desc,
		placeholder,
		value,
		settingKey,
		type,
	}: {
		name: string
		desc: string
		placeholder: string
		value: string
		settingKey: string
		type: 'text' | 'password' | 'url'
	}): void {
		Logger.debug('APIKeys', `285. Creating setting field: ${name}`)

		const setting = new Setting(this.containerEl).setName(name).setDesc(desc)

		// Add validation message element first
		const validationEl = setting.settingEl.createDiv('validation-message')
		validationEl.style.display = 'none'

		// Create text component
		setting.addText(text => {
			// Configure text component
			text
				.setPlaceholder(placeholder)
				.setValue(value)
				.onChange(async newValue => {
					try {
						await this.updateSetting(settingKey, newValue)
					} catch (error) {
						Logger.error('APIKeys', `286. Error updating ${settingKey}`, error)
						new Notice(`Failed to update ${name}: ${error.message}`)
					}
				})

			// Handle password type
			if (type === 'password') {
				text.inputEl.type = 'password'
				text.inputEl.classList.add('api-key-input')
			}

			// Add blur event listener directly
			text.inputEl.addEventListener('blur', () => {
				this.validateField(settingKey, text.getValue(), validationEl)
			})

			return text
		})
	}

	private async updateSetting(key: string, value: string): Promise<void> {
		Logger.debug('APIKeys', `287. Updating setting: ${key}`)

		try {
			// Validate if we have a validator for this key
			if (this.validators[key]) {
				const isValid = this.validators[key].validate(value)
				if (!isValid) {
					throw new Error(this.validators[key].message)
				}
			}

			// Update the setting
			this.plugin.settings[key] = value
			await this.plugin.saveSettings()
			Logger.debug('APIKeys', `288. Setting updated successfully: ${key}`)
		} catch (error) {
			Logger.error('APIKeys', `289. Error updating setting: ${key}`, error)
			throw error
		}
	}

	private validateField(
		key: string,
		value: string,
		validationEl: HTMLElement
	): void {
		Logger.debug('APIKeys', `290. Validating field: ${key}`)

		const validator = this.validators[key]
		if (validator) {
			const isValid = validator.validate(value)
			validationEl.style.display = isValid ? 'none' : 'block'
			validationEl.setText(isValid ? '' : validator.message)
			validationEl.classList.toggle('invalid', !isValid)
		}
	}

	private addValidationButton(): void {
		Logger.debug('APIKeys', '291. Adding validation button')

		new Setting(this.containerEl).addButton(button =>
			button
				.setButtonText('Validate All Keys')
				.setCta()
				.onClick(async () => {
					try {
						await this.validateAllKeys()
					} catch (error) {
						Logger.error('APIKeys', '292. Validation failed', error)
						new Notice(`Validation failed: ${error.message}`)
					}
				})
		)
	}

	private async validateAllKeys(): Promise<void> {
		Logger.info('APIKeys', '293. Starting validation of all keys')

		const validations = Object.entries(this.validators).map(
			async ([key, validator]) => {
				const value = this.plugin.settings[key]
				if (!validator.validate(value)) {
					throw new Error(`Invalid ${key}: ${validator.message}`)
				}
			}
		)

		try {
			await Promise.all(validations)
			new Notice('All API keys are valid!')
			Logger.info('APIKeys', '294. All keys validated successfully')
		} catch (error) {
			Logger.error('APIKeys', '295. Validation failed', error)
			throw error
		}
	}
}
