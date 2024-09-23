// src/types/settings.ts
export interface StrapiExporterSettings {
	strapiUrl: string
	strapiApiToken: string
	openaiApiKey: string
	strapiSchema: string
	schemaDescription: string
	generatedConfig: string
	fieldMappings: {
		[key: string]: {
			obsidianField: string
			transformation: string
			description: string
		}
	}
	additionalInstructions: string
	strapiTemplate: any
	forvoyezApiKey: string
	routes: RouteConfig[]
	targetLanguage: string
	currentTab: string
}

export interface RouteConfig {
	id: string
	icon: string
	name: string
	description: string
	enabled: boolean
	url: string
	language: string
}
