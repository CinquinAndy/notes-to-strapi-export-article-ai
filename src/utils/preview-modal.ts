import { App, Modal, Notice, Setting } from 'obsidian'
import { AnalyzedContent } from '../types'
import { FrontmatterGenerator } from '../services/frontmatter'
import StrapiExporterPlugin from '../main'

export class PreviewModal extends Modal {
	private content: AnalyzedContent
	private plugin: StrapiExporterPlugin
	private routeId: string
	private onConfirm: () => void
	private onCancel: () => void
	private frontmatterGenerator: FrontmatterGenerator

	constructor(
		app: App,
		content: AnalyzedContent,
		plugin: StrapiExporterPlugin,
		routeId: string,
		onConfirm: () => void,
		onCancel?: () => void
	) {
		super(app)
		this.plugin = plugin
		this.content = content
		this.routeId = routeId
		this.onConfirm = onConfirm
		this.onCancel = onCancel || (() => {})

		// Initialize with plugin instance and route ID
		this.frontmatterGenerator = new FrontmatterGenerator(
			this.plugin,
			this.routeId
		)
	}

	onOpen() {
		const { contentEl } = this

		try {
			this.createHeader(contentEl)
			this.createGenerateButton(contentEl)
			this.createPreviewContainer(contentEl)
			this.createButtons(contentEl)
			this.addStyles()
		} catch (error) {
			this.showError('Failed to render preview' + error.message)
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
			.setName('Generate Metadata')
			.setDesc('Use AI to generate frontmatter metadata for your content')
			.addButton(button =>
				button
					.setButtonText('Generate')
					.setCta()
					.onClick(async () => {
						try {
							await this.generateFrontmatter()
						} catch (error) {
							new Notice(`Failed to generate metadata: ${error.message}`)
						}
					})
			)
	}

	private async generateFrontmatter() {
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
		await this.app.vault.modify(file, updatedContent)

		new Notice('Frontmatter generated successfully!')
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
	}

	createSection(
		container: HTMLElement,
		title: string,
		content: any,
		className: string
	): HTMLElement {
		const section = container.createDiv(className)
		section.createEl('h3', { text: title })

		const previewEl = section.createEl('pre')
		previewEl.setText(
			typeof content === 'string' ? content : JSON.stringify(content, null, 2)
		)

		return section
	}

	private createButtons(container: HTMLElement) {
		const buttonContainer = container.createDiv('button-container')

		// Confirm button
		new Setting(buttonContainer).addButton(button => {
			button
				.setButtonText('Confirm & Export')
				.setCta()
				.onClick(() => {
					this.close()
					this.onConfirm()
				})
		})

		// Cancel button
		new Setting(buttonContainer).addButton(button => {
			button.setButtonText('Cancel').onClick(() => {
				this.close()
				this.onCancel()
			})
		})
	}

	private addStyles() {
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
            
            .button-container .setting-item {
            		align-items: end;
            		border: none;
            }
        `

		document.head.createEl('style', {
			attr: { type: 'text/css' },
			text: styles,
		})
	}

	private showError(message: string) {
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
		const { contentEl } = this
		contentEl.empty()
		document.body.removeClass('preview-modal-open')
	}
}

export function showPreviewToUser(
	app: App,
	content: AnalyzedContent,
	plugin: StrapiExporterPlugin,
	routeId: string
): Promise<boolean> {
	return new Promise(resolve => {
		new PreviewModal(
			app,
			content,
			plugin,
			routeId,
			() => {
				resolve(true)
			},
			() => {
				resolve(false)
			}
		).open()
	})
}
