import { generateObject, JSONValue } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { App, TFile } from 'obsidian'
import { Logger } from '../utils/logger'
import { RouteConfig } from '../types'
import StrapiExporterPlugin from '../main'
import { JSONObject } from '@ai-sdk/provider'

/**
 * Interface for generated frontmatter field validation
 */
interface FieldValidation {
	required?: boolean
	type: string
	format?: string
	min?: number
	max?: number
	pattern?: string
}

/**
 * Interface for frontmatter generation options
 */
interface GenerationOptions {
	/** Target language for generated content */
	language?: string
	/** Additional context or instructions */
	context?: string
	/** Field validations mapping */
	validations?: Record<string, FieldValidation>
}

/**
 * Error class for frontmatter generation failures
 */
class FrontmatterGenerationError extends Error {
	constructor(
		message: string,
		public readonly details?: any
	) {
		super(message)
		this.name = 'FrontmatterGenerationError'
	}
}

/**
 * Service for generating and managing frontmatter metadata using AI
 * This service integrates with OpenAI to generate structured metadata
 * based on Strapi schemas and content analysis.
 */
export class FrontmatterGenerator {
	/** OpenAI model instance */
	private model

	/** Plugin reference */
	private plugin: StrapiExporterPlugin

	/**
	 * Creates a new FrontmatterGenerator instance
	 * @param plugin - The Strapi Exporter plugin instance
	 * @throws {Error} If OpenAI API key is not configured
	 */
	constructor(plugin: StrapiExporterPlugin) {
		Logger.info('FrontMatterGen', 'Initializing FrontmatterGenerator')

		this.plugin = plugin
		if (!this.plugin.settings.openaiApiKey) {
			throw new Error('OpenAI API key is not configured')
		}

		// Initialize OpenAI client
		const openai = createOpenAI({
			apiKey: this.plugin.settings.openaiApiKey,
		})
		this.model = openai('gpt-4o-mini')
	}

	/**
	 * Generates frontmatter metadata for a given file
	 * @param file - The Obsidian file to generate frontmatter for
	 * @param app - The Obsidian app instance
	 * @param options - Optional generation settings
	 * @returns Promise resolving to the generated frontmatter string
	 * @throws {FrontmatterGenerationError} If generation fails
	 */
	async generateFrontmatter(
		file: TFile,
		app: App,
		options: GenerationOptions = {}
	): Promise<string> {
		Logger.info('FrontMatterGen', 'Starting frontmatter generation', {
			fileName: file.name,
			options,
		})

		try {
			// Get file content
			const content = await app.vault.read(file)

			// Get current route configuration
			const currentRoute = this.getCurrentRoute()
			if (!currentRoute) {
				throw new FrontmatterGenerationError('No active route found')
			}

			// Validate schema presence
			if (!currentRoute.schema || !currentRoute.schemaDescription) {
				throw new FrontmatterGenerationError(
					'Route schema or schema description is missing'
				)
			}

			// Generate structured content using Vercel AI SDK
			const { object } = await generateObject({
				model: this.model,
				output: 'no-schema',
				prompt: this.buildPrompt(content, currentRoute, options),
			})

			// Validate generated content against schema
			await this.validateGeneratedContent(object, currentRoute)

			// Format to YAML frontmatter
			const formattedFrontmatter = this.formatToYAML(
				object as Record<string, any>
			)
			Logger.debug('FrontMatterGen', 'Generated frontmatter', {
				formattedFrontmatter,
			})

			return formattedFrontmatter
		} catch (error) {
			Logger.error('FrontMatterGen', 'Error generating frontmatter', error)
			throw new FrontmatterGenerationError(
				'Frontmatter generation failed',
				error instanceof Error ? error.message : 'Unknown error'
			)
		}
	}

	/**
	 * Updates a file's content with newly generated frontmatter
	 * @param file - The file to update
	 * @param app - The Obsidian app instance
	 * @returns Promise resolving to the updated content
	 */
	async updateContentFrontmatter(file: TFile, app: App): Promise<string> {
		Logger.info('FrontMatterGen', 'Updating content frontmatter')

		try {
			const content = await app.vault.read(file)
			const newFrontmatter = await this.generateFrontmatter(file, app)

			// Handle existing frontmatter replacement
			const updatedContent = this.replaceFrontmatter(content, newFrontmatter)

			return updatedContent
		} catch (error) {
			Logger.error(
				'FrontMatterGen',
				'Error updating content frontmatter',
				error
			)
			throw new FrontmatterGenerationError(
				'Failed to update content frontmatter'
			)
		}
	}

