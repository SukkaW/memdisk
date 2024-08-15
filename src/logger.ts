import { yellow, red, blue } from 'picocolors';

const noop = () => {
  // noo[]
};

export interface Logger {
  warn: (...messages: any[]) => void,
  error: (...messages: any[]) => void,
  info: (...messages: any[]) => void
}

export const getLogger = (quiet = false): Logger => ({
  warn: quiet ? noop : (...messages: any[]) => console.warn(yellow('WARN') + ' ', ...messages),
  error: quiet ? noop : (...messages: any[]) => console.error(red('ERROR') + ' ', ...messages),
  info: quiet ? noop : (...messages: any[]) => console.info(blue('INFO') + ' ', ...messages)
});
