import { createConformanceRule, ConformanceViolation } from '@nx/conformance';
import { TargetConfiguration } from '@nx/devkit';

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

        console.log(projectConfig.targets);

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
      }
    }

    return {
      severity: 'medium',
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
