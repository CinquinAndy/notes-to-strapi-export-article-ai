import { App, MarkdownView, Notice, TFile, TFolder } from 'obsidian'
import { OpenAI } from 'openai'
import { StrapiExporterSettings } from '../types/settings'
import {
	uploadGalleryImagesToStrapi,
	uploadImagesToStrapi,
} from './strapi-uploader'
import { generateArticleContent, getImageDescription } from './openai-generator'
import { ImageBlob } from '../types/image'

/**
 * Process the markdown content
 * @param app
 * @param settings
 * @param useAdditionalCallAPI
 */
export async function processMarkdownContent(
	app: App,
	settings: StrapiExporterSettings,
	useAdditionalCallAPI = false
) {
	const activeView = app.workspace.getActiveViewOfType(MarkdownView)
	if (!activeView) {
		new Notice('No active Markdown view')
		return
	}

	/** ****************************************************************************
	 * Check if all the settings are configured
	 * *****************************************************************************
	 */
	console.log(settings)
	if (!settings.strapiUrl || !settings.strapiApiToken) {
		new Notice(
			'Please configure Strapi URL and API token in the plugin settings'
		)
		return
	}

	if (!settings.openaiApiKey) {
		new Notice('Please configure OpenAI API key in the plugin settings')
		return
	}

	if (useAdditionalCallAPI) {
		if (!settings.additionalJsonTemplate) {
			new Notice(
				'Please configure the additional call api JSON template in the plugin settings'
			)
			return
		}

		if (!settings.additionalJsonTemplateDescription) {
			new Notice(
				'Please configure the additional call api JSON template description in the plugin settings'
			)
			return
		}

		if (!settings.additionalUrl) {
			new Notice(
				'Please configure the additional call api URL in the plugin settings'
			)
			return
		}

		if (!settings.additionalContentAttributeName) {
			new Notice(
				'Please configure the additional call api content attribute name in the plugin settings'
			)
			return
		}
	} else {
		if (!settings.jsonTemplate) {
			new Notice('Please configure JSON template in the plugin settings')
			return
		}

		if (!settings.jsonTemplateDescription) {
			new Notice(
				'Please configure JSON template description in the plugin settings'
			)
			return
		}

		if (!settings.strapiArticleCreateUrl) {
			new Notice(
				'Please configure Strapi article create URL in the plugin settings'
			)
			return
		}

		if (!settings.strapiContentAttributeName) {
			new Notice(
				'Please configure Strapi content attribute name in the plugin settings'
			)
			return
		}
	}

	new Notice('All settings are ok, processing Markdown content...')

	// Initialize OpenAI API
	const openai = new OpenAI({
		apiKey: settings.openaiApiKey,
		dangerouslyAllowBrowser: true,
	})

	/** ****************************************************************************
	 * Process the markdown content
	 * *****************************************************************************
	 */
	const file = activeView.file
	let content = ''
	if (!file) {
		new Notice('No file found in active view...')
		return
	}

	/** ****************************************************************************
	 * Check if the content has any images to process
	 * *****************************************************************************
	 */
	let imageBlob: ImageBlob | null = null
	let galleryUploadedImageIds: number[] = []
	const articleFolderPath = file.parent?.path
	const imageFolderPath = `${articleFolderPath}/image`
	const galleryFolderPath = `${articleFolderPath}/gallery`
	const imageMetadataFile = `${articleFolderPath}/image/metadata.json`
	const galleryMetadataFile = `${articleFolderPath}/gallery/metadata.json`
	console.log('articleFolderPath', articleFolderPath)
	console.log('imageFolderPath', imageFolderPath)
	console.log('galleryFolderPath', galleryFolderPath)

	// Check if metadata files exist
	if (await app.vault.adapter.exists(imageMetadataFile)) {
		const imageMetadata = JSON.parse(
			await app.vault.adapter.read(imageMetadataFile)
		)
		if (Object.keys(imageMetadata).length > 0) {
			imageBlob = {
				path: imageMetadata[Object.keys(imageMetadata)[0]].data.url,
				blob: new Blob(),
				name: Object.keys(imageMetadata)[0],
				id: imageMetadata[Object.keys(imageMetadata)[0]].id,
			}
		}
	}

	if (await app.vault.adapter.exists(galleryMetadataFile)) {
		const galleryMetadata = JSON.parse(
			await app.vault.adapter.read(galleryMetadataFile)
		)
		console.log('galleryMetadata', galleryMetadata)
		if (Object.keys(galleryMetadata).length > 0) {
			galleryUploadedImageIds = Object.values(galleryMetadata).map(
				(item: any) => item.data.id
			)
		}
	}

	// If metadata doesn't exist, get image blobs and upload to Strapi
	if (!imageBlob) {
		imageBlob = await getImageBlob(app, imageFolderPath)
		if (imageBlob) {
			const imageDescription = await getImageDescription(imageBlob.blob, openai)
			const uploadedImage = await uploadImagesToStrapi(
				[{ ...imageBlob, description: imageDescription }],
				settings,
				app,
				imageFolderPath
			)
			imageBlob.path = uploadedImage[imageBlob.name].url
		}
	}

	if (galleryUploadedImageIds.length === 0) {
		const galleryImageBlobs = await getGalleryImageBlobs(app, galleryFolderPath)
		galleryUploadedImageIds = await uploadGalleryImagesToStrapi(
			galleryImageBlobs,
			settings,
			app,
			galleryFolderPath
		)
	}

	content = await app.vault.read(file)

	const flag = hasUnexportedImages(content)

	/** ****************************************************************************
	 * Process the images
	 * *****************************************************************************
	 */
	if (flag) {
		const imagePaths = extractImagePaths(content)
		const imageBlobs = await getImageBlobs(app, imagePaths)

		new Notice('Getting image descriptions...')
		const imageDescriptions = await Promise.all(
			imageBlobs.map(async imageBlob => {
				const description = await getImageDescription(imageBlob.blob, openai)
				return {
					blob: imageBlob.blob,
					name: imageBlob.name,
					path: imageBlob.path,
					description,
				}
			})
		)

		new Notice('Uploading images to Strapi...')
		const uploadedImages = await uploadImagesToStrapi(
			imageDescriptions,
			settings
		)

		new Notice('Replacing image paths...')
		content = replaceImagePaths(content, uploadedImages)
		await app.vault.modify(file, content)
		new Notice('Images uploaded and links updated successfully!')
	} else {
		new Notice(
			'No local images found in the content... Skip the image processing...'
		)
	}

	/** ****************************************************************************
	 * Generate article content
	 * *****************************************************************************
	 */
	new Notice('Generating article content...')
	const articleContent = await generateArticleContent(
		content,
		openai,
		settings,
		useAdditionalCallAPI
	)

	console.log('articleContent', articleContent)

	/** ****************************************************************************
	 * Add the content, image, and gallery to the article content based on the settings
	 * *****************************************************************************
	 */
	const imageFullPathProperty = useAdditionalCallAPI
		? settings.additionalImageFullPathProperty
		: settings.mainImageFullPathProperty
	const galleryFullPathProperty = useAdditionalCallAPI
		? settings.additionalGalleryFullPathProperty
		: settings.mainGalleryFullPathProperty

	console.log('imageFullPathProperty', imageFullPathProperty)
	console.log('galleryFullPathProperty', galleryFullPathProperty)

	console.log('imageBlob', imageBlob)
	articleContent.data = {
		...articleContent.data,
		...(imageBlob &&
			imageFullPathProperty && { [imageFullPathProperty]: imageBlob.id }),
		...(galleryUploadedImageIds.length > 0 &&
			galleryFullPathProperty && {
				[galleryFullPathProperty]: galleryUploadedImageIds,
			}),
	}

	new Notice('Article content generated successfully!')
	try {
		const response = await fetch(
			useAdditionalCallAPI
				? settings.additionalUrl
				: settings.strapiArticleCreateUrl,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${settings.strapiApiToken}`,
				},
				body: JSON.stringify(articleContent),
			}
		)

		if (response.ok) {
			new Notice(
				'Check your API content now, the article is created & uploaded! 🎉'
			)
		} else {
			new Notice('Failed to create article in Strapi.')
		}
	} catch (error) {
		new Notice('Error creating article in Strapi.')
	}
}

/**
 * Extract image paths from the markdown content
 * @param content
 */
export function extractImagePaths(content: string): string[] {
	const imageRegex = /!\[\[([^\[\]]*\.(png|jpe?g|gif|bmp|webp))\]\]/gi
	const imagePaths: string[] = []
	let match

	while ((match = imageRegex.exec(content)) !== null) {
		imagePaths.push(match[1])
	}

	return imagePaths
}

/**
 * Check if the markdown content has unexported images
 * @param content
 */
export function hasUnexportedImages(content: string): boolean {
	const imageRegex = /!\[\[([^\[\]]*\.(png|jpe?g|gif|bmp|webp))\]\]/gi
	return imageRegex.test(content)
}

/**
 * Get the image blobs from the image paths
 * @param app
 * @param imagePaths
 */
export async function getImageBlobs(
	app: App,
	imagePaths: string[]
): Promise<{ path: string; blob: Blob; name: string }[]> {
	const files = app.vault.getAllLoadedFiles()
	const fileNames = files.map(file => file.name)
	const imageFiles = imagePaths.filter(path => fileNames.includes(path))
	return await Promise.all(
		imageFiles.map(async path => {
			const file = files.find(file => file.name === path)
			if (file instanceof TFile) {
				const blob = await app.vault.readBinary(file)
				return {
					name: path,
					blob: new Blob([blob], { type: 'image/png' }),
					path: file.path,
				}
			}
			return {
				name: '',
				blob: new Blob(),
				path: '',
			}
		})
	)
}

/**
 * Get the image blob from the image path
 * @param app
 * @param imageFolderPath
 */
export async function getImageBlob(
	app: App,
	imageFolderPath: string
): Promise<{ path: string; blob: Blob; name: string } | null> {
	const folder = app.vault.getAbstractFileByPath(imageFolderPath)
	if (folder instanceof TFolder) {
		const files = folder.children.filter(
			file =>
				file instanceof TFile &&
				file.extension.match(/^(jpg|jpeg|png|gif|bmp|webp)$/i)
		)
		if (files.length > 0) {
			const file = files[0] as TFile
			const blob = await app.vault.readBinary(file)
			return {
				name: file.name,
				blob: new Blob([blob], { type: 'image/png' }),
				path: file.path,
			}
		}
	} else {
		new Notice(
			'Image folder not found. Please create an "image" folder next to your article file.'
		)
	}
	return null
}

/**
 * Get the gallery image blobs from the folder path
 * @param app
 * @param galleryFolderPath
 */
export async function getGalleryImageBlobs(
	app: App,
	galleryFolderPath: string
): Promise<{ path: string; blob: Blob; name: string }[]> {
	const folder = app.vault.getAbstractFileByPath(galleryFolderPath)
	if (folder instanceof TFolder) {
		const files = folder.children.filter(
			file =>
				file instanceof TFile &&
				file.extension.match(/^(jpg|jpeg|png|gif|bmp|webp)$/i)
		)
		return Promise.all(
			files.map(async file => {
				const blob = await app.vault.readBinary(file as TFile)
				return {
					name: file.name,
					blob: new Blob([blob], { type: 'image/png' }),
					path: file.path,
				}
			})
		)
	} else {
		new Notice(
			'Gallery folder not found. Please create a "gallery" folder next to your article file.'
		)
	}
	return []
}

/**
 * Replace the image paths in the content with the uploaded images
 * @param content
 * @param uploadedImages
 */
export function replaceImagePaths(
	content: string,
	uploadedImages: { [key: string]: { url: string; data: any } }
): string {
	for (const [localPath, imageData] of Object.entries(uploadedImages)) {
		const markdownImageRegex = new RegExp(`!\\[\\[${localPath}\\]\\]`, 'g')
		content = content.replace(
			markdownImageRegex,
			`![${imageData.data.alternativeText}](${imageData.url})`
		)
	}
	return content
}
