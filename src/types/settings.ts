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
	name: string
	icon: string
	url: string
	description: string
	subtitle: string
	enabled: boolean
	schema: string
	schemaDescription: string
	generatedConfig: string
	language: string
	imageProperty?: string
	galleryProperty?: string
	contentPlaceholder: string
}
