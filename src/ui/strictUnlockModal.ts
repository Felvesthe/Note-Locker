import { Modal, App, Setting } from "obsidian";

export class StrictUnlockModal extends Modal {
    private onUnlock: () => void;
    private title: string;
    private message: string;

    constructor(
        app: App,
        onUnlock: () => void,
        title: string = "Strictly Locked Note",
        message: string = "This note is strictly locked to prevent accidental editing.") {
        super(app);
        this.onUnlock = onUnlock;
        this.title = title;
        this.message = message;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: this.title });
        contentEl.createEl("p", { text: this.message });
        contentEl.createEl("p", { text: "Are you sure you want to unlock?" });

        new Setting(contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText("Unlock")
                    .setCta()
                    .onClick(() => {
                        this.onUnlock();
                        this.close();
                    })
            )
            .addButton((btn) =>
                btn
                    .setButtonText("Cancel")
                    .onClick(() => {
                        this.close();
                    })
            );
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
