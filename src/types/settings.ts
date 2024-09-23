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
	strapiTemplate: any // This will hold the JSON template for Strapi
	forvoyezApiKey: string
	routes: RouteConfig[]
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
