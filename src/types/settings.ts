// src/types/settings.ts
export interface StrapiExporterSettings {
	strapiUrl: string
	strapiApiToken: string
	forvoyezApiKey: string
	openaiApiKey: string
	strapiSchema: string
	schemaDescription: string
	generatedConfig: string
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
