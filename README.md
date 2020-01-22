# create-sourcebit

[![npm version](https://badge.fury.io/js/create-sourcebit.svg)](https://badge.fury.io/js/create-sourcebit)

> An interactive setup process for [Sourcebit](https://github.com/stackbithq/sourcebit)

## Introduction

[Sourcebit](https://github.com/stackbithq/sourcebit) uses a [confifuration file](https://github.com/stackbithq/sourcebit#configuration) of `sourcebit.js` to define and configure all of its plugins. While this file can be created manually, this command-line interface provides an interactive setup that gathers enough information about the user's environment and content architecture to create a working configuration.

Every Sourcebit plugin must define the questions that should be asked and process the answers. This takes place via the `getSetup` and `getOptionsFromSetup` methods.

## Using local plugins

Normally, the interactive setup process will fetch available plugins from the [npm registry](https://npmjs.com) by looking for packages whose name begin with `sourcebit-source`, `sourcebit-target` or `sourcebit-plugin`. If you are developing a plugin and you'd like for it to appear on the setup process without having to publish it to npm, you can provide a mock response for the npm API.

For this, you first need to create a JSON file and add some mock npm modules to it, following the structure below:

_my-project/npm-override.json_

```json
[
  {
    "package": {
      "name": "/Users/johndoe/sourcebit-source-contentful",
      "version": "0.1.0",
      "description": "A Contentful source plugin for Sourcebit"
    }
  },
  {
    "package": {
      "name": "/Users/johndoe/sourcebit-target-jekyll",
      "version": "0.1.0",
      "description": "A Sourcebit plugin for Jekyll"
    }
  }
]
```

Note that `name` needs to contain an absolute path to the plugin directory.

After creating this file, you can run the setup process with the `--registry-override` parameter like so:

```
$ npx create-sourcebit --registry-override=./npm-override.json
```
