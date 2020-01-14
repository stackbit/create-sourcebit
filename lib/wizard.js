const axios = require("axios");
const chalk = require("chalk");
const { exec } = require("child_process");
const fs = require("fs");
const inquirer = require("inquirer");
const ora = require("ora");
const path = require("path");
const { Sourcebit } = require("../../sourcebit");
const WrappedFunction = require("./wrapped-function");

class Wizard {
  getHeader() {
    return `
  _____  ____  _    _ _____   _____ ______ ____ _____ _______ 
 / ____|/ __ \\| |  | |  __ \\ / ____|  ____|  _ \\_   _|__   __|
| (___ | |  | | |  | | |__) | |    | |__  | |_) || |    | |   
 \\___ \\| |  | | |  | |  _  /| |    |  __| |  _ < | |    | |   
 ____) | |__| | |__| | | \\ \\| |____| |____| |_) || |_   | |   
|_____/ \\____/ \\____/|_|  \\_\\\\_____|______|____/_____|  |_|   
    `;
  }

  initializePackage() {
    return new Promise((resolve, reject) => {
      exec(`npm init -y`, (error, stdout) => {
        if (error !== null) {
          reject(error);
        }

        resolve(stdout);
      });
    });
  }

  installPlugins(pluginNames) {
    const installablePluginNames = pluginNames.filter(pluginName => {
      return pluginName[0] !== path.sep && pluginName[0] !== ".";
    });
    const modules = ["sourcebit"].concat(installablePluginNames).join(" ");

    return new Promise((resolve, reject) => {
      exec(`npm install ${modules} --save`, (error, stdout) => {
        if (error !== null) {
          reject(error);
        }

        resolve(stdout);
      });
    });
  }

  loadPlugins(pluginNames) {
    const plugins = {};

    pluginNames.forEach(pluginName => {
      // Ideally we would `require(pluginName)`, but that fails. Presumably
      // because the module has just been installed in a child process, so
      // the main process isn't able to resolve its name just yet. To get
      // around that, we `require` the plugin by its path. The exception is
      // when the plugin name is an absolute path, which may happen in a
      // development environment. When that happens, we `require` directly.
      const requirePath =
        pluginName[0] === path.sep || pluginName[0] === "."
          ? pluginName
          : path.join(process.cwd(), "node_modules", pluginName);
      const plugin = require(requirePath);

      // The wizard is only interested in plugins that export both a
      // `getSetup` and `getOptionsFromSetup` methods.
      if (
        typeof plugin.getSetup === "function" &&
        typeof plugin.getOptionsFromSetup === "function"
      ) {
        plugins[pluginName] = plugin;
      }
    });

    return plugins;
  }

