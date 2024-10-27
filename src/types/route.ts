export interface RouteConfig {
	id: string
	name: string
	icon: string
	enabled: boolean
	url: string

	// Content Configuration
	contentType: string
	contentField: string
	description: string
	subtitle: string

	// Schema Configuration
	schema: string
	schemaDescription: string
	language: string

	// Field Mappings
	fieldMappings: Record<string, FieldMapping>
	additionalInstructions?: string
}

export interface FieldMapping {
	obsidianSource: 'frontmatter' | 'content'
	frontmatterKey?: string
	type?: string
	format?: string
	required?: boolean
	transform?: string | ((value: any) => any) // Support des transformations fonction ou string
	validation?: {
		type: string
		pattern?: string
		min?: number
		max?: number
	}
	value?: string
}

export interface RouteConfig {
	id: string
	name: string
	schema: string
	schemaDescription: string
	language: string
	contentField: string
	fieldMappings: Record<string, FieldMapping>
	additionalInstructions?: string
}

export interface FieldValidation {
	type: string
	pattern?: string
	min?: number
	max?: number
	required?: boolean
	custom?: (value: any) => boolean
}

export interface RouteStats {
	totalExports: number
	successfulExports: number
	failedExports: number
	lastExport?: {
		date: string
		status: 'success' | 'failure'
	}
}
