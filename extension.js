// @ts-nocheck
const vscode = require("vscode");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const TreeProvider = require("./targetFilesView.js");

let decorationType;
let settings;
let initialized = true;

// filename -> vscode.Range[]
let changepointsDict = new Map();

// Tree view provider
let targetFilesProvider;

// „Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ
// Workspace helpers
// „Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ
function getWorkspaceRoot() {
  if (
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    return vscode.workspace.workspaceFolders[0].uri.fsPath;
  }

  if (vscode.workspace.rootPath) {
    return vscode.workspace.rootPath;
  }

  return undefined;
}

// „Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ
// Extension lifecycle
// „Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ
function activate(context) {
  vscode.window.showInformationMessage(
    'Extension "changepointhighlighter" activated',
  );

  targetFilesProvider = new TreeProvider.TargetFilesProvider();

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "changepointhighlighter.loadChangepoints",
      loadChangepointsfromExcel,
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "changepointhighlighter.highlight",
      addHighlights,
    ),
  );

  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) addHighlights(editor);
  });

  vscode.workspace.onDidOpenTextDocument((editor) => {
    if (editor) addHighlights(editor);
  });

  vscode.window.createTreeView("changepointTargets", {
    treeDataProvider: targetFilesProvider,
  });

  restoreState();
}

function deactivate() {}

// „Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ
// Excel loading
// „Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ
function loadChangepointsfromExcel() {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showErrorMessage("Please open a workspace folder first.");
    return;
  }

  vscode.window
    .showOpenDialog({
      canSelectFiles: true,
      canSelectMany: false,
      filters: { Excel: ["xlsx", "xls"] },
    })
    .then((fileUri) => {
      if (!fileUri || !fileUri[0]) return;

      const workbook = XLSX.readFile(fileUri[0].fsPath, { cellStyles: true });

      changepointsDict.clear();

      const persistedTargets = [];
      const persistedChangepoints = {};
      const treeFiles = [];

      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        if (sheet.Hidden) return;

        const range = XLSX.utils.decode_range(sheet["!ref"]);
        const relativePath = sheet["D1"].v
          .toString()
          .split("ReprogProject\\")[1];
        persistedTargets.push(relativePath);

        for (let row = range.s.r; row <= range.e.r; row++) {
          const cellLineNumber =
            sheet[XLSX.utils.encode_cell({ r: row, c: 2 })];
          const cellContent = sheet[XLSX.utils.encode_cell({ r: row, c: 3 })];

          if (
            cellLineNumber != "" &&
            cellContent != "" &&
            typeof cellContent.v === "string" &&
            cellContent !== null &&
            cellContent.s?.fgColor?.rgb === "EFCB05"
          ) {
            const absPath = path.join(workspaceRoot, relativePath);

            if (!fs.existsSync(absPath)) continue;

            const fileName = path.basename(relativePath);
            const line = cellLineNumber.v - 1;
            const length = relativePath.length;

            const ranges = changepointsDict.get(fileName) || [];
            ranges.push(new vscode.Range(line, 0, line, length));
            changepointsDict.set(fileName, ranges);

            const cp = persistedChangepoints[fileName] || [];
            cp.push({ line, length });
            persistedChangepoints[fileName] = cp;
          }
        }
      });

      const uniqueTargets = [...new Set(persistedTargets)];

      uniqueTargets.forEach((rel) => {
        const abs = path.join(workspaceRoot, rel);
        treeFiles.push({
          label: path.basename(rel),
          uri: vscode.Uri.file(abs),
        });
      });

      setTargets(treeFiles, workspaceRoot, false);

      vscode.window.showInformationMessage(
        "Changepoints loaded and persisted.",
      );

      const data = {
        targets: uniqueTargets,
        changepoints: persistedChangepoints,
      };

      saveToVscodeFolder(data);
    });
}

