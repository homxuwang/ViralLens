import { defineConfig } from 'wxt';
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  zip: { name: 'virallens' },
  manifest: {
    name: 'ViralLens', version: '0.1.0',
    description: 'AI 社媒研究与跨平台内容创作助手',
    permissions: ['sidePanel', 'activeTab', 'storage'],
    optional_host_permissions: ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*'],
    action: { default_title: '打开 ViralLens' },
  },
});
