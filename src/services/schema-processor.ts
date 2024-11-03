import { z } from 'zod'
import { Logger } from '../utils/logger'

/**
 * Interface for raw Strapi schema input
 */
interface RawStrapiSchema {
	data: Record<string, any>
}

/**
 * Interface for field descriptions
 */
interface FieldDescription {
	type: string
	description: string
	example?: any
	isRequired?: boolean
}

/**
 * Interface for processed schema
 */
export interface ProcessedSchema {
	fields: Record<string, FieldDescription>
	validation: z.ZodType<any>
	example: Record<string, any>
}

/**
 * Service to process and combine Strapi schemas
 */
export class SchemaProcessor {
	constructor() {
		Logger.info('SchemaProcessor', 'Initializing Schema Processor')
	}

	/**
	 * Process and combine schema with descriptions
	 */
	processSchema(
		strapiSchema: string,
		schemaDescription: string
	): ProcessedSchema {
		Logger.info('SchemaProcessor', 'Starting schema processing')

		try {
			// Parse input schemas
			const parsedSchema = JSON.parse(strapiSchema)
			const parsedDescription = JSON.parse(schemaDescription)

			Logger.debug('SchemaProcessor', 'Schemas parsed successfully', {
				schemaFields: Object.keys(parsedSchema.data).length,
			})

			// Process fields and create combined schema
			const processedFields = this.combineSchemas(
				parsedSchema.data,
				parsedDescription
			)

			Logger.debug('SchemaProcessor', 'Fields combined', {
				processedFields: Object.keys(processedFields).length,
			})

			// Generate Zod validation schema
			const validationSchema = this.generateValidationSchema(processedFields)

			// Generate example data
			const example = this.generateExampleData(processedFields)

			Logger.info('SchemaProcessor', 'Schema processing completed')

			return {
				fields: processedFields,
				validation: validationSchema,
				example,
			}
		} catch (error) {
			Logger.error('SchemaProcessor', 'Schema processing failed', error)
			throw new Error(`Schema processing failed: ${error.message}`)
		}
	}

	/**
	 * Combine schema types with descriptions
	 */
	private combineSchemas(
		schema: Record<string, any>,
		descriptions: Record<string, any>
	): Record<string, FieldDescription> {
		Logger.debug('SchemaProcessor', 'Combining schemas')

		const combined: Record<string, FieldDescription> = {}

		for (const [field, type] of Object.entries(schema)) {
			const description = descriptions[field]

			combined[field] = this.processField(field, type, description)
		}

		return combined
	}

	/**
	 * Process individual field
	 */
	private processField(
		fieldName: string,
		type: any,
		description: string
	): FieldDescription {
		Logger.debug('SchemaProcessor', `Processing field: ${fieldName}`)

		if (Array.isArray(type)) {
			return {
				type: 'array',
				description: description || `Array of ${fieldName} items`,
				example: type[0],
				isRequired: true,
			}
		}

		if (typeof type === 'object' && type !== null) {
			return {
				type: 'object',
				description: description || `${fieldName} object`,
				example: type,
				isRequired: true,
			}
		}

		return {
			type: typeof type === 'string' ? type : 'string',
			description: description || `${fieldName} field`,
			example: type,
			isRequired: true,
		}
	}

	/**
	 * Generate Zod validation schema
	 */
	private generateValidationSchema(
		fields: Record<string, FieldDescription>
	): z.ZodType<any> {
		Logger.debug('SchemaProcessor', 'Generating validation schema')

		const schemaFields: Record<string, z.ZodType<any>> = {}

		for (const [field, desc] of Object.entries(fields)) {
			schemaFields[field] = this.createFieldValidator(desc)
		}

		return z.object(schemaFields)
	}

	/**
	 * Create validator for specific field
	 */
	private createFieldValidator(field: FieldDescription): z.ZodType<any> {
		switch (field.type) {
			case 'string':
				return z.string()
			case 'number':
				return z.number()
			case 'array':
				return z.array(z.any())
			case 'object':
				return z.record(z.any())
			default:
				return z.any()
		}
	}

	/**
	 * Generate example data based on schema
	 */
	private generateExampleData(
		fields: Record<string, FieldDescription>
	): Record<string, any> {
		Logger.debug('SchemaProcessor', 'Generating example data')

		const example: Record<string, any> = {}

		for (const [field, desc] of Object.entries(fields)) {
			example[field] = desc.example || this.getDefaultExample(desc.type)
		}

		return example
	}

	/**
	 * Get default example value for type
	 */
	private getDefaultExample(type: string): any {
		switch (type) {
			case 'string':
				return 'example string'
			case 'number':
				return 0
			case 'array':
				return []
			case 'object':
				return {}
			default:
				return null
		}
	}
}
