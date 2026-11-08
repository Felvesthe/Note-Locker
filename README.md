# Note Locker

Note Locker protects notes you don't want to change by accident. A locked note opens in reading view, so you can read it, scroll it and follow links without worrying about a stray keystroke. You can lock single notes or whole folders, and choose how strong the lock should be.

## Two kinds of lock

**Lock** is the everyday option. Every time you open a locked note it starts in reading view. If you do want to change something, switch to editing the usual way (the pencil button or `CMD/CTRL+E`), with no questions asked. The next time you open the note, it is back in reading view.

**Strict lock** is for notes that should stay as they are, such as archived notes, finished documents or reference material. Editing is blocked completely. If you try to switch to editing, Note Locker keeps the note in reading view and asks what you want to do:

- **Edit once** lets you edit the note in the current tab until you open another note there, switch back to reading view, or choose **Finish editing**. The lock itself stays in place.
- **Unlock** removes the lock.

In strict lock, task checkboxes and note properties can't be changed from reading view either.

You can switch a note between Lock and Strict lock at any time. When you do, Note Locker shows a short summary of what changes. Removing or weakening a strict lock always asks for confirmation.

### Lock and strict lock compared

| | Lock | Strict lock |
| --- | --- | --- |
| Opens in | Reading view | Reading view |
| Switching to editing | One click, no questions asked | Blocked, asks whether to **Edit once** or **Unlock** |
| After editing | Back in reading view the next time you open the note | Locked again when you leave the note, switch to reading view or choose **Finish editing** |
| Task checkboxes and properties in reading view | Can be changed | Read-only |
| Unlocking | Immediate | Asks for confirmation |
| Switching to the other kind of lock | Asks for confirmation and explains what changes | Asks for confirmation and explains what changes |
| Icon | Padlock | Padlock with a keyhole |
| Good for | Notes you edit now and then | Archived, finished or reference notes |

## Locking folders

Folders can be locked with either kind of lock. Everything inside a locked folder, including subfolders, is locked as well.

A note inside a locked folder can be made stricter than its folder (for example, a strict lock on one note in a folder with a regular lock), but it can't be less locked than the folder. To edit notes in a locked folder freely, unlock the folder. When you unlock a strictly locked note that sits in a locked folder, Note Locker tells you that the folder's lock still applies.

New notes created in a locked folder are an exception: the first time you open a note you have just created, you can write in it right away. The lock applies from the next time you open it. The status bar and the lock button in the note header explain this while it is active.

## Where to find it

- **File explorer:** right-click a note or folder. With several items selected, you can lock or unlock all of them at once. Locked items show a lock icon.
- **Note header:** the lock button next to the reading and editing toggle shows the current state of the note and opens the lock menu. This is also the easiest way to lock notes on mobile.
- **Note menu and editor menu:** the "More options" menu of a note and the right-click menu in the editor have the same options.
- **Status bar** (desktop only): shows whether the current note is locked and opens the same menu.
- **Command palette:**
  - Toggle lock for current note
  - Strict lock current note
  - Unlock current note
  - Edit current note once
  - Finish editing current note

  None of these have a default hotkey. You can assign your own in **Settings -> Hotkeys**.

## Settings

In **Settings -> Note Locker** you can turn the file explorer icons, the note header button, the status bar item and notifications on or off.

The settings also list everything that is locked, sorted by name. You can filter the list by type or by name, change the lock of each item and unlock it. Items whose note or folder no longer exists in the vault are marked as not found and can be removed from the list. Note Locker doesn't remove them on its own, because with sync a file can disappear briefly and come back.

## What strict lock doesn't protect against

Note Locker is meant to prevent accidental edits inside Obsidian, not to secure files. A locked note can still be changed by:

- editing the file outside Obsidian,
- sync services and other devices,
- other plugins that change files directly.

Locks are stored in the plugin's own settings file, so they sync between devices whenever your plugin settings do.

## Upgrading from version 1.x

Version 2.0 converts your existing locks automatically the first time it starts:

- Locked notes stay locked with a regular lock.
- If you had **Prevent editing in locked notes** turned on, your locked notes become strictly locked, because that is the closest match to how they behaved before.
- Strictly locked notes stay strictly locked.
- Locked folders stay locked with a regular lock.

Before converting, Note Locker saves a copy of your old settings as `data-1.x-backup.json` in the plugin folder (`.obsidian/plugins/note-locker/`). If you ever need to go back to version 1.x, replace `data.json` with that file.

Some things from 1.x work differently now:

- **Prevent editing in locked notes** is gone. Use strict lock for notes that shouldn't be editable.
- `CMD/CTRL+E` is no longer taken over by the plugin. Switching to editing on a strictly locked note is handled by the lock itself.
- The notification length settings are gone. Long names are shortened automatically.

Version 2.0 requires Obsidian 1.11 or newer.

## Installation

### From Community plugins

1. Open **Settings -> Community plugins** in Obsidian.
2. Select **Browse** and search for "Note Locker".
3. Install and enable the plugin.

### Manual installation

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/Felvesthe/Note-Locker/releases/latest) on GitHub.
2. Put them in your vault's plugins folder: `VaultFolder/.obsidian/plugins/note-locker/`
3. Reload Obsidian and enable the plugin in **Settings -> Community plugins**.

## FAQ

**I renamed or moved a locked note. Is it still locked?**
Yes. Locks follow notes and folders when you rename or move them inside Obsidian.

**I locked a note while editing it, but it stayed in editing mode.**
A regular lock takes effect the next time you open the note, so you can finish what you were doing. A strict lock switches the note to reading view right away.

**Why does the next note open in editing mode after I leave a locked note?**
Note Locker remembers which mode you were in before it switched a locked note to reading view, and puts it back when you move on to a note that isn't locked.

**Does it work on mobile?**
Yes. Use the lock button in the note header or the file explorer menu. The status bar item is not available on mobile.
