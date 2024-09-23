import { OpenAI } from 'openai'
import { StrapiExporterSettings } from '../types/settings'
import { ArticleContent } from '../types/article'
import { Notice } from 'obsidian'

/**
 * Generate article content using OpenAI
 * @param content
 * @param openai
 * @param settings
 * @param useAdditionalCallAPI
 */
export async function generateArticleContent(
	content: string,
	openai: OpenAI,
	settings: StrapiExporterSettings,
	useAdditionalCallAPI = false
): Promise<ArticleContent> {
	let jsonTemplate: any
	let jsonTemplateDescription: any
	let contentAttributeName: string

	if (useAdditionalCallAPI) {
		jsonTemplate = JSON.parse(settings.additionalJsonTemplate)
		jsonTemplateDescription = JSON.parse(
			settings.additionalJsonTemplateDescription
		)
		contentAttributeName = settings.additionalContentAttributeName
	} else {
		jsonTemplate = JSON.parse(settings.jsonTemplate)
		jsonTemplateDescription = JSON.parse(settings.jsonTemplateDescription)
		contentAttributeName = settings.strapiContentAttributeName
	}

	const articlePrompt = `You are an SEO expert. Generate an article based on the following template and field descriptions:

    Template:
    ${JSON.stringify(jsonTemplate, null, 2)}
    
    Field Descriptions:
    ${JSON.stringify(jsonTemplateDescription, null, 2)}
    
    The main content of the article should be based on the following text and all the keywords around the domain of the text:
    ----- CONTENT -----
    ${content.substring(0, 500)}
    ----- END CONTENT -----
    
    Please provide the generated article content as a JSON object following the given template structure.
    
    ${settings.additionalPrompt ? `Additional Prompt: ${settings.additionalPrompt}` : ''}`

	const completion = await openai.chat.completions.create({
		model: 'gpt-3.5-turbo-0125',
		messages: [
			{
				role: 'user',
				content: articlePrompt,
			},
		],
		max_tokens: 2000,
		n: 1,
		stop: null,
	})

	let articleContent = JSON.parse(completion.choices[0].message.content ?? '{}')
	articleContent = {
		data: {
			...articleContent.data,
			[contentAttributeName]: content,
		},
	}

	return articleContent
}

/**
 * Get the description of the image using OpenAI
 * @param imageBlob
 * @param openai
 */
export const getImageDescription = async (imageBlob: Blob, openai: OpenAI) => {
	// Get the image description using the OpenAI API (using gpt 4 vision preview model)
	// @ts-ignore
	const response = await openai.chat.completions.create({
		model: 'gpt-4-vision-preview',
		messages: [
			{
				role: 'user',
				content: [
					{
						type: 'text',
						text: `What's in this image? make it simple, i just want the context and an idea(think about alt text)`,
					},
					// {
					// 	type: 'image_url',
					// 	// Encode imageBlob as base64
					// 	// @ts-ignore
					// 	image_url: `data:image/png;base64,${btoa(
					// 		new Uint8Array(await imageBlob.arrayBuffer()).reduce(
					// 			(data, byte) => data + String.fromCharCode(byte),
					// 			''
					// 		)
					// 	)}`,
					// },
				],
			},
		],
	})

	new Notice(response.choices[0].message.content ?? 'no response content...')
	new Notice(
		`prompt_tokens: ${response.usage?.prompt_tokens} // completion_tokens: ${response.usage?.completion_tokens} // total_tokens: ${response.usage?.total_tokens}`
	)

	// gpt-3.5-turbo-0125
	// Generate alt text, caption, and title for the image, based on the description of the image
	const completion = await openai.chat.completions.create({
		model: 'gpt-3.5-turbo-0125',
		messages: [
			{
				role: 'user',
				content: `You are an SEO expert and you are writing alt text, caption, and title for this image. The description of the image is: ${response.choices[0].message.content}.
				Give me a title (name) for this image, an SEO-friendly alternative text, and a caption for this image.
				Generate this information and respond with a JSON object using the following fields: name, alternativeText, caption.
				Use this JSON template: {"name": "string", "alternativeText": "string", "caption": "string"}.`,
			},
		],
		max_tokens: 750,
		n: 1,
		stop: null,
	})

	new Notice(completion.choices[0].message.content ?? 'no response content...')
	new Notice(
		`prompt_tokens: ${completion.usage?.prompt_tokens} // completion_tokens: ${completion.usage?.completion_tokens} // total_tokens: ${completion.usage?.total_tokens}`
	)

	return JSON.parse(completion.choices[0].message.content?.trim() || '{}')
}
