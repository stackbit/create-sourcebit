#!/usr/bin/env node
const chalk = require("chalk");
const fs = require("fs");
const path = require("path");
const util = require("util");
const Wizard = require("./lib/wizard");

(async () => {
  const wizard = new Wizard();
  const { plugins, envFileOptions } = await wizard.start();
  const moduleExports = util.inspect(
    {
      plugins
    },
    { compact: false, depth: null }
  );
  const config = `module.exports = ${moduleExports}\n`;

  // Writing configuration file.
  try {
    const configPath = path.join(process.cwd(), "sourcebit.js");

    fs.writeFileSync(configPath, config);

    console.log(`\nConfiguration saved to ${chalk.bold(configPath)}.`);
  } catch (error) {
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

      console.log(`\Environment file saved to ${chalk.bold(envFilePath)}.`);
    }
  } catch (error) {
    console.log(error);
    console.log("ERROR: Could not create environment file.");

    process.exit(1);
  }
})();
