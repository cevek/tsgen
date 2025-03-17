# @cevek/tsgen

A TypeScript file generator based on EJS templates.

## Installation

```bash
npm install -g @cevek/tsgen
```

## Usage

### Global Installation

```bash
tsgen [templates-dir] [options]
```

### Local Installation

```bash
npx @cevek/tsgen [templates-dir] [options]
```

### Options

- `-w, --watch` - Watch mode - regenerate files on template changes (default: false)
- `-o, --output <dir>` - Output directory for generated files (default: "output")
- `[templates]` - Directory containing templates (default: "./templates")

### Examples

```bash
# Generate files from templates directory
tsgen ./templates

# Generate with custom output directory
tsgen ./templates -o ./generated

# Watch mode for automatic regeneration
tsgen ./templates -w -o ./generated
```

## Template Structure

Each template should be in its own directory with the following structure:

```
templates/
  ├── component/
  │   ├── component.ejs    # Component template
  │   └── config.ts        # Template configuration
  └── ...
```

### Template Example (component.ejs)

```typescript
import React from 'react';

export const <%= componentName %>: React.FC = () => {
  return (
    <div>
      <%= componentName %> Component
    </div>
  );
};
```

### Configuration Example (config.ts)

```typescript
export default {
  outputPath: 'MyComponent.tsx',
  data: {
    componentName: 'MyComponent'
  }
};
```

## Features

- TypeScript support
- EJS templating
- Watch mode for automatic regeneration
- Custom output directory
- Prettier code formatting
- TypeScript configuration support

## License

MIT 