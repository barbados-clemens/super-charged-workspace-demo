import { CreateNodesV2 } from '@nx/devkit';

// we want to match all projects and use that
// to attach the specific targets to based on what is inside that project
const pattern = '**/package.json';
export const createNodesV2: CreateNodesV2 = [
  pattern,
  async (configFiles, options, context) => {
    return [];
  },
];
