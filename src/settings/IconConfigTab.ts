import { App, PluginSettingTab, Setting } from 'obsidian'
import StrapiExporterPlugin from '../main'
import { IconConfig } from '../types/settings'

export class IconConfigTab extends PluginSettingTab {
	plugin: StrapiExporterPlugin

	constructor(app: App, plugin: StrapiExporterPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()

		containerEl.createEl('h2', { text: 'Icon Configuration' })

		this.plugin.settings.icons.forEach((iconConfig, index) => {
			this.createIconConfigSettings(containerEl, iconConfig, index)
		})

		new Setting(containerEl)
			.setName('Add New Icon')
			.setDesc('Add a new icon configuration')
			.addButton(button =>
				button.setButtonText('+').onClick(async () => {
					this.plugin.settings.icons.push({
						id: `icon-${Date.now()}`,
						icon: 'star',
						title: 'New Icon',
						enabled: true,
					})
					await this.plugin.saveSettings()
					this.display()
				})
			)
	}

	createIconConfigSettings(
		containerEl: HTMLElement,
		iconConfig: IconConfig,
		index: number
	): void {
		const iconSetting = new Setting(containerEl)
			.setName(`Icon ${index + 1}`)
			.setDesc('Configure icon settings')
			.addText(text =>
				text
					.setPlaceholder('Icon name')
					.setValue(iconConfig.icon)
					.onChange(async value => {
						iconConfig.icon = value
						await this.plugin.saveSettings()
						this.plugin.updateRibbonIcons()
					})
			)
			.addText(text =>
				text
					.setPlaceholder('Icon title')
					.setValue(iconConfig.title)
					.onChange(async value => {
						iconConfig.title = value
						await this.plugin.saveSettings()
						this.plugin.updateRibbonIcons()
					})
			)
			.addToggle(toggle =>
				toggle.setValue(iconConfig.enabled).onChange(async value => {
					iconConfig.enabled = value
					await this.plugin.saveSettings()
					this.plugin.updateRibbonIcons()
				})
			)

		if (index > 1) {
			iconSetting.addButton(button =>
				button
					.setIcon('trash')
					.setTooltip('Delete this icon')
					.onClick(async () => {
						this.plugin.settings.icons.splice(index, 1)
						await this.plugin.saveSettings()
						this.plugin.updateRibbonIcons()
						this.display()
					})
			)
		}
	}
}
