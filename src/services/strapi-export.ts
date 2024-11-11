import { Logger } from '../utils/logger'
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

	private async prepareExportData(app, file, route: RouteConfig): Promise<any> {
		let content = await app.vault.read(file)
		content = extractFrontMatterAndContent(content)
		return {
			data: {
				...content.frontmatter,
				[route.contentField]: content.body,
			},
		}
	}

	private async sendToStrapi(data: any, route: RouteConfig): Promise<void> {
		// const url = `${this.settings.strapiUrl}${route.url}`
		// Logger.info('StrapiExport', `Sending to Strapi: ${url}`)
		// Logger.debug('StrapiExport', 'Request data', data)
		// console.log('StrapiExport', 'Request data', data)
		// console.log('StrapiExport', 'Strapi URL', url)
		// console.log(
		// 	'StrapiExport',
		// 	'Strapi API Token',
		// 	this.settings.strapiApiToken
		// )

		return
		try {
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

			Logger.debug('StrapiExport', 'Strapi response', responseData)
		} catch (error) {
			Logger.error('StrapiExport', 'Error sending to Strapi', error)
			throw error
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
	 * @returns Promise<string> - Updated content with processed image links
	 */
	private async processContentImages(
		content: string
	): Promise<{ content: string; wasModified: boolean }> {
		Logger.info('StrapiExport', 'Processing content images')

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

		if (wasModified) {
			await this.updateObsidianFile(processedContent)
		}
		console.log('Processed Content', processedContent)

		return { content: processedContent, wasModified }
	}

	/**
	 * Update the current Obsidian file with new content
	 * @param newContent - The new content to write
	 */
	private async updateObsidianFile(newContent: string): Promise<void> {
		try {
			Logger.info(
				'StrapiExport',
				'Updating Obsidian file with processed images'
			)

			// Préserver le frontmatter existant
			const currentContent = await this.app.vault.read(this.file)
			const { frontmatter } = extractFrontMatterAndContent(currentContent)

			// Construire le nouveau contenu avec le frontmatter préservé
			let updatedContent = ''
			if (Object.keys(frontmatter).length > 0) {
				updatedContent = '---\n'
				updatedContent += yaml.dump(frontmatter)
				updatedContent += '---\n\n'
			}
			updatedContent += newContent

			// Mettre à jour le fichier
			await this.app.vault.modify(this.file, updatedContent)

			Logger.info('StrapiExport', 'Obsidian file updated successfully')
		} catch (error) {
			Logger.error('StrapiExport', 'Error updating Obsidian file', error)
			throw new Error('Failed to update Obsidian file with processed images')
		}
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
		try {
			if (isInternal) {
				console.log('StrapiExport', 'Processing internal image', imagePath)
				return await this.handleInternalImage(imagePath)
			} else {
				console.log('StrapiExport', 'Processing external image', imagePath)
				return await this.handleExternalImage(imagePath)
			}
		} catch (error) {
			Logger.error(
				'StrapiExport',
				`Error processing image: ${imagePath}`,
				error
			)
			return null
		}
	}

	/**
	 * Handle internal Obsidian image
	 */
	private async handleInternalImage(imagePath: string): Promise<string | null> {
		const file = this.app.vault.getAbstractFileByPath(imagePath)
		if (!(file instanceof TFile)) {
			Logger.error('StrapiExport', `Internal file not found: ${imagePath}`)
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
			return existingImage.url
		}

		// If not, download and upload to Strapi
		try {
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
		} catch (error) {
			Logger.error(
				'StrapiExport',
				`Error handling external image: ${imageUrl}`,
				error
			)
			return null
		}
	}

	/**
	 * Check if image already exists in Strapi
	 */
	private async checkExistingImage(
		imageUrl: string
	): Promise<{ url: string } | null> {
		try {
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
			return results.length > 0 ? { url: results[0].url } : null
		} catch (error) {
			Logger.error(
				'StrapiExport',
				`Error checking existing image: ${imageUrl}`,
				error
			)
			return null
		}
	}

	/**
	 * Extract filename from URL
	 */
	private getFileNameFromUrl(url: string): string {
		const urlParts = url.split('/')
		const fileName = urlParts[urlParts.length - 1].split('?')[0]
		return fileName || 'image.jpg'
	}

	// Update the exportContent method to use the new image processing
	async exportContent(
		content: AnalyzedContent,
		route: RouteConfig
	): Promise<void> {
		Logger.info('StrapiExport', 'Starting content export')

		try {
			this.validateSettings()
			this.validateRoute(route)

			const exportData = await this.prepareExportData(
				this.app,
				this.file,
				route
			)

			// Process images in the content
			if (exportData.data[route.contentField]) {
				const { content: processedContent } = await this.processContentImages(
					exportData.data[route.contentField]
				)
				exportData.data[route.contentField] = processedContent
			}

			await this.sendToStrapi(exportData, route)
			Logger.info('StrapiExport', 'Content exported successfully')
		} catch (error) {
			Logger.error('StrapiExport', 'Export failed', error)
			throw error
		}
	}
}
