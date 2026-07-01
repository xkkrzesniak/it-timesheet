import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tagsApi } from '@/api/tags'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import type { Tag } from '@/types'

const PALETTE = [
  '#6B7280', '#EF4444', '#F97316', '#EAB308',
  '#22C55E', '#14B8A6', '#3B82F6', '#8B5CF6', '#EC4899',
]

export function AdminTags() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ open: boolean; tag: Tag | null }>({ open: false, tag: null })

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsApi.getAll,
  })

  const deleteMut = useMutation({
    mutationFn: tagsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  })

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Tagi / Kategorie</h1>
        <Button onClick={() => setModal({ open: true, tag: null })}>+ Nowy tag</Button>
      </div>

      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Tag</th>
              <th className="px-4 py-3 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={2} className="py-12 text-center text-text-muted">Ładowanie...</td></tr>
            )}
            {tags.map((t) => (
              <tr key={t.id} className="border-b border-border/50 hover:bg-bg-hover transition-colors">
                <td className="px-4 py-3">
                  <TagBadge tag={t} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setModal({ open: true, tag: t })}
                      className="text-xs text-text-muted hover:text-accent transition-colors"
                    >
                      Edytuj
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Usunąć tag "${t.name}"? Wpisy nie zostaną usunięte.`))
                          deleteMut.mutate(t.id)
                      }}
                      className="text-xs text-text-muted hover:text-danger transition-colors"
                    >
                      Usuń
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && !tags.length && (
              <tr><td colSpan={2} className="py-12 text-center text-text-muted">Brak tagów. Dodaj pierwszy!</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal.open && (
        <TagModal
          tag={modal.tag}
          onClose={() => setModal({ open: false, tag: null })}
          onSaved={() => {
            setModal({ open: false, tag: null })
            qc.invalidateQueries({ queryKey: ['tags'] })
          }}
        />
      )}
    </div>
  )
}

export function TagBadge({ tag }: { tag: Tag }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
      style={{ backgroundColor: tag.color + '28', color: tag.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
      {tag.name}
    </span>
  )
}

function TagModal({
  tag,
  onClose,
  onSaved,
}: {
  tag: Tag | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(tag?.name ?? '')
  const [color, setColor] = useState(tag?.color ?? '#6B7280')

  const mut = useMutation({
    mutationFn: () =>
      tag ? tagsApi.update(tag.id, { name, color }) : tagsApi.create({ name, color }),
    onSuccess: onSaved,
  })

  return (
    <Modal open title={tag ? `Edytuj: ${tag.name}` : 'Nowy tag'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input
          label="Nazwa tagu"
          placeholder="np. Development, Meeting, Design..."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div>
          <p className="text-sm text-text-secondary font-medium mb-2">Kolor</p>
          <div className="flex gap-2 flex-wrap">
            {PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  outline: color === c ? `3px solid ${c}` : 'none',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-text-muted">Podgląd:</span>
            <TagBadge tag={{ id: '', name: name || 'przykład', color }} />
          </div>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>Anuluj</Button>
          <Button onClick={() => mut.mutate()} loading={mut.isPending} disabled={!name}>
            {tag ? 'Zapisz' : 'Utwórz'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
