// src/api/strapiAPI.ts
import { Notice } from 'obsidian'

export async function uploadImagesToStrapi(
	imageBlobs: {
		path: string
		blob: Blob
		name: string
		description: {
			name: string
			alternativeText: string
			caption: string
		}
	}[],
	strapiUrl: string,
	strapiApiToken: string
): Promise<{ [key: string]: { url: string; data: any } }> {
	const uploadedImages: {
		[key: string]: { url: string; data: any }
	} = {}

	for (const imageBlob of imageBlobs) {
		const formData = new FormData()
		formData.append('files', imageBlob.blob, imageBlob.name)
		formData.append(
			'fileInfo',
			JSON.stringify({
				name: imageBlob.description.name,
				alternativeText: imageBlob.description.alternativeText,
				caption: imageBlob.description.caption,
			})
		)

		try {
			const response = await fetch(`${strapiUrl}/api/upload`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${strapiApiToken}`,
				},
				body: formData,
			})

			if (response.ok) {
				const data = await response.json()
				uploadedImages[imageBlob.name] = {
					url: data[0].url,
					data: data[0],
				}
			} else {
				new Notice(`Failed to upload image: ${imageBlob.name}`)
			}
		} catch (error) {
			new Notice(`Error uploading image: ${imageBlob.name}`)
		}
	}

	return uploadedImages
}

export async function uploadGaleryImagesToStrapi(
	imageBlobs: { path: string; blob: Blob; name: string }[],
	strapiUrl: string,
	strapiApiToken: string
): Promise<number[]> {
	const uploadedImageIds: number[] = []

	for (const imageBlob of imageBlobs) {
		const formData = new FormData()
		formData.append('files', imageBlob.blob, imageBlob.name)

		try {
			const response = await fetch(`${strapiUrl}/api/upload`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${strapiApiToken}`,
				},
				body: formData,
			})

			if (response.ok) {
				const data = await response.json()
				uploadedImageIds.push(data[0].id)
			} else {
				new Notice(`Failed to upload galery image: ${imageBlob.name}`)
			}
		} catch (error) {
			new Notice(`Error uploading galery image: ${imageBlob.name}`)
		}
	}

	return uploadedImageIds
}
