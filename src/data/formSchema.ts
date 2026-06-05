import { z } from 'zod'
import type { ConnectionType } from '@/types/connection'
import { getConnectionTypeDef } from '@/data/connectionTypes'

export function buildFlatFormSchema(type: ConnectionType) {
  const def = getConnectionTypeDef(type)
  const shape: Record<string, z.ZodTypeAny> = {
    name: z.string().min(1, 'Name is required').max(64),
  }

  for (const field of def.fields) {
    if (field.name === 'name') continue
    if (field.type === 'switch') {
      shape[field.name] = z.boolean()
    } else if (field.type === 'number') {
      let s = z.coerce.number({ message: `${field.label} must be a number` })
      if (field.required) s = s.min(1, `${field.label} is required`)
      if (field.min !== undefined) s = s.min(field.min, `Min ${field.min}`)
      if (field.max !== undefined) s = s.max(field.max, `Max ${field.max}`)
      shape[field.name] = s
    } else if (field.type === 'file') {
      let s = z.string()
      if (field.required) s = s.min(1, `${field.label} is required`)
      shape[field.name] = s
    } else {
      let s = z.string()
      if (field.required) s = s.min(1, `${field.label} is required`)
      else s = s.max(1024)
      shape[field.name] = s
    }
  }

  return z.object(shape)
}

export type FlatFormValues = Record<string, string | number | boolean>
