import { generateText, Output } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

/**
 * Interface for field analysis result
 */
interface FieldAnalysis {
	imageFields: Array<{
		fieldName: string
		fieldType: 'single-image' | 'gallery' | 'other'
		required: boolean
		description: string
	}>
	metadataFields: Array<{
		fieldName: string
		valueType: string
		description: string
	}>
	contentFields: Array<{
		fieldName: string
		contentType: string
		format?: string
	}>
}

export interface FieldAnalyzerOptions {
	openaiApiKey: string
}

export class StructuredFieldAnalyzer {
	private model

	constructor(options: FieldAnalyzerOptions) {
		const openai = createOpenAI({
			apiKey: options.openaiApiKey,
		})
		// updated to gpt-5-mini
		this.model = openai.chat('gpt-5-mini')
	}

	/**
	 * Analyze JSON schema to identify field types and purposes
	 */
	async analyzeSchema(schema: string): Promise<FieldAnalysis> {
		try {
			const { output } = await generateText({
				model: this.model,
				output: Output.json(),
				prompt: this.buildAnalysisPrompt(schema),
			})

			return output as unknown as FieldAnalysis
		} catch (error) {
			throw new Error(`Schema analysis failed: ${error.message}`)
		}
	}

	private buildAnalysisPrompt(schema: string): string {
		return `Analyze the following JSON schema and identify:
    - Image fields (single images and galleries)
    - Metadata fields (SEO, tags, dates, etc.)
    - Content fields (text, rich text, markdown)

    Return a JSON object with this exact structure:
    {
      "imageFields": [{ "fieldName": string, "fieldType": "single-image" | "gallery" | "other", "required": boolean, "description": string }],
      "metadataFields": [{ "fieldName": string, "valueType": string, "description": string }],
      "contentFields": [{ "fieldName": string, "contentType": string, "format": string (optional) }]
    }

    Schema to analyze:
    ${schema}

    Focus on identifying field types, required status, and provide clear descriptions.`
	}
}
