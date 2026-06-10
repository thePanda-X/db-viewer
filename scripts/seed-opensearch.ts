import { Client } from '@opensearch-project/opensearch'

const HOST = process.env.OS_HOST ?? 'localhost'
const PORT = Number(process.env.OS_PORT ?? '9200')
const USER = process.env.OS_USER ?? ''
const PASS = process.env.OS_PASS ?? ''
const SSL = process.env.OS_SSL === 'true'
const CLEAR = process.env.OS_CLEAR !== 'false'

const client = new Client({
  node: `${SSL ? 'https' : 'http'}://${HOST}:${PORT}`,
  auth: USER ? { username: USER, password: PASS } : undefined,
  ssl: SSL ? { rejectUnauthorized: false } : undefined,
})

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)]
}

function id(rand: () => number): string {
  return 'xxxxxxxxxxxxxxxx'.replace(/x/g, () => Math.floor(rand() * 16).toString(16))
}

const INDEXES: Array<{
  name: string
  mapping: Record<string, unknown>
  docs: (rand: () => number) => Record<string, unknown>[]
}> = [
  {
    name: 'products',
    mapping: {
      properties: {
        name: { type: 'text' },
        description: { type: 'text' },
        price: { type: 'float' },
        category: { type: 'keyword' },
        tags: { type: 'keyword' },
        inStock: { type: 'boolean' },
        createdAt: { type: 'date' },
      },
    },
    docs: (rand) => {
      const categories = ['Electronics', 'Clothing', 'Home', 'Books', 'Sports']
      const prefixes = [
        'Premium', 'Basic', 'Pro', 'Ultra', 'Classic', 'Modern', 'Eco',
      ]
      const nouns = [
        'Widget', 'Gadget', 'Device', 'Tool', 'Kit', 'Set', 'Pack',
        'Speaker', 'Headphones', 'Keyboard', 'Mouse', 'Monitor',
        'Shirt', 'Jacket', 'Sneakers', 'Watch', 'Lamp', 'Chair',
      ]
      const tags = ['new', 'sale', 'popular', 'limited', 'eco', 'premium']
      const count = 50
      const docs: Record<string, unknown>[] = []
      for (let i = 0; i < count; i++) {
        const name = `${pick(prefixes, rand)} ${pick(nouns, rand)}`
        docs.push({
          name,
          description: `A high-quality ${name.toLowerCase()} designed for everyday use.`,
          price: Math.round((rand() * 500 + 5) * 100) / 100,
          category: pick(categories, rand),
          tags: [pick(tags, rand), pick(tags, rand)].filter((v, i, a) => a.indexOf(v) === i),
          inStock: rand() > 0.2,
          createdAt: new Date(Date.now() - rand() * 365 * 24 * 60 * 60 * 1000).toISOString(),
        })
      }
      return docs
    },
  },
  {
    name: 'logs',
    mapping: {
      properties: {
        level: { type: 'keyword' },
        message: { type: 'text' },
        service: { type: 'keyword' },
        host: { type: 'keyword' },
        timestamp: { type: 'date' },
        responseTime: { type: 'integer' },
        statusCode: { type: 'integer' },
      },
    },
    docs: (rand) => {
      const levels = ['info', 'warn', 'error', 'debug']
      const services = ['api-gateway', 'auth-service', 'payment-service', 'search-service', 'notification-service']
      const hosts = ['web-01', 'web-02', 'worker-01', 'db-primary']
      const messages: Record<string, string[]> = {
        info: [
          'Request processed successfully',
          'Cache hit for key {}',
          'User session refreshed',
          'Background job completed',
          'Health check passed',
        ],
        warn: [
          'High memory usage detected',
          'Slow query ({}ms) exceeded threshold',
          'Rate limit approaching for IP {}',
          'Deprecated API endpoint called',
        ],
        error: [
          'Connection pool exhausted',
          'Failed to process payment: {}',
          'Database timeout after {}ms',
          'Unhandled exception in request handler',
        ],
        debug: [
          'Entering function {} with args {}',
          'Response payload: {}',
          'Cache miss for key {}',
        ],
      }
      const count = 200
      const docs: Record<string, unknown>[] = []
      for (let i = 0; i < count; i++) {
        const level = pick(levels, rand)
        const msg = pick(
          messages[level as keyof typeof messages] ?? messages.info,
          rand,
        )
        docs.push({
          level,
          message: msg,
          service: pick(services, rand),
          host: pick(hosts, rand),
          timestamp: new Date(Date.now() - rand() * 7 * 24 * 60 * 60 * 1000).toISOString(),
          responseTime: Math.floor(rand() * 2000),
          statusCode: pick([200, 201, 204, 301, 400, 401, 403, 404, 500, 502, 503], rand),
        })
      }
      return docs
    },
  },
  {
    name: 'users',
    mapping: {
      properties: {
        name: { type: 'text' },
        email: { type: 'keyword' },
        role: { type: 'keyword' },
        age: { type: 'integer' },
        city: { type: 'keyword' },
        country: { type: 'keyword' },
        registeredAt: { type: 'date' },
        active: { type: 'boolean' },
      },
    },
    docs: (rand) => {
      const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Hank', 'Ivy', 'Jack']
      const lastNames = ['Smith', 'Jones', 'Brown', 'Taylor', 'Wilson', 'Lee', 'Miller', 'Davis', 'Garcia', 'Martinez']
      const roles = ['admin', 'editor', 'viewer', 'moderator']
      const cities = ['New York', 'London', 'Tokyo', 'Berlin', 'Paris', 'Sydney', 'Toronto', 'Mumbai', 'Seoul', 'São Paulo']
      const countries = ['USA', 'UK', 'Japan', 'Germany', 'France', 'Australia', 'Canada', 'India', 'South Korea', 'Brazil']
      const count = 30
      const docs: Record<string, unknown>[] = []
      for (let i = 0; i < count; i++) {
        const first = pick(firstNames, rand)
        const last = pick(lastNames, rand)
        docs.push({
          name: `${first} ${last}`,
          email: `${first.toLowerCase()}.${last.toLowerCase()}${Math.floor(rand() * 100)}@example.com`,
          role: pick(roles, rand),
          age: Math.floor(rand() * 50 + 18),
          city: pick(cities, rand),
          country: pick(countries, rand),
          registeredAt: new Date(Date.now() - rand() * 3 * 365 * 24 * 60 * 60 * 1000).toISOString(),
          active: rand() > 0.15,
        })
      }
      return docs
    },
  },
]

