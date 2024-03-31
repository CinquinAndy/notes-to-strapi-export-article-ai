// src/api/openaiAPI.ts
import OpenAI from 'openai'
import { Notice } from 'obsidian'

export async function getImageDescription(imageBlob: Blob, openai: OpenAI) {
	const response = await openai.chat.completions.create({
		model: 'gpt-4-vision-preview',
		messages: [
			{
				role: 'user',
				// @ts-ignore
				content: [
					{
						type: 'text',
						text: `What's in this image? make it simple, i just want the context and an idea(think about alt text)`,
					},
					{
						type: 'image_url',
						image_url: `data:image/png;base64,${btoa(
							new Uint8Array(await imageBlob.arrayBuffer()).reduce(
								(data, byte) => data + String.fromCharCode(byte),
								''
							)
						)}`,
					},
				],
			},
		],
	})

	new Notice(response.choices[0].message.content ?? 'no response content...')
	new Notice(
		`prompt_tokens: ${response.usage?.prompt_tokens} // completion_tokens: ${response.usage?.completion_tokens} // total_tokens: ${response.usage?.total_tokens}`
	)

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
