import { TFile, App } from 'obsidian'
import { RouteConfig, AnalyzedContent } from '../types/settings'
import * as yaml from 'js-yaml'

export async function analyzeFile(
	file: TFile,
	app: App,
	route: RouteConfig
): Promise<AnalyzedContent> {
	console.log(`Analyzing file: ${file.path}`)
	const content = await app.vault.read(file)
	const { frontmatter, body } = extractFrontMatterAndContent(content)

	const result: AnalyzedContent = {}

	for (const [strapiField, mapping] of Object.entries(route.fieldMappings)) {
		if (mapping.obsidianSource === 'frontmatter' && mapping.frontmatterKey) {
			result[strapiField] = frontmatter[mapping.frontmatterKey] ?? null
			if (result[strapiField] === null) {
				console.warn(`Field ${mapping.frontmatterKey} not found in frontmatter`)
			}
		} else if (mapping.obsidianSource === 'content') {
			result[strapiField] = body
		}

		if (mapping.transform && result[strapiField] !== null) {
			try {
				result[strapiField] = mapping.transform(result[strapiField])
			} catch (error) {
				console.error(`Error transforming ${strapiField}:`, error)
			}
		}
	}

	console.log('File analysis complete')
	return result
}

function extractFrontMatterAndContent(fileContent: string): {
	frontmatter: Record<string, any>
	body: string
} {
	const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/
	const match = fileContent.match(frontMatterRegex)

	if (match) {
		const frontmatter = yaml.load(match[1]) as Record<string, any>
		const body = match[2].trim()
		return { frontmatter, body }
	}

	return { frontmatter: {}, body: fileContent.trim() }
}
