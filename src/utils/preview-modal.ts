import { App, Modal, Notice, Setting } from 'obsidian'
import { AnalyzedContent, RouteConfig } from '../types'
import { Logger } from './logger'
import { FrontmatterGenerator } from '../services/fronmatter'
import StrapiExporterPlugin from '../main'

export class PreviewModal extends Modal {
	private content: AnalyzedContent
	private route: RouteConfig
	private onConfirm: () => void
	private onCancel: () => void
	private frontmatterGenerator: FrontmatterGenerator

	constructor(
		app: App,
		content: AnalyzedContent,
		plugin: StrapiExporterPlugin,
		onConfirm: () => void,
		onCancel?: () => void
	) {
		super(app)
		this.content = content
		this.onConfirm = onConfirm
		this.onCancel = onCancel || (() => {})
		this.frontmatterGenerator = new FrontmatterGenerator(plugin)
	}

	onOpen() {
		Logger.info('PreviewModal', 'Opening preview modal')
		const { contentEl } = this

		try {
			this.createHeader(contentEl)
			this.createGenerateButton(contentEl)
			this.createPreviewContainer(contentEl)
			this.createButtons(contentEl)
			this.addStyles()

			Logger.info('PreviewModal', 'Preview modal rendered successfully')
		} catch (error) {
			Logger.error('PreviewModal', 'Error rendering preview modal', error)
			this.showError('Failed to render preview')
		}
	}

	private createHeader(container: HTMLElement) {
		container.createEl('h2', {
			text: 'Content Preview',
			cls: 'preview-modal-title',
		})

		container.createEl('p', {
			text: 'Review or generate frontmatter before exporting to Strapi.',
			cls: 'preview-modal-description',
		})
	}

	private createGenerateButton(container: HTMLElement) {
		new Setting(container)
			.setName('Generate Frontmatter')
			.setDesc('Use AI to generate frontmatter for your content')
			.addButton(button =>
				button
					.setButtonText('Generate')
					.setCta()
					.onClick(async () => {
						try {
							await this.generateFrontmatter()
						} catch (error) {
							new Notice(`Failed to generate frontmatter: ${error.message}`)
						}
					})
			)
	}

	private async generateFrontmatter() {
		try {
			new Notice('Generating frontmatter...')

			// Get the active file
			const file = this.app.workspace.getActiveFile()
			if (!file) {
				throw new Error('No active file')
			}

			// Generate frontmatter
			const updatedContent =
				await this.frontmatterGenerator.updateContentFrontmatter(file, this.app)

			// Update content object
			this.content.content = updatedContent

			// Update preview
			this.updatePreview()
			new Notice('Frontmatter generated successfully!')
		} catch (error) {
			Logger.error('PreviewModal', 'Error generating frontmatter', error)
			throw error
		}
	}

	private createPreviewContainer(container: HTMLElement) {
		const previewContainer = container.createDiv('preview-container')
		this.createContentSections(previewContainer)
	}

	private updatePreview() {
		const previewContainer = this.contentEl.querySelector('.preview-container')
		if (previewContainer) {
			previewContainer.empty()
			this.createContentSections(previewContainer)
		}
	}

	private createContentSections(container: Element) {
		Logger.debug('PreviewModal', '200. Creating content sections')

		try {
			// Main content section
			if (this.content.content) {
				const contentSection = this.createSection(
					container.createDiv(),
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
				this.createSection(
					container.createDiv(),
					'Metadata',
					metadata,
					'metadata-section'
				)
			}

			Logger.debug('PreviewModal', '201. Content sections created')
		} catch (error) {
			Logger.error('PreviewModal', 'Error creating content sections', error)
			throw error
		}
	}

	createSection(
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

		document.head.createEl('style', {
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
	content: AnalyzedContent,
	plugin: StrapiExporterPlugin
): Promise<boolean> {
	Logger.info('PreviewModal', 'Showing preview to user')

	return new Promise(resolve => {
		new PreviewModal(
			app,
			content,
			plugin,
			() => {
				Logger.info('PreviewModal', 'User confirmed preview')
				resolve(true)
			},
			() => {
				Logger.info('PreviewModal', 'User cancelled preview')
				resolve(false)
			}
		).open()
	})
}
