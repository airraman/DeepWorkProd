// src/services/navigationService.js
// src/services/navigationService.js
import { createRef } from 'react';

// Create navigation reference
export const navigationRef = createRef();

/**
 * Safe navigation function to handle cases where navigationRef is not yet initialized
 * @param {string} name - The route name to navigate to
 * @param {object} params - Optional parameters for the route
 */
export const safeNavigate = (name, params) => {
  if (navigationRef.current) {
    // Navigation reference exists, perform navigation
    navigationRef.current.navigate(name, params);
  } else {
    // Navigation reference doesn't exist yet, log warning
    console.warn(`Attempted to navigate to ${name} before navigationRef was initialized`);
    
    // Store the navigation request to try again later
    // This helps in cases where navigation is attempted before navigation is ready
    pendingNavigation = { name, params };
    
    // Try again in a moment
    setTimeout(() => {
      if (navigationRef.current && pendingNavigation) {
        navigationRef.current.navigate(pendingNavigation.name, pendingNavigation.params);
        pendingNavigation = null;
      }
    }, 1000);
  }
};

// Track any pending navigation requests
let pendingNavigation = null;

/**
 * Reset the navigation stack and navigate to a specific route
 * @param {string} name - The route name to navigate to
 * @param {object} params - Optional parameters for the route
 */
export const safeReset = (name, params = {}) => {
  if (navigationRef.current) {
    navigationRef.current.reset({
      index: 0,
      routes: [{ name, params }],
    });
  } else {
    console.warn(`Attempted to reset navigation to ${name} before navigationRef was initialized`);
  }
};

/**
 * Go back to the previous screen if possible
 */
export const safeGoBack = () => {
  if (navigationRef.current) {
    navigationRef.current.goBack();
  } else {
    console.warn('Attempted to go back before navigationRef was initialized');
  }
};

/**
 * Get the current route name
 * @returns {string|null} The current route name or null if navigation isn't ready
 */
export const getCurrentRouteName = () => {
  if (navigationRef.current) {
    return navigationRef.current.getCurrentRoute().name;
  }
  return null;
};

/**
 * Check if navigation is ready
 * @returns {boolean} True if navigation is ready
 */
export const isNavigationReady = () => {
  return navigationRef.current !== null && navigationRef.current !== undefined;
};