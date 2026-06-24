import amqplib from 'amqplib';
import type { RabbitMQConfig } from '../shared/types/connection';
import type {
  RabbitMQExchangeInfo,
  RabbitMQQueueInfo,
  RabbitMQBindingInfo,
  RabbitMQMessageInfo,
  RabbitMQPublishRequest,
  RabbitMQClusterInfo,
} from '../shared/types/rabbitmq';

const models = new Map<string, amqplib.ChannelModel>();
const channels = new Map<string, amqplib.Channel>();

function amqpUrl(config: RabbitMQConfig): string {
  const protocol = config.tls ? 'amqps' : 'amqp';
  const vhost = encodeURIComponent(config.vhost);
  return `${protocol}://${config.username}:${config.password}@${config.host}:${config.port}/${vhost}?heartbeat=30`;
}

function mgmtBaseUrl(config: RabbitMQConfig): string {
  const protocol = config.tls ? 'https' : 'http';
  return `${protocol}://${config.host}:${config.managementPort}/api`;
}

function mgmtAuth(config: RabbitMQConfig): string {
  return Buffer.from(`${config.username}:${config.password}`).toString(
    'base64',
  );
}

async function mgmtFetch<T>(config: RabbitMQConfig, path: string): Promise<T> {
  const url = `${mgmtBaseUrl(config)}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${mgmtAuth(config)}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

async function getModel(
  connectionId: string,
  config: RabbitMQConfig,
): Promise<amqplib.ChannelModel> {
  const existing = models.get(connectionId);
  if (existing) return existing;

  const model = await amqplib.connect(amqpUrl(config), {
    timeout: 10_000,
  });
  model.on('error', (err: Error) => {
    console.error(`[rabbitmq] model error for ${connectionId}:`, err.message);
  });
  model.on('close', () => {
    channels.delete(connectionId);
    models.delete(connectionId);
  });
  models.set(connectionId, model);
  return model;
}

async function getChannel(
  connectionId: string,
  config: RabbitMQConfig,
): Promise<amqplib.Channel> {
  const existing = channels.get(connectionId);
  if (existing) return existing;
  const model = await getModel(connectionId, config);
  const channel = await model.createChannel();
  channels.set(connectionId, channel);
  return channel;
}

function dropConnection(connectionId: string): void {
  const channel = channels.get(connectionId);
  if (channel) {
    try {
      void channel.close();
    } catch {
      /* ignore */
    }
    channels.delete(connectionId);
  }
  const model = models.get(connectionId);
  if (model) {
    try {
      void model.close();
    } catch {
      /* ignore */
    }
    models.delete(connectionId);
  }
}

export async function ping(
  connectionId: string,
  config: RabbitMQConfig,
): Promise<RabbitMQClusterInfo> {
  const model = await getModel(connectionId, config);
  const serverProps = model.connection.serverProperties;
  dropConnection(connectionId);

  let clusterInfo: {
    rabbitmq_version?: string;
    erlang_version?: string;
    cluster_name?: string;
    node?: string;
  } = {};
  try {
    clusterInfo = await mgmtFetch<typeof clusterInfo>(config, '/overview');
  } catch {
    // Management API not available; return what we know from AMQP
  }

  return {
    rabbitmqVersion:
      clusterInfo.rabbitmq_version ?? serverProps.product ?? 'unknown',
    erlangVersion: clusterInfo.erlang_version ?? 'unknown',
    clusterName: clusterInfo.cluster_name ?? 'default',
    node: clusterInfo.node ?? 'unknown',
  };
}

export async function listExchanges(
  _connectionId: string,
  config: RabbitMQConfig,
): Promise<RabbitMQExchangeInfo[]> {
  const vhost = encodeURIComponent(config.vhost);
  const exchanges = await mgmtFetch<Record<string, unknown>[]>(
    config,
    `/exchanges/${vhost}`,
  );
  return exchanges.map((e) => ({
    name: e.name as string,
    type: (e.type ?? 'direct') as RabbitMQExchangeInfo['type'],
    durable: e.durable as boolean,
    autoDelete: e.auto_delete as boolean,
    internal: e.internal as boolean,
    arguments: (e.arguments ?? {}) as Record<string, unknown>,
    messageStats: e.message_stats
      ? {
          publishIn:
            (e.message_stats as Record<string, number>).publish_in ?? 0,
          publishOut:
            (e.message_stats as Record<string, number>).publish_out ?? 0,
        }
      : undefined,
  }));
}

export async function listQueues(
  _connectionId: string,
  config: RabbitMQConfig,
): Promise<RabbitMQQueueInfo[]> {
  const vhost = encodeURIComponent(config.vhost);
  const queues = await mgmtFetch<Record<string, unknown>[]>(
    config,
    `/queues/${vhost}`,
  );
  return queues.map((q) => ({
    name: q.name as string,
    durable: q.durable as boolean,
    autoDelete: q.auto_delete as boolean,
    exclusive: q.exclusive as boolean,
    arguments: (q.arguments ?? {}) as Record<string, unknown>,
    consumers: (q.consumers as number) ?? 0,
    messages: (q.messages as number) ?? 0,
    messagesReady: (q.messages_ready as number) ?? 0,
    messagesUnacknowledged: (q.messages_unacknowledged as number) ?? 0,
    messageStats: q.message_stats
      ? {
          publishIn:
            (q.message_stats as Record<string, number>).publish_in ?? 0,
          deliver: (q.message_stats as Record<string, number>).deliver ?? 0,
          ack: (q.message_stats as Record<string, number>).ack ?? 0,
        }
      : undefined,
  }));
}

export async function listBindings(
  _connectionId: string,
  config: RabbitMQConfig,
  exchange: string,
  queue?: string,
): Promise<RabbitMQBindingInfo[]> {
  const vhost = encodeURIComponent(config.vhost);
  const ex = encodeURIComponent(exchange);
  if (queue) {
    const q = encodeURIComponent(queue);
    const bindings = await mgmtFetch<Record<string, unknown>[]>(
      config,
      `/bindings/${vhost}/e/${ex}/q/${q}`,
    );
    return bindings.map((b) => ({
      source: b.source as string,
      destination: b.destination as string,
      destinationType: (b.destination_type ?? 'queue') as 'queue' | 'exchange',
      routingKey: b.routing_key as string,
      arguments: (b.arguments ?? {}) as Record<string, unknown>,
      propertiesKey: b.properties_key as string,
    }));
  }
  const bindings = await mgmtFetch<Record<string, unknown>[]>(
    config,
    `/exchanges/${vhost}/${ex}/bindings/source`,
  );
  return bindings.map((b) => ({
    source: b.source as string,
    destination: b.destination as string,
    destinationType: (b.destination_type ?? 'queue') as 'queue' | 'exchange',
    routingKey: b.routing_key as string,
    arguments: (b.arguments ?? {}) as Record<string, unknown>,
    propertiesKey: b.properties_key as string,
  }));
}

export async function getQueueMessages(
  connectionId: string,
  config: RabbitMQConfig,
  queue: string,
  count: number,
): Promise<RabbitMQMessageInfo[]> {
  const channel = await getChannel(connectionId, config);
  await channel.checkQueue(queue);
  const messages: RabbitMQMessageInfo[] = [];
  const maxMessages = Math.min(count, 100);

  for (let i = 0; i < maxMessages; i++) {
    const msg = await channel.get(queue, { noAck: false });
    if (!msg) break;

    let bodyDecoded: unknown = msg.content.toString('utf8');
    try {
      bodyDecoded = JSON.parse(bodyDecoded as string);
    } catch {
      // Not JSON, keep as string
    }

    messages.push({
      deliveryTag: msg.fields.deliveryTag,
      exchange: msg.fields.exchange,
      routingKey: msg.fields.routingKey,
      redelivered: msg.fields.redelivered,
      properties: {
        contentType: msg.properties.contentType,
        contentEncoding: msg.properties.contentEncoding,
        headers: msg.properties.headers as Record<string, unknown> | undefined,
        deliveryMode: msg.properties.deliveryMode as 1 | 2 | undefined,
        priority: msg.properties.priority,
        correlationId: msg.properties.correlationId,
        replyTo: msg.properties.replyTo,
        expiration: msg.properties.expiration,
        messageId: msg.properties.messageId,
        timestamp: msg.properties.timestamp,
        type: msg.properties.type,
        userId: msg.properties.userId,
        appId: msg.properties.appId,
      },
      body: msg.content.toString('base64'),
      bodySize: msg.content.length,
      bodyDecoded,
    });

    channel.nack(msg, false, true);
  }

  return messages;
}

export async function purgeQueue(
  connectionId: string,
  config: RabbitMQConfig,
  queue: string,
): Promise<void> {
  const channel = await getChannel(connectionId, config);
  await channel.purgeQueue(queue);
}

export async function deleteQueueFn(
  connectionId: string,
  config: RabbitMQConfig,
  queue: string,
): Promise<void> {
  const channel = await getChannel(connectionId, config);
  await channel.deleteQueue(queue);
}

export async function publishMessage(
  connectionId: string,
  config: RabbitMQConfig,
  request: RabbitMQPublishRequest,
): Promise<void> {
  const channel = await getChannel(connectionId, config);
  const headers: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(request.headers)) {
    if (v) headers[k] = v;
  }
  channel.publish(
    request.exchange,
    request.routingKey,
    Buffer.from(request.body, 'utf8'),
    {
      contentType: request.contentType || 'text/plain',
      deliveryMode: request.deliveryMode,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    },
  );
}

export function disconnect(connectionId: string): void {
  dropConnection(connectionId);
}
