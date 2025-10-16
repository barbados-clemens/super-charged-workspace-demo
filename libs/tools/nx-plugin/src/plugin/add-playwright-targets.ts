import { readdirSync } from 'node:fs';
import { minimatch } from 'minimatch';
import { dirname, join, parse, relative, resolve } from 'node:path';
import {
  CreateNodesContextV2,
  getPackageManagerCommand,
  joinPathFragments,
  normalizePath,
  ProjectConfiguration,
  TargetConfiguration,
} from '@nx/devkit';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { PlaywrightTestConfig } from '@playwright/test';
import { getFilesInDirectoryUsingContext } from 'nx/src/utils/workspace-context';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';
export interface BddPlaywrightOptions {
  featureDir?: string;
  featureMatch?: string;
  targetName?: string;
  ciTargetName?: string;
}

export interface NormalizedOptions {
  featureDir: string;
  featureMatch: string;
  targetName: string;
  ciTargetName: string;
}

const playwrightConfigGlob = '**/playwright.config.{js,ts,cjs,cts,mjs,mts}';
const pmc = getPackageManagerCommand();

export async function addPlaywrightToNode(
  configFilePath: string,
  options: BddPlaywrightOptions | undefined,
  context: CreateNodesContextV2,
  currentNode: ProjectConfiguration
) {
  const siblingFiles = readdirSync(
    join(context.workspaceRoot, currentNode.root)
  );

  //  Do not create a project if playwright config isn't present
  if (!siblingFiles.includes('playwright.config.ts')) {
    return;
  }
  const normalizedOptions = normalizeOptions(options);

  const { targets, metadata } = await buildPlaywrightTargets(
    configFilePath,
    currentNode.root,
    normalizedOptions,
    context
  );

  // TODO: we might need to deep merge targets but it's unlikely target names would be the same between other function
  // i.e. no other function should be setting up e2e targets
  currentNode.targets = Object.assign(currentNode.targets ?? {}, targets);
  currentNode.metadata = Object.assign(currentNode.metadata ?? {}, metadata);
}

async function buildPlaywrightTargets(
  configFilePath: string,
  projectRoot: string,
  options: NormalizedOptions,
  context: CreateNodesContextV2
) {
  // Playwright forbids importing the `@playwright/test` module twice. This would affect running the tests,
  // but we're just reading the config so let's delete the variable they are using to detect this.
  // See: https://github.com/microsoft/playwright/pull/11218/files
  delete (process as any)['__pw_initiator__'];
  const playwrightConfig = await loadConfigFile<PlaywrightTestConfig>(
    join(context.workspaceRoot, configFilePath)
  );

  const namedInputs = getNamedInputs(projectRoot, context);
  const targets: ProjectConfiguration['targets'] = {};
  let metadata: ProjectConfiguration['metadata'];

  const testOutput = playwrightConfig?.outputDir ?? './test-results';
  const reporterOutputs = getReporterOutputs(playwrightConfig);
  const webserverCommandTasks = getWebserverCommandTasks(playwrightConfig);
  const baseTargetConfig: TargetConfiguration = {
    command: 'playwright test',
    options: {
      cwd: '{projectRoot}',
    },
    metadata: {
      technologies: ['playwright'],
      description: 'Runs Playwright Tests',
      help: {
        command: `${pmc.exec} playwright test --help`,
        example: {
          options: {
            workers: 1,
          },
        },
      },
    },
  };

  if (webserverCommandTasks.length) {
    baseTargetConfig.dependsOn = getDependsOn(webserverCommandTasks);
  } else {
    baseTargetConfig.parallelism = false;
  }

  targets[options.targetName] = {
    ...baseTargetConfig,
    cache: true,
    inputs: [
      ...('production' in namedInputs
        ? ['default', '^production']
        : ['default', '^default']),
      { externalDependencies: ['@playwright/test', 'playwright-bdd'] },
    ],
    outputs: getTargetOutputs(
      testOutput,
      reporterOutputs,
      context.workspaceRoot,
      projectRoot
    ),
  };

  if (options.ciTargetName) {
    const ciBaseTargetConfig = {
      ...targets[options.targetName],
      metadata: {
        ...baseTargetConfig.metadata,
        description: 'Runs Playwright Tests in CI',
      },
    };

    const groupName = 'E2E (CI)';
    metadata = { targetGroups: { [groupName]: [] } };

    const ciTargetGroup = metadata.targetGroups![groupName];

    const featureDir = options.featureDir
      ? joinPathFragments(projectRoot, options.featureDir)
      : projectRoot;

    // bdd-playwright makes testDir an absolute path
    const testDir = playwrightConfig.testDir
      ? joinPathFragments(
          projectRoot,
          relative(context.workspaceRoot, playwrightConfig.testDir)
        )
      : projectRoot;

    const dependsOn: TargetConfiguration['dependsOn'] = [];

    await forEachTestFile(
      (featureFile) => {
        const outputSubfolder = relative(projectRoot, featureFile)
          .replace(/[/\\]/g, '-')
          .replace(/\./g, '-');

        const relativeFeatureFilePath = normalizePath(
          relative(projectRoot, featureFile)
        );

        const relativeSpecFilePath = normalizePath(
          joinPathFragments(
            relative(projectRoot, testDir),
            `${relativeFeatureFilePath}.spec.js`
          )
        );

        const targetName = `${options.ciTargetName}--${relativeFeatureFilePath}`;
        ciTargetGroup.push(targetName);
        targets[targetName] = {
          ...ciBaseTargetConfig,
          options: {
            ...ciBaseTargetConfig.options,
            env: getOutputEnvVars(reporterOutputs, outputSubfolder),
          },
          outputs: getTargetOutputs(
            testOutput,
            reporterOutputs,
            context.workspaceRoot,
            projectRoot,
            outputSubfolder
          ),
          command: `${
            baseTargetConfig.command
          } ${relativeSpecFilePath} --output=${join(
            testOutput,
            outputSubfolder
          )}`,
          metadata: {
            technologies: ['playwright'],
            description: `Runs Playwright Tests in ${relativeFeatureFilePath} in CI`,
            help: {
              command: `${pmc.exec} playwright test --help`,
              example: {
                options: {
                  workers: 1,
                },
              },
            },
          },
        };

        dependsOn.push({
          target: targetName,
          projects: 'self',
          params: 'forward',
        });
      },
      {
        context,
        path: featureDir,
        config: playwrightConfig,
        pluginConfig: options,
      }
    );

    targets[options.ciTargetName] ??= {};
    targets[options.ciTargetName] = {
      executor: 'nx:noop',
      dependsOn,
      cache: ciBaseTargetConfig.cache,
      inputs: ciBaseTargetConfig.inputs,
      outputs: ciBaseTargetConfig.outputs,
      metadata: {
        technologies: ['playwright'],
        description: 'Runs Playwright Tests in CI',
        nonAtomizedTarget: options.targetName,
        help: {
          command: `${pmc.exec} playwright test --help`,
          example: {
            options: {
              workers: 1,
            },
          },
        },
      },
    };

    if (!webserverCommandTasks.length) {
      targets[options.ciTargetName].parallelism = false;
    }
    targets['bdd-gen'] = {
      command: 'bddgen',
      options: {
        cwd: projectRoot,
      },
    };
    ciTargetGroup.push(options.ciTargetName);
  }

  return { targets, metadata };
}

