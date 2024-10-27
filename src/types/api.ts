export interface StrapiResponse<T> {
	data: T
	meta?: {
		pagination?: {
			page: number
			pageSize: number
			pageCount: number
			total: number
		}
	}
}

export interface StrapiError {
	status: number
	name: string
	message: string
	details?: any
}

export interface StrapiUploadResponse {
	id: number
	name: string
	alternativeText?: string
	caption?: string
	width?: number
	height?: number
	formats?: Record<
		string,
		{
			name: string
			hash: string
			ext: string
			mime: string
			width: number
			height: number
			size: number
			url: string
		}
	>
	hash: string
	ext: string
	mime: string
	size: number
	url: string
	createdAt: string
	updatedAt: string
}

export interface ApiKeyValidation {
	isValid: boolean
	error?: string
}
