import { App, Notice, TAbstractFile, TFile } from 'obsidian'
import { StrapiExporterSettings, ImageDescription } from '../types'
import { Logger } from './logger'

interface UploadResponse {
	url: string
	id: number
	name: string
	alternativeText?: string
	caption?: string
}

/**
 * Upload single image to Strapi
 */
export async function uploadImageToStrapi(
	imageData: string | TFile,
	fileName: string,
	settings: StrapiExporterSettings,
	app: App,
	additionalMetadata?: {
		alternativeText?: string
		caption?: string
	}
): Promise<ImageDescription | null> {
	Logger.info('StrapiUploader', '257. Starting image upload', {
		fileName,
		hasMetadata: !!additionalMetadata,
	})

	try {
		// Validate settings
		validateStrapiSettings(settings)

		// Get file
		const file = await getFileFromImageData(imageData, fileName, app)
		if (!file) {
			return null
		}

		// Prepare form data
		const formData = await prepareFormData(file, fileName, additionalMetadata)

		// Upload to Strapi
		const uploadResult = await performStrapiUpload(formData, settings)

		if (uploadResult) {
			Logger.info('StrapiUploader', '258. Image upload successful')
			return createImageDescription(uploadResult, fileName, additionalMetadata)
		}

		return null
	} catch (error) {
		Logger.error('StrapiUploader', '259. Image upload failed', error)
		throw error
	}
}

/**
 * Upload multiple images to Strapi
 */
export async function uploadImagesToStrapi(
	imageDescriptions: ImageDescription[],
	settings: StrapiExporterSettings,
	app: App | null = null,
	imageFolderPath: string = ''
): Promise<{ [key: string]: { url: string; data: any; id: number } }> {
	Logger.info('StrapiUploader', '260. Starting batch image upload', {
		imageCount: imageDescriptions.length,
	})

	const uploadedImages: {
		[key: string]: { url: string; data: any; id: number }
	} = {}

	try {
		validateStrapiSettings(settings)

		for (const imageDescription of imageDescriptions) {
			try {
				Logger.debug(
					'StrapiUploader',
					`261. Processing image: ${imageDescription.name}`
				)
				const formData = await prepareImageDescriptionFormData(imageDescription)
				const uploadResult = await performStrapiUpload(formData, settings)

				if (uploadResult) {
					uploadedImages[imageDescription.name || ''] = {
						url: uploadResult.url,
						data: uploadResult,
						id: uploadResult.id,
					}
					Logger.debug('StrapiUploader', '262. Image uploaded successfully')
				}
			} catch (error) {
				Logger.error(
					'StrapiUploader',
					`263. Error uploading image: ${imageDescription.name}`,
					error
				)
				handleUploadError(error, imageDescription.name)
			}
		}

		// Save metadata if needed
		if (imageFolderPath && app && Object.keys(uploadedImages).length > 0) {
			await saveMetadataToFile(uploadedImages, imageFolderPath, app)
		}

		Logger.info('StrapiUploader', '264. Batch upload completed', {
			successCount: Object.keys(uploadedImages).length,
		})
		return uploadedImages
	} catch (error) {
		Logger.error('StrapiUploader', '265. Batch upload failed', error)
		throw error
	}
}

/**
 * Upload gallery images to Strapi
 */
export async function uploadGalleryImagesToStrapi(
	imageDescriptions: ImageDescription[],
	settings: StrapiExporterSettings,
	app: App | null = null,
	galleryFolderPath: string = ''
): Promise<ImageDescription[]> {
	Logger.info('StrapiUploader', '266. Starting gallery upload', {
		imageCount: imageDescriptions.length,
	})

	const uploadedImages: ImageDescription[] = []

	try {
		validateStrapiSettings(settings)

		for (const imageDescription of imageDescriptions) {
			try {
				const formData = await prepareImageDescriptionFormData(imageDescription)
				const uploadResult = await performStrapiUpload(formData, settings)

				if (uploadResult) {
					const processedImage = processGalleryUploadResult(
						imageDescription,
						uploadResult
					)
					uploadedImages.push(processedImage)
					Logger.debug(
						'StrapiUploader',
						'267. Gallery image uploaded successfully'
					)
				}
			} catch (error) {
				Logger.error(
					'StrapiUploader',
					`268. Error uploading gallery image: ${imageDescription.name}`,
					error
				)
				handleUploadError(error, imageDescription.name, true)
			}
		}

		// Save metadata if needed
		if (galleryFolderPath && app && uploadedImages.length > 0) {
			await saveGalleryMetadata(uploadedImages, galleryFolderPath, app)
		}

		Logger.info('StrapiUploader', '269. Gallery upload completed', {
			successCount: uploadedImages.length,
		})
		return uploadedImages
	} catch (error) {
		Logger.error('StrapiUploader', '270. Gallery upload failed', error)
		throw error
	}
}

// Helper functions

