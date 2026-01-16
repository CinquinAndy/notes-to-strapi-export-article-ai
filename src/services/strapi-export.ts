import { RouteConfig, AnalyzedContent } from '../types'
import { StrapiExporterSettings } from '../types/settings'
import { extractFrontMatterAndContent } from '../utils/analyse-file'
import { App, Notice, TFile } from 'obsidian'
import { uploadImageToStrapi } from '../utils/strapi-uploader'
import * as yaml from 'js-yaml'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

export class StrapiExportService {
	private model

	constructor(
		private settings: StrapiExporterSettings,
		private app: App,
		private file: TFile
	) {
		const openai = createOpenAI({
			apiKey: this.settings.openaiApiKey,
		})
		this.model = openai.chat('gpt-4o-mini')
	}

	private async sendToStrapi(data: any, route: RouteConfig): Promise<void> {
		const url = `${this.settings.strapiUrl}${route.url}`

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.settings.strapiApiToken}`,
			},
			body: JSON.stringify(data),
		})

		const responseText = await response.text()
		let responseData

		try {
			responseData = JSON.parse(responseText)
		} catch {
			responseData = responseText
		}

		if (!response.ok) {
			throw new Error(
				`Strapi API error (${response.status}): ${
					typeof responseData === 'object'
						? JSON.stringify(responseData)
						: responseData
				}`
			)
		}
	}

	private validateSettings(): void {
		if (!this.settings.strapiUrl) {
			throw new Error('Strapi URL is not configured')
		}
		if (!this.settings.strapiApiToken) {
			throw new Error('Strapi API token is not configured')
		}
	}

	private validateRoute(route: RouteConfig): void {
		if (!route.url) {
			throw new Error('Route URL is not configured')
		}
		if (!route.contentField) {
			throw new Error('Content field is not configured')
		}
		if (!route.fieldMappings) {
			throw new Error('Field mappings are not configured')
		}
	}

	/**
	 * Process and handle all images in the content
	 * @param content - The content to process
	 * @returns Promise<{ content: string; wasModified: boolean }> - Updated content with processed image links and modification status
	 */
	private async processContentImages(
		content: string
	): Promise<{ content: string; wasModified: boolean }> {
		// Regular expressions for both internal and external images
		const internalImageRegex = /!\[\[([^\]]+\.(png|jpe?g|gif|webp))\]\]/g
		const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g

		let processedContent = content
		let wasModified = false
		let match

		// Process internal images (Obsidian format)
		while ((match = internalImageRegex.exec(content)) !== null) {
			const [fullMatch, imagePath] = match
			const processedUrl = await this.processImage(imagePath, true)
			if (processedUrl) {
				wasModified = true
				processedContent = processedContent.replace(
					fullMatch,
					`![${imagePath}](${processedUrl})`
				)
			}
		}

		// Process markdown images
		while ((match = markdownImageRegex.exec(content)) !== null) {
			const [fullMatch, altText, imagePath] = match
			const processedUrl = await this.processImage(imagePath, false)
			if (processedUrl) {
				wasModified = true
				processedContent = processedContent.replace(
					fullMatch,
					`![${altText}](${processedUrl})`
				)
			}
		}

		return { content: processedContent, wasModified }
	}

	/**
	 * Process individual image
	 * @param imagePath - Path or URL of the image
	 * @param isInternal - Whether the image is internal to Obsidian
	 * @returns Promise<string | null> - Processed image URL
	 */
	private async processImage(
		imagePath: string,
		isInternal: boolean
	): Promise<string | null> {
		if (isInternal) {
			return await this.handleInternalImage(imagePath)
		} else {
			return await this.handleExternalImage(imagePath)
		}
	}

	/**
	 * Handle internal Obsidian image
	 */
	private async handleInternalImage(imagePath: string): Promise<string | null> {
		const file = this.app.vault.getAbstractFileByPath(imagePath)
		if (!(file instanceof TFile)) {
			return null
		}

		const uploadedImage = await uploadImageToStrapi(
			file,
			file.name,
			this.settings,
			this.app
		)

		return uploadedImage?.url || null
	}

	/**
	 * Handle external image URL
	 */
	private async handleExternalImage(imageUrl: string): Promise<string | null> {
		// First, check if image already exists in Strapi
		const existingImage = await this.checkExistingImage(imageUrl)
		if (existingImage) {
			return existingImage.data.url
		}

		// If not, download and upload to Strapi
		const response = await fetch(imageUrl)
		const blob = await response.blob()
		const fileName = this.getFileNameFromUrl(imageUrl)

		const formData = new FormData()
		formData.append('files', blob, fileName)

		const uploadResponse = await fetch(
			`${this.settings.strapiUrl}/api/upload`,
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.settings.strapiApiToken}`,
				},
				body: formData,
			}
		)

		if (!uploadResponse.ok) {
			throw new Error('Failed to upload image to Strapi')
		}

		const uploadResult = await uploadResponse.json()
		return uploadResult[0]?.url || null
	}

	/**
	 * Check if image already exists in Strapi
	 */
	private async checkExistingImage(
		imageUrl: string
	): Promise<{ data: { id: number; url: string } } | null> {
		const response = await fetch(
			`${this.settings.strapiUrl}/api/upload/files?filters[url][$eq]=${encodeURIComponent(imageUrl)}`,
			{
				headers: {
					Authorization: `Bearer ${this.settings.strapiApiToken}`,
				},
			}
		)

		if (!response.ok) {
			return null
		}

		const results = await response.json()
		return results.length > 0
			? {
					data: {
						id: results[0].id,
						url: results[0].url,
					},
				}
			: null
	}

	/**
	 * Extract filename from URL
	 */
	private getFileNameFromUrl(url: string): string {
		const urlParts = url.split('/')
		const fileName = urlParts[urlParts.length - 1].split('?')[0]
		return fileName || 'image.jpg'
	}

	/**
	 * Process frontmatter data and handle any image fields
	 * @param frontmatter - The frontmatter object to process
	 * @returns Promise<{frontmatter: any, wasModified: boolean}> - Processed frontmatter and modification status
	 */
	private async processFrontmatterImages(
		frontmatter: any
	): Promise<{ frontmatter: any; wasModified: boolean }> {
		let wasModified = false
		const processedFrontmatter = { ...frontmatter }

		/**
		 * Recursively process object properties
		 * @param obj - Object to process
		 * @returns Promise<any> - Processed object
		 */
		const processObject = async (obj: any): Promise<any> => {
			for (const key in obj) {
				const value = obj[key]

				// Handle arrays
				if (Array.isArray(value)) {
					const processedArray = await Promise.all(
						value.map(async item => {
							if (typeof item === 'object' && item !== null) {
								return await processObject(item)
							}
							if (typeof item === 'string') {
								return await processStringValue(item)
							}
							return item
						})
					)

					if (JSON.stringify(processedArray) !== JSON.stringify(value)) {
						obj[key] = processedArray
						wasModified = true
					}
				}
				// Handle nested objects
				else if (typeof value === 'object' && value !== null) {
					obj[key] = await processObject(value)
				}
				// Handle string values
				else if (typeof value === 'string') {
					const processedValue = await processStringValue(value)
					if (processedValue !== value) {
						obj[key] = processedValue
						wasModified = true
					}
				}
			}
			return obj
		}

		/**
		 * Process string values for possible image paths/URLs
		 * @param value - String value to process
		 * @returns Promise<string> - Processed string value
		 */
		const processStringValue = async (value: string): Promise<string> => {
			if (this.isImagePath(value)) {
				const isInternal =
					value.startsWith('./') ||
					value.startsWith('../') ||
					!value.startsWith('http')
				const processedUrl = await this.processImage(value, isInternal)
				if (processedUrl) {
					return processedUrl
				}
			}
			return value
		}

		await processObject(processedFrontmatter)
		return { frontmatter: processedFrontmatter, wasModified }
	}

	/**
	 * Check if a string value might be an image path
	 * @param value - String to check
	 * @returns boolean - True if the string appears to be an image path
	 */
	private isImagePath(value: string): boolean {
		const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)$/i
		return (
			imageExtensions.test(value) ||
			value.includes('/upload/') || // For existing Strapi URLs
			/^https?:\/\/.*\.(jpg|jpeg|png|gif|webp|svg)/i.test(value)
		)
	}

	/**
	 * Prepare export data by processing both content and frontmatter
	 * @param app - Obsidian App instance
	 * @param file - Current TFile
	 * @param route - Route configuration
	 * @returns Promise<any> - Prepared export data
	 */
	private async prepareExportData(
		app: App,
		file: TFile,
		route: RouteConfig
	): Promise<any> {
		const content = await app.vault.read(file)
		const { frontmatter, body } = extractFrontMatterAndContent(content)

		// Process images in frontmatter
		const {
			frontmatter: processedFrontmatter,
			wasModified: frontmatterModified,
		} = await this.processFrontmatterImages(frontmatter)

		// Process images in content
		const { content: processedContent, wasModified: contentModified } =
			await this.processContentImages(body)

		// Update file if modifications were made
		if (frontmatterModified || contentModified) {
			await this.updateObsidianFile(processedContent, processedFrontmatter)
		}

		return {
			data: {
				...processedFrontmatter,
				[route.contentField]: processedContent,
			},
		}
	}

	/**
	 * Update Obsidian file with processed content and frontmatter
	 * @param newContent - Processed content
	 * @param newFrontmatter - Processed frontmatter
	 * @returns Promise<void>
	 */
	private async updateObsidianFile(
		newContent: string,
		newFrontmatter: any
	): Promise<void> {
		try {
			let updatedContent = ''

			// Add updated frontmatter
			if (Object.keys(newFrontmatter).length > 0) {
				updatedContent = '---\n'
				updatedContent += yaml.dump(newFrontmatter)
				updatedContent += '---\n\n'
			}

			// Add updated content
			updatedContent += newContent

			// Update the file
			await this.app.vault.modify(this.file, updatedContent)
		} catch (error) {
			throw new Error('Failed to update Obsidian file' + error.message)
		}
	}

	// Update the exportContent method to use the new image processing
	async exportContent(
		content: AnalyzedContent,
		route: RouteConfig
	): Promise<void> {
		this.validateSettings()
		this.validateRoute(route)

		try {
			let exportData = await this.prepareExportData(this.app, this.file, route)

			if (exportData.data[route.contentField]) {
				const { content: processedContent } = await this.processContentImages(
					exportData.data[route.contentField]
				)
				exportData.data[route.contentField] = processedContent
			}

			exportData.data = await this.convertImageUrlsToIds(exportData.data)

			try {
				await this.sendToStrapi(exportData, route)
			} catch (strapiError) {
				new Notice(`Failed to upload, retrying with simplified data...`)
				// Parse and analyze the error
				const errorDetails = await this.parseAndAnalyzeError(strapiError)

				// Regenerate data with error details
				exportData = await this.regenerateDataWithError(
					exportData,
					errorDetails,
					route
				)

				// Retry sending to Strapi
				await this.sendToStrapi(exportData, route)
			}
		} catch (error) {
			throw new Error(`Export failed: ${error.message}`)
		}
	}

	/**
	 * Process individual error messages from Strapi response
	 */
	private async parseAndAnalyzeError(error: any): Promise<any> {
		try {
			// If we already have JSON data in the error response
			if (error.response?.data) {
				return {
					statusCode: error.response.status,
					error: error.response.data.error,
					details: error.response.data.error?.details || {},
					message: error.response.data.error?.message || 'Unknown error',
				}
			}

			// Handle string error message
			if (typeof error === 'string') {
				return {
					statusCode: 500,
					error: { message: error },
					details: {},
					message: error,
				}
			}

			// Extract detailed error info
			const errorInfo = error.toString().split(': ').pop()
			let parsedError

			try {
				parsedError = JSON.parse(errorInfo)
			} catch {
				parsedError = { message: errorInfo }
			}

			return {
				statusCode: error.response?.status || 500,
				error: parsedError,
				details: parsedError.details || {},
				message: parsedError.message || 'Unknown error',
			}
		} catch (e) {
			console.error('Error parsing Strapi response:', e)
			return {
				statusCode: error.response?.status || 500,
				error: { message: 'Failed to parse error response' },
				details: {},
				message: error.message || 'Unknown error',
			}
		}
	}

	/**
	 * Regenerate data based on Strapi error feedback
	 */
	private async regenerateDataWithError(
		originalData: any,
		errorDetails: any,
		route: RouteConfig
	): Promise<any> {
		const { text } = await generateText({
			model: this.model,
			system: `You are an API expert specializing in Strapi CMS. You MUST return only valid JSON data.
                Do not include any explanations or text outside of the JSON structure.
                The response must be parseable by JSON.parse().`,
			prompt: `
            Fix this failed Strapi API request.

            Error Information:
            Status Code: ${errorDetails.statusCode}
            Message: ${errorDetails.message}
            Details: ${JSON.stringify(errorDetails.details, null, 2)}

            Original Request Data:
            ${JSON.stringify(originalData, null, 2)}

            Route Configuration and Schema:
            ${route.generatedConfig}

            IMPORTANT: Return ONLY valid JSON in the exact format:
            {
              "data": {
                // corrected fields here
              }
            }
            
            If the error is something similar with an Unknown error, try to delete the complexe fields, galleries, lists, etc. and keep only the simple fields.

            Do not include any text explanations - use the "__comment" field inside the JSON if needed.
            The entire response must be valid JSON that can be parsed with JSON.parse().
        `,
		})

		try {
			// First, try to clean the response if needed
			const cleanedText = this.cleanAIResponse(text)

			let correctedData: any
			try {
				correctedData = JSON.parse(cleanedText)
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
			} catch (e) {
				// If parsing fails, attempt to extract JSON from the response
				const extractedJson = this.extractJsonFromText(cleanedText)
				if (!extractedJson) {
					console.error('Original AI response:', text)
					console.error('Cleaned response:', cleanedText)
					throw new Error('Could not extract valid JSON from AI response')
				}
				correctedData = JSON.parse(extractedJson)
			}

			// Validate basic structure
			if (!correctedData.data) {
				correctedData = { data: correctedData }
			}

			// Log for debugging
			console.log('Original data:', originalData)
			console.log('Error details:', errorDetails)
			console.log('Corrected data:', correctedData)

			if (correctedData.__comment) {
				console.log('Correction comment:', correctedData.__comment)
				new Notice(`Changes made: ${correctedData.__comment}`)
				delete correctedData.__comment
			}

			return correctedData
		} catch (e) {
			console.error('AI Response:', text)
			console.error('Generation error:', e)

			// Fallback: return a sanitized version of the original data
			return this.createFallbackData(originalData, errorDetails)
		}
	}

	/**
	 * Clean AI response text to ensure valid JSON
	 */
	private cleanAIResponse(text: string): string {
		// Remove markdown code blocks if present
		// eslint-disable-next-line no-useless-escape
		text = text.replace(/```json\n?|\```\n?/g, '')

		// Remove any leading/trailing whitespace
		text = text.trim()

		// Remove any text before the first {
		const firstBrace = text.indexOf('{')
		if (firstBrace > 0) {
			text = text.substring(firstBrace)
		}

		// Remove any text after the last }
		const lastBrace = text.lastIndexOf('}')
		if (lastBrace !== -1 && lastBrace < text.length - 1) {
			text = text.substring(0, lastBrace + 1)
		}

		return text
	}

	/**
	 * Extract JSON from text that might contain other content
	 */
	private extractJsonFromText(text: string): string | null {
		const jsonRegex = /{[\s\S]*}/
		const match = text.match(jsonRegex)
		return match ? match[0] : null
	}

	/**
	 * Create fallback data when regeneration fails
	 */
	private createFallbackData(originalData: any, errorDetails: any): any {
		console.log('Using fallback data generation')

		// Start with the original data
		const fallbackData = { ...originalData }

		// Remove fields mentioned in error details
		if (errorDetails.details?.errors) {
			errorDetails.details.errors.forEach((error: any) => {
				if (error.path) {
					const path = Array.isArray(error.path) ? error.path : [error.path]
					let current = fallbackData.data
					for (let i = 0; i < path.length - 1; i++) {
						if (current[path[i]]) {
							current = current[path[i]]
						}
					}
					const lastKey = path[path.length - 1]
					if (current[lastKey]) {
						delete current[lastKey]
					}
				}
			})
		}

		// Ensure the data property exists
		if (!fallbackData.data) {
			fallbackData.data = {}
		}

		return fallbackData
	}

	/**
	 * Convert image URLs to Strapi IDs in frontmatter
	 * @param data - The data object containing frontmatter
	 * @returns Promise<any> - Updated data with image IDs
	 */
	private async convertImageUrlsToIds(data: any): Promise<any> {
		const processValue = async (value: any): Promise<any> => {
			if (typeof value === 'string' && this.isImagePath(value)) {
				const imageInfo = await this.checkExistingImage(value)
				return imageInfo?.data?.id || value
			}

			if (Array.isArray(value)) {
				return Promise.all(value.map(item => processValue(item)))
			}

			if (typeof value === 'object' && value !== null) {
				const processed: any = {}
				for (const [key, val] of Object.entries(value)) {
					processed[key] = await processValue(val)
				}
				return processed
			}

			return value
		}

		return await processValue(data)
	}
}
