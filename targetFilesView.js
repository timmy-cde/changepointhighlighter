const vscode = require("vscode");

// „Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ
// Tree View implementation
// „Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ
class GroupNode {
  constructor(label, children = []) {
    this.label = label;
    this.children = children;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
  }
}

class FileNode {
  constructor(label, uri) {
    this.label = label;
    this.uri = uri;
    this.collapsibleState = vscode.TreeItemCollapsibleState.None;
  }
}

class TargetFilesProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;

    this.groups = []; // <-- multiple roots
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  setGroups(groups) {
    this.groups = groups;
    this.refresh();
  }

  getTreeItem(element) {
    const item = new vscode.TreeItem(element.label, element.collapsibleState);

    // ? File nodes
    if (element instanceof FileNode) {
      item.resourceUri = element.uri;

      item.command = {
        command: "vscode.open",
        title: "Open File",
        arguments: [element.uri],
      };

      // ? ADD ICON HERE
      item.iconPath = new vscode.ThemeIcon("file");
    }

    // ? Group nodes (root)
    if (element instanceof GroupNode) {
      // ? ADD ICON HERE
      item.iconPath = new vscode.ThemeIcon("folder");
    }

    return item;
  }

  getChildren(element) {
    if (!element) {
      return this.groups; // <-- multiple root nodes
    }

    if (element instanceof GroupNode) {
      return element.children;
    }

    return [];
  }
}

module.exports = {
  TargetFilesProvider,
  GroupNode,
  FileNode,
};
