import { Kafka, logLevel } from 'kafkajs';
import type { KafkaConfig } from '../src/types/connection';
import type {
  KafkaClusterInfo,
  KafkaTopicInfo,
  KafkaTopicMeta,
  KafkaPartitionInfo,
  KafkaConsumerGroupInfo,
  KafkaConsumerGroupDetail,
  KafkaConsumerGroupTopic,
  KafkaConsumerGroupPartition,
  KafkaMessage,
  KafkaConsumeResult,
} from '../src/types/kafka';

const clients = new Map<string, Kafka>();

const RESOURCE_TYPE_TOPIC = 2;

function createClient(_connectionId: string, config: KafkaConfig): Kafka {
  const ssl = config.tls ? true : undefined;
  const sasl =
    config.username && config.password
      ? {
          mechanism: 'plain' as const,
          username: config.username,
          password: config.password,
        }
      : undefined;

  const client = new Kafka({
    brokers: [`${config.host}:${config.port}`],
    ssl,
    sasl,
    logLevel: logLevel.WARN,
    retry: {
      retries: 2,
      initialRetryTime: 300,
      maxRetryTime: 3000,
    },
    connectionTimeout: 10_000,
    requestTimeout: 30_000,
  });

  return client;
}

function getClient(connectionId: string, config: KafkaConfig): Kafka {
  const key = connectionId;
  const existing = clients.get(key);
  if (existing) return existing;
  const client = createClient(connectionId, config);
  clients.set(key, client);
  return client;
}

export async function ping(
  connectionId: string,
  config: KafkaConfig,
): Promise<KafkaClusterInfo> {
  const client = getClient(connectionId, config);
  const admin = client.admin();
  try {
    await admin.connect();
    const metadata = await admin.describeCluster();
    return {
      brokerCount: metadata.brokers.length,
      controllerId: metadata.controller ?? -1,
      clusterId: metadata.clusterId,
    };
  } finally {
    await admin.disconnect();
  }
}

export async function listTopics(
  connectionId: string,
  config: KafkaConfig,
): Promise<KafkaTopicInfo[]> {
  const client = getClient(connectionId, config);
  const admin = client.admin();
  try {
    await admin.connect();
    const metadata = await admin.fetchTopicMetadata();
    return metadata.topics.map((t) => ({
      name: t.name,
      partitionCount: t.partitions.length,
      replicationFactor: t.partitions[0]?.replicas.length ?? 0,
      isInternal: false,
    }));
  } finally {
    await admin.disconnect();
  }
}

export async function getTopicMeta(
  connectionId: string,
  config: KafkaConfig,
  topic: string,
): Promise<KafkaTopicMeta> {
  const client = getClient(connectionId, config);
  const admin = client.admin();
  try {
    await admin.connect();

    const [topicMetadata, topicOffsets, beginningOffsets] = await Promise.all([
      admin.fetchTopicMetadata({ topics: [topic] }),
      admin.fetchTopicOffsets(topic),
      admin
        .fetchTopicOffsetsByTimestamp(topic, 0)
        .catch(() => admin.fetchTopicOffsets(topic)),
    ]);

    const topicData = topicMetadata.topics[0];
    if (!topicData) throw new Error(`Topic ${topic} not found`);

    const configMap: Record<string, string> = {};
    try {
      const configs = await admin.describeConfigs({
        resources: [
          {
            type: RESOURCE_TYPE_TOPIC,
            name: topic,
            configNames: [] as string[],
          },
        ],
        includeSynonyms: false,
      });
      const configResource = configs.resources?.[0];
      if (configResource?.configEntries) {
        for (const entry of configResource.configEntries as Array<{
          configName: string;
          configValue: string;
        }>) {
          configMap[entry.configName] = entry.configValue;
        }
      }
    } catch {
      // config fetch is optional
    }

    const endOffsetMap = new Map<number, string>();
    for (const o of topicOffsets) {
      endOffsetMap.set(o.partition, String(o.offset));
    }
    const beginOffsetMap = new Map<number, string>();
    for (const o of beginningOffsets) {
      beginOffsetMap.set(o.partition, String(o.offset));
    }

    const partitions: KafkaPartitionInfo[] = topicData.partitions.map((p) => {
      const beginning = beginOffsetMap.get(p.partitionId) ?? '0';
      const end = endOffsetMap.get(p.partitionId) ?? '0';
      let messageCount = '0';
      try {
        messageCount = String(BigInt(end) - BigInt(beginning));
      } catch {
        // non-numeric offset
      }
      return {
        partition: p.partitionId,
        leader: p.leader,
        replicas: p.replicas,
        isr: p.isr,
        beginningOffset: beginning,
        endOffset: end,
        messageCount,
      };
    });

    return { partitions, config: configMap };
  } finally {
    await admin.disconnect();
  }
}