	private async validateGeneratedContent(
		content: string | number | boolean | JSONObject | JSONValue[] | null,
		route: RouteConfig
	): Promise<void> {
		try {
			const validations = route.fieldMappings

			// Now TypeScript knows the correct types
			for (const [field, value] of Object.entries(
				content as Record<string, any>
			)) {
				const validation = validations[field]
				if (!validation) continue

				if (validation.required && !value) {
					throw new FrontmatterGenerationError(
						`Required field ${field} is missing`
					)
				}

				// Type validation
				if (
					validation.type &&
					!this.validateFieldType(value, validation.type)
				) {
					throw new FrontmatterGenerationError(
						`Field ${field} has invalid type. Expected ${validation.type}`
					)
				}
			}
		} catch (error) {
			Logger.error('FrontMatterGen', 'Validation error', error)
			throw new FrontmatterGenerationError(
				'Content validation failed',
				error instanceof Error ? error.message : 'Unknown error'
			)
		}
	}

	/**
	 * Builds the AI prompt for frontmatter generation
	 * @param content - The file content
	 * @param route - The current route configuration
	 * @param options - Generation options
	 * @private
	 */
	private buildPrompt(
		content: string,
		route: RouteConfig,
		options: GenerationOptions
	): string {
		const schemaObj = JSON.parse(route.schema)
		const descObj = JSON.parse(route.schemaDescription)

		return `Generate frontmatter metadata in ${options.language || route.language || 'en'} for this content.

Schema Structure:
${JSON.stringify(schemaObj.data, null, 2)}

Field Descriptions:
${JSON.stringify(descObj.data, null, 2)}

Requirements:
- Follow the exact field structure from the schema
- Include all required fields
- Generate SEO-friendly metadata:
  * Descriptive titles
  * Compelling descriptions
  * Relevant keywords
- Create URL-friendly slugs from titles
- Include relevant tags based on content analysis
- Ensure proper formatting for special fields:
  * Dates in ISO format
  * Numbers within specified ranges
  * URLs in valid format
- Match Strapi field types and validation rules

${options.context ? `Additional Context:\n${options.context}\n` : ''}

Content to analyze:
${content.substring(0, 2000)}...

Return a JSON object matching the schema structure exactly.`
	}

	/**
	 * Formats an object into YAML frontmatter
	 * @param data - The object to format
	 * @private
	 */
	private formatToYAML(data: Record<string, any>): string {
		const yaml = ['---']

		Object.entries(data).forEach(([key, value]) => {
			if (Array.isArray(value)) {
				yaml.push(`${key}:`)
				value.forEach(item => {
					if (typeof item === 'object' && item.name) {
						yaml.push(`  - name: "${this.escapeYamlString(item.name)}"`)
						if (item.id) yaml.push(`    id: ${item.id}`)
					} else {
						yaml.push(`  - ${this.escapeYamlString(String(item))}`)
					}
				})
			} else if (typeof value === 'object' && value !== null) {
				yaml.push(`${key}:`)
				Object.entries(value).forEach(([subKey, subValue]) => {
					yaml.push(`  ${subKey}: "${this.escapeYamlString(String(subValue))}"`)
				})
			} else {
				yaml.push(`${key}: "${this.escapeYamlString(String(value))}"`)
			}
		})

		yaml.push('---\n')
		return yaml.join('\n')
	}

	/**
	 * Escapes special characters in YAML strings
	 * @param str - The string to escape
	 * @private
	 */
	private escapeYamlString(str: string): string {
		return str.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t')
	}

	/**
	 * Replaces or adds frontmatter in content
	 * @param content - Original content
	 * @param newFrontmatter - New frontmatter to add
	 * @private
	 */
	private replaceFrontmatter(content: string, newFrontmatter: string): string {
		const hasFrontmatter = /^---\n[\s\S]*?\n---\n/.test(content)
		if (hasFrontmatter) {
			return content.replace(/^---\n[\s\S]*?\n---\n/, newFrontmatter)
		}
		return `${newFrontmatter}${content}`
	}

	/**
	 * Gets the current active route from settings
	 * @private
	 */
	private getCurrentRoute(): RouteConfig | undefined {
		return this.plugin.settings.routes.find(route => route.enabled)
	}

	/**
	 * Validates a field value against an expected type
	 * @param value - The value to validate
	 * @param expectedType - The expected type
	 * @private
	 */
	private validateFieldType(value: any, expectedType: string): boolean {
		switch (expectedType) {
			case 'string':
				return typeof value === 'string'
			case 'number':
				return typeof value === 'number' && !isNaN(value)
			case 'boolean':
				return typeof value === 'boolean'
			case 'array':
				return Array.isArray(value)
			case 'object':
				return (
					typeof value === 'object' && value !== null && !Array.isArray(value)
				)
			default:
				return true // Unknown types are considered valid
		}
	}
}