async function forEachTestFile(
  cb: (path: string) => void,
  opts: {
    context: CreateNodesContextV2;
    path: string;
    config: PlaywrightTestConfig;
    pluginConfig: NormalizedOptions;
  }
) {
  const files = await getFilesInDirectoryUsingContext(
    opts.context.workspaceRoot,
    opts.path
  );
  const matcher = createMatcher(opts.pluginConfig.featureMatch);
  const ignoredMatcher = opts.config.testIgnore
    ? createMatcher(opts.config.testIgnore)
    : () => false;
  for (const file of files) {
    if (matcher(file) && !ignoredMatcher(file)) {
      cb(file);
    }
  }
}

function createMatcher(
  pattern: string | RegExp | Array<string | RegExp>
): (path: string) => boolean {
  if (Array.isArray(pattern)) {
    const matchers = pattern.map((p) => createMatcher(p));
    return (path: string) => matchers.some((m) => m(path));
  } else if (pattern instanceof RegExp) {
    return (path: string) => pattern.test(path);
  } else {
    return (path: string) => {
      try {
        return minimatch(path, pattern);
      } catch (e: any) {
        throw new Error(
          `Error matching ${path} with ${pattern}: ${e.message}`,
          { cause: e }
        );
      }
    };
  }
}

function normalizeOptions(
  options: BddPlaywrightOptions | undefined
): NormalizedOptions {
  return {
    ...options,
    featureDir: options?.featureDir ?? './features',
    featureMatch: options?.featureMatch ?? '**/*.feature',
    targetName: options?.targetName ?? 'e2e',
    ciTargetName: options?.ciTargetName ?? 'e2e-ci',
  };
}

function getReporterOutputs(
  playwrightConfig: PlaywrightTestConfig
): Array<[string, string]> {
  const outputs: Array<[string, string]> = [];

  const { reporter } = playwrightConfig;

  if (reporter) {
    const DEFAULT_REPORTER_OUTPUT = 'playwright-report';
    if (reporter === 'html') {
      outputs.push([reporter, DEFAULT_REPORTER_OUTPUT]);
    } else if (reporter === 'json') {
      outputs.push([reporter, DEFAULT_REPORTER_OUTPUT]);
    } else if (Array.isArray(reporter)) {
      for (const r of reporter) {
        const [reporter, opts] = r;
        // There are a few different ways to specify an output file or directory
        // depending on the reporter. This is a best effort to find the output.
        if (opts?.outputFile) {
          outputs.push([reporter, opts.outputFile]);
        } else if (opts?.outputDir) {
          outputs.push([reporter, opts.outputDir]);
        } else if (opts?.outputFolder) {
          outputs.push([reporter, opts.outputFolder]);
        } else {
          outputs.push([reporter, DEFAULT_REPORTER_OUTPUT]);
        }
      }
    }
  }

  return outputs;
}

