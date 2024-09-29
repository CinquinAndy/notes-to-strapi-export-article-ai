import { App, MarkdownView, Notice, TFile } from 'obsidian'
import { FieldConfig, StrapiExporterSettings } from '../types/settings'
import {
	extractFrontMatter,
	generateFrontMatterWithOpenAI,
} from './frontmatter'
import { processInlineImages } from './process-images'
import * as yaml from 'js-yaml'
import { ImageFieldsModal } from './image-fields-modal'
import { uploadImageToStrapi } from './strapi-uploader'

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

	let frontMatter: string = ''
	let imageFields: string[]
	if (!extractFrontMatter(content)) {
		console.log('No front matter found, generating one...')
		const result = await generateFrontMatterWithOpenAI(
			file,
			app,
			settings,
			routeId
		)
		if (result) {
			frontMatter = result.frontMatter
			imageFields = result.imageFields

			if (imageFields.length > 0) {
				await new Promise<void>(resolve => {
					new ImageFieldsModal(
						app,
						imageFields,
						imageValues => {
							Object.entries(imageValues).forEach(([field, value]) => {
								if (value) {
									frontMatter = frontMatter.replace(
										`${field}: ""`,
										`${field}: "${value}"`
									)
								}
							})
							resolve()
						},
						settings
					).open()
				})
			}

			content = `${frontMatter}\n\n${content}`
			await app.vault.modify(file, content)
		} else {
			console.error('Failed to generate front matter')
			return null
		}
	}

	const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
	if (frontMatterMatch) {
		frontMatter = frontMatterMatch[1]
		content = frontMatterMatch[2].trim()
	}

	console.log('Content length after removing front matter:', content.length)

	// Process inline images in the main content
	let { updatedContent } = await processInlineImages(app, settings, content)
	content = updatedContent

	console.log('Updated content length:', content.length)

	// Parse front matter
	const parsedFrontMatter = frontMatter
		? (yaml.load(frontMatter) as Record<string, any>)
		: {}

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
			frontMatter = frontMatter.replace(
				new RegExp(`${field}:.*`, 'g'),
				`${field}: "${value}"`
			)
		} else if (fieldConfig.type === 'array' && field === 'galery') {
			value = await processImageField(value, app, settings)
			frontMatter = frontMatter.replace(
				new RegExp(`${field}:.*`, 'g'),
				`${field}: ${JSON.stringify(value)}`
			)
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

	updatedContent = `---\n${frontMatter}\n---\n\n${content}`
	await app.vault.modify(file, updatedContent)

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
			const file = app.vault.getAbstractFileByPath(imagePath)
			if (file instanceof TFile) {
				const uploadedImage = await uploadImageToStrapi(
					file.path,
					file.name,
					settings,
					app
				)
				return uploadedImage ? uploadedImage.url : value
			} else {
				console.error(`File not found: ${imagePath}`)
				return value
			}
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
