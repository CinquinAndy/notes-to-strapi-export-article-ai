import { TFile, App } from 'obsidian'
import { StrapiExporterSettings, RouteConfig } from '../types/settings'
import { ImageSelectionModal } from '../components/ImageSelectionModal'
import { extractFrontMatter } from './frontmatter-generator'

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

	const imageFields = getImageFields(currentRoute)

	if (!frontMatter) {
		console.log('3. No existing front matter, creating a basic one')
		frontMatter = createBasicFrontMatter(currentRoute.fieldMappings)
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

function getImageFields(route: RouteConfig): string[] {
	return Object.entries(route.fieldMappings)
		.filter(
			([_, config]) =>
				config.obsidianSource === 'frontmatter' &&
				config.transform?.includes('image')
		)
		.map(([key, _]) => key)
}

function createBasicFrontMatter(
	fieldMappings: RouteConfig['fieldMappings']
): string {
	return Object.entries(fieldMappings)
		.filter(([_, config]) => config.obsidianSource === 'frontmatter')
		.map(([key, _]) => `${key}: `)
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
