import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { Logger } from '../utils/logger'

export class ConfigurationGenerator {
	private model

	constructor(options: { openaiApiKey: string }) {
		Logger.info('ConfigGenerator', 'Initializing')

		const openai = createOpenAI({
			apiKey: options.openaiApiKey,
		})

		this.model = openai('gpt-4o-mini')
	}

	async generateConfiguration(params: {
		schema: string
		schemaDescription: string
		language: string
		additionalInstructions?: string
	}) {
		Logger.info('ConfigGenerator', 'Starting generation')
		console.log('params.schema', params.schema)
		console.log('params.schemaDescription', params.schemaDescription)

		try {
			// Parse input schemas
			const schema = JSON.parse(params.schema)
			const descriptions = JSON.parse(params.schemaDescription)

			Logger.debug('ConfigGenerator', 'Parsed inputs', {
				schemaFields: Object.keys(schema.data),
				descriptions: Object.keys(descriptions.data),
			})

			// Generate field configurations
			const { object } = await generateObject({
				model: this.model,
				output: 'no-schema',
				prompt: this.buildPrompt(
					schema.data,
					descriptions.data,
					params.language
				),
			})

			console.log('object', object)

			// Transform to final configuration
			return this.transformToConfiguration(object)
		} catch (error) {
			Logger.error('ConfigGenerator', 'Generation failed', error)
			throw error
		}
	}

	private buildPrompt(
		schema: Record<string, any>,
		descriptions: Record<string, any>,
		language: string
	): string {
		return `Analyze this Strapi schema and create field configurations:

SCHEMA:
${JSON.stringify(schema, null, 2)}

FIELD DESCRIPTIONS:
${JSON.stringify(descriptions, null, 2)}

Create a configuration where each field has:
1. type: 
   - "string" for text fields
   - "media" for image fields (when type is "string or id")
   - "array" for lists
   - "object" for complex fields
   - "number" for numeric fields

2. source:
   - "content" for the main content field
   - "frontmatter" for frontmatter fields

3. description:
   - Use the provided descriptions
   - Keep descriptions in ${language}
   - Make them clear and concise

4. required: 
   - true for essential fields (title, content)
   - false for optional fields

5. format (when applicable):
   - "url" for media fields
   - "slug" for URL-friendly fields

Example field configuration:
{
  "title": {
    "type": "string",
    "description": "The main title of the article",
    "required": true,
    "source": "frontmatter"
  },
  "image_presentation": {
    "type": "media",
    "description": "Main article image",
    "required": true,
    "source": "frontmatter",
    "format": "url"
  }, 
  "content": {
  		"type": "string",
			"description": "The main content of the article",
			"required": true,
			"source": "content"
		}
}

Generate field configurations maintaining the original schema structure.`
	}

	private transformToConfiguration(generated: any) {
		// Transform the output to the expected format
		let fieldMappings = {}
		if (!generated.fields) {
			fieldMappings = Object.entries(generated).reduce(
				(acc, [key, field]: [string, any]) => ({
					...acc,
					[key]: {
						obsidianSource: field.source,
						type: field.type,
						description: field.description,
						required: field.required,
						...(field.format && { format: field.format }),
						...(field.type === 'media' && {
							validation: {
								type: 'string',
								pattern: '^https?://.+',
							},
						}),
						...(field.type === 'array' && {
							transform: this.getArrayTransform(key),
						}),
					},
				}),
				{}
			)
		} else {
			fieldMappings = Object.entries(generated.fields).reduce(
				(acc, [key, field]: [string, any]) => ({
					...acc,
					[key]: {
						obsidianSource: field.source,
						type: field.type,
						description: field.description,
						required: field.required,
						...(field.format && { format: field.format }),
						...(field.type === 'media' && {
							validation: {
								type: 'string',
								pattern: '^https?://.+',
							},
						}),
						...(field.type === 'array' && {
							transform: this.getArrayTransform(key),
						}),
					},
				}),
				{}
			)
		}

		return {
			fieldMappings,
			contentField: 'content',
		}
	}

	private getArrayTransform(fieldName: string): string {
		const transforms = {
			gallery:
				'value => Array.isArray(value) ? value : value.split(",").map(url => url.trim())',
			tags: 'value => Array.isArray(value) ? value : value.split(",").map(tag => ({ name: tag.trim() }))',
			links: `value => Array.isArray(value) ? value : value.split(";").map(link => {
        const [label, url] = link.split("|").map(s => s.trim());
        return { label, url };
      })`,
		}

		return (
			transforms[fieldName] || 'value => Array.isArray(value) ? value : [value]'
		)
	}
}
