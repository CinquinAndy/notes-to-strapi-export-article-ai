import { TFile, App } from 'obsidian'
import OpenAI from 'openai'
import { StrapiExporterSettings } from '../types/settings'
import { ImageFieldsModal } from './image-fields-modal'

function transformImageLinks(content: string): string {
	const regex = /!\[(.*?)\]\((.*?)\)/g
	return content.replace(regex, (match, alt, link) => {
		if (link.startsWith('http://') || link.startsWith('https://')) {
			return link
		}
		return match
	})
}

export async function generateFrontMatterWithOpenAI(
	file: TFile,
	app: App,
	settings: StrapiExporterSettings,
	routeId: string
): Promise<{ frontMatter: string; imageFields: string[] }> {
	console.log('1. Starting generateFrontMatterWithOpenAI')

	const existingContent = await app.vault.read(file)
	const frontMatter = extractFrontMatter(existingContent)

	if (frontMatter) {
		console.log('2. Existing front matter found, exiting function')
		return { frontMatter, imageFields: [] }
	}

	console.log('3. Creating OpenAI instance')
	const openai = new OpenAI({
		apiKey: settings.openaiApiKey,
		dangerouslyAllowBrowser: true,
	})

	const currentRoute = settings.routes.find(route => route.id === routeId)
	if (!currentRoute) {
		console.log('4. Route not found, throwing error')
		throw new Error('Route not found')
	}

	console.log('5. Preparing data for generation')
	const generatedConfig = JSON.parse(currentRoute.generatedConfig)
	const schemaDescription = currentRoute.schemaDescription

	const contentField = Object.keys(generatedConfig.fieldMappings).find(
		key => generatedConfig.fieldMappings[key].obsidianField === 'content'
	)

	const imageFields: string[] = []
	const frontMatterFields = Object.entries(
		generatedConfig.fieldMappings
	).reduce<Record<string, any>>((acc, [key, value]: [string, any]) => {
		if (key !== contentField) {
			if (value.type === 'string' && value.format === 'url') {
				imageFields.push(key)
			} else {
				acc[key] = value
			}
		}
		return acc
	}, {})

	console.log('6. Creating prompt for OpenAI')
	const prompt = `Generate YAML front matter for the following Markdown content. Use the provided schema description and field mappings to inform the structure and content of the front matter. Ensure all required fields are included and the YAML is valid.

Schema Description:
${schemaDescription}

Field Mappings:
${JSON.stringify(frontMatterFields, null, 2)}

Content (first 1000 characters):
${existingContent.substring(0, 1000)}

Generate the front matter in YAML format, starting and ending with ---. Do not include any extra formatting or code blocks. Use the content to inform these fields where possible. For missing information, use appropriate placeholders or generate relevant content based on the field descriptions.

For image fields, use the full Markdown image syntax: ![alt text](image_url)

Do not include the main content field "${contentField}" in the front matter.
`

	try {
		console.log('7. Calling OpenAI API')
		const response = await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [{ role: 'user', content: prompt }],
			max_tokens: 1000,
		})

		console.log('8. Processing OpenAI response')
		let generatedFrontMatter =
			response?.choices[0]?.message?.content?.trim() || ''

		console.log('9. Generated front matter:', generatedFrontMatter)

		generatedFrontMatter = generatedFrontMatter
			.replace(/```yaml\n?/g, '')
			.replace(/```\n?/g, '')

		generatedFrontMatter = transformImageLinks(generatedFrontMatter)

		if (!generatedFrontMatter.startsWith('---')) {
			generatedFrontMatter = '---\n' + generatedFrontMatter
		}
		if (!generatedFrontMatter.endsWith('---')) {
			generatedFrontMatter = generatedFrontMatter + '\n---'
		}

		console.log('10. Identifying image fields')
		const imageFields = Object.entries(generatedConfig.fieldMappings)
			.filter(
				([_, config]) => config.type === 'string' && config.format === 'url'
			)
			.map(([key, _]) => key)

		console.log('10. Opening modal for images')
		if (imageFields.length > 0) {
			console.log('11. Opening modal for image fields')
			const imageValues = await new Promise<Record<string, string>>(resolve => {
				new ImageFieldsModal(
					app,
					imageFields,
					imageValues => {
						console.log('12. Image values received:', imageValues)
						resolve(imageValues)
					},
					settings
				).open()
			})

			console.log('13. Updating front matter with image values')
			for (const [field, value] of Object.entries(imageValues)) {
				const regex = new RegExp(`${field}:.*`, 'g')
				generatedFrontMatter = generatedFrontMatter.replace(
					regex,
					`${field}: "![[${value}]]"`
				)
			}
		}

		console.log('14. Updating file content')
		const newContent = `${generatedFrontMatter}\n\n${existingContent}`
		await app.vault.modify(file, newContent)

		console.log('15. Finished generateFrontMatterWithOpenAI')
		return { frontMatter: generatedFrontMatter, imageFields }
	} catch (error) {
		console.error('15. Error generating front matter:', error)
		throw error
	}
}

export function extractFrontMatter(content: string): string | null {
	const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---/
	const match = content.match(frontMatterRegex)
	return match ? match[1] : null
}
