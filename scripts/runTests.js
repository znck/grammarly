const Path = require('path');
const { runTests } = require('vscode-test');

process.env.VSCODE_CLI = '1';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = Path.resolve(__dirname, '..');

    // The path to the extension test runner script
    // Passed to --extensionTestsPath
    const extensionTestsPath = Path.resolve(__dirname, '../out-test/runner');

    // Download VS Code, unzip it and run the integration test
    await runTests({
      version: '1.41.0',
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        '--disable-extensions',
        '--user-data-dir=' + Path.resolve(__dirname, '../fixtures/user'),
        Path.resolve(__dirname, '../fixtures/folder'),
      ],
      extensionTestsEnv: {
        EXTENSION_TEST_MODE: true,
      },
    });
  } catch {
    console.error('Failed to run tests');
    process.exit(1);
  }
}

main();
