import { RouteConfig, AnalyzedContent } from '../types'
import { StrapiExporterSettings } from '../types/settings'
import { extractFrontMatterAndContent } from '../utils/analyse-file'
import { App, TFile } from 'obsidian'
import { uploadImageToStrapi } from '../utils/strapi-uploader'
import * as yaml from 'js-yaml'

export class StrapiExportService {
	constructor(
		private settings: StrapiExporterSettings,
		private app: App,
		private file: TFile
	) {}

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

		const exportData = await this.prepareExportData(this.app, this.file, route)

		if (exportData.data[route.contentField]) {
			const { content: processedContent } = await this.processContentImages(
				exportData.data[route.contentField]
			)
			exportData.data[route.contentField] = processedContent
		}

		exportData.data = await this.convertImageUrlsToIds(exportData.data)

		await this.sendToStrapi(exportData, route)
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
