import { App, Modal, Setting } from 'obsidian'
import { AnalyzedContent } from '../types'
import { Logger } from './logger'

export class PreviewModal extends Modal {
	private content: AnalyzedContent
	private onConfirm: () => void
	private onCancel: () => void

	constructor(
		app: App,
		content: AnalyzedContent,
		onConfirm: () => void,
		onCancel?: () => void
	) {
		super(app)
		this.content = content
		this.onConfirm = onConfirm
		this.onCancel = onCancel || (() => {})

		Logger.debug('PreviewModal', '196. Preview modal initialized', {
			contentKeys: Object.keys(content),
		})
	}

	onOpen() {
		Logger.info('PreviewModal', '197. Opening preview modal')
		const { contentEl } = this

		try {
			// Title
			contentEl.createEl('h2', {
				text: 'Content Preview',
				cls: 'preview-modal-title',
			})

			// Description
			contentEl.createEl('p', {
				text: 'Please review the content before exporting to Strapi.',
				cls: 'preview-modal-description',
			})

			// Preview container with scrolling
			const previewContainer = contentEl.createDiv('preview-container')

			// Create sections for different content types
			this.createContentSections(previewContainer)

			// Buttons
			this.createButtons(contentEl)

			// Add styles
			this.addStyles()

			Logger.info('PreviewModal', '198. Preview modal rendered successfully')
		} catch (error) {
			Logger.error('PreviewModal', '199. Error rendering preview modal', error)
			this.showError('Failed to render preview')
		}
	}

	private createContentSections(container: HTMLElement) {
		Logger.debug('PreviewModal', '200. Creating content sections')

		try {
			// Main content section
			if (this.content.content) {
				const contentSection = this.createSection(
					container,
					'Main Content',
					this.content.content,
					'content-section'
				)
				contentSection.addClass('main-content')
			}

			// Metadata section
			const metadata = { ...this.content }
			delete metadata.content

			if (Object.keys(metadata).length > 0) {
				this.createSection(container, 'Metadata', metadata, 'metadata-section')
			}

			Logger.debug('PreviewModal', '201. Content sections created')
		} catch (error) {
			Logger.error(
				'PreviewModal',
				'202. Error creating content sections',
				error
			)
			throw error
		}
	}

	private createSection(
		container: HTMLElement,
		title: string,
		content: any,
		className: string
	): HTMLElement {
		Logger.debug('PreviewModal', `203. Creating section: ${title}`)

		const section = container.createDiv(className)

		section.createEl('h3', { text: title })

		const previewEl = section.createEl('pre')
		previewEl.setText(
			typeof content === 'string' ? content : JSON.stringify(content, null, 2)
		)

		return section
	}

	private createButtons(container: HTMLElement) {
		Logger.debug('PreviewModal', '204. Creating action buttons')

		const buttonContainer = container.createDiv('button-container')

		// Confirm button
		new Setting(buttonContainer).addButton(button => {
			button
				.setButtonText('Confirm & Export')
				.setCta()
				.onClick(() => {
					Logger.info('PreviewModal', '205. Export confirmed by user')
					this.close()
					this.onConfirm()
				})
		})

		// Cancel button
		new Setting(buttonContainer).addButton(button => {
			button.setButtonText('Cancel').onClick(() => {
				Logger.info('PreviewModal', '206. Export cancelled by user')
				this.close()
				this.onCancel()
			})
		})
	}

	private addStyles() {
		Logger.debug('PreviewModal', '207. Adding modal styles')

		document.body.addClass('preview-modal-open')

		const styles = `
            .preview-modal-title {
                margin-bottom: 1em;
                padding-bottom: 0.5em;
                border-bottom: 1px solid var(--background-modifier-border);
            }

            .preview-modal-description {
                margin-bottom: 1.5em;
                color: var(--text-muted);
            }

            .preview-container {
                max-height: 60vh;
                overflow-y: auto;
                margin-bottom: 1.5em;
                padding: 1em;
                border: 1px solid var(--background-modifier-border);
                border-radius: 4px;
            }

            .content-section,
            .metadata-section {
                margin-bottom: 1.5em;
            }

            .content-section h3,
            .metadata-section h3 {
                margin-bottom: 0.5em;
                color: var(--text-normal);
            }

            .content-section pre,
            .metadata-section pre {
                padding: 1em;
                background-color: var(--background-primary-alt);
                border-radius: 4px;
                overflow-x: auto;
            }

            .button-container {
                display: flex;
                justify-content: flex-end;
                gap: 1em;
                margin-top: 1em;
            }
        `

		const styleEl = document.head.createEl('style', {
			attr: { type: 'text/css' },
			text: styles,
		})

		Logger.debug('PreviewModal', '208. Styles added')
	}

	private showError(message: string) {
		Logger.error('PreviewModal', '209. Showing error message', { message })

		const { contentEl } = this
		contentEl.empty()

		contentEl.createEl('h2', {
			text: 'Error',
			cls: 'preview-modal-error-title',
		})

		contentEl.createEl('p', {
			text: message,
			cls: 'preview-modal-error-message',
		})
	}

	onClose() {
		Logger.info('PreviewModal', '210. Closing preview modal')
		const { contentEl } = this
		contentEl.empty()
		document.body.removeClass('preview-modal-open')
	}
}

export function showPreviewToUser(
	app: App,
	content: AnalyzedContent
): Promise<boolean> {
	Logger.info('PreviewModal', '211. Showing preview to user')

	return new Promise(resolve => {
		new PreviewModal(
			app,
			content,
			() => {
				Logger.info('PreviewModal', '212. User confirmed preview')
				resolve(true)
			},
			() => {
				Logger.info('PreviewModal', '213. User cancelled preview')
				resolve(false)
			}
		).open()
	})
}
