import { CreateNodesContextV2, ProjectConfiguration } from '@nx/devkit';
import { readdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';

export function addTagsToNode(
  configFilePath: string,
  // could send in a config that will determine how to map project names or those to exclude etc
  options: unknown | undefined,
  context: CreateNodesContextV2,
  currentNode: ProjectConfiguration
) {
  currentNode.tags ??= [];

  // maybe we want detection with some siblingFile like app.json or something else
  const siblingFiles = readdirSync(
    join(context.workspaceRoot, currentNode.root)
  );

  // paths are all based to be inside a given directory that denotes it's "scope"
  // i.e. mobile or web
  // apps/mobile/<some-app-name>
  // libs/web/<some-lib-name>
  const parentDir = dirname(currentNode.root);
  const scope = basename(parentDir);

  currentNode.tags.push(`scope:${scope.toLowerCase()}`);
}
