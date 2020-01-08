const axios = require("axios");
const chalk = require("chalk");
const { exec } = require("child_process");
const inquirer = require("inquirer");
const ora = require("ora");
const path = require("path");

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
    const modules = ["sourcebit"].concat(pluginNames).join(" ");

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
      // around that, we `require` the plugin by its path.
      const plugin = require(path.join(
        process.cwd(),
        "node_modules",
        pluginName
      ));

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
                name: "sourcebit-source-mock",
                version: "0.1.0",
                description: "A mock source plugin for Sourcebit"
              }
            },
            {
              package: {
                name: "sourcebit-source-contentful",
                version: "0.1.0",
                description: "A Contentful source plugin for Sourcebit"
              }
            }
          ]);
        }, 2000);
      });
    }

    return axios(`https://registry.npmjs.org/-/v1/search?text=${text}`).then(
      ({ data }) => data.objects
    );
  }

  async start() {
    console.log(this.getHeader());

    let activeSpinner = ora("Looking for source plugins\n").start();

    try {
      const packages = await this.searchPackages("sourcebit-source");

      activeSpinner.succeed("Let's start by connecting your data sources.\n");

      const questions = [
        {
          type: "checkbox",
          name: "plugins",
          message: "Select one or more plugins to add and configure",
          choices: packages.map(({ package: pkg }) => ({
            name: `${pkg.name} (${pkg.version}) – ${pkg.description}`,
            value: pkg.name
          }))
        }
      ];

      const answers = await inquirer.prompt(questions);

      activeSpinner = ora("Installing source plugins\n").start();

      await this.initializePackage();
      await this.installPlugins(answers.plugins);

      activeSpinner.succeed();

      const pluginModules = this.loadPlugins(answers.plugins);

      let config = Promise.resolve([]);

      answers.plugins.forEach((pluginName, pluginIndex, plugins) => {
        config = config.then(async config => {
          console.log(
            `\nConfiguring plugin ${pluginIndex + 1} of ${
              plugins.length
            }: ${chalk.bold(pluginName)}\n`
          );

          const pluginModule = pluginModules[pluginName];
          const pluginQuestions = pluginModule.getSetup();
          const answers = await inquirer.prompt(pluginQuestions);
          const pluginOptions = pluginModule.getOptionsFromSetup(answers);

          return config.concat({
            name: pluginName,
            options: pluginOptions
          });
        });
      });

      return config;
    } catch (error) {
      activeSpinner.fail("An error occured. More details below\n");
      console.log(error);
    }
  }
}

module.exports = Wizard;
