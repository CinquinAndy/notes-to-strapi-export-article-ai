const { Plugin, Notice } = require('obsidian')

module.exports = class StrapiExportPlugin extends Plugin {
	async onload() {
		this.addCommand({
			id: 'export-to-strapi', name: 'Export to Strapi', editorCallback: async (editor, view) => {
				try {
					const markdown = editor.getDoc().getValue()
					const images = this.extractImages(markdown)
					const imageContents = await this.readImageContents(images)
					const uploadedImages = await this.uploadImagesToStrapi(imageContents)
					const updatedMarkdown = this.replaceImageLinks(markdown, uploadedImages)
					// TODO: Create a new article in Strapi with the updated Markdown
				} catch (error) {
					console.error('Export to Strapi failed:', error)
					new Notice('Export to Strapi failed. Check the console for details.')
				}
			},
		})
	}

	extractImages(markdown) {
		const imageRegex = /!\[(.*?)\]\((.*?)\)/g
		const images = []
		let match
		while ((match = imageRegex.exec(markdown))) {
			images.push({
				alt: match[1], path: match[2],
			})
		}
		return images
	}

	async readImageContents(images) {
		const fs = require('fs').promises
		const imageContents = await Promise.all(images.map(async (image) => {
			const data = await fs.readFile(image.path)
			return {
				...image, data,
			}
		}))
		return imageContents
	}

	async uploadImagesToStrapi(imageContents) {
		const FormData = require('form-data')
		const uploadedImages = await Promise.all(
			imageContents.map(async image => {
				const formData = new FormData()
				formData.append('files', image.data, {
					filename: image.path.split('/').pop(),
				})

				const response = await fetch('https://your-strapi-url/upload', {
					method: 'POST',
					body: formData,
				})

				if (!response.ok) {
					throw new Error(`Failed to upload image: ${image.path}`)
				}

				const data = await response.json()
				return {
					...image,
					url: data[0].url,
				}
			}),
		)
		return uploadedImages
	}

	replaceImageLinks(markdown, uploadedImages) {
		uploadedImages.forEach(image => {
			markdown = markdown.replace(image.path, image.url)
		})
		return markdown
	}
}