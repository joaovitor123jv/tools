# NestJS Routes Explorer

A Visual Studio Code extension that allows you to explore and navigate NestJS routes in your project.

## Installation

There are two ways to install this extension:

### Option 1: Install from VSIX file

1. Download the `.vsix` file from the release or build it yourself (see below)
2. Open VS Code
3. Go to the Extensions view (Ctrl+Shift+X)
4. Click on the "..." menu in the top-right of the Extensions view
5. Select "Install from VSIX..."
6. Navigate to and select the downloaded `.vsix` file
7. Restart VS Code if prompted

### Option 2: Install from Command Line

```bash
code --install-extension nestjs-routes-explorer-0.0.1.vsix
```

### Building from Source

If you want to build the extension yourself:

1. Clone the repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to compile the TypeScript
4. Install the VSCE tool globally: `npm install -g @vscode/vsce`
5. Package the extension: `vsce package`
6. This will create a `.vsix` file that you can install using one of the methods above

## Features

- View all NestJS routes in a dedicated sidebar
- Routes are organized by controller
- Each route shows its HTTP method (GET, POST, PUT, DELETE, etc.) and path
- Click on a route to navigate directly to its definition in the code
- Auto-refresh when controllers are updated
- Color-coded routes based on HTTP method

## Usage

1. Click on the NestJS icon in the Activity Bar on the left side of VS Code
2. The sidebar will show all NestJS routes organized by controller
3. Click on any route to jump to its definition in the code
4. Use the refresh button at the top of the sidebar to manually refresh routes

## Requirements

- Visual Studio Code version 1.99.0 or higher
- A NestJS project with controller files (*.controller.ts)

## How it works

The extension scans your workspace for NestJS controller files (*.controller.ts) and parses them to find route decorators like `@Get()`, `@Post()`, `@Put()`, etc. It then displays these routes in a tree view in the sidebar, grouped by controller.

When you click on a route, the extension opens the corresponding file and navigates to the line where the route decorator is defined.

## Extension Settings

This extension doesn't add any settings yet.

## Known Issues

- Complex NestJS route setups with dynamic routes might not be parsed correctly
- Routes defined with variables or expressions might not display the correct path

## Release Notes

### 0.0.1

- Initial release of NestJS Routes Explorer
- Basic route scanning and navigation functionality
- Tree view with routes organized by controller

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
