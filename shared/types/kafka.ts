export interface KafkaClusterInfo {
  brokerCount: number;
  controllerId: number;
  clusterId: string;
}

export interface KafkaTopicInfo {
  name: string;
  partitionCount: number;
  replicationFactor: number;
  isInternal: boolean;
}

export interface KafkaPartitionInfo {
  partition: number;
  leader: number;
  replicas: number[];
  isr: number[];
  beginningOffset: string;
  endOffset: string;
  messageCount: string;
}

export interface KafkaTopicMeta {
  partitions: KafkaPartitionInfo[];
  config: Record<string, string>;
}

export interface KafkaConsumerGroupInfo {
  groupId: string;
  state: string;
  members: number;
  protocolType: string;
}

export interface KafkaConsumerGroupDetail {
  groupId: string;
  state: string;
  members: number;
  topics: KafkaConsumerGroupTopic[];
}

export interface KafkaConsumerGroupTopic {
  topic: string;
  partitions: KafkaConsumerGroupPartition[];
}

export interface KafkaConsumerGroupPartition {
  partition: number;
  currentOffset: string;
  endOffset: string;
  lag: string;
  consumerId: string;
  host: string;
}

export interface KafkaMessage {
  partition: number;
  offset: string;
  timestamp: string;
  key: string | null;
  value: string | null;
  headers: Record<string, string>;
}

export interface KafkaConsumeResult {
  messages: KafkaMessage[];
  hasMore: boolean;
}
