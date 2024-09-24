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
	const activeView = app.workspace.getActiveViewOfType(MarkdownView)
	if (!activeView) {
		new Notice('No active Markdown view')
		return null
	}

	const file = activeView.file
	if (!file) {
		new Notice('No file found in active view')
		return null
	}

	let content = await app.vault.read(file)
	const articleFolderPath = file.parent?.path
	const imageFolderPath = `${articleFolderPath}/image`
	const galleryFolderPath = `${articleFolderPath}/gallery`

	// Process main image
	const mainImage = await processMainImage(app, settings, imageFolderPath)

	// Process gallery images
	const galleryImages = await processGalleryImages(
		app,
		settings,
		galleryFolderPath
	)

	// Process inline images in content
	const { updatedContent, inlineImages } = await processInlineImages(
		app,
		settings,
		content
	)
	content = updatedContent

	// Modify file content if inline images were processed
	if (inlineImages.length > 0) {
		await app.vault.modify(file, content)
		new Notice('Inline images processed and content updated')
	}

	const currentRoute = settings.routes.find(route => route.id === routeId)
	if (!currentRoute) {
		new Notice('Route not found')
		return null
	}

	const generatedConfig = JSON.parse(currentRoute.generatedConfig)

	// Replace the content placeholder with actual content
	const contentFieldName = currentRoute.contentField || 'content'
	if (generatedConfig.fieldMappings[contentFieldName]) {
		generatedConfig.fieldMappings[contentFieldName].transformation =
			generatedConfig.fieldMappings[contentFieldName].transformation.replace(
				'{{ARTICLE_CONTENT}}',
				content
			)
	}

	// Process other fields according to the generated configuration
	const processedData = {}
	for (const [field, mapping] of Object.entries(
		generatedConfig.fieldMappings
	)) {
		if (field !== contentFieldName) {
			// Here you would implement the logic to extract and transform data
			// based on the mapping.obsidianField and mapping.transformation
			processedData[field] = await processField(mapping, file, app)
		}
	}

	// Add the processed content to the data
	processedData[contentFieldName] =
		generatedConfig.fieldMappings[contentFieldName].transformation

	return {
		content: processedData,
		mainImage,
		galleryImages,
		inlineImages,
	}
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
