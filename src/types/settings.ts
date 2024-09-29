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

export interface StrapiExporterSettings {
	strapiUrl: string
	strapiApiToken: string
	routes: RouteConfig[]
}

export interface AnalyzedContent {
	[key: string]: any
}
