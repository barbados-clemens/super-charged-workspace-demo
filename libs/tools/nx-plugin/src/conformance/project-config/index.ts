import { createConformanceRule, ConformanceViolation } from '@nx/conformance';
import { TargetConfiguration, workspaceRoot } from '@nx/devkit';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve as resolvePath } from 'node:path';

export default createConformanceRule({
  name: 'ensure-project-config',
  category: 'consistency',
  description: 'all projects must conform to workspace standards',
  implementation: async (context) => {
    const violations: ConformanceViolation[] = [];

    if (!context.projectGraph) {
      // don't have a graph so can't do the checks
      return {
        severity: 'low',
        details: {
          violations,
        },
      };
    }

    for (const project of Object.values(context.projectGraph.nodes)) {
      const { data: projectConfig, name, type } = project;

      // root project. i.e. the root package.json
      if (projectConfig.root === '.') {
        if (!projectConfig.targets) {
          continue;
        }

        const trivialTargets = Object.entries(projectConfig.targets).filter(
          ([targetName, targetConfig]) => isTrivialTarget(targetConfig)
        );

        if (trivialTargets.length > 0) {
          const targeNames = trivialTargets.map(([tn]) => tn);
          violations.push({
            message: `Root project should not define targets that just call Nx. Invalid target impls: ${targeNames.join(
              ', '
            )}`,
            file: projectConfig.root,
            sourceProject: name,
          });
        }
      } else {
        if (!projectConfig.tags || projectConfig.tags.length === 0) {
          violations.push({
            message: `Project ${name} is not tagged`,
            file: projectConfig.root,
            sourceProject: name,
          });
        }

        if (!projectConfig.targets) {
          violations.push({
            message: `Project ${name} does not define any targets. is it configured correctly?`,
            file: projectConfig.root,
            sourceProject: name,
          });
        } else {
          const targets = Object.keys(projectConfig.targets);

          // a project must define at least 1 of these
          const requiredTargetNames = ['build', 'lint', 'test', 'e2e', 'serve'];
          if (!targets.some((t) => requiredTargetNames.includes(t))) {
            violations.push({
              message: `Project ${name} doesn't define a required target name. 1 of the following must be defined: ${requiredTargetNames.join(
                ', '
              )}`,
              file: projectConfig.root,
              sourceProject: name,
            });
          }
        }

        const maybeTsConfigs = readdirSync(
          join(workspaceRoot, projectConfig.root),
          { withFileTypes: true }
        ).filter(
          (f) =>
            f.isFile() &&
            f.name.startsWith('tsconfig') &&
            f.name.endsWith('.json')
        );

        for (const ts of maybeTsConfigs) {
          // @ts-expect-error - parentPath exists since node v18: https://nodejs.org/api/fs.html#class-fsdirent
          const tsPath = join(ts.parentPath, ts.name);

          if (!isTsConfigValid(projectConfig.root, tsPath)) {
            violations.push({
              message: `TSConfig paths outside of project root. Use package.json#dependencies with project references for using other projects`,
              // provide path from workspaceRoot for easier reading
              file: relative(workspaceRoot, tsPath),
              sourceProject: name,
            });
          }
        }
      }
    }

    return {
      severity: 'high',
      details: {
        violations,
      },
    };
  },
});

/**
{
  'blah:something': {
    executor: 'nx:run-script',
    options: { script: 'blah:something' },
    metadata: {
      scriptContent: 'nx affected -t build',
      runCommand: 'pnpm run blah:something'
    },
    configurations: {},
    parallelism: true
  },
  another: {
    executor: 'nx:run-commands',
    options: { command: 'echo 1' },
    configurations: {},
    parallelism: true
  }
}
*/

function isTrivialTarget(targetConfig: TargetConfiguration) {
  const cmds = ['nx affected', 'nx run-many', 'nx run'];
  if (targetConfig.executor === 'nx:run-script') {
    return cmds.some((cmd) =>
      targetConfig.metadata?.scriptContent.includes(cmd)
    );
  }

  if (targetConfig.executor === 'nx:run-commands') {
    if (targetConfig.options.command) {
      return cmds.some((cmd) => targetConfig.options.command.includes(cmd));
    }

    if (targetConfig.options.commands) {
      return cmds.some((cmd) =>
        targetConfig.options.commands.some((targetCmd: string) =>
          targetCmd.includes(cmd)
        )
      );
    }
  }
}

function isTsConfigValid(projectRoot: string, tsConfigPath: string): boolean {
  if (!existsSync(tsConfigPath)) {
    console.warn(`Tsconfig does not exist at ${tsConfigPath}`);
    return false;
  }

  const tsConfigContent = readFileSync(tsConfigPath, 'utf8');

  try {
    const tsConfig = JSON.parse(tsConfigContent);

    const paths = tsConfig?.compilerOptions?.paths;
    if (!paths) {
      return true;
    }

    const pathMap = new Map<string, boolean>();
    const fullProjectRoot = resolvePath(workspaceRoot, projectRoot);
    const isValidPath = (p: string) => {
      const fullPath = resolvePath(join(projectRoot, p));
      const relFromRoot = relative(fullProjectRoot, fullPath);

      // path is going up and out of the project root
      return !relFromRoot.startsWith('../');
    };
    /**
     *     "paths": {
      "~utils/*": ["../../web/utils/src/*"],
      "~/*": ["./src/*"]
    }
*/
    for (const entry of Object.values(paths)) {
      if (Array.isArray(entry)) {
        // for each item check if it goes outside the projectRoot.
        // if so then it's a bad tsconfig and should use project refs + pnpm workspace dep instead
        entry.forEach((p) => {
          pathMap.set(p, isValidPath(p));
        });
      }
    }

    return Array.from(pathMap.values()).every((p) => p);
  } catch (e) {
    console.warn(`Unable to check tsconfig at ${tsConfigPath}`);
    return false;
  }
}
