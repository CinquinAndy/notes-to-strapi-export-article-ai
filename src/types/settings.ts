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
	contentType: string
	fieldMappings: {
		[strapiField: string]: {
			obsidianSource: 'frontmatter' | 'content'
			frontmatterKey?: string
			transform?: (value: any) => any
		}
	}
}

interface StrapiExporterSettings {
	strapiUrl: string
	strapiApiToken: string
	routes: RouteConfig[]
}

export interface FieldConfig {
	obsidianField: string
	transformation: string
	description: string
	type: string
	format: string
}
