import { Logger } from './types';

export class DummyLogger implements Logger {
  debug(message: string, ...data: any[]): void {
    //
  }

  error(message: string, ...data: any[]): void {
    //
  }
}
