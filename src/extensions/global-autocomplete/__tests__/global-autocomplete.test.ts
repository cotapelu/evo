import { jest } from '@jest/globals';
import globalAutocompleteExtension from '..';

describe('Global Autocomplete Provider', () => {
  test('registers provider via extension default export', () => {
    const addAutocomplete = jest.fn();
    const api: any = {
      ui: { addAutocompleteProvider: addAutocomplete },
      on: jest.fn(),
    };
    globalAutocompleteExtension(api);
    // Retrieve the session_start handler
    const onCalls = api.on.mock.calls;
    const sessionStartCall = onCalls.find(c => c[0] === 'session_start');
    expect(sessionStartCall).toBeDefined();
    const handler = sessionStartCall[1];
    // Invoke the handler with a mock context
    handler({}, { ui: { addAutocompleteProvider: addAutocomplete } });
    expect(addAutocomplete).toHaveBeenCalled();
  });
});
