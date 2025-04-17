import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Define types for route information
interface NestJSRoute {
    method: string;
    path: string;
    controllerPath: string;
    lineNumber: number;
    filePath: string;
}

// Define tree item for route
class RouteTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly route?: NestJSRoute,
        public readonly children?: RouteTreeItem[]
    ) {
        super(label, collapsibleState);

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

    private getIconColorForMethod(method: string): string {
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
class NestJSRoutesProvider implements vscode.TreeDataProvider<RouteTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<RouteTreeItem | undefined | null | void> = new vscode.EventEmitter<RouteTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<RouteTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private routes: NestJSRoute[] = [];
    private treeItems: RouteTreeItem[] = [];

    constructor(private workspaceRoot: string | undefined) {
        this.refresh();
    }

    refresh(): void {
        this.routes = [];
        this.treeItems = [];
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: RouteTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: RouteTreeItem): Promise<RouteTreeItem[]> {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No NestJS routes found in empty workspace');
            return Promise.resolve([]);
        }

        if (element) {
            // Return children of this specific element
            return element.children || [];
        } else {
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
    private buildTreeItems(): void {
        // Group routes by controller file
        const controllerMap = new Map<string, NestJSRoute[]>();

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
            const routeItems: RouteTreeItem[] = routes.map(route =>
                new RouteTreeItem(
                    `${route.method.toUpperCase()} ${route.path}`,
                    vscode.TreeItemCollapsibleState.None,
                    route
                )
            );

            // Create controller node with route children
            const controllerItem = new RouteTreeItem(
                controllerName.replace('.controller.ts', ''),
                vscode.TreeItemCollapsibleState.Expanded,
                undefined,
                routeItems
            );
            controllerItem.iconPath = new vscode.ThemeIcon('symbol-class');

            this.treeItems.push(controllerItem);
        }

        // Sort controllers alphabetically
        this.treeItems.sort((a, b) => a.label.localeCompare(b.label));
    }

    // Scan workspace for NestJS controller files and parse routes
    private async scanWorkspaceForRoutes(): Promise<void> {
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
        } catch (error) {
            console.error('Error scanning workspace:', error);
            vscode.window.showErrorMessage(`Error scanning workspace: ${error}`);
        }
    }

    // Parse a controller file to find route decorators
    private async parseControllerFile(filePath: vscode.Uri): Promise<NestJSRoute[]> {
        const routes: NestJSRoute[] = [];

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
        } catch (error) {
            console.error(`Error parsing controller file ${filePath.fsPath}:`, error);
        }

        return routes;
    }
}

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
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
    context.subscriptions.push(
        vscode.commands.registerCommand('nestjs-routes-explorer.refreshRoutes', () => {
            nestJSRoutesProvider.refresh();
            vscode.window.showInformationMessage('NestJS routes refreshed');
        })
    );

    // Register the open route definition command
    context.subscriptions.push(
        vscode.commands.registerCommand('nestjs-routes-explorer.openRouteDefinition', async (route: NestJSRoute) => {
            try {
                const document = await vscode.workspace.openTextDocument(route.filePath);
                const editor = await vscode.window.showTextDocument(document);

                // Go to the line and reveal it in the center of the editor
                const position = new vscode.Position(route.lineNumber, 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(
                    new vscode.Range(position, position),
                    vscode.TextEditorRevealType.InCenter
                );
            } catch (error) {
                vscode.window.showErrorMessage(`Could not open route definition: ${error}`);
            }
        })
    );

    // Watch for changes in controller files to auto-refresh
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.controller.ts', true);

    fileWatcher.onDidChange(() => nestJSRoutesProvider.refresh());
    fileWatcher.onDidCreate(() => nestJSRoutesProvider.refresh());
    fileWatcher.onDidDelete(() => nestJSRoutesProvider.refresh());

    context.subscriptions.push(fileWatcher);
    context.subscriptions.push(treeView);
}

// This method is called when your extension is deactivated
export function deactivate() { }
