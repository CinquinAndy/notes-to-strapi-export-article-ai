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

/**
 * The default settings for the plugin
 */
export const DEFAULT_STRAPI_EXPORTER_SETTINGS: StrapiExporterSettings = {
	strapiUrl: '',
	strapiApiToken: '',
	openaiApiKey: '',
	jsonTemplate: `{
    "data": {
      "title": "string",
      "seo_title": "string",
      "seo_description": "string",
      "slug": "string",
      "excerpt": "string",
      "links": [
        {
          "id": "number",
          "label": "string",
          "url": "string"
        }
      ],
      "subtitle": "string",
      "type": "string",
      "rank": "number",
      "tags": [
        {
          "id": "number",
          "name": "string"
        }
      ],
      "locale": "string"
    }
  }`,
	jsonTemplateDescription: `{
    "data": {
      "title": "Title of the item, as a short string",
      "seo_title": "SEO optimized title, as a short string",
      "seo_description": "SEO optimized description, as a short string",
      "slug": "URL-friendly string derived from the title",
      "excerpt": "A short preview or snippet from the content",
      "links": "Array of related links with ID, label, and URL",
      "subtitle": "Subtitle or secondary title, as a short string",
      "type": "Category or type of the item, as a short string",
      "rank": "Numerical ranking or order priority, as a number",
      "tags": "Array of associated tags with ID and name",
      "locale": "Locale or language code, as a short string"
    }
  }`,
	strapiArticleCreateUrl: '',
	strapiContentAttributeName: '',
	additionalPrompt: '',
	enableAdditionalApiCall: false,
	additionalJsonTemplate: '',
	additionalJsonTemplateDescription: '',
	additionalUrl: '',
	additionalContentAttributeName: '',
	mainImage: '',
	mainButtonImageEnabled: false,
	mainGalery: '',
	mainButtonGaleryEnabled: false,
	additionalImage: '',
	additionalButtonImageEnabled: false,
	additionalGalery: '',
	additionalButtonGaleryEnabled: false,
	mainImageFullPathProperty: '',
	mainGaleryFullPathProperty: '',
	additionalImageFullPathProperty: '',
	additionalGaleryFullPathProperty: '',
}
