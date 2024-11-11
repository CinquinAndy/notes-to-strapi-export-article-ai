import { Setting, Notice } from 'obsidian'
import StrapiExporterPlugin from '../main'

/**
 * Represents a field validator for API keys
 */
interface APIKeyValidator {
	validate: (key: string) => boolean
	pattern: RegExp
	message: string
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
		const { containerEl } = this
		containerEl.empty()

		this.createHeader()
		this.addStrapiSettings()
		this.addForVoyezSettings()
		this.addOpenAISettings()
		this.addValidationButton()
	}

	private createHeader(): void {
		const header = this.containerEl.createEl('div', { cls: 'api-keys-header' })

		header.createEl('h2', { text: 'API Keys Configuration' })
		header.createEl('p', {
			text: 'Configure your API keys for various services. All keys are stored locally and encrypted.',
			cls: 'api-keys-description',
		})
	}

	private addStrapiSettings(): void {
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
	}

	private validateField(
		key: string,
		value: string,
		validationEl: HTMLElement
	): void {
		const validator = this.validators[key]
		if (validator) {
			const isValid = validator.validate(value)
			validationEl.style.display = isValid ? 'none' : 'block'
			validationEl.setText(isValid ? '' : validator.message)
			validationEl.classList.toggle('invalid', !isValid)
		}
	}

	private addValidationButton(): void {
		new Setting(this.containerEl).addButton(button =>
			button
				.setButtonText('Validate All Keys')
				.setCta()
				.onClick(async () => {
					try {
						await this.validateAllKeys()
					} catch (error) {
						new Notice(`Validation failed: ${error.message}`)
					}
				})
		)
	}

	private async validateAllKeys(): Promise<void> {
		const validations = Object.entries(this.validators).map(
			async ([key, validator]) => {
				const value = this.plugin.settings[key]
				if (!validator.validate(value)) {
					throw new Error(`Invalid ${key}: ${validator.message}`)
				}
			}
		)

		await Promise.all(validations)
	}
}
