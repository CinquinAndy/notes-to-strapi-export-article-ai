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

	// Get the active Markdown view
	const activeView = app.workspace.getActiveViewOfType(MarkdownView)
	if (!activeView) {
		console.error('No active Markdown view')
		new Notice('No active Markdown view')
		return null
	}

	// Get the file from the active view
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

	// Check and generate front matter if necessary
	if (!extractFrontMatter(content)) {
		console.log('Front matter not found, generating...')
		await generateFrontMatterWithOpenAI(file, app, settings, routeId)
		content = await app.vault.read(file) // Re-read the file to get the updated content
		console.log('Front matter generated. New content length:', content.length)
	}

	console.log('--- Step 2: Processing images ---')
	// Process inline images
	const { updatedContent, inlineImages } = await processInlineImages(
		app,
		settings,
		content
	)
	content = updatedContent
	console.log('Inline images processed. Count:', inlineImages.length)
	console.log('Updated content length:', content.length)

	// Update the file if inline images were processed
	if (inlineImages.length > 0) {
		await app.vault.modify(file, content)
		console.log('File content updated with processed inline images')
		new Notice('Inline images processed and content updated')
	}

	console.log('--- Step 3: Preparing content for Strapi ---')
	// Find the current route configuration
	const currentRoute = settings.routes.find(route => route.id === routeId)
	if (!currentRoute) {
		console.error('Route not found:', routeId)
		new Notice('Route not found')
		return null
	}
	console.log('Using route:', currentRoute.name)

	// Parse the generated configuration
	let generatedConfig
	try {
		generatedConfig = JSON.parse(currentRoute.generatedConfig)
		console.log('Parsed generated config successfully')
	} catch (error) {
		console.error('Error parsing generatedConfig:', error)
		new Notice('Invalid configuration. Please check your route settings.')
		return null
	}

	// Process fields according to the configuration
	const contentFieldName = currentRoute.contentField || 'content'
	console.log('Content field name:', contentFieldName)

	const processedData = {}
	for (const [field, mapping] of Object.entries(
		generatedConfig.fieldMappings
	)) {
		if (field === contentFieldName) {
			processedData[field] = content
		} else {
			processedData[field] = await processField(mapping, file, app)
		}
		console.log(
			`Processed field "${field}". Length:`,
			processedData[field].length
		)
	}

	// Validate the processed data
	if (!validateProcessedData(processedData, generatedConfig.fieldMappings)) {
		console.error('Invalid processed data structure')
		new Notice('Invalid data structure. Please check your configuration.')
		return null
	}

	// Prepare the final content for Strapi
	const finalContent = { data: processedData }

	console.log('--- Final content ready for Strapi ---')
	console.log(JSON.stringify(finalContent, null, 2))

	return { content: finalContent, inlineImages }
}

// Helper function to validate processed data
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

// Process individual fields based on mapping
async function processField(mapping: any, file: TFile, app: App) {
	const { obsidianField, transformation } = mapping
	let value = ''

	if (obsidianField.startsWith('frontmatter.')) {
		const frontmatterKey = obsidianField.split('.')[1]
		const metadata = app.metadataCache.getFileCache(file)
		value = metadata?.frontmatter?.[frontmatterKey] || ''

		// TODO: Handle image links in frontmatter
		// Check if the value is an internal image link
		// If so, upload the image to Strapi and replace the link
		// Example:
		// if (isInternalImageLink(value)) {
		//     const uploadedImage = await uploadImageToStrapi(value, app, settings)
		//     value = uploadedImage.url
		// }
	} else if (obsidianField === 'title') {
		value = file.basename
	} else if (obsidianField === 'body') {
		value = await app.vault.read(file)
	}

	// Apply transformation if specified
	if (transformation) {
		// TODO: Implement more complex transformations
		if (transformation === 'uppercase') {
			value = value.toUpperCase()
		} else if (transformation === 'lowercase') {
			value = value.toLowerCase()
		}
	}

	return value
}

// TODO: Implement function to check if a value is an internal image link
// function isInternalImageLink(value: string): boolean {
//     // Implementation here
// }

// TODO: Implement function to upload an image to Strapi
// async function uploadImageToStrapi(imagePath: string, app: App, settings: StrapiExporterSettings) {
//     // Implementation here
// }

// TODO: Handle main image and gallery images
// These functions will need to be implemented to handle specific image fields
// async function processMainImage(app: App, settings: StrapiExporterSettings, imagePath: string) {
//     // Implementation here
// }

// async function processGalleryImages(app: App, settings: StrapiExporterSettings, galleryPath: string) {
//     // Implementation here
// }
