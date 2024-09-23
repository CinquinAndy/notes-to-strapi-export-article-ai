// src/constants.ts
import { StrapiExporterSettings } from './types/settings'

export const DEFAULT_STRAPI_EXPORTER_SETTINGS: StrapiExporterSettings = {
	strapiUrl: '',
	strapiApiToken: '',
	forvoyezApiKey: '',
	openaiApiKey: '',
	strapiSchema: '',
	schemaDescription: '',
	generatedConfig: '',
	routes: [
		{
			id: 'default-route',
			icon: 'upload',
			name: 'Default Route',
			description: 'Default export route',
			enabled: true,
			url: '',
			language: 'en',
		},
	],
	currentTab: 'dashboard',
}
