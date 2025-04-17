"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
// Define tree item for route
class RouteTreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    route;
    children;
    constructor(label, collapsibleState, route, children) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.route = route;
        this.children = children;
        if (route) {
            this.tooltip = `${route.method.toUpperCase()} ${route.path}`;
            this.description = route.path;
            this.command = {
                command: 'nestjs-routes-explorer.openRouteDefinition',
                title: 'Open Route Definition',
                arguments: [route]
            };
            // Set context value based on HTTP method
            this.contextValue = route.method.toLowerCase();
            // Set icon based on HTTP method
            const iconColor = this.getIconColorForMethod(route.method);
            this.iconPath = new vscode.ThemeIcon('symbol-method', new vscode.ThemeColor(iconColor));
        }
    }
    getIconColorForMethod(method) {
        switch (method.toLowerCase()) {
            case 'get':
                return 'charts.blue';
            case 'post':
                return 'charts.green';
            case 'put':
                return 'charts.yellow';
            case 'patch':
                return 'charts.orange';
            case 'delete':
                return 'charts.red';
            default:
                return 'foreground';
        }
    }
}
// Create a tree data provider for NestJS routes
class NestJSRoutesProvider {
    workspaceRoot;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    routes = [];
    treeItems = [];
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.refresh();
    }
    refresh() {
        this.routes = [];
        this.treeItems = [];
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No NestJS routes found in empty workspace');
            return Promise.resolve([]);
        }
        if (element) {
            // Return children of this specific element
            return element.children || [];
        }
        else {
            // Root level - scan and build the tree structure
            if (this.treeItems.length === 0) {
                if (this.routes.length === 0) {
                    await this.scanWorkspaceForRoutes();
                }
                if (this.routes.length === 0) {
                    return [new RouteTreeItem('No NestJS routes found', vscode.TreeItemCollapsibleState.None)];
                }
                this.buildTreeItems();
            }
            return this.treeItems;
        }
    }
    // Build tree items from the flat routes list
    buildTreeItems() {
        // Group routes by controller file
        const controllerMap = new Map();
        for (const route of this.routes) {
            const controllerName = path.basename(route.filePath);
            if (!controllerMap.has(controllerName)) {
                controllerMap.set(controllerName, []);
            }
            controllerMap.get(controllerName)?.push(route);
        }
        // Create controller nodes with route children
        for (const [controllerName, routes] of controllerMap.entries()) {
            // Sort routes by method and path
            routes.sort((a, b) => {
                if (a.path === b.path) {
                    return a.method.localeCompare(b.method);
                }
                return a.path.localeCompare(b.path);
            });
            // Create route items for this controller
            const routeItems = routes.map(route => new RouteTreeItem(`${route.method.toUpperCase()} ${route.path}`, vscode.TreeItemCollapsibleState.None, route));
            // Create controller node with route children
            const controllerItem = new RouteTreeItem(controllerName.replace('.controller.ts', ''), vscode.TreeItemCollapsibleState.Expanded, undefined, routeItems);
            controllerItem.iconPath = new vscode.ThemeIcon('symbol-class');
            this.treeItems.push(controllerItem);
        }
        // Sort controllers alphabetically
        this.treeItems.sort((a, b) => a.label.localeCompare(b.label));
    }
    // Scan workspace for NestJS controller files and parse routes
    async scanWorkspaceForRoutes() {
        if (!this.workspaceRoot) {
            return;
        }
        try {
            // Find all controller files (*.controller.ts)
            const controllerPattern = new vscode.RelativePattern(this.workspaceRoot, '**/*.controller.ts');
            const controllerFiles = await vscode.workspace.findFiles(controllerPattern, '**/node_modules/**');
            if (controllerFiles.length === 0) {
                vscode.window.showInformationMessage('No NestJS controller files found in workspace');
                return;
            }
            // Process each controller file
            for (const controllerFile of controllerFiles) {
                const routes = await this.parseControllerFile(controllerFile);
                this.routes.push(...routes);
            }
        }
        catch (error) {
            console.error('Error scanning workspace:', error);
            vscode.window.showErrorMessage(`Error scanning workspace: ${error}`);
        }
    }
    // Parse a controller file to find route decorators
    async parseControllerFile(filePath) {
        const routes = [];
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            const text = document.getText();
            const lines = text.split('\n');
            // Define regex patterns for route decorators
            const decoratorPattern = /@(Get|Post|Put|Delete|Patch|Options|Head|All)\s*\(\s*['"]?(.*?)['"]?\s*\)/g;
            const controllerPattern = /@Controller\s*\(\s*['"]?(.*?)['"]?\s*\)/;
            // Find controller base path
            let controllerBasePath = '';
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const match = controllerPattern.exec(line);
                if (match) {
                    controllerBasePath = match[1] || '';
                    break;
                }
            }
            // Normalize the base path
            controllerBasePath = controllerBasePath || '';
            controllerBasePath = controllerBasePath.startsWith('/')
                ? controllerBasePath
                : `/${controllerBasePath}`;
            controllerBasePath = controllerBasePath.endsWith('/') && controllerBasePath.length > 1
                ? controllerBasePath.slice(0, -1)
                : controllerBasePath;
            // Find route decorators
            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                const line = lines[lineIndex];
                let match;
                const localDecorator = new RegExp(decoratorPattern);
                while ((match = localDecorator.exec(line)) !== null) {
                    const method = match[1].toLowerCase();
                    let path = match[2] || '';
                    // Normalize the path
                    path = path ? (path.startsWith('/') ? path : `/${path}`) : '';
                    const fullPath = path ? `${controllerBasePath}${path}` : controllerBasePath;
                    routes.push({
                        method,
                        path: fullPath,
                        controllerPath: filePath.path,
                        lineNumber: lineIndex,
                        filePath: filePath.fsPath
                    });
                }
            }
        }
        catch (error) {
            console.error(`Error parsing controller file ${filePath.fsPath}:`, error);
        }
        return routes;
    }
}
// This method is called when your extension is activated
function activate(context) {
    console.log('NestJS Routes Explorer extension is now active!');
    // Get the workspace folder
    const workspaceRoot = vscode.workspace.workspaceFolders
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : undefined;
    // Create and register the tree data provider
    const nestJSRoutesProvider = new NestJSRoutesProvider(workspaceRoot);
    const treeView = vscode.window.createTreeView('nestjsRoutes', {
        treeDataProvider: nestJSRoutesProvider,
        showCollapseAll: true
    });
    // Register the refresh command
    context.subscriptions.push(vscode.commands.registerCommand('nestjs-routes-explorer.refreshRoutes', () => {
        nestJSRoutesProvider.refresh();
        vscode.window.showInformationMessage('NestJS routes refreshed');
    }));
    // Register the open route definition command
    context.subscriptions.push(vscode.commands.registerCommand('nestjs-routes-explorer.openRouteDefinition', async (route) => {
        try {
            const document = await vscode.workspace.openTextDocument(route.filePath);
            const editor = await vscode.window.showTextDocument(document);
            // Go to the line and reveal it in the center of the editor
            const position = new vscode.Position(route.lineNumber, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Could not open route definition: ${error}`);
        }
    }));
    // Watch for changes in controller files to auto-refresh
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.controller.ts', true);
    fileWatcher.onDidChange(() => nestJSRoutesProvider.refresh());
    fileWatcher.onDidCreate(() => nestJSRoutesProvider.refresh());
    fileWatcher.onDidDelete(() => nestJSRoutesProvider.refresh());
    context.subscriptions.push(fileWatcher);
    context.subscriptions.push(treeView);
}
// This method is called when your extension is deactivated
function deactivate() { }
//# sourceMappingURL=extension.js.map