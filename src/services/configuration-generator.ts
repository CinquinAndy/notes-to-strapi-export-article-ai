import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { Logger } from '../utils/logger'
import { SchemaProcessor } from './schema-processor'

export class ConfigurationGenerator {
	private model
	private schemaProcessor: SchemaProcessor

	constructor(options: { openaiApiKey: string }) {
		Logger.info('ConfigGenerator', 'Initializing')

		const openai = createOpenAI({
			apiKey: options.openaiApiKey,
		})

		this.model = openai('gpt-4o-mini', {
			structuredOutputs: true,
		})

		this.schemaProcessor = new SchemaProcessor()
	}

	async generateConfiguration(params: {
		schema: string
		schemaDescription: string
		language: string
		additionalInstructions?: string
	}) {
		Logger.info('ConfigGenerator', 'Starting generation')

		try {
			const processedSchema = this.schemaProcessor.processSchema(
				params.schema,
				params.schemaDescription
			)

			// Use simple JSON mode for OpenAI
			const { object } = await generateObject({
				model: this.model,
				mode: 'json',
				schema: processedSchema.validation,
				schemaName: 'StrapiSchema',
				schemaDescription: 'Field configuration for Strapi CMS',
				prompt: this.buildPrompt(processedSchema, params),
			})

			return this.transformToConfiguration(object)
		} catch (error) {
			Logger.error('ConfigGenerator', 'Generation failed', error)
			throw error
		}
	}

	private buildPrompt(
		processedSchema: any,
		params: { language: string; additionalInstructions?: string }
	): string {
		return `Create a Strapi configuration based on this schema:

Schema Fields:
${JSON.stringify(processedSchema.fields, null, 2)}

Target Language: ${params.language}

Requirements:
1. For each field, provide:
   - type (string, number, media, array, object)
   - description
   - required status (true/false)

2. Special handling needed for:
   - Media fields (image_presentation) - expect URLs
   - Arrays (gallery, tags) - expect multiple items
   - Objects (links) - maintain structure
   - SEO fields - proper descriptions

Additional Instructions:
${params.additionalInstructions || 'None provided'}`
	}

	private transformToConfiguration(generatedSchema: any) {
		// Transform the generated schema into the final configuration
		return {
			fieldMappings: Object.entries(generatedSchema).reduce(
				(acc, [key, value]: [string, any]) => ({
					...acc,
					[key]: {
						type: value.type,
						description: value.description,
						required: value.required,
					},
				}),
				{}
			),
			contentField: 'content',
		}
	}
}
