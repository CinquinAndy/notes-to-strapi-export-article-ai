import { App, TFile, Notice } from 'obsidian'
import { StrapiExporterSettings } from '../types/settings'
import { ImageDescription } from '../types/image'

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

export async function uploadImageToStrapi(
	imagePath: string,
	app: App,
	settings: StrapiExporterSettings
): Promise<ImageDescription | null> {
	let file = app.vault.getAbstractFileByPath(imagePath)
	if (!(file instanceof TFile)) {
		file = app.vault
			.getAllLoadedFiles()
			.find(f => f instanceof TFile && f.name === imagePath) as TFile | null
	}

	if (!(file instanceof TFile)) {
		console.error(`File not found: ${imagePath}`)
		new Notice(`Error: Image file not found: ${imagePath}`, 5000)
		return null
	}

	const imageArrayBuffer = await app.vault.readBinary(file)
	const blob = new Blob([imageArrayBuffer], { type: `image/${file.extension}` })

	const formData = new FormData()
	formData.append('files', blob, file.name)

	try {
		const response = await fetch(`${settings.strapiUrl}/api/upload`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${settings.strapiApiToken}`,
			},
			body: formData,
		})

		if (response.ok) {
			const data = await response.json()
			return {
				url: data[0].url,
				name: file.name,
				path: file.path,
				description: {
					name: file.name,
					alternativeText: file.name,
					caption: '',
				},
			}
		} else {
			const errorData = await response.json()
			new Notice(
				`Failed to upload image: ${file.name}. Error: ${errorData.error.message}`,
				5000
			)
		}
	} catch (error) {
		new Notice(
			`Error uploading image: ${file.name}. Error: ${error.message}`,
			5000
		)
	}

	return null
}

function isExternalLink(path: string): boolean {
	return path.startsWith('http://') || path.startsWith('https://')
}

function escapeRegExp(string: string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
