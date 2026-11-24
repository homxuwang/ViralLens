import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config({ ignores: ['**/.wxt/**', '**/.output/**', '**/node_modules/**'] }, js.configs.recommended, ...ts.configs.recommended);
