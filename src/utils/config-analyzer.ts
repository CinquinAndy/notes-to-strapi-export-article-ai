function analyzeConfiguration(config: any): FieldAnalysis[] {
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

function determineFieldType(fieldConfig: any): FieldType {
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

type FieldType =
	| 'string'
	| 'number'
	| 'boolean'
	| 'image'
	| 'imageArray'
	| 'object'
	| 'array'

interface FieldAnalysis {
	fieldName: string
	fieldType: FieldType
	isRequired: boolean
	description: string
}
