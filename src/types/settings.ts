/**
 * The settings for the Strapi Exporter plugin
 */
export interface StrapiExporterSettings {
	strapiUrl: string
	strapiApiToken: string
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
	mainImage: string
	mainButtonImageEnabled: boolean
	mainGalery: string
	mainButtonGaleryEnabled: boolean
	additionalImage: string
	additionalButtonImageEnabled: boolean
	additionalGalery: string
	additionalButtonGaleryEnabled: boolean
	mainImageFullPathProperty: string
	mainGaleryFullPathProperty: string
	additionalImageFullPathProperty: string
	additionalGaleryFullPathProperty: string
}
