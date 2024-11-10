import StrapiExporterPlugin from '../main'
import { Logger } from '../utils/logger'
import { createOpenAI } from '@ai-sdk/openai'
import { App, TFile } from 'obsidian'
import { RouteConfig } from '../types'
import { generateObject } from 'ai'

interface FieldMapping {
	obsidianSource: 'frontmatter' | 'content'
	type: string
	description: string
	required: boolean
	format?: string
	transform?: string
	validation?: {
		type: string
		pattern?: string
	}
}

interface GeneratedConfig {
	fieldMappings: Record<string, FieldMapping>
	contentField: string
}

export class FrontmatterGenerator {
	private model
	private plugin: StrapiExporterPlugin

	constructor(plugin: StrapiExporterPlugin) {
		Logger.info('FrontMatterGen', 'Initializing FrontmatterGenerator')
		this.plugin = plugin
		const openai = createOpenAI({
			apiKey: this.plugin.settings.openaiApiKey,
		})
		this.model = openai('gpt-4o-mini')
	}

	/**
	 * Updates or creates frontmatter in content
	 * @param file - The file to update
	 * @param app - The Obsidian app instance
	 * @returns Promise<string> - The updated content with new frontmatter
	 */
	async updateContentFrontmatter(file: TFile, app: App): Promise<string> {
		Logger.info('FrontMatterGen', 'Updating content frontmatter')

		try {
			// Get existing content
			const content = await app.vault.read(file)

			// Generate new frontmatter
			const newFrontmatter = await this.generateFrontmatter(file, app)

			// Replace existing frontmatter or add new one
			const updatedContent = this.replaceFrontmatter(content, newFrontmatter)

			Logger.debug('FrontMatterGen', 'Content updated with new frontmatter')
			return updatedContent
		} catch (error) {
			Logger.error(
				'FrontMatterGen',
				'Error updating content frontmatter',
				error
			)
			throw new Error(`Failed to update content frontmatter: ${error.message}`)
		}
	}

	/**
	 * Replaces existing frontmatter or adds new frontmatter to content
	 * @param content - Original content
	 * @param newFrontmatter - New frontmatter to add
	 * @returns string - Updated content with new frontmatter
	 * @private
	 */
	private replaceFrontmatter(content: string, newFrontmatter: string): string {
		// Check if content already has frontmatter
		const hasFrontmatter = /^---\n[\s\S]*?\n---/.test(content)

		if (hasFrontmatter) {
			// Replace existing frontmatter
			return content.replace(/^---\n[\s\S]*?\n---/, newFrontmatter.trim())
		} else {
			// Add new frontmatter at the beginning
			return `${newFrontmatter}${content}`
		}
	}

	/**
	 * Generate frontmatter using the generated configuration
	 */
	async generateFrontmatter(file: TFile, app: App): Promise<string> {
		Logger.info('FrontMatterGen', 'Starting frontmatter generation')

		try {
			const content = await app.vault.read(file)
			const currentRoute = this.getCurrentRoute()

			if (!currentRoute?.generatedConfig) {
				throw new Error('Generated configuration not found')
			}

			console.log('Current route', currentRoute)
			// Parse the generated configuration
			const config: GeneratedConfig = JSON.parse(currentRoute.generatedConfig)
			console.log('Parsed config', config)

			// Generate content using AI
			const generated = await this.generateContent(content, config)

			console.log('Generated content', generated)
			// Format to YAML
			return this.formatToYAML(generated, config)
		} catch (error) {
			Logger.error('FrontMatterGen', 'Error generating frontmatter', error)
			throw error
		}
	}

	/**
	 * Generate content based on field mappings
	 */
	private async generateContent(
		content: string,
		config: GeneratedConfig
	): Promise<Record<string, any>> {
		const { object } = await generateObject({
			model: this.model,
			output: 'no-schema',
			prompt: this.buildPrompt(content, config),
		})

		console.log('Generated object', object)
		// Apply field transformations
		return this.applyTransformations(
			object as Record<string, any>,
			config.fieldMappings
		)
	}

