import { App, TFile } from 'obsidian'
import { StrapiExporterSettings } from '../types/settings'
import { uploadImagesToStrapi } from './strapi-uploader'
import { ImageBlob, ImageDescription } from '../types/image'

export async function processInlineImages(
	app: App,
	settings: StrapiExporterSettings,
	content: string
): Promise<{ updatedContent: string; inlineImages: ImageDescription[] }> {
	const imagePaths = extractImagePaths(content)
	const imageBlobs = await getImageBlobs(app, imagePaths)
	const imageDescriptions: ImageDescription[] = imageBlobs.map(blob => ({
		...blob,
		description: {
			name: blob.name,
			alternativeText: '',
			caption: '',
		},
	}))
	const uploadedImages = await uploadImagesToStrapi(imageDescriptions, settings)

	let updatedContent = content
	const inlineImages: ImageDescription[] = []

	for (const [localPath, imageData] of Object.entries(uploadedImages)) {
		// Remplacer les liens d'images standard Markdown
		const markdownImageRegex = new RegExp(
			`!\\[([^\\]]*)]\\(${localPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`,
			'g'
		)
		updatedContent = updatedContent.replace(
			markdownImageRegex,
			(match, capturedAltText) => `![${capturedAltText}](${imageData.url})`
		)

		// Remplacer les liens d'images internes Obsidian
		const obsidianImageRegex = new RegExp(
			`!\\[\\[${localPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\]`,
			'g'
		)
		updatedContent = updatedContent.replace(
			obsidianImageRegex,
			`![${imageData.data.name}](${imageData.url})`
		)

		inlineImages.push({
			name: imageData.data.name,
			blob: new Blob(),
			path: imageData.url,
			id: imageData.id,
			description: {
				name: imageData.data.name,
				alternativeText: '',
				caption: '',
			},
		})
	}

	return { updatedContent, inlineImages }
}

export function extractImagePaths(content: string): string[] {
	const standardImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
	const obsidianImageRegex = /!\[\[([^\]]+\.(png|jpe?g|gif|svg|bmp))\]\]/gi
	const imagePaths: string[] = []
	let match

	while ((match = standardImageRegex.exec(content)) !== null) {
		imagePaths.push(match[2])
	}

	while ((match = obsidianImageRegex.exec(content)) !== null) {
		imagePaths.push(match[1])
	}

	return imagePaths
}

export async function getImageBlobs(
	app: App,
	imagePaths: string[]
): Promise<ImageBlob[]> {
	const files = app.vault.getAllLoadedFiles()
	const imageFiles = imagePaths
		.map(path => files.find(file => file.name === path || file.path === path))
		.filter((file): file is TFile => file instanceof TFile)

	return await Promise.all(
		imageFiles.map(async file => {
			const blob = await app.vault.readBinary(file)
			return {
				name: file.name,
				blob: new Blob([blob], { type: 'image/png' }),
				path: file.path,
			}
		})
	)
}
