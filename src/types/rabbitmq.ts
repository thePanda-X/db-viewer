export interface RabbitMQExchangeInfo {
  name: string
  type: 'direct' | 'fanout' | 'topic' | 'headers'
  durable: boolean
  autoDelete: boolean
  internal: boolean
  arguments: Record<string, unknown>
  messageStats?: {
    publishIn: number
    publishOut: number
  }
}

export interface RabbitMQQueueInfo {
  name: string
  durable: boolean
  autoDelete: boolean
  exclusive: boolean
  arguments: Record<string, unknown>
  consumers: number
  messages: number
  messagesReady: number
  messagesUnacknowledged: number
  messageStats?: {
    publishIn: number
    deliver: number
    ack: number
  }
}

export interface RabbitMQBindingInfo {
  source: string
  destination: string
  destinationType: 'queue' | 'exchange'
  routingKey: string
  arguments: Record<string, unknown>
  propertiesKey: string
}

export interface RabbitMQMessageProperties {
  contentType?: string
  contentEncoding?: string
  headers?: Record<string, unknown>
  deliveryMode?: 1 | 2
  priority?: number
  correlationId?: string
  replyTo?: string
  expiration?: string
  messageId?: string
  timestamp?: number
  type?: string
  userId?: string
  appId?: string
}

export interface RabbitMQMessageInfo {
  deliveryTag: number
  exchange: string
  routingKey: string
  redelivered: boolean
  properties: RabbitMQMessageProperties
  body: string
  bodySize: number
  bodyDecoded: unknown
}

export interface RabbitMQPublishRequest {
  exchange: string
  routingKey: string
  body: string
  contentType: string
  headers: Record<string, string>
  deliveryMode: 1 | 2
}

export interface RabbitMQClusterInfo {
  rabbitmqVersion: string
  erlangVersion: string
  clusterName: string
  node: string
}

export type RabbitMQResponse<T> =
  | { ok: true; result: T }
  | { ok: false; error: string }
