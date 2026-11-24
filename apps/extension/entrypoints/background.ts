import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
export default defineBackground(() => {
  void browser.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(console.error);
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
});
