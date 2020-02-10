const chalk = require("chalk");
const debug = require("debug");
const { exec } = require("child_process");
const inquirer = require("inquirer");
const ora = require("ora");
const path = require("path");
const pkg = require("../package.json");
const pluginRegistry = require("../plugins.json");
const { Sourcebit } = require("sourcebit");
const WrappedFunction = require("./wrapped-function");

class Wizard {
  constructor(parameters) {
    this.parameters = parameters;
    this.getSetupContext = this.getSetupContext.bind(this);
    this.setSetupContext = this.setSetupContext.bind(this);
    this.setupContext = {};
  }

  getHeader() {
    return `
  _____  ____  _    _ _____   _____ ______ ____ _____ _______ 
 / ____|/ __ \\| |  | |  __ \\ / ____|  ____|  _ \\_   _|__   __|
| (___ | |  | | |  | | |__) | |    | |__  | |_) || |    | |   
 \\___ \\| |  | | |  | |  _  /| |    |  __| |  _ < | |    | |   
 ____) | |__| | |__| | | \\ \\| |____| |____| |_) || |_   | |   
|_____/ \\____/ \\____/|_|  \\_\\\\_____|______|____/_____|  |_|
${chalk.dim(`v${pkg.version}`)}
    `;
  }

  getSetupContext() {
    return this.setupContext;
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

      plugins[pluginName] = plugin;
    });

    return plugins;
  }

  setSetupContext(newContext) {
    this.setupContext = { ...this.setupContext, ...newContext };
  }

  async start({ currentConfig }) {
    console.log(this.getHeader());

    let activeSpinner = ora("Looking for plugins\n").start();

    try {
      const pluginsByType = pluginRegistry.reduce((result, item) => {
        result[item.type] = result[item.type] || [];
        result[item.type].push({
          name: `${item.module} (by ${item.author}): ${item.description}`,
          value: item.module
        });

        return result;
      }, {});

      activeSpinner.succeed(
        "Welcome to Sourcebit! We'll now guide you through the process of selecting and configuring a set of plugins, which will allow you to fetch data from different sources and transform it into any format you need.\n"
      );

      const questions = [
        {
          type: "checkbox",
          name: "stage1Plugins",
          message: `Select the source plugins. ${chalk.reset.dim(
            "They define the sources of your data."
          )}`,
          choices: pluginsByType.source,
          validate: value =>
            value.length > 0
              ? true
              : "You must select at least one source plugin."
        },
        {
          type: "checkbox",
          name: "stage2Plugins",
          message: `Select the transformation plugins. ${chalk.reset.dim(
            "They perform different transformation operations on the data coming from the source plugins."
          )}`,
          choices: pluginsByType.transform
        },
        {
          type: "checkbox",
          name: "stage3Plugins",
          message: `Select the target plugins. ${chalk.reset.dim(
            "They write data in a location and format expected by the software you're using."
          )}`,
          choices: pluginsByType.target
        }
      ];

      const { stage1Plugins } = await inquirer.prompt(questions[0]);
      console.log("");

      const { stage2Plugins } = await inquirer.prompt(questions[1]);
      console.log("");

      const { stage3Plugins } = await inquirer.prompt(questions[2]);
      const allPlugins = stage1Plugins
        .concat(stage2Plugins)
        .concat(stage3Plugins);

      console.log("");
      activeSpinner = ora("Installing plugins\n").start();

      await this.initializePackage();
      await this.installPlugins(allPlugins);

      activeSpinner.succeed();

      const pluginModules = this.loadPlugins(allPlugins);
      const pluginBlocks = allPlugins.map(pluginName => ({
        module: pluginModules[pluginName],
        options: {}
      }));
      const sourcebit = new Sourcebit({
        runtimeParameters: {
          quiet: true
        }
      });

      sourcebit.loadPlugins(pluginBlocks);

      let setupData = Promise.resolve({
        envFileOptions: {},
        errors: {},
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
          const pluginDebug = debug(`plugin:${pluginName}`);

          if (
            typeof getOptionsFromSetup !== "function" ||
            typeof getSetup !== "function"
          ) {
            return;
          }

          const currentPluginBlock = (currentConfig.plugins || []).find(
            plugin =>
              plugin.module &&
              plugin.module.name === pluginModules[pluginName].name
          );
          const currentOptions =
            (currentPluginBlock && currentPluginBlock.options) || {};

          try {
            const setup = getSetup({
              chalk,
              context,
              currentOptions,
              data,
              debug: pluginDebug,
              getSetupContext: this.getSetupContext,
              inquirer,
              ora,
              setSetupContext: this.setSetupContext
            });

            let setupAnswers = {};

            if (Array.isArray(setup)) {
              setupAnswers = await inquirer.prompt(setup);
            } else if (typeof setup === "function") {
              setupAnswers = await setup();
            }

            const pluginOptions =
              (await getOptionsFromSetup({
                answers: setupAnswers,
                debug: pluginDebug,
                getSetupContext: this.getSetupContext,
                setSetupContext: this.setSetupContext
              })) || {};

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
              ...setupData,
              envFileOptions: {
                ...setupData.envFileOptions,
                ...privateOptions
              },
              plugins: setupData.plugins.concat({
                module: new WrappedFunction(`require('${pluginName}')`),
                options: publicOptions
              })
            };
          } catch (error) {
            ora(
              `Plugin ${chalk.bold(
                pluginName
              )} could not be configured due to a fatal error.`
            ).fail();

            console.error(error);

            return {
              ...setupData,
              errors: {
                ...setupData.errors,
                [pluginName]: error
              }
            };
          }
        });
      });

      return setupData;
    } catch (error) {
      activeSpinner.fail("An error occured. More details below\n");
      console.log(error);
    }
  }
}

module.exports = Wizard;
