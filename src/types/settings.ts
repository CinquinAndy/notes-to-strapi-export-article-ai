export interface RouteConfig {
	id: string
	name: string
	icon: string
	url: string
	description: string
	subtitle: string
	contentType: string
	enabled: boolean
	schema: string
	schemaDescription: string
	language: string
	contentField: string
	additionalInstructions: string
	fieldMappings: {
		[key: string]: {
			obsidianSource: 'frontmatter' | 'content'
			transform?: string | ((value: any) => any)
			frontmatterKey?: string
		}
	}
}

export interface StrapiExporterSettings {
	strapiUrl: string
	strapiApiToken: string
	forvoyezApiKey: string
	openaiApiKey: string
	settings: StrapiExporterSettings
	saveSettings: () => Promise<void>
	generatedConfig: string
	routes: RouteConfig[]
	currentTab: string
}

export interface AnalyzedContent {
	[key: string]: any
}
