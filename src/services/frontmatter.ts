import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { App, Notice, TFile } from 'obsidian'
import { RouteConfig } from '../types'
import StrapiExporterPlugin from '../main'
import { processContentLinks } from '../utils/process-file'
import { extractFrontMatterAndContent } from '../utils/analyse-file'
import yaml from 'js-yaml'

/**
 * Interface defining the structure of a field in the schema
 */
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

/**
 * Interface for the complete configuration of field mappings
 */
interface GeneratedConfig {
	fieldMappings: Record<string, FieldMapping>
	contentField: string
}

/**
 * FrontmatterGenerator class handles the generation of YAML frontmatter
 * based on a dynamic schema configuration from Strapi
 */
export class FrontmatterGenerator {
	private model
	private plugin: StrapiExporterPlugin

	/**
	 * Initialize the generator with the plugin instance
	 * @param plugin - The Strapi Exporter plugin instance
	 */
	constructor(plugin: StrapiExporterPlugin) {
		this.plugin = plugin
		const openai = createOpenAI({
			apiKey: this.plugin.settings.openaiApiKey,
		})
		this.model = openai.chat('gpt-4o-mini')
	}

	/**
	 * Updates or creates frontmatter in an existing file
	 * @param file - The file to update
	 * @param app - The Obsidian app instance
	 * @returns Promise<string> Updated content with new frontmatter
	 */
	async updateContentFrontmatter(file: TFile, app: App): Promise<string> {
		try {
			// Read original content
			const originalContent = await app.vault.read(file)

			// Process images in the content first
			const processedContent = await this.processContentWithImages(
				originalContent,
				app
			)

			// Generate new frontmatter
			const newFrontmatter = await this.generateFrontmatter(
				file,
				app,
				processedContent
			)

			// Replace or add frontmatter to the processed content
			const updatedContent = this.replaceFrontmatter(
				processedContent,
				newFrontmatter
			)

			return updatedContent
		} catch (error) {
			new Notice(`Error processing content: ${error.message}`)
			throw error
		}
	}

	/**
	 * Process content including images
	 * @param content - Original content
	 * @param app - The Obsidian app instance
	 * @returns Promise<string> Processed content with updated image links
	 */
	private async processContentWithImages(
		content: string,
		app: App
	): Promise<string> {
		try {
			const { frontmatter, body } = extractFrontMatterAndContent(content)

			// Process only the images in the content, leaving regular links unchanged
			const processedContent = await processContentLinks(
				body,
				app,
				this.plugin.settings
			)

			// If frontmatter exists, reconstruct the content with it
			if (Object.keys(frontmatter).length > 0) {
				return [
					'---',
					yaml.dump(frontmatter),
					'---',
					'',
					processedContent,
				].join('\n')
			}

			return processedContent
		} catch (error) {
			new Notice(`Error processing images: ${error.message}`)
			throw error
		}
	}

	/**
	 * Generates structured example data based on field type and format
	 * @param field - The field mapping configuration
	 * @returns An appropriate example value for the field type
	 */
	private generateExampleValue(field: FieldMapping): any {
		const { type, format } = field

		// Handle arrays with specific structures
		if (type === 'array') {
			return this.generateArrayExample(field)
		}

		// Handle media fields
		if (type === 'media') {
			return 'https://example.com/image.jpg'
		}

		// Handle standard types with formats
		switch (type) {
			case 'string':
				if (format === 'url') return 'https://example.com'
				if (format === 'slug') return 'example-slug'
				return 'Example text'
			case 'number':
				return 1
			case 'boolean':
				return true
			default:
				return 'Example value'
		}
	}

	/**
	 * Generates example array content based on the field's transform configuration
	 * @param field - The field mapping configuration
	 * @returns An example array structure
	 */
	private generateArrayExample(field: FieldMapping): any {
		if (!field.transform) {
			return ['example1', 'example2']
		}

		const transform = field.transform

		if (transform.includes('name:')) {
			return [
				{ name: 'example1', id: 1 },
				{ name: 'example2', id: 2 },
			]
		}

		if (transform.includes('label:') && transform.includes('url:')) {
			return [
				{ label: 'Example Link', url: 'https://example.com' },
				{ label: 'Another Link', url: 'https://example.com/page' },
			]
		}

		return ['example1', 'example2']
	}

	/**
	 * Builds a detailed prompt for GPT based on the schema configuration
	 * @param content - The content to analyze
	 * @param config - The generated configuration
	 * @returns A structured prompt string
	 */
	private buildPrompt(content: string, config: GeneratedConfig): string {
		const exampleData = {}
		for (const [field, mapping] of Object.entries(config.fieldMappings)) {
			exampleData[field] = this.generateExampleValue(mapping)
		}

		const exampleYaml = this.convertToYaml(exampleData)
		const requiredFields = Object.entries(config.fieldMappings)
			.filter(([_, mapping]) => mapping.required)
			.map(([field]) => field)
			.join(', ')

		return `Generate YAML frontmatter that follows this exact schema and format:

Schema Definition:
${JSON.stringify(config.fieldMappings, null, 2)}

Expected Format Example:
---
${exampleYaml}---

Requirements:
1. Maintain exact field names as shown in the schema
2. Follow YAML formatting and indentation precisely
3. Generate appropriate content for each field type
4. Preserve array structures as shown in the example
5. Required fields: ${requiredFields}
6. Use quotes for string values
7. Maintain proper data types (strings, numbers, arrays)

Content for Analysis:
${content.substring(0, 2000)}

DO NOT include the content IN the generated frontmatter. Just use the content to generate the frontmatter as context.
the content field is ${config.contentField}. Please delete the content field from the frontmatter.

Return complete YAML frontmatter with opening and closing "---" markers.`
	}

