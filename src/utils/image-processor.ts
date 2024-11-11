import { App, TFile } from 'obsidian'
import {
	ImageDescription,
	ImageProcessingResult,
	StrapiExporterSettings,
} from '../types'
import { uploadImageToStrapi } from './strapi-uploader'

/**
 * Process images in markdown content and handle uploads to Strapi
 */
export async function processImages(
	app: App,
	settings: StrapiExporterSettings,
	content: string
): Promise<ImageProcessingResult> {
	try {
		const imageRefs = extractImageReferences(content)

		const processedImages = await processImageReferences(
			app,
			settings,
			imageRefs
		)
		const updatedContent = updateImageReferences(content, processedImages)
		return {
			content: updatedContent,
			processedImages,
		}
	} catch (error) {
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
	const references: ImageReference[] = []

	try {
		// Wiki-style image links (![[image.png]])
		const wikiLinkRegex = /!\[\[([^\]]+\.(png|jpe?g|gif|svg|bmp|webp))\]\]/gi
		let match

		while ((match = wikiLinkRegex.exec(content)) !== null) {
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
			references.push({
				fullMatch: match[0],
				path: match[2],
				altText: match[1],
				type: 'markdown',
			})
		}

		return references
	} catch (error) {
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
	const processedImages: ImageDescription[] = []

	for (const ref of references) {
		try {
			if (isExternalUrl(ref.path)) {
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
				processedImages.push(uploadResult)
			}
		} catch (error) {
			throw new Error(`Failed to process image ${ref.path}: ${error.message}`)
		}
	}

	return processedImages
}

/**
 * Update image references in content with uploaded URLs
 */
function updateImageReferences(
	content: string,
	processedImages: ImageDescription[]
): string {
	try {
		let updatedContent = content
		for (const image of processedImages) {
			if (image.url) {
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

		return updatedContent
	} catch (error) {
		throw new Error(`Failed to update image references: ${error.message}`)
	}
}

/**
 * Check if a path is an external URL
 */
function isExternalUrl(path: string): boolean {
	return path.startsWith('http://') || path.startsWith('https://')
}
