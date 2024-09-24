import { App, MarkdownView, Notice, TFile, TFolder } from 'obsidian'
import { StrapiExporterSettings } from '../types/settings'
import {
	uploadImagesToStrapi,
	uploadGalleryImagesToStrapi,
} from './strapi-uploader'
import { ImageBlob } from '../types/image'

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

	// Replace content placeholder with actual content
	const contentPlaceholder =
		currentRoute.contentPlaceholder || '{{PasteContentOfTheActualArticleHere}}'
	const finalContent = currentRoute.generatedConfig.replace(
		contentPlaceholder,
		content
	)

	return {
		content: finalContent,
		mainImage,
		galleryImages,
		inlineImages,
	}
}

async function processMainImage(
	app: App,
	settings: StrapiExporterSettings,
	imageFolderPath: string
): Promise<ImageBlob | null> {
	const imageBlob = await getImageBlob(app, imageFolderPath)
	if (imageBlob) {
		const uploadedImage: any = await uploadImagesToStrapi(
			[imageBlob],
			settings,
			app,
			imageFolderPath
		)
		return {
			...imageBlob,
			path: uploadedImage[imageBlob.name].url,
			id: uploadedImage[imageBlob.name].id,
		}
	}
	return null
}

async function processGalleryImages(
	app: App,
	settings: StrapiExporterSettings,
	galleryFolderPath: string
): Promise<number[]> {
	const galleryImageBlobs = await getGalleryImageBlobs(app, galleryFolderPath)
	return await uploadGalleryImagesToStrapi(
		galleryImageBlobs,
		settings,
		app,
		galleryFolderPath
	)
}

async function processInlineImages(
	app: App,
	settings: StrapiExporterSettings,
	content: string
): Promise<{ updatedContent: string; inlineImages: ImageBlob[] }> {
	const imagePaths = extractImagePaths(content)
	const imageBlobs = await getImageBlobs(app, imagePaths)
	const uploadedImages = await uploadImagesToStrapi(imageBlobs, settings)

	let updatedContent = content
	for (const [localPath, imageData] of Object.entries(uploadedImages)) {
		const markdownImageRegex = new RegExp(`!\\[\\[${localPath}\\]\\]`, 'g')
		updatedContent = updatedContent.replace(
			markdownImageRegex,
			`![](${imageData.url})`
		)
	}

	return {
		updatedContent,
		inlineImages: Object.values(uploadedImages).map(img => ({
			path: img.url,
			blob: new Blob(),
			name: img.data.name,
			id: img.data.id,
		})),
	}
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

export async function getImageBlob(
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
