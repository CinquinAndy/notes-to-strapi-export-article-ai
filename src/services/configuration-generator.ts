import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { Logger } from '../utils/logger'
import { SchemaProcessor } from './schema-processor'

export class ConfigurationGenerator {
	private model
	private schemaProcessor: SchemaProcessor

	constructor(options: { openaiApiKey: string }) {
		Logger.info('ConfigGenerator', 'Initializing Configuration Generator')

		const openai = createOpenAI({
			apiKey: options.openaiApiKey,
		})

		this.model = openai('gpt-4o-mini', {
			structuredOutputs: true,
		})

		this.schemaProcessor = new SchemaProcessor()

		Logger.debug('ConfigGenerator', 'Initialization complete')
	}

	async generateConfiguration(params: {
		schema: string
		schemaDescription: string
		language: string
		additionalInstructions?: string
	}) {
		Logger.info('ConfigGenerator', 'Starting configuration generation')

		console.log(params)
		try {
			// Process schema
			const processedSchema = this.schemaProcessor.processSchema(
				params.schema,
				params.schemaDescription
			)

			Logger.debug('ConfigGenerator', 'Schema processed', {
				fieldCount: Object.keys(processedSchema.fields).length,
			})

			// Generate configuration
			const { object } = await generateObject({
				model: this.model,
				mode: 'json',
				schema: processedSchema.validation,
				schemaName: 'StrapiConfiguration',
				schemaDescription: 'Strapi content configuration with field mappings',
				prompt: this.buildPrompt(processedSchema, params),
			})

			Logger.info('ConfigGenerator', 'Configuration generated successfully')
			return object
		} catch (error) {
			Logger.error('ConfigGenerator', 'Configuration generation failed', error)
			throw error
		}
	}

	private buildPrompt(
		processedSchema: any,
		params: {
			language: string
			additionalInstructions?: string
		}
	): string {
		return `Generate a Strapi content configuration based on this schema:

Schema Fields:
${JSON.stringify(processedSchema.fields, null, 2)}

Example Data:
${JSON.stringify(processedSchema.example, null, 2)}

Requirements:
1. Target language: ${params.language}
2. Process fields according to their types and descriptions
3. Handle arrays and nested objects appropriately
4. Include all required fields
5. Follow field descriptions for proper content generation

Additional Instructions:
${params.additionalInstructions || 'No additional instructions'}

Generate a complete configuration following the provided schema structure.`
	}
}
