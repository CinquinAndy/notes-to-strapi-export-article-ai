// src/services/configuration-generator.ts

import { z } from 'zod'
import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { Logger } from '../utils/logger'

/**
 * Schema for field validation rules
 */
const validationSchema = z
	.object({
		type: z.string(),
		pattern: z.string().optional(),
		min: z.number().optional(),
		max: z.number().optional(),
	})
	.required()

/**
 * Schema for individual field mapping
 */
const fieldMappingSchema = z
	.object({
		obsidianSource: z.enum(['frontmatter', 'content']),
		frontmatterKey: z.string().optional(),
		type: z.string(),
		format: z.string().optional(),
		required: z.boolean().default(false),
		transform: z.string().optional(),
		validation: validationSchema.optional(),
	})
	.required()

/**
 * Main configuration schema
 */
const configurationSchema = z
	.object({
		fieldMappings: z.record(fieldMappingSchema),
		additionalInstructions: z.string().optional().default(''),
		contentField: z.string(),
	})
	.required()

type ConfigurationOutput = z.infer<typeof configurationSchema>

export interface ConfigGeneratorOptions {
	openaiApiKey: string
}

export class ConfigurationGenerator {
	private model

	constructor(options: ConfigGeneratorOptions) {
		const openai = createOpenAI({
			apiKey: options.openaiApiKey,
		})
		this.model = openai('gpt-4o-mini', {
			structuredOutputs: true,
		})
	}

	/**
	 * Generate structured configuration based on route settings
	 */
	async generateConfiguration(route: {
		schema: string
		language: string
		additionalInstructions?: string
	}): Promise<ConfigurationOutput> {
		Logger.info('ConfigGenerator', 'Starting configuration generation')

		try {
			const { object } = await generateObject({
				model: this.model,
				schema: configurationSchema,
				schemaName: 'StrapiConfiguration',
				schemaDescription:
					'Configuration for mapping Obsidian content to Strapi fields',
				prompt: this.buildConfigurationPrompt(route),
			})

			Logger.debug('ConfigGenerator', 'Configuration generated', {
				config: object,
			})
			const validatedConfig = configurationSchema.parse(object)
			return validatedConfig
		} catch (error) {
			Logger.error('ConfigGenerator', 'Error generating configuration', error)
			throw new Error(`Configuration generation failed: ${error.message}`)
		}
	}

	private buildConfigurationPrompt(route: {
		schema: string
		language: string
		additionalInstructions?: string
	}): string {
		return `Generate a Strapi configuration mapping based on the following schema:

Schema:
${route.schema}

Requirements:
1. Create field mappings for each schema property
2. For content fields, use 'content' as obsidianSource
3. For metadata fields, use 'frontmatter' as obsidianSource with appropriate frontmatterKey
4. Include validation rules where appropriate
5. Content should be in ${route.language}
6. Set appropriate field types and formats
7. Include transformations for special formatting needs

Additional Instructions:
${route.additionalInstructions || 'None provided'}

Ensure all mappings are complete and properly structured according to the schema requirements.`
	}
}
