import { z } from 'zod'
import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

/**
 * Schema for field analysis result
 */
const fieldAnalysisSchema = z.object({
	imageFields: z.array(
		z.object({
			fieldName: z.string(),
			fieldType: z.enum(['single-image', 'gallery', 'other']),
			required: z.boolean(),
			description: z.string(),
		})
	),
	metadataFields: z.array(
		z.object({
			fieldName: z.string(),
			valueType: z.string(),
			description: z.string(),
		})
	),
	contentFields: z.array(
		z.object({
			fieldName: z.string(),
			contentType: z.string(),
			format: z.string().optional(),
		})
	),
})

type FieldAnalysis = z.infer<typeof fieldAnalysisSchema>

export interface FieldAnalyzerOptions {
	openaiApiKey: string
}

export class StructuredFieldAnalyzer {
	private model

	constructor(options: FieldAnalyzerOptions) {
		const openai = createOpenAI({
			apiKey: options.openaiApiKey,
		})
		this.model = openai('gpt-5-mini', {
			structuredOutputs: true,
		})
	}

	/**
	 * Analyze JSON schema to identify field types and purposes
	 */
	async analyzeSchema(schema: string): Promise<FieldAnalysis> {
		try {
			const { object } = await generateObject({
				model: this.model,
				schema: fieldAnalysisSchema,
				schemaName: 'SchemaAnalysis',
				schemaDescription:
					'Analysis of content schema fields to identify types and purposes',
				prompt: this.buildAnalysisPrompt(schema),
			})

			return object as FieldAnalysis
		} catch (error) {
			throw new Error(`Schema analysis failed: ${error.message}`)
		}
	}

	private buildAnalysisPrompt(schema: string): string {
		return `Analyze the following JSON schema and identify:
    - Image fields (single images and galleries)
    - Metadata fields (SEO, tags, dates, etc.)
    - Content fields (text, rich text, markdown)

    Provide structured categorization of all fields with their purposes and data types.

    Schema to analyze:
    ${schema}

    Focus on identifying field types, required status, and provide clear descriptions.`
	}
}
