#!/usr/bin/env node

import {FileGenerator} from './generator';
import * as path from 'path';
import {Command} from 'commander';

interface GeneratorOptions {
    watch: boolean;
    output: string;
}

async function main() {
    const program = new Command();

    program
        .name('ts-gen')
        .description('TypeScript file generator using EJS templates')
        .version('1.0.0')
        .option('-w, --watch', 'Watch mode - regenerate files on template changes', false)
        .option('-o, --output <dir>', 'Output directory for generated files', 'output')
        .argument('[templates]', 'Directory containing templates', path.join(__dirname, 'templates'))
        .action(async (templatesDir: string, options: GeneratorOptions) => {
            console.log('Templates directory:', templatesDir);
            console.log('Output directory:', options.output);
            if (options.watch) {
                console.log('Watching templates directory for changes...');
            }

            const generator = new FileGenerator(templatesDir, options.watch, options.output);
            await generator.init();

            try {
                await generator.generateAll();
                if (options.watch) {
                    await generator.watchAll();
                }
            } catch (error) {
                console.error('Error:', error);
                process.exit(1);
            }
        });

    await program.parseAsync();
}

if (require.main === module) {
    main();
}
