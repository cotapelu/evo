#!/usr/bin/env node
/**
 * Global Autocomplete Extension Entry Point
 */
import { registerGlobalAutocomplete } from "./global-autocomplete.js";
export default function globalAutocompleteExtension(api) {
    registerGlobalAutocomplete(api);
}
//# sourceMappingURL=index.js.map