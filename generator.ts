import * as ejs from 'ejs';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as prettier from 'prettier';
import * as chokidar from 'chokidar';
import {register} from 'ts-node';

// Регистрируем ts-node для динамического импорта с расширенными настройками
register({
    compilerOptions: {
        module: 'commonjs',
        esModuleInterop: true,
        allowJs: true,
        strict: false,
        noImplicitAny: false,
        skipLibCheck: true,
        target: 'es2018',
        moduleResolution: 'node',
        resolveJsonModule: true,
        declaration: true,
        sourceMap: true,
    },
    transpileOnly: true,
});

// Настройки по умолчанию для Prettier
const DEFAULT_PRETTIER_CONFIG: prettier.Options = {
    parser: 'typescript-react',
    semi: true,
    singleQuote: true,
    trailingComma: 'es5' as const,
    printWidth: 100,
};

export interface GeneratorOptions {
    templateName: string;
    outputPath: string;
    data: Record<string, any>;
}

export interface TemplateConfig {
    outputPath: string;
    data: Record<string, any>;
}

export class FileGenerator {
    private templatesDir: string;
    private outputDir: string;
    private watchers: Map<string, chokidar.FSWatcher> = new Map();
    private lastValidContent: Map<string, string> = new Map();
    private prettierConfig: prettier.Options;

    constructor(templatesDir: string, watchMode: boolean = false, outputDir?: string) {
        this.templatesDir = path.resolve(templatesDir);
        this.outputDir = outputDir ? path.resolve(outputDir) : path.join(__dirname, 'output');
        this.prettierConfig = DEFAULT_PRETTIER_CONFIG;

        if (watchMode) {
            process.on('SIGINT', async () => {
                console.log('\nStopping watch mode...');
                await this.stopWatching();
                process.exit(0);
            });
        }
    }

    async init(): Promise<void> {
        this.prettierConfig = await this.loadPrettierConfig();
    }

    private async loadPrettierConfig(): Promise<prettier.Options> {
        try {
            // Ищем конфиг в директории запуска
            const config = await prettier.resolveConfig(process.cwd());
            if (config) {
                console.log('Using Prettier config from project root');
                return config;
            }
        } catch (error) {
            // console.warn('Failed to load Prettier config:', error);
        }

        // Если конфиг не найден или произошла ошибка, используем настройки по умолчанию
        console.log('Using default Prettier config');
        return DEFAULT_PRETTIER_CONFIG;
    }

    async generateAll(): Promise<void> {
        const templateDirs = await fs.readdir(this.templatesDir);

        for (const templateDir of templateDirs) {
            const templatePath = path.join(this.templatesDir, templateDir);
            const stats = await fs.stat(templatePath);

            if (stats.isDirectory()) {
                await this.generateFromTemplateDir(templatePath);
            }
        }
    }

    private async generateFromTemplateDir(templateDir: string): Promise<void> {
        const templateName = path.basename(templateDir);
        const templatePath = path.join(templateDir, `${templateName}.ejs`);
        const configPath = path.join(templateDir, 'config.ts');

        if (!(await fs.pathExists(templatePath))) {
            console.warn(`Template file not found: ${templatePath}`);
            return;
        }

        if (!(await fs.pathExists(configPath))) {
            console.warn(`Config file not found: ${configPath}`);
            return;
        }

        try {
            const config = require(path.resolve(configPath));
            const templateConfig: TemplateConfig = config.default || config;

            // Объединяем выходную директорию с именем файла из конфига
            const outputPath = path.join(this.outputDir, templateConfig.outputPath);

            await this.generateFromTemplate(templatePath, outputPath, templateConfig.data);
        } catch (error) {
            console.error(`Error processing template ${templateName}:`, error);
        }
    }

    async watchAll(): Promise<void> {
        const templateDirs = await fs.readdir(this.templatesDir);

        for (const templateDir of templateDirs) {
            const templatePath = path.join(this.templatesDir, templateDir);
            const stats = await fs.stat(templatePath);

            if (stats.isDirectory()) {
                await this.watchTemplateDir(templatePath);
            }
        }
    }

    private async watchTemplateDir(templateDir: string): Promise<void> {
        const templateName = path.basename(templateDir);
        const templatePath = path.join(templateDir, `${templateName}.ejs`);
        const configPath = path.join(templateDir, 'config.ts');

        if (!(await fs.pathExists(templatePath)) || !(await fs.pathExists(configPath))) {
            return;
        }

        const templateWatcher = chokidar.watch(templatePath, {
            ignoreInitial: false,
            awaitWriteFinish: {
                stabilityThreshold: 300,
                pollInterval: 100,
            },
        });

        const configWatcher = chokidar.watch(configPath, {
            ignoreInitial: false,
            awaitWriteFinish: {
                stabilityThreshold: 300,
                pollInterval: 100,
            },
        });

        const generate = async () => {
            try {
                const config = require(path.resolve(configPath));
                const templateConfig: TemplateConfig = config.default || config;

                // Объединяем выходную директорию с именем файла из конфига
                const outputPath = path.join(this.outputDir, templateConfig.outputPath);

                await this.generateFromTemplate(templatePath, outputPath, templateConfig.data);
            } catch (error) {
                console.error(`Error processing template ${templateName}:`, error);
            }
        };

        templateWatcher.on('change', generate);
        configWatcher.on('change', generate);

        this.watchers.set(templatePath, templateWatcher);
        this.watchers.set(configPath, configWatcher);
    }

    private async validateAndFormat(content: string): Promise<string | null> {
        try {
            // Создаем временный файл для определения парсера
            const tempFile = path.join(process.cwd(), 'temp.tsx');
            const formatted = await prettier.format(content, {
                ...this.prettierConfig,
                filepath: tempFile,
            });
            return formatted;
        } catch (error) {
            console.error('Template validation failed:', error);
            return null;
        }
    }

    private async generateFromTemplate(
        templatePath: string,
        outputPath: string,
        data: Record<string, any>,
    ): Promise<void> {
        try {
            const template = await fs.readFile(templatePath, 'utf-8');
            const rendered = ejs.render(template, data);
            const formatted = await this.validateAndFormat(rendered);

            if (!formatted) {
                return;
            }

            await fs.ensureDir(path.dirname(outputPath));
            await fs.writeFile(outputPath, formatted, 'utf-8');

            this.lastValidContent.set(templatePath, formatted);
            console.log(`File generated successfully at: ${outputPath}`);
        } catch (error) {
            console.error(`Error processing template ${templatePath}:`, error);

            const lastValid = this.lastValidContent.get(templatePath);
            if (lastValid) {
                await fs.writeFile(outputPath, lastValid, 'utf-8');
            }
        }
    }

    async stopWatching(): Promise<void> {
        for (const watcher of this.watchers.values()) {
            await watcher.close();
        }
        this.watchers.clear();
    }
}
