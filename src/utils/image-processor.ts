import { App, MarkdownView, Notice } from 'obsidian'
import { StrapiExporterSettings } from '../types/settings'
import {
	extractFrontMatter,
	generateFrontMatterWithOpenAI,
} from './frontmatter'
import { processInlineImages } from './process-images'
import * as yaml from 'js-yaml'

export async function processMarkdownContent(
	app: App,
	settings: StrapiExporterSettings,
	routeId: string
) {
	console.log('--- Step 1: Initializing and validating inputs ---')
	const activeView = app.workspace.getActiveViewOfType(MarkdownView)
	if (!activeView) {
		console.error('No active Markdown view')
		new Notice('No active Markdown view')
		return null
	}

	const file = activeView.file
	if (!file) {
		console.error('No file found in active view')
		new Notice('No file found in active view')
		return null
	}

	console.log('Processing file:', file.path)

	// Read the file content
	let content = await app.vault.read(file)
	console.log('Initial file content length:', content.length)

	// Extract or generate front matter
	let frontMatter = extractFrontMatter(content)
	if (!frontMatter) {
		console.log('Front matter not found, generating...')
		await generateFrontMatterWithOpenAI(file, app, settings, routeId)
		content = await app.vault.read(file) // Re-read the file to get the updated content
		frontMatter = extractFrontMatter(content)
	}

	// Separate content from front matter
	const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
	if (frontMatterMatch) {
		frontMatter = frontMatterMatch[1]
		content = frontMatterMatch[2].trim()
	}

	console.log('Content length after removing front matter:', content.length)

	// Process inline images in the main content
	const { updatedContent } = await processInlineImages(app, settings, content)
	content = updatedContent

	console.log('Updated content length:', content.length)

	// Parse front matter
	const parsedFrontMatter = yaml.load(frontMatter) as Record<string, any>

	// Process front matter fields
	for (const [key, value] of Object.entries(parsedFrontMatter)) {
		if (typeof value === 'string') {
			const { updatedContent } = await processInlineImages(app, settings, value)
			parsedFrontMatter[key] = updatedContent
		} else if (Array.isArray(value)) {
			parsedFrontMatter[key] = await Promise.all(
				value.map(async item => {
					if (typeof item === 'string') {
						const { updatedContent } = await processInlineImages(
							app,
							settings,
							item
						)
						return updatedContent
					}
					return item
				})
			)
		}
	}

	// Prepare the final content object
	const finalContent = {
		...parsedFrontMatter,
		content: content,
	}

	console.log('--- Final content prepared ---')
	console.log(JSON.stringify(finalContent, null, 2))

	return finalContent
}
