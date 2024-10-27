// src/services/configuration-generator.ts

import { z } from 'zod'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { Logger } from '../utils/logger'

/**
 * Schema for Strapi configuration
 */
const configurationSchema = z.object({
	fieldMappings: z.record(
		z.object({
			obsidianSource: z.enum(['frontmatter', 'content']),
			type: z.string(),
			format: z.string().optional(),
			required: z.boolean().default(false),
			transform: z.string().optional(),
			validation: z
				.object({
					type: z.string(),
					pattern: z.string().optional(),
					min: z.number().optional(),
					max: z.number().optional(),
				})
				.optional(),
		})
	),
	additionalInstructions: z.string().optional(),
	contentField: z.string(),
})

type ConfigurationOutput = z.infer<typeof configurationSchema>

export class ConfigurationGenerator {
	private model = openai('gpt-4-turbo-preview', {
		structuredOutputs: true,
	})

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
			return object as ConfigurationOutput
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
		return `Generate a configuration for mapping Obsidian content to Strapi using the following schema:
    
    ${route.schema}
    
    Consider:
    - Content should be in ${route.language}
    - Map frontmatter fields appropriately
    - Include necessary transformations for content formatting
    - Define validation rules for fields
    
    Additional instructions:
    ${route.additionalInstructions || 'None provided'}
    
    Generate a complete mapping configuration that ensures data integrity and proper content structure.`
	}
}
