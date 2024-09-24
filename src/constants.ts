// src/constants.ts
import { StrapiExporterSettings } from './types/settings'

export const DEFAULT_STRAPI_EXPORTER_SETTINGS: StrapiExporterSettings = {
	strapiUrl: '',
	strapiApiToken: '',
	openaiApiKey: '',
	strapiSchema: '',
	schemaDescription: '',
	generatedConfig: '',
	fieldMappings: {},
	additionalInstructions: '',
	strapiTemplate: {},
	currentTab: 'dashboard',
	forvoyezApiKey: '',
	routes: [
		{
			id: 'default-route',
			icon: 'upload',
			name: 'Default Route',
			description: 'Default export route',
			enabled: true,
			url: '',
			language: 'en',
			subtitle: '',
			schema: '',
			schemaDescription: '',
			contentField: '',
			generatedConfig: '',
		},
	],
	targetLanguage: 'en',
}
