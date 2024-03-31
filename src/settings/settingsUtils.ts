// src/utils/settingsUtils.ts

import { Notice } from 'obsidian'
import { StrapiExporterSettings } from '../settings/StrapiExporterSettings'

export function checkSettings(
	settings: StrapiExporterSettings,
	useAdditionalCallAPI: boolean
): boolean {
	if (!settings.strapiUrl || !settings.strapiApiToken) {
		new Notice(
			'Please configure Strapi URL and API token in the plugin settings'
		)
		return false
	}

	if (!settings.openaiApiKey) {
		new Notice('Please configure OpenAI API key in the plugin settings')
		return false
	}

	if (useAdditionalCallAPI) {
		if (!settings.additionalJsonTemplate) {
			new Notice(
				'Please configure the additional call api JSON template in the plugin settings'
			)
			return false
		}

		if (!settings.additionalJsonTemplateDescription) {
			new Notice(
				'Please configure the additional call api JSON template description in the plugin settings'
			)
			return false
		}

		if (!settings.additionalUrl) {
			new Notice(
				'Please configure the additional call api URL in the plugin settings'
			)
			return false
		}

		if (!settings.additionalContentAttributeName) {
			new Notice(
				'Please configure the additional call api content attribute name in the plugin settings'
			)
			return false
		}
	} else {
		if (!settings.jsonTemplate) {
			new Notice('Please configure JSON template in the plugin settings')
			return false
		}

		if (!settings.jsonTemplateDescription) {
			new Notice(
				'Please configure JSON template description in the plugin settings'
			)
			return false
		}

		if (!settings.strapiArticleCreateUrl) {
			new Notice(
				'Please configure Strapi article create URL in the plugin settings'
			)
			return false
		}

		if (!settings.strapiContentAttributeName) {
			new Notice(
				'Please configure Strapi content attribute name in the plugin settings'
			)
			return false
		}
	}

	new Notice('All settings are ok, processing Markdown content...')
	return true
}
