import { z } from 'zod'
import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { Logger } from '../utils/logger'

/**
 * Base schemas for different field types
 */
const baseSchemas = {
	// Base field schema
	field: z.object({
		type: z.string(),
		description: z.string(),
		required: z.boolean(),
		validation: z
			.object({
				min: z.number().optional(),
				max: z.number().optional(),
				pattern: z.string().optional(),
			})
			.optional(),
	}),

	// Array field schema
	array: z.object({
		type: z.literal('array'),
		description: z.string(),
		required: z.boolean(),
		items: z.object({
			type: z.string(),
			validation: z.object({}).optional(),
		}),
		validation: z
			.object({
				min: z.number().optional(),
				max: z.number().optional(),
			})
			.optional(),
	}),

	// Media field schema
	media: z.object({
		type: z.literal('media'),
		description: z.string(),
		required: z.boolean(),
		format: z.literal('url'),
		validation: z
			.object({
				pattern: z.string().optional(),
			})
			.optional(),
	}),

	// Object field schema
	object: z.object({
		type: z.literal('object'),
		description: z.string(),
		required: z.boolean(),
		properties: z.record(z.any()),
		validation: z.object({}).optional(),
	}),
}

export class SchemaGeneratorService {
	private model

	constructor(options: { openaiApiKey: string }) {
		Logger.info('SchemaGenerator', 'Initializing Schema Generator Service')

		const openai = createOpenAI({
			apiKey: options.openaiApiKey,
		})

		this.model = openai('gpt-4o-mini', {
			structuredOutputs: true,
		})

		Logger.debug('SchemaGenerator', 'Service initialized successfully')
	}

	/**
	 * Generate enriched schema from inputs
	 */
	async generateEnrichedSchema(params: {
		strapiSchema: string
		fieldDescriptions: string
		language?: string
	}) {
		Logger.info('SchemaGenerator', 'Starting schema enrichment process')

		try {
			// Parse and validate inputs
			const parsedSchema = this.parseAndValidateSchema(params.strapiSchema)
			const descriptions = this.parseAndValidateDescriptions(
				params.fieldDescriptions
			)

			Logger.debug('SchemaGenerator', 'Inputs validated successfully', {
				schemaFields: Object.keys(parsedSchema.data).length,
				hasDescriptions: !!descriptions,
			})

			// Build the output schema
			const outputSchema = this.buildOutputSchema(parsedSchema.data)

			// Generate enriched schema using OpenAI
			const { object } = await generateObject({
				model: this.model,
				schema: outputSchema,
				schemaName: 'StrapiEnrichedSchema',
				schemaDescription:
					'Enriched Strapi schema with field descriptions and validations',
				prompt: this.buildPrompt(parsedSchema, descriptions, params.language),
			})

			Logger.debug('SchemaGenerator', 'Schema generated successfully', {
				object,
			})

			return {
				success: true,
				schema: object,
			}
		} catch (error) {
			Logger.error('SchemaGenerator', 'Schema generation failed', error)
			throw error
		}
	}

	/**
	 * Build the complete output schema based on field types
	 */
	private buildOutputSchema(strapiFields: Record<string, any>): z.ZodType {
		const schemaFields: Record<string, z.ZodType> = {}

		for (const [key, value] of Object.entries(strapiFields)) {
			schemaFields[key] = this.determineFieldSchema(value)
		}

		return z.object(schemaFields).strict()
	}

	/**
	 * Determine appropriate schema for a field
	 */
	private determineFieldSchema(fieldValue: any): z.ZodType {
		if (Array.isArray(fieldValue)) {
			return baseSchemas.array
		}

		if (fieldValue === 'string or id') {
			return baseSchemas.media
		}

		if (typeof fieldValue === 'object' && fieldValue !== null) {
			return baseSchemas.object
		}

		return baseSchemas.field
	}

	/**
	 * Parse and validate Strapi schema
	 */
	private parseAndValidateSchema(schemaJson: string): {
		data: Record<string, any>
	} {
		try {
			const schema = JSON.parse(schemaJson)
			if (!schema.data || typeof schema.data !== 'object') {
				throw new Error('Invalid schema format: missing data object')
			}
			return schema
		} catch (error) {
			throw new Error(`Invalid Strapi schema: ${error.message}`)
		}
	}

	/**
	 * Parse and validate field descriptions
	 */
	private parseAndValidateDescriptions(
		descriptionsJson: string
	): Record<string, string> {
		try {
			return JSON.parse(descriptionsJson)
		} catch (error) {
			throw new Error(`Invalid field descriptions: ${error.message}`)
		}
	}

	/**
	 * Build the prompt for OpenAI
	 */
	private buildPrompt(
		schema: { data: Record<string, any> },
		descriptions: Record<string, string>,
		language = 'en'
	): string {
		return `Analyze and enrich this Strapi schema with descriptions and validations:

STRAPI SCHEMA:
${JSON.stringify(schema.data, null, 2)}

FIELD DESCRIPTIONS:
${JSON.stringify(descriptions, null, 2)}

Requirements:
1. For each field:
   - Use appropriate type (string, number, array, media, object)
   - Include field description from provided descriptions or generate one
   - Set required status based on field importance
   - Add relevant validations:
     * Strings: patterns and length limits
     * Numbers: min/max values
     * Arrays: item structure
     * Media: URL format
     * Objects: nested validation

2. Special field handling:
   - Image fields (type: "string or id"): Use media type with URL format
   - Arrays (gallery, tags): Define item structure
   - Nested objects (links): Maintain structure with validations

3. Target language: ${language}

Generate a complete schema maintaining the original structure with added descriptions and validations.`
	}
}
