import { App } from 'obsidian'
import { ImageSelectionModal } from '../components/ImageSelectionModal'
import { FieldAnalysis } from './config-analyzer'
import { Logger } from './logger'

/**
 * Generate frontmatter content based on field analysis
 */
export async function generateFrontMatter(
	analysis: FieldAnalysis[],
	existingContent: string,
	app: App
): Promise<string> {
	Logger.info('FrontMatterGen', '141. Starting frontmatter generation')
	Logger.debug('FrontMatterGen', '142. Input analysis', {
		fieldCount: analysis.length,
		existingContentLength: existingContent.length,
	})

	try {
		let frontMatter = '---\n'

		for (const field of analysis) {
			Logger.debug(
				'FrontMatterGen',
				`143. Processing field: ${field.fieldName}`,
				field
			)

			try {
				const value = await generateFieldValue(field, existingContent, app)
				Logger.debug(
					'FrontMatterGen',
					`144. Generated value for ${field.fieldName}`,
					{ value }
				)

				frontMatter += formatFieldValue(field.fieldName, value)
			} catch (error) {
				Logger.error(
					'FrontMatterGen',
					`145. Error generating value for field ${field.fieldName}`,
					error
				)
				throw new Error(
					`Failed to generate value for field ${field.fieldName}: ${error.message}`
				)
			}
		}

		frontMatter += '---\n'
		Logger.info('FrontMatterGen', '146. Frontmatter generation completed')
		Logger.debug('FrontMatterGen', '147. Generated frontmatter', {
			frontMatter,
		})

		return frontMatter
	} catch (error) {
		Logger.error('FrontMatterGen', '148. Error generating frontmatter', error)
		throw new Error(`Frontmatter generation failed: ${error.message}`)
	}
}

/**
 * Generate value for a specific field
 */
async function generateFieldValue(
	field: FieldAnalysis,
	existingContent: string,
	app: App
): Promise<string> {
	Logger.debug(
		'FrontMatterGen',
		`149. Generating value for field: ${field.fieldName}`
	)

	try {
		if (field.fieldType === 'image' || field.fieldType === 'imageArray') {
			return await handleImageField(field, app)
		} else {
			return await handleRegularField(field, existingContent)
		}
	} catch (error) {
		Logger.error(
			'FrontMatterGen',
			`150. Error generating field value: ${field.fieldName}`,
			error
		)
		throw error
	}
}

/**
 * Handle image field type generation
 */
async function handleImageField(
	field: FieldAnalysis,
	app: App
): Promise<string> {
	Logger.debug(
		'FrontMatterGen',
		`151. Handling image field: ${field.fieldName}`
	)
	const isMultiple = field.fieldType === 'imageArray'

	try {
		const value = await new Promise<string>((resolve, reject) => {
			try {
				new ImageSelectionModal(app, isMultiple, images => {
					const result = isMultiple ? JSON.stringify(images) : images[0] || ''
					Logger.debug(
						'FrontMatterGen',
						`152. Image selection completed for ${field.fieldName}`,
						{ result }
					)
					resolve(result)
				}).open()
			} catch (error) {
				Logger.error(
					'FrontMatterGen',
					`153. Error in image selection modal: ${field.fieldName}`,
					error
				)
				reject(error)
			}
		})

		return value
	} catch (error) {
		Logger.error(
			'FrontMatterGen',
			`154. Error handling image field: ${field.fieldName}`,
			error
		)
		throw new Error(`Failed to handle image field: ${error.message}`)
	}
}

/**
 * Handle regular (non-image) field type generation
 */
async function handleRegularField(
	field: FieldAnalysis,
	existingContent: string
): Promise<string> {
	Logger.debug(
		'FrontMatterGen',
		`155. Handling regular field: ${field.fieldName}`
	)

	try {
		const extractedValue = extractValueFromContent(
			existingContent,
			field.fieldName
		)
		const value = extractedValue || `<${field.fieldName}>`

		Logger.debug('FrontMatterGen', `156. Value for ${field.fieldName}`, {
			extracted: !!extractedValue,
			value,
		})

		return value
	} catch (error) {
		Logger.error(
			'FrontMatterGen',
			`157. Error handling regular field: ${field.fieldName}`,
			error
		)
		throw new Error(`Failed to handle regular field: ${error.message}`)
	}
}

/**
 * Extract value from existing content using regex or markdown parser
 */
function extractValueFromContent(
	content: string,
	fieldName: string
): string | null {
	Logger.debug(
		'FrontMatterGen',
		`158. Extracting value for field: ${fieldName}`
	)

	try {
		// Currently returns null as placeholder
		// TODO: Implement actual extraction logic using regex or markdown parser
		Logger.debug(
			'FrontMatterGen',
			`159. No value extracted for ${fieldName} (placeholder)`
		)
		return null
	} catch (error) {
		Logger.error(
			'FrontMatterGen',
			`160. Error extracting value for ${fieldName}`,
			error
		)
		return null
	}
}

/**
 * Extract frontmatter from content
 */
export function extractFrontMatter(content: string): string | null {
	Logger.debug('FrontMatterGen', '161. Extracting frontmatter from content')

	try {
		const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---/
		const match = content.match(frontMatterRegex)

		if (match) {
			Logger.debug('FrontMatterGen', '162. Frontmatter extracted successfully')
			return match[1]
		}

		Logger.debug('FrontMatterGen', '163. No frontmatter found in content')
		return null
	} catch (error) {
		Logger.error('FrontMatterGen', '164. Error extracting frontmatter', error)
		return null
	}
}

/**
 * Format field value for frontmatter
 */
function formatFieldValue(fieldName: string, value: string): string {
	Logger.debug(
		'FrontMatterGen',
		`165. Formatting value for field: ${fieldName}`
	)

	try {
		// Handle special characters and formatting
		const formattedValue = value.includes('\n')
			? `|\n${value
					.split('\n')
					.map(line => `  ${line}`)
					.join('\n')}`
			: value

		return `${fieldName}: ${formattedValue}\n`
	} catch (error) {
		Logger.error(
			'FrontMatterGen',
			`166. Error formatting value for ${fieldName}`,
			error
		)
		return `${fieldName}: ${value}\n`
	}
}
