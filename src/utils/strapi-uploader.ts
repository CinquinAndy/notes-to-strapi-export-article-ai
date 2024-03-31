import { Notice } from 'obsidian'
import { StrapiExporterSettings } from '../types/settings'
import { ImageBlob, ImageDescription } from '../types/image'

export async function uploadImagesToStrapi(
	imageBlobs: ImageDescription[],
	settings: StrapiExporterSettings
): Promise<{ [key: string]: { url: string; data: any } }> {
	// Upload images to Strapi
	// ...
}

export async function uploadGaleryImagesToStrapi(
	imageBlobs: ImageBlob[],
	settings: StrapiExporterSettings
): Promise<number[]> {
	// Upload gallery images to Strapi
	// ...
}
