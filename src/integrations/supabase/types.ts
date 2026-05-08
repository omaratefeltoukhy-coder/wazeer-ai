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
      ad_analytics: {
        Row: {
          ad_views: number
          campaign_id: string
          created_at: string
          date: string
          id: string
          leads: number
          page_visits: number
          spend: number
          workspace_id: string
        }
        Insert: {
          ad_views?: number
          campaign_id: string
          created_at?: string
          date: string
          id?: string
          leads?: number
          page_visits?: number
          spend?: number
          workspace_id: string
        }
        Update: {
          ad_views?: number
          campaign_id?: string
          created_at?: string
          date?: string
          id?: string
          leads?: number
          page_visits?: number
          spend?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_analytics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_campaigns: {
        Row: {
          ad_variants: Json
          audience_type: string | null
          budget_daily: number
          business_id: string | null
          created_at: string
          end_date: string | null
          id: string
          locations: Json
          meta_campaign_id: string | null
          name: string
          objective: string | null
          product_id: string | null
          result_count: number
          spent_amount: number
          start_date: string | null
          status: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          ad_variants?: Json
          audience_type?: string | null
          budget_daily?: number
          business_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          locations?: Json
          meta_campaign_id?: string | null
          name: string
          objective?: string | null
          product_id?: string | null
          result_count?: number
          spent_amount?: number
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          ad_variants?: Json
          audience_type?: string | null
          budget_daily?: number
          business_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          locations?: Json
          meta_campaign_id?: string | null
          name?: string
          objective?: string | null
          product_id?: string | null
          result_count?: number
          spent_amount?: number
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      ai_content: {
        Row: {
          business_id: string | null
          content_type: string
          created_at: string
          format: string | null
          goal: string | null
          id: string
          metadata: Json
          product_id: string | null
          prompt: string | null
          result_url: string | null
          script_text: string | null
          status: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          business_id?: string | null
          content_type: string
          created_at?: string
          format?: string | null
          goal?: string | null
          id?: string
          metadata?: Json
          product_id?: string | null
          prompt?: string | null
          result_url?: string | null
          script_text?: string | null
          status?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          business_id?: string | null
          content_type?: string
          created_at?: string
          format?: string | null
          goal?: string | null
          id?: string
          metadata?: Json
          product_id?: string | null
          prompt?: string | null
          result_url?: string | null
          script_text?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      ai_recommendations: {
        Row: {
          action_json: Json | null
          business_id: string
          category: string
          confidence_score: number | null
          created_at: string
          id: string
          priority: Database["public"]["Enums"]["recommendation_priority"]
          problem: string | null
          recommendation: string | null
          status: Database["public"]["Enums"]["recommendation_status"]
          title: string
          updated_at: string
        }
        Insert: {
          action_json?: Json | null
          business_id: string
          category: string
          confidence_score?: number | null
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["recommendation_priority"]
          problem?: string | null
          recommendation?: string | null
          status?: Database["public"]["Enums"]["recommendation_status"]
          title: string
          updated_at?: string
        }
        Update: {
          action_json?: Json | null
          business_id?: string
          category?: string
          confidence_score?: number | null
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["recommendation_priority"]
          problem?: string | null
          recommendation?: string | null
          status?: Database["public"]["Enums"]["recommendation_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          business_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          metadata_json: Json
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          business_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          metadata_json?: Json
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          business_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          metadata_json?: Json
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          created_at: string
          event_type: string
          external_event_id: string | null
          id: string
          payload_json: Json
          processed_at: string | null
          provider: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          external_event_id?: string | null
          id?: string
          payload_json?: Json
          processed_at?: string | null
          provider?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          external_event_id?: string | null
          id?: string
          payload_json?: Json
          processed_at?: string | null
          provider?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      brand_profiles: {
        Row: {
          audience_json: Json | null
          benefits_json: Json | null
          brand_name: string | null
          business_id: string
          colors_json: Json | null
          created_at: string
          id: string
          objections_json: Json | null
          pain_points_json: Json | null
          positioning: string | null
          tone: string | null
          updated_at: string
          visual_style: string | null
        }
        Insert: {
          audience_json?: Json | null
          benefits_json?: Json | null
          brand_name?: string | null
          business_id: string
          colors_json?: Json | null
          created_at?: string
          id?: string
          objections_json?: Json | null
          pain_points_json?: Json | null
          positioning?: string | null
          tone?: string | null
          updated_at?: string
          visual_style?: string | null
        }
        Update: {
          audience_json?: Json | null
          benefits_json?: Json | null
          brand_name?: string | null
          business_id?: string
          colors_json?: Json | null
          created_at?: string
          id?: string
          objections_json?: Json | null
          pain_points_json?: Json | null
          positioning?: string | null
          tone?: string | null
          updated_at?: string
          visual_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_inputs: {
        Row: {
          business_id: string
          created_at: string
          extracted_data_json: Json | null
          id: string
          input_type: string
          original_text: string | null
          uploaded_file_url: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          extracted_data_json?: Json | null
          id?: string
          input_type: string
          original_text?: string | null
          uploaded_file_url?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          extracted_data_json?: Json | null
          id?: string
          input_type?: string
          original_text?: string | null
          uploaded_file_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_inputs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          category: string | null
          country: string | null
          created_at: string
          currency: string | null
          description: string | null
          desired_result: string | null
          generation_log_json: Json
          goal: string | null
          id: string
          language: string | null
          name: string
          pain_point: string | null
          status: string
          target_audience: string | null
          type: Database["public"]["Enums"]["business_type"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          category?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          desired_result?: string | null
          generation_log_json?: Json
          goal?: string | null
          id?: string
          language?: string | null
          name: string
          pain_point?: string | null
          status?: string
          target_audience?: string | null
          type?: Database["public"]["Enums"]["business_type"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          category?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          desired_result?: string | null
          generation_log_json?: Json
          goal?: string | null
          id?: string
          language?: string | null
          name?: string
          pain_point?: string | null
          status?: string
          target_audience?: string | null
          type?: Database["public"]["Enums"]["business_type"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "businesses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          business_id: string
          consent_at: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          phone: string | null
          source: string | null
          status: string | null
          tags_json: Json | null
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          consent_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          source?: string | null
          status?: string | null
          tags_json?: Json | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          consent_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          source?: string | null
          status?: string | null
          tags_json?: Json | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_grants: {
        Row: {
          amount: number
          balance: number
          created_at: string
          expires_at: string | null
          id: string
          metadata_json: Json
          source: string
          workspace_id: string
        }
        Insert: {
          amount: number
          balance: number
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata_json?: Json
          source: string
          workspace_id: string
        }
        Update: {
          amount?: number
          balance?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata_json?: Json
          source?: string
          workspace_id?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          metadata_json: Json | null
          reason: string | null
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          metadata_json?: Json | null
          reason?: string | null
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          metadata_json?: Json | null
          reason?: string | null
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automations: {
        Row: {
          automation_type: string | null
          body_html: string | null
          business_id: string
          created_at: string
          delay_minutes: number
          id: string
          is_active: boolean
          name: string
          opens_count: number
          sent_count: number
          status: Database["public"]["Enums"]["automation_status"]
          steps_json: Json | null
          subject: string | null
          trigger_type: string | null
          updated_at: string
        }
        Insert: {
          automation_type?: string | null
          body_html?: string | null
          business_id: string
          created_at?: string
          delay_minutes?: number
          id?: string
          is_active?: boolean
          name: string
          opens_count?: number
          sent_count?: number
          status?: Database["public"]["Enums"]["automation_status"]
          steps_json?: Json | null
          subject?: string | null
          trigger_type?: string | null
          updated_at?: string
        }
        Update: {
          automation_type?: string | null
          body_html?: string | null
          business_id?: string
          created_at?: string
          delay_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          opens_count?: number
          sent_count?: number
          status?: Database["public"]["Enums"]["automation_status"]
          steps_json?: Json | null
          subject?: string | null
          trigger_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_automations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          audience_type: string | null
          body_html: string | null
          bounces_count: number
          business_id: string
          clicks_count: number
          content_json: Json | null
          created_at: string
          id: string
          name: string
          opens_count: number
          recipients_count: number
          scheduled_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status"]
          subject: string | null
          type: string | null
          unsubscribes_count: number
          updated_at: string
        }
        Insert: {
          audience_type?: string | null
          body_html?: string | null
          bounces_count?: number
          business_id: string
          clicks_count?: number
          content_json?: Json | null
          created_at?: string
          id?: string
          name: string
          opens_count?: number
          recipients_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string | null
          type?: string | null
          unsubscribes_count?: number
          updated_at?: string
        }
        Update: {
          audience_type?: string | null
          body_html?: string | null
          bounces_count?: number
          business_id?: string
          clicks_count?: number
          content_json?: Json | null
          created_at?: string
          id?: string
          name?: string
          opens_count?: number
          recipients_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string | null
          type?: string | null
          unsubscribes_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          business_id: string
          campaign_id: string | null
          contact_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata_json: Json | null
        }
        Insert: {
          business_id: string
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata_json?: Json | null
        }
        Update: {
          business_id?: string
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages: {
        Row: {
          body_markdown: string | null
          business_id: string
          campaign_id: string
          created_at: string
          cta_text: string | null
          cta_url_placeholder: string | null
          goal: string | null
          id: string
          name: string
          personalization_fields: Json
          position: number
          preview_text: string | null
          scheduled_at: string | null
          send_delay: string | null
          sent_at: string | null
          status: string
          subject_line: string
          success_metric: string | null
          updated_at: string
        }
        Insert: {
          body_markdown?: string | null
          business_id: string
          campaign_id: string
          created_at?: string
          cta_text?: string | null
          cta_url_placeholder?: string | null
          goal?: string | null
          id?: string
          name: string
          personalization_fields?: Json
          position?: number
          preview_text?: string | null
          scheduled_at?: string | null
          send_delay?: string | null
          sent_at?: string | null
          status?: string
          subject_line: string
          success_metric?: string | null
          updated_at?: string
        }
        Update: {
          body_markdown?: string | null
          business_id?: string
          campaign_id?: string
          created_at?: string
          cta_text?: string | null
          cta_url_placeholder?: string | null
          goal?: string | null
          id?: string
          name?: string
          personalization_fields?: Json
          position?: number
          preview_text?: string | null
          scheduled_at?: string | null
          send_delay?: string | null
          sent_at?: string | null
          status?: string
          subject_line?: string
          success_metric?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          business_id: string
          contact_id: string | null
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          business_id: string
          contact_id?: string | null
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          business_id?: string
          contact_id?: string | null
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_usd: number
          created_at: string
          currency: string
          description: string | null
          external_invoice_id: string | null
          id: string
          kind: string
          metadata_json: Json
          pdf_url: string | null
          status: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          currency?: string
          description?: string | null
          external_invoice_id?: string | null
          id?: string
          kind?: string
          metadata_json?: Json
          pdf_url?: string | null
          status?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          currency?: string
          description?: string | null
          external_invoice_id?: string | null
          id?: string
          kind?: string
          metadata_json?: Json
          pdf_url?: string | null
          status?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          business_id: string
          created_at: string
          file_url: string | null
          id: string
          metadata_json: Json | null
          prompt: string | null
          source: Database["public"]["Enums"]["media_source"]
          status: string | null
          type: Database["public"]["Enums"]["media_type"]
        }
        Insert: {
          business_id: string
          created_at?: string
          file_url?: string | null
          id?: string
          metadata_json?: Json | null
          prompt?: string | null
          source: Database["public"]["Enums"]["media_source"]
          status?: string | null
          type: Database["public"]["Enums"]["media_type"]
        }
        Update: {
          business_id?: string
          created_at?: string
          file_url?: string | null
          id?: string
          metadata_json?: Json | null
          prompt?: string | null
          source?: Database["public"]["Enums"]["media_source"]
          status?: string | null
          type?: Database["public"]["Enums"]["media_type"]
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ads: {
        Row: {
          approval_status: string
          business_id: string
          campaign_id: string | null
          copy_json: Json
          created_at: string
          creative_id: string | null
          cta: string | null
          external_ad_id: string | null
          headline: string | null
          id: string
          insights_json: Json | null
          media_asset_id: string | null
          paused_at: string | null
          primary_text: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          updated_at: string
        }
        Insert: {
          approval_status?: string
          business_id: string
          campaign_id?: string | null
          copy_json?: Json
          created_at?: string
          creative_id?: string | null
          cta?: string | null
          external_ad_id?: string | null
          headline?: string | null
          id?: string
          insights_json?: Json | null
          media_asset_id?: string | null
          paused_at?: string | null
          primary_text?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Update: {
          approval_status?: string
          business_id?: string
          campaign_id?: string | null
          copy_json?: Json
          created_at?: string
          creative_id?: string | null
          cta?: string | null
          external_ad_id?: string | null
          headline?: string | null
          id?: string
          insights_json?: Json | null
          media_asset_id?: string | null
          paused_at?: string | null
          primary_text?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ads_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "meta_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ads_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_campaigns: {
        Row: {
          audience_json: Json
          budget: number | null
          business_id: string
          created_at: string
          daily_budget: number | null
          end_date: string | null
          external_campaign_id: string | null
          goal: string | null
          id: string
          insights_json: Json | null
          name: string
          objective: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          total_budget: number | null
          updated_at: string
        }
        Insert: {
          audience_json?: Json
          budget?: number | null
          business_id: string
          created_at?: string
          daily_budget?: number | null
          end_date?: string | null
          external_campaign_id?: string | null
          goal?: string | null
          id?: string
          insights_json?: Json | null
          name: string
          objective?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          total_budget?: number | null
          updated_at?: string
        }
        Update: {
          audience_json?: Json
          budget?: number | null
          business_id?: string
          created_at?: string
          daily_budget?: number | null
          end_date?: string | null
          external_campaign_id?: string | null
          goal?: string | null
          id?: string
          insights_json?: Json | null
          name?: string
          objective?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          total_budget?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_campaigns_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_connections: {
        Row: {
          ad_account_id: string | null
          business_id: string
          created_at: string
          encrypted_token: string | null
          error_message: string | null
          id: string
          instagram_account_id: string | null
          kind: string
          label: string | null
          last_synced_at: string | null
          metadata_json: Json
          page_id: string | null
          permissions_json: Json | null
          provider: string
          token_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_account_id?: string | null
          business_id: string
          created_at?: string
          encrypted_token?: string | null
          error_message?: string | null
          id?: string
          instagram_account_id?: string | null
          kind?: string
          label?: string | null
          last_synced_at?: string | null
          metadata_json?: Json
          page_id?: string | null
          permissions_json?: Json | null
          provider?: string
          token_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_account_id?: string | null
          business_id?: string
          created_at?: string
          encrypted_token?: string | null
          error_message?: string | null
          id?: string
          instagram_account_id?: string | null
          kind?: string
          label?: string | null
          last_synced_at?: string | null
          metadata_json?: Json
          page_id?: string | null
          permissions_json?: Json | null
          provider?: string
          token_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_connections_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_posts: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          business_id: string
          caption: string | null
          created_at: string
          cta_text: string | null
          error_message: string | null
          external_post_id: string | null
          hashtags: string | null
          id: string
          insights_json: Json | null
          media_asset_id: string | null
          platform: Database["public"]["Enums"]["meta_platform"]
          post_type: string | null
          published_at: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["post_status"]
          updated_at: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          business_id: string
          caption?: string | null
          created_at?: string
          cta_text?: string | null
          error_message?: string | null
          external_post_id?: string | null
          hashtags?: string | null
          id?: string
          insights_json?: Json | null
          media_asset_id?: string | null
          platform: Database["public"]["Enums"]["meta_platform"]
          post_type?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          updated_at?: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          business_id?: string
          caption?: string | null
          created_at?: string
          cta_text?: string | null
          error_message?: string | null
          external_post_id?: string | null
          hashtags?: string | null
          id?: string
          insights_json?: Json | null
          media_asset_id?: string | null
          platform?: Database["public"]["Enums"]["meta_platform"]
          post_type?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_posts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_posts_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          billing_interval: string | null
          business_id: string
          created_at: string
          currency: string | null
          description: string | null
          discount_json: Json | null
          free_trial_days: number | null
          id: string
          name: string
          price: number | null
          status: Database["public"]["Enums"]["offer_status"]
          type: Database["public"]["Enums"]["business_type"]
          updated_at: string
        }
        Insert: {
          billing_interval?: string | null
          business_id: string
          created_at?: string
          currency?: string | null
          description?: string | null
          discount_json?: Json | null
          free_trial_days?: number | null
          id?: string
          name: string
          price?: number | null
          status?: Database["public"]["Enums"]["offer_status"]
          type?: Database["public"]["Enums"]["business_type"]
          updated_at?: string
        }
        Update: {
          billing_interval?: string | null
          business_id?: string
          created_at?: string
          currency?: string | null
          description?: string | null
          discount_json?: Json | null
          free_trial_days?: number | null
          id?: string
          name?: string
          price?: number | null
          status?: Database["public"]["Enums"]["offer_status"]
          type?: Database["public"]["Enums"]["business_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          currency: string | null
          customer_id: string | null
          id: string
          metadata_json: Json | null
          offer_id: string | null
          payment_status: string | null
          source: string | null
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          id?: string
          metadata_json?: Json | null
          offer_id?: string | null
          payment_status?: string | null
          source?: string | null
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          id?: string
          metadata_json?: Json | null
          offer_id?: string | null
          payment_status?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links: {
        Row: {
          amount: number
          clicks: number
          collect_phone: boolean
          created_at: string
          currency: string
          custom_title: string | null
          description: string | null
          id: string
          is_active: boolean
          pass_fee_to_buyer: boolean
          product_id: string | null
          redirect_url: string | null
          sales_count: number
          thank_you_message: string | null
          unique_code: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          amount?: number
          clicks?: number
          collect_phone?: boolean
          created_at?: string
          currency?: string
          custom_title?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          pass_fee_to_buyer?: boolean
          product_id?: string | null
          redirect_url?: string | null
          sales_count?: number
          thank_you_message?: string | null
          unique_code: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          amount?: number
          clicks?: number
          collect_phone?: boolean
          created_at?: string
          currency?: string
          custom_title?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          pass_fee_to_buyer?: boolean
          product_id?: string | null
          redirect_url?: string | null
          sales_count?: number
          thank_you_message?: string | null
          unique_code?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      payout_methods: {
        Row: {
          created_at: string
          details: Json
          id: string
          is_default: boolean
          method_type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          is_default?: boolean
          method_type: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          is_default?: boolean
          method_type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      payouts: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          paid_date: string | null
          scheduled_date: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          paid_date?: string | null
          scheduled_date?: string | null
          status?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          paid_date?: string | null
          scheduled_date?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: []
      }
      performance_snapshots: {
        Row: {
          business_id: string
          created_at: string
          id: string
          metrics_json: Json | null
          period_end: string
          period_start: string
          source: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          metrics_json?: Json | null
          period_end: string
          period_start: string
          source: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          metrics_json?: Json | null
          period_end?: string
          period_start?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_snapshots_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      pixel_integrations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          pixel_id: string | null
          provider: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          pixel_id?: string | null
          provider: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          pixel_id?: string | null
          provider?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          business_id: string | null
          cover_image_url: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          metadata: Json
          price: number
          revenue_total: number
          sales_count: number
          status: Database["public"]["Enums"]["product_status"]
          title: string
          type: Database["public"]["Enums"]["product_type"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          business_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json
          price?: number
          revenue_total?: number
          sales_count?: number
          status?: Database["public"]["Enums"]["product_status"]
          title: string
          type: Database["public"]["Enums"]["product_type"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          business_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json
          price?: number
          revenue_total?: number
          sales_count?: number
          status?: Database["public"]["Enums"]["product_status"]
          title?: string
          type?: Database["public"]["Enums"]["product_type"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      storefronts: {
        Row: {
          business_id: string
          content_json: Json | null
          created_at: string
          id: string
          published_url: string | null
          slug: string
          status: Database["public"]["Enums"]["storefront_status"]
          title: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          content_json?: Json | null
          created_at?: string
          id?: string
          published_url?: string | null
          slug: string
          status?: Database["public"]["Enums"]["storefront_status"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          content_json?: Json | null
          created_at?: string
          id?: string
          published_url?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["storefront_status"]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefronts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string | null
          paddle_price_id: string | null
          paddle_product_id: string | null
          paddle_subscription_id: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string | null
          paddle_price_id?: string | null
          paddle_product_id?: string | null
          paddle_subscription_id?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string | null
          paddle_price_id?: string | null
          paddle_product_id?: string | null
          paddle_subscription_id?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      suppression_list: {
        Row: {
          business_id: string
          created_at: string
          email: string
          id: string
          metadata_json: Json
          reason: string
          source: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          email: string
          id?: string
          metadata_json?: Json
          reason?: string
          source?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          email?: string
          id?: string
          metadata_json?: Json
          reason?: string
          source?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          buyer_email: string | null
          buyer_name: string | null
          created_at: string
          currency: string
          id: string
          product_id: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          amount?: number
          buyer_email?: string | null
          buyer_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          product_id?: string | null
          status?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          buyer_email?: string | null
          buyer_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          product_id?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: []
      }
      ugc_scripts: {
        Row: {
          business_id: string
          created_at: string
          id: string
          performance_score: number | null
          platform: string | null
          script_json: Json | null
          status: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          performance_score?: number | null
          platform?: string | null
          script_json?: Json | null
          status?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          performance_score?: number | null
          platform?: string | null
          script_json?: Json | null
          status?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ugc_scripts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      ugc_videos: {
        Row: {
          business_id: string
          created_at: string
          error_message: string | null
          id: string
          provider_job_id: string | null
          script_id: string | null
          status: Database["public"]["Enums"]["video_status"]
          storyboard_json: Json | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          provider_job_id?: string | null
          script_id?: string | null
          status?: Database["public"]["Enums"]["video_status"]
          storyboard_json?: Json | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          provider_job_id?: string | null
          script_id?: string | null
          status?: Database["public"]["Enums"]["video_status"]
          storyboard_json?: Json | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ugc_videos_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ugc_videos_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "ugc_scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          count: number
          feature: string
          id: string
          period_start: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          count?: number
          feature: string
          id?: string
          period_start: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          count?: number
          feature?: string
          id?: string
          period_start?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_business: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
      consume_credits: {
        Args: {
          _amount: number
          _metadata?: Json
          _reason: string
          _workspace_id: string
        }
        Returns: boolean
      }
      decrypt_meta_token: {
        Args: { _cipher: string; _key: string }
        Returns: string
      }
      encrypt_meta_token: {
        Args: { _key: string; _plaintext: string }
        Returns: string
      }
      has_workspace_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      increment_payment_link_clicks: {
        Args: { _code: string }
        Returns: undefined
      }
      increment_usage: {
        Args: { _by?: number; _feature: string; _workspace_id: string }
        Returns: undefined
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "editor" | "viewer"
      automation_status: "active" | "paused" | "draft"
      business_type:
        | "physical_product"
        | "digital_product"
        | "service"
        | "course"
        | "coaching"
        | "membership"
        | "event"
        | "subscription"
        | "other"
      campaign_status: "draft" | "active" | "paused" | "completed" | "failed"
      email_status: "draft" | "scheduled" | "sent" | "failed"
      media_source: "uploaded" | "ai_generated"
      media_type: "image" | "video"
      meta_platform: "facebook" | "instagram"
      offer_status: "draft" | "active" | "archived"
      post_status: "draft" | "approved" | "scheduled" | "posted" | "failed"
      product_status: "draft" | "published" | "archived"
      product_type:
        | "physical_product"
        | "digital_file"
        | "online_course"
        | "live_event"
        | "coaching"
        | "challenge"
        | "lead_form"
        | "membership"
      recommendation_priority: "low" | "medium" | "high"
      recommendation_status: "open" | "dismissed" | "done"
      storefront_status: "draft" | "published" | "unpublished"
      subscription_plan: "trial" | "starter" | "growth" | "pro" | "agency"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "unpaid"
      video_status: "draft" | "rendering" | "ready" | "failed" | "posted"
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
      app_role: ["owner", "admin", "editor", "viewer"],
      automation_status: ["active", "paused", "draft"],
      business_type: [
        "physical_product",
        "digital_product",
        "service",
        "course",
        "coaching",
        "membership",
        "event",
        "subscription",
        "other",
      ],
      campaign_status: ["draft", "active", "paused", "completed", "failed"],
      email_status: ["draft", "scheduled", "sent", "failed"],
      media_source: ["uploaded", "ai_generated"],
      media_type: ["image", "video"],
      meta_platform: ["facebook", "instagram"],
      offer_status: ["draft", "active", "archived"],
      post_status: ["draft", "approved", "scheduled", "posted", "failed"],
      product_status: ["draft", "published", "archived"],
      product_type: [
        "physical_product",
        "digital_file",
        "online_course",
        "live_event",
        "coaching",
        "challenge",
        "lead_form",
        "membership",
      ],
      recommendation_priority: ["low", "medium", "high"],
      recommendation_status: ["open", "dismissed", "done"],
      storefront_status: ["draft", "published", "unpublished"],
      subscription_plan: ["trial", "starter", "growth", "pro", "agency"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "unpaid",
      ],
      video_status: ["draft", "rendering", "ready", "failed", "posted"],
    },
  },
} as const