  searchPackages(text) {
    // (!) Temporary. Remove once plugins are published.
    if (text === "sourcebit-source") {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve([
            {
              package: {
                name: "../../sourcebit-source-contentful",
                version: "0.1.0",
                description: "A Contentful source plugin for Sourcebit"
              }
            }
          ]);
        }, 0);
      });
    } else if (text === "sourcebit-plugin") {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve([
            {
              package: {
                name: "../../sourcebit-plugin-content-mapper",
                version: "0.1.0",
                description: "A Sourcebit plugin for mapping models to pages"
              }
            }
          ]);
        }, 0);
      });
    } else if (text === "sourcebit-target") {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve([
            {
              package: {
                name: "../../sourcebit-target-jekyll",
                version: "0.1.0",
                description: "A Sourcebit plugin for Jekyll"
              }
            }
          ]);
        }, 0);
      });
    }

    return axios(`https://registry.npmjs.org/-/v1/search?text=${text}`).then(
      ({ data }) => data.objects
    );
  }

  async start() {
    console.log(this.getHeader());

    let activeSpinner = ora("Looking for plugins\n").start();

    try {
      const sourcePlugins = await this.searchPackages("sourcebit-source");
      const transformationPlugins = await this.searchPackages(
        "sourcebit-plugin"
      );

      activeSpinner.succeed(
        "Welcome to Sourcebit! We'll now guide you through the process of selecting and configuring a set of plugins, which will allow you to fetch data from different sources and transform it into any format you need.\n"
      );

      const questions = [
        {
          type: "checkbox",
          name: "sourcePlugins",
          message:
            "Let's start by selecting your source plugins, which define the sources of your data.",
          choices: sourcePlugins.map(({ package: pkg }) => ({
            name: `${pkg.name} (${pkg.version}) – ${pkg.description}`,
            value: pkg.name
          }))
        },
        {
          type: "checkbox",
          name: "transformationPlugins",
          message:
            "Select one or more transformation plugins, which massage and augment the data coming from the data sources.",
          choices: transformationPlugins.map(({ package: pkg }) => ({
            name: `${pkg.name} (${pkg.version}) – ${pkg.description}`,
            value: pkg.name
          }))
        }
      ];

      const answers = await inquirer.prompt(questions);
      const allPlugins = answers.sourcePlugins.concat(
        answers.transformationPlugins
      );

      activeSpinner = ora("Installing plugins\n").start();

      await this.initializePackage();
      await this.installPlugins(allPlugins);

      activeSpinner.succeed();

      const pluginModules = this.loadPlugins(allPlugins);
      const pluginBlocks = allPlugins.map(pluginName => ({
        module: pluginModules[pluginName],
        options: {}
      }));

      const sourcebit = new Sourcebit();

      sourcebit.loadPlugins(pluginBlocks);

      let setupData = Promise.resolve({
        envFileOptions: {},
        plugins: []
      });

      allPlugins.forEach((pluginName, pluginIndex, plugins) => {
        setupData = setupData.then(async setupData => {
          console.log(
            `\nConfiguring plugin ${pluginIndex + 1} of ${
              plugins.length
            }: ${chalk.bold(pluginName)}\n`
          );

          const data = await sourcebit.transform();
          const context = sourcebit.getContext();
          const {
            getOptionsFromSetup,
            getSetup,
            options: optionsSchema = {}
          } = pluginModules[pluginName];
          const setup = getSetup({
            chalk,
            context,
            data,
            inquirer,
            ora
          });

          let setupAnswers = {};

          if (Array.isArray(setup)) {
            setupAnswers = await inquirer.prompt(setup);
          } else if (typeof setup === "function") {
            setupAnswers = await setup();
          }

          const pluginOptions = (await getOptionsFromSetup(setupAnswers)) || {};

          this.wrapOptionFunctions(pluginOptions);

          sourcebit.setOptionsForPluginAtIndex(pluginIndex, pluginOptions);

          await sourcebit.bootstrapPluginAtIndex(pluginIndex);

          const publicOptions = {};
          const privateOptions = {};

          // Finding private/public options and environment variables.
          Object.keys(pluginOptions).forEach(key => {
            const schema = optionsSchema[key] || {};

            if (schema.env) {
              if (schema.private) {
                privateOptions[schema.env] = pluginOptions[key];
              }

              if (pluginOptions[key] === undefined || schema.private) {
                publicOptions[key] = new WrappedFunction(
                  `process.env['${schema.env}']`
                );
              } else {
                publicOptions[key] = new WrappedFunction(
                  `process.env['${schema.env}'] || ${JSON.stringify(
                    pluginOptions[key]
                  )}`
                );
              }
            } else {
              if (!schema.private) {
                publicOptions[key] = pluginOptions[key];
              }
            }
          });

          return {
            envFileOptions: {
              ...setupData.envFileOptions,
              ...privateOptions
            },
            plugins: setupData.plugins.concat({
              module: new WrappedFunction(`require('${pluginName}')`),
              name: pluginName,
              options: publicOptions
            })
          };
        });
      });

      return setupData;
    } catch (error) {
      activeSpinner.fail("An error occured. More details below\n");
      console.log(error);
    }
  }

  wrapOptionFunctions(options) {
    Object.keys(options).forEach(key => {
      if (typeof options[key] === "function") {
        options[key] = new WrappedFunction(options[key]);
      }
    });
  }
}

module.exports = Wizard;
