import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),

  // Temporary lint debt bridge: keep visibility via warnings while we clean in batches.
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      'react/no-unescaped-entities': 'warn',
      '@next/next/no-html-link-for-pages': 'warn',
      'prefer-const': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
])

export default eslintConfig
