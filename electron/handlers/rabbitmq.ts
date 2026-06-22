import { registerHandler } from '../handlerRegistry';
import {
  disconnect as rmqDisconnect,
  getQueueMessages as rmqGetQueueMessages,
  listBindings as rmqListBindings,
  listExchanges as rmqListExchanges,
  listQueues as rmqListQueues,
  ping as rmqPing,
  publishMessage as rmqPublishMessage,
  purgeQueue as rmqPurgeQueue,
  deleteQueueFn as rmqDeleteQueue,
} from '../rabbitmq';
import type { RabbitMQConfig } from '../../src/types/connection';
import type { RabbitMQPublishRequest } from '../../src/types/rabbitmq';

type RabbitMQInvokeArgs = {
  connectionId: string;
  config: RabbitMQConfig;
};

export function registerRabbitmqHandlers(): void {
  registerHandler({
    channel: 'rabbitmq:ping',
    handler: (args: RabbitMQInvokeArgs) =>
      rmqPing(args.connectionId, args.config),
    errorMode: 'okResult',
  });

  registerHandler({
    channel: 'rabbitmq:listExchanges',
    handler: (args: RabbitMQInvokeArgs) =>
      rmqListExchanges(args.connectionId, args.config),
    errorMode: 'okResult',
  });

  registerHandler({
    channel: 'rabbitmq:listQueues',
    handler: (args: RabbitMQInvokeArgs) =>
      rmqListQueues(args.connectionId, args.config),
    errorMode: 'okResult',
  });

  registerHandler({
    channel: 'rabbitmq:listBindings',
    handler: (
      args: RabbitMQInvokeArgs & { exchange: string; queue?: string },
    ) =>
      rmqListBindings(
        args.connectionId,
        args.config,
        args.exchange,
        args.queue,
      ),
    errorMode: 'okResult',
  });

  registerHandler({
    channel: 'rabbitmq:getQueueMessages',
    handler: (args: RabbitMQInvokeArgs & { queue: string; count: number }) =>
      rmqGetQueueMessages(
        args.connectionId,
        args.config,
        args.queue,
        args.count,
      ),
    errorMode: 'okResult',
  });

  registerHandler({
    channel: 'rabbitmq:purgeQueue',
    handler: (args: RabbitMQInvokeArgs & { queue: string }) =>
      rmqPurgeQueue(args.connectionId, args.config, args.queue),
    errorMode: 'okOnly',
  });

  registerHandler({
    channel: 'rabbitmq:deleteQueue',
    handler: (args: RabbitMQInvokeArgs & { queue: string }) =>
      rmqDeleteQueue(args.connectionId, args.config, args.queue),
    errorMode: 'okOnly',
  });

  registerHandler({
    channel: 'rabbitmq:publishMessage',
    handler: (args: RabbitMQInvokeArgs & { request: RabbitMQPublishRequest }) =>
      rmqPublishMessage(args.connectionId, args.config, args.request),
    errorMode: 'okOnly',
  });

  registerHandler({
    channel: 'rabbitmq:disconnect',
    handler: (args: { connectionId: string }) => {
      rmqDisconnect(args.connectionId);
      return { ok: true };
    },
    errorMode: 'raw',
  });
}
