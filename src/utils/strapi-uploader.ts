import { Notice } from 'obsidian'
import { StrapiExporterSettings } from '../types/settings'
import { ImageBlob, ImageDescription } from '../types/image'

/**
 * Upload images to Strapi
 * @param imageDescriptions
 * @param settings
 * @param app
 * @param imageFolderPath
 */
export async function uploadImagesToStrapi(
	imageDescriptions: ImageDescription[],
	settings: StrapiExporterSettings,
	app: any = null,
	imageFolderPath: string = ''
): Promise<{ [key: string]: { url: string; data: any } }> {
	const uploadedImages: { [key: string]: { url: string; data: any; id: any } } =
		{}

	for (const imageDescription of imageDescriptions) {
		const formData = new FormData()
		formData.append('files', imageDescription.blob, imageDescription.name)
		formData.append(
			'fileInfo',
			JSON.stringify({
				name: imageDescription.description.name,
				alternativeText: imageDescription.description.alternativeText,
				caption: imageDescription.description.caption,
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
				uploadedImages[imageDescription.name] = {
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
 * @param imageBlobs
 * @param settings
 * @param app
 * @param galleryFolderPath
 */
export async function uploadGalleryImagesToStrapi(
	imageBlobs: ImageBlob[],
	settings: StrapiExporterSettings,
	app: any = null,
	galleryFolderPath: string = ''
): Promise<number[]> {
	const uploadedImageIds: number[] = []
	const uploadedImages: { [key: string]: { url: string; data: any; id: any } } =
		{}

	for (const imageBlob of imageBlobs) {
		const formData = new FormData()
		formData.append('files', imageBlob.blob, imageBlob.name)

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
				uploadedImages[imageBlob.name] = {
					url: data[0].url,
					id: data[0].id,
					data: data[0],
				}
			} else {
				const errorData = await response.json()
				new Notice(
					`Failed to upload gallery image: ${imageBlob.name}. Error: ${errorData.error.message}`
				)
			}
		} catch (error) {
			new Notice(
				`Error uploading gallery image: ${imageBlob.name}. Error: ${error.message}`
			)
		}
	}

	if (galleryFolderPath && app) {
		// Save metadata to a file only if there are uploaded images
		if (Object.keys(uploadedImages).length > 0) {
			const metadataFile = `${galleryFolderPath}/metadata.json`
			await app.vault.adapter.write(
				metadataFile,
				JSON.stringify(uploadedImages)
			)
		}
	}

	return uploadedImageIds
}
