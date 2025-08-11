/* eslint-disable no-console -- logger */
import picocolors from 'picocolors';
import { noop } from 'foxts/noop';

const { yellow, red, blue } = picocolors;

export interface Logger {
  warn: (...messages: unknown[]) => void,
  error: (...messages: unknown[]) => void,
  info: (...messages: unknown[]) => void
}

export function getLogger(quiet = false): Logger {
  return {
    warn: quiet ? noop : (...messages: unknown[]) => console.warn(yellow('WARN') + ' ', ...messages),
    error: quiet ? noop : (...messages: unknown[]) => console.error(red('ERROR') + ' ', ...messages),
    info: quiet ? noop : (...messages: unknown[]) => console.info(blue('INFO') + ' ', ...messages)
  };
}
