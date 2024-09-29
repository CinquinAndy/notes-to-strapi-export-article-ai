import { App, TFile } from 'obsidian'
import { StrapiExporterSettings, AnalyzedContent } from '../types/settings'
import { uploadImageToStrapi } from './strapi-uploader'

export async function processImages(
	content: AnalyzedContent,
	app: App,
	settings: StrapiExporterSettings
): Promise<AnalyzedContent> {
	console.log('Starting image processing')
	const processedContent = { ...content }

	for (const [key, value] of Object.entries(processedContent)) {
		if (typeof value === 'string') {
			try {
				processedContent[key] = await processImageLinks(value, app, settings)
			} catch (error) {
				console.error(`Error processing images in field ${key}:`, error)
			}
		}
	}

	console.log('Image processing complete')
	return processedContent
}

async function processImageLinks(
	content: string,
	app: App,
	settings: StrapiExporterSettings
): Promise<string> {
	const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
	let processedContent = content
	let match

	while ((match = imageRegex.exec(content)) !== null) {
		const [fullMatch, altText, imagePath] = match
		if (!imagePath.startsWith('http')) {
			const file = app.vault.getAbstractFileByPath(imagePath)
			if (file instanceof TFile) {
				try {
					const uploadedImage = await uploadImageToStrapi(
						file,
						file.name,
						settings,
						app
					)
					if (uploadedImage && uploadedImage.url) {
						processedContent = processedContent.replace(
							fullMatch,
							`![${altText}](${uploadedImage.url})`
						)
						console.log(`Uploaded and replaced image: ${file.name}`)
					}
				} catch (error) {
					console.error(`Error uploading image ${file.name}:`, error)
				}
			} else {
				console.warn(`File not found: ${imagePath}`)
			}
		}
	}

	return processedContent
}
