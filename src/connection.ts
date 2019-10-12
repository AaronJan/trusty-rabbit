import amqp from 'amqplib';
import { EventEmitter } from 'events';

import {
  Logger,
  Connection as IConnection,
  ConnectionConnectedListener,
  ConnectionUnexpectedDisconnectedListener,
  ConnectionClosedListener,
  ConnectionErrorListener,
} from './types';
import { DummyLogger } from './dummy-logger';
import { sleep } from './helpers';

export interface ReconnectStrategy {
  (): Promise<boolean>;
}

export interface ConnectionOptions {
  uri: string;
  logger?: Logger;
  reconnect?: ReconnectStrategy;
}

export function createDefaultReconnectStrategy(): ReconnectStrategy {
  const maxReryTimes = 10;
  let retryTimes = 0;

  return async () => {
    retryTimes++;
    await sleep(1000);

    return retryTimes <= maxReryTimes;
  };
}

export class Connection implements IConnection {
  private eventEmitter: EventEmitter;

  private uri: string;
  private logger: Logger;
  private reconnectStrategy: ReconnectStrategy;

  private rabbitConnection?: amqp.Connection;

  private activated: boolean = false;
  private connected: boolean = false;

  private closing: boolean = false;

  constructor(options: ConnectionOptions) {
    const { uri, logger = new DummyLogger(), reconnect = createDefaultReconnectStrategy() } = options;
    this.uri = uri;
    this.logger = logger;
    this.reconnectStrategy = reconnect;

    this.eventEmitter = new EventEmitter();
    this.eventEmitter.on('error', err => {
      this.logger.error(`SuccessfulRabbit: Connection error.`, err);
    });
  }

  isActivated(): boolean {
    return this.activated;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    if (this.activated && this.connected) {
      throw new Error('SuccessfulRabbit: Connection is already connected.');
    }
    this.activated = true;

    // Connenct.
    this.rabbitConnection = await amqp.connect(this.uri);

    // Bind event listeners.
    this.rabbitConnection.on('error', err => this.eventEmitter.emit('error', err));
    this.rabbitConnection.on('close', async () => {
      this.connected = false;

      // Prevent memory leakage.
      (<amqp.Connection>this.rabbitConnection).removeAllListeners();

      if (this.closing) {
        this.logger.debug('Connection closed.');

        return;
      }

      this.logger.debug('Connection closed unexpectedly.');
      this.eventEmitter.emit('disconnected');

      // Reconnect.
      let reconnecting = await this.reconnectStrategy();
      while (reconnecting) {
        this.logger.debug('Reconnecting...');

        try {
          await this.connect();
          reconnecting = false;

          this.logger.debug('Reconnected.');
          this.eventEmitter.emit('reconnected', this);
        } catch (err) {
          this.logger.debug('Reconnect failed.');
          this.eventEmitter.emit('error', err);
          reconnecting = await this.reconnectStrategy();
        }
      }
    });

    // TODO: `blocked`, `unblocked` events

    this.connected = true;
  }

  async close(): Promise<void> {
    if (!this.activated) {
      throw new Error('SuccessfulRabbit: Connection has not been established yet.');
    }
    if (this.closing) {
      return;
    }
    this.closing = true;

    try {
      await (<amqp.Connection>this.rabbitConnection).close();
    } catch (err) {
      // Omit any error.
    }

    this.eventEmitter.emit('closed');
    this.eventEmitter.removeAllListeners();

    this.rabbitConnection = undefined;
    this.activated = false;
  }

  async createChannel(): Promise<amqp.ConfirmChannel> {
    if (!this.activated) {
      throw new Error('SuccessfulRabbit: Connection has not been established yet.');
    }

    return await (<amqp.Connection>this.rabbitConnection).createConfirmChannel();
  }

  on(event: 'reconnected', listener: ConnectionConnectedListener): void;
  on(event: 'disconnected', listener: ConnectionUnexpectedDisconnectedListener): void;
  on(event: 'closed', listener: ConnectionClosedListener): void;
  on(event: 'error', listener: ConnectionErrorListener): void;
  on(event: any, listener: (...args: any[]) => any): void {
    this.eventEmitter.on(event, listener);
  }

  removeListener(event: 'reconnected', listener: ConnectionConnectedListener): void;
  removeListener(event: 'disconnected', listener: ConnectionUnexpectedDisconnectedListener): void;
  removeListener(event: 'closed', listener: ConnectionClosedListener): void;
  removeListener(event: 'error', listener: ConnectionErrorListener): void;
  removeListener(event: any, listener: (...args: any[]) => any): void {
    this.eventEmitter.removeListener(event, listener);
  }
}
