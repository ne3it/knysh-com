#!/usr/bin/env node
'use strict';

/**
 * Scaffold a new feature for a section with one command.
 *
 * Usage:
 *   node scripts/scaffold-feature.js --name reports --label "Отчеты" --icon FileText --section wb --group main --description "Отчеты и экспорт"
 *
 * Positional shorthand:
 *   node scripts/scaffold-feature.js reports "Отчеты" FileText wb main
 *
 * Result:
 *   1. Creates src/components/features/{section}/{PascalName}.tsx
 *   2. Adds the icon to the lucide-react import + ICON_MAP in src/config/features.ts
 *   3. Adds a feature const + registers it in the specified group
 *
 * To use in another section, add --section ozon (and create src/app/ozon/page.tsx).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_FILE = path.join(ROOT, 'src/config/features.ts');
const FEATURES_DIR = path.join(ROOT, 'src/components/features');

function parseArgs(argv) {
  const opts = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        opts[key] = next;
        i++;
      } else {
        opts[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  if (opts.help) return opts;

  const [name, label, icon] = positional;
  if (!opts.name && name) opts.name = name;
  if (!opts.label && label) opts.label = label;
  if (!opts.icon && icon) opts.icon = icon;
  if (!opts.section) opts.section = 'wb';
  if (!opts.group) opts.group = 'main';
  if (!opts.description) opts.description = '';
  if (!opts.shortcut) opts.shortcut = '';

  return opts;
}

function toPascalCase(name) {
  return name
    .replace(/[-_\s]+/g, ' ')
    .replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}

function toKebabCase(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

const HELP_TEXT = `
Scaffold a new feature in one command.

Usage:
  node scripts/scaffold-feature.js --name <name> [options]

Options:
  --name         Feature identifier (kebab-case or camelCase)    [required]
  --label        Display name in sidebar                         [required]
  --icon         Lucide icon name (e.g. FileText)                [required]
  --section      Section to add to (e.g. wb, ozon)               [default: wb]
  --group        Feature group ID (e.g. main, marketing, system) [default: main]
  --description  Short description (tooltip)
  --shortcut     Keyboard shortcut (e.g. ⌘7)
  --no-component Skip component file creation (already exists)
  --help, -h     Show this help

Examples:
  node scripts/scaffold-feature.js --name reports --label "Отчеты" --icon FileText
  node scripts/scaffold-feature.js reports "Отчеты" FileText wb main
  node scripts/scaffold-feature.js --name "wb-reports" --label "Отчеты WB" --icon BarChart3 --section wb --group marketing
`;

function generateComponentTemplate(name, label, icon, section, description) {
  const pascal = toPascalCase(name);
  const kebab = toKebabCase(name);
  const iconImports = icon === 'HelpCircle' ? '' : `\n  ${icon},`;

  return `'use client';

import React from 'react';
import { ${icon} } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionContentWrapper } from '@/components/layout/SectionContent';
import type { Feature } from '@/types/section';

export default function ${pascal}({ feature }: { feature: Feature }) {
  return (
    <SectionContentWrapper feature={feature}>
      <div className="space-y-6">
        <div className="text-center py-12">
          <${icon === 'HelpCircle' ? 'HelpCircle' : icon} className="w-12 h-12 text-neutral-300 mx-auto mb-4" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">${label}</h3>
          <p className="text-neutral-500">Эта функция пока не реализована. Добавьте логику в <code className="text-neutral-400">src/components/features/${section}/${pascal}.tsx</code></p>
        </div>
      </div>
    </SectionContentWrapper>
  );
}
`;
}

function ensureIconInImports(configContent, iconName) {
  if (configContent.includes(`${iconName},`)) {
    return configContent;
  }

  const importRegex = /(import\s*\{[^}]*\s*from\s*'lucide-react';)/;
  const match = configContent.match(importRegex);
  if (!match) {
    throw new Error('Could not find lucide-react import in features.ts');
  }

  const before = match[0];
  const updated = before.replace(
    /(\}\s*from\s*'lucide-react';)/,
    `  ${iconName},\n}$1`
  );
  return configContent.replace(before, updated);
}

function ensureIconInMap(configContent, iconName) {
  const mapEntry = `  ${iconName},`;
  if (configContent.includes(mapEntry) || configContent.includes(`${iconName},`)) {
    return configContent;
  }

  const mapRegex = /(export const ICON_MAP[^}]*\{[^}]*HelpCircle,\s*)/;
  const match = configContent.match(mapRegex);
  if (match) {
    return configContent.replace(
      match[0],
      match[0] + `\n${mapEntry}`
    );
  }

  const fallbackRegex = /(export const ICON_MAP[^\n]*\n\s*\{)/;
  const fallback = configContent.match(fallbackRegex);
  if (fallback) {
    return configContent.replace(
      fallback[0],
      fallback[0] + `\n${mapEntry}`
    );
  }

  return configContent;
}

function insertFeatureConst(configContent, feature) {
  const constName = `wb${toPascalCase(feature.name)}`;
  const pascalName = toPascalCase(feature.name);
  const shortcutLine = feature.shortcut
    ? `  shortcut: '${feature.shortcut}',\n`
    : '';

  const constBlock =
    `const ${constName}: Feature = {\n` +
    `  id: '${feature.name}',\n` +
    `  label: '${feature.label}',\n` +
    `  icon: '${feature.icon}',\n` +
    `  description: '${feature.description || ''}',\n` +
    `  componentPath: '@/components/features/${feature.section}/${pascalName}',\n` +
    `${shortcutLine}` +
    `  group: '${feature.group}',\n` +
    `};\n\n`;

  const marker = '// --- Feature Groups ---';
  if (!configContent.includes(marker)) {
    throw new Error('Could not find "// --- Feature Groups ---" marker in features.ts');
  }

  return configContent.replace(marker, constBlock + marker);
}

function addToGroup(configContent, feature) {
  const constName = `wb${toPascalCase(feature.name)}`;
  const groupName = feature.group;
  const groupRegex = new RegExp(
    `(id:\\s*'${groupName}'[\\s\\S]*?features:\\s*\\[)`,
    'm'
  );

  const match = configContent.match(groupRegex);
  if (!match) {
    throw new Error(`Could not find feature group "${groupName}" in features.ts`);
  }

  const insertPoint = match.index + match[0].length;
  const before = configContent.slice(0, insertPoint);
  const after = configContent.slice(insertPoint);
  const updated = before + `${constName}, ` + after;

  return updated;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    console.log(HELP_TEXT);
    return;
  }

  const required = ['name', 'label', 'icon'];
  for (const key of required) {
    if (!opts[key]) {
      console.error(`Error: --${key} is required`);
      console.error(HELP_TEXT);
      process.exit(1);
    }
  }

  const feature = {
    name: opts.name,
    label: opts.label,
    icon: opts.icon,
    section: opts.section,
    group: opts.group,
    description: opts.description,
    shortcut: opts.shortcut,
  };

  const pascalName = toPascalCase(feature.name);
  const componentPath = path.join(FEATURES_DIR, feature.section, `${pascalName}.tsx`);
  const configConstName = `wb${pascalName}`;

  console.log(`Creating feature:`);
  console.log(`  Name:        ${feature.name}`);
  console.log(`  Label:       ${feature.label}`);
  console.log(`  Icon:        ${feature.icon}`);
  console.log(`  Section:     ${feature.section}`);
  console.log(`  Group:       ${feature.group}`);
  console.log(`  Component:   src/components/features/${feature.section}/${pascalName}.tsx`);
  console.log(`  Config var:  ${configConstName}`);
  console.log();

  if (!opts['no-component']) {
    if (fs.existsSync(componentPath)) {
      console.error(`Warning: Component already exists at ${componentPath}`);
      console.error(`         Overwrite with --force (not yet implemented) or edit manually.`);
      process.exit(1);
    }

    const dir = path.dirname(componentPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(componentPath, generateComponentTemplate(feature.name, feature.label, feature.icon, feature.section, feature.description));
    console.log(`[1/3] Created component: ${componentPath}`);
  }

  let configContent = fs.readFileSync(CONFIG_FILE, 'utf-8');

  configContent = ensureIconInImports(configContent, feature.icon);
  console.log(`[2/3] Icon "${feature.icon}" registered in imports`);

  configContent = ensureIconInMap(configContent, feature.icon);
  console.log(`[3/3] Icon "${feature.icon}" registered in ICON_MAP`);

  const constName = `wb${pascalName}`;
  const constExists = configContent.includes(`const ${constName}:`);
  if (!constExists) {
    configContent = insertFeatureConst(configContent, feature);
    console.log(`[4/4] Feature const "${constName}" added to features.ts`);
  } else {
    console.log(`[4/4] Feature const "${constName}" already exists (skipped)`);
  }

  const inGroup = configContent.includes(`${constName},`);
  if (!inGroup) {
    configContent = addToGroup(configContent, feature);
    console.log(`[5/5] "${constName}" added to group "${feature.group}"`);
  } else {
    console.log(`[5/5] "${constName}" already in group (skipped)`);
  }

  fs.writeFileSync(CONFIG_FILE, configContent, 'utf-8');

  console.log('\nDone! New feature registered:');
  console.log(`  Sidebar: ${feature.label}`);
  console.log(`  URL:     /${feature.section} → click "${feature.label}" in sidebar`);
  console.log(`\nNext steps:`);
  console.log(`  1. Implement logic in: src/components/features/${feature.section}/${pascalName}.tsx`);
  console.log(`  2. Run: npm run dev`);
  console.log(`  3. Visit: http://localhost:3000/${feature.section}`);
}

main();
