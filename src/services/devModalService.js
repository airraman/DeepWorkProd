// src/services/devModalService.js
//
// DEV-ONLY singleton for triggering global modals from DevToolsScreen.
// App.js registers its state setters here on mount.
// Remove this file (and its callers) before shipping to production.

let _setForceUpdateDebug = null;
let _setWhatsNewDebug = null;

export const devModalService = {
  /** Called once from App.js useEffect to hand over state setters. */
  register(setForceUpdateDebug, setWhatsNewDebug) {
    _setForceUpdateDebug = setForceUpdateDebug;
    _setWhatsNewDebug = setWhatsNewDebug;
  },

  /** Show ForceUpdateModal immediately. */
  triggerForceUpdate() {
    _setForceUpdateDebug?.(true);
  },

  /** Dismiss ForceUpdateModal (debug instance only). */
  dismissForceUpdate() {
    _setForceUpdateDebug?.(false);
  },

  /** Show WhatsNewModal immediately. */
  triggerWhatsNew() {
    _setWhatsNewDebug?.(true);
  },

  /** Called by WhatsNewModal's onComplete so the debug flag is cleared. */
  dismissWhatsNew() {
    _setWhatsNewDebug?.(false);
  },
};
