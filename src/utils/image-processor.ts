import { App, TFile } from 'obsidian'
import {
	ImageDescription,
	ImageProcessingResult,
	StrapiExporterSettings,
} from '../types'
import { Logger } from './logger'
import { uploadImageToStrapi } from './strapi-uploader'

/**
 * Process images in markdown content and handle uploads to Strapi
 */
export async function processImages(
	app: App,
	settings: StrapiExporterSettings,
	content: string
): Promise<ImageProcessingResult> {
	Logger.info('ImageProcessor', '167. Starting image processing')
	Logger.debug('ImageProcessor', '168. Initial content length', {
		length: content.length,
	})

	try {
		const imageRefs = extractImageReferences(content)
		Logger.info(
			'ImageProcessor',
			`169. Found ${imageRefs.length} image references`
		)

		const processedImages = await processImageReferences(
			app,
			settings,
			imageRefs
		)
		const updatedContent = updateImageReferences(content, processedImages)

		Logger.info('ImageProcessor', '170. Image processing completed')
		return {
			content: updatedContent,
			processedImages,
		}
	} catch (error) {
		Logger.error('ImageProcessor', '171. Error during image processing', error)
		throw new Error(`Image processing failed: ${error.message}`)
	}
}

interface ImageReference {
	fullMatch: string
	path: string
	altText: string
	type: 'wikilink' | 'markdown'
}

/**
 * Extract image references from content
 */
function extractImageReferences(content: string): ImageReference[] {
	Logger.debug('ImageProcessor', '172. Extracting image references')
	const references: ImageReference[] = []

	try {
		// Wiki-style image links (![[image.png]])
		const wikiLinkRegex = /!\[\[([^\]]+\.(png|jpe?g|gif|svg|bmp|webp))\]\]/gi
		let match

		while ((match = wikiLinkRegex.exec(content)) !== null) {
			Logger.debug('ImageProcessor', `173. Found wiki-style image: ${match[1]}`)
			references.push({
				fullMatch: match[0],
				path: match[1],
				altText: '',
				type: 'wikilink',
			})
		}

		// Markdown-style image links (![alt](path.png))
		const markdownLinkRegex =
			/!\[([^\]]*)\]\(([^)]+\.(png|jpe?g|gif|svg|bmp|webp))\)/gi
		while ((match = markdownLinkRegex.exec(content)) !== null) {
			Logger.debug(
				'ImageProcessor',
				`174. Found markdown-style image: ${match[2]}`
			)
			references.push({
				fullMatch: match[0],
				path: match[2],
				altText: match[1],
				type: 'markdown',
			})
		}

		Logger.info(
			'ImageProcessor',
			`175. Extracted ${references.length} image references`
		)
		return references
	} catch (error) {
		Logger.error(
			'ImageProcessor',
			'176. Error extracting image references',
			error
		)
		throw new Error(`Failed to extract image references: ${error.message}`)
	}
}

/**
 * Process image references and upload to Strapi
 */
async function processImageReferences(
	app: App,
	settings: StrapiExporterSettings,
	references: ImageReference[]
): Promise<ImageDescription[]> {
	Logger.info('ImageProcessor', '177. Processing image references')
	const processedImages: ImageDescription[] = []

	for (const ref of references) {
		Logger.debug('ImageProcessor', `178. Processing image: ${ref.path}`)

		try {
			if (isExternalUrl(ref.path)) {
				Logger.debug(
					'ImageProcessor',
					`179. Skipping external image: ${ref.path}`
				)
				processedImages.push({
					url: ref.path,
					name: ref.path,
					path: ref.path,
					description: {
						name: ref.path,
						alternativeText: ref.altText,
						caption: ref.altText,
					},
				})
				continue
			}

			const file = app.vault.getAbstractFileByPath(ref.path)
			if (!(file instanceof TFile)) {
				Logger.warn('ImageProcessor', `180. File not found: ${ref.path}`)
				continue
			}

			const uploadResult = await uploadImageToStrapi(
				file,
				file.name,
				settings,
				app,
				{
					alternativeText: ref.altText || file.basename,
					caption: ref.altText || file.basename,
				}
			)

			if (uploadResult) {
				Logger.debug(
					'ImageProcessor',
					`181. Image uploaded successfully: ${ref.path}`
				)
				processedImages.push(uploadResult)
			} else {
				Logger.warn('ImageProcessor', `182. Upload failed for: ${ref.path}`)
			}
		} catch (error) {
			Logger.error(
				'ImageProcessor',
				`183. Error processing image: ${ref.path}`,
				error
			)
			throw new Error(`Failed to process image ${ref.path}: ${error.message}`)
		}
	}

	Logger.info(
		'ImageProcessor',
		`184. Processed ${processedImages.length} images`
	)
	return processedImages
}

/**
 * Update image references in content with uploaded URLs
 */
function updateImageReferences(
	content: string,
	processedImages: ImageDescription[]
): string {
	Logger.info('ImageProcessor', '185. Updating image references in content')

	try {
		let updatedContent = content
		for (const image of processedImages) {
			if (image.url) {
				Logger.debug(
					'ImageProcessor',
					`186. Replacing reference for image: ${image.name}`
				)
				const imageRegex = new RegExp(
					`!\\[([^\\]]*)\\]\\(${image.path}\\)|!\\[\\[${image.path}\\]\\]`,
					'g'
				)
				updatedContent = updatedContent.replace(
					imageRegex,
					`![${image.description?.alternativeText || ''}](${image.url})`
				)
			}
		}

		Logger.info('ImageProcessor', '187. Image references updated successfully')
		return updatedContent
	} catch (error) {
		Logger.error(
			'ImageProcessor',
			'188. Error updating image references',
			error
		)
		throw new Error(`Failed to update image references: ${error.message}`)
	}
}

/**
 * Check if a path is an external URL
 */
function isExternalUrl(path: string): boolean {
	Logger.debug('ImageProcessor', `189. Checking if path is external: ${path}`)
	return path.startsWith('http://') || path.startsWith('https://')
}

/**
 * Process and optimize an individual image
 */
export async function processIndividualImage(
	app: App,
	settings: StrapiExporterSettings,
	imagePath: string,
	altText?: string
): Promise<string | null> {
	Logger.info(
		'ImageProcessor',
		`190. Processing individual image: ${imagePath}`
	)

	try {
		if (isExternalUrl(imagePath)) {
			Logger.debug('ImageProcessor', '191. Returning external URL as-is')
			return imagePath
		}

		const file = app.vault.getAbstractFileByPath(imagePath)
		if (!(file instanceof TFile)) {
			Logger.error('ImageProcessor', `192. File not found: ${imagePath}`)
			return null
		}

		const uploadResult = await uploadImageToStrapi(
			file,
			file.name,
			settings,
			app,
			{
				alternativeText: altText || file.basename,
				caption: altText || file.basename,
			}
		)

		if (uploadResult?.url) {
			Logger.info('ImageProcessor', '193. Image processed successfully')
			return uploadResult.url
		}

		Logger.warn('ImageProcessor', '194. Image processing failed')
		return null
	} catch (error) {
		Logger.error(
			'ImageProcessor',
			'195. Error processing individual image',
			error
		)
		return null
	}
}
