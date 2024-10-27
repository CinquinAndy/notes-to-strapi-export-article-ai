import { Logger } from './logger'

export interface FieldConfig {
	type: string
	format?: string
	items?: {
		type: string
		format?: string
	}
	required?: boolean
	description?: string
	validation?: {
		min?: number
		max?: number
		pattern?: string
	}
}

export type FieldType =
	| 'string'
	| 'number'
	| 'boolean'
	| 'image'
	| 'imageArray'
	| 'object'
	| 'array'

export interface FieldAnalysis {
	fieldName: string
	fieldType: FieldType
	isRequired: boolean
	description: string
	validationRules?: {
		min?: number
		max?: number
		pattern?: string
	}
}

/**
 * Analyzes the field configuration and returns detailed field analysis
 */
export function analyzeConfiguration(config: {
	fieldMappings: Record<string, FieldConfig>
}): FieldAnalysis[] {
	Logger.info('ConfigAnalyzer', '64. Starting configuration analysis')

	try {
		const analysis: FieldAnalysis[] = []

		if (!config.fieldMappings) {
			Logger.error(
				'ConfigAnalyzer',
				'65. No field mappings found in configuration'
			)
			throw new Error('Field mappings are required in configuration')
		}

		Logger.info(
			'ConfigAnalyzer',
			`66. Analyzing ${Object.keys(config.fieldMappings).length} fields`
		)

		for (const [key, value] of Object.entries(config.fieldMappings)) {
			Logger.debug('ConfigAnalyzer', `67. Analyzing field: ${key}`, value)

			try {
				validateFieldConfig(value, key)
				const fieldType = determineFieldType(value)

				const fieldAnalysis: FieldAnalysis = {
					fieldName: key,
					fieldType,
					isRequired: value.required || false,
					description: value.description || '',
					validationRules: value.validation,
				}

				Logger.debug(
					'ConfigAnalyzer',
					`68. Field analysis result for ${key}`,
					fieldAnalysis
				)
				analysis.push(fieldAnalysis)
			} catch (error) {
				Logger.error(
					'ConfigAnalyzer',
					`69. Error analyzing field ${key}`,
					error
				)
				throw new Error(`Field analysis failed for ${key}: ${error.message}`)
			}
		}

		Logger.info('ConfigAnalyzer', '70. Configuration analysis completed')
		Logger.debug('ConfigAnalyzer', '71. Final analysis results', analysis)

		return analysis
	} catch (error) {
		Logger.error('ConfigAnalyzer', '72. Configuration analysis failed', error)
		throw new Error(`Configuration analysis failed: ${error.message}`)
	}
}

/**
 * Determines the field type based on the field configuration
 */
function determineFieldType(fieldConfig: FieldConfig): FieldType {
	Logger.debug('ConfigAnalyzer', '73. Determining field type', fieldConfig)

	try {
		if (!fieldConfig.type) {
			Logger.error('ConfigAnalyzer', '74. Field type is required')
			throw new Error('Field type is required')
		}

		// Handle image type
		if (fieldConfig.type === 'string' && fieldConfig.format === 'url') {
			Logger.debug('ConfigAnalyzer', '75. Detected image field type')
			return 'image'
		}

		// Handle image array type
		if (
			fieldConfig.type === 'array' &&
			fieldConfig.items?.type === 'string' &&
			fieldConfig.items?.format === 'url'
		) {
			Logger.debug('ConfigAnalyzer', '76. Detected image array field type')
			return 'imageArray'
		}

		// Handle standard types
		if (isValidFieldType(fieldConfig.type)) {
			Logger.debug(
				'ConfigAnalyzer',
				`77. Detected standard field type: ${fieldConfig.type}`
			)
			return fieldConfig.type as FieldType
		}

		Logger.error(
			'ConfigAnalyzer',
			`78. Invalid field type: ${fieldConfig.type}`
		)
		throw new Error(`Invalid field type: ${fieldConfig.type}`)
	} catch (error) {
		Logger.error('ConfigAnalyzer', '79. Error determining field type', error)
		throw new Error(`Failed to determine field type: ${error.message}`)
	}
}

/**
 * Validates the field configuration
 */
function validateFieldConfig(config: FieldConfig, fieldName: string): void {
	Logger.debug(
		'ConfigAnalyzer',
		`80. Validating field configuration for: ${fieldName}`
	)

	if (!config) {
		Logger.error('ConfigAnalyzer', '81. Field configuration is required')
		throw new Error('Field configuration is required')
	}

	if (!config.type) {
		Logger.error('ConfigAnalyzer', '82. Field type is required')
		throw new Error('Field type is required')
	}

	// Validate array items
	if (config.type === 'array' && !config.items) {
		Logger.error(
			'ConfigAnalyzer',
			'83. Array field requires items configuration'
		)
		throw new Error('Array field requires items configuration')
	}

	// Validate validation rules if present
	if (config.validation) {
		validateValidationRules(config.validation, fieldName)
	}

	Logger.debug(
		'ConfigAnalyzer',
		`84. Field configuration valid for: ${fieldName}`
	)
}

/**
 * Validates the validation rules
 */
function validateValidationRules(
	validation: FieldConfig['validation'],
	fieldName: string
): void {
	Logger.debug('ConfigAnalyzer', `85. Validating rules for field: ${fieldName}`)

	if (!validation) return
	if (validation.min !== undefined && typeof validation.min !== 'number') {
		Logger.error('ConfigAnalyzer', '86. Invalid min validation rule')
		throw new Error('min validation rule must be a number')
	}

	if (validation.max !== undefined && typeof validation.max !== 'number') {
		Logger.error('ConfigAnalyzer', '87. Invalid max validation rule')
		throw new Error('max validation rule must be a number')
	}

	if (
		validation.min !== undefined &&
		validation.max !== undefined &&
		validation.min > validation.max
	) {
		Logger.error('ConfigAnalyzer', '88. Invalid min/max range')
		throw new Error('min value cannot be greater than max value')
	}

	Logger.debug('ConfigAnalyzer', `89. Validation rules valid for: ${fieldName}`)
}

/**
 * Checks if the provided type is a valid FieldType
 */
function isValidFieldType(type: string): type is FieldType {
	const validTypes: FieldType[] = [
		'string',
		'number',
		'boolean',
		'image',
		'imageArray',
		'object',
		'array',
	]
	return validTypes.includes(type as FieldType)
}
