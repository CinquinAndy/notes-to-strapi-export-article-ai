import { StrapiExporterSettings } from './types/settings'

export const DEFAULT_STRAPI_EXPORTER_SETTINGS: StrapiExporterSettings = {
	strapiUrl: '',
	strapiApiToken: '',
	forvoyezApiKey: '',
	openaiApiKey: '',
	currentTab: 'dashboard',
	routes: [
		{
			id: 'default-route',
			name: 'Default Route',
			icon: 'upload',
			url: '',
			contentType: 'articles',
			enabled: true,
			fieldMappings: {},
		},
	],
}
