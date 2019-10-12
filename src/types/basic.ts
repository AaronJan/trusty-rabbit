import amqp from 'amqplib';

export interface Logger {
  debug(message: string, ...data: any[]): void;
  error(message: string, ...data: any[]): void;
}

export interface ConnectionConnectedListener {
  (connection: Connection): void;
}

export interface ConnectionUnexpectedDisconnectedListener {
  (): void;
}

export interface ConnectionClosedListener {
  (): void;
}

export interface ConnectionErrorListener {
  (err: any): void;
}

export interface Connection {
  isActivated(): boolean;
  isConnected(): boolean;
  connect(): Promise<void>;
  close(): Promise<void>;
  createChannel(): Promise<amqp.ConfirmChannel>;

  on(event: 'reconnected', listener: ConnectionConnectedListener): void;
  on(event: 'disconnected', listener: ConnectionUnexpectedDisconnectedListener): void;
  on(event: 'closed', listener: ConnectionClosedListener): void;
  on(event: 'error', listener: ConnectionErrorListener): void;

  removeListener(event: 'reconnected', listener: ConnectionConnectedListener): void;
  removeListener(event: 'disconnected', listener: ConnectionUnexpectedDisconnectedListener): void;
  removeListener(event: 'closed', listener: ConnectionClosedListener): void;
  removeListener(event: 'error', listener: ConnectionErrorListener): void;
}

export interface Processor<T> {
  (content: T, message: amqp.Message): Promise<boolean>;
}

export interface Publisher<T> {
  publish(key: string, content: T): Promise<void>;
  stop(closeConnection?: boolean): Promise<void>;
}

export interface Consumer<T> {
  consume(processor: Processor<T>): Promise<void>;
  stop(closeConnection?: boolean): Promise<void>;
}
