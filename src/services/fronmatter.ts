import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { App, TFile } from 'obsidian'
import { Logger } from '../utils/logger'

export class FrontmatterGenerator {
	private model

	constructor(private plugin: any) {
		// Pass the plugin instance instead of just the API key
		Logger.info('FrontMatterGen', 'Initializing FrontmatterGenerator')
		const openai = createOpenAI({
			apiKey: this.plugin.settings.openaiApiKey,
		})
		this.model = openai('gpt-4o-mini')
	}

	/**
	 * Get active route from settings
	 */
	private getActiveRoute() {
		const enabledRoutes = this.plugin.settings.routes.filter(
			route => route.enabled
		)
		return enabledRoutes[0] // Return first enabled route
	}

	/**
	 * Generate frontmatter based on content and plugin settings
	 */
	async generateFrontmatter(file: TFile, app: App): Promise<string> {
		Logger.info('FrontMatterGen', 'Starting frontmatter generation')

		try {
			// Read file content
			const content = await app.vault.read(file)

			// Get active route from settings
			const activeRoute = this.getActiveRoute()
			if (!activeRoute) {
				throw new Error('No active route configured')
			}

			// Get field mappings from active route
			const fieldMappings = activeRoute.fieldMappings || {}

			const { object } = await generateObject({
				model: this.model,
				output: 'no-schema',
				prompt: this.buildPrompt(
					content,
					fieldMappings,
					activeRoute.language || 'en',
					activeRoute.schema,
					activeRoute.schemaDescription
				),
			})

			Logger.debug('FrontMatterGen', 'Generated frontmatter', object)

			// Format to YAML frontmatter
			const formattedFrontmatter = this.formatToYAML(
				object as Record<string, any>
			)
			return formattedFrontmatter
		} catch (error) {
			Logger.error('FrontMatterGen', 'Error generating frontmatter', error)
			throw new Error(`Frontmatter generation failed: ${error.message}`)
		}
	}

	/**
	 * Build prompt for the AI model
	 */
	private buildPrompt(
		content: string,
		fieldMappings: Record<string, any>,
		language: string,
		schema: string,
		schemaDescription: string
	): string {
		let prompt = `Generate frontmatter metadata in ${language} for this content.`

		// Add schema information if available
		if (schema && schemaDescription) {
			try {
				const schemaObj = JSON.parse(schema)
				const descObj = JSON.parse(schemaDescription)
				prompt += `\n\nSchema structure:\n${JSON.stringify(schemaObj.data, null, 2)}`
				prompt += `\n\nField descriptions:\n${JSON.stringify(descObj.data, null, 2)}`
			} catch (e) {
				Logger.warn('FrontMatterGen', 'Could not parse schema or description')
			}
		}

		prompt += `\n\nAvailable fields: ${Object.keys(fieldMappings).join(', ')}

    The frontmatter should:
    - Have SEO-friendly title and description
    - Include relevant tags based on content
    - Generate URL-friendly slug from title
    - Create a brief excerpt
    - Use appropriate content type and rank

    Only include fields that match the available fields list.

    Content to analyze:
    ${content.substring(0, 1500)}...

    Return a JSON object with the field values.`

		return prompt
	}

	/**
	 * Format object to YAML frontmatter
	 */
	private formatToYAML(data: Record<string, any>): string {
		const yaml = ['---']

		Object.entries(data).forEach(([key, value]) => {
			if (Array.isArray(value)) {
				yaml.push(`${key}:`)
				value.forEach(item => {
					if (typeof item === 'object' && item.name) {
						yaml.push(`  - name: "${item.name}"`)
					} else {
						yaml.push(`  - ${item}`)
					}
				})
			} else if (typeof value === 'object' && value !== null) {
				yaml.push(`${key}:`)
				Object.entries(value).forEach(([subKey, subValue]) => {
					yaml.push(`  ${subKey}: "${subValue}"`)
				})
			} else {
				yaml.push(`${key}: "${value}"`)
			}
		})

		yaml.push('---\n')
		return yaml.join('\n')
	}

	/**
	 * Extract existing frontmatter from content
	 */
	extractFrontmatter(content: string): string | null {
		const match = content.match(/^---\s*\n([\s\S]*?)\n---/)
		return match ? match[1] : null
	}

	/**
	 * Update or create frontmatter in content
	 */
	async updateContentFrontmatter(file: TFile, app: App): Promise<string> {
		const content = await app.vault.read(file)
		const existingFrontmatter = this.extractFrontmatter(content)

		if (!existingFrontmatter) {
			// Generate new frontmatter
			const newFrontmatter = await this.generateFrontmatter(file, app)
			return `${newFrontmatter}\n${content}`
		}

		// Keep existing frontmatter
		return content
	}
}
