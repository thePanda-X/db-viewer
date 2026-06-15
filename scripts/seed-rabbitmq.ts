import amqplib from 'amqplib';

const HOST = process.env.RMQ_HOST ?? 'localhost';
const PORT = Number(process.env.RMQ_PORT ?? '5672');
const USER = process.env.RMQ_USER ?? 'guest';
const PASS = process.env.RMQ_PASS ?? 'guest';
const VHOST = process.env.RMQ_VHOST ?? '/';
const CLEAR = process.env.RMQ_CLEAR !== 'false';

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

interface ExchangeDef {
  name: string;
  type: 'direct' | 'fanout' | 'topic' | 'headers';
  durable: boolean;
}

interface QueueDef {
  name: string;
  exchange: string;
  routingKey: string;
  durable: boolean;
}

interface MessageDef {
  exchange: string;
  routingKey: string;
  body: unknown;
  contentType: string;
}

const EXCHANGES: ExchangeDef[] = [
  { name: 'orders', type: 'topic', durable: true },
  { name: 'notifications', type: 'fanout', durable: true },
  { name: 'tasks', type: 'direct', durable: true },
];

const QUEUES: QueueDef[] = [
  {
    name: 'orders.new',
    exchange: 'orders',
    routingKey: 'order.created',
    durable: true,
  },
  {
    name: 'orders.cancelled',
    exchange: 'orders',
    routingKey: 'order.cancelled',
    durable: true,
  },
  {
    name: 'orders.shipped',
    exchange: 'orders',
    routingKey: 'order.shipped',
    durable: true,
  },
  {
    name: 'notifications.email',
    exchange: 'notifications',
    routingKey: '',
    durable: true,
  },
  {
    name: 'notifications.sms',
    exchange: 'notifications',
    routingKey: '',
    durable: true,
  },
  {
    name: 'tasks.urgent',
    exchange: 'tasks',
    routingKey: 'urgent',
    durable: true,
  },
  {
    name: 'tasks.default',
    exchange: 'tasks',
    routingKey: 'default',
    durable: true,
  },
];

const EVENTS = ['order.created', 'order.cancelled', 'order.shipped'];
const CUSTOMERS = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
const PRODUCTS = [
  'Widget Pro',
  'Basic Gadget',
  'Ultra Device',
  'Classic Tool',
  'Eco Kit',
];
const AMOUNTS = [29.99, 49.99, 99.99, 149.99, 249.99];
const URGENT_TASKS = [
  'Restart database server',
  'Deploy security patch',
  'Investigate payment failure',
  'Scale worker pool',
  'Rotate API keys',
];
const DEFAULT_TASKS = [
  'Clean up old logs',
  'Update documentation',
  'Run weekly report',
  'Sync user data',
  'Backup configuration',
];

function generateOrder(rand: () => number) {
  const event = pick(EVENTS, rand);
  return {
    exchange: 'orders',
    routingKey: event,
    body: {
      orderId: `ord_${Math.floor(rand() * 1000000)}`,
      customer: pick(CUSTOMERS, rand),
      product: pick(PRODUCTS, rand),
      amount: pick(AMOUNTS, rand),
      status: event.split('.').pop(),
      timestamp: new Date(
        Date.now() - rand() * 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    },
    contentType: 'application/json',
  };
}

function generateNotification(rand: () => number) {
  const types: Array<'email' | 'sms'> = ['email', 'sms'];
  const type = pick(types, rand);
  return {
    exchange: 'notifications',
    routingKey: '',
    body: {
      id: `notif_${Math.floor(rand() * 1000000)}`,
      type,
      recipient: `${pick(CUSTOMERS, rand).toLowerCase()}@example.com`,
      subject: pick(
        [
          'Order confirmation',
          'Shipping update',
          'Welcome to our service',
          'Password reset request',
          'Weekly newsletter',
        ],
        rand,
      ),
      body: 'This is a sample notification message.',
      timestamp: new Date(
        Date.now() - rand() * 3 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    },
    contentType: 'application/json',
  };
}

function generateTask(rand: () => number) {
  const isUrgent = rand() > 0.6;
  return {
    exchange: 'tasks',
    routingKey: isUrgent ? 'urgent' : 'default',
    body: {
      taskId: `task_${Math.floor(rand() * 1000000)}`,
      title: isUrgent ? pick(URGENT_TASKS, rand) : pick(DEFAULT_TASKS, rand),
      priority: isUrgent ? 'high' : 'low',
      assignee: pick(CUSTOMERS, rand),
      createdAt: new Date(
        Date.now() - rand() * 14 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    },
    contentType: 'application/json',
  };
}

function generateMessages(rand: () => number): MessageDef[] {
  const messages: MessageDef[] = [];
  for (let i = 0; i < 20; i++) messages.push(generateOrder(rand));
  for (let i = 0; i < 15; i++) messages.push(generateNotification(rand));
  for (let i = 0; i < 10; i++) messages.push(generateTask(rand));
  return messages;
}

async function main() {
  const rand = rng(42);
  const url = `amqp://${USER}:${PASS}@${HOST}:${PORT}/${VHOST}`;
  const conn = await amqplib.connect(url);
  const channel = await conn.createChannel();

  if (CLEAR) {
    for (const q of QUEUES) {
      try {
        await channel.deleteQueue(q.name);
        console.log(`  Deleted queue "${q.name}"`);
      } catch {
        // queue may not exist
      }
    }
    for (const ex of EXCHANGES) {
      try {
        await channel.deleteExchange(ex.name);
        console.log(`  Deleted exchange "${ex.name}"`);
      } catch {
        // exchange may not exist
      }
    }
  }

  for (const ex of EXCHANGES) {
    await channel.assertExchange(ex.name, ex.type, { durable: ex.durable });
    console.log(`  Asserted exchange "${ex.name}" (${ex.type})`);
  }

  for (const q of QUEUES) {
    await channel.assertQueue(q.name, { durable: q.durable });
    await channel.bindQueue(q.name, q.exchange, q.routingKey);
    console.log(
      `  Asserted queue "${q.name}" bound to "${q.exchange}" with key "${q.routingKey}"`,
    );
  }

  const messages = generateMessages(rand);
  let published = 0;
  for (const msg of messages) {
    const body = Buffer.from(JSON.stringify(msg.body), 'utf8');
    channel.publish(msg.exchange, msg.routingKey, body, {
      contentType: msg.contentType,
      deliveryMode: 2,
    });
    published++;
  }

  console.log(`  Published ${published} messages`);

  await channel.close();
  await conn.close();
  console.log(
    `\nDone — ${EXCHANGES.length} exchanges, ${QUEUES.length} queues, ${published} messages\n`,
  );
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
