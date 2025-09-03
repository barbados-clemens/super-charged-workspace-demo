import { join } from 'node:path';
import { addPlaywrightToNode } from './add-playwright-nodes';
import { ProjectConfiguration, workspaceRoot } from '@nx/devkit';

// TODO: probs use a FS mock or use fixtures for testing the plugins
// https://vitest.dev/guide/mocking.html#example-3
describe('addPlaywrightToNode', async () => {
  const mockContext = {
    nxJsonConfiguration: {
      $schema: './node_modules/nx/schemas/nx-schema.json',
      namedInputs: { default: [], production: [], sharedGlobals: [] },
      plugins: [],
      targetDefaults: { 'e2e-ci--**/*': {}, '@nx/js:tsc': {} },
      generators: { '@nx/react': {} },
    },
    workspaceRoot,
    configFiles: [],
  };

  it('should not create create targets for non playwright projects', async () => {
    const node = { root: 'libs/tools/nx-plugin', targets: {}, metadata: {} };
    await addPlaywrightToNode(
      join(node.root, 'package.json'),
      {},
      mockContext,
      node
    );

    expect(node.targets).toMatchInlineSnapshot(`{}`);
  });

  it('should add e2e nodes for playwright projects', async () => {
    const node: ProjectConfiguration = {
      root: 'apps/web/app-one-e2e',
      targets: {},
      metadata: {},
    };

    await expect(
      addPlaywrightToNode(
        join(node.root, 'package.json'),
        {},
        mockContext,
        node
      )
    ).resolves.not.toThrow();

    expect(node.targets!.e2e).toMatchInlineSnapshot(`
      {
        "cache": true,
        "command": "playwright test",
        "inputs": [
          "default",
          "^production",
          {
            "externalDependencies": [
              "@playwright/test",
              "playwright-bdd",
            ],
          },
        ],
        "metadata": {
          "description": "Runs Playwright Tests",
          "help": {
            "command": "npx playwright test --help",
            "example": {
              "options": {
                "workers": 1,
              },
            },
          },
          "technologies": [
            "playwright",
          ],
        },
        "options": {
          "cwd": "{projectRoot}",
        },
        "outputs": [
          "{projectRoot}/test-results",
        ],
        "parallelism": false,
      }
    `);
    expect(node.targets!['e2e-ci']).toMatchInlineSnapshot(`
      {
        "cache": true,
        "dependsOn": [],
        "executor": "nx:noop",
        "inputs": [
          "default",
          "^production",
          {
            "externalDependencies": [
              "@playwright/test",
              "playwright-bdd",
            ],
          },
        ],
        "metadata": {
          "description": "Runs Playwright Tests in CI",
          "help": {
            "command": "npx playwright test --help",
            "example": {
              "options": {
                "workers": 1,
              },
            },
          },
          "nonAtomizedTarget": "e2e",
          "technologies": [
            "playwright",
          ],
        },
        "outputs": [
          "{projectRoot}/test-results",
        ],
        "parallelism": false,
      }
    `);
    expect(node.metadata).toMatchInlineSnapshot(`
      {
        "targetGroups": {
          "E2E (CI)": [
            "e2e-ci",
          ],
        },
      }
    `);
  });
});
