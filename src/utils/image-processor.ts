import { App, MarkdownView, Notice, TFile } from 'obsidian'
import { StrapiExporterSettings } from '../types/settings'
import {
	extractFrontMatter,
	generateFrontMatterWithOpenAI,
} from './frontmatter'
import { processInlineImages } from './process-images'

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

	// Check if front matter exists, if not, generate it
	let content = await app.vault.read(file)
	console.log('File content length:', content.length)
	console.log('File content:', content)
	if (!extractFrontMatter(content)) {
		console.log('Front matter not found, generating...')
		await generateFrontMatterWithOpenAI(file, app, settings, routeId)
		content = await app.vault.read(file) // Re-read the file to get the updated content
	}

	console.log('Initial content length:', content.length)

	console.log('--- Step 2: Processing images ---')
	console.log('Processing inline images')
	const { updatedContent, inlineImages } = await processInlineImages(
		app,
		settings,
		content
	)
	content = updatedContent
	console.log('Inline images processed:', inlineImages)
	console.log('Updated content length:', content.length)

	if (inlineImages.length > 0) {
		await app.vault.modify(file, content)
		console.log('File content updated with processed inline images')
		new Notice('Inline images processed and content updated')
	}

	console.log('--- Step 3: Preparing content for Strapi ---')
	const currentRoute = settings.routes.find(route => route.id === routeId)
	if (!currentRoute) {
		console.error('Route not found:', routeId)
		new Notice('Route not found')
		return null
	}
	console.log('Using route:', currentRoute.name)

	let generatedConfig
	try {
		generatedConfig = JSON.parse(currentRoute.generatedConfig)
		console.log('Parsed generated config:', generatedConfig)
	} catch (error) {
		console.error('Error parsing generatedConfig:', error)
		new Notice('Invalid configuration. Please check your route settings.')
		return null
	}

	const contentFieldName = currentRoute.contentField || 'content'
	console.log('Content field name:', contentFieldName)

	if (generatedConfig.fieldMappings[contentFieldName]) {
		generatedConfig.fieldMappings[contentFieldName].transformation =
			generatedConfig.fieldMappings[contentFieldName].transformation.replace(
				'{{ARTICLE_CONTENT}}',
				content
			)
		console.log('Content placeholder replaced in field mapping')
	}

	const processedData = {}
	for (const [field, mapping] of Object.entries(
		generatedConfig.fieldMappings
	)) {
		if (field !== contentFieldName) {
			processedData[field] = await processField(mapping, file, app)
			console.log(`Processed field "${field}":`, processedData[field])
		}
	}

	processedData[contentFieldName] =
		generatedConfig.fieldMappings[contentFieldName].transformation
	console.log(
		`Processed content field "${contentFieldName}" (length):`,
		processedData[contentFieldName].length
	)

	if (!validateProcessedData(processedData, generatedConfig.fieldMappings)) {
		console.error('Invalid processed data structure')
		new Notice('Invalid data structure. Please check your configuration.')
		return null
	}

	const finalContent = {
		data: {
			...processedData,
		},
	}

	console.log('--- Final content ready for Strapi ---')
	console.log(JSON.stringify(finalContent, null, 2))

	return {
		content: finalContent,
		inlineImages,
	}
}

function validateProcessedData(data: any, fieldMappings: any): boolean {
	for (const field in fieldMappings) {
		if (!(field in data)) {
			console.error(`Missing field in processed data: ${field}`)
			return false
		}
	}
	console.log('Processed data validated successfully')
	return true
}

async function processField(mapping: any, file: TFile, app: App) {
	const { obsidianField, transformation } = mapping
	let value = ''

	if (obsidianField.startsWith('frontmatter.')) {
		const frontmatterKey = obsidianField.split('.')[1]
		const metadata = app.metadataCache.getFileCache(file)
		value = metadata?.frontmatter?.[frontmatterKey] || ''
	} else if (obsidianField === 'title') {
		value = file.basename
	} else if (obsidianField === 'body') {
		value = await app.vault.read(file)
	}

	// Apply transformation if specified
	if (transformation) {
		// Here you can implement various transformation logic
		// For example:
		if (transformation === 'uppercase') {
			value = value.toUpperCase()
		} else if (transformation === 'lowercase') {
			value = value.toLowerCase()
		}
		// Add more transformations as needed
	}

	return value
}
