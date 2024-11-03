import { RouteConfig } from './route'

export interface StrapiExporterSettings {
	// API Settings
	strapiUrl: string
	strapiApiToken: string
	forvoyezApiKey: string
	openaiApiKey: string

	// UI Settings
	currentTab: string

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

export interface ValidationResult {
	isValid: boolean
	errors: string[]
	warnings?: string[]
}
