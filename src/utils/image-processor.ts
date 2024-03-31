import { App, MarkdownView, Notice, TFile, TFolder } from 'obsidian'
import { OpenAI } from 'openai'
import { StrapiExporterSettings } from '../types/settings'
import {
	uploadGaleryImagesToStrapi,
	uploadImagesToStrapi,
} from './strapi-uploader'
import { generateArticleContent } from './openai-generator'

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
	// ...

	// Add the content, image, and gallery to the article content based on the settings
	// ...

	new Notice('Article content generated successfully!')
	// Create the article in Strapi
	// ...

	new Notice(
		'Check your API content now, the article is created & uploaded! 🎉'
	)
}

/**
 * Extract the image paths from the content
 * @param content
 */
export function extractImagePaths(content: string): string[] {
	// Extract image paths from the content
	const imageRegex = /!\[\[([^\[\]]*\.(png|jpe?g|gif|bmp|webp))\]\]/gi
	const imagePaths: string[] = []
	let match

	while ((match = imageRegex.exec(content)) !== null) {
		imagePaths.push(match[1])
	}

	return imagePaths
}

/**
 * Check if the content has any unexported images
 * @param content
 */
export function hasUnexportedImages(content: string): boolean {
	// Check if the content has any unexported images
	const imageRegex = /!\[\[([^\[\]]*\.(png|jpe?g|gif|bmp|webp))\]\]/gi
	return imageRegex.test(content)
}

/**
 * Get the image blobs from the image paths
 * @param app
 * @param imagePaths
 */
export async function getImageBlobs(
	app: App,
	imagePaths: string[]
): Promise<{ path: string; blob: Blob; name: string }[]> {
	// Get image blobs from the image paths
	// Get all the files in the vault
	const files = this.app.vault.getAllLoadedFiles()
	// Get the image files name from the vault
	const fileNames = files.map(file => file.name)
	// Filter the image files, and get all the images files paths
	const imageFiles = imagePaths.filter(path => fileNames.includes(path))
	// Get the image blobs, find it, and return the blob
	return await Promise.all(
		imageFiles.map(async path => {
			const file = files.find(file => file.name === path)
			if (file instanceof TFile) {
				const blob = await this.app.vault.readBinary(file)
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

/**
 * Get the image blobs from the image paths
 * @param app
 * @param imagePath
 */
export async function getImageBlob(
	app: App,
	imagePath: string
): Promise<{ path: string; blob: Blob; name: string } | null> {
	// Get image blob from the image path
	const file = this.app.vault.getAbstractFileByPath(imagePath)
	if (file instanceof TFile) {
		const blob = await this.app.vault.readBinary(file)
		return {
			name: file.name,
			blob: new Blob([blob], { type: 'image/png' }),
			path: file.path,
		}
	}
	return null
}

/**
 * Get the image blobs from the image paths
 * @param app
 * @param folderPath
 */
export async function getGaleryImageBlobs(
	app: App,
	folderPath: string
): Promise<{ path: string; blob: Blob; name: string }[]> {
	// Get image blobs from the gallery folder
	const folder = this.app.vault.getAbstractFileByPath(folderPath)
	if (folder instanceof TFolder) {
		const files = folder.children.filter(
			file =>
				file instanceof TFile &&
				file.extension.match(/^(jpg|jpeg|png|gif|bmp|webp)$/i) &&
				!file.parent?.name.includes('alreadyUpload')
		)
		return Promise.all(
			files.map(async file => {
				const blob = await this.app.vault.readBinary(file as TFile)
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

/**
 * Replace the image paths in the content with the uploaded image URLs
 * @param content
 * @param uploadedImages
 */
export function replaceImagePaths(
	content: string,
	uploadedImages: { [key: string]: { url: string; data: any } }
): string {
	// Replace image paths in the content with the uploaded image URLs
	for (const [localPath, imageData] of Object.entries(uploadedImages)) {
		const markdownImageRegex = new RegExp(`!\\[\\[${localPath}\\]\\]`, 'g')
		content = content.replace(
			markdownImageRegex,
			`![${imageData.data.alternativeText}](${imageData.url})`
		)
	}
	return content
}

/**
 * Get the description of the image using OpenAI
 * @param imageBlob
 * @param openai
 */
export const getImageDescription = async (imageBlob: Blob, openai: OpenAI) => {
	// Get the image description using the OpenAI API (using gpt 4 vision preview model)
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
						// Encode imageBlob as base64
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
