import { VERSION } from '@earendil-works/pi-coding-agent';
test('import pi-coding-agent', () => {
  expect(typeof VERSION).toBe('string');
});