	/**
	 * Build AI prompt based on field mappings
	 */
	private buildPrompt(content: string, config: GeneratedConfig): string {
		// Create field descriptions from mappings
		const fieldDescriptions = Object.entries(config.fieldMappings)
			.map(([field, mapping]) => {
				let desc = `${field}:
  Type: ${mapping.type}
  Required: ${mapping.required}
  Description: ${mapping.description}`

				if (mapping.format) {
					desc += `\n  Format: ${mapping.format}`
				}
				if (mapping.validation) {
					desc += `\n  Validation: ${JSON.stringify(mapping.validation)}`
				}
				return desc
			})
			.join('\n\n')

		return `Generate metadata for this content following these field specifications:

${fieldDescriptions}

Special Requirements:
- For URLs (format: "url"): Ensure they are valid and complete
- For slugs (format: "slug"): Create URL-friendly versions of titles
- For arrays: Follow the specified structure (e.g., tags with name property)
- For media: Provide complete URLs
- Follow all validation patterns specified

Additional Notes:
- Ensure SEO optimization for titles and descriptions
- Keep excerpts concise but informative
- Generate appropriate tags based on content
- Use proper locale codes (e.g., 'fr', 'en')

Content to analyze:
${content.substring(0, 2000)}

Return a JSON object with all specified fields.`
	}

	/**
	 * Formats content to YAML based on the provided schema configuration
	 * Dynamically adapts to any schema structure
	 * @param content The content to format
	 * @param config The schema configuration
	 * @returns Formatted YAML string
	 */
	private formatToYAML(
		content: Record<string, any>,
		config: GeneratedConfig
	): string {
		const yaml = ['---']

		for (const [field, mapping] of Object.entries(config.fieldMappings)) {
			const value = content[field]
			if (value === undefined) continue

			try {
				if (SchemaAnalyzer.isStructuredArray(mapping)) {
					// Handle complex arrays containing objects
					this.formatStructuredArray(field, value, mapping, yaml)
				} else if (SchemaAnalyzer.isSimpleArray(mapping)) {
					// Handle simple value arrays
					this.formatSimpleArray(field, value, yaml)
				} else {
					// Handle simple values (strings, numbers, etc.)
					this.formatSimpleValue(field, value, mapping, yaml)
				}
			} catch (error) {
				Logger.error('FrontMatterGen', `Error formatting field ${field}`, error)
				// Fallback to raw value if formatting fails
				yaml.push(`${field}: "${this.escapeYamlString(String(value))}"`)
			}
		}

		yaml.push('---\n')
		return yaml.join('\n')
	}

	/**
	 * Formats an array of objects according to its schema definition
	 * @param field Field name
	 * @param value Field value
	 * @param mapping Field mapping configuration
	 * @param yaml Array of YAML lines being built
	 */
	private formatStructuredArray(
		field: string,
		value: any,
		mapping: FieldMapping,
		yaml: string[]
	): void {
		const arrayValue = Array.isArray(value) ? value : [value]
		if (arrayValue.length === 0) return

		yaml.push(`${field}:`)

		// Extract expected structure from transform or first item
		const expectedProps = mapping.transform
			? SchemaAnalyzer.getArrayStructure(mapping.transform)
			: Object.keys(arrayValue[0])

		arrayValue.forEach(item => {
			yaml.push('  -')
			expectedProps.forEach(prop => {
				if (item[prop] !== undefined) {
					yaml.push(
						`    ${prop}: "${this.escapeYamlString(String(item[prop]))}"`
					)
				}
			})
		})
	}

	/**
	 * Formats a simple array of values
	 * @param field Field name
	 * @param value Array values
	 * @param yaml Array of YAML lines being built
	 */
	private formatSimpleArray(field: string, value: any, yaml: string[]): void {
		const arrayValue = Array.isArray(value) ? value : [value]
		if (arrayValue.length === 0) return

		yaml.push(`${field}:`)
		arrayValue.forEach(item => {
			yaml.push(`  - "${this.escapeYamlString(String(item))}"`)
		})
	}

