# create-sourcebit

[![npm version](https://badge.fury.io/js/create-sourcebit.svg)](https://badge.fury.io/js/create-sourcebit)

> An interactive setup process for [Sourcebit](https://github.com/stackbithq/sourcebit)

## Introduction

Sourcebit uses a [`sourcebit.js` file](https://github.com/stackbithq/sourcebit#configuration) to define and configure all its plugins. While this file can be created manually, this command-line interface provides an interactive setup which, through a series of questions, gathers enough information about the user's environment and content architecture to create a working configuration.

It's the responsibility of each plugin to define the questions and process the answers, which takes place via the `getSetup` and `getOptionsFromSetup` methods.

## Plugin registry

The list of plugins offered by the interactive setup process is pulled from the `plugins.json` file in the root of the repository. It's an array of objects with the following properties:

- `module` (String): The name of the plugin's npm module
  - _Example_: `sourcebit-source-contentful`
- `description` (String): A human-friendly description of the plugin
  - _Example_: `A Contentful source plugin for Sourcebit`
- `author` (String): The name/handle of the plugin's author
  - _Example_: `John Doe <john.doe@example.com>`
- `type` (enum: `source|target`): The type of plugin
  - _Example_: `source`

_plugins.json_

```json
[
  {
    "module": "/Users/eduardoboucas/Sites/sourcebit-source-contentful",
    "description": "A Contentful source plugin for Sourcebit",
    "author": "Stackbit",
    "type": "source"
  },
  {
    "module": "/Users/eduardoboucas/Sites/sourcebit-target-jekyll",
    "description": "A Sourcebit plugin for Jekyll",
    "author": "Stackbit",
    "type": "target"
  }
]
```

If you are developing a plugin and you'd like for it to appear on the setup process without having to publish it to npm, you can add it to this array and set the value of `module` to an absolute path on your filesystem.
