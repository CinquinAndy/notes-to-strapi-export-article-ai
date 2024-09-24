import { App, Notice, TAbstractFile, TFile } from 'obsidian'
import { StrapiExporterSettings } from '../types/settings'
import { ImageDescription } from '../types/image'

export async function uploadImagesToStrapi(
	imageDescriptions: ImageDescription[],
	settings: StrapiExporterSettings,
	app: any = null,
	imageFolderPath: string = ''
): Promise<{ [key: string]: { url: string; data: any; id: number } }> {
	const uploadedImages: {
		[key: string]: { url: string; data: any; id: number }
	} = {}

	for (const imageDescription of imageDescriptions) {
		const formData = new FormData()
		if (imageDescription?.blob) {
			formData.append('files', imageDescription?.blob, imageDescription.name)
		}
		formData.append(
			'fileInfo',
			JSON.stringify({
				name: imageDescription?.description?.name,
				alternativeText: imageDescription?.description?.alternativeText,
				caption: imageDescription.description?.caption,
			})
		)

		try {
			const response = await fetch(`${settings.strapiUrl}/api/upload`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${settings.strapiApiToken}`,
				},
				body: formData,
			})

			if (response.ok) {
				const data = await response.json()
				uploadedImages[imageDescription?.name || 0] = {
					url: data[0].url,
					data: data[0],
					id: data[0].id,
				}
			} else {
				const errorData = await response.json()
				new Notice(
					`Failed to upload image: ${imageDescription.name}. Error: ${errorData.error.message}`
				)
			}
		} catch (error) {
			new Notice(
				`Error uploading image: ${imageDescription.name}. Error: ${error.message}`
			)
		}
	}

	if (imageFolderPath && app) {
		// Save metadata to a file only if there are uploaded images
		if (Object.keys(uploadedImages).length > 0) {
			const metadataFile = `${imageFolderPath}/metadata.json`
			await app.vault.adapter.write(
				metadataFile,
				JSON.stringify(uploadedImages)
			)
		}
	}
	return uploadedImages
}

/**
 * Upload gallery images to Strapi
 * @param imageDescriptions
 * @param settings
 * @param app
 * @param galleryFolderPath
 */
export async function uploadGalleryImagesToStrapi(
	imageDescriptions: ImageDescription[],
	settings: StrapiExporterSettings,
	app: any = null,
	galleryFolderPath: string = ''
): Promise<ImageDescription[]> {
	const uploadedImages: ImageDescription[] = []

	for (const imageDescription of imageDescriptions) {
		const formData = new FormData()
		if (imageDescription.blob) {
			formData.append('files', imageDescription.blob, imageDescription.name)
		}
		formData.append(
			'fileInfo',
			JSON.stringify({
				name: imageDescription?.description?.name,
				alternativeText: imageDescription?.description?.alternativeText,
				caption: imageDescription?.description?.caption,
			})
		)

		try {
			const response = await fetch(`${settings.strapiUrl}/api/upload`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${settings.strapiApiToken}`,
				},
				body: formData,
			})

			if (response.ok) {
				const data = await response.json()
				uploadedImages.push({
					...imageDescription,
					path: data[0].url,
					id: data[0].id,
					description: {
						name: data[0].name,
						alternativeText: data[0].alternativeText,
						caption: data[0].caption,
					},
				})
			} else {
				const errorData = await response.json()
				new Notice(
					`Failed to upload gallery image: ${imageDescription.name}. Error: ${errorData.error.message}`
				)
			}
		} catch (error) {
			new Notice(
				`Error uploading gallery image: ${imageDescription.name}. Error: ${error.message}`
			)
		}
	}

	if (galleryFolderPath && app) {
		// Save metadata to a file only if there are uploaded images
		if (uploadedImages.length > 0) {
			const metadataFile = `${galleryFolderPath}/metadata.json`
			await app.vault.adapter.write(
				metadataFile,
				JSON.stringify(uploadedImages)
			)
		}
	}

	return uploadedImages
}

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
	console.log('uploadImageToStrapi called with:', {
		imageData,
		fileName,
		settings,
		additionalMetadata,
	})

	const formData = new FormData()

	let file: TAbstractFile | null = null
	if (typeof imageData === 'string') {
		file = app.vault.getAbstractFileByPath(imageData)
	} else if (imageData instanceof TFile) {
		file = imageData
	}

	if (!(file instanceof TFile)) {
		console.error('Invalid file:', file)
		new Notice(`Failed to find file: ${fileName}`)
		return null
	}

	try {
		console.log('Reading file:', file.path)
		const arrayBuffer = await app.vault.readBinary(file)
		const blob = new Blob([arrayBuffer], { type: `image/${file.extension}` })
		formData.append('files', blob, fileName)

		if (additionalMetadata) {
			formData.append(
				'fileInfo',
				JSON.stringify({
					name: fileName,
					alternativeText: additionalMetadata.alternativeText,
					caption: additionalMetadata.caption,
				})
			)
		}

		console.log('Sending request to Strapi')
		const response = await fetch(`${settings.strapiUrl}/api/upload`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${settings.strapiApiToken}`,
			},
			body: formData,
		})

		if (response.ok) {
			const data = await response.json()
			console.log('Upload successful:', data)
			return {
				url: data[0].url,
				name: fileName,
				path: data[0].url,
				id: data[0].id,
				description: {
					name: data[0].name,
					alternativeText:
						data[0].alternativeText || additionalMetadata?.alternativeText,
					caption: data[0].caption || additionalMetadata?.caption,
				},
			}
		} else {
			const errorData = await response.json()
			console.error('Upload failed:', errorData)
			new Notice(
				`Failed to upload image: ${fileName}. Error: ${errorData.error.message}`
			)
		}
	} catch (error) {
		console.error('Error in uploadImageToStrapi:', error)
		new Notice(`Error uploading image: ${fileName}. Error: ${error.message}`)
	}

	return null
}
