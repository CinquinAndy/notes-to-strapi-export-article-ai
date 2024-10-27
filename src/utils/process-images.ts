import { App, TFile } from 'obsidian'
import { StrapiExporterSettings } from '../types'
import { ImageDescription } from '../types'
import { uploadImageToStrapi } from './strapi-uploader'
import { Logger } from './logger'

interface ImageProcessingStats {
	total: number
	processed: number
	skipped: number
	errors: number
}

/**
 * Process inline images in content and upload them to Strapi
 */
export async function processInlineImages(
	app: App,
	settings: StrapiExporterSettings,
	content: string
): Promise<{
	updatedContent: string
	inlineImages: ImageDescription[]
	stats: ImageProcessingStats
}> {
	Logger.info('ProcessImages', '236. Starting inline images processing')

	try {
		validateSettings(settings)
		const stats: ImageProcessingStats = {
			total: 0,
			processed: 0,
			skipped: 0,
			errors: 0,
		}

		const imagePaths = extractImagePaths(content)
		stats.total = imagePaths.length

		Logger.info('ProcessImages', '237. Found images to process', {
			count: imagePaths.length,
		})

		const { updatedContent, inlineImages } = await processImages(
			app,
			settings,
			content,
			imagePaths,
			stats
		)

		Logger.info('ProcessImages', '238. Image processing completed', { stats })
		return { updatedContent, inlineImages, stats }
	} catch (error) {
		Logger.error('ProcessImages', '239. Error in image processing', error)
		throw new Error(`Image processing failed: ${error.message}`)
	}
}

/**
 * Process multiple images
 */
async function processImages(
	app: App,
	settings: StrapiExporterSettings,
	content: string,
	imagePaths: string[],
	stats: ImageProcessingStats
): Promise<{ updatedContent: string; inlineImages: ImageDescription[] }> {
	Logger.debug('ProcessImages', '240. Processing multiple images')

	let updatedContent = content
	const inlineImages: ImageDescription[] = []

	for (const imagePath of imagePaths) {
		try {
			if (isExternalLink(imagePath)) {
				Logger.debug(
					'ProcessImages',
					`241. Skipping external image: ${imagePath}`
				)
				stats.skipped++
				continue
			}

			const result = await processIndividualImage(
				app,
				settings,
				imagePath,
				updatedContent
			)

			if (result) {
				updatedContent = result.updatedContent
				inlineImages.push(result.imageDescription)
				stats.processed++
				Logger.debug(
					'ProcessImages',
					`242. Image processed successfully: ${imagePath}`
				)
			}
		} catch (error) {
			stats.errors++
			Logger.error(
				'ProcessImages',
				`243. Error processing image: ${imagePath}`,
				error
			)
		}
	}

	return { updatedContent, inlineImages }
}

/**
 * Process individual image
 */
async function processIndividualImage(
	app: App,
	settings: StrapiExporterSettings,
	imagePath: string,
	content: string
): Promise<{
	updatedContent: string
	imageDescription: ImageDescription
} | null> {
	Logger.debug(
		'ProcessImages',
		`244. Processing individual image: ${imagePath}`
	)

	const file = app.vault.getAbstractFileByPath(imagePath)
	if (!(file instanceof TFile)) {
		Logger.error('ProcessImages', `245. File not found: ${imagePath}`)
		return null
	}

	try {
		const uploadedImage = await uploadImageToStrapi(
			file,
			file.name,
			settings,
			app
		)

		if (uploadedImage) {
			Logger.debug(
				'ProcessImages',
				`246. Image uploaded successfully: ${imagePath}`
			)
			const updatedContent = replaceImageLinks(
				content,
				imagePath,
				uploadedImage
			)
			return { updatedContent, imageDescription: uploadedImage }
		}
	} catch (error) {
		Logger.error(
			'ProcessImages',
			`247. Error uploading image: ${imagePath}`,
			error
		)
		throw error
	}

	return null
}

/**
 * Replace image links in content
 */
function replaceImageLinks(
	content: string,
	originalPath: string,
	uploadedImage: ImageDescription
): string {
	Logger.debug(
		'ProcessImages',
		`248. Replacing image links for: ${originalPath}`
	)

	try {
		const obsidianLinkRegex = new RegExp(
			`!\\[\\[${escapeRegExp(originalPath)}\\]\\]`,
			'g'
		)
		const markdownLinkRegex = new RegExp(
			`!\\[([^\\]]*)\\]\\(${escapeRegExp(originalPath)}\\)`,
			'g'
		)

		const newContent = content
			.replace(
				obsidianLinkRegex,
				`![${uploadedImage.name || ''}](${uploadedImage.url})`
			)
			.replace(markdownLinkRegex, `![$1](${uploadedImage.url})`)

		Logger.debug('ProcessImages', `249. Image links replaced successfully`)
		return newContent
	} catch (error) {
		Logger.error('ProcessImages', '250. Error replacing image links', error)
		throw error
	}
}

/**
 * Extract image paths from content
 */
export function extractImagePaths(content: string): string[] {
	Logger.debug('ProcessImages', '251. Extracting image paths')

	try {
		const obsidianImageRegex =
			/!\[\[([^\]]+\.(png|jpe?g|gif|svg|bmp|webp))\]\]/gi
		const markdownImageRegex =
			/!\[([^\]]*)\]\(([^)]+\.(png|jpe?g|gif|svg|bmp|webp))\)/gi
		const imagePaths: string[] = []
		let match

		while ((match = obsidianImageRegex.exec(content)) !== null) {
			imagePaths.push(match[1])
		}

		while ((match = markdownImageRegex.exec(content)) !== null) {
			imagePaths.push(match[2])
		}

		Logger.debug('ProcessImages', '252. Image paths extracted', {
			count: imagePaths.length,
		})
		return imagePaths
	} catch (error) {
		Logger.error('ProcessImages', '253. Error extracting image paths', error)
		throw error
	}
}

/**
 * Check if link is external
 */
export function isExternalLink(path: string): boolean {
	return path.startsWith('http://') || path.startsWith('https://')
}

/**
 * Escape regular expression special characters
 */
export function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Validate settings before processing
 */
function validateSettings(settings: StrapiExporterSettings): void {
	Logger.debug('ProcessImages', '254. Validating settings')

	if (!settings.strapiUrl) {
		Logger.error('ProcessImages', '255. Missing Strapi URL')
		throw new Error('Strapi URL is not configured')
	}

	if (!settings.strapiApiToken) {
		Logger.error('ProcessImages', '256. Missing Strapi API token')
		throw new Error('Strapi API token is not configured')
	}
}

/**
 * Generate image metadata
 */
export function generateImageMetadata(
	fileName: string,
	altText?: string
): { name: string; alternativeText: string; caption: string } {
	return {
		name: fileName,
		alternativeText: altText || fileName,
		caption: altText || fileName,
	}
}
