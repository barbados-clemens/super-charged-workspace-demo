# Workspace overview

This workspace uses pnpm workspaces with react, vitest, and expo via Nx. Leveraging Nx features where possible such as `nx sync` for project references, local plugins w/ inferred tasks, Nx Conformance, and module boundaries.


[Read the plugin overview and dev guide here](./PLUGIN.md)


## Expo + Project Refs + Workspaces

Expo naturally works with the Nx project reference setup and using workspace dependencies

You can see an example in the demo-one project. where the package.json uses the `design-system` package from the workspace via `workspace:*` without issues in the `App.tsx`

Using `nx sync` helps keeps the `tsconfig.json` up to date with the usage of pnpm workspaces and can be automated to run before running a task. in CI, it's configured to error out so devs can commit and push the changes.

Using workspaces requires you to configure the correct exports for the imported project, if the project is "buildable" this will requires referencing the `dist` files of the project. This requires building the packages in order for the consuming project which 99% of the time isn't required to make the project buildable. Instead using the direct TS files in the exports of the package makes this easier for everyone in the repo.


## Conformance
> Note a powerpack license is needed to run

We can use conformance to enforce project structure and configurations (along with whatever else needed)
There is a sample rule setup here: [`libs/tools/nx-plugin/src/conformance/`](./libs/tools/nx-plugin/src/conformance/)

Make a new rule with `nx g create-rule`
Some more examples of rules can be to enforce project-references are being respected and tsconfigs are not malformed

Run conformance checks w/ `nx conformance`

## Module Boundaries

Another tool to help keep consistency in the workspace is module boundaries. by default we configure the rule to create scopes based on project parent folders (i.e. web/mobile) and setup rules where web/mobile cannot import from each other. 
This can be expanded to manually add tags in the package.json/project.json files. or to have more logic in the local plugin to detect these rules.
Typically using 2 dimensions of boundaries is a good pattern to fit all rules/needs. e.g. `scope` and `type`.
Read more here: https://nx.dev/recipes/enforce-module-boundaries/tag-multiple-dimensions

