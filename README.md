# 🔒 Note Locker

_Prevent accidental edits by locking notes in preview mode_

## ✨ Features
- **One-click locking** - Toggle notes between editable and locked states
- **Persistent locks** - Remembers locked notes between sessions
- **Smart rename handling** - Maintains locks when files are renamed
- **Cross-platform** - Works on both desktop and mobile
- **Visual feedback** - Clear notifications when locking/unlocking

## ⚙️ Installation
### Recommended Method
1. Open Obsidian Settings → Community plugins
2. Click "Browse" and search for "Note Locker"
3. Install and enable the plugin

Not in Community plugins yet? Check manual installation guide below

### Manual Installation
1. Download the latest release from GitHub
2. Extract to your vault's plugins folder:  
   `VaultFolder/.obsidian/plugins/note-locker/`
3. Reload Obsidian and enable the plugin

## 🖱️ Usage
**To lock/unlock a note:**
1. Right-click on a note in the file explorer
2. Select "Lock" or "Unlock" from the context menu

**Or:**
1. Open a note
2. Right-click in the editor
3. Select "Lock" or "Unlock" from the menu

## ❓ FAQ
**1. Can I edit a locked note?**  
The lock is designed to prevent accidental edits, not block access completely.
- Manual override: You can still switch to edit mode if needed
- Auto-relock: Returns to preview mode when reopening the note
- Best for: Protecting finalized notes while allowing intentional edits

**2. Do locks persist after restarting Obsidian?**  
Yes, locked notes will remain locked.

**3. What happens if I rename a locked note?**  
The lock will automatically transfer to the new filename.

## 🐛 Troubleshooting
If locks aren't working properly:
1. Check for conflicts with other plugins
2. Ensure you're running the latest version of Obsidian
3. Try reinstalling the plugin
