import { App, TFile } from 'obsidian'
import { StrapiExporterSettings, AnalyzedContent } from '../types'
import { uploadImageToStrapi } from './strapi-uploader'
import { Logger } from './logger'

interface ImageMatch {
	fullMatch: string
	altText: string
	imagePath: string
}

/**
 * Process images in content fields and upload them to Strapi
 */
export async function processImages(
	content: AnalyzedContent,
	app: App,
	settings: StrapiExporterSettings
): Promise<AnalyzedContent> {
	Logger.info('ProcessFile', '214. Starting content image processing')
	Logger.debug('ProcessFile', '215. Initial content structure', {
		fields: Object.keys(content),
	})

	try {
		const processedContent = { ...content }
		let processedFieldCount = 0
		let errorCount = 0

		for (const [key, value] of Object.entries(processedContent)) {
			if (typeof value === 'string') {
				Logger.debug('ProcessFile', `216. Processing field: ${key}`)
				try {
					processedContent[key] = await processImageLinks(value, app, settings)
					processedFieldCount++
					Logger.debug(
						'ProcessFile',
						`217. Field processed successfully: ${key}`
					)
				} catch (error) {
					errorCount++
					Logger.error(
						'ProcessFile',
						`218. Error processing field: ${key}`,
						error
					)
				}
			}
		}

		Logger.info('ProcessFile', '219. Image processing completed', {
			processedFields: processedFieldCount,
			errorCount,
		})

		return processedContent
	} catch (error) {
		Logger.error(
			'ProcessFile',
			'220. Fatal error during image processing',
			error
		)
		throw new Error(`Image processing failed: ${error.message}`)
	}
}

/**
 * Process image links in content string
 */
async function processImageLinks(
	content: string,
	app: App,
	settings: StrapiExporterSettings
): Promise<string> {
	Logger.debug('ProcessFile', '221. Processing image links in content', {
		contentLength: content.length,
	})

	try {
		const imageMatches = extractImageMatches(content)
		Logger.debug(
			'ProcessFile',
			`222. Found ${imageMatches.length} image matches`
		)

		let processedContent = content
		let successCount = 0
		let errorCount = 0

		for (const match of imageMatches) {
			try {
				const replacedContent = await processImageMatch(
					match,
					processedContent,
					app,
					settings
				)

				if (replacedContent !== processedContent) {
					processedContent = replacedContent
					successCount++
					Logger.debug(
						'ProcessFile',
						`223. Successfully processed image: ${match.imagePath}`
					)
				}
			} catch (error) {
				errorCount++
				Logger.error('ProcessFile', `224. Error processing image match`, {
					imagePath: match.imagePath,
					error,
				})
			}
		}

		Logger.info('ProcessFile', '225. Image link processing completed', {
			totalImages: imageMatches.length,
			successCount,
			errorCount,
		})

		return processedContent
	} catch (error) {
		Logger.error('ProcessFile', '226. Error processing image links', error)
		throw error
	}
}

/**
 * Extract image matches from content
 */
function extractImageMatches(content: string): ImageMatch[] {
	Logger.debug('ProcessFile', '227. Extracting image matches')
	const matches: ImageMatch[] = []
	const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
	let match

	while ((match = imageRegex.exec(content)) !== null) {
		matches.push({
			fullMatch: match[0],
			altText: match[1],
			imagePath: match[2],
		})
	}

	Logger.debug('ProcessFile', `228. Extracted ${matches.length} image matches`)
	return matches
}

/**
 * Process individual image match
 */
async function processImageMatch(
	match: ImageMatch,
	content: string,
	app: App,
	settings: StrapiExporterSettings
): Promise<string> {
	Logger.debug('ProcessFile', `229. Processing image match: ${match.imagePath}`)

	if (isExternalUrl(match.imagePath)) {
		Logger.debug(
			'ProcessFile',
			`230. Skipping external image: ${match.imagePath}`
		)
		return content
	}

	const file = app.vault.getAbstractFileByPath(match.imagePath)
	if (!(file instanceof TFile)) {
		Logger.warn('ProcessFile', `231. File not found: ${match.imagePath}`)
		return content
	}

	try {
		const uploadedImage = await uploadImageToStrapi(
			file,
			file.name,
			settings,
			app,
			{
				alternativeText: match.altText || file.basename,
				caption: match.altText || file.basename,
			}
		)

		if (uploadedImage?.url) {
			const newContent = content.replace(
				match.fullMatch,
				`![${match.altText}](${uploadedImage.url})`
			)
			Logger.debug(
				'ProcessFile',
				`232. Image replaced successfully: ${file.name}`
			)
			return newContent
		}

		Logger.warn('ProcessFile', `233. Upload failed for image: ${file.name}`)
		return content
	} catch (error) {
		Logger.error(
			'ProcessFile',
			`234. Error processing image: ${file.name}`,
			error
		)
		throw error
	}
}

/**
 * Check if URL is external
 */
function isExternalUrl(url: string): boolean {
	return url.startsWith('http://') || url.startsWith('https://')
}

/**
 * Validate Strapi settings
 */
function validateSettings(settings: StrapiExporterSettings): void {
	Logger.debug('ProcessFile', '235. Validating Strapi settings')

	if (!settings.strapiUrl) {
		throw new Error('Strapi URL is not configured')
	}
	if (!settings.strapiApiToken) {
		throw new Error('Strapi API token is not configured')
	}
}

/**
 * Create image metadata
 */
function createImageMetadata(
	file: TFile,
	altText: string
): { alternativeText: string; caption: string } {
	return {
		alternativeText: altText || file.basename,
		caption: altText || file.basename,
	}
}
