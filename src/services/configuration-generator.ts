import { z } from 'zod'
import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { Logger } from '../utils/logger'

/**
 * Validation schema for field rules
 */
const validationSchema = z.object({
	type: z.string(),
	pattern: z.string().optional(),
	min: z.number().optional(),
	max: z.number().optional(),
})

/**
 * Schema for individual field configuration
 */
const fieldMappingSchema = z.object({
	obsidianSource: z.enum(['frontmatter', 'content']),
	frontmatterKey: z.string().optional(),
	type: z.string(),
	format: z.string().optional(),
	required: z.boolean(),
	transform: z.string().optional(),
	validation: validationSchema.optional(),
})

/**
 * Main configuration schema
 */
const configurationSchema = z.object({
	fieldMappings: z.record(fieldMappingSchema),
	additionalInstructions: z.string(),
	contentField: z.string(),
})

type ConfigurationOutput = z.infer<typeof configurationSchema>

export interface ConfigGeneratorOptions {
	openaiApiKey: string
}

export class ConfigurationGenerator {
	private model

	constructor(options: ConfigGeneratorOptions) {
		Logger.info('ConfigGenerator', 'Initializing ConfigurationGenerator')
		const openai = createOpenAI({
			apiKey: options.openaiApiKey,
		})

		this.model = openai('gpt-4-turbo-preview', {
			structuredOutputs: true,
		})
		Logger.debug('ConfigGenerator', 'Model initialized', {
			modelType: 'gpt-4-turbo-preview',
		})
	}

	/**
	 * Generate configuration from schema
	 */
	async generateConfiguration(route: {
		schema: string
		language: string
		additionalInstructions?: string
	}): Promise<ConfigurationOutput> {
		Logger.info('ConfigGenerator', 'Starting configuration generation', {
			language: route.language,
			hasInstructions: !!route.additionalInstructions,
		})

		try {
			// Parse and validate schema
			let parsedSchema: any
			try {
				Logger.debug('ConfigGenerator', 'Parsing schema JSON')
				parsedSchema = JSON.parse(route.schema)
				Logger.debug('ConfigGenerator', 'Schema parsed successfully', {
					parsedSchema,
				})
			} catch (error) {
				Logger.error('ConfigGenerator', 'Schema parsing failed', error)
				throw new Error('Invalid JSON schema format')
			}

			// Extract fields from data property if present
			const fields = parsedSchema.data || parsedSchema
			Logger.debug('ConfigGenerator', 'Extracted schema fields', { fields })

			// Build and log the prompt
			const prompt = this.buildConfigurationPrompt(
				fields,
				route.language,
				route.additionalInstructions
			)
			Logger.debug('ConfigGenerator', 'Generated prompt', { prompt })
			console.log(prompt)

			// Generate configuration
			Logger.info(
				'ConfigGenerator',
				'Calling OpenAI for configuration generation'
			)
			console.log('configuration schema', configurationSchema)
			const { object } = await generateObject({
				model: this.model,
				schema: configurationSchema,
				schemaName: 'StrapiConfiguration',
				schemaDescription:
					'Configuration for mapping Obsidian content to Strapi fields',
				prompt: prompt,
			})

			Logger.debug('ConfigGenerator', 'Raw configuration received', { object })

			// Process and validate
			Logger.debug('ConfigGenerator', 'Processing generated configuration')
			const processedObject = this.processGeneratedConfig(object)
			Logger.debug('ConfigGenerator', 'Processed configuration', {
				processedObject,
			})

			const validatedConfig = configurationSchema.parse(processedObject)
			Logger.info(
				'ConfigGenerator',
				'Configuration generated and validated successfully'
			)

			return validatedConfig
		} catch (error) {
			Logger.error('ConfigGenerator', 'Configuration generation failed', error)
			throw this.handleError(error)
		}
	}

	/**
	 * Build the prompt for OpenAI
	 */
	private buildConfigurationPrompt(
		fields: Record<string, any>,
		language: string,
		additionalInstructions?: string
	): string {
		Logger.debug('ConfigGenerator', 'Building prompt', {
			fieldCount: Object.keys(fields).length,
			language,
		})

		return `Generate a Strapi configuration mapping based on the following schema fields:

Schema Fields:
${JSON.stringify(fields, null, 2)}

Requirements:
1. Create field mappings for each schema property above
2. Main content field should use 'content' as obsidianSource
3. Metadata fields should use 'frontmatter' with appropriate frontmatterKey
4. Include validation rules where appropriate
5. Language settings: ${language}
6. Arrays handling:
   - Gallery: comma-separated values
   - Tags: comma-separated values
   - Links: format as 'label|url' with semicolon separation

Field Typing Guidelines:
- Text fields: string type
- Numeric fields: number type
- Array fields: appropriate array typing
- Image fields: handle URLs or IDs
- Nested objects: maintain proper structure

Additional Context:
${additionalInstructions || 'No specific instructions provided'}

Required Output Structure:
1. fieldMappings: Record of field configurations
2. contentField: String identifying main content
3. additionalInstructions: String for processing instructions`
	}

	/**
	 * Process the generated configuration
	 */
	private processGeneratedConfig(config: any): ConfigurationOutput {
		Logger.debug('ConfigGenerator', 'Processing configuration', {
			fieldCount: Object.keys(config.fieldMappings || {}).length,
		})

		return {
			fieldMappings: Object.entries(config.fieldMappings).reduce(
				(acc, [key, mapping]: [string, any]) => {
					Logger.debug('ConfigGenerator', `Processing field: ${key}`, {
						mapping,
					})
					return {
						...acc,
						[key]: {
							...mapping,
							required: mapping.required ?? false,
							transform: this.getFieldTransform(key, mapping),
						},
					}
				},
				{}
			),
			contentField: config.contentField || 'content',
			additionalInstructions: config.additionalInstructions || '',
		}
	}

	/**
	 * Get appropriate transform for field type
	 */
	private getFieldTransform(fieldName: string, mapping: any): string {
		Logger.debug(
			'ConfigGenerator',
			`Determining transform for field: ${fieldName}`,
			{
				fieldType: mapping.type,
			}
		)

		if (mapping.transform) {
			return mapping.transform
		}

		// Default transformations based on field type
		const transforms: Record<string, string> = {
			gallery:
				'value => Array.isArray(value) ? value : value.split(",").map(item => item.trim())',
			tags: 'value => Array.isArray(value) ? value : value.split(",").map(item => item.trim())',
			links: `value => Array.isArray(value) ? value : value.split(";").map(link => {
        const [label, url] = link.split("|").map(s => s.trim());
        return { label, url };
      })`,
		}

		return transforms[fieldName] || 'value => value'
	}

	/**
	 * Handle errors with proper context
	 */
	private handleError(error: unknown): Error {
		if (error instanceof z.ZodError) {
			const details = error.errors
				.map(err => `${err.path.join('.')}: ${err.message}`)
				.join('; ')
			return new Error(`Configuration validation failed: ${details}`)
		}

		return error instanceof Error
			? error
			: new Error('Unknown error during configuration generation')
	}
}
