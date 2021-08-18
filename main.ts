import { MarkdownView, Plugin, Setting, PluginSettingTab, App } from "obsidian";

import "node_modules/@gouch/to-title-case/to-title-case";

const LC = "[\\w\\u0400-\\u04FF]"; // Latin and Cyrillic

export default class TextFormat extends Plugin {
  settings: FormatSettings;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new TextFormatSettingTab(this.app, this));

    this.addCommand({
      id: "text-format-lower",
      name: "Lowercase selected text",
      callback: () => this.textFormat("lowercase"),
    });
    this.addCommand({
      id: "text-format-upper",
      name: "Uppercase selected text",
      callback: () => this.textFormat("uppercase"),
    });
    this.addCommand({
      id: "text-format-capitalize-word",
      name: "Capitalize all words in selected text",
      callback: () => this.textFormat("capitalize-word"),
    });
    this.addCommand({
      id: "text-format-capitalize-sentence",
      name: "Capitalize only first word of sentence in selected text",
      callback: () => this.textFormat("capitalize-sentence"),
    });
    this.addCommand({
      id: "text-format-titlecase",
      name: "Title case selected text",
      callback: () => this.textFormat("titlecase"),
    });
    this.addCommand({
      id: "text-format-remove-spaces",
      name: "Remove redundant spaces in selection",
      callback: () => this.textFormat("spaces"),
    });
    this.addCommand({
      id: "text-format-merge-line",
      name: "Merge broken paragraph(s) in selection",
      callback: () => this.textFormat("merge"),
    });
    this.addCommand({
      id: "text-format-bullet-list",
      name: "Format bullet list",
      callback: () => this.textFormat("bullet"),
    });
    this.addCommand({
      id: "text-format-ordered-list",
      name: "Format ordered list",
      callback: () => this.textFormat("ordered"),
    });
    this.addCommand({
      id: "text-format-split-blank",
      name: "Split line(s) by blanks",
      callback: () => this.textFormat("split-blank"),
    });
    this.addCommand({
      id: "text-format-chinese-character",
      name: "Convert to Chinese character of this file (,;:!?)",
      callback: () => this.convertChinese(),
    });
  }

  convertChinese(): void {
    let markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!markdownView) {
      return;
    }
    let sourceMode = markdownView.sourceMode;
    let content = sourceMode.get();
    content = content
      .replace(/,/g, "，")
      .replace(/;/g, "；")
      .replace(/(?<=[^a-zA-Z0-9]):/g, "：")
      .replace(/\!(?=[^\[])/g, "！")
      .replace(/\?/g, "？");
    sourceMode.set(content, false);
  }

  textFormat(cmd: string): void {
    let markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!markdownView) {
      return;
    }
    let editor = markdownView.editor;

    var selectedText: string, replacedText;

    if (!editor.somethingSelected()) {
      let cursor = editor.getCursor();

      cursor.ch = 0;
      let aos = editor.posToOffset(cursor);

      cursor.line += 1;
      let hos = editor.posToOffset(cursor);
      if (cursor.line <= editor.lastLine()) {
        // don't select the next line which is not selected by user
        hos -= 1;
      }
      editor.setSelection(editor.offsetToPos(aos), editor.offsetToPos(hos));
    }

    selectedText = editor.getSelection();

    switch (cmd) {
      case "capitalize-word":
      case "titlecase":
        if (this.settings.LowercaseFirst) {
          replacedText = selectedText.toLowerCase();
        } else {
          replacedText = selectedText;
        }
        break;
      case "split-blank":
      case "bullet":
      case "ordered":
        let from = editor.getCursor("from");
        let to = editor.getCursor("to");
        from.ch = 0;
        to.line += 1;
        to.ch = 0;
        if (to.line <= editor.lastLine()) {
          editor.setSelection(
            from,
            editor.offsetToPos(editor.posToOffset(to) - 1)
          );
        } else {
          editor.setSelection(from, to);
        }
        selectedText = editor.getSelection();
        break;
      default:
        break;
    }

    switch (cmd) {
      case "lowercase":
        replacedText = selectedText.toLowerCase();
        break;
      case "uppercase":
        replacedText = selectedText.toUpperCase();
        break;
      case "capitalize-word":
        replacedText = capitalizeWord(selectedText);
        break;
      case "capitalize-sentence":
        replacedText = capitalizeSentence(selectedText);
        break;
      case "titlecase":
        // @ts-ignore
        replacedText = replacedText.toTitleCase();
        break;
      case "spaces":
        replacedText = selectedText.replace(/ +/g, " ");
        // replacedText = replacedText.replace(/\n /g, "\n"); // when a single space left at the head of the line
        break;
      case "merge":
        replacedText = selectedText.replace(/(?<!\n)\n(?!\n)/g, " ");
        console.log(this.settings);
        if (this.settings.MergeParagraph_Newlines) {
          replacedText = replacedText.replace(/\n\n+/g, "\n\n");
        }
        if (this.settings.MergeParagraph_Spaces) {
          replacedText = replacedText.replace(/ +/g, " ");
        }
        break;
      case "bullet":
        replacedText = selectedText.replace(/(^|(?<=[\s])) *• */g, "\n- ");
        replacedText = replacedText.replace(/\n+/g, "\n").replace(/^\n/, "");
        break;
      case "ordered":
        let orderedCount = 0;
        console.log(orderedCount);
        replacedText = selectedText.replace(
          /(^|\s)[^\s[\(]]+\)|[:;]\w+\)|(?<=^|\s)[0-9]\./g,
          function (t) {
            orderedCount++;
            let head = "\n"; // if single line, then add newline character.
            if (selectedText.indexOf("\n") > -1) {
              head = "";
            }
            return head + String(orderedCount) + ". ";
          }
        );
        replacedText = replacedText.replace(/\n+/g, "\n").replace(/^\n/, "");
        break;
      case "split-blank":
        replacedText = selectedText.replace(/ /g, "\n");
        break;
      default:
        return;
    }

    const fos = editor.posToOffset(editor.getCursor("from"));
    if (replacedText != selectedText) {
      editor.replaceSelection(replacedText);
    }

    if (cmd != "merge") {
      const tos = editor.posToOffset(editor.getCursor("to")); // to offset
      editor.setSelection(
        editor.offsetToPos(tos - replacedText.length),
        editor.offsetToPos(tos)
      );
    } else {
      let head = editor.getCursor("head");
      editor.setSelection(editor.offsetToPos(fos), head);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

function capitalizeWord(str: string): string {
  var rx = new RegExp(LC + "\\S*", "g");
  return str.replace(rx, function (t) {
    return t.charAt(0).toUpperCase() + t.substr(1);
  });
}

function capitalizeSentence(s: string): string {
  var rx = new RegExp("^" + LC + "|(?<=[\\.!?\\n~]\\s+)" + LC + "", "g");

  // return s.replace(/^\S|(?<=[\.!?\n~]\s+)\S/g, function (t) {
  return s.replace(rx, function (t) {
    return t.toUpperCase();
  });
}

/* ----------------------------------------------------------------
   --------------------------Settings------------------------------
   ---------------------------------------------------------------- */
interface FormatSettings {
  MergeParagraph_Newlines: boolean;
  MergeParagraph_Spaces: boolean;
  LowercaseFirst: boolean;
}

const DEFAULT_SETTINGS: FormatSettings = {
  MergeParagraph_Newlines: true,
  MergeParagraph_Spaces: true,
  LowercaseFirst: false,
};
class TextFormatSettingTab extends PluginSettingTab {
  plugin: TextFormat;

  constructor(app: App, plugin: TextFormat) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h3", { text: "Lowercase" });

    new Setting(containerEl)
      .setName("Lowercase before capitalize/title case")
      .setDesc(
        "When running the capitalize or title case command, the plugin will lowercase the selection at first."
      )
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.LowercaseFirst)
          .onChange(async (value) => {
            this.plugin.settings.LowercaseFirst = value;
            await this.plugin.saveSettings();
          });
      });

    containerEl.createEl("h3", { text: "Merge broken paragraphs behavior" });

    new Setting(containerEl)
      .setName("Remove redundant blank lines")
      .setDesc(
        'change blank lines into single blank lines, e.g. "\\n\\n\\n" will be changed to "\\n\\n"'
      )
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.MergeParagraph_Newlines)
          .onChange(async (value) => {
            this.plugin.settings.MergeParagraph_Newlines = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Remove redundant blank spaces")
      .setDesc("ensure only one space between words")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.MergeParagraph_Spaces)
          .onChange(async (value) => {
            this.plugin.settings.MergeParagraph_Spaces = value;
            await this.plugin.saveSettings();
          });
      });
  }
}
