export interface RouteConfig {
	id: string
	name: string
	icon: string
	url: string
	contentType: string
	enabled: boolean
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
	routes: RouteConfig[]
	currentTab: string
}

export interface AnalyzedContent {
	[key: string]: any
}
