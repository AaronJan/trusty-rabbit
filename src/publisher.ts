import amqp from 'amqplib';

import { Connection, Publisher as IPublisher, Logger, ConnectionConnectedListener } from './types';
import { DummyLogger } from './dummy-logger';
import { sleep } from './helpers';

export interface ExchangeInfo {
  name: string;
}

export interface PublisherOptions {
  logger?: Logger;
  exchange: ExchangeInfo;
}

export class Publisher<T> implements IPublisher<T> {
  private logger: Logger;

  private exchange: ExchangeInfo;

  private initialized: boolean = false;
  private channel?: amqp.ConfirmChannel;
  private reconnectionedListener?: ConnectionConnectedListener;

  private stopping: boolean = false;
  private sendingCount: number = 0;

  constructor(private connection: Connection, options: PublisherOptions) {
    const { logger = new DummyLogger(), exchange } = options;

    this.logger = logger;
    this.exchange = exchange;
  }

  private async establishNewChannel() {
    this.channel = await this.connection.createChannel();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    // 如果没有启动则启动
    if (this.connection.isActivated() === false) {
      await this.connection.connect();
    }

    try {
      await this.establishNewChannel();
    } catch (err) {
      this.initialized = false;
      throw err;
    }

    this.reconnectionedListener = () => this.establishNewChannel();
    this.connection.on('reconnected', this.reconnectionedListener);
  }

  async publish(routingKey: string, content: T): Promise<void> {
    if (this.stopping) {
      throw new Error('SuccessfulRabbit: Publisher is stopping or stopped.');
    }

    await this.initialize();

    return await new Promise((resolve, reject) => {
      try {
        this.sendingCount++;

        const encodedContent = Buffer.from(JSON.stringify(content));

        const isFull = (<amqp.ConfirmChannel>this.channel).publish(
          this.exchange.name,
          routingKey,
          encodedContent,
          {
            persistent: true,
          },
          (err, ok) => {
            this.sendingCount--;

            if (err !== null) {
              return reject(err);
            }
            resolve();
          },
        );

        // If the return is `false`, means the channel's write buffer is full, so we just let caller know.
        if (isFull === false) {
          reject(new Error('SuccessfulRabbit: Channel buffer is full.'));
        }
      } catch (err) {
        this.sendingCount--;
        reject(err);
      }
    });
  }

  async stop(closeConnection = false): Promise<void> {
    this.stopping = true;

    this.connection.removeListener('reconnected', <ConnectionConnectedListener>this.reconnectionedListener);

    // Graceful stop, wait for 5 seconds.
    let retryTimes = 0;
    while (this.sendingCount !== 0) {
      if (retryTimes >= 100) {
        throw new Error(`SuccessfulRabbit: Can not stop publisher gracefully, maximum rety times exceeded.`);
      }

      retryTimes++;
      await sleep(50);
    }

    // Close this channel.
    await (<amqp.ConfirmChannel>this.channel).close();
    // Close connection if needed.
    if (closeConnection) {
      await this.connection.close();
    }
    this.stopping = false;
  }
}
