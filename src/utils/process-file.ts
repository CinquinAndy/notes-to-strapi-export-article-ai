import { App, TFile } from 'obsidian'
import { StrapiExporterSettings, AnalyzedContent } from '../types'
import { uploadImageToStrapi } from './strapi-uploader'

/**
 * Types for link detection and processing
 */
interface LinkMatch {
	type: 'link'
	fullMatch: string
	text: string
	url: string
}

interface ImageMatch {
	type: 'image'
	fullMatch: string
	altText: string
	path: string
	isWikiLink: boolean
}

export function extractLinks(content: string): (LinkMatch | ImageMatch)[] {
	const matches: (LinkMatch | ImageMatch)[] = []

	// Regular expressions for different link types
	const patterns = {
		wikiImage: /!\[\[([^\]]+\.(png|jpe?g|gif|svg|bmp|webp))\]\]/gi,
		markdownImage: /!\[([^\]]*)\]\(([^)]+\.(png|jpe?g|gif|svg|bmp|webp))\)/gi,
		standardLink: /(?<!!)\[([^\]]+)\]\(([^)]+)\)/gi, // Negative lookbehind to exclude image links
		pastedImage: /\[\[Pasted image [0-9-]+\.png\]\]/gi,
	}

	// Process Wiki-style image links
	let match
	while ((match = patterns.wikiImage.exec(content)) !== null) {
		matches.push({
			type: 'image',
			fullMatch: match[0],
			altText: match[1].split('|')[1] || match[1].split('/').pop() || '',
			path: match[1].split('|')[0],
			isWikiLink: true,
		})
	}

	// Process Markdown-style image links
	while ((match = patterns.markdownImage.exec(content)) !== null) {
		matches.push({
			type: 'image',
			fullMatch: match[0],
			altText: match[1],
			path: match[2],
			isWikiLink: false,
		})
	}

	// Process pasted images
	while ((match = patterns.pastedImage.exec(content)) !== null) {
		matches.push({
			type: 'image',
			fullMatch: match[0],
			altText: 'Pasted image',
			path: match[0].slice(2, -2), // Remove [[ and ]]
			isWikiLink: true,
		})
	}

	// Process standard links (non-image)
	while ((match = patterns.standardLink.exec(content)) !== null) {
		matches.push({
			type: 'link',
			fullMatch: match[0],
			text: match[1],
			url: match[2],
		})
	}

	return matches
}

/**
 * Process identified links and images
 */
export async function processContentLinks(
	content: string,
	app: App,
	settings: StrapiExporterSettings
): Promise<string> {
	let processedContent = content
	const matches = extractLinks(content)

	for (const match of matches) {
		if (match.type === 'image') {
			const processedImage = await processImageMatch(match, app, settings)
			if (processedImage) {
				processedContent = processedContent.replace(
					match.fullMatch,
					processedImage
				)
			}
		}
		// Standard links are left unchanged
	}

	return processedContent
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
			// Process all links and images in the content
			processedContent[key] = await processContentLinks(value, app, settings)
		}
	}

	return processedContent
}

/**
 * Process individual image match
 */
async function processImageMatch(
	match: ImageMatch,
	app: App,
	settings: StrapiExporterSettings
): Promise<string | null> {
	// Skip external URLs
	if (isExternalUrl(match.path)) {
		return null
	}

	const file = app.vault.getAbstractFileByPath(match.path)
	if (!(file instanceof TFile)) {
		return null
	}

	try {
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
			return `![${match.altText}](${uploadedImage.url})`
		}
	} catch (error) {
		console.error(`Failed to process image ${match.path}:`, error)
	}

	return null
}

function isExternalUrl(url: string): boolean {
	return url.startsWith('http://') || url.startsWith('https://')
}
