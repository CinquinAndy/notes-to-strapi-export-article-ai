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
