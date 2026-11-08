import { Modal, Setting, type App } from 'obsidian';

export interface ConfirmChoice {
	label: string;
	primary?: boolean;
	warning?: boolean;
	run: () => void | Promise<void>;
}

export interface ConfirmOptions {
	title: string;
	message: string[];
	choices: ConfirmChoice[];
	onClose?: () => void;
}

export class ConfirmModal extends Modal {
	constructor(
		app: App,
		private readonly options: ConfirmOptions,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(this.options.title);
		for (const paragraph of this.options.message) {
			this.contentEl.createEl('p', { text: paragraph });
		}

		const buttons = new Setting(this.contentEl);
		for (const choice of this.options.choices) {
			buttons.addButton((button) => {
				button.setButtonText(choice.label).onClick(() => {
					this.close();
					void choice.run();
				});
				if (choice.primary) button.setCta();
				if (choice.warning) button.setWarning();
			});
		}
		buttons.addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()));
	}

	onClose(): void {
		this.contentEl.empty();
		this.options.onClose?.();
	}
}
