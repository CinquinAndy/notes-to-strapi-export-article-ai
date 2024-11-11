import { Logger } from '../utils/logger'
import { RouteConfig, AnalyzedContent } from '../types'
import { StrapiExporterSettings } from '../types/settings'
import { extractFrontMatterAndContent } from '../utils/analyse-file'
import { App, TFile } from 'obsidian'

export class StrapiExportService {
	constructor(
		private settings: StrapiExporterSettings,
		private app: App,
		private file: TFile
	) {}

	async exportContent(
		content: AnalyzedContent,
		route: RouteConfig
	): Promise<void> {
		Logger.info('StrapiExport', 'Starting content export')

		try {
			this.validateSettings()
			this.validateRoute(route)

			console.log('StrapiExport', 'Content', content)
			const exportData = await this.prepareExportData(
				this.app,
				this.file,
				route
			)
			// todo : here : analyse images and replace them with the correct remote url
			// the "exportData" object should be updated with the correct image urls , (sent to strapi)
			// (if it's not an image from the vault or from strapi)

			await this.sendToStrapi(exportData, route)

			Logger.info('StrapiExport', 'Content exported successfully')
		} catch (error) {
			Logger.error('StrapiExport', 'Export failed', error)
			throw error
		}
	}

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
		const url = `${this.settings.strapiUrl}${route.url}`
		Logger.info('StrapiExport', `Sending to Strapi: ${url}`)
		Logger.debug('StrapiExport', 'Request data', data)
		console.log('StrapiExport', 'Request data', data)
		console.log('StrapiExport', 'Strapi URL', url)
		console.log(
			'StrapiExport',
			'Strapi API Token',
			this.settings.strapiApiToken
		)

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
}
