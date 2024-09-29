export interface FieldConfig {
	type: string
	format?: string
	items?: {
		type: string
		format?: string
	}
	required?: boolean
	description?: string
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
}

export function analyzeConfiguration(config: {
	fieldMappings: Record<string, FieldConfig>
}): FieldAnalysis[] {
	const analysis: FieldAnalysis[] = []

	for (const [key, value] of Object.entries(config.fieldMappings)) {
		const fieldType = determineFieldType(value)
		analysis.push({
			fieldName: key,
			fieldType: fieldType,
			isRequired: value.required || false,
			description: value.description || '',
		})
	}

	return analysis
}

function determineFieldType(fieldConfig: FieldConfig): FieldType {
	if (fieldConfig.type === 'string' && fieldConfig.format === 'url') {
		return 'image'
	} else if (
		fieldConfig.type === 'array' &&
		fieldConfig.items?.type === 'string' &&
		fieldConfig.items?.format === 'url'
	) {
		return 'imageArray'
	} else {
		return fieldConfig.type as FieldType
	}
}
