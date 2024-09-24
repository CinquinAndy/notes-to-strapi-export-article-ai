import { App, MarkdownView, Notice, TFile, Modal } from 'obsidian'
import { StrapiExporterSettings } from '../types/settings'
import {
	extractFrontMatter,
	generateFrontMatterWithOpenAI,
} from './frontmatter'
import { processInlineImages, uploadImageToStrapi } from './process-images'

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

	let content = await app.vault.read(file)
	console.log('Initial file content length:', content.length)

	if (!extractFrontMatter(content)) {
		console.log('Front matter not found, generating...')
		await generateFrontMatterWithOpenAI(file, app, settings, routeId)
		content = await app.vault.read(file)
		console.log('Front matter generated. New content length:', content.length)
	}

	console.log('--- Step 2: Processing images ---')
	const { updatedContent, inlineImages } = await processInlineImages(
		app,
		settings,
		content
	)
	content = updatedContent
	console.log('Inline images processed. Count:', inlineImages.length)
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
		console.log('Parsed generated config successfully')
	} catch (error) {
		console.error('Error parsing generatedConfig:', error)
		new Notice('Invalid configuration. Please check your route settings.')
		return null
	}

	const contentFieldName = currentRoute.contentField || 'content'
	console.log('Content field name:', contentFieldName)

	const processedData = {}
	for (const [field, mapping] of Object.entries(
		generatedConfig.fieldMappings
	)) {
		if (field === contentFieldName) {
			processedData[field] = content
		} else {
			processedData[field] = await processField(mapping, file, app, settings)
		}
		console.log(
			`Processed field "${field}". Length:`,
			processedData[field].length
		)
	}

	if (!validateProcessedData(processedData, generatedConfig.fieldMappings)) {
		console.error('Invalid processed data structure')
		new Notice('Invalid data structure. Please check your configuration.')
		return null
	}

	const finalContent = { data: processedData }

	console.log('--- Final content ready for Strapi ---')
	console.log(JSON.stringify(finalContent, null, 2))

	// User confirmation before sending to Strapi
	const userConfirmed = await new Promise(resolve => {
		new ConfirmationModal(
			app,
			'Send to Strapi?',
			'Do you want to send this article to Strapi?',
			resolve
		).open()
	})

	if (userConfirmed) {
		return { content: finalContent, inlineImages }
	} else {
		console.log('User cancelled sending to Strapi')
		new Notice('Sending to Strapi cancelled')
		return null
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

async function processField(
	mapping: any,
	file: TFile,
	app: App,
	settings: StrapiExporterSettings
) {
	const { obsidianField, transformation } = mapping
	let value = ''

	if (obsidianField.startsWith('frontmatter.')) {
		const frontmatterKey = obsidianField.split('.')[1]
		const metadata = app.metadataCache.getFileCache(file)
		value = metadata?.frontmatter?.[frontmatterKey] || ''

		if (isInternalImageLink(value)) {
			console.log(
				`Processing internal image link in frontmatter field: ${frontmatterKey}`
			)
			const uploadedImage = await uploadImageToStrapi(value, app, settings)
			value = uploadedImage?.url || ''
			console.log(`Image uploaded and link replaced: ${value}`)
		} else if (
			Array.isArray(value) &&
			value.every(item => isInternalImageLink(item))
		) {
			console.log(`Processing gallery in frontmatter field: ${frontmatterKey}`)
			const uploadedImages = await Promise.all(
				value.map(imagePath => uploadImageToStrapi(imagePath, app, settings))
			)
			value = uploadedImages.map(img => img?.url).toString()
			console.log(`Gallery images uploaded and links replaced`)
		}
	} else if (obsidianField === 'title') {
		value = file.basename
	} else if (obsidianField === 'body') {
		value = await app.vault.read(file)
	}

	if (transformation) {
		if (transformation === 'uppercase') {
			value = value.toUpperCase()
		} else if (transformation === 'lowercase') {
			value = value.toLowerCase()
		}
		// Add more transformations as needed
	}

	return value
}

function isInternalImageLink(value: string): boolean {
	return (
		typeof value === 'string' && value.startsWith('![[') && value.endsWith(']]')
	)
}

class ConfirmationModal extends Modal {
	constructor(
		app: App,
		title: string,
		message: string,
		private onChoice: (choice: boolean) => void
	) {
		super(app)
		this.titleEl.setText(title)
		this.contentEl.setText(message)
	}

	onOpen() {
		const buttonContainer = this.contentEl.createDiv('button-container')

		const confirmButton = buttonContainer.createEl('button', {
			text: 'Confirm',
		})
		confirmButton.addEventListener('click', () => {
			this.onChoice(true)
			this.close()
		})

		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' })
		cancelButton.addEventListener('click', () => {
			this.onChoice(false)
			this.close()
		})
	}
}
