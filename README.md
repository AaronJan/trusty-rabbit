# Trushty Rabbit (Alpha Version)

Trustworthy and easy to use RabbitMQ client, supports auto-reconnect and graceful stop.

## Quick Start

### Installation

```shell
$ npm i trusty-rabbit
```

### Publish Messages

```typescript
import {
  Connection,
  Publisher,
} from 'trusty-rabbit';

const connection = new Connection({
  uri: 'amqp://user:password@127.0.0.1:5672/my_vhost',
  // Try to reconnect every 1 second. 
  reconnect: async () => {
    // You have to implement `sleep` function by yourself. 
    await sleep(1000);

    return true;
  },
});
const publisher = new Publisher(connection, {
  exchange: {
    name: exchangeName,
  },
});

// Pass routing key and content (content must be JSON-stringifiable), done!
await publisher.publish('key.0', {
  value: 'content',
});

setTimeout(async () => {
  // Close publisher and underlying connection by passing `true`.
  await publisher.close(true);
}, 2000);
```

### Consume Messages

```typescript
import {
  Connection,
  Consumer,
} from 'trusty-rabbit';

const connection = new Connection({
  uri: 'amqp://user:password@127.0.0.1:5672/my_vhost',
  // Try to reconnect every 1 second. 
  reconnect: async () => {
    // You have to implement `sleep` function by yourself. 
    await sleep(1000);

    return true;
  },
});
const consumer = new Consumer(connection, {
  queue,
  prefetch: 1,
});
await consumer.consume(async (content: any, message) => {
  // You can use the parsed content directly.
  console.log(`Content: ${content.value}`);

  // Or, you can do stuff with the `amqp.Message`
  console.log(`Buffer content:`, message.content);

  return true;
});

setTimeout(async () => {
  // Close consumer and underlying connection by passing `true`.
  await consumer.close(true);
}, 2000);
```

## TODOs

* Docs
* Tests