function getTargetOutputs(
  testOutput: string,
  reporterOutputs: Array<[string, string]>,
  workspaceRoot: string,
  projectRoot: string,
  subFolder?: string
): string[] {
  const outputs = new Set<string>();
  outputs.add(
    normalizeOutput(
      addSubfolderToOutput(testOutput, subFolder),
      workspaceRoot,
      projectRoot
    )
  );
  for (const [, output] of reporterOutputs) {
    outputs.add(
      normalizeOutput(
        addSubfolderToOutput(output, subFolder),
        workspaceRoot,
        projectRoot
      )
    );
  }
  return Array.from(outputs);
}

function addSubfolderToOutput(output: string, subfolder?: string): string {
  if (!subfolder) return output;
  const parts = parse(output);
  if (parts.ext !== '') {
    return join(parts.dir, subfolder, parts.base);
  }
  return join(output, subfolder);
}

function getWebserverCommandTasks(
  playwrightConfig: PlaywrightTestConfig
): Array<{ project: string; target: string }> {
  if (!playwrightConfig.webServer) {
    return [];
  }

  const tasks: Array<{ project: string; target: string }> = [];

  const webServer = Array.isArray(playwrightConfig.webServer)
    ? playwrightConfig.webServer
    : [playwrightConfig.webServer];

  for (const server of webServer) {
    if (!server.reuseExistingServer) {
      continue;
    }

    const task = parseTaskFromCommand(server.command);
    if (task) {
      tasks.push(task);
    }
  }

  return tasks;
}

function parseTaskFromCommand(command: string): {
  project: string;
  target: string;
} | null {
  const nxRunRegex =
    /^(?:(?:npx|yarn|bun|pnpm|pnpm exec|pnpx) )?nx run (\S+:\S+)$/;
  const infixRegex = /^(?:(?:npx|yarn|bun|pnpm|pnpm exec|pnpx) )?nx (\S+ \S+)$/;

  const nxRunMatch = command.match(nxRunRegex);
  if (nxRunMatch) {
    const [project, target] = nxRunMatch[1].split(':');
    return { project, target };
  }

  const infixMatch = command.match(infixRegex);
  if (infixMatch) {
    const [target, project] = infixMatch[1].split(' ');
    return { project, target };
  }

  return null;
}

function getDependsOn(
  tasks: Array<{ project: string; target: string }>
): TargetConfiguration['dependsOn'] {
  const projectsPerTask = new Map<string, string[]>();

  for (const { project, target } of tasks) {
    const existing = projectsPerTask.get(target);

    if (existing) {
      existing.push(project);
      projectsPerTask.set(target, existing);
    } else {
      projectsPerTask.set(target, []);
    }
  }

  return Array.from(projectsPerTask.entries()).map(([target, projects]) => ({
    projects,
    target,
  }));
}

function normalizeOutput(
  path: string,
  workspaceRoot: string,
  projectRoot: string
): string {
  const fullProjectRoot = resolve(workspaceRoot, projectRoot);
  const fullPath = resolve(fullProjectRoot, path);
  const pathRelativeToProjectRoot = normalizePath(
    relative(fullProjectRoot, fullPath)
  );
  if (pathRelativeToProjectRoot.startsWith('..')) {
    return joinPathFragments(
      '{workspaceRoot}',
      relative(workspaceRoot, fullPath)
    );
  }
  return joinPathFragments('{projectRoot}', pathRelativeToProjectRoot);
}

function getOutputEnvVars(
  reporterOutputs: Array<[string, string]>,
  outputSubfolder: string
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [reporter, output] of reporterOutputs) {
    if (outputSubfolder) {
      const isFile = parse(output).ext !== '';
      const envVarName = `PLAYWRIGHT_${reporter.toUpperCase()}_OUTPUT_${
        isFile ? 'FILE' : 'DIR'
      }`;
      env[envVarName] = addSubfolderToOutput(output, outputSubfolder);
      // Also set PLAYWRIGHT_HTML_REPORT for Playwright prior to 1.45.0.
      // HTML prior to this version did not follow the pattern of "PLAYWRIGHT_<REPORTER>_OUTPUT_<FILE|DIR>".
      if (reporter === 'html') {
        env['PLAYWRIGHT_HTML_REPORT'] = env[envVarName];
      }
    }
  }
  return env;
}