export async function listConsumerGroups(
  connectionId: string,
  config: KafkaConfig,
): Promise<KafkaConsumerGroupInfo[]> {
  const client = getClient(connectionId, config);
  const admin = client.admin();
  try {
    await admin.connect();
    const result = await admin.listGroups();
    return result.groups.map((g) => ({
      groupId: g.groupId,
      state: '',
      members: 0,
      protocolType: g.protocolType,
    }));
  } finally {
    await admin.disconnect();
  }
}

export async function getConsumerGroupDetail(
  connectionId: string,
  config: KafkaConfig,
  groupId: string,
): Promise<KafkaConsumerGroupDetail> {
  const client = getClient(connectionId, config);
  const admin = client.admin();
  try {
    await admin.connect();
    const {
      groups: [groupDescription],
    } = await admin.describeGroups([groupId]);
    if (!groupDescription)
      throw new Error(`Consumer group ${groupId} not found`);

    const groupOffsets = await admin.fetchOffsets({ groupId });

    const topicsMap = new Map<string, KafkaConsumerGroupPartition[]>();
    for (const offset of groupOffsets) {
      const topicName = offset.topic;
      if (!topicsMap.has(topicName)) topicsMap.set(topicName, []);
      for (const p of offset.partitions) {
        topicsMap.get(topicName)!.push({
          partition: p.partition,
          currentOffset: String(p.offset),
          endOffset: '-1',
          lag: '-1',
          consumerId: '-',
          host: '-',
        });
      }
    }

    const topicNames = Array.from(topicsMap.keys());
    if (topicNames.length > 0) {
      const topicOffsets = await Promise.all(
        topicNames.map((t) => admin.fetchTopicOffsets(t)),
      );
      for (let i = 0; i < topicNames.length; i++) {
        const endOffsetMap = new Map<number, string>();
        for (const o of topicOffsets[i]) {
          endOffsetMap.set(o.partition, String(o.offset));
        }
        const partitions = topicsMap.get(topicNames[i])!;
        for (const p of partitions) {
          const end = endOffsetMap.get(p.partition) ?? '-1';
          p.endOffset = end;
          if (p.currentOffset !== '-1' && end !== '-1') {
            try {
              p.lag = String(BigInt(end) - BigInt(p.currentOffset));
            } catch {
              p.lag = '-1';
            }
          }
        }
      }
    }

    const topics: KafkaConsumerGroupTopic[] = topicNames.map((t) => ({
      topic: t,
      partitions: topicsMap.get(t)!,
    }));

    return {
      groupId,
      state: groupDescription.state ?? 'Unknown',
      members: groupDescription.members?.length ?? 0,
      topics,
    };
  } finally {
    await admin.disconnect();
  }
}

export async function consumeMessages(
  connectionId: string,
  config: KafkaConfig,
  topic: string,
  partition: number,
  offset: string,
  limit: number,
): Promise<KafkaConsumeResult> {
  const client = getClient(connectionId, config);
  const groupId = `db-vwr-viewer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const consumer = client.consumer({ groupId });
  const messages: KafkaMessage[] = [];

  try {
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: true });

    let settled = false;
    let resolveDone: (() => void) | null = null;
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolveDone?.();
      }
    }, 8000);

    let fetched = 0;

    await consumer.run({
      eachMessage: async ({ message, partition: msgPartition }) => {
        if (settled) return;
        if (msgPartition !== partition) return;

        const msgOffset = String(message.offset);
        if (BigInt(msgOffset) < BigInt(offset)) return;

        const headers: Record<string, string> = {};
        if (message.headers) {
          for (const [key, value] of Object.entries(message.headers)) {
            headers[key] = value
              ? Buffer.from(value as Buffer).toString('utf8')
              : '';
          }
        }

        messages.push({
          partition: msgPartition,
          offset: msgOffset,
          timestamp: String(message.timestamp),
          key: message.key ? Buffer.from(message.key).toString('utf8') : null,
          value: message.value
            ? Buffer.from(message.value).toString('utf8')
            : null,
          headers,
        });

        fetched++;
        if (fetched >= limit && !settled) {
          settled = true;
          clearTimeout(timeout);
          resolveDone?.();
        }
      },
    });

    await done;
    clearTimeout(timeout);

    return {
      messages,
      hasMore: fetched >= limit,
    };
  } finally {
    try {
      await consumer.disconnect();
    } catch {
      // cleanup
    }
    try {
      const admin = client.admin();
      await admin.connect();
      await admin.deleteGroups([groupId]).catch(() => {});
      await admin.disconnect();
    } catch {
      // cleanup
    }
  }
}

export function disconnect(connectionId: string): void {
  clients.delete(connectionId);
}
