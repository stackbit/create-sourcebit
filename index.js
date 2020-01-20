#!/usr/bin/env node
const chalk = require("chalk");
const fs = require("fs");
const mri = require("mri");
const ora = require("ora");
const path = require("path");
const util = require("util");
const Wizard = require("./lib/wizard");

(async () => {
  const parameters = mri(process.argv.slice(2));
  const wizard = new Wizard(parameters);
  const { errors, plugins, envFileOptions } = await wizard.start();
  const moduleExports = util.inspect(
    {
      plugins
    },
    { compact: false, depth: null }
  );
  const config = `module.exports = ${moduleExports}\n`;

  console.log("");

  // Writing configuration file.
  try {
    const configPath = path.join(process.cwd(), "sourcebit.js");

    fs.writeFileSync(configPath, config);

    const errorCount = Object.keys(errors).length;

    if (errorCount > 0) {
      ora(
        `Configuration saved to ${chalk.bold(configPath)}, but ${chalk.bold(
          errorCount
        )} ${errorCount > 1 ? "errors" : "error"} occurred.\n`
      ).warn();
    } else {
      ora(`Configuration saved to ${chalk.bold(configPath)}.\n`).succeed();
    }
  } catch (error) {
    console.log(error);
    console.log("ERROR: Could not create configuration file.");

    process.exit(1);
  }

  // Writing env file.
  try {
    const envFileData = Object.keys(envFileOptions)
      .map(key => `${key}=${envFileOptions[key]}`)
      .join("\n");

    if (envFileData.length > 0) {
      const envFilePath = path.join(process.cwd(), ".env");

      fs.writeFileSync(envFilePath, envFileData + "\n");

      ora(`Environment file saved to ${chalk.bold(envFilePath)}.\n`).succeed();
    }
  } catch (error) {
    console.log(error);

    ora("Could not create environment file.\n").fail();

    process.exit(1);
  }
})();
