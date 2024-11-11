export interface ImageDescription {
	url?: string
	path?: string
	name?: string
	id?: any
	blob?: Blob
	description?: ImageMetadata
}

export interface ImageMetadata {
	name: string
	alternativeText: string
	caption: string
	width?: number
	height?: number
	format?: string
	size?: number
}

export interface ImageProcessingResult {
	content: string
	processedImages: ImageDescription[]
	stats?: ImageProcessingStats
}

export interface ImageProcessingStats {
	total: number
	processed: number
	failed: number
	skipped: number
}
