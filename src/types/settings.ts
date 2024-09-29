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
		[strapiField: string]: {
			obsidianSource: 'frontmatter' | 'content'
			frontmatterKey?: string
			transform?: (value: any) => any
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
