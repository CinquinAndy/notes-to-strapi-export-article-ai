// src/utils/forvoyez-generator.ts

import { Notice } from 'obsidian'
import { StrapiExporterSettings } from '../types/settings'
import { ArticleContent } from '../types/article'

const FORVOYEZ_API_URL = 'https://api.forvoyez.com'

async function callForVoyezAPI(endpoint: string, data: any, apiKey: string) {
	const response = await fetch(`${FORVOYEZ_API_URL}${endpoint}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${apiKey}`
		},
		body: JSON.stringify(data)
	})

	if (!response.ok) {
		const errorData = await response.json()
		throw new Error(`ForVoyez API error: ${errorData.error || 'Unknown error'}`)
	}

	return response.json()
}

export async function generateArticleContent(
	content: string,
	settings: StrapiExporterSettings,
	useAdditionalCallAPI = false
): Promise<ArticleContent> {
	let jsonTemplate: any
	let jsonTemplateDescription: any
	let contentAttributeName: string

	if (useAdditionalCallAPI) {
		jsonTemplate = JSON.parse(settings.additionalJsonTemplate)
		jsonTemplateDescription = JSON.parse(
			settings.additionalJsonTemplateDescription
		)
		contentAttributeName = settings.additionalContentAttributeName
	} else {
		jsonTemplate = JSON.parse(settings.jsonTemplate)
		jsonTemplateDescription = JSON.parse(settings.jsonTemplateDescription)
		contentAttributeName = settings.strapiContentAttributeName
	}

	try {
		const response = await callForVoyezAPI('/describe', {
			content: content.substring(0, 500),
			template: jsonTemplate,
			templateDescription: jsonTemplateDescription,
			additionalPrompt: settings.additionalPrompt
		}, settings.forvoyezApiKey)

		let articleContent = response
		articleContent = {
			data: {
				...articleContent.data,
				[contentAttributeName]: content,
			},
		}

		return articleContent
	} catch (error) {
		new Notice(`Error generating article content: ${error.message}`)
		throw error
	}
}

export async function getImageDescription(imageBlob: Blob, settings: StrapiExporterSettings) {
	try {
		const formData = new FormData()
		formData.append('image', imageBlob)

		const response = await fetch(`${FORVOYEZ_API_URL}/describe`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${settings.forvoyezApiKey}`
			},
			body: formData
		})

		if (!response.ok) {
			const errorData = await response.json()
			throw new Error(`ForVoyez API error: ${errorData.error || 'Unknown error'}`)
		}

		const data = await response.json()
		return {
			name: data.name,
			alternativeText: data.alternativeText,
			caption: data.caption
		}
	} catch (error) {
		new Notice(`Error getting image description: ${error.message}`)
		throw error
	}
}