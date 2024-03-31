/**
 * Extract the image paths from the content
 * @param content
 */
export const extractImagePaths = (content: string): string[] => {
	/**
	 * Extract the image paths from the content
	 */
	const imageRegex = /!\[\[([^\[\]]*\.(png|jpe?g|gif|bmp|webp))\]\]/gi
	const imagePaths: string[] = []
	let match: string[] | null

	while ((match = imageRegex.exec(content)) !== null) {
		imagePaths.push(match[1])
	}

	return imagePaths
}