function setTargets(treeFiles, workspaceRoot, isRestore = false) {
  let normalNodes = [];

  if (isRestore) {
    normalNodes = treeFiles.map(
      (f) => new TreeProvider.FileNode(f.label, f.uri),
    );
  } else {
    normalNodes = treeFiles.map((f) => {
      if (typeof f === "string") {
        const abs = path.join(workspaceRoot, f);
        return new TreeProvider.FileNode(
          path.basename(f),
          vscode.Uri.file(abs),
        );
      }
      return new TreeProvider.FileNode(f.label, f.uri);
    });
  }

  const sortedNodes = [...treeFiles]
    .sort((a, b) =>
      a.label.localeCompare(b.label, "en", { sensitivity: "base" }),
    )
    .map((f) => new TreeProvider.FileNode(f.label, f.uri));

  const groups = [
    new TreeProvider.GroupNode(
      `Target Files (${normalNodes.length})`,
      normalNodes,
    ),
    new TreeProvider.GroupNode(
      `Target Files (Sorted) (${sortedNodes.length})`,
      sortedNodes,
    ),
  ];

  targetFilesProvider.setGroups(groups);
}

// „Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ
// Highlighting
// „Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ
function addHighlights() {
  if (changepointsDict.size === 0) {
    vscode.window.showErrorMessage("Load changepoints first!");
    return;
  }

  updateDecorationType();

  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const fileName = path.basename(editor.document.uri.fsPath);

  const ranges = changepointsDict.get(fileName);
  if (!ranges) return;

  editor.setDecorations(decorationType, ranges);
}

// „Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ
// Restore persisted state
// „Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ
function restoreState() {
  const saved = restoreFromVscodeFolder();

  console.log("Restoring state:", {
    vscodeFolder: saved,
  });

  // const saved = fromVscodeFolder;
  if (!saved) return;

  changepointsDict.clear();

  for (const [fileName, points] of Object.entries(saved.changepoints || {})) {
    const validRanges = [];

    for (const p of points || []) {
      if (typeof p?.line !== "number" || typeof p?.length !== "number") {
        console.warn(`Skipping invalid changepoint: ${fileName}`);
        continue;
      }

      validRanges.push(new vscode.Range(p.line, 0, p.line, p.length));
    }

    if (validRanges.length > 0) {
      changepointsDict.set(fileName, validRanges);
    }
  }

  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) return;

  const files = [];
  (saved.targets || []).forEach((rel) => {
    const abs = path.join(workspaceRoot, rel);
    if (fs.existsSync(abs)) {
      files.push({
        label: path.basename(rel),
        uri: vscode.Uri.file(abs),
      });
    }
  });

  setTargets(files, workspaceRoot, true);
}

// „Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ
// Decoration settings
// „Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ
function getSettings() {
  const config = vscode.workspace.getConfiguration();

  const color =
    config.get("linesHighlight.highlightColor") || "rgba(197, 227, 28, 0.25)";
  const scrollbarOpacity =
    config.get("linesHighlight.scrollbarHighlightOpacity") || 0.3;

  return {
    editorColor: color,
    scrollbarColor: color + Math.round(scrollbarOpacity * 255).toString(16),
  };
}

function updateDecorationType() {
  const previous = settings || {};
  settings = getSettings();

  const changed = Object.keys(settings).some(
    (k) => settings[k] !== previous[k],
  );

  if (!changed && !initialized) return;

  decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: settings.editorColor,
    isWholeLine: true,
    overviewRulerColor: settings.scrollbarColor,
    overviewRulerLane: vscode.OverviewRulerLane.Full,
  });

  initialized = false;
}

// persistence
function saveToVscodeFolder(data) {
  const root = getWorkspaceRoot();
  if (!root) return;

  const vscodeDir = path.join(root, ".vscode");
  const filePath = path.join(vscodeDir, "changepoint-highlighter.json");

  if (!fs.existsSync(vscodeDir)) {
    fs.mkdirSync(vscodeDir);
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function restoreFromVscodeFolder() {
  const root = getWorkspaceRoot();
  if (!root) return;

  const filePath = path.join(root, ".vscode", "changepoint-highlighter.json");

  if (!fs.existsSync(filePath)) return;

  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

// „Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ
module.exports = {
  activate,
  deactivate,
};
