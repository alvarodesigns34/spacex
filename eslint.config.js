// Static checks: the class of mistakes a browser only shows at run time, or never — an
// undefined name in a branch the gate does not visit, an import nobody uses, a variable
// assigned and forgotten. Part of `npm run check`, and it runs first because it is the cheapest.
import globals from 'globals';

export default [
  { ignores: ['vendor/**', 'node_modules/**', 'docs/**', 'tools/_*.mjs'] },
  {
    files: ['**/*.js', '**/*.mjs'],
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.browser, ...globals.node } },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-unreachable': 'error',
      'no-dupe-keys': 'error',
      'no-redeclare': 'error',
      'no-self-assign': 'error',
      'no-const-assign': 'error',
      'no-fallthrough': 'error',
      'no-cond-assign': 'error',
      'no-loss-of-precision': 'error',
      'no-unsafe-finally': 'error',
      'no-dupe-else-if': 'error',
      'no-self-compare': 'error',
      'no-unused-private-class-members': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'eqeqeq': ['error', 'smart'],
    },
  },
];
