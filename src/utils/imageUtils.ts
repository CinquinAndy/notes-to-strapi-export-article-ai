// src/utils/imageUtils.ts
import { App, TFile, TFolder } from 'obsidian'

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
