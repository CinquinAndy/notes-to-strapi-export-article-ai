import { TFile, App } from 'obsidian'
import { StrapiExporterSettings, RouteConfig } from '../types'
import { ImageSelectionModal } from '../components/ImageSelectionModal'
import { extractFrontMatter } from './frontmatter-generator'
import { Logger } from '../utils/logger'

/**
 * Process frontmatter of a file, handling images and field mappings
 */
export async function processFrontMatter(
	file: TFile,
	app: App,
	settings: StrapiExporterSettings,
	routeId: string
): Promise<{ frontMatter: string; imageFields: string[] }> {
	Logger.info(
		'FrontMatter',
		`108. Starting frontmatter processing for file: ${file.path}`
	)

	try {
		// Read existing content
		Logger.debug('FrontMatter', '109. Reading file content')
		const existingContent = await app.vault.read(file)
		let frontMatter = extractFrontMatter(existingContent)

		// Validate route
		Logger.debug('FrontMatter', `110. Looking for route: ${routeId}`)
		const currentRoute = settings.routes.find(route => route.id === routeId)
		if (!currentRoute) {
			Logger.error('FrontMatter', `111. Route not found: ${routeId}`)
			throw new Error(`Route not found: ${routeId}`)
		}

		// Get image fields
		Logger.debug('FrontMatter', '112. Extracting image fields')
		const imageFields = getImageFields(currentRoute)
		Logger.debug('FrontMatter', '113. Found image fields', {
			count: imageFields.length,
			fields: imageFields,
		})

		// Create basic frontmatter if none exists
		if (!frontMatter) {
			Logger.info(
				'FrontMatter',
				'114. No existing frontmatter, creating basic structure'
			)
			frontMatter = createBasicFrontMatter(currentRoute.fieldMappings)
			Logger.debug('FrontMatter', '115. Basic frontmatter created', {
				frontMatter,
			})
		}

		// Process image fields if any
		if (imageFields.length > 0) {
			Logger.info('FrontMatter', '116. Processing image fields')
			try {
				frontMatter = await processImageFields(frontMatter, imageFields, app)
				Logger.debug('FrontMatter', '117. Image fields processed', {
					frontMatter,
				})
			} catch (error) {
				Logger.error('FrontMatter', '118. Error processing image fields', error)
				throw new Error(`Failed to process image fields: ${error.message}`)
			}
		}

		// Update file content
		Logger.info('FrontMatter', '119. Updating file content')
		const newContent = constructNewContent(frontMatter, existingContent)

		try {
			await app.vault.modify(file, newContent)
			Logger.info('FrontMatter', '120. File content updated successfully')
		} catch (error) {
			Logger.error('FrontMatter', '121. Error updating file content', error)
			throw new Error(`Failed to update file content: ${error.message}`)
		}

		Logger.info('FrontMatter', '122. Frontmatter processing completed')
		return { frontMatter, imageFields }
	} catch (error) {
		Logger.error('FrontMatter', '123. Error in frontmatter processing', error)
		throw error
	}
}

/**
 * Extract image fields from route configuration
 */
function getImageFields(route: RouteConfig): string[] {
	Logger.debug(
		'FrontMatter',
		'124. Extracting image fields from route configuration'
	)

	try {
		const fields = Object.entries(route.fieldMappings)
			.filter(([_, config]) => {
				const isImageField =
					config.obsidianSource === 'frontmatter' &&
					typeof config.transform === 'string' &&
					config.transform.includes('image')

				Logger.debug('FrontMatter', '125. Checking field for image type', {
					isImageField,
					config,
				})

				return isImageField
			})
			.map(([key, _]) => key)

		Logger.debug('FrontMatter', '126. Image fields extracted', { fields })
		return fields
	} catch (error) {
		Logger.error('FrontMatter', '127. Error extracting image fields', error)
		throw new Error(`Failed to extract image fields: ${error.message}`)
	}
}

/**
 * Create basic frontmatter structure from field mappings
 */
function createBasicFrontMatter(
	fieldMappings: RouteConfig['fieldMappings']
): string {
	Logger.debug('FrontMatter', '128. Creating basic frontmatter structure')

	try {
		const frontMatter = Object.entries(fieldMappings)
			.filter(([_, config]) => config.obsidianSource === 'frontmatter')
			.map(([key, _]) => `${key}: `)
			.join('\n')

		Logger.debug('FrontMatter', '129. Basic frontmatter created', {
			frontMatter,
		})
		return frontMatter
	} catch (error) {
		Logger.error('FrontMatter', '130. Error creating basic frontmatter', error)
		throw new Error(`Failed to create basic frontmatter: ${error.message}`)
	}
}

/**
 * Process image fields in frontmatter
 */
async function processImageFields(
	frontMatter: string,
	imageFields: string[],
	app: App
): Promise<string> {
	Logger.info('FrontMatter', '131. Starting image fields processing')
	let updatedFrontMatter = frontMatter

	for (const field of imageFields) {
		Logger.debug('FrontMatter', `132. Processing image field: ${field}`)

		try {
			const imageValue = await selectImage(app)
			Logger.debug('FrontMatter', `133. Image selected for field: ${field}`, {
				imageValue,
			})

			const regex = new RegExp(`${field}:.*`, 'g')
			updatedFrontMatter = updatedFrontMatter.replace(
				regex,
				`${field}: ![[${imageValue}]]`
			)

			Logger.debug(
				'FrontMatter',
				`134. Updated frontmatter for field: ${field}`
			)
		} catch (error) {
			Logger.error(
				'FrontMatter',
				`135. Error processing image field: ${field}`,
				error
			)
			throw new Error(
				`Failed to process image field ${field}: ${error.message}`
			)
		}
	}

	Logger.info('FrontMatter', '136. Image fields processing completed')
	return updatedFrontMatter
}

/**
 * Select image using modal
 */
async function selectImage(app: App): Promise<string> {
	Logger.debug('FrontMatter', '137. Opening image selection modal')

	return new Promise<string>((resolve, reject) => {
		try {
			new ImageSelectionModal(app, false, images => {
				const selectedImage = images[0] || ''
				Logger.debug('FrontMatter', '138. Image selected', { selectedImage })
				resolve(selectedImage)
			}).open()
		} catch (error) {
			Logger.error('FrontMatter', '139. Error in image selection', error)
			reject(error)
		}
	})
}

/**
 * Construct new content with updated frontmatter
 */
function constructNewContent(
	frontMatter: string,
	existingContent: string
): string {
	Logger.debug('FrontMatter', '140. Constructing new content')
	return `---\n${frontMatter}\n---\n\n${existingContent.replace(/^---[\s\S]*?---\n/, '')}`
}
