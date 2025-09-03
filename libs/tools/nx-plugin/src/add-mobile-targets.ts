import { CreateNodesContextV2, ProjectConfiguration } from '@nx/devkit';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export interface MobileOptions {}
export async function addMobileTargetsToNode(
  configFilePath: string,
  options: MobileOptions | undefined,
  context: CreateNodesContextV2,
  currentNode: ProjectConfiguration
) {
  console.log('debug>>>', configFilePath, options, context, currentNode);
  const siblingFiles = readdirSync(
    join(context.workspaceRoot, currentNode.root)
  );

  //  Do not create a project if react-active config isn't present
  if (!siblingFiles.includes('metro.config.js')) {
    return;
  }

  currentNode.targets ??= {};
  currentNode.targets['build'] ??= {
    command: 'add whatever you want',
  };
}
