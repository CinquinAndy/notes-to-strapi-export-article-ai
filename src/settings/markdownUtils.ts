// src/utils/markdownUtils.ts
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
