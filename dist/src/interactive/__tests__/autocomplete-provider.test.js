import { createAutocompleteProvider } from '../autocomplete-provider.js';
describe('AutocompleteProvider', () => {
    it('creates CombinedAutocompleteProvider with slash commands', () => {
        const slashCommands = [
            { value: 'clear', label: 'clear', description: 'Clear chat' },
            { value: 'exit', label: 'exit', description: 'Exit' },
        ];
        const provider = createAutocompleteProvider(slashCommands);
        // The CombinedAutocompleteProvider is from pi-tui, we just verify it's constructed
        expect(provider).toBeDefined();
    });
    it('accepts fdPath parameter', () => {
        const slashCommands = [];
        // @ts-ignore - testing our wrapper
        const provider = createAutocompleteProvider(slashCommands, '/usr/bin/fd');
        expect(provider).toBeDefined();
    });
    it('handles undefined fdPath by using null', () => {
        const slashCommands = [];
        // @ts-ignore
        const provider = createAutocompleteProvider(slashCommands, undefined);
        expect(provider).toBeDefined();
    });
});
//# sourceMappingURL=autocomplete-provider.test.js.map