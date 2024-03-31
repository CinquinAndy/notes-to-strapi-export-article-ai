export interface ImageBlob {
	path: string
	blob: Blob
	name: string
}

export interface ImageDescription extends ImageBlob {
	description: {
		name: string
		alternativeText: string
		caption: string
	}
}
