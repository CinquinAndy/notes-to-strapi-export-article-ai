import { TFile, App } from 'obsidian'
import { RouteConfig, AnalyzedContent } from '../types'
import { Logger } from './logger'
import * as yaml from 'js-yaml'

export async function analyzeFile(
	file: TFile,
	app: App,
	route: RouteConfig
): Promise<AnalyzedContent> {
	Logger.info('FileAnalysis', `40. Starting file analysis: ${file.path}`)

	try {
		// Reading file content
		Logger.info('FileAnalysis', '41. Reading file content')
		const content = await app.vault.read(file)
		Logger.debug('FileAnalysis', '42. Raw content length', {
			length: content.length,
		})

		// Extracting frontmatter and content
		Logger.info('FileAnalysis', '43. Extracting frontmatter and content')
		const { frontmatter, body } = extractFrontMatterAndContent(content)
		Logger.debug('FileAnalysis', '44. Extracted components', {
			frontmatter,
			hasFrontmatter: Object.keys(frontmatter).length > 0,
			bodyLength: body.length,
		})

		// Initialize result with existing frontmatter
		const result: AnalyzedContent = {
			...frontmatter, // Copy all existing frontmatter fields
		}

		// Processing field mappings
		Logger.info('FileAnalysis', '45. Processing field mappings')
		for (const [strapiField, mapping] of Object.entries(route.fieldMappings)) {
			Logger.debug('FileAnalysis', `46. Processing field: ${strapiField}`, {
				mapping,
				currentValue: result[strapiField],
			})

			// Only override if mapping exists and field is not already set
			if (mapping.obsidianSource === 'frontmatter' && mapping.frontmatterKey) {
				Logger.debug(
					'FileAnalysis',
					`47. Processing frontmatter field: ${mapping.frontmatterKey}`
				)

				// Only set if not already present
				if (result[strapiField] === undefined) {
					result[strapiField] = frontmatter[mapping.frontmatterKey] ?? null
				}

				if (result[strapiField] === null) {
					Logger.warn(
						'FileAnalysis',
						`48. Field not found in frontmatter: ${mapping.frontmatterKey}`
					)
				}
			}
			// Handle content fields
			else if (mapping.obsidianSource === 'content') {
				Logger.debug(
					'FileAnalysis',
					`49. Processing content field: ${strapiField}`
				)
				result[strapiField] = body
			}

			// Apply transformations
			if (mapping.transform && result[strapiField] !== null) {
				Logger.debug(
					'FileAnalysis',
					`50. Applying transformation for: ${strapiField}`,
					{ beforeTransform: result[strapiField] }
				)
				try {
					result[strapiField] = await applyTransformation(
						result[strapiField],
						mapping.transform,
						strapiField
					)
					Logger.debug('FileAnalysis', `50.1 Transformation result:`, {
						afterTransform: result[strapiField],
					})
				} catch (error) {
					Logger.error(
						'FileAnalysis',
						`51. Transformation error for ${strapiField}`,
						error
					)
					throw new Error(
						`Failed to transform field ${strapiField}: ${error.message}`
					)
				}
			}
		}

		Logger.info('FileAnalysis', '52. File analysis completed successfully')
		Logger.debug('FileAnalysis', '53. Final analysis result', result)
		return result
	} catch (error) {
		Logger.error('FileAnalysis', '54. Error during file analysis', error)
		throw new Error(`File analysis failed: ${error.message}`)
	}
}

async function applyTransformation(
	value: any,
	transform: string | ((value: any) => any),
	fieldName: string
): Promise<any> {
	Logger.debug('Transform', `55. Starting transformation for: ${fieldName}`)

	try {
		if (typeof transform === 'function') {
			Logger.debug('Transform', '56. Applying function transformation')
			return transform(value)
		} else if (typeof transform === 'string') {
			Logger.debug(
				'Transform',
				'57. Creating transformation function from string'
			)
			const transformFunction = new Function('value', `return ${transform}`)
			return transformFunction(value)
		}
		return value
	} catch (error) {
		Logger.error(
			'Transform',
			`58. Transformation failed for ${fieldName}`,
			error
		)
		throw new Error(`Transformation failed: ${error.message}`)
	}
}

export function extractFrontMatterAndContent(fileContent: string): {
	frontmatter: Record<string, any>
	body: string
} {
	Logger.info('FrontMatter', '59. Starting frontmatter extraction')

	const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/
	const match = fileContent.match(frontMatterRegex)

	try {
		if (match) {
			Logger.debug('FrontMatter', '60. Found frontmatter section')
			const frontmatter = yaml.load(match[1]) as Record<string, any>
			const body = match[2].trim()

			Logger.debug('FrontMatter', '61. Frontmatter parsed successfully', {
				frontmatterKeys: Object.keys(frontmatter),
				bodyLength: body.length,
			})

			return { frontmatter, body }
		}

		Logger.warn(
			'FrontMatter',
			'62. No frontmatter found, returning empty object'
		)
		return { frontmatter: {}, body: fileContent.trim() }
	} catch (error) {
		Logger.error('FrontMatter', '63. Error parsing frontmatter', error)
		throw new Error(`Failed to parse frontmatter: ${error.message}`)
	}
}
