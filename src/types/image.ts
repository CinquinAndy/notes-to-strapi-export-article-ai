/**
 * Image types
 */
export interface ImageBlob {
	path: string
	blob: Blob
	name: string
	id?: any
	url?: string
}

/**
 * Image description
 */
export interface ImageDescription extends ImageBlob {
	description: {
		name: string
		alternativeText: string
		caption: string
	}
}
