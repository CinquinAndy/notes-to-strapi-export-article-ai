// src/services/forvoyez-image.ts

import { App, TFile } from 'obsidian'
import { Logger } from '../utils/logger'
import { StrapiExporterSettings, ImageDescription } from '../types'

/**
 * ForVoyez API response schema
 */
interface ForVoyezAPIResponse {
	success: boolean
	data: {
		title: string
		alt_text: string
		caption: string
		tags?: string[]
	}
}

/**
 * Schema for ForVoyez API request
 */
interface ForVoyezSchema {
	title: boolean
	alt_text: boolean
	caption: boolean
	tags: boolean
}

/**
 * Service for image analysis using ForVoyez API
 */
export class ForVoyezImageService {
	private readonly API_ENDPOINT = 'https://forvoyez.com/describe'

	constructor(
		private app: App,
		private settings: StrapiExporterSettings
	) {}

	/**
	 * Analyze a single image using ForVoyez API
	 */
	async analyzeImage(
		file: TFile,
		options: {
			context?: string
			keywords?: string[]
			language?: string
		} = {}
	): Promise<ImageDescription> {
		Logger.info('ForVoyez', `Analyzing image: ${file.path}`, { options })

		try {
			const formData = new FormData()

			// Add required image file
			const imageData = await this.app.vault.readBinary(file)
			formData.append(
				'image',
				new Blob([imageData], {
					type: this.getImageMimeType(file.extension),
				})
			)

			// Add optional parameters
			if (options.context) {
				formData.append('context', options.context)
			}

			if (options.keywords?.length) {
				formData.append('keywords', options.keywords.join(','))
			}

			if (options.language) {
				formData.append('language', options.language)
			}

			// Add schema
			const schema: ForVoyezSchema = {
				title: true,
				alt_text: true,
				caption: true,
				tags: true,
			}
			formData.append('schema', JSON.stringify(schema))

			// Make API request
			const response = await fetch(this.API_ENDPOINT, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.settings.forvoyezApiKey}`,
				},
				body: formData,
			})

			if (!response.ok) {
				await this.handleApiError(response)
			}

			const result: ForVoyezAPIResponse = await response.json()

			if (!result.success) {
				throw new Error('ForVoyez analysis failed')
			}

			Logger.debug('ForVoyez', 'Image analysis completed', result)

			// Transform response to ImageDescription format
			return {
				name: file.name,
				path: file.path,
				description: {
					name: result.data.title || file.basename,
					alternativeText: result.data.alt_text,
					caption: result.data.caption,
				},
			}
		} catch (error) {
			Logger.error('ForVoyez', `Error analyzing image: ${file.path}`, error)
			throw error
		}
	}

	/**
	 * Process multiple images with rate limiting
	 */
	async processBatchImages(
		files: TFile[],
		options: {
			context?: string
			keywords?: string[]
			language?: string
			batchSize?: number
		} = {}
	): Promise<ImageDescription[]> {
		Logger.info('ForVoyez', 'Processing batch images', {
			count: files.length,
			options,
		})

		const results: ImageDescription[] = []
		const errors: Array<{ file: string; error: string }> = []
		const batchSize = options.batchSize || 5

		// Process in batches to respect rate limits
		for (let i = 0; i < files.length; i += batchSize) {
			const batch = files.slice(i, i + batchSize)

			await Promise.all(
				batch.map(async file => {
					try {
						const result = await this.analyzeImage(file, options)
						results.push(result)
					} catch (error) {
						errors.push({
							file: file.path,
							error: error instanceof Error ? error.message : 'Unknown error',
						})
					}
				})
			)

			// Add delay between batches if not the last batch
			if (i + batchSize < files.length) {
				await new Promise(resolve => setTimeout(resolve, 1000))
			}
		}

		if (errors.length > 0) {
			Logger.warn('ForVoyez', 'Some images failed processing', { errors })
		}

		return results
	}

	/**
	 * Validate API key and check credits
	 */
	async validateApiKey(): Promise<{
		valid: boolean
		message?: string
	}> {
		try {
			const response = await fetch(this.API_ENDPOINT, {
				method: 'HEAD',
				headers: {
					Authorization: `Bearer ${this.settings.forvoyezApiKey}`,
				},
			})

			if (response.status === 401) {
				const error = await response.json()
				return {
					valid: false,
					message: error.message || 'Invalid API key',
				}
			}

			return { valid: true }
		} catch (error) {
			Logger.error('ForVoyez', 'Error validating API key', error)
			return {
				valid: false,
				message: 'Unable to validate API key',
			}
		}
	}

	/**
	 * Handle API errors with specific messages
	 */
	private async handleApiError(response: Response): Promise<never> {
		const error = await response.json().catch(() => ({}))

		switch (response.status) {
			case 400:
				throw new Error(error.message || 'Invalid request parameters')
			case 401:
				throw new Error('Invalid API key or unauthorized access')
			case 429:
				throw new Error('Rate limit exceeded. Please try again later.')
			case 500:
				throw new Error('ForVoyez service error. Please try again later.')
			default:
				throw new Error(
					`ForVoyez API error: ${error.message || response.statusText}`
				)
		}
	}

	/**
	 * Get MIME type from file extension
	 */
	private getImageMimeType(extension: string): string {
		const mimeTypes: Record<string, string> = {
			jpg: 'image/jpeg',
			jpeg: 'image/jpeg',
			png: 'image/png',
			gif: 'image/gif',
			webp: 'image/webp',
		}

		const mimeType = mimeTypes[extension.toLowerCase()]
		if (!mimeType) {
			throw new Error(`Unsupported image format: ${extension}`)
		}

		return mimeType
	}
}
