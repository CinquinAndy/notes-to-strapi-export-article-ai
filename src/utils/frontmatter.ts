import { TFile, App } from 'obsidian'
import OpenAI from 'openai'
import { StrapiExporterSettings } from '../types/settings'

export async function generateFrontMatterWithOpenAI(
	file: TFile,
	app: App,
	settings: StrapiExporterSettings,
	routeId: string
) {
	const existingContent = await app.vault.read(file)
	const frontMatter = extractFrontMatter(existingContent)

	if (frontMatter) {
		console.log('Front matter already exists')
		return
	}

	const openai = new OpenAI({ apiKey: settings.openaiApiKey })

	const currentRoute = settings.routes.find(route => route.id === routeId)
	if (!currentRoute) {
		throw new Error('Route not found')
	}

	const generatedConfig = JSON.parse(currentRoute.generatedConfig)
	const schemaDescription = currentRoute.schemaDescription

	const prompt = `Generate YAML front matter for the following Markdown content. Use the provided schema description and field mappings to inform the structure and content of the front matter. Ensure all required fields are included and the YAML is valid.

Schema Description:
${schemaDescription}

Field Mappings:
${JSON.stringify(generatedConfig.fieldMappings, null, 2)}

Content (first 1000 characters):
${existingContent.substring(0, 1000)}

Generate the front matter in YAML format, starting and ending with ---. Use the content to inform these fields where possible. For missing information, use appropriate placeholders or generate relevant content based on the field descriptions.`

	try {
		const response = await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [{ role: 'user', content: prompt }],
			max_tokens: 1000,
		})

		const generatedFrontMatter =
			response?.choices[0]?.message?.content?.trim() || ''
		const newContent = `${generatedFrontMatter}\n\n${existingContent}`
		await app.vault.modify(file, newContent)
		console.log('Front matter generated and added to the note')
	} catch (error) {
		console.error('Error generating front matter with OpenAI:', error)
		throw error
	}
}

export function extractFrontMatter(content: string): string | null {
	const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---/
	const match = content.match(frontMatterRegex)
	return match ? match[1] : null
}
