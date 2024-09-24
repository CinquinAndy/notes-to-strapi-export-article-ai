import { App, TFile, Notice } from 'obsidian'
import { StrapiExporterSettings } from '../types/settings'
import { ImageBlob, ImageDescription } from '../types/image'

export async function processInlineImages(
	app: App,
	settings: StrapiExporterSettings,
	content: string
): Promise<{ updatedContent: string; inlineImages: ImageDescription[] }> {
	const imagePaths = extractImagePaths(content)
	const inlineImages: ImageDescription[] = []

	let updatedContent = content

	for (const imagePath of imagePaths) {
		const uploadedImage = await uploadImageToStrapi(imagePath, app, settings)
		if (uploadedImage) {
			inlineImages.push(uploadedImage)

			// Replace Obsidian internal links
			const obsidianLinkRegex = new RegExp(`!\\[\\[${imagePath}\\]\\]`, 'g')
			updatedContent = updatedContent.replace(
				obsidianLinkRegex,
				`![${uploadedImage.name}](${uploadedImage.url})`
			)

			// Replace standard Markdown image links
			const markdownLinkRegex = new RegExp(
				`!\\[([^\\]]*)\\]\\(${imagePath}\\)`,
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
	const obsidianImageRegex = /!\[\[([^\]]+\.(png|jpe?g|gif|svg|bmp))\]\]/gi
	const markdownImageRegex =
		/!\[([^\]]*)\]\(([^)]+\.(png|jpe?g|gif|svg|bmp))\)/gi
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
	const file = app.vault.getAbstractFileByPath(imagePath)
	if (!(file instanceof TFile)) {
		console.error(`File not found: ${imagePath}`)
		return null
	}

	const imageArrayBuffer = await app.vault.readBinary(file)
	const blob = new Blob([imageArrayBuffer], { type: `image/${file.extension}` })

	const imageDescription: ImageDescription = {
		name: file.name,
		blob: blob,
		path: file.path,
		description: {
			name: file.name,
			alternativeText: file.name,
			caption: '',
		},
	}

	const formData = new FormData()
	formData.append('files', blob, file.name)
	formData.append(
		'fileInfo',
		JSON.stringify({
			name: imageDescription.description.name,
			alternativeText: imageDescription.description.alternativeText,
			caption: imageDescription.description.caption,
		})
	)

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
				...imageDescription,
				url: data[0].url,
				id: data[0].id,
			}
		} else {
			const errorData = await response.json()
			new Notice(
				`Failed to upload image: ${file.name}. Error: ${errorData.error.message}`
			)
		}
	} catch (error) {
		new Notice(`Error uploading image: ${file.name}. Error: ${error.message}`)
	}

	return null
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
