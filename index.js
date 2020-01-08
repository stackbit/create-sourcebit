const chalk = require("chalk");
const fs = require("fs");
const path = require("path");
const util = require("util");
const Wizard = require("./lib/wizard");

(async () => {
  const wizard = new Wizard();
  const plugins = await wizard.start();
  const configPath = path.join(process.cwd(), "sourcebit.js");
  const moduleExports = util.inspect(
    {
      plugins
    },
    { compact: false, depth: null }
  );
  const config = `module.exports = ${moduleExports}\n`;

  try {
    fs.writeFileSync(configPath, config);

    console.log(`\nConfiguration saved to ${chalk.bold(configPath)}.`);
  } catch (error) {
    console.log("ERROR: Could not create configuration file.");

    process.exit(1);
  }
})();
