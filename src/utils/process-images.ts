import { App, TFile } from 'obsidian'
import { StrapiExporterSettings } from '../types/settings'
import { ImageDescription } from '../types/image'
import { uploadImageToStrapi } from './strapi-uploader'

export async function processInlineImages(
	app: App,
	settings: StrapiExporterSettings,
	content: string
): Promise<{ updatedContent: string; inlineImages: ImageDescription[] }> {
	console.log('Starting processInlineImages')
	const imagePaths = extractImagePaths(content)
	const inlineImages: ImageDescription[] = []
	let updatedContent = content

	for (const imagePath of imagePaths) {
		if (isExternalLink(imagePath)) {
			console.log(`Skipping external image: ${imagePath}`)
			continue
		}

		console.log(`Processing image: ${imagePath}`)
		const file = app.vault.getAbstractFileByPath(imagePath)
		if (!(file instanceof TFile)) {
			console.error(`File not found: ${imagePath}`)
			continue
		}

		try {
			const uploadedImage = await uploadImageToStrapi(
				file,
				file.name,
				settings,
				app
			)

			if (uploadedImage) {
				inlineImages.push(uploadedImage)
				updatedContent = replaceImageLinks(
					updatedContent,
					imagePath,
					uploadedImage
				)
			}
		} catch (error) {
			console.error(`Error processing image ${imagePath}:`, error)
		}
	}

	console.log('Finished processInlineImages')
	return { updatedContent, inlineImages }
}

function replaceImageLinks(
	content: string,
	originalPath: string,
	uploadedImage: ImageDescription
): string {
	const obsidianLinkRegex = new RegExp(
		`!\\[\\[${escapeRegExp(originalPath)}\\]\\]`,
		'g'
	)
	const markdownLinkRegex = new RegExp(
		`!\\[([^\\]]*)\\]\\(${escapeRegExp(originalPath)}\\)`,
		'g'
	)

	return content
		.replace(
			obsidianLinkRegex,
			`![${uploadedImage.name || ''}](${uploadedImage.url})`
		)
		.replace(markdownLinkRegex, `![$1](${uploadedImage.url})`)
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

export function isExternalLink(path: string): boolean {
	return path.startsWith('http://') || path.startsWith('https://')
}

export function escapeRegExp(string: string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
