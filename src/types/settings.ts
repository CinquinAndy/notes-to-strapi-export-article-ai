/**
 * The settings for the Strapi Exporter plugin
 */
export interface StrapiExporterSettings {
	strapiUrl: string
	strapiApiToken: string
	forvoyezApiKey: string
	openaiApiKey: string
	jsonTemplate: string
	jsonTemplateDescription: string
	strapiArticleCreateUrl: string
	strapiContentAttributeName: string
	additionalPrompt: string
	enableAdditionalApiCall: boolean
	additionalJsonTemplate: string
	additionalJsonTemplateDescription: string
	additionalUrl: string
	additionalContentAttributeName: string
	// enable elements
	mainButtonImageEnabled: boolean
	mainButtonGalleryEnabled: boolean
	additionalButtonImageEnabled: boolean
	additionalButtonGalleryEnabled: boolean
	// images and galleries paths (for the body api call)
	mainImageFullPathProperty: string
	mainGalleryFullPathProperty: string
	additionalImageFullPathProperty: string
	additionalGalleryFullPathProperty: string
}