	/**
	 * Formats a simple value based on its type
	 * @param field Field name
	 * @param value Field value
	 * @param mapping Field mapping configuration
	 * @param yaml Array of YAML lines being built
	 */
	private formatSimpleValue(
		field: string,
		value: any,
		mapping: FieldMapping,
		yaml: string[]
	): void {
		if (mapping.type === 'number') {
			yaml.push(`${field}: ${value}`)
		} else {
			yaml.push(`${field}: "${this.escapeYamlString(String(value))}"`)
		}
	}

	/**
	 * Applies schema-defined transformations to generated content
	 * @param generated Generated content
	 * @param fieldMappings Schema field mappings
	 * @returns Transformed content
	 */
	private applyTransformations(
		generated: Record<string, any>,
		fieldMappings: Record<string, FieldMapping>
	): Record<string, any> {
		const transformed: Record<string, any> = {}

		for (const [field, value] of Object.entries(generated)) {
			const mapping = fieldMappings[field]
			if (!mapping) continue

			try {
				if (mapping.transform) {
					const transformFn = this.createTransformFunction(mapping.transform)
					transformed[field] = transformFn(value)
				} else {
					transformed[field] = this.validateFieldValue(value, mapping)
				}
			} catch (error) {
				Logger.error(
					'FrontMatterGen',
					`Transform error for field ${field}`,
					error
				)
				transformed[field] = value
			}
		}

		return transformed
	}

	/**
	 * Creates a transformation function from a transform string
	 * @param transform Transform function string
	 * @returns Function that applies the transformation
	 */
	private createTransformFunction(transform: string): any {
		try {
			return new Function('value', `return ${transform}`)
		} catch (error) {
			Logger.error('FrontMatterGen', 'Error creating transform function', error)
			return (value: any) => value
		}
	}

	/**
	 * Validates and converts field values based on their schema type
	 * @param value Value to validate
	 * @param mapping Field mapping configuration
	 * @returns Validated and converted value
	 */
	private validateFieldValue(value: any, mapping: FieldMapping): any {
		if (!value && mapping.required) {
			throw new Error(`Required field is missing`)
		}

		switch (mapping.type) {
			case 'string':
				return String(value)
			case 'number':
				return Number(value)
			case 'array':
				return Array.isArray(value) ? value : [value]
			default:
				return value
		}
	}

	private escapeYamlString(str: string): string {
		return str.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')
	}

	private getCurrentRoute(): RouteConfig | undefined {
		return this.plugin.settings.routes.find(route => route.enabled)
	}
}

/**
 * Utility class to analyze schema structure and field types
 */
class SchemaAnalyzer {
	/**
	 * Determines if a field is an array containing objects with specific structure
	 * @param field The field mapping to analyze
	 * @returns boolean indicating if field is a structured array
	 */
	static isStructuredArray(field: FieldMapping): boolean {
		return (
			field.type === 'array' &&
			!!field.transform &&
			field.transform.includes('map')
		)
	}

	/**
	 * Determines if a field is a simple array of values
	 * @param field The field mapping to analyze
	 * @returns boolean indicating if field is a simple array
	 */
	static isSimpleArray(field: FieldMapping): boolean {
		return (
			field.type === 'array' &&
			(!field.transform ||
				field.transform === 'value => Array.isArray(value) ? value : [value]')
		)
	}

	/**
	 * Extracts the expected object structure from a transform string
	 * @param transform The transform string to analyze
	 * @returns Array of property names expected in the object structure
	 */
	static getArrayStructure(transform: string): string[] {
		const match = transform.match(/\{([^}]+)\}/)
		if (!match) return []
		return match[1].split(',').map(prop => prop.trim().split(':')[0].trim())
	}
}
