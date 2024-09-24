import { App, MarkdownView, Notice, TFile, TFolder } from 'obsidian'
import { StrapiExporterSettings } from '../types/settings'
import {
	uploadImagesToStrapi,
	uploadGalleryImagesToStrapi,
} from './strapi-uploader'
import { ImageBlob, ImageDescription } from '../types/image'

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
	console.log('Initial content length:', content.length)

	const articleFolderPath = file.parent?.path
	const imageFolderPath = `${articleFolderPath}/image`
	const galleryFolderPath = `${articleFolderPath}/gallery`

	console.log('--- Step 2: Processing images ---')
	console.log('Processing main image from:', imageFolderPath)
	const mainImage = await processMainImage(app, settings, imageFolderPath)
	console.log('Main image processed:', mainImage)

	console.log('Processing gallery images from:', galleryFolderPath)
	const galleryImages = await processGalleryImages(
		app,
		settings,
		galleryFolderPath
	)
	console.log('Gallery images processed:', galleryImages)

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
			...(mainImage && {
				[currentRoute.imageProperty || 'image']: mainImage.id,
			}),
			...(galleryImages.length > 0 && {
				[currentRoute.galleryProperty || 'gallery']: galleryImages.map(
					img => img.id
				),
			}),
		},
	}

	console.log('--- Final content ready for Strapi ---')
	console.log(JSON.stringify(finalContent, null, 2))

	return {
		content: finalContent,
		mainImage,
		galleryImages,
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

async function processMainImage(
	app: App,
	settings: StrapiExporterSettings,
	imageFolderPath: string
): Promise<ImageDescription | null> {
	const imageBlob = await getImageBlob(app, imageFolderPath)
	if (imageBlob) {
		const imageDescription: ImageDescription = {
			...imageBlob,
			description: {
				name: imageBlob.name,
				alternativeText: '', // You might want to generate this based on the image content
				caption: '', // You might want to generate this based on the image content
			},
		}
		const uploadedImages = await uploadImagesToStrapi(
			[imageDescription],
			settings,
			app,
			imageFolderPath
		)
		const uploadedImage = uploadedImages[imageBlob.name]
		return {
			...imageDescription,
			path: uploadedImage.url,
			id: uploadedImage.id,
		}
	}
	return null
}

async function processGalleryImages(
	app: App,
	settings: StrapiExporterSettings,
	galleryFolderPath: string
): Promise<ImageDescription[]> {
	const galleryImageBlobs = await getGalleryImageBlobs(app, galleryFolderPath)
	const galleryImageDescriptions: ImageDescription[] = galleryImageBlobs.map(
		blob => ({
			...blob,
			description: {
				name: blob.name,
				alternativeText: '',
				caption: '',
			},
		})
	)
	return await uploadGalleryImagesToStrapi(
		galleryImageDescriptions,
		settings,
		app,
		galleryFolderPath
	)
}

async function processInlineImages(
	app: App,
	settings: StrapiExporterSettings,
	content: string
): Promise<{ updatedContent: string; inlineImages: ImageDescription[] }> {
	const imagePaths = extractImagePaths(content)
	const imageBlobs = await getImageBlobs(app, imagePaths)
	const imageDescriptions: ImageDescription[] = imageBlobs.map(blob => ({
		...blob,
		description: {
			name: blob.name,
			alternativeText: '',
			caption: '',
		},
	}))
	const uploadedImages = await uploadImagesToStrapi(imageDescriptions, settings)

	let updatedContent = content
	const inlineImages: ImageDescription[] = []

	for (const [localPath, imageData] of Object.entries(uploadedImages)) {
		const markdownImageRegex = new RegExp(
			`!\\[([^\\]]*)]\\(${localPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`,
			'g'
		)
		updatedContent = updatedContent.replace(
			markdownImageRegex,
			(match, capturedAltText) => `![${capturedAltText}](${imageData.url})`
		)

		inlineImages.push({
			name: imageData.data.name,
			blob: new Blob(),
			path: imageData.url,
			id: imageData.id,
			description: {
				name: imageData.data.name,
				alternativeText: '',
				caption: '',
			},
		})
	}

	return { updatedContent, inlineImages }
}

export function extractImagePaths(content: string): string[] {
	const imageRegex = /!\[\[([^\[\]]*\.(png|jpe?g|gif|bmp|webp))\]\]/gi
	const imagePaths: string[] = []
	let match

	while ((match = imageRegex.exec(content)) !== null) {
		imagePaths.push(match[1])
	}

	return imagePaths
}

// Update getImageBlob to return ImageBlob
async function getImageBlob(
	app: App,
	imageFolderPath: string
): Promise<ImageBlob | null> {
	const folder = app.vault.getAbstractFileByPath(imageFolderPath)
	if (folder instanceof TFolder) {
		const files = folder.children.filter(
			file =>
				file instanceof TFile &&
				file.extension.match(/^(jpg|jpeg|png|gif|bmp|webp)$/i)
		)
		if (files.length > 0 && files[0] instanceof TFile) {
			const file = files[0]
			const blob = await app.vault.readBinary(file)
			return {
				name: file.name,
				blob: new Blob([blob], { type: 'image/png' }),
				path: file.path,
			}
		}
	}
	return null
}

export async function getGalleryImageBlobs(
	app: App,
	galleryFolderPath: string
): Promise<ImageBlob[]> {
	const folder = app.vault.getAbstractFileByPath(galleryFolderPath)
	if (folder instanceof TFolder) {
		const files = folder.children.filter(
			file =>
				file instanceof TFile &&
				file.extension.match(/^(jpg|jpeg|png|gif|bmp|webp)$/i)
		)
		return Promise.all(
			files.map(async file => {
				if (file instanceof TFile) {
					const blob = await app.vault.readBinary(file)
					return {
						name: file.name,
						blob: new Blob([blob], { type: 'image/png' }),
						path: file.path,
					}
				}
				return null
			})
		).then(results =>
			results.filter((result): result is ImageBlob => result !== null)
		)
	}
	return []
}

export async function getImageBlobs(
	app: App,
	imagePaths: string[]
): Promise<ImageBlob[]> {
	const files = app.vault.getAllLoadedFiles()
	const imageFiles = imagePaths
		.map(path => files.find(file => file.name === path))
		.filter((file): file is TFile => file instanceof TFile)

	return await Promise.all(
		imageFiles.map(async file => {
			const blob = await app.vault.readBinary(file)
			return {
				name: file.name,
				blob: new Blob([blob], { type: 'image/png' }),
				path: file.path,
			}
		})
	)
}
