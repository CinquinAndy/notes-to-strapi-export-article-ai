import { TFile, App } from 'obsidian'
import { RouteConfig, AnalyzedContent } from '../types'
import * as yaml from 'js-yaml'

export async function analyzeFile(
	file: TFile,
	app: App,
	route: RouteConfig
): Promise<AnalyzedContent> {
	try {
		// Reading file content
		const content = await app.vault.read(file)

		// Extracting frontmatter and content
		const { frontmatter, body } = extractFrontMatterAndContent(content)

		// Initialize result with existing frontmatter
		const result: AnalyzedContent = {
			...frontmatter, // Copy all existing frontmatter fields
		}

		// Processing field mappings
		for (const [strapiField, mapping] of Object.entries(route.fieldMappings)) {
			// Only override if mapping exists and field is not already set
			if (mapping.obsidianSource === 'frontmatter' && mapping.frontmatterKey) {
				// Only set if not already present
				if (result[strapiField] === undefined) {
					result[strapiField] = frontmatter[mapping.frontmatterKey] ?? null
				}
			}
			// Handle content fields
			else if (mapping.obsidianSource === 'content') {
				result[strapiField] = body
			}

			// Apply transformations
			if (mapping.transform && result[strapiField] !== null) {
				try {
					result[strapiField] = await applyTransformation(
						result[strapiField],
						mapping.transform,
						strapiField
					)
				} catch (error) {
					throw new Error(
						`Failed to transform field ${strapiField}: ${error.message}`
					)
				}
			}
		}
		return result
	} catch (error) {
		throw new Error(`File analysis failed: ${error.message}`)
	}
}

async function applyTransformation(
	value: any,
	transform: string | ((value: any) => any),
	fieldName: string
): Promise<any> {
	try {
		if (typeof transform === 'function') {
			return transform(value)
		} else if (typeof transform === 'string') {
			const transformFunction = new Function('value', `return ${transform}`)
			return transformFunction(value)
		}
		return value
	} catch (error) {
		throw new Error(`Transformation failed: ${error.message}`)
	}
}

export function extractFrontMatterAndContent(fileContent: string): {
	frontmatter: Record<string, any>
	body: string
} {
	const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/
	const match = fileContent.match(frontMatterRegex)

	try {
		if (match) {
			const frontmatter = yaml.load(match[1]) as Record<string, any>
			const body = match[2].trim()

			return { frontmatter, body }
		}

		return { frontmatter: {}, body: fileContent.trim() }
	} catch (error) {
		throw new Error(`Failed to parse frontmatter: ${error.message}`)
	}
}
