import { App, MarkdownView, Notice } from 'obsidian'
import { FieldConfig, StrapiExporterSettings } from '../types/settings'
import { extractFrontMatter } from './frontmatter'
import { processInlineImages, uploadImageToStrapi } from './process-images'
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

	// Extract front matter
	let frontMatter = extractFrontMatter(content)
	if (!frontMatter) {
		console.error('No front matter found')
		new Notice('No front matter found')
		return null
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

	// Get the current route configuration
	const currentRoute = settings.routes.find(route => route.id === routeId)
	if (!currentRoute) {
		console.error('Route not found')
		new Notice('Route configuration not found')
		return null
	}

	// Parse the generated configuration
	const generatedConfig = JSON.parse(currentRoute.generatedConfig) as {
		fieldMappings: Record<string, FieldConfig>
		contentField: string
	}

	// Prepare the final content object
	const finalContent: Record<string, any> = {}

	// Process each field according to the generated configuration
	for (const [field, fieldConfig] of Object.entries(
		generatedConfig.fieldMappings
	)) {
		const obsidianField = fieldConfig.obsidianField
		let value =
			obsidianField === 'content'
				? content
				: parsedFrontMatter[obsidianField.split('.')[1]]

		// Process images in fields
		if (fieldConfig.type === 'string' && fieldConfig.format === 'url') {
			value = await processImageField(value, app, settings)
		} else if (fieldConfig.type === 'array' && field === 'galery') {
			value = await processImageField(value, app, settings)
		}

		// Apply transformation if specified
		if (fieldConfig.transformation && fieldConfig.transformation !== 'value') {
			try {
				const transformFunc = new Function(
					'value',
					`return ${fieldConfig.transformation}`
				)
				value = transformFunc(value)
			} catch (error) {
				console.error(`Error applying transformation for ${field}:`, error)
				// Use the original value if transformation fails
			}
		}

		// Handle different field types
		switch (fieldConfig.type) {
			case 'string':
				finalContent[field] = String(value || '')
				break
			case 'number':
				finalContent[field] = Number(value || 0)
				break
			case 'array':
				finalContent[field] = Array.isArray(value)
					? value
					: value
						? [value]
						: []
				break
			case 'object':
				finalContent[field] = typeof value === 'object' ? value : {}
				break
			default:
				finalContent[field] = value
		}
	}

	// Handle the main content field
	const contentField = generatedConfig.contentField
	if (contentField && !finalContent[contentField]) {
		finalContent[contentField] = content
	}

	console.log('--- Final content prepared ---')
	console.log(JSON.stringify(finalContent, null, 2))

	return finalContent
}

async function processImageField(
	value: any,
	app: App,
	settings: StrapiExporterSettings
): Promise<any> {
	if (typeof value === 'string') {
		if (value.startsWith('![[') && value.endsWith(']]')) {
			const imagePath = value.slice(3, -2)
			const uploadedImage = await uploadImageToStrapi(imagePath, app, settings)
			return uploadedImage ? uploadedImage.url : value
		} else if (value.startsWith('http')) {
			return value // Keep external URLs as they are
		}
	} else if (Array.isArray(value)) {
		return Promise.all(
			value.map(item => processImageField(item, app, settings))
		)
	}
	return value
}
