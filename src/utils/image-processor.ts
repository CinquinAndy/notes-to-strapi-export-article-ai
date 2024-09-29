import { App, MarkdownView, Notice, TFile } from 'obsidian'
import { StrapiExporterSettings, RouteConfig } from '../types/settings'
import { processFrontMatter } from './frontmatter'
import { processInlineImages } from './process-images'
import * as yaml from 'js-yaml'
import { uploadImageToStrapi } from './strapi-uploader'
import { extractFrontMatter } from './frontmatter-generator'
import { FieldConfig } from './config-analyzer'
import { ImageFieldsModal } from './ImageFieldsModal' // Adjust the path as needed

// Main function to process markdown content
export async function processMarkdownContent(
	app: App,
	settings: StrapiExporterSettings,
	routeId: string
): Promise<Record<string, any> | null> {
	console.log('--- Step 1: Initializing and validating inputs ---')

	const file = validateAndGetFile(app)
	if (!file) return null

	const { content, frontMatter } = await processFileContent(
		file,
		app,
		settings,
		routeId
	)

	const currentRoute = getCurrentRoute(settings, routeId)
	if (!currentRoute) return null

	const parsedFrontMatter = parseFrontMatter(frontMatter)
	const generatedConfig = parseGeneratedConfig(currentRoute)

	const finalContent = await processFields(
		content,
		parsedFrontMatter,
		generatedConfig,
		app,
		settings
	)

	await updateFileContent(file, app, frontMatter, content)

	console.log('--- Final content prepared ---')
	console.log(JSON.stringify(finalContent, null, 2))

	return finalContent
}

// Update these functions
function validateAndGetFile(app: App): TFile | null {
	const activeView = app.workspace.getActiveViewOfType(MarkdownView)
	if (!activeView) {
		console.error('No active Markdown view')
		return null
	}

	const file = activeView.file
	if (!file) {
		console.error('No file found in active view')
		return null
	}

	console.log('Processing file:', file.path)
	return file
}

// Process file content and handle front matter
async function processFileContent(
	file: TFile,
	app: App,
	settings: StrapiExporterSettings,
	routeId: string
): Promise<{ content: string; frontMatter: string }> {
	let content = await app.vault.read(file)
	console.log('Initial file content length:', content.length)

	let frontMatter = ''
	if (!extractFrontMatter(content)) {
		console.log('No front matter found, generating one...')
		const result = await processFrontMatter(file, app, settings, routeId)
		if (result) {
			frontMatter = result.frontMatter
			const imageFields = result.imageFields

			if (imageFields.length > 0) {
				frontMatter = await handleImageFields(
					app,
					imageFields,
					frontMatter,
					settings
				)
			}

			content = `${frontMatter}\n\n${content}`
			await app.vault.modify(file, content)
		} else {
			console.error('Failed to generate front matter')
			throw new Error('Failed to generate front matter')
		}
	}

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

	return { content, frontMatter }
}

// Handle image fields in front matter
async function handleImageFields(
	app: App,
	imageFields: string[],
	frontMatter: string,
	settings: StrapiExporterSettings
): Promise<string> {
	return new Promise<string>(resolve => {
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
				resolve(frontMatter)
			},
			settings
		).open()
	})
}

// Get the current route configuration
function getCurrentRoute(
	settings: StrapiExporterSettings,
	routeId: string
): RouteConfig | null {
	const currentRoute = settings.routes.find(route => route.id === routeId)
	if (!currentRoute) {
		console.error('Route not found')
		new Notice('Route configuration not found')
		return null
	}
	return currentRoute
}

// Parse front matter
function parseFrontMatter(frontMatter: string): Record<string, any> {
	return frontMatter ? (yaml.load(frontMatter) as Record<string, any>) : {}
}

// Parse generated configuration
function parseGeneratedConfig(currentRoute: RouteConfig): {
	fieldMappings: Record<string, FieldConfig>
	contentField: string
} {
	return JSON.parse(currentRoute.generatedConfig) as {
		fieldMappings: Record<string, FieldConfig>
		contentField: string
	}
}

// Process fields according to the generated configuration
async function processFields(
	content: string,
	parsedFrontMatter: Record<string, any>,
	generatedConfig: {
		fieldMappings: Record<string, FieldConfig>
		contentField: string
	},
	app: App,
	settings: StrapiExporterSettings
): Promise<Record<string, any>> {
	const finalContent: Record<string, any> = {}

	for (const [field, fieldConfig] of Object.entries(
		generatedConfig.fieldMappings
	)) {
		let value =
			fieldConfig.obsidianField === 'content'
				? content
				: parsedFrontMatter[fieldConfig.obsidianField.split('.')[1]]

		value = await processFieldValue(value, fieldConfig, app, settings)
		value = applyTransformation(value, fieldConfig)
		finalContent[field] = handleFieldType(value, fieldConfig.type)
	}

	// Handle the main content field
	const contentField = generatedConfig.contentField
	if (contentField && !finalContent[contentField]) {
		finalContent[contentField] = content
	}

	return finalContent
}

// Process field value (handle images)
async function processFieldValue(
	value: any,
	fieldConfig: FieldConfig,
	app: App,
	settings: StrapiExporterSettings
): Promise<any> {
	if (fieldConfig.type === 'string' && fieldConfig.format === 'url') {
		return processImageField(value, app, settings)
	} else if (
		fieldConfig.type === 'array' &&
		fieldConfig.obsidianField === 'galery'
	) {
		return processImageField(value, app, settings)
	}
	return value
}

// Apply transformation to field value
function applyTransformation(value: any, fieldConfig: FieldConfig): any {
	if (fieldConfig.transformation && fieldConfig.transformation !== 'value') {
		try {
			const transformFunc = new Function(
				'value',
				`return ${fieldConfig.transformation}`
			)
			return transformFunc(value)
		} catch (error) {
			console.error(
				`Error applying transformation for ${fieldConfig.obsidianField}:`,
				error
			)
			return value // Use the original value if transformation fails
		}
	}
	return value
}

// Handle different field types
function handleFieldType(value: any, type: string): any {
	switch (type) {
		case 'string':
			return String(value || '')
		case 'number':
			return Number(value || 0)
		case 'array':
			return Array.isArray(value) ? value : value ? [value] : []
		case 'object':
			return typeof value === 'object' ? value : {}
		default:
			return value
	}
}

// Update file content
async function updateFileContent(
	file: TFile,
	app: App,
	frontMatter: string,
	content: string
): Promise<void> {
	const updatedContent = `---\n${frontMatter}\n---\n\n${content}`
	await app.vault.modify(file, updatedContent)
}

// Process image field
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

// Transform image links in content (currently unused)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function transformImageLinks(
	content: string,
	strapiUploader: (path: string) => Promise<string>
): Promise<string> {
	const imageRegex = /!\[.*?\]\((.*?)\)/g
	let match
	let transformedContent = content

	while ((match = imageRegex.exec(content)) !== null) {
		const [fullMatch, imagePath] = match
		const strapiUrl = await strapiUploader(imagePath)
		transformedContent = transformedContent.replace(
			fullMatch,
			`![](${strapiUrl})`
		)
	}

	return transformedContent
}
