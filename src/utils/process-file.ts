import { App, TFile } from 'obsidian'
import { StrapiExporterSettings, AnalyzedContent } from '../types'
import { uploadImageToStrapi } from './strapi-uploader'

interface ImageMatch {
	fullMatch: string
	altText: string
	imagePath: string
}

/**
 * Process images in content fields and upload them to Strapi
 */
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

/**
 * Process image links in content string
 */
async function processImageLinks(
	content: string,
	app: App,
	settings: StrapiExporterSettings
): Promise<string> {
	const imageMatches = extractImageMatches(content)

	let processedContent = content

	for (const match of imageMatches) {
		const replacedContent = await processImageMatch(
			match,
			processedContent,
			app,
			settings
		)

		if (replacedContent !== processedContent) {
			processedContent = replacedContent
		}
	}

	return processedContent
}

/**
 * Extract image matches from content
 */
function extractImageMatches(content: string): ImageMatch[] {
	const matches: ImageMatch[] = []
	const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
	let match

	while ((match = imageRegex.exec(content)) !== null) {
		matches.push({
			fullMatch: match[0],
			altText: match[1],
			imagePath: match[2],
		})
	}

	return matches
}

/**
 * Process individual image match
 */
async function processImageMatch(
	match: ImageMatch,
	content: string,
	app: App,
	settings: StrapiExporterSettings
): Promise<string> {
	if (isExternalUrl(match.imagePath)) {
		return content
	}

	const file = app.vault.getAbstractFileByPath(match.imagePath)
	if (!(file instanceof TFile)) {
		return content
	}

	const uploadedImage = await uploadImageToStrapi(
		file,
		file.name,
		settings,
		app,
		{
			alternativeText: match.altText || file.basename,
			caption: match.altText || file.basename,
		}
	)

	if (uploadedImage?.url) {
		const newContent = content.replace(
			match.fullMatch,
			`![${match.altText}](${uploadedImage.url})`
		)
		return newContent
	}

	return content
}

/**
 * Check if URL is external
 */
function isExternalUrl(url: string): boolean {
	return url.startsWith('http://') || url.startsWith('https://')
}
