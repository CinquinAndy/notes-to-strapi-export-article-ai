import { TFile, App } from 'obsidian'
import OpenAI from 'openai'
import { StrapiExporterSettings } from '../types/settings'

function transformImageLinks(content: string): string {
	const regex = /!\[(.*?)\]\((.*?)\)/g
	return content.replace(regex, (match, alt, link) => {
		// Check if the link is an external URL
		if (link.startsWith('http://') || link.startsWith('https://')) {
			return link // Return just the link for external URLs
		}
		return match // Return the original match for internal links
	})
}

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

	const openai = new OpenAI({
		apiKey: settings.openaiApiKey,
		dangerouslyAllowBrowser: true,
	})

	const currentRoute = settings.routes.find(route => route.id === routeId)
	if (!currentRoute) {
		throw new Error('Route not found')
	}

	const generatedConfig = JSON.parse(currentRoute.generatedConfig)
	const schemaDescription = currentRoute.schemaDescription

	// Find the content field
	const contentField = Object.keys(generatedConfig.fieldMappings).find(
		key => generatedConfig.fieldMappings[key].obsidianField === 'content'
	)

	const imageFields: string[] = []

	const frontMatterFields = Object.entries(
		generatedConfig.fieldMappings
	).reduce((acc, [key, value]) => {
		if (key !== contentField) {
			if (value.type === 'string' && value.format === 'url') {
				imageFields.push(key)
			} else {
				acc[key] = value
			}
		}
		return acc
	}, {})

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
		const response = await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [{ role: 'user', content: prompt }],
			max_tokens: 1000,
		})

		let generatedFrontMatter =
			response?.choices[0]?.message?.content?.trim() || ''

		console.log('Generated front matter:', generatedFrontMatter)

		// Remove any extra backticks or yaml indicators that might have been added
		generatedFrontMatter = generatedFrontMatter
			.replace(/```yaml\n?/g, '')
			.replace(/```\n?/g, '')

		// Transform image links in the generated front matter
		generatedFrontMatter = transformImageLinks(generatedFrontMatter)

		// Ensure the front matter starts and ends with ---
		if (!generatedFrontMatter.startsWith('---')) {
			generatedFrontMatter = '---\n' + generatedFrontMatter
		}
		if (!generatedFrontMatter.endsWith('---')) {
			generatedFrontMatter = generatedFrontMatter + '\n---'
		}

		const newContent = `${generatedFrontMatter}\n\n${existingContent}`
		await app.vault.modify(file, newContent)
		console.log('Front matter generated and added to the note')

		console.log('Front matter generated and added to the note')
		return { frontMatter: generatedFrontMatter, imageFields }
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
