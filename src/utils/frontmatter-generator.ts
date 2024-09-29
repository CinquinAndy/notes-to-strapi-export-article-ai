import { ImageSelectionModal } from '../components/ImageSelectionModal'

export async function generateFrontMatter(
	analysis: FieldAnalysis[],
	existingContent: string
): Promise<string> {
	let frontMatter = '---\n'

	for (const field of analysis) {
		let value = ''

		if (field.fieldType === 'image' || field.fieldType === 'imageArray') {
			const isMultiple = field.fieldType === 'imageArray'
			value = await new Promise(resolve => {
				new ImageSelectionModal(app, isMultiple, images => {
					resolve(isMultiple ? JSON.stringify(images) : images[0] || '')
				}).open()
			})
		} else {
			// Extract value from existing content or use a placeholder
			value =
				extractValueFromContent(existingContent, field.fieldName) ||
				`<${field.fieldName}>`
		}

		frontMatter += `${field.fieldName}: ${value}\n`
	}

	frontMatter += '---\n'
	return frontMatter
}

function extractValueFromContent(
	content: string,
	fieldName: string
): string | null {
	// Implement logic to extract value from existing content
	// This could use regex or a markdown parser to find the value in the content
	return null // Placeholder return
}

export function extractFrontMatter(content: string): string | null {
	const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---/
	const match = content.match(frontMatterRegex)
	return match ? match[1] : null
}
