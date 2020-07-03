#!/usr/bin/env node
require('dotenv').config();
const chalk = require('chalk');
const fs = require('fs');
const mri = require('mri');
const ora = require('ora');
const path = require('path');
const prettier = require('prettier');
const util = require('util');
const Wizard = require('./lib/wizard');

(async () => {
    const configPath = path.join(process.cwd(), 'sourcebit.js');

    let currentConfig = {};

    try {
        currentConfig = require(configPath);
    } catch (_) {}

    const parameters = mri(process.argv.slice(2));
    const wizard = new Wizard(parameters);
    const { errors, plugins, envFileOptions } = await wizard.start({
        currentConfig
    });
    const moduleExports = util.inspect(
        {
            plugins
        },
        { compact: false, depth: null }
    );

    let config = `module.exports = ${moduleExports}\n`;

    try {
        config = prettier.format(config, { parser: 'babel', trailingComma: 'none' });
    } catch (error) {
        ora('Could not format configuration file.').warn();
    }

    console.log('');

    // Writing configuration file.
    try {
        fs.writeFileSync(configPath, config);

        const errorCount = Object.keys(errors).length;

        if (errorCount > 0) {
            ora(
                `Configuration saved to ${chalk.bold(configPath)}, but ${chalk.bold(errorCount)} ${
                    errorCount > 1 ? 'errors' : 'error'
                } occurred.\n`
            ).warn();
        } else {
            ora(`Configuration saved to ${chalk.bold(configPath)}.\n`).succeed();
        }
    } catch (error) {
        ora('ERROR: Could not create configuration file.').fail();
        console.log(error);

        process.exit(1);
    }

    // Writing env file.
    try {
        const envFileData = Object.keys(envFileOptions)
            .map((key) => `${key}=${envFileOptions[key]}`)
            .join('\n');

        if (envFileData.length > 0) {
            const envFilePath = path.join(process.cwd(), '.env');

            fs.writeFileSync(envFilePath, envFileData + '\n');

            ora(`Environment file saved to ${chalk.bold(envFilePath)}.`).succeed();
            ora(`Make sure not to commit this file to version control. Perhaps you want to add it to ${chalk.bold('.gitignore')}?`).warn();
        }
    } catch (error) {
        console.log(error);

        ora('Could not create environment file.\n').fail();

        process.exit(1);
    }
})();
