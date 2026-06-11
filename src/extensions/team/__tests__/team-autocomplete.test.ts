import { jest } from '@jest/globals';
import { registerTeamRunAutocomplete } from '..';

describe('Team Run Autocomplete Provider', () => {
  test('registerTeamRunAutocomplete registers provider', () => {
    const addAutocomplete = jest.fn();
    const api: any = {
      ui: { addAutocompleteProvider: addAutocomplete },
      on: jest.fn(),
    };
    registerTeamRunAutocomplete(api);
    const onCalls = api.on.mock.calls;
    const sessionStartCall = onCalls.find(c => c[0] === 'session_start');
    expect(sessionStartCall).toBeDefined();
    const handler = sessionStartCall[1];
    // Simulate session_start event with a context that has ui
    handler({}, { ui: { addAutocompleteProvider: addAutocomplete } });
    expect(addAutocomplete).toHaveBeenCalled();
  });
});
