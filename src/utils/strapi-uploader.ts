import { Notice } from 'obsidian'
import { StrapiExporterSettings } from '../types/settings'
import { ImageBlob, ImageDescription } from '../types/image'

/**
 * Upload images to Strapi
 * @param imageDescriptions
 * @param settings
 */
export async function uploadImagesToStrapi(
	imageDescriptions: ImageDescription[],
	settings: StrapiExporterSettings
): Promise<{ [key: string]: { url: string; data: any } }> {
	const uploadedImages: { [key: string]: { url: string; data: any } } = {}

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
				}
			} else {
				new Notice(`Failed to upload image: ${imageDescription.name}`)
			}
		} catch (error) {
			new Notice(`Error uploading image: ${imageDescription.name}`)
		}
	}

	return uploadedImages
}

/**
 * Upload gallery images to Strapi
 * @param imageBlobs
 * @param settings
 */
export async function uploadGalleryImagesToStrapi(
	imageBlobs: ImageBlob[],
	settings: StrapiExporterSettings
): Promise<number[]> {
	const uploadedImageIds: number[] = []

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
				uploadedImageIds.push(data[0].id)
			} else {
				new Notice(`Failed to upload gallery image: ${imageBlob.name}`)
			}
		} catch (error) {
			new Notice(`Error uploading gallery image: ${imageBlob.name}`)
		}
	}

	return uploadedImageIds
}
