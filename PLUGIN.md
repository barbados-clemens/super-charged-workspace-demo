## What is a plugin and why do I care?

Plugin development with Nx has lots of advantages such as being able to standardize and keep a central location of logic for your workspace
multiple things can be achieved with plugins

1. extending project graph to new languages
2. creating custom generators and executors specific to your workspace needs
3. automate setting up projects

For the most part we'll be focused on #3 which is to say leveraging Nx inferred targets to be able to tell nx that a given project exists and that it's has the a specific set of targets setup.

### Understanding target specificity

First thing is to know the specificity and goal of plugins we'll be creating.
Functionally Nx has 4 places to configure targets with increasing levels of specificity. In our case higher specificity means "closer" to the project level so the hierarchy goes from least specific to most specific

1. Nx Plugins (the thing we'll be focused on building)
2. `nx.json`
3. `package.json`
4. `project.json`

where `project.json` is going to be the _most_ specific and override anything that matches.
i.e. if you configure the `nx.json#targetDefaults` to specify the inputs of a `build` target. but in the `project.json` you change these inputs, the `project.json` values will "win" and be the values Nx uses. This provides escape hatches of our plugins and the goal of the plugin is to take care of a lot of the boiler plate and common setup definitions needed by projects based on their technology where each project might have a extra need to tweak and are freely able to do this

> Note: we have ways of prevent people from overriding/changing definitions if we want to make sure say, a project has to have a build target or you can't ignore the `lint` target etc via the Nx Conformance rules. More on that later

## Debugging hot tips

Before we can start diving into the example plugin, we need to know that plugins work by running in a `plugin-worker` background process. that means if you `console.log` then those will be swallowed and be confusing to figure out what's going on when you make a change. While working on a plugin it's best practice to disable the Nx Daemon so everything runs in the foreground and you can see `console.log`s and not have to worry about things being swallowed.

Okay now to get started

## Plugin setup

Because we're responsible and good developers, we have a clean git worktree and in a new branch

In an existing Nx workspace run `nx add @nx/plugin`

> `npx create-nx-workspace@latest` to make a new one if you don't have a nx workspace

Next let's go a head and commit this new package being added as a fallback place to come back

now let's create a shell of a plugin
Run `nx g plugin`

this will ask some questions.

Basically put the plugin in a location that makes sense like `libs/tools/nx-plugin` or `tools/local-plugin` or `packages/my-company-plugin` whatever floats your boat with the options that make the sense

> I noticed there wasn't a vitest unit test runner option for the `@nx/plugin@20.2.0` so I picked "none" and manually setup vitest config for the project which we can get to later

this should create some files in the project you told it to create in, if it doesn't look right then just reset your git work tree and try again to make sure things are in the place you expect. For this post I will say things were generated in `libs/tools/nx-plugin` You can adjust as needed for your own plugin

Once we're happy with out paths. commit this as another "save point"

## Inferred targets and you aka `createNodesV2` aka project crystal

As mentioned in the beginning we're focused on using plugins for the _inferred targets_ functionality but what actually is an inferred target?

_inferred targets_ is the goal of telling Nx "hey I setup this toolchain in my project and this is what I want to do with it" without having to manually specify each target in each projects configuration file which can be brittle and overly verbose at times.

So the _whole goal_ of this plugin is to the following

1. reduce repetitive configurations that most devs don't need to concern themselves with day to day
2. centralize the configurations so 1 place controls how projects are defined
3. unlock _fancier_ features like Nx Atomizer by being able to define atomized targets
   1. more on this later

For the _most part_ 1st party nx plugins already ship with inferred target support so we can leverage most of those out of the box. inferred plugins we know we want to leverage that we don't need to concern ourselves with

- vite/vitest
- eslint
- tsc/typecheck
- storybook

Finally I want to describe the architecture of our plugin and how we want to work on adding these targets to a project.

We're going to be making a plugin that looks at all our package.json files and makes them "project nodes" and looks at what "tool chains" are being used in that project and set up the appropriate target. e.g. there's a `playwright.config.ts` so obviously we want to be able to run playwright in that project.

Our main focus is going to be adding playwright support to our projects that also use `playwright-bdd` which isn't supported by the first party `@nx/playwright/plugin` plugin.

Now that we have some pretext setup, let's jump back to the code

## Wire up our plugin

To start we need to tell Nx that we have a local plugin we want to run.
Jump into the `nx.json#plugins` array and add the following

```jsonc
{
  // other nx.json properties
  "plugins": [
    // any other plugins you already have configured
    {
      // this is the path to the project root you setup your project in
      "plugin": "./libs/tools/nx-plugin"
    }
  ]
}
```

Next we need to go to our `index.ts` file in the plugin and export a `createNodesV2` function.
This function is responsible for returning a object that defines project nodes and their project configuration.
For now we just need to make a simple export that will match the signature is working correctly

> Unless otherwise denoted imports are coming from `@nx/devkit` or node builtins like `node:fs` or `node:path` let your editor help you!

```ts
// libs/tools/nx-plugin/src/index.ts
export const createNodesV2: CreateNodesV2<any> = [
  '**/package.json',
  async (configFiles, options, context) => {
    console.log('hello from my plugin');
    return [];
  },
];
```

now go to your plugins `package.json` and make sure it's `main` exports the `index.ts` file we just added

```jsonc
// libs/tools/nx-plugin/package.json

{
  "type": "commonjs",
  "main": "./src/index.ts" // This line
}
```

### Does it work?

Now let's make sure everything works and is wired up correctly

run `nx reset` to clear any graph caches and stop the daemon

next run `NX_DAEMON=false nx show projects --web=false`

You should see the log message `hello from my plugin`
If you have errors about unable to run the plugin make sure to check the `package.json` has the right export. it should match what is in the `build` targets "main" configuration relative from the project root. Nx uses this build configuration to know how to run our plugin so do not delete it.

## What does my plugin do?

Nothing! (yet)

the goal is to stub things out and now lets take time to dissect what code we have.

```ts
// libs/tools/nx-plugin/src/index.ts

// top level property that Nx looks for, this name is a special value and cannot be something else
export const createNodesV2: CreateNodesV2<any> = [
  // pattern we're telling Nx to find and invoke our callback with
  // we can put anything here to match against
  // but since we want all project nodes
  // package.json makes sense for us
  '**/package.json',
  // our callback function Nx will call with a list of matched files
  //  along with any `options` we set in the nx.json plugin configuration
  // right now we don't have anything so this will be undefined
  // and we get the `context` which contains various metadata we can use
  async (configFiles, options, context) => {
    // TODO: impl our plugin!
    console.log('hello from my plugin');
    // TODO: retun the list of project and their configuration
    return [];
  },
];
```

### One at a time please

Dealing with every matched configuration file can be a lot at once, and Nx provides a util to process a single file at a time and return it's config. makes the mental context _much_ easier to grok and would recommend it. this is called `createNodesFromFiles` and we can directly return it.

```ts
// libs/tools/nx-plugin/src/index.ts
export const createNodesV2: CreateNodesV2<any> = [
  '**/package.json',
  async (configFiles, options, context) => {
    return await createNodesFromFiles(
      // TODO: impl file processor,
      async () => ({}),
      // pass in the params we already have
      configFiles,
      options,
      context
    );
  },
];
```

now we just need to think about handing 1 matched file at a time and deciding what to do with it. if we don't care about the node we just return an empty object: `{}` and nothing will happen to that node. other wise we return a "projects record" e.g.

```ts
return {
  projects: {
    [pathToProjectRoot]: projectNodeDefinition,
  },
};
```

### constructing the project config

let's start simple and figure out the `pathToProjectRoot` aka `projectRoot` for the matched files

```ts
// libs/tools/nx-plugin/src/index.ts
export const createNodesV2: CreateNodesV2<any> = [
  '**/package.json',
  async (configFiles, options, context) => {
    return await createNodesFromFiles(
      // callback gets the single path and the same options, context params
      async (configFile, options, context) => {
        const projectRoot = dirname(configFile);
        console.log('found project at', projectRoot);

        return {
          projects: {
            [projectRoot]: { root: projectRoot },
          },
        };
      },
      // pass in the params we already have
      configFiles,
      options,
      context
    );
  },
];
```

Boom that easy. now you've define nodes for Nx.
If you run the `NX_DAEMON=false nx show projects --web=false` you'll now see the log for each of our files and the project root the belong to

### trivial targets for learning

From here on out it's "as simple" as adding the targets you want to the project node and they'll show up on the project. If you're familar with the `project.json` configuration then you'll feel right at home. it's the same structure. for easier typing you can define this as `ProjectConfiguration`

Let's start trivial and work our way up from there.

```ts
// libs/tools/nx-plugin/src/index.ts
export const createNodesV2: CreateNodesV2<any> = [
  '**/package.json',
  async (configFiles, options, context) => {
    return await createNodesFromFiles(
      async (configFile, options, context) => {
        const projectRoot = dirname(configFile);
        console.log('found project at', projectRoot);

        const node: ProjectConfiguration = {
          root: projectRoot,
          targets: {
            hello: { command: `echo "${projectRoot}"` },
          },
        };

        return {
          projects: {
            [projectRoot]: node,
          },
        };
      },
      // pass in the params we already have
      configFiles,
      options,
      context
    );
  },
];
```

Now there is a `hello` target on every project because we're not filtering out any projects and just always applying

try running `NX_DAEMON=false nx show projects --with-target=hello --web=false`

You should see all your projects listed

### More serious targets

What we have now is nice but doesn't do much for us. We want to add playwright bdd to our projects. To do this let's make a new file called `add-playwright-targets.ts` and in it put a function called `addPlaywrightToNodes(configFilePath: string, options: any, context: CreateNodesContextV2, currentNode: ProjectConfiguration)`

```ts
// libs/tools/nx-plugin/src/add-playwright-targets.ts
export async function addPlaywrightToNode(
  configFilePath: string,
  options: BddPlaywrightOptions | undefined,
  context: CreateNodesContextV2,
  currentNode: ProjectConfiguration
) {
  console.log(
    'debug params to addPlaywrightToNode',
    configFilePath,
    options,
    context,
    currentNode
  );

  return;
}
```

In our example we're planning on mutating the passed in `currentNode`. If you're hardcore into immutable life, then feel free to adjust as needed this is for simplicity and readability in our `createNodesV2` function

First thing we want to do is make sure we only work on project nodes where there is a playwright configuration

```ts
// libs/tools/nx-plugin/src/add-playwright-targets.ts
export async function addPlaywrightToNode(
  configFilePath: string,
  options: BddPlaywrightOptions | undefined,
  context: CreateNodesContextV2,
  currentNode: ProjectConfiguration
) {

  console.log('debug params to addPlaywrightToNode', configFilePath, options, context, currentNode);

  const siblingFiles = readdirSync(join(context.workspaceRoot, currentNode.root))

  // do nothing if we don't have a playwright configuration
  if(!siblingFiles.includes('playwright.config.ts')) {
	  return;
  }

  currentNodes.targets ?? = {}
  currentNodes.targets.e2e ??= {
    command: "playwright test",
    options: {
      cwd: projectRoot
    },
    cache: true,
    // assumes we have a 'default' and 'production' named input
    // you can dynmaically resolve these from the `context` but easier
    // to just set them with what you have in your nx.json
    inputs: [
	    "default",
	    "^production",
	    // tell Nx we care about the playwright version in our inputs
	    // we can also put playwright-bdd in here
	    // along with any other deps you think are important in your tests to invalid if they change
	    { externalDependencies: ["@playwright/test"]},
    ],
    // note we'll configure this to read from the playwright configuration directly later on
    outputs: "{projectRoot}/test-output"

  }
}
```

### Read playwright configuration

Since we're in TS land we can get really fancy and start reading the configuration files of the tools we care about and make sure our target definition matches what is configured playwright. now people only need to think about configuring playwright and not how to do this in "nx"

Nx projects a handy util for projects that use TS/JS files as configs like playwright

```ts
// libs/tools/nx-plugin/add-playwright-targets.ts
function buildPlaywrightTargets(
  configFilePath: string,
  projectRoot: string,
  options: any,
  context: CreateNodesContextV2
) {
  // Playwright forbids importing the `@playwright/test` module twice. This would affect running the tests,
  // but we're just reading the config so let's delete the variable they are using to detect this.
  // See: https://github.com/microsoft/playwright/pull/11218/files
  delete (process as any)['__pw_initiator__'];
  const playwrightConfig = await loadConfigFile<PlaywrightTestConfig>(
    join(context.workspaceRoot, configFilePath)
  );
  // now we can read the playwright options and build out our targets
  const testOutput = playwrightConfig?.outputDir ?? './test-results';

  const targets: ProjectConfiguration['targets'] = {};
  const pmc = getPackageManagerCommand();

  targets['e2e'] = {
    command: 'playwright test',
    options: {
      cwd: projectRoot,
    },
    inputs: [
      'default',
      '^production',
      // tell Nx we care about the playwright version in our inputs
      // we can also put playwright-bdd in here
      // along with any other deps you think are important in your tests to invalid if they change
      { externalDependencies: ['@playwright/test'] },
    ],
    // now this is based on the playwright config we've read
    outputs: `{projectRoot}/${testOutput}`,
    parallelism: false,
    cache: true,
    // extra metadata to show in the project view via nx show and in Nx Cloud
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

  return { targets };
}
```

### To BDD and beyond

Now it's time to get _fancy_ and start wiring up dependencies between tasks for bdd.

First we need to think how things work

1. we run `bddgen` command to generate our playwright specs
2. playwright runs against those generate tests

this means that `e2e` target `dependsOn` a `bdd-gen` target before it can run.

> Note we can globally define this behavior as well in the `nx.json` which TBH makes more sense for these targets but will do it in the plugin for now just to show a use case

```ts
// libs/tools/nx-plugin/add-playwright-targets.ts
function buildPlaywrightTargets(
  configFilePath: string,
  projectRoot: string,
  options: any,
  context: CreateNodesContextV2
) {
  // Playwright forbids importing the `@playwright/test` module twice. This would affect running the tests,
  // but we're just reading the config so let's delete the variable they are using to detect this.
  // See: https://github.com/microsoft/playwright/pull/11218/files
  delete (process as any)['__pw_initiator__'];
  const playwrightConfig = await loadConfigFile<PlaywrightTestConfig>(
    join(context.workspaceRoot, configFilePath)
  );
  const testOutput = playwrightConfig?.outputDir ?? './test-results';

  const targets: ProjectConfiguration['targets'] = {};
  const pmc = getPackageManagerCommand();

  targets['e2e'] = {
    command: 'playwright test',
    options: {
      cwd: projectRoot,
    },
    // e2e depends on it's own projects `bdd-gen` target now!
    dependsOn: ['bdd-gen'],
    inputs: [
      'default',
      '^production',
      // we now add the 'playwright-bdd' dep since we care about that now
      { externalDependencies: ['@playwright/test', 'playwright-bdd'] },
    ],
    // removed other stuff for brevity
  };

  targets['bdd-gen'] = {
    command: 'bddgen',
    options: {
      cwd: projectRoot,
    },
  };

  return { targets };
}
```

#### Wire it up!

now in `add-playwright-targets.ts` we should have something akin to

```ts
// libs/tools/nx-plugin/src/add-playwright-targets.ts
export async function addPlaywrightToNode(
  configFilePath: string,
  options: any,
  context: CreateNodesContextV2,
  currentNode: ProjectConfiguration
) {
  console.log(
    'debug params to addPlaywrightToNode',
    configFilePath,
    options,
    context,
    currentNode
  );

  const siblingFiles = readdirSync(
    join(context.workspaceRoot, currentNode.root)
  );

  // do nothing if we don't have a playwright configuration
  if (!siblingFiles.includes('playwright.config.ts')) {
    return;
  }
  const { targets } = buildPlaywrightTargets(
    configFilePath,
    projectRoot,
    options,
    context
  );

  // mutate the project node that is returned by `createNodesV2`
  currentNode.targets = Object.assign(currentNode.targets ?? {}, targets);
}

function buildPlaywrightTargets(
  configFilePath: string,
  projectRoot: string,
  options: any,
  context: CreateNodesContextV2
) {
  // Playwright forbids importing the `@playwright/test` module twice. This would affect running the tests,
  // but we're just reading the config so let's delete the variable they are using to detect this.
  // See: https://github.com/microsoft/playwright/pull/11218/files
  delete (process as any)['__pw_initiator__'];
  const playwrightConfig = await loadConfigFile<PlaywrightTestConfig>(
    join(context.workspaceRoot, configFilePath)
  );
  const testOutput = playwrightConfig?.outputDir ?? './test-results';

  const targets: ProjectConfiguration['targets'] = {};
  const pmc = getPackageManagerCommand();

  targets['e2e'] = {
    command: 'playwright test',
    options: {
      cwd: projectRoot,
    },
    dependsOn: ['bdd-gen'],
    inputs: [
      'default',
      '^production',
      { externalDependencies: ['@playwright/test', 'playwright-bdd'] },
    ],
  };

  targets['bdd-gen'] = {
    command: 'bddgen',
    options: {
      cwd: projectRoot,
    },
  };

  return { targets };
}
```

and in our plugin `createNodesV2` function

```ts
// libs/tools/nx-plugin/src/index.ts
import { addPlaywrightTargetsToNode } from './add-playwright-targets';
export const createNodesV2: CreateNodesV2<any> = [
  '**/package.json',
  async (configFiles, options, context) => {
    return await createNodesFromFiles(
      async (configFile, options, context) => {
        const projectRoot = dirname(configFile);
        console.log('found project at', projectRoot);

        const node: ProjectConfiguration = {
          root: projectRoot,
          targets: {},
        };

        // this function adds the targets to the `node` which we then return to nx which populates tagets on our projects
        await addPlaywrightTargetsToNode(configFile, options, context, node);

        return {
          projects: {
            [projectRoot]: node,
          },
        };
      },
      // pass in the params we already have
      configFiles,
      options,
      context
    );
  },
];
```

You should be able to run `NX_DAEMON=false nx show projects --with-target bdd-gen --web=false` and see projects which have a playwright configuration defined.

## Atomizer

I'll explain the mental model of atomizer and then drop in the code to do this with some comments which should explain what's going on but won't go over each step

Atomizer works by leveraging the the `dependsOn` mechanism of Nx task graph.
Like we similar setup `e2e` to depend on `bdd-gen` what if we made a target for each spec file inside our playwright project and then made a 'parent' task that depends on all of these single file target definitions so they all run when we run this parent task.

e.g.

we have 3 test files in our `e2e` folder something like

```
- e2e/
	- test-one.spec.ts
	- test-two.spec.ts
	- test-three.spec.ts

- playwright.config.ts
```

So we could make a target definition like so

```jsonc
{
  "targets": {
    "e2e-ci--test-one.spec.ts": {
      "command": "playwright test ./e2e/test-one.spec.ts",
      "options": {
        "cwd": "{projectRoot}"
      }
    },
    "e2e-ci--test-two.spec.ts": {
      "command": "playwright test ./e2e/test-two.spec.ts",
      "options": {
        "cwd": "{projectRoot}"
      }
    },
    "e2e-ci--test-three.spec.ts": {
      "command": "playwright test ./e2e/test-three.spec.ts",
      "options": {
        "cwd": "{projectRoot}"
      }
    },
    "e2e-ci": {
      // nx has this 'noop' executor that just doesn't do anything
      // we can use to make our "parent" target
      "executor": "nx:noop",
      "dependsOn": [
        "e2e-ci--test-one.spec.ts",
        "e2e-ci--test-two.spec.ts",
        "e2e-ci--test-three.spec.ts"
      ]
    }
  }
}
```

So now we've created this graph where running `nx e2e-ci <e2e-project>` will run the 3 dependent tasks first which paired with DTE/Nx Agents for faster and more efficient distribution.

Okay now let's impl this in code w/ bdd-gen

basically we're doing the same thing as above but in code and leverging some dynamic parts like making sure we capture any playwright reports and test outputs

```ts
// libs/tools/nx-plugin/src/add-playwright-targets.ts

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

const pmc = getPackageManagerCommand();

export async function addPlaywrightToNode(
  configFilePath: string,
  options: BddPlaywrightOptions | undefined,
  context: CreateNodesContextV2,
  currentNode: ProjectConfiguration
) {
  console.log('debug>>>', configFilePath, options, context, currentNode);
  const siblingFiles = readdirSync(
    join(context.workspaceRoot, currentNode.root)
  );

  //  Do not create a project if playwright config isn't present
  if (!siblingFiles.includes('playwright.config.ts')) {
    return;
  }
  // apply defaults to our options incase any were not passed in
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

  const targets: ProjectConfiguration['targets'] = {};
  let metadata: ProjectConfiguration['metadata'];

  const testOutput = playwrightConfig?.outputDir ?? './test-results';
  // parse report configs in playwright
  const reporterOutputs = getReporterOutputs(playwrightConfig);
  // check for any web server tasks that are nx commands
  const webserverCommandTasks = getWebserverCommandTasks(playwrightConfig);

  // target config used by both e2e and e2e-ci based targets
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

  // if we have a web server tasks make sure to setup it's dependsOn
  // otherwise we don't need to worry about running things in parallel
  if (webserverCommandTasks.length) {
    baseTargetConfig.dependsOn = getDependsOn(webserverCommandTasks);
  } else {
    baseTargetConfig.parallelism = false;
  }

  targets[options.targetName] = {
    ...baseTargetConfig,
    cache: true,
    inputs: [
      'default',
      '^production',
      { externalDependencies: ['@playwright/test', 'playwright-bdd'] },
    ],
    // grab outputs for the defined test/reporter outputs
    outputs: getTargetOutputs(
      testOutput,
      reporterOutputs,
      context.workspaceRoot,
      projectRoot
    ),
  };

  // defining a `ciTargetName` opts into atomizer so we need to setup those targets
  if (options.ciTargetName) {
    const ciBaseTargetConfig = {
      ...targets[options.targetName],
      metadata: {
        ...baseTargetConfig.metadata,
        description: 'Runs Playwright Tests in CI',
      },
    };

    // target group names is how Nx Cloud creates the grouping in the UI so atomized targets are under the same collapsable UI
    const groupName: string = 'E2E (CI)';
    metadata = { targetGroups: { [groupName]: [] } };

    const ciTargetGroup = metadata.targetGroups![groupName];

    // BDD has a dir where those features are created
    const featureDir = options.featureDir
      ? joinPathFragments(projectRoot, options.featureDir)
      : projectRoot;

    // bdd-playwright makes testDir an absolute path so correctly resolve the path
    const testDir = playwrightConfig.testDir
      ? joinPathFragments(
          projectRoot,
          relative(context.workspaceRoot, playwrightConfig.testDir)
        )
      : projectRoot;

    const dependsOn: TargetConfiguration['dependsOn'] = [];

    // for each feature file in the playwright project
    await forEachTestFile(
      (featureFile) => {
        // define the outputs
        const outputSubfolder = relative(projectRoot, featureFile)
          .replace(/[/\\]/g, '-')
          .replace(/\./g, '-');

        // resolve paths for the feature and generated spec file
        const relativeFeatureFilePath = normalizePath(
          relative(projectRoot, featureFile)
        );

        const relativeSpecFilePath = normalizePath(
          joinPathFragments(
            relative(projectRoot, testDir),
            `${relativeFeatureFilePath}.spec.js`
          )
        );

        // construct the atomized target name e.g. e2e-ci--<spec-file-name>
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

        // setup dependsOn array for the parent task to use
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
    // setup parent target that depends on all the atomized tasks
    targets[options.ciTargetName] = {
      executor: 'nx:noop',
      dependsOn,
      cache: ciBaseTargetConfig.cache,
      inputs: ciBaseTargetConfig.inputs,
      outputs: ciBaseTargetConfig.outputs,
      metadata: {
        technologies: ['playwright'],
        description: 'Runs Playwright Tests in CI',
        // setting this option is what makes Nx show the `atomized` badge in the project details view via nx show project <project name>
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
    // setup BDD gen target for the project
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

// helper util fo process each feature file at a time
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

// matcher util
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

// provide defaults for our plugin
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

// resolve playwright reporter outputs
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

// resolve target outputs for test and reporter options configured
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

// each atomized targets output is defined in it's own sub folder
// this prevents tests from overwriting each others reports/test ouputs
function addSubfolderToOutput(output: string, subfolder?: string): string {
  if (!subfolder) return output;
  const parts = parse(output);
  if (parts.ext !== '') {
    return join(parts.dir, subfolder, parts.base);
  }
  return join(output, subfolder);
}

// parser for playwright web server commands
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

// parser utils
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

// dependsOn utils
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

// normalize paths for outputs
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

// check env vars that nx needs to be aware of for reporters
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
```

I would also recommend setting up these `targetDefaults` in the `nx.json`

```jsonc
{
  "targetDefaults": {
    "bdd-gen": {
      "cache": true
    },
    "e2e": {
      "dependsOn": ["bdd-gen"],
      "cache": true
    },
    "e2e-ci--**/*": {
      "dependsOn": ["^build", "bdd-gen"]
    }
  }
}
```

## Next steps

You did it. you made it to the end 🎉

it's a lot to absorb and lot of those utils are around due to the 'generic' nature of building the plugin. in reality most things can be defaulted due to workspace convention. i.e. things like workspace configuration

### Nx Conformance

With nx Conformance we can write rules that define how things should be written and fail CI if people are changing things they shouldn't

read more about nx conformance: https://nx.dev/blog/nx-cloud-conformance-automate-consistency

## Bonus vitest configuration

Here is the vitest configuration as mentioned for setting up the plugin

```ts
// libs/tools/nx-plugin/vitest.config.ts
/// <reference types='vitest' />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/tools/nx-plugin',
      provider: 'v8',
    },
  },
});
```

You'll also need a `tsconfig.spec.json` for your editor to know what's going on

```jsonc
// libs/tools/nx-plugin/tsconfig.spec.json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./out-tsc/vitest",
    "types": [
      "vitest/globals",
      "vitest/importMeta",
      "vite/client",
      "node",
      "vitest"
    ],
    "module": "esnext",
    "moduleResolution": "bundler"
  },
  "include": [
    "vitest.config.ts",
    "src/**/*.test.ts",
    "src/**/*.spec.ts",
    "src/**/*.test.js",
    "src/**/*.spec.js",
    "src/**/*.d.ts"
  ],
  "references": [
    {
      "path": "./tsconfig.lib.json"
    }
  ]
}
```

update the `tsconfig.lib.json` as well if need be

```jsonc
// libs/tools/nx-plugin/tsconfig.lib.json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "out-tsc/nx-plugin",
    "types": ["node", "vite/client"],
    "rootDir": "src",
    "module": "esnext",
    "moduleResolution": "bundler"
  },
  "exclude": [
    "dist",
    "**/*.spec.ts",
    "**/*.test.ts",
    "**/*.spec.tsx",
    "**/*.test.tsx",
    "**/*.spec.js",
    "**/*.test.js",
    "**/*.spec.jsx",
    "**/*.test.jsx",
    "vite.config.ts",
    "vite.config.mts",
    "vitest.config.ts",
    "vitest.config.mts",
    "eslint.config.js",
    "eslint.config.cjs",
    "eslint.config.mjs"
  ],
  "include": ["src/**/*.js", "src/**/*.ts"]
}
```

then make sure to reference the `tsconfig.spec.json` in your `tsconfig.json`

```jsonc
// libs/tools/nx-plugin/tsconfig.json
{
  "extends": "../../../tsconfig.base.json",
  "files": [],
  "include": [],
  "references": [
    {
      "path": "./tsconfig.lib.json"
    },
    {
      "path": "./tsconfig.spec.json"
    }
  ]
}
```
