import { App, TFile, Notice } from 'obsidian'
import { StrapiExporterSettings } from '../types/settings'
import { ImageDescription } from '../types/image'
import { uploadImageToStrapi } from './strapi-uploader'

export async function processInlineImages(
	app: App,
	settings: StrapiExporterSettings,
	content: string
): Promise<{ updatedContent: string; inlineImages: ImageDescription[] }> {
	const imagePaths = extractImagePaths(content)
	const inlineImages: ImageDescription[] = []

	let updatedContent = content

	for (const imagePath of imagePaths) {
		if (isExternalLink(imagePath)) {
			console.log(`Skipping external image: ${imagePath}`)
			continue
		}

		const uploadedImage = await uploadImageToStrapi(imagePath, app, settings)
		if (uploadedImage) {
			inlineImages.push(uploadedImage)

			// Replace Obsidian internal links
			const obsidianLinkRegex = new RegExp(
				`!\\[\\[${escapeRegExp(imagePath)}\\]\\]`,
				'g'
			)
			updatedContent = updatedContent.replace(
				obsidianLinkRegex,
				`![${uploadedImage.name || ''}](${uploadedImage.url})`
			)

			// Replace standard Markdown image links
			const markdownLinkRegex = new RegExp(
				`!\\[([^\\]]*)\\]\\(${escapeRegExp(imagePath)}\\)`,
				'g'
			)
			updatedContent = updatedContent.replace(
				markdownLinkRegex,
				`![$1](${uploadedImage.url})`
			)
		}
	}

	return { updatedContent, inlineImages }
}

export function extractImagePaths(content: string): string[] {
	const obsidianImageRegex = /!\[\[([^\]]+\.(png|jpe?g|gif|svg|bmp|webp))\]\]/gi
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

	return imagePaths
}

function isExternalLink(path: string): boolean {
	return path.startsWith('http://') || path.startsWith('https://')
}

function escapeRegExp(string: string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
