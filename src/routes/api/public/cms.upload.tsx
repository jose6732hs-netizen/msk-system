import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import { uploadPublicFile } from '@/lib/storage.server'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function safeKey(value: unknown) {
  const normalized = String(value ?? 'asset')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
  return normalized || 'asset'
}

async function authenticateAdmin(request: Request) {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_PUBLISHABLE_KEY']
  const authHeader = request.headers.get('authorization') ?? ''

  if (!url || !key || !authHeader.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  if (!token) return null

  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null

  const { data: roles, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'super_admin'])
    .limit(1)

  if (roleError || !roles?.length) return null
  return user.id
}

export const Route = createFileRoute('/api/public/cms/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const userId = await authenticateAdmin(request)
          if (!userId) return json({ error: 'UNAUTHORIZED' }, 401)

          const declaredLength = Number(request.headers.get('content-length') ?? '0')
          if (declaredLength > MAX_UPLOAD_BYTES + 1024 * 1024) {
            return json({ error: 'FILE_TOO_LARGE' }, 413)
          }

          const formData = await request.formData()
          const file = formData.get('file')
          const key = safeKey(formData.get('key'))

          if (!(file instanceof File)) return json({ error: 'NO_FILE' }, 400)
          if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
            return json({ error: 'FILE_TOO_LARGE' }, 413)
          }

          const extension = ALLOWED_MIME_TYPES[file.type]
          if (!extension) return json({ error: 'UNSUPPORTED_FILE_TYPE' }, 415)

          const fileName = `cms/${key}-${Date.now()}.${extension}`
          const url = await uploadPublicFile(file, fileName, 'cms-media')

          return json({ url })
        } catch (error) {
          console.error('Upload API Error:', error instanceof Error ? error.message : 'unknown_error')
          return json({ error: 'UPLOAD_FAILED' }, 500)
        }
      },
    },
  },
})
