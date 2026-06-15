import { Kafka } from 'kafkajs';

const HOST = process.env.KAFKA_HOST ?? 'localhost';
const PORT = Number(process.env.KAFKA_PORT ?? '9092');
const USER = process.env.KAFKA_USER ?? '';
const PASS = process.env.KAFKA_PASS ?? '';
const CLEAR = process.env.KAFKA_CLEAR !== 'false';

const client = new Kafka({
  brokers: [`${HOST}:${PORT}`],
  ...(USER && PASS
    ? { sasl: { mechanism: 'plain', username: USER, password: PASS } }
    : {}),
  retry: { retries: 2 },
});

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

const TOPICS: Array<{
  name: string;
  numPartitions: number;
  messages: (rand: () => number) => Array<{ key: string; value: string }>;
}> = [
  {
    name: 'orders',
    numPartitions: 3,
    messages: (rand) => {
      const customers = [
        'Alice Smith',
        'Bob Jones',
        'Charlie Brown',
        'Diana Lee',
        'Eve Taylor',
      ];
      const products = [
        'Premium Widget',
        'Basic Gadget',
        'Pro Device',
        'Classic Tool',
        'Eco Kit',
        'Ultra Speaker',
        'Modern Lamp',
        'Slim Keyboard',
      ];
      const statuses = [
        'pending',
        'confirmed',
        'shipped',
        'delivered',
        'cancelled',
      ];
      const messages: Array<{ key: string; value: string }> = [];
      for (let i = 0; i < 100; i++) {
        const orderId = `ord-${String(i + 1).padStart(4, '0')}`;
        const customer = pick(customers, rand);
        const product = pick(products, rand);
        const qty = Math.floor(rand() * 5) + 1;
        const price = Math.round((rand() * 200 + 10) * 100) / 100;
        messages.push({
          key: orderId,
          value: JSON.stringify({
            orderId,
            customer,
            product,
            quantity: qty,
            total: Math.round(qty * price * 100) / 100,
            status: pick(statuses, rand),
            region: pick(
              ['US-East', 'US-West', 'EU-West', 'EU-East', 'APAC'],
              rand,
            ),
            createdAt: new Date(
              Date.now() - rand() * 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          }),
        });
      }
      return messages;
    },
  },
  {
    name: 'page_views',
    numPartitions: 2,
    messages: (rand) => {
      const pages = [
        '/home',
        '/products',
        '/cart',
        '/checkout',
        '/account',
        '/search',
        '/help',
      ];
      const referrers = [
        'google.com',
        'facebook.com',
        'twitter.com',
        'direct',
        'email',
      ];
      const devices = ['mobile', 'desktop', 'tablet'];
      const messages: Array<{ key: string; value: string }> = [];
      for (let i = 0; i < 200; i++) {
        const sessionId = `sess-${Math.floor(rand() * 10000).toString(16)}`;
        messages.push({
          key: sessionId,
          value: JSON.stringify({
            sessionId,
            page: pick(pages, rand),
            referrer: pick(referrers, rand),
            device: pick(devices, rand),
            browser: pick(['Chrome', 'Firefox', 'Safari', 'Edge'], rand),
            durationMs: Math.floor(rand() * 60000),
            timestamp: new Date(
              Date.now() - rand() * 7 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          }),
        });
      }
      return messages;
    },
  },
  {
    name: 'user_events',
    numPartitions: 3,
    messages: (rand) => {
      const eventTypes = [
        'signup',
        'login',
        'logout',
        'password_reset',
        'profile_update',
        'delete_account',
      ];
      const messages: Array<{ key: string; value: string }> = [];
      for (let i = 0; i < 150; i++) {
        const userId = `usr-${Math.floor(rand() * 500 + 1)}`;
        const event = pick(eventTypes, rand);
        messages.push({
          key: userId,
          value: JSON.stringify({
            userId,
            event,
            ip: `${Math.floor(rand() * 256)}.${Math.floor(rand() * 256)}.${Math.floor(rand() * 256)}.${Math.floor(rand() * 256)}`,
            userAgent: pick(
              [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605',
                'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148',
                'Mozilla/5.0 (Linux; Android 14) Chrome/120',
              ],
              rand,
            ),
            success: rand() > 0.1,
            timestamp: new Date(
              Date.now() - rand() * 14 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          }),
        });
      }
      return messages;
    },
  },
];

async function main() {
  const rand = rng(42);
  const admin = client.admin();

  try {
    await admin.connect();
    const existingTopics = await admin.listTopics();

    if (CLEAR) {
      const toDelete = TOPICS.map((t) => t.name).filter((n) =>
        existingTopics.includes(n),
      );
      if (toDelete.length > 0) {
        await admin.deleteTopics({ topics: toDelete });
        console.log(`  Deleted existing topics: ${toDelete.join(', ')}`);
      }
    }

    for (const topic of TOPICS) {
      await admin.createTopics({
        topics: [
          {
            topic: topic.name,
            numPartitions: topic.numPartitions,
            replicationFactor: 1,
          },
        ],
        waitForLeaders: true,
      });
      console.log(
        `  Created topic "${topic.name}" with ${topic.numPartitions} partition(s)`,
      );
    }
  } finally {
    await admin.disconnect();
  }

  let totalMessages = 0;
  for (const topic of TOPICS) {
    const producer = client.producer();
    try {
      await producer.connect();
      const msgs = topic.messages(rand);
      const batchSize = 50;
      for (let i = 0; i < msgs.length; i += batchSize) {
        const batch = msgs.slice(i, i + batchSize);
        await producer.send({
          topic: topic.name,
          messages: batch.map((m) => ({
            key: m.key,
            value: m.value,
          })),
        });
      }
      console.log(`  Produced ${msgs.length} messages to "${topic.name}"`);
      totalMessages += msgs.length;
    } finally {
      await producer.disconnect();
    }
  }

  console.log(
    `\nDone — ${totalMessages} total messages across ${TOPICS.length} topics\n`,
  );
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
