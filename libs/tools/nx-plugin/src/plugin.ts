import {
  createNodesFromFiles,
  CreateNodesV2,
  ProjectConfiguration,
} from '@nx/devkit';
import {
  BddPlaywrightOptions,
  addPlaywrightToNode,
} from './add-playwright-targets';
import { dirname, join } from 'node:path';
import { readdirSync } from 'node:fs';
import { addTagsToNode } from './add-tags-to-nodes';

export interface PluginOptions {
  playwright?: BddPlaywrightOptions;
  tags?: unknown;
}

// we want to match all projects and use that
// to attach the specific targets to based on what is inside that project
const pattern = '**/package.json';
export const createNodesV2: CreateNodesV2<PluginOptions> = [
  pattern,
  async (configFiles, options, context) => {
    return await createNodesFromFiles(
      async (configFile, options, context) => {
        const projectRoot = dirname(configFile);
        const siblingFiles = readdirSync(
          join(context.workspaceRoot, projectRoot)
        );
        // Do not create a project if package.json and project.json isn't there.
        if (
          !siblingFiles.includes('package.json') &&
          !siblingFiles.includes('project.json')
        ) {
          return {};
        }
        const node: ProjectConfiguration = {
          root: projectRoot,
          targets: {},
          metadata: {},
        };

        addTagsToNode(configFile, options?.['tags'], context, node);

        await addPlaywrightToNode(
          configFile,
          options?.['playwright'],
          context,
          node
        );
        // TODO: add more to each node per technology needed that isn't already covered by existing plugins

        console.log('final node >>>>', node);
        return {
          projects: {
            [projectRoot]: node,
          },
        };
      },
      configFiles,
      options ?? {},
      context
    );
  },
];
