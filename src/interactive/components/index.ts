/**
 * Barrel export for interactive components
 *
 * Re-exports components from pi-coding-agent and local custom components.
 * This provides a single import point for all UI components.
 */

// Re-export from pi-coding-agent (these are available from the package)
export {
	AssistantMessageComponent,
	UserMessageComponent,
	ToolExecutionComponent,
	BashExecutionComponent,
	DynamicBorder,
	CustomEditor,
	FooterComponent,
	ThinkingSelectorComponent,
	ModelSelectorComponent,
	SettingsSelectorComponent,
	SessionSelectorComponent,
	TreeSelectorComponent,
	UserMessageSelectorComponent,
	ExtensionSelectorComponent,
	ExtensionInputComponent,
	ExtensionEditorComponent,
	BorderedLoader,
	LoginDialogComponent,
	OAuthSelectorComponent,
	// Keybinding hints
	keyHint,
	keyText,
	rawKeyHint,
} from '@earendil-works/pi-coding-agent';

// Local custom components (not in package)
export { ExpandableText } from './expandable-text.js';

// Easter egg components (placeholders - will implement if needed)
// These are from reference but likely not exported by package
// If needed, create local versions
