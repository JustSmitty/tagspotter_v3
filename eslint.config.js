// @ts-check
/**
 * ESLint flat config (audit F-38).
 *
 * Replaces .eslintrc.json, which was eslintrc-format under ESLint 9 and only
 * still worked through the compatibility layer that is on its way out.
 *
 * Built from the individual plugin packages rather than the `angular-eslint` /
 * `typescript-eslint` umbrella packages, so the migration needed no new
 * dependencies — everything referenced here was already installed.
 */
const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const angular = require('@angular-eslint/eslint-plugin');
const angularTemplate = require('@angular-eslint/eslint-plugin-template');
const templateParser = require('@angular-eslint/template-parser');

module.exports = [
  {
    ignores: [
      'projects/**/*',
      'www/**',
      'dist/**',
      'coverage/**',
      'android/**',
      'ios/**',
      '.angular/**',
      'node_modules/**',
    ],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['tsconfig.json'],
        createDefaultProgram: true,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      '@angular-eslint': angular,
    },
    processor: angularTemplate.processors['extract-inline-html'],
    rules: {
      ...angular.configs.recommended.rules,

      /*
       * This is a format migration, not a strictness change, so the rule set
       * matches what .eslintrc.json enforced. Layering in
       * `typescript-eslint/recommended` here would have been a second, hidden
       * change — it surfaces 33 `no-explicit-any` errors, almost all of them
       * `as any` test scaffolding. Worth doing; worth doing on its own.
       *
       * The one addition is no-unused-vars, because turning it on immediately
       * found a dead `effect` import left behind by the F-17 refactor. It costs
       * nothing and catches something.
       */
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // Standalone is the default in this codebase; the rule adds noise.
      '@angular-eslint/prefer-standalone': 'off',

      '@angular-eslint/component-class-suffix': [
        'error',
        { suffixes: ['Page', 'Component'] },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
    },
  },
  {
    files: ['**/*.html'],
    languageOptions: {
      parser: templateParser,
    },
    plugins: {
      '@angular-eslint/template': angularTemplate,
    },
    rules: {
      ...angularTemplate.configs.recommended.rules,
    },
  },
];
