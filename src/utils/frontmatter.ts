import { TFile, App } from 'obsidian'
import { StrapiExporterSettings } from '../types/settings'
import { ImageSelectionModal } from '../components/ImageSelectionModal'

export async function processFrontMatter(
	file: TFile,
	app: App,
	settings: StrapiExporterSettings,
	routeId: string
): Promise<{ frontMatter: string; imageFields: string[] }> {
	console.log('1. Starting processFrontMatter')

	const existingContent = await app.vault.read(file)
	let frontMatter = extractFrontMatter(existingContent)

	const currentRoute = settings.routes.find(route => route.id === routeId)
	if (!currentRoute) {
		console.log('2. Route not found, throwing error')
		throw new Error('Route not found')
	}

	const generatedConfig = JSON.parse(currentRoute.generatedConfig)
	const imageFields = Object.entries(generatedConfig.fieldMappings)
		.filter(
			([_, config]) => config.type === 'string' && config.format === 'url'
		)
		.map(([key, _]) => key)

	if (!frontMatter) {
		console.log('3. No existing front matter, creating a basic one')
		frontMatter = createBasicFrontMatter(generatedConfig.fieldMappings)
	}

	console.log('4. Processing image fields')
	if (imageFields.length > 0) {
		frontMatter = await processImageFields(
			frontMatter,
			imageFields,
			app,
			settings
		)
	}

	console.log('5. Updating file content')
	const newContent = `---\n${frontMatter}\n---\n\n${existingContent.replace(/^---[\s\S]*?---\n/, '')}`
	await app.vault.modify(file, newContent)

	console.log('6. Finished processFrontMatter')
	return { frontMatter, imageFields }
}

function extractFrontMatter(content: string): string | null {
	const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---/
	const match = content.match(frontMatterRegex)
	return match ? match[1] : null
}

function createBasicFrontMatter(fieldMappings: any): string {
	return Object.keys(fieldMappings)
		.filter(key => fieldMappings[key].obsidianField !== 'content')
		.map(key => `${key}: `)
		.join('\n')
}

async function processImageFields(
	frontMatter: string,
	imageFields: string[],
	app: App,
	settings: StrapiExporterSettings
): Promise<string> {
	for (const field of imageFields) {
		const imageValue = await new Promise<string>(resolve => {
			new ImageSelectionModal(app, false, images => {
				resolve(images[0] || '')
			}).open()
		})

		const regex = new RegExp(`${field}:.*`, 'g')
		frontMatter = frontMatter.replace(regex, `${field}: ![[${imageValue}]]`)
	}
	return frontMatter
}
