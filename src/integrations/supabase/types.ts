export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      affiliate_attributions: {
        Row: {
          affiliate_id: string
          attributed_at: string
          expires_at: string
          id: string
          landing_page: string | null
          metadata: Json | null
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_id: string | null
        }
        Insert: {
          affiliate_id: string
          attributed_at?: string
          expires_at: string
          id?: string
          landing_page?: string | null
          metadata?: Json | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Update: {
          affiliate_id?: string
          attributed_at?: string
          expires_at?: string
          id?: string
          landing_page?: string | null
          metadata?: Json | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      affiliate_balance_ledger: {
        Row: {
          affiliate_id: string
          amount: number
          balance_after: number
          created_at: string
          created_by: string | null
          id: string
          reason: string | null
          type: string
        }
        Insert: {
          affiliate_id: string
          amount: number
          balance_after: number
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          type: string
        }
        Update: {
          affiliate_id?: string
          amount?: number
          balance_after?: number
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_balance_ledger_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_clicks: {
        Row: {
          affiliate_id: string
          created_at: string
          device_type: string | null
          id: string
          ip_hash: string | null
          landing_path: string | null
          referer: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_id: string | null
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          device_type?: string | null
          id?: string
          ip_hash?: string | null
          landing_path?: string | null
          referer?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          device_type?: string | null
          id?: string
          ip_hash?: string | null
          landing_path?: string | null
          referer?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_commission_overrides: {
        Row: {
          active: boolean
          affiliate_id: string
          created_at: string
          fixed_amount: number
          id: string
          plan_id: string | null
          rate: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          affiliate_id: string
          created_at?: string
          fixed_amount?: number
          id?: string
          plan_id?: string | null
          rate?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          affiliate_id?: string
          created_at?: string
          fixed_amount?: number
          id?: string
          plan_id?: string | null
          rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commission_overrides_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commission_overrides_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_commissions: {
        Row: {
          affiliate_id: string
          amount: number
          approved_at: string | null
          available_at: string | null
          base_amount: number | null
          commission_amount: number | null
          commission_percentage: number | null
          created_at: string
          gross_amount: number | null
          id: string
          order_id: string | null
          plan_id: string | null
          rate: number
          source: string
          status: string
          transaction_id: string
          updated_at: string
          user_id: string | null
          wallet_id: string | null
        }
        Insert: {
          affiliate_id: string
          amount?: number
          approved_at?: string | null
          available_at?: string | null
          base_amount?: number | null
          commission_amount?: number | null
          commission_percentage?: number | null
          created_at?: string
          gross_amount?: number | null
          id?: string
          order_id?: string | null
          plan_id?: string | null
          rate?: number
          source?: string
          status?: string
          transaction_id: string
          updated_at?: string
          user_id?: string | null
          wallet_id?: string | null
        }
        Update: {
          affiliate_id?: string
          amount?: number
          approved_at?: string | null
          available_at?: string | null
          base_amount?: number | null
          commission_amount?: number | null
          commission_percentage?: number | null
          created_at?: string
          gross_amount?: number | null
          id?: string
          order_id?: string | null
          plan_id?: string | null
          rate?: number
          source?: string
          status?: string
          transaction_id?: string
          updated_at?: string
          user_id?: string | null
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "affiliate_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_conversions: {
        Row: {
          affiliate_id: string
          amount: number
          commission_amount: number
          converted_at: string
          id: string
          metadata: Json | null
          status: string
          transaction_id: string
          user_id: string | null
        }
        Insert: {
          affiliate_id: string
          amount: number
          commission_amount: number
          converted_at?: string
          id?: string
          metadata?: Json | null
          status?: string
          transaction_id: string
          user_id?: string | null
        }
        Update: {
          affiliate_id?: string
          amount?: number
          commission_amount?: number
          converted_at?: string
          id?: string
          metadata?: Json | null
          status?: string
          transaction_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      affiliate_documents: {
        Row: {
          affiliate_id: string
          created_at: string
          document_type: string
          file_name: string
          file_path: string
          id: string
          rejection_reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          document_type: string
          file_name: string
          file_path: string
          id?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          document_type?: string
          file_name?: string
          file_path?: string
          id?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      affiliate_events: {
        Row: {
          affiliate_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          resource_id: string | null
          user_id: string | null
        }
        Insert: {
          affiliate_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          user_id?: string | null
        }
        Update: {
          affiliate_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      affiliate_referrals: {
        Row: {
          affiliate_id: string
          converted_at: string | null
          created_at: string
          first_seen_at: string
          id: string
          ip_hash: string | null
          landing_path: string | null
          signed_up_at: string | null
          status: string
          user_id: string | null
          visitor_id: string
        }
        Insert: {
          affiliate_id: string
          converted_at?: string | null
          created_at?: string
          first_seen_at?: string
          id?: string
          ip_hash?: string | null
          landing_path?: string | null
          signed_up_at?: string | null
          status?: string
          user_id?: string | null
          visitor_id: string
        }
        Update: {
          affiliate_id?: string
          converted_at?: string | null
          created_at?: string
          first_seen_at?: string
          id?: string
          ip_hash?: string | null
          landing_path?: string | null
          signed_up_at?: string | null
          status?: string
          user_id?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_tiers: {
        Row: {
          badge_color: string
          commission_rate: number
          created_at: string | null
          id: string
          min_revenue: number
          min_sales: number
          name: string
          updated_at: string | null
        }
        Insert: {
          badge_color?: string
          commission_rate: number
          created_at?: string | null
          id?: string
          min_revenue?: number
          min_sales?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          badge_color?: string
          commission_rate?: number
          created_at?: string | null
          id?: string
          min_revenue?: number
          min_sales?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      affiliate_wallet_transactions: {
        Row: {
          affiliate_id: string
          amount: number
          balance_after: number
          balance_before: number
          commission_id: string | null
          created_at: string
          description: string | null
          id: string
          payment_id: string | null
          status: string
          type: string
          wallet_id: string
          withdrawal_id: string | null
        }
        Insert: {
          affiliate_id: string
          amount: number
          balance_after: number
          balance_before: number
          commission_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          payment_id?: string | null
          status?: string
          type: string
          wallet_id: string
          withdrawal_id?: string | null
        }
        Update: {
          affiliate_id?: string
          amount?: number
          balance_after?: number
          balance_before?: number
          commission_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          payment_id?: string | null
          status?: string
          type?: string
          wallet_id?: string
          withdrawal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_wallet_transactions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "affiliate_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_wallets: {
        Row: {
          affiliate_id: string
          available_balance: number
          created_at: string
          id: string
          pending_balance: number
          requested_balance: number
          total_earned: number
          total_withdrawn: number
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          available_balance?: number
          created_at?: string
          id?: string
          pending_balance?: number
          requested_balance?: number
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          available_balance?: number
          created_at?: string
          id?: string
          pending_balance?: number
          requested_balance?: number
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_wallets_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: true
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_withdrawals: {
        Row: {
          admin_id: string | null
          admin_note: string | null
          affiliate_id: string
          amount: number
          approved_at: string | null
          cancelled_at: string | null
          created_at: string
          id: string
          paid_at: string | null
          pix_key: string
          pix_key_type: string
          requested_at: string
          status: string
          updated_at: string
          wallet_id: string
        }
        Insert: {
          admin_id?: string | null
          admin_note?: string | null
          affiliate_id: string
          amount: number
          approved_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          pix_key: string
          pix_key_type: string
          requested_at?: string
          status?: string
          updated_at?: string
          wallet_id: string
        }
        Update: {
          admin_id?: string | null
          admin_note?: string | null
          affiliate_id?: string
          amount?: number
          approved_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          pix_key?: string
          pix_key_type?: string
          requested_at?: string
          status?: string
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_withdrawals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_withdrawals_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "affiliate_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          available_balance: number
          blocked_at: string | null
          code: string
          commission_rate: number
          created_at: string
          goal_amount: number | null
          id: string
          notes: string | null
          pending_balance: number
          pix_key: string | null
          pix_key_type: string | null
          status: string
          tier_id: string | null
          total_clicks: number
          total_commission: number
          total_paid: number
          total_sales: number
          user_id: string
          verification_status: string
          verification_submitted_at: string | null
          withdrawal_attempts: number
          withdrawal_blocked_at: string | null
          withdrawal_password_hash: string | null
        }
        Insert: {
          available_balance?: number
          blocked_at?: string | null
          code: string
          commission_rate?: number
          created_at?: string
          goal_amount?: number | null
          id?: string
          notes?: string | null
          pending_balance?: number
          pix_key?: string | null
          pix_key_type?: string | null
          status?: string
          tier_id?: string | null
          total_clicks?: number
          total_commission?: number
          total_paid?: number
          total_sales?: number
          user_id: string
          verification_status?: string
          verification_submitted_at?: string | null
          withdrawal_attempts?: number
          withdrawal_blocked_at?: string | null
          withdrawal_password_hash?: string | null
        }
        Update: {
          available_balance?: number
          blocked_at?: string | null
          code?: string
          commission_rate?: number
          created_at?: string
          goal_amount?: number | null
          id?: string
          notes?: string | null
          pending_balance?: number
          pix_key?: string | null
          pix_key_type?: string | null
          status?: string
          tier_id?: string | null
          total_clicks?: number
          total_commission?: number
          total_paid?: number
          total_sales?: number
          user_id?: string
          verification_status?: string
          verification_submitted_at?: string | null
          withdrawal_attempts?: number
          withdrawal_blocked_at?: string | null
          withdrawal_password_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "affiliate_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_api_usage: {
        Row: {
          action: string
          browser: string | null
          created_at: string
          error_message: string | null
          estimated_cost_usd: number
          extension_version: string | null
          http_status: number | null
          id: string
          input_tokens: number
          installation_id: string | null
          ip_address: string | null
          latency_ms: number
          metadata: Json
          model: string | null
          output_tokens: number
          prompt_chars: number
          provider: string
          reply_chars: number
          source: string
          status: string
          total_tokens: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          action?: string
          browser?: string | null
          created_at?: string
          error_message?: string | null
          estimated_cost_usd?: number
          extension_version?: string | null
          http_status?: number | null
          id?: string
          input_tokens?: number
          installation_id?: string | null
          ip_address?: string | null
          latency_ms?: number
          metadata?: Json
          model?: string | null
          output_tokens?: number
          prompt_chars?: number
          provider?: string
          reply_chars?: number
          source?: string
          status?: string
          total_tokens?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          browser?: string | null
          created_at?: string
          error_message?: string | null
          estimated_cost_usd?: number
          extension_version?: string | null
          http_status?: number | null
          id?: string
          input_tokens?: number
          installation_id?: string | null
          ip_address?: string | null
          latency_ms?: number
          metadata?: Json
          model?: string | null
          output_tokens?: number
          prompt_chars?: number
          provider?: string
          reply_chars?: number
          source?: string
          status?: string
          total_tokens?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_hash: string | null
          metadata: Json
          resource: string | null
          resource_id: string | null
          result: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          resource?: string | null
          resource_id?: string | null
          result?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          resource?: string | null
          resource_id?: string | null
          result?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          affiliate_code: string | null
          created_at: string
          id: string
          plan_id: string
          quantity: number
          reseller_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_code?: string | null
          created_at?: string
          id?: string
          plan_id: string
          quantity?: number
          reseller_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          affiliate_code?: string | null
          created_at?: string
          id?: string
          plan_id?: string
          quantity?: number
          reseller_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_drafts: {
        Row: {
          created_at: string | null
          data: Json
          id: string
          key: string
          published_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data: Json
          id?: string
          key: string
          published_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json
          id?: string
          key?: string
          published_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cms_history: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          document: string | null
          document_type: string | null
          email: string
          id: string
          metadata: Json
          name: string
          phone: string | null
          reseller_id: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          document?: string | null
          document_type?: string | null
          email: string
          id?: string
          metadata?: Json
          name: string
          phone?: string | null
          reseller_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          document?: string | null
          document_type?: string | null
          email?: string
          id?: string
          metadata?: Json
          name?: string
          phone?: string | null
          reseller_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      downloads: {
        Row: {
          build_id: string | null
          created_at: string
          id: string
          ip_hash: string | null
          reseller_id: string | null
          user_id: string | null
        }
        Insert: {
          build_id?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          reseller_id?: string | null
          user_id?: string | null
        }
        Update: {
          build_id?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          reseller_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      email_campaign_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          email: string
          error: string | null
          id: string
          profile_id: string | null
          provider_message_id: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          email: string
          error?: string | null
          id?: string
          profile_id?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          email?: string
          error?: string | null
          id?: string
          profile_id?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_recipients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          audience: string
          campaign_key: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          error: string | null
          failed_count: number
          from_email: string | null
          id: string
          message: string | null
          new_whatsapp: string
          recipient_profile_id: string | null
          sent_count: number
          started_at: string | null
          status: string
          subject: string
          target_count: number
          title: string | null
          updated_at: string
        }
        Insert: {
          audience?: string
          campaign_key: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          failed_count?: number
          from_email?: string | null
          id?: string
          message?: string | null
          new_whatsapp?: string
          recipient_profile_id?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          subject: string
          target_count?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          audience?: string
          campaign_key?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          failed_count?: number
          from_email?: string | null
          id?: string
          message?: string | null
          new_whatsapp?: string
          recipient_profile_id?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          subject?: string
          target_count?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      extension_alerts: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          id: string
          incident_id: string | null
          message: string | null
          metadata: Json
          severity: string
          title: string
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string
          id?: string
          incident_id?: string | null
          message?: string | null
          metadata?: Json
          severity?: string
          title: string
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          id?: string
          incident_id?: string | null
          message?: string | null
          metadata?: Json
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "extension_alerts_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "extension_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      extension_branding: {
        Row: {
          changelog: string | null
          description: string
          extension_name: string
          icon_url: string | null
          id: string
          primary_color: string
          reseller_id: string
          store_url: string | null
          support_url: string | null
          title_color: string
          updated_at: string
        }
        Insert: {
          changelog?: string | null
          description?: string
          extension_name?: string
          icon_url?: string | null
          id?: string
          primary_color?: string
          reseller_id: string
          store_url?: string | null
          support_url?: string | null
          title_color?: string
          updated_at?: string
        }
        Update: {
          changelog?: string | null
          description?: string
          extension_name?: string
          icon_url?: string | null
          id?: string
          primary_color?: string
          reseller_id?: string
          store_url?: string | null
          support_url?: string | null
          title_color?: string
          updated_at?: string
        }
        Relationships: []
      }
      extension_builds: {
        Row: {
          channel_slug: string | null
          created_at: string
          file_name: string
          id: string
          is_official: boolean
          is_published: boolean
          release_notes: string | null
          reseller_id: string | null
          size_bytes: number | null
          status: string
          storage_path: string | null
          updated_at: string | null
          uploaded_by: string | null
          version: string
        }
        Insert: {
          channel_slug?: string | null
          created_at?: string
          file_name: string
          id?: string
          is_official?: boolean
          is_published?: boolean
          release_notes?: string | null
          reseller_id?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          version?: string
        }
        Update: {
          channel_slug?: string | null
          created_at?: string
          file_name?: string
          id?: string
          is_official?: boolean
          is_published?: boolean
          release_notes?: string | null
          reseller_id?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "extension_builds_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      extension_channels: {
        Row: {
          active: boolean | null
          api_base_url: string | null
          channel_number: number | null
          channel_type: string | null
          chrome_extension_id: string | null
          created_at: string | null
          display_name: string
          enabled: boolean | null
          id: string
          message: string | null
          metadata: Json | null
          slug: string
          updated_at: string | null
          version: string | null
        }
        Insert: {
          active?: boolean | null
          api_base_url?: string | null
          channel_number?: number | null
          channel_type?: string | null
          chrome_extension_id?: string | null
          created_at?: string | null
          display_name: string
          enabled?: boolean | null
          id?: string
          message?: string | null
          metadata?: Json | null
          slug: string
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          active?: boolean | null
          api_base_url?: string | null
          channel_number?: number | null
          channel_type?: string | null
          chrome_extension_id?: string | null
          created_at?: string | null
          display_name?: string
          enabled?: boolean | null
          id?: string
          message?: string | null
          metadata?: Json | null
          slug?: string
          updated_at?: string | null
          version?: string | null
        }
        Relationships: []
      }
      extension_error_catalog: {
        Row: {
          created_at: string
          error_code: string
          id: string
          recovery_action: string | null
          severity: string
          title: string
          user_message: string
        }
        Insert: {
          created_at?: string
          error_code: string
          id?: string
          recovery_action?: string | null
          severity?: string
          title: string
          user_message: string
        }
        Update: {
          created_at?: string
          error_code?: string
          id?: string
          recovery_action?: string | null
          severity?: string
          title?: string
          user_message?: string
        }
        Relationships: []
      }
      extension_errors: {
        Row: {
          action: string | null
          browser: string | null
          created_at: string
          error_code: string
          error_id: string
          extension_version: string | null
          id: string
          installation_id: string
          ip_address: string | null
          metadata: Json
          project_id: string | null
          provider: string | null
          repository: string | null
          resolved: boolean
          resolved_at: string | null
          severity: string
          stack_summary: string | null
          technical_message: string | null
          title: string | null
          user_id: string
          user_message: string | null
        }
        Insert: {
          action?: string | null
          browser?: string | null
          created_at?: string
          error_code: string
          error_id?: string
          extension_version?: string | null
          id?: string
          installation_id: string
          ip_address?: string | null
          metadata?: Json
          project_id?: string | null
          provider?: string | null
          repository?: string | null
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          stack_summary?: string | null
          technical_message?: string | null
          title?: string | null
          user_id: string
          user_message?: string | null
        }
        Update: {
          action?: string | null
          browser?: string | null
          created_at?: string
          error_code?: string
          error_id?: string
          extension_version?: string | null
          id?: string
          installation_id?: string
          ip_address?: string | null
          metadata?: Json
          project_id?: string | null
          provider?: string | null
          repository?: string | null
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          stack_summary?: string | null
          technical_message?: string | null
          title?: string | null
          user_id?: string
          user_message?: string | null
        }
        Relationships: []
      }
      extension_events: {
        Row: {
          action: string
          created_at: string
          duration_ms: number | null
          event_id: string
          extension_version: string | null
          id: string
          installation_id: string
          ip_address: string | null
          metadata: Json
          project_id: string | null
          provider: string | null
          repository: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          duration_ms?: number | null
          event_id?: string
          extension_version?: string | null
          id?: string
          installation_id: string
          ip_address?: string | null
          metadata?: Json
          project_id?: string | null
          provider?: string | null
          repository?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          duration_ms?: number | null
          event_id?: string
          extension_version?: string | null
          id?: string
          installation_id?: string
          ip_address?: string | null
          metadata?: Json
          project_id?: string | null
          provider?: string | null
          repository?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      extension_incidents: {
        Row: {
          affected_installations: number
          affected_users: number
          created_at: string
          dominant_browser: string | null
          dominant_version: string | null
          error_code: string
          first_seen_at: string
          id: string
          last_seen_at: string
          metadata: Json
          resolved_at: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          affected_installations?: number
          affected_users?: number
          created_at?: string
          dominant_browser?: string | null
          dominant_version?: string | null
          error_code: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          metadata?: Json
          resolved_at?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          affected_installations?: number
          affected_users?: number
          created_at?: string
          dominant_browser?: string | null
          dominant_version?: string | null
          error_code?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          metadata?: Json
          resolved_at?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      extension_installations: {
        Row: {
          block_reason: string | null
          blocked: boolean
          browser: string | null
          created_at: string
          extension_id: string | null
          first_extension_id: string | null
          id: string
          installation_id: string
          integrity_enrolled_at: string | null
          integrity_required: boolean
          integrity_root: string | null
          integrity_updated_at: string | null
          integrity_version: string | null
          ip_address: string | null
          last_activity_at: string | null
          last_seen_at: string | null
          last_url: string | null
          license_id: string | null
          metadata: Json
          os: string | null
          suspicion_reason: string | null
          suspicious: boolean
          user_agent: string | null
          user_id: string
          version: string | null
        }
        Insert: {
          block_reason?: string | null
          blocked?: boolean
          browser?: string | null
          created_at?: string
          extension_id?: string | null
          first_extension_id?: string | null
          id?: string
          installation_id: string
          integrity_enrolled_at?: string | null
          integrity_required?: boolean
          integrity_root?: string | null
          integrity_updated_at?: string | null
          integrity_version?: string | null
          ip_address?: string | null
          last_activity_at?: string | null
          last_seen_at?: string | null
          last_url?: string | null
          license_id?: string | null
          metadata?: Json
          os?: string | null
          suspicion_reason?: string | null
          suspicious?: boolean
          user_agent?: string | null
          user_id: string
          version?: string | null
        }
        Update: {
          block_reason?: string | null
          blocked?: boolean
          browser?: string | null
          created_at?: string
          extension_id?: string | null
          first_extension_id?: string | null
          id?: string
          installation_id?: string
          integrity_enrolled_at?: string | null
          integrity_required?: boolean
          integrity_root?: string | null
          integrity_updated_at?: string | null
          integrity_version?: string | null
          ip_address?: string | null
          last_activity_at?: string | null
          last_seen_at?: string | null
          last_url?: string | null
          license_id?: string | null
          metadata?: Json
          os?: string | null
          suspicion_reason?: string | null
          suspicious?: boolean
          user_agent?: string | null
          user_id?: string
          version?: string | null
        }
        Relationships: []
      }
      extension_projects: {
        Row: {
          branch: string | null
          created_at: string
          github_status: string | null
          id: string
          installation_id: string
          last_activity_at: string | null
          last_commit_sha: string | null
          lovable_project_id: string
          preview_url: string | null
          project_name: string | null
          provider: string | null
          publish_status: string | null
          repository: string | null
          updated_at: string
          user_id: string
          workspace_url: string | null
        }
        Insert: {
          branch?: string | null
          created_at?: string
          github_status?: string | null
          id?: string
          installation_id: string
          last_activity_at?: string | null
          last_commit_sha?: string | null
          lovable_project_id: string
          preview_url?: string | null
          project_name?: string | null
          provider?: string | null
          publish_status?: string | null
          repository?: string | null
          updated_at?: string
          user_id: string
          workspace_url?: string | null
        }
        Update: {
          branch?: string | null
          created_at?: string
          github_status?: string | null
          id?: string
          installation_id?: string
          last_activity_at?: string | null
          last_commit_sha?: string | null
          lovable_project_id?: string
          preview_url?: string | null
          project_name?: string | null
          provider?: string | null
          publish_status?: string | null
          repository?: string | null
          updated_at?: string
          user_id?: string
          workspace_url?: string | null
        }
        Relationships: []
      }
      extension_releases: {
        Row: {
          build_id: string | null
          changelog: string | null
          created_at: string
          download_url: string | null
          id: string
          mandatory: boolean
          minimum_version: string | null
          released_at: string | null
          status: string
          title: string | null
          updated_at: string
          updated_by: string | null
          version: string
        }
        Insert: {
          build_id?: string | null
          changelog?: string | null
          created_at?: string
          download_url?: string | null
          id?: string
          mandatory?: boolean
          minimum_version?: string | null
          released_at?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          version: string
        }
        Update: {
          build_id?: string | null
          changelog?: string | null
          created_at?: string
          download_url?: string | null
          id?: string
          mandatory?: boolean
          minimum_version?: string | null
          released_at?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: string
        }
        Relationships: []
      }
      extension_remote_commands: {
        Row: {
          acknowledged_at: string | null
          command_type: string
          created_at: string
          created_by: string | null
          delivered_at: string | null
          delivery_count: number
          expires_at: string | null
          id: string
          installation_id: string | null
          last_delivery_at: string | null
          message: string | null
          payload: Json
          severity: string
          status: string
          title: string | null
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          command_type: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_count?: number
          expires_at?: string | null
          id?: string
          installation_id?: string | null
          last_delivery_at?: string | null
          message?: string | null
          payload?: Json
          severity?: string
          status?: string
          title?: string | null
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          command_type?: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_count?: number
          expires_at?: string | null
          id?: string
          installation_id?: string | null
          last_delivery_at?: string | null
          message?: string | null
          payload?: Json
          severity?: string
          status?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      extension_remote_controls: {
        Row: {
          block_message: string | null
          block_reason: string | null
          blocked: boolean
          created_at: string
          id: string
          installation_id: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          block_message?: string | null
          block_reason?: string | null
          blocked?: boolean
          created_at?: string
          id?: string
          installation_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          block_message?: string | null
          block_reason?: string | null
          blocked?: boolean
          created_at?: string
          id?: string
          installation_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      extension_replies: {
        Row: {
          body: string | null
          command_id: string | null
          created_at: string
          extension_version: string | null
          id: string
          installation_id: string
          ip_address: string | null
          kind: string
          payload: Json
          read_at: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          command_id?: string | null
          created_at?: string
          extension_version?: string | null
          id?: string
          installation_id: string
          ip_address?: string | null
          kind?: string
          payload?: Json
          read_at?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          command_id?: string | null
          created_at?: string
          extension_version?: string | null
          id?: string
          installation_id?: string
          ip_address?: string | null
          kind?: string
          payload?: Json
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "extension_replies_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "extension_remote_commands"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          id: string
          number: string
          status: string
          transaction_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          number: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          number?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      license_devices: {
        Row: {
          activation_count: number
          browser: string | null
          created_at: string
          device_hash: string
          device_name: string | null
          extension_version: string | null
          first_seen: string
          id: string
          installation_id: string | null
          last_ip_hash: string | null
          last_seen: string
          last_validation: string | null
          license_id: string
          os: string | null
          status: Database["public"]["Enums"]["device_status"]
        }
        Insert: {
          activation_count?: number
          browser?: string | null
          created_at?: string
          device_hash: string
          device_name?: string | null
          extension_version?: string | null
          first_seen?: string
          id?: string
          installation_id?: string | null
          last_ip_hash?: string | null
          last_seen?: string
          last_validation?: string | null
          license_id: string
          os?: string | null
          status?: Database["public"]["Enums"]["device_status"]
        }
        Update: {
          activation_count?: number
          browser?: string | null
          created_at?: string
          device_hash?: string
          device_name?: string | null
          extension_version?: string | null
          first_seen?: string
          id?: string
          installation_id?: string | null
          last_ip_hash?: string | null
          last_seen?: string
          last_validation?: string | null
          license_id?: string
          os?: string | null
          status?: Database["public"]["Enums"]["device_status"]
        }
        Relationships: []
      }
      license_events: {
        Row: {
          created_at: string
          device_hash: string | null
          event_type: string
          id: string
          license_id: string | null
          metadata: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_hash?: string | null
          event_type: string
          id?: string
          license_id?: string | null
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_hash?: string | null
          event_type?: string
          id?: string
          license_id?: string | null
          metadata?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      licenses: {
        Row: {
          activated_at: string | null
          activation_count: number
          created_at: string
          expires_at: string | null
          id: string
          last_validation: string | null
          max_devices: number
          metadata: Json | null
          plan_id: string
          product_id: string | null
          reseller_id: string | null
          revocation_reason: string | null
          revoked_at: string | null
          starts_at: string
          status: Database["public"]["Enums"]["license_status"]
          subscription_id: string | null
          token_encrypted: string | null
          token_hash: string
          token_last4: string
          token_preview: string
          transaction_id: string | null
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activated_at?: string | null
          activation_count?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          last_validation?: string | null
          max_devices?: number
          metadata?: Json | null
          plan_id: string
          product_id?: string | null
          reseller_id?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["license_status"]
          subscription_id?: string | null
          token_encrypted?: string | null
          token_hash: string
          token_last4: string
          token_preview?: string
          transaction_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activated_at?: string | null
          activation_count?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          last_validation?: string | null
          max_devices?: number
          metadata?: Json | null
          plan_id?: string
          product_id?: string | null
          reseller_id?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["license_status"]
          subscription_id?: string | null
          token_encrypted?: string | null
          token_hash?: string
          token_last4?: string
          token_preview?: string
          transaction_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "licenses_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licenses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licenses_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licenses_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licenses_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_finance: {
        Row: {
          affiliate_id: string | null
          campaign_id: string | null
          commission_amount: number
          commission_percentage: number
          created_at: string
          id: string
          notification_id: string | null
          origin: string | null
          plan_id: string | null
          product_id: string | null
          sale_amount: number
          transaction_id: string | null
        }
        Insert: {
          affiliate_id?: string | null
          campaign_id?: string | null
          commission_amount?: number
          commission_percentage?: number
          created_at?: string
          id?: string
          notification_id?: string | null
          origin?: string | null
          plan_id?: string | null
          product_id?: string | null
          sale_amount?: number
          transaction_id?: string | null
        }
        Update: {
          affiliate_id?: string | null
          campaign_id?: string | null
          commission_amount?: number
          commission_percentage?: number
          created_at?: string
          id?: string
          notification_id?: string | null
          origin?: string | null
          plan_id?: string | null
          product_id?: string | null
          sale_amount?: number
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_finance_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          campaigns: boolean
          commissions: boolean
          created_at: string
          messages: boolean
          payments: boolean
          promotions: boolean
          sales: boolean
          updated_at: string
          updates: boolean
          user_id: string
        }
        Insert: {
          campaigns?: boolean
          commissions?: boolean
          created_at?: string
          messages?: boolean
          payments?: boolean
          promotions?: boolean
          sales?: boolean
          updated_at?: string
          updates?: boolean
          user_id: string
        }
        Update: {
          campaigns?: boolean
          commissions?: boolean
          created_at?: string
          messages?: boolean
          payments?: boolean
          promotions?: boolean
          sales?: boolean
          updated_at?: string
          updates?: boolean
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          emoji: string | null
          id: string
          image_url: string | null
          link: string | null
          metadata: Json
          priority: string
          push_error: string | null
          push_status: string | null
          read_at: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: string
          tenant_id: string | null
          title: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          emoji?: string | null
          id?: string
          image_url?: string | null
          link?: string | null
          metadata?: Json
          priority?: string
          push_error?: string | null
          push_status?: string | null
          read_at?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          tenant_id?: string | null
          title: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          emoji?: string | null
          id?: string
          image_url?: string | null
          link?: string | null
          metadata?: Json
          priority?: string
          push_error?: string | null
          push_status?: string | null
          read_at?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          tenant_id?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      offers: {
        Row: {
          active: boolean
          affiliate_commission_rate: number | null
          created_at: string
          currency: string
          id: string
          name: string
          periodicity: number
          periodicity_type: string
          plan_id: string | null
          price: number
          product_id: string
          recurring: boolean
          slug: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          affiliate_commission_rate?: number | null
          created_at?: string
          currency?: string
          id?: string
          name: string
          periodicity?: number
          periodicity_type?: string
          plan_id?: string | null
          price?: number
          product_id: string
          recurring?: boolean
          slug: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          affiliate_commission_rate?: number | null
          created_at?: string
          currency?: string
          id?: string
          name?: string
          periodicity?: number
          periodicity_type?: string
          plan_id?: string | null
          price?: number
          product_id?: string
          recurring?: boolean
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "offers_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          amount: number | null
          created_at: string
          event: string
          external_id: string | null
          id: string
          metadata: Json
          status: string
          transaction_id: string | null
          webhook_event_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          event: string
          external_id?: string | null
          id?: string
          metadata?: Json
          status: string
          transaction_id?: string | null
          webhook_event_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          event?: string
          external_id?: string | null
          id?: string
          metadata?: Json
          status?: string
          transaction_id?: string | null
          webhook_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_settings: {
        Row: {
          active: boolean
          api_base_url: string
          created_at: string
          id: string
          provider: string
          public_key_encrypted: string | null
          public_key_last4: string | null
          secret_key_encrypted: string | null
          secret_key_last4: string | null
          updated_at: string
          updated_by: string | null
          webhook_secret_encrypted: string | null
        }
        Insert: {
          active?: boolean
          api_base_url?: string
          created_at?: string
          id?: string
          provider?: string
          public_key_encrypted?: string | null
          public_key_last4?: string | null
          secret_key_encrypted?: string | null
          secret_key_last4?: string | null
          updated_at?: string
          updated_by?: string | null
          webhook_secret_encrypted?: string | null
        }
        Update: {
          active?: boolean
          api_base_url?: string
          created_at?: string
          id?: string
          provider?: string
          public_key_encrypted?: string | null
          public_key_last4?: string | null
          secret_key_encrypted?: string | null
          secret_key_last4?: string | null
          updated_at?: string
          updated_by?: string | null
          webhook_secret_encrypted?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          plan_id: string | null
          provider: string
          provider_payment_id: string | null
          raw: Json
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          plan_id?: string | null
          provider?: string
          provider_payment_id?: string | null
          raw?: Json
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          plan_id?: string | null
          provider?: string
          provider_payment_id?: string | null
          raw?: Json
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          active: boolean
          affiliate_commission_fixed: number
          affiliate_commission_rate: number
          allow_reset: boolean
          allow_transfer: boolean
          allow_trial: boolean
          auto_renew: boolean
          created_at: string
          currency: string
          description: string
          duration_days: number | null
          duration_label: string
          duration_unit: string
          duration_value: number
          features: Json
          highlights: string[]
          id: string
          image_url: string | null
          is_lifetime: boolean
          max_activations: number
          max_devices: number
          name: string
          price: number
          provider_price_id: string | null
          reseller_price: number | null
          slug: string
          sort_order: number
          updated_at: string
          usage_limit: number | null
        }
        Insert: {
          active?: boolean
          affiliate_commission_fixed?: number
          affiliate_commission_rate?: number
          allow_reset?: boolean
          allow_transfer?: boolean
          allow_trial?: boolean
          auto_renew?: boolean
          created_at?: string
          currency?: string
          description?: string
          duration_days?: number | null
          duration_label?: string
          duration_unit?: string
          duration_value?: number
          features?: Json
          highlights?: string[]
          id?: string
          image_url?: string | null
          is_lifetime?: boolean
          max_activations?: number
          max_devices?: number
          name: string
          price?: number
          provider_price_id?: string | null
          reseller_price?: number | null
          slug: string
          sort_order?: number
          updated_at?: string
          usage_limit?: number | null
        }
        Update: {
          active?: boolean
          affiliate_commission_fixed?: number
          affiliate_commission_rate?: number
          allow_reset?: boolean
          allow_transfer?: boolean
          allow_trial?: boolean
          auto_renew?: boolean
          created_at?: string
          currency?: string
          description?: string
          duration_days?: number | null
          duration_label?: string
          duration_unit?: string
          duration_value?: number
          features?: Json
          highlights?: string[]
          id?: string
          image_url?: string | null
          is_lifetime?: boolean
          max_activations?: number
          max_devices?: number
          name?: string
          price?: number
          provider_price_id?: string | null
          reseller_price?: number | null
          slug?: string
          sort_order?: number
          updated_at?: string
          usage_limit?: number | null
        }
        Relationships: []
      }
      presence_sessions: {
        Row: {
          created_at: string
          id: string
          last_seen: string
          session_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen?: string
          session_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_seen?: string
          session_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          affiliate_commission_rate: number
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          reseller_commission_rate: number
          slug: string
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          affiliate_commission_rate?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          reseller_commission_rate?: number
          slug: string
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          affiliate_commission_rate?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          reseller_commission_rate?: number
          slug?: string
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          document: string | null
          document_hash: string | null
          email: string | null
          id: string
          name: string | null
          phone: string | null
          referred_by_affiliate_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          document?: string | null
          document_hash?: string | null
          email?: string | null
          id: string
          name?: string | null
          phone?: string | null
          referred_by_affiliate_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          document?: string | null
          document_hash?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          referred_by_affiliate_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_affiliate_id_fkey"
            columns: ["referred_by_affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      push_devices: {
        Row: {
          active: boolean
          auth: string
          browser: string | null
          created_at: string
          device_id: string
          endpoint: string
          id: string
          last_active_at: string
          p256dh: string
          platform: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          auth: string
          browser?: string | null
          created_at?: string
          device_id: string
          endpoint: string
          id?: string
          last_active_at?: string
          p256dh: string
          platform?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          auth?: string
          browser?: string | null
          created_at?: string
          device_id?: string
          endpoint?: string
          id?: string
          last_active_at?: string
          p256dh?: string
          platform?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      push_notification_logs: {
        Row: {
          body: string
          created_at: string
          device_id: string | null
          endpoint: string | null
          error: string | null
          event_type: string
          http_status: number | null
          id: string
          notification_id: string | null
          payload: Json
          recipient_role: string
          status: string
          title: string
          transaction_id: string | null
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          device_id?: string | null
          endpoint?: string | null
          error?: string | null
          event_type: string
          http_status?: number | null
          id?: string
          notification_id?: string | null
          payload?: Json
          recipient_role?: string
          status?: string
          title: string
          transaction_id?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          device_id?: string | null
          endpoint?: string | null
          error?: string | null
          event_type?: string
          http_status?: number | null
          id?: string
          notification_id?: string | null
          payload?: Json
          recipient_role?: string
          status?: string
          title?: string
          transaction_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_notification_logs_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_deposits: {
        Row: {
          amount: number
          created_at: string
          credited_at: string | null
          id: string
          reseller_id: string
          status: string
          transaction_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          credited_at?: string | null
          id?: string
          reseller_id: string
          status?: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          credited_at?: string | null
          id?: string
          reseller_id?: string
          status?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reseller_deposits_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_deposits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_prices: {
        Row: {
          active: boolean
          created_at: string
          duration_label: string
          duration_unit: string
          duration_value: number
          id: string
          plan_id: string | null
          price: number
          sort_order: number
          suggested_price: number | null
          tier_slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          duration_label: string
          duration_unit?: string
          duration_value?: number
          id?: string
          plan_id?: string | null
          price: number
          sort_order?: number
          suggested_price?: number | null
          tier_slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          duration_label?: string
          duration_unit?: string
          duration_value?: number
          id?: string
          plan_id?: string | null
          price?: number
          sort_order?: number
          suggested_price?: number | null
          tier_slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_prices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_prices_tier_slug_fkey"
            columns: ["tier_slug"]
            isOneToOne: false
            referencedRelation: "reseller_tiers"
            referencedColumns: ["slug"]
          },
        ]
      }
      reseller_sales: {
        Row: {
          cost: number
          created_at: string
          customer_id: string | null
          duration_label: string | null
          id: string
          license_id: string | null
          metadata: Json
          price_id: string | null
          profit: number | null
          reseller_id: string
          sale_price: number | null
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          cost: number
          created_at?: string
          customer_id?: string | null
          duration_label?: string | null
          id?: string
          license_id?: string | null
          metadata?: Json
          price_id?: string | null
          profit?: number | null
          reseller_id: string
          sale_price?: number | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          cost?: number
          created_at?: string
          customer_id?: string | null
          duration_label?: string | null
          id?: string
          license_id?: string | null
          metadata?: Json
          price_id?: string | null
          profit?: number | null
          reseller_id?: string
          sale_price?: number | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_sales_price_id_fkey"
            columns: ["price_id"]
            isOneToOne: false
            referencedRelation: "reseller_prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_sales_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_tiers: {
        Row: {
          active: boolean
          commission_rate: number
          created_at: string
          discount_rate: number
          id: string
          min_deposit: number
          name: string
          slug: string
          sort_order: number
          trials_granted: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          commission_rate?: number
          created_at?: string
          discount_rate?: number
          id?: string
          min_deposit?: number
          name: string
          slug: string
          sort_order?: number
          trials_granted?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          commission_rate?: number
          created_at?: string
          discount_rate?: number
          id?: string
          min_deposit?: number
          name?: string
          slug?: string
          sort_order?: number
          trials_granted?: number
          updated_at?: string
        }
        Relationships: []
      }
      resellers: {
        Row: {
          api_public_key: string | null
          api_secret_hash: string | null
          available_balance: number
          code: string
          commission_rate: number
          created_at: string
          discount_rate: number
          display_name: string | null
          id: string
          pending_balance: number
          slug: string | null
          status: string
          tier: string
          total_deposited: number
          trials_available: number
          trials_used: number
          user_id: string
        }
        Insert: {
          api_public_key?: string | null
          api_secret_hash?: string | null
          available_balance?: number
          code: string
          commission_rate?: number
          created_at?: string
          discount_rate?: number
          display_name?: string | null
          id?: string
          pending_balance?: number
          slug?: string | null
          status?: string
          tier?: string
          total_deposited?: number
          trials_available?: number
          trials_used?: number
          user_id: string
        }
        Update: {
          api_public_key?: string | null
          api_secret_hash?: string | null
          available_balance?: number
          code?: string
          commission_rate?: number
          created_at?: string
          discount_rate?: number
          display_name?: string | null
          id?: string
          pending_balance?: number
          slug?: string | null
          status?: string
          tier?: string
          total_deposited?: number
          trials_available?: number
          trials_used?: number
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string
          provider: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      token_allowances: {
        Row: {
          created_at: string
          id: string
          period_end: string | null
          plan_id: string | null
          source: string
          total: number
          transaction_id: string | null
          updated_at: string
          used: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          period_end?: string | null
          plan_id?: string | null
          source?: string
          total?: number
          transaction_id?: string | null
          updated_at?: string
          used?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          period_end?: string | null
          plan_id?: string | null
          source?: string
          total?: number
          transaction_id?: string | null
          updated_at?: string
          used?: number
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          affiliate_id: string | null
          amount: number
          checkout_url: string | null
          commission_registered: boolean | null
          created_at: string
          currency: string
          expires_at: string | null
          external_id: string | null
          id: string
          identifier: string
          metadata: Json
          method: string
          offer_id: string | null
          paid_at: string | null
          pix_code: string | null
          pix_qrcode: string | null
          plan_id: string | null
          product_id: string | null
          provider: string
          provider_transaction_id: string | null
          purpose: string
          raw: Json | null
          reseller_id: string | null
          splits: Json
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          affiliate_id?: string | null
          amount?: number
          checkout_url?: string | null
          commission_registered?: boolean | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          external_id?: string | null
          id?: string
          identifier: string
          metadata?: Json
          method?: string
          offer_id?: string | null
          paid_at?: string | null
          pix_code?: string | null
          pix_qrcode?: string | null
          plan_id?: string | null
          product_id?: string | null
          provider?: string
          provider_transaction_id?: string | null
          purpose?: string
          raw?: Json | null
          reseller_id?: string | null
          splits?: Json
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          affiliate_id?: string | null
          amount?: number
          checkout_url?: string | null
          commission_registered?: boolean | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          external_id?: string | null
          id?: string
          identifier?: string
          metadata?: Json
          method?: string
          offer_id?: string | null
          paid_at?: string | null
          pix_code?: string | null
          pix_qrcode?: string | null
          plan_id?: string | null
          product_id?: string | null
          provider?: string
          provider_transaction_id?: string | null
          purpose?: string
          raw?: Json | null
          reseller_id?: string | null
          splits?: Json
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      trials: {
        Row: {
          created_at: string
          device_hash: string | null
          document_hash: string | null
          email: string | null
          email_hash: string | null
          expires_at: string
          id: string
          installation_id: string | null
          ip_hash: string | null
          license_id: string | null
          metadata: Json
          phone_hash: string | null
          reseller_id: string | null
          started_at: string
          status: string
          updated_at: string
          used: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_hash?: string | null
          document_hash?: string | null
          email?: string | null
          email_hash?: string | null
          expires_at: string
          id?: string
          installation_id?: string | null
          ip_hash?: string | null
          license_id?: string | null
          metadata?: Json
          phone_hash?: string | null
          reseller_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          used?: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_hash?: string | null
          document_hash?: string | null
          email?: string | null
          email_hash?: string | null
          expires_at?: string
          id?: string
          installation_id?: string | null
          ip_hash?: string | null
          license_id?: string | null
          metadata?: Json
          phone_hash?: string | null
          reseller_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          used?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trials_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json | null
          payload_hash: string
          processed: boolean
          processed_at: string | null
          processing_status: string
          provider: string
          received_at: string
          token_hash: string | null
          transaction_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_id: string
          event_type: string
          id?: string
          payload?: Json | null
          payload_hash: string
          processed?: boolean
          processed_at?: string | null
          processing_status?: string
          provider: string
          received_at?: string
          token_hash?: string | null
          transaction_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json | null
          payload_hash?: string
          processed?: boolean
          processed_at?: string | null
          processing_status?: string
          provider?: string
          received_at?: string
          token_hash?: string | null
          transaction_id?: string | null
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          affiliate_id: string | null
          amount: number
          created_at: string
          error: string | null
          id: string
          identifier: string
          pix_key: string | null
          pix_key_type: string | null
          provider_transfer_id: string | null
          raw: Json | null
          reseller_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_id?: string | null
          amount: number
          created_at?: string
          error?: string | null
          id?: string
          identifier: string
          pix_key?: string | null
          pix_key_type?: string | null
          provider_transfer_id?: string | null
          raw?: Json | null
          reseller_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          affiliate_id?: string | null
          amount?: number
          created_at?: string
          error?: string | null
          id?: string
          identifier?: string
          pix_key?: string | null
          pix_key_type?: string | null
          provider_transfer_id?: string | null
          raw?: Json | null
          reseller_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawals_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_rate_limit: {
        Args: { _bucket: string; _identifier: string; _limit: number }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_affiliate_clicks: {
        Args: { aff_id: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      presence_heartbeat: {
        Args: { _session_id: string; _user_id?: string }
        Returns: number
      }
      presence_online_count: { Args: never; Returns: number }
    }
    Enums: {
      app_role:
        | "admin"
        | "user"
        | "super_admin"
        | "producer"
        | "reseller"
        | "affiliate"
      device_status: "active" | "removed" | "blocked"
      license_status:
        | "active"
        | "inactive"
        | "expired"
        | "revoked"
        | "suspended"
      subscription_status:
        | "pending"
        | "active"
        | "cancelled"
        | "expired"
        | "past_due"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "user",
        "super_admin",
        "producer",
        "reseller",
        "affiliate",
      ],
      device_status: ["active", "removed", "blocked"],
      license_status: ["active", "inactive", "expired", "revoked", "suspended"],
      subscription_status: [
        "pending",
        "active",
        "cancelled",
        "expired",
        "past_due",
      ],
    },
  },
} as const
