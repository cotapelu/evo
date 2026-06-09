/**
 * Pi Extension Entry Point
 *
 * This file is used by `pi install npm:evo` to load extensions.
 * It exports the extensionFactories array that pi-coding-agent will use.
 */

import { getExtensionFactories } from './extensions/index.js';

export const extensionFactories = getExtensionFactories();
