// @ts-nocheck
const vscode = require("vscode");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const savePath = "%APPDATA%CodeUser";
let settings;
let decorationType;
let changepointsMap = new Map();
let HighlightMap = new Map();
let initialized = true;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log(
    'Congratulations, your extension "changepointhighlighter" is now active!'
  );

  let disposable = vscode.commands.registerCommand(
    "changepointhighlighter.loadChangepoints",
    loadChangepointsfromExcel
  );
  context.subscriptions.push(disposable);

  disposable = vscode.commands.registerCommand(
    "changepointhighlighter.highlight",
    addHighlights
  );
  context.subscriptions.push(disposable);

  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) addHighlights(editor);
  });
}

function deactivate() {}

function loadChangepointsfromExcel() {
  const filePath = vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectMany: false,
    filters: { Excel: ["xlsx", "xls"] },
  });

  filePath.then((fileUri) => {
    if (fileUri && fileUri[0]) {
      const workbook = XLSX.readFile(fileUri[0].fsPath, {
        cellStyles: true,
      });

      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const isVisible = !workbook.Sheets[sheetName].Hidden;

        if (isVisible) {
          const range = XLSX.utils.decode_range(sheet["!ref"]);

          for (let row = range.s.r; row <= range.e.r; row++) {
            const cellD = sheet[XLSX.utils.encode_cell({ r: row, c: 3 })];
            const cellC = sheet[XLSX.utils.encode_cell({ r: row, c: 2 })];

            //   if cell color is changepoint
            if (
              cellC.v != "" &&
              cellD.s?.fgColor?.rgb === "EFCB05" &&
              cellD.v != null
            ) {
              const lineNumber = cellC.v - 1;
              const textLength = cellD.v.toString().length;

              const existingLines = changepointsMap.get(sheetName) || [];
              existingLines.push(
                new vscode.Range(lineNumber, 0, lineNumber, textLength)
              );
              changepointsMap.set(sheetName, existingLines);
            }
          }
        }
      });
      vscode.window.showInformationMessage("Finished loading changepoints.");
    } else {
      vscode.window.showErrorMessage("No file selected.");
    }
  });
}

function addHighlights() {
  if (changepointsMap.size === 0) {
    vscode.window.showErrorMessage("Load changepoints first!");
    return;
  }

  updateDecorationType();
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  // Get the  highlights from changepoint map
  const fileUri = editor.document.uri;
  const docUriString = fileUri.toString();
  const fileName = path.basename(docUriString);

  const linesToHighlight = changepointsMap.get(fileName);
  if (!linesToHighlight) return;

  editor.setDecorations(decorationType, linesToHighlight);
}

function getSettings() {
  const config = vscode.workspace.getConfiguration();

  const color =
    config.get("linesHighlight.highlightColor") || "rgba(197, 227, 28, 0.25)";
  const scrollbarOpacity =
    config.get("linesHighlight.scrollbarHighlightOpacity") || 0.3;

  if (!color || !scrollbarOpacity) {
    throw new Error("Lines Highlight: Invalid settings");
  }

  const settings = {
    color: color,
    scrollbarOpacity: Math.round(scrollbarOpacity * 255).toString(16),
  };

  settings.editorColor = `${settings.color}`;
  settings.scrollbarColor = `${settings.color}${settings.scrollbarOpacity}`;

  return settings;
}

function updateDecorationType() {
  const previousSettings = settings || {};
  settings = getSettings();

  const settingsChanged = Object.keys(settings).some((key) => {
    return previousSettings[key] !== settings[key];
  });

  if (!settingsChanged && !initialized) {
    return;
  }

  decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: settings.editorColor,
    isWholeLine: true,
    overviewRulerColor: settings.scrollbarColor,
    overviewRulerLane: vscode.OverviewRulerLane.Full,
  });
  initialized = false;
}

function getHighlightFile() {}

function saveHighlightsToJson() {}

module.exports = {
  activate,
  deactivate,
};