async function getFileFromImageData(
	imageData: string | TFile,
	fileName: string,
	app: App
): Promise<TFile | null> {
	Logger.debug('StrapiUploader', '271. Getting file from image data')

	let file: TAbstractFile | null = null
	if (typeof imageData === 'string') {
		file = app.vault.getAbstractFileByPath(imageData)
	} else if (imageData instanceof TFile) {
		file = imageData
	}

	if (!(file instanceof TFile)) {
		Logger.error('StrapiUploader', '272. Invalid file')
		new Notice(`Failed to find file: ${fileName}`)
		return null
	}

	return file
}

async function prepareFormData(
	file: TFile,
	fileName: string,
	metadata?: { alternativeText?: string; caption?: string }
): Promise<FormData> {
	Logger.debug('StrapiUploader', '273. Preparing form data')

	const formData = new FormData()
	const arrayBuffer = await file.vault.readBinary(file)
	const blob = new Blob([arrayBuffer], { type: `image/${file.extension}` })
	formData.append('files', blob, fileName)

	if (metadata) {
		formData.append(
			'fileInfo',
			JSON.stringify({
				name: fileName,
				alternativeText: metadata.alternativeText,
				caption: metadata.caption,
			})
		)
	}

	return formData
}

async function performStrapiUpload(
	formData: FormData,
	settings: StrapiExporterSettings
): Promise<UploadResponse | null> {
	Logger.debug('StrapiUploader', '274. Performing Strapi upload')

	const response = await fetch(`${settings.strapiUrl}/api/upload`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${settings.strapiApiToken}`,
		},
		body: formData,
	})

	if (!response.ok) {
		const errorData = await response.json()
		throw new Error(errorData.error.message)
	}

	const data = await response.json()
	return data[0]
}

function validateStrapiSettings(settings: StrapiExporterSettings): void {
	Logger.debug('StrapiUploader', '275. Validating Strapi settings')

	if (!settings.strapiUrl) {
		throw new Error('Strapi URL is not configured')
	}
	if (!settings.strapiApiToken) {
		throw new Error('Strapi API token is not configured')
	}
}

function handleUploadError(
	error: Error | unknown,
	fileName: string | undefined,
	isGallery = false
): void {
	const prefix = isGallery ? 'gallery ' : ''
	const name = fileName || 'unknown'
	Logger.error(
		'StrapiUploader',
		`Error uploading ${prefix}image: ${name}`,
		error
	)
	const errorMessage = error instanceof Error ? error.message : 'Unknown error'
	new Notice(`Error uploading ${prefix}image: ${name}. ${errorMessage}`)
}

async function saveMetadataToFile(
	data: any,
	folderPath: string,
	app: App
): Promise<void> {
	Logger.debug('StrapiUploader', '277. Saving metadata to file')
	const metadataFile = `${folderPath}/metadata.json`
	await app.vault.adapter.write(metadataFile, JSON.stringify(data, null, 2))
}

function createImageDescription(
	uploadResult: UploadResponse,
	fileName: string,
	metadata?: { alternativeText?: string; caption?: string }
): ImageDescription {
	return {
		url: uploadResult.url,
		name: fileName,
		path: uploadResult.url,
		id: uploadResult.id,
		description: {
			name: uploadResult.name,
			alternativeText:
				uploadResult.alternativeText || metadata?.alternativeText || '',
			caption: uploadResult.caption || metadata?.caption || '',
		},
	}
}

function processGalleryUploadResult(
	originalImage: ImageDescription,
	uploadResult: UploadResponse
): ImageDescription {
	return {
		...originalImage,
		path: uploadResult.url,
		id: uploadResult.id,
		description: {
			name: uploadResult.name,
			alternativeText: uploadResult.alternativeText || '',
			caption: uploadResult.caption || '',
		},
	}
}

export async function prepareImageDescriptionFormData(
	imageDescription: ImageDescription
): Promise<FormData> {
	Logger.debug('StrapiUploader', 'Preparing image description form data')
	const formData = new FormData()

	if (imageDescription?.blob) {
		formData.append(
			'files',
			imageDescription.blob,
			imageDescription.name || 'image'
		)
	}

	const fileInfo = {
		name:
			imageDescription?.description?.name || imageDescription.name || 'image',
		alternativeText: imageDescription?.description?.alternativeText || '',
		caption: imageDescription.description?.caption || '',
	}

	formData.append('fileInfo', JSON.stringify(fileInfo))
	return formData
}

async function saveGalleryMetadata(
	uploadedImages: ImageDescription[],
	galleryFolderPath: string,
	app: App
): Promise<void> {
	Logger.debug('StrapiUploader', 'Saving gallery metadata')
	const metadataFile = `${galleryFolderPath}/metadata.json`
	try {
		await app.vault.adapter.write(
			metadataFile,
			JSON.stringify(uploadedImages, null, 2)
		)
		Logger.debug('StrapiUploader', 'Gallery metadata saved successfully')
	} catch (error) {
		Logger.error('StrapiUploader', 'Error saving gallery metadata', error)
		throw new Error('Failed to save gallery metadata')
	}
}
