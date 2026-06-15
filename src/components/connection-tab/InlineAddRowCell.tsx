import { Link } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { EditableColumnKind } from '@/types/postgres'

export interface AddRowColumn {
  name: string
  dataType: string
  kind: EditableColumnKind
  isNullable: boolean
  isPrimaryKey: boolean
  isGenerated?: boolean
  autoGenerateUuid?: boolean
  enumValues?: string[]
}

interface InlineAddRowCellProps {
  column: AddRowColumn
  rawValue: string
  onChange: (value: string) => void
  onFkBrowse?: () => void
}

export function InlineAddRowCell({ column, rawValue, onChange, onFkBrowse }: InlineAddRowCellProps) {
  if (column.isGenerated || column.kind === 'readonly') {
    return (
      <span className="block truncate px-1.5 py-1 font-mono text-xs italic text-muted-foreground">
        default
      </span>
    )
  }

  if (column.enumValues && column.enumValues.length > 0) {
    return (
      <div className="flex items-center gap-1">
        <Select value={rawValue} onValueChange={onChange}>
          <SelectTrigger className="h-7 min-w-[140px] font-mono text-xs">
            <SelectValue placeholder="default" />
          </SelectTrigger>
          <SelectContent>
            {column.enumValues.map((value) => (
              <SelectItem key={value} value={value} className="text-xs">
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {onFkBrowse && <FkBrowseButton onClick={onFkBrowse} />}
      </div>
    )
  }

  if (column.kind === 'boolean') {
    return (
      <div className="flex items-center gap-1">
        <Select value={rawValue} onValueChange={onChange}>
          <SelectTrigger className="h-7 w-[100px] font-mono text-xs">
            <SelectValue placeholder="default" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true" className="text-xs">true</SelectItem>
            <SelectItem value="false" className="text-xs">false</SelectItem>
          </SelectContent>
        </Select>
        {onFkBrowse && <FkBrowseButton onClick={onFkBrowse} />}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        value={rawValue}
        type={column.kind === 'number' ? 'number' : column.kind === 'datetime' ? 'datetime-local' : 'text'}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 min-w-[140px] font-mono text-xs"
        placeholder={column.autoGenerateUuid ? 'auto uuid' : 'default'}
      />
      {onFkBrowse && <FkBrowseButton onClick={onFkBrowse} />}
    </div>
  )
}

function FkBrowseButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={onClick}>
      <Link className="h-3.5 w-3.5" />
      <span className="sr-only">Browse foreign key values</span>
    </Button>
  )
}