async function main() {
  const rand = rng(42)

  if (CLEAR) {
    for (const idx of INDEXES) {
      const exists = await client.indices.exists({ index: idx.name })
      if (exists.body) {
        await client.indices.delete({ index: idx.name })
        console.log(`  Deleted existing index "${idx.name}"`)
      }
    }
  }

  let totalDocs = 0
  for (const idx of INDEXES) {
    await client.indices.create({ index: idx.name, body: { mappings: idx.mapping } })
    const docs = idx.docs(rand)
    const body = docs.flatMap((doc) => [{ index: { _index: idx.name, _id: id(rand) } }, doc])
    const res = await client.bulk({ body })
    if (res.body.errors) {
      console.error(`  Errors while indexing into "${idx.name}"`)
      const errored = (res.body.items as Record<string, unknown>[]).filter(
        (item) => (item.index as Record<string, unknown>)?.error,
      )
      for (const e of errored.slice(0, 5)) {
        console.error(`    `, JSON.stringify(e))
      }
    } else {
      console.log(`  Indexed ${docs.length} docs into "${idx.name}"`)
    }
    totalDocs += docs.length
  }

  const health = await client.cluster.health()
  console.log(`\nDone — ${totalDocs} total docs across ${INDEXES.length} indices`)
  console.log(`Cluster health: ${health.body.status}\n`)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
