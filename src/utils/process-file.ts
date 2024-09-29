import { App } from 'obsidian'
import { StrapiExporterSettings, AnalyzedContent } from './types'
import { uploadImageToStrapi } from './strapi-uploader'

export async function processImages(
	content: AnalyzedContent,
	app: App,
	settings: StrapiExporterSettings
): Promise<AnalyzedContent> {
	const processedContent = { ...content }

	for (const [key, value] of Object.entries(processedContent)) {
		if (typeof value === 'string') {
			processedContent[key] = await processImageLinks(value, app, settings)
		}
	}

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
			if (file && file.extension) {
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
				}
			}
		}
	}

	return processedContent
}
