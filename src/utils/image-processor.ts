import { App, MarkdownView, Notice, TFile, TFolder } from 'obsidian'
import { OpenAI } from 'openai'
import { StrapiExporterSettings } from '../types/settings'
import {
	uploadGaleryImagesToStrapi,
	uploadImagesToStrapi,
} from './strapi-uploader'
import { generateArticleContent, getImageDescription } from './openai-generator'

export async function processMarkdownContent(
	app: App,
	settings: StrapiExporterSettings,
	useAdditionalCallAPI = false
) {
	const activeView = app.workspace.getActiveViewOfType(MarkdownView)
	if (!activeView) {
		new Notice('No active Markdown view')
		return
	}

	// Check if all the settings are configured
	/** ****************************************************************************
	 * Check if all the settings are configured
	 * *****************************************************************************
	 */
	if (!this.settings.strapiUrl || !this.settings.strapiApiToken) {
		new Notice(
			'Please configure Strapi URL and API token in the plugin settings'
		)
		return
	}

	if (!this.settings.openaiApiKey) {
		new Notice('Please configure OpenAI API key in the plugin settings')
		return
	}

	if (useAdditionalCallAPI) {
		if (!this.settings.additionalJsonTemplate) {
			new Notice(
				'Please configure the additional call api JSON template in the plugin settings'
			)
			return
		}

		if (!this.settings.additionalJsonTemplateDescription) {
			new Notice(
				'Please configure the additional call api JSON template description in the plugin settings'
			)
			return
		}

		if (!this.settings.additionalUrl) {
			new Notice(
				'Please configure the additional call api URL in the plugin settings'
			)
			return
		}

		if (!this.settings.additionalContentAttributeName) {
			new Notice(
				'Please configure the additional call api content attribute name in the plugin settings'
			)
			return
		}
	} else {
		if (!this.settings.jsonTemplate) {
			new Notice('Please configure JSON template in the plugin settings')
			return
		}

		if (!this.settings.jsonTemplateDescription) {
			new Notice(
				'Please configure JSON template description in the plugin settings'
			)
			return
		}

		if (!this.settings.strapiArticleCreateUrl) {
			new Notice(
				'Please configure Strapi article create URL in the plugin settings'
			)
			return
		}

		if (!this.settings.strapiContentAttributeName) {
			new Notice(
				'Please configure Strapi content attribute name in the plugin settings'
			)
			return
		}
	}

	new Notice('All settings are ok, processing Markdown content...')
	const file = activeView.file
	let content = ''
	if (!file) {
		new Notice('No file found in active view...')
		return
	}

	// Check if the content has any images to process
	const imagePath = useAdditionalCallAPI
		? settings.additionalImage
		: settings.mainImage
	const galeryFolderPath = useAdditionalCallAPI
		? settings.additionalGalery
		: settings.mainGalery

	const imageBlob = await getImageBlob(app, imagePath)
	const galeryImageBlobs = await getGaleryImageBlobs(app, galeryFolderPath)

	content = await app.vault.read(file)

	const flag = hasUnexportedImages(content)

	const openai = new OpenAI({
		apiKey: settings.openaiApiKey,
		dangerouslyAllowBrowser: true,
	})

	if (flag) {
		const imagePaths = extractImagePaths(content)
		const imageBlobs = await getImageBlobs(app, imagePaths)

		new Notice('Getting image descriptions...')
		const imageDescriptions = await Promise.all(
			imageBlobs.map(async imageBlob => {
				const description = await getImageDescription(imageBlob.blob, openai)
				return {
					blob: imageBlob.blob,
					name: imageBlob.name,
					path: imageBlob.path,
					description,
				}
			})
		)

		new Notice('Uploading images to Strapi...')
		const uploadedImages = await uploadImagesToStrapi(
			imageDescriptions,
			settings
		)

		new Notice('Replacing image paths...')
		content = replaceImagePaths(content, uploadedImages)
		await app.vault.modify(file, content)
		new Notice('Images uploaded and links updated successfully!')
	} else {
		new Notice(
			'No local images found in the content... Skip the image processing...'
		)
	}

	new Notice('Generating article content...')
	const articleContent = await generateArticleContent(
		content,
		openai,
		settings,
		useAdditionalCallAPI
	)

	// Upload gallery images to Strapi
	const galeryUploadedImageIds = await uploadGaleryImagesToStrapi(
		galeryImageBlobs,
		settings
	)

	// Rename the gallery folder to "alreadyUpload"
	const galeryFolder = app.vault.getAbstractFileByPath(galeryFolderPath)
	if (galeryFolder instanceof TFolder) {
		await app.vault.rename(
			galeryFolder,
			galeryFolderPath.replace(/\/[^/]*$/, '/alreadyUpload')
		)
	}

	// Add the content, image, and gallery to the article content based on the settings
	const imageFullPathProperty = useAdditionalCallAPI
		? settings.additionalImageFullPathProperty
		: settings.mainImageFullPathProperty
	const galeryFullPathProperty = useAdditionalCallAPI
		? settings.additionalGaleryFullPathProperty
		: settings.mainGaleryFullPathProperty

	articleContent.data = {
		...articleContent.data,
		...(imageBlob &&
			imageFullPathProperty && { [imageFullPathProperty]: imageBlob.path }),
		...(galeryUploadedImageIds.length > 0 &&
			galeryFullPathProperty && {
				[galeryFullPathProperty]: galeryUploadedImageIds,
			}),
	}

	new Notice('Article content generated successfully!')
	try {
		const response = await fetch(
			useAdditionalCallAPI
				? settings.additionalUrl
				: settings.strapiArticleCreateUrl,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${settings.strapiApiToken}`,
				},
				body: JSON.stringify(articleContent),
			}
		)

		if (response.ok) {
			new Notice('Article created successfully in Strapi!')
		} else {
			new Notice('Failed to create article in Strapi.')
		}
	} catch (error) {
		new Notice('Error creating article in Strapi.')
	}

	new Notice(
		'Check your API content now, the article is created & uploaded! 🎉'
	)
}

export function extractImagePaths(content: string): string[] {
	const imageRegex = /!\[\[([^\[\]]*\.(png|jpe?g|gif|bmp|webp))\]\]/gi
	const imagePaths: string[] = []
	let match

	while ((match = imageRegex.exec(content)) !== null) {
		imagePaths.push(match[1])
	}

	return imagePaths
}

export function hasUnexportedImages(content: string): boolean {
	const imageRegex = /!\[\[([^\[\]]*\.(png|jpe?g|gif|bmp|webp))\]\]/gi
	return imageRegex.test(content)
}

export async function getImageBlobs(
	app: App,
	imagePaths: string[]
): Promise<{ path: string; blob: Blob; name: string }[]> {
	const files = app.vault.getAllLoadedFiles()
	const fileNames = files.map(file => file.name)
	const imageFiles = imagePaths.filter(path => fileNames.includes(path))
	return await Promise.all(
		imageFiles.map(async path => {
			const file = files.find(file => file.name === path)
			if (file instanceof TFile) {
				const blob = await app.vault.readBinary(file)
				return {
					name: path,
					blob: new Blob([blob], { type: 'image/png' }),
					path: file.path,
				}
			}
			return {
				name: '',
				blob: new Blob(),
				path: '',
			}
		})
	)
}

export async function getImageBlob(
	app: App,
	imagePath: string
): Promise<{ path: string; blob: Blob; name: string } | null> {
	const file = app.vault.getAbstractFileByPath(imagePath)
	if (file instanceof TFile) {
		const blob = await app.vault.readBinary(file)
		return {
			name: file.name,
			blob: new Blob([blob], { type: 'image/png' }),
			path: file.path,
		}
	}
	return null
}

export async function getGaleryImageBlobs(
	app: App,
	folderPath: string
): Promise<{ path: string; blob: Blob; name: string }[]> {
	const folder = app.vault.getAbstractFileByPath(folderPath)
	if (folder instanceof TFolder) {
		const files = folder.children.filter(
			file =>
				file instanceof TFile &&
				file.extension.match(/^(jpg|jpeg|png|gif|bmp|webp)$/i) &&
				!file.parent?.name.includes('alreadyUpload')
		)
		return Promise.all(
			files.map(async file => {
				const blob = await app.vault.readBinary(file as TFile)
				return {
					name: file.name,
					blob: new Blob([blob], { type: 'image/png' }),
					path: file.path,
				}
			})
		)
	}
	return []
}

export function replaceImagePaths(
	content: string,
	uploadedImages: { [key: string]: { url: string; data: any } }
): string {
	for (const [localPath, imageData] of Object.entries(uploadedImages)) {
		const markdownImageRegex = new RegExp(`!\\[\\[${localPath}\\]\\]`, 'g')
		content = content.replace(
			markdownImageRegex,
			`![${imageData.data.alternativeText}](${imageData.url})`
		)
	}
	return content
}
