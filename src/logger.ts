/* eslint-disable no-console -- logger */
import { yellow, red, blue } from 'picocolors';

const noop = () => {
  // noo[]
};

export interface Logger {
  warn: (...messages: unknown[]) => void,
  error: (...messages: unknown[]) => void,
  info: (...messages: unknown[]) => void
}

export const getLogger = (quiet = false): Logger => ({
  warn: quiet ? noop : (...messages: unknown[]) => console.warn(yellow('WARN') + ' ', ...messages),
  error: quiet ? noop : (...messages: unknown[]) => console.error(red('ERROR') + ' ', ...messages),
  info: quiet ? noop : (...messages: unknown[]) => console.info(blue('INFO') + ' ', ...messages)
});
