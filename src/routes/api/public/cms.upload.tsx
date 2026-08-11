import { createFileRoute } from '@tanstack/react-router'
import { uploadPublicFile } from '@/lib/storage.server'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

export const Route = createFileRoute('/api/public/cms/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const formData = await request.formData()
          const file = formData.get('file') as File
          const key = formData.get('key') as string

          if (!file) {
            return new Response(JSON.stringify({ error: 'No file uploaded' }), { 
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          const extension = file.name.split('.').pop()
          const fileName = `cms/${key || 'asset'}-${Date.now()}.${extension}`
          
          // Use a bucket that exists and is public
          const url = await uploadPublicFile(file, fileName, "extension-builds")
          
          return new Response(JSON.stringify({ url }), {
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (error: any) {
          console.error('Upload API Error:', error)
          return new Response(JSON.stringify({ error: error.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
})
