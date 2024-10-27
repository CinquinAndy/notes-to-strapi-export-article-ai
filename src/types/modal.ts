export interface ModalConfig {
	title: string
	description?: string
	confirmButtonText?: string
	cancelButtonText?: string
	onConfirm?: () => void
	onCancel?: () => void
}

export interface ImageSelectionConfig {
	isMultiple: boolean
	initialSelections?: string[]
	allowedTypes?: string[]
	maxSize?: number
	onSelect: (paths: string[]) => void
}

export interface PreviewConfig {
	title: string
	content: any
	format?: 'json' | 'markdown' | 'html'
	onConfirm: () => void
	onCancel?: () => void
}