	/**
	 * Converts a JavaScript object to properly formatted YAML
	 * @param obj - The object to convert
	 * @param indent - Current indentation level
	 * @returns Formatted YAML string
	 */
	private convertToYaml(obj: any, indent: number = 0): string {
		const spaces = ' '.repeat(indent)
		let yaml = ''

		for (const [key, value] of Object.entries(obj)) {
			if (Array.isArray(value)) {
				yaml += `${spaces}${key}:\n`
				value.forEach(item => {
					if (typeof item === 'object') {
						yaml += `${spaces}  -\n`
						Object.entries(item).forEach(([k, v]) => {
							yaml += `${spaces}    ${k}: "${v}"\n`
						})
					} else {
						yaml += `${spaces}  - "${item}"\n`
					}
				})
			} else if (typeof value === 'object' && value !== null) {
				yaml += `${spaces}${key}:\n`
				yaml += this.convertToYaml(value, indent + 2)
			} else {
				const formattedValue = typeof value === 'string' ? `"${value}"` : value
				yaml += `${spaces}${key}: ${formattedValue}\n`
			}
		}

		return yaml
	}

	/**
	 * Replaces or adds frontmatter in content
	 * @param content - Original content
	 * @param newFrontmatter - New frontmatter to add
	 * @returns Updated content with new frontmatter
	 */
	private replaceFrontmatter(content: string, newFrontmatter: string): string {
		const hasFrontmatter = /^---\n[\s\S]*?\n---/.test(content)

		if (hasFrontmatter) {
			return content.replace(/^---\n[\s\S]*?\n---/, newFrontmatter.trim())
		} else {
			return `${newFrontmatter}${content}`
		}
	}

	/**
	 * Gets the currently active route from plugin settings
	 * @returns The active route configuration or undefined
	 */
	private getCurrentRoute(): RouteConfig | undefined {
		return this.plugin.settings.routes.find(route => route.enabled)
	}

	/**
	 * Generates frontmatter based on file content and schema
	 * @param file - The file to process
	 * @param app - The Obsidian app instance
	 * @param processedContent - Optional pre-processed content
	 * @returns Promise<string> Generated frontmatter
	 */
	async generateFrontmatter(
		file: TFile,
		app: App,
		processedContent?: string
	): Promise<string> {
		const content = processedContent || (await app.vault.read(file))
		const currentRoute = this.getCurrentRoute()

		if (!currentRoute?.generatedConfig) {
			throw new Error('Generated configuration not found')
		}

		// Parse configuration and generate frontmatter
		const config: GeneratedConfig = JSON.parse(currentRoute.generatedConfig)

		const { text } = await generateText({
			model: this.model,
			system:
				'You are an author writing frontmatter for a new document, we are using Obsidian, and we need the correct format for the data given by the user.' +
				'Think about the data structure and the fields that are required for the frontmatter. The data should be in YAML format and follow the schema provided by the user.' +
				'And think about SEO to include the right metadata for the document.',
			prompt: this.buildPrompt(content, config),
		})

		const cleanedText = await this.formatAndValidateYAML(
			this.cleanGPTOutput(text),
			config,
			currentRoute.language
		)

		return cleanedText
	}

	/**
	 * Cleans the GPT output by removing code block markers
	 * @param text - The raw GPT output
	 * @returns Cleaned YAML content
	 */
	private cleanGPTOutput(text: string): string {
		return text
			.replace(/^```ya?ml\n?/i, '') // Remove starting ```yaml or ```yml
			.replace(/```$/, '') // Remove ending ```
			.trim() // Remove extra whitespace
	}

	private async formatAndValidateYAML(
		initialText: string,
		config: GeneratedConfig,
		language: string
	): Promise<string> {
		const formattingPrompt = `As a YAML formatting expert, review and clean this frontmatter content. 
Here are the specific requirements:

1. Format Validation:
- Remove any unnecessary blank lines
- Ensure consistent indentation (2 spaces)
- Maintain compact array formatting
- Verify all strings are properly quoted

2. Content Validation:
- All URLs should be valid format
- Tags should be compact without empty lines
- Array structures should be consistent
- Remove any suspicious or placeholder content

3. Structure Requirements:
- Keep fields in logical order
- Ensure all required fields are present
- Verify data types match schema
- Check language consistency

4. Stringified Context from the user : 
content field: ${JSON.stringify(config.contentField)}
field mapping: ${JSON.stringify(config.fieldMappings)}

Original frontmatter to clean:
${initialText}

Return only the cleaned YAML frontmatter, maintaining exact and correct formatting. No explanation needed.
- Ensure locale matches the content language (if specified) "${language}"
- if the frontmatter is not in the correct language, please change it to "${language}"
- TRANSLATE EVERYTHING TO "${language}"`

		const { text } = await generateText({
			model: this.model,
			system:
				'You are a YAML formatting expert. Your only task is to clean and validate YAML frontmatter. Return only the cleaned YAML with no additional comments or explanations.',
			prompt: formattingPrompt,
		})

		return this.cleanGPTOutput(text)
	}
}
