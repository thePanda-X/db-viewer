import { registerHandler } from '../handlerRegistry';
import {
  ping as kafkaPing,
  listTopics as kafkaListTopics,
  getTopicMeta as kafkaGetTopicMeta,
  listConsumerGroups as kafkaListConsumerGroups,
  getConsumerGroupDetail as kafkaGetConsumerGroupDetail,
  consumeMessages as kafkaConsumeMessages,
  disconnect as kafkaDisconnect,
} from '../kafka';
import type { KafkaConfig } from '../../shared/types/connection';

type KafkaInvokeArgs = {
  connectionId: string;
  config: KafkaConfig;
};

export function registerKafkaHandlers(): void {
  registerHandler({
    channel: 'kafka:ping',
    handler: (args: KafkaInvokeArgs) =>
      kafkaPing(args.connectionId, args.config),
    errorMode: 'okResult',
  });

  registerHandler({
    channel: 'kafka:listTopics',
    handler: (args: KafkaInvokeArgs) =>
      kafkaListTopics(args.connectionId, args.config),
    errorMode: 'okResult',
  });

  registerHandler({
    channel: 'kafka:getTopicMeta',
    handler: (args: KafkaInvokeArgs & { topic: string }) =>
      kafkaGetTopicMeta(args.connectionId, args.config, args.topic),
    errorMode: 'okResult',
  });

  registerHandler({
    channel: 'kafka:listConsumerGroups',
    handler: (args: KafkaInvokeArgs) =>
      kafkaListConsumerGroups(args.connectionId, args.config),
    errorMode: 'okResult',
  });

  registerHandler({
    channel: 'kafka:getConsumerGroupDetail',
    handler: (args: KafkaInvokeArgs & { groupId: string }) =>
      kafkaGetConsumerGroupDetail(args.connectionId, args.config, args.groupId),
    errorMode: 'okResult',
  });

  registerHandler({
    channel: 'kafka:consumeMessages',
    handler: (
      args: KafkaInvokeArgs & {
        topic: string;
        partition: number;
        offset: string;
        limit: number;
      },
    ) =>
      kafkaConsumeMessages(
        args.connectionId,
        args.config,
        args.topic,
        args.partition,
        args.offset,
        args.limit,
      ),
    errorMode: 'okResult',
  });

  registerHandler({
    channel: 'kafka:disconnect',
    handler: (args: { connectionId: string }) => {
      kafkaDisconnect(args.connectionId);
      return { ok: true };
    },
    errorMode: 'raw',
  });
}
