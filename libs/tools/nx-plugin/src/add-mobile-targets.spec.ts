import { addMobileTargetsToNode } from './add-mobile-targets';
import { ProjectConfiguration, workspaceRoot } from '@nx/devkit';
describe('addMobileTargetsToNode', () => {
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
  it('should add target', async () => {
    const node: ProjectConfiguration = {
      root: 'apps/web/app-one-e2e',
      targets: {},
      metadata: {},
    };

    await addMobileTargetsToNode(node.root, {}, mockContext, node);

    expect(node.targets).toEqual({
      build: { command: 'some command goes here' },
    });
  });
});
