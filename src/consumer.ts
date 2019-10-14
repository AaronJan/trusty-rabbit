import amqp from 'amqplib';

import { Connection, Consumer as IConsumer, Logger, Processor, ConnectionConnectedListener, ConnectionUnexpectedDisconnectedListener } from './types';
import { DummyLogger } from './dummy-logger';
import { sleep } from './helpers';

export interface ConsumptionExceptionHandler {
  (message: amqp.Message, err: any): Promise<void>;
}

export interface ConsumerOptions {
  logger?: Logger;
  queue: string;
  prefetch: number;
  exceptionHandler?: ConsumptionExceptionHandler;
}

export class Consumer<T> implements IConsumer<T> {
  private logger: Logger;

  private queue: string;
  private prefetch: number;

  private initialized: boolean = false;
  private connected: boolean = false;
  private stopping: boolean = false;

  private exceptionHandler: ConsumptionExceptionHandler;

  private channel?: amqp.ConfirmChannel;
  private connectionedListener?: ConnectionConnectedListener;
  private disconnectedListener?: ConnectionUnexpectedDisconnectedListener;

  private processingCount: number = 0;

  constructor(private connection: Connection, options: ConsumerOptions) {
    const { logger = new DummyLogger(), queue, prefetch = 1, exceptionHandler } = options;

    this.logger = logger;
    this.queue = queue;
    this.prefetch = prefetch;
    this.exceptionHandler =
      exceptionHandler !== undefined
        ? exceptionHandler
        : async err => {
          logger.error('SuccessfulRabbit: Unexpected exception while consuming:', err);
        };
  }

  private async consumeConnection(connection: Connection, processor: Processor<T>) {
    const channel = await connection.createChannel();
    channel.prefetch(this.prefetch);
    // TODO: Fix assertion
    // await channel.assertQueue(
    //   this.queue,
    //   {
    //     durable: true,
    //   },
    // );

    const consumeReply = await channel.consume(
      this.queue,
      async message => {
        // Cancel Notification
        if (message === null) {
          // Ignore this.
          return;
        }

        // When entering stopping pharse, stop message processing.
        if (this.stopping) {
          return;
        }

        try {
          this.processingCount++;

          const content: T = JSON.parse(message.content.toString('utf8'));
          const doAck = await processor(content, message);

          if (doAck) {
            channel.ack(message);
          } else {
            // Only this message and no `requeue`.
            channel.nack(message, false, false);
          }
        } catch (err) {
          await this.exceptionHandler(message, err);

          // Discard this message when exception occurs.
          channel.nack(message, false, false);
        } finally {
          this.processingCount--;
        }
      },
      {
        noAck: false,
      },
    );

    this.connected = true;
    this.channel = channel;
  }

  private async handleDisconnect() {
    this.connected = false;
    this.channel = undefined;
  }

  async consume(processor: Processor<T>): Promise<void> {
    if (this.initialized) {
      throw new Error(`SuccessfulRabbit: Consumer already initialized.`);
    }
    this.initialized = true;

    // 如果没有启动则启动
    if (this.connection.isActivated() === false) {
      await this.connection.connect();
    }

    await this.consumeConnection(this.connection, processor);

    // Start consuming when reconnected.
    this.disconnectedListener = () => this.handleDisconnect();
    this.connectionedListener = connection => this.consumeConnection(connection, processor);
    this.connection.on('disconnected', this.disconnectedListener);
    this.connection.on('reconnected', this.connectionedListener);
  }

  async stop(closeConnection = false): Promise<void> {
    if (!this.initialized) {
      throw new Error(`SuccessfulRabbit: Consumer not initialized yet.`);
    }
    this.initialized = false;

    this.stopping = true;

    this.connection.removeListener('disconnected', <ConnectionUnexpectedDisconnectedListener>this.disconnectedListener);
    this.connection.removeListener('reconnected', <ConnectionConnectedListener>this.connectionedListener);

    // Graceful stop, wait for 5 seconds.
    let retryTimes = 0;
    while (this.processingCount !== 0) {
      if (retryTimes >= 100) {
        throw new Error(`SuccessfulRabbit: Can not stop consumer gracefully, maximum rety times exceeded.`);
      }

      retryTimes++;
      await sleep(50);
    }
    // Close this channel.
    if (this.channel) {
      await this.channel.close();
    }
    this.connected = false;

    // Close connection if needed.
    if (closeConnection) {
      await this.connection.close();
    }

    // Reset
    this.connectionedListener = undefined;
    this.channel = undefined;
    this.stopping = false;
  }
}
