import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute('/api/public/cms')({
  server: {
    handlers: {
      GET: async () => {
        const { data, error } = await supabaseAdmin
          .from("app_settings")
          .select("*");
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const settings: Record<string, any> = {};
        data?.forEach((item: any) => {
          settings[item.key] = item.value;
        });

        const { signData } = await import("@/lib/license.server");
        const responseData = {
          settings,
          timestamp: Date.now()
        };
        const signature = await signData(JSON.stringify(responseData));

        return new Response(JSON.stringify({ ...responseData, signature }), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*' 
          }
        });
      }
    }
  }
});

