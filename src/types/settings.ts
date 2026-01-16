import { RouteConfig } from './route'

export interface StrapiExporterSettings {
	// API Settings
	strapiUrl: string
	strapiApiToken: string
	forvoyezApiKey: string
	openaiApiKey: string

	// UI Settings
	currentTab: string
	currentConfigRouteId?: string // Persist selected route in Configuration tab

	// Routes Configuration
	routes: RouteConfig[]

	lastExport?: {
		date: string
		status: 'success' | 'failure'
		message?: string
	}
}

export interface AnalyzedContent {
	[key: string]: any
	content?: string
	meta?: Record<string, any>
}
