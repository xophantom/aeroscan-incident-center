import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(
  { ignores: ['dist', 'coverage'] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: { '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }] },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
)
