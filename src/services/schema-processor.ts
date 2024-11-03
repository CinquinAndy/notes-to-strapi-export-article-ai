import { z } from 'zod'
import { Logger } from '../utils/logger'

/**
 * Interfaces for schema processing
 */
interface FieldDescription {
	type: string
	description: string
	isRequired: boolean
	example: any
}

interface ProcessedSchema {
	fields: Record<string, FieldDescription>
	validation: z.ZodType<any>
	example: Record<string, any>
}

/**
 * Simplified base schemas for OpenAI
 */
const simpleSchema = z.object({
	type: z.string(),
	description: z.string(),
	required: z.boolean(),
})

export class SchemaProcessor {
	constructor() {
		Logger.info('SchemaProcessor', 'Initializing Schema Processor')
	}

	processSchema(
		strapiSchema: string,
		schemaDescription: string
	): ProcessedSchema {
		Logger.info('SchemaProcessor', 'Processing schema')

		try {
			// Parse inputs
			const schema = this.parseAndValidate(strapiSchema)
			const descriptions = this.parseAndValidate(schemaDescription)

			Logger.debug('SchemaProcessor', 'Schemas parsed', {
				fields: Object.keys(schema.data).length,
			})

			// Create field descriptions
			const fields = this.createFieldDescriptions(
				schema.data,
				descriptions.data
			)

			return {
				fields,
				validation: this.createSimpleValidation(),
				example: this.createExamples(fields),
			}
		} catch (error) {
			Logger.error('SchemaProcessor', 'Schema processing failed', error)
			throw error
		}
	}

	private parseAndValidate(jsonString: string): { data: Record<string, any> } {
		const parsed = JSON.parse(jsonString)
		if (!parsed.data || typeof parsed.data !== 'object') {
			throw new Error('Invalid format: must contain data object')
		}
		return parsed
	}

	private createFieldDescriptions(
		schema: Record<string, any>,
		descriptions: Record<string, string>
	): Record<string, FieldDescription> {
		const fields: Record<string, FieldDescription> = {}

		for (const [field, value] of Object.entries(schema)) {
			fields[field] = {
				type: this.determineType(value),
				description: descriptions[field] || `Field ${field}`,
				isRequired: true,
				example: this.createExample(value),
			}
		}

		return fields
	}

	private determineType(value: any): string {
		if (value === 'string or id') return 'media'
		if (Array.isArray(value)) return 'array'
		if (typeof value === 'object' && value !== null) return 'object'
		if (typeof value === 'number') return 'number'
		return 'string'
	}

	private createExample(value: any): any {
		if (value === 'string or id') return 'https://example.com/image.jpg'
		if (Array.isArray(value)) return value
		if (typeof value === 'object' && value !== null) return value
		return value
	}

	private createSimpleValidation(): z.ZodType<any> {
		return z.record(simpleSchema)
	}

	private createExamples(
		fields: Record<string, FieldDescription>
	): Record<string, any> {
		return Object.entries(fields).reduce((acc, [key, field]) => {
			acc[key] = field.example
			return acc
		}, {})
	}
}
