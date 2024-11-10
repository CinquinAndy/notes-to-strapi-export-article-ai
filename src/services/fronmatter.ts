import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { App, TFile } from 'obsidian'
import { Logger } from '../utils/logger'
import StrapiExporterPlugin from '../main'
import { RouteConfig } from '../types'

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
	 * Get active route from settings
	 */
	private getActiveRoute() {
		const enabledRoutes = this.plugin.settings.routes.filter(
			route => route.enabled
		)
		return enabledRoutes[0] // Return first enabled route
	}

	/**
	 * Generate frontmatter based on content and Strapi schema
	 */
	async generateFrontmatter(
		file: TFile,
		app: App,
		route: RouteConfig
	): Promise<string> {
		Logger.info('FrontMatterGen', 'Starting frontmatter generation')

		try {
			// Read file content
			const content = await app.vault.read(file)

			// Validate schema
			if (!route.schema || !route.schemaDescription) {
				throw new Error('Route schema or schema description is missing')
			}

			const { object } = await generateObject({
				model: this.model,
				output: 'no-schema',
				prompt: this.buildPrompt(content, route),
			})

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
	private buildPrompt(content: string, route: RouteConfig): string {
		const schemaObj = JSON.parse(route.schema)
		const descObj = JSON.parse(route.schemaDescription)

		return `Generate frontmatter metadata in ${route.language || 'en'} for this content.

Available fields from Strapi schema:
${JSON.stringify(schemaObj.data, null, 2)}

Field descriptions:
${JSON.stringify(descObj.data, null, 2)}

The frontmatter should:
- Follow the exact field structure from the schema
- Include all required fields
- Generate SEO-friendly metadata
- Create URL-friendly slugs
- Include relevant tags based on content
- Handle any special fields (dates, numbers, etc.) appropriately

Content to analyze:
${content.substring(0, 2000)}...

Return a JSON object with field values that match the schema structure.`
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
						if (item.id) yaml.push(`    id: ${item.id}`)
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
	 * Update existing content with new frontmatter
	 */
	async updateContentFrontmatter(file: TFile, app: App): Promise<string> {
		Logger.info('FrontMatterGen', 'Updating content frontmatter')

		try {
			// Get current route
			const currentRoute = this.getCurrentRoute()
			if (!currentRoute) {
				throw new Error('No active route found')
			}

			// Generate new frontmatter
			const content = await app.vault.read(file)
			const newFrontmatter = await this.generateFrontmatter(
				file,
				app,
				currentRoute
			)

			// Replace existing frontmatter or add new one
			const updatedContent =
				content.replace(/^---\n[\s\S]*?\n---\n/, '') || content
			return `${newFrontmatter}${updatedContent}`
		} catch (error) {
			Logger.error(
				'FrontMatterGen',
				'Error updating content frontmatter',
				error
			)
			throw error
		}
	}

	/**
	 * Get current active route from settings
	 */
	private getCurrentRoute(): RouteConfig | undefined {
		return this.plugin.settings.routes.find(route => route.enabled)
	}
}
