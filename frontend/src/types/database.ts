// Auto-generated from Supabase — do not manually edit the Database type.
// Regenerate with: npx supabase gen types typescript --project-id <id>

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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          alert_type: string
          explanation: string | null
          id: string
          person_id: string | null
          risk_score: number
          room_id: string | null
          timestamp: string
        }
        Insert: {
          alert_type?: string
          explanation?: string | null
          id?: string
          person_id?: string | null
          risk_score: number
          room_id?: string | null
          timestamp?: string
        }
        Update: {
          alert_type?: string
          explanation?: string | null
          id?: string
          person_id?: string | null
          risk_score?: number
          room_id?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_mappings: {
        Row: {
          connector_id: string
          created_at: string
          id: string
          mapping: Json
        }
        Insert: {
          connector_id: string
          created_at?: string
          id?: string
          mapping: Json
        }
        Update: {
          connector_id?: string
          created_at?: string
          id?: string
          mapping?: Json
        }
        Relationships: [
          {
            foreignKeyName: "connector_mappings_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: true
            referencedRelation: "connectors"
            referencedColumns: ["id"]
          },
        ]
      }
      connectors: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          last_seen_at: string | null
          property_id: string
          secret: string
          system: string
          vendor: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_seen_at?: string | null
          property_id: string
          secret: string
          system: string
          vendor: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_seen_at?: string | null
          property_id?: string
          secret?: string
          system?: string
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "connectors_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_events: {
        Row: {
          entry_count: number
          id: string
          person_count: number
          room_id: string
          timestamp: string
        }
        Insert: {
          entry_count?: number
          id?: string
          person_count?: number
          room_id: string
          timestamp?: string
        }
        Update: {
          entry_count?: number
          id?: string
          person_count?: number
          room_id?: string
          timestamp?: string
        }
        Relationships: []
      }
      cv_frame_analysis: {
        Row: {
          analysis_summary: string
          anomaly_signals: Json
          camera_id: string | null
          confidence: number
          created_at: string
          entry_event: boolean
          event_id: string | null
          id: string
          person_count: number
          room_id: string
          suspicion_score: number
          timestamp: string
          video_id: string
        }
        Insert: {
          analysis_summary?: string
          anomaly_signals?: Json
          camera_id?: string | null
          confidence?: number
          created_at?: string
          entry_event?: boolean
          event_id?: string | null
          id?: string
          person_count?: number
          room_id: string
          suspicion_score?: number
          timestamp: string
          video_id: string
        }
        Update: {
          analysis_summary?: string
          anomaly_signals?: Json
          camera_id?: string | null
          confidence?: number
          created_at?: string
          entry_event?: boolean
          event_id?: string | null
          id?: string
          person_count?: number
          room_id?: string
          suspicion_score?: number
          timestamp?: string
          video_id?: string
        }
        Relationships: []
      }
      cv_video_summaries: {
        Row: {
          created_at: string
          ended_at: string | null
          frame_count: number
          key_patterns: Json
          overall_risk_level: string
          overall_suspicion_score: number
          recommended_action: string
          room_id: string | null
          started_at: string | null
          updated_at: string
          video_id: string
          video_summary: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          frame_count?: number
          key_patterns?: Json
          overall_risk_level: string
          overall_suspicion_score?: number
          recommended_action: string
          room_id?: string | null
          started_at?: string | null
          updated_at?: string
          video_id: string
          video_summary: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          frame_count?: number
          key_patterns?: Json
          overall_risk_level?: string
          overall_suspicion_score?: number
          recommended_action?: string
          room_id?: string | null
          started_at?: string | null
          updated_at?: string
          video_id?: string
          video_summary?: string
        }
        Relationships: []
      }
      cv_risk_evidence: {
        Row: {
          analysis_summary: string
          anomaly_signals: Json
          created_at: string
          frame_timestamp: string
          frame_mime_type: string | null
          frame_image_base64: string | null
          id: string
          is_key_frame: boolean
          room_id: string
          storage_bucket: string
          storage_path: string
          suspicion_score: number
          video_id: string
        }
        Insert: {
          analysis_summary?: string
          anomaly_signals?: Json
          created_at?: string
          frame_timestamp: string
          frame_mime_type?: string | null
          frame_image_base64?: string | null
          id?: string
          is_key_frame?: boolean
          room_id: string
          storage_bucket?: string
          storage_path: string
          suspicion_score?: number
          video_id: string
        }
        Update: {
          analysis_summary?: string
          anomaly_signals?: Json
          created_at?: string
          frame_timestamp?: string
          frame_mime_type?: string | null
          frame_image_base64?: string | null
          id?: string
          is_key_frame?: boolean
          room_id?: string
          storage_bucket?: string
          storage_path?: string
          suspicion_score?: number
          video_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          connector_id: string
          created_at: string
          data: Json
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          occurred_at: string
          property_id: string
          raw_event_id: string | null
          room_id: string | null
          source_system: string
          source_vendor: string
        }
        Insert: {
          connector_id: string
          created_at?: string
          data?: Json
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          occurred_at: string
          property_id: string
          raw_event_id?: string | null
          room_id?: string | null
          source_system: string
          source_vendor: string
        }
        Update: {
          connector_id?: string
          created_at?: string
          data?: Json
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          occurred_at?: string
          property_id?: string
          raw_event_id?: string | null
          room_id?: string | null
          source_system?: string
          source_vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "connectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_raw_event_id_fkey"
            columns: ["raw_event_id"]
            isOneToOne: false
            referencedRelation: "raw_events"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_events: {
        Row: {
          event_type: string
          guest_name: string | null
          id: string
          room_id: string
          timestamp: string
          value: number | null
        }
        Insert: {
          event_type: string
          guest_name?: string | null
          id?: string
          room_id: string
          timestamp?: string
          value?: number | null
        }
        Update: {
          event_type?: string
          guest_name?: string | null
          id?: string
          room_id?: string
          timestamp?: string
          value?: number | null
        }
        Relationships: []
      }
      hotel_signup_requests: {
        Row: {
          approved_property_id: string | null
          contact_email: string | null
          contact_name: string | null
          created_at: string
          hotel_name: string
          id: string
          requested_connectors: Json
          requester_user_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_property_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          hotel_name: string
          id?: string
          requested_connectors?: Json
          requester_user_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_property_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          hotel_name?: string
          id?: string
          requested_connectors?: Json
          requester_user_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_signup_requests_approved_property_id_fkey"
            columns: ["approved_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      person_risk: {
        Row: {
          last_updated: string
          person_id: string
          risk_level: string
          risk_score: number
          score_breakdown: Json
        }
        Insert: {
          last_updated?: string
          person_id: string
          risk_level: string
          risk_score?: number
          score_breakdown?: Json
        }
        Update: {
          last_updated?: string
          person_id?: string
          risk_level?: string
          risk_score?: number
          score_breakdown?: Json
        }
        Relationships: [
          {
            foreignKeyName: "person_risk_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      person_room_history: {
        Row: {
          id: string
          person_id: string
          risk_score_at_time: number | null
          room_history: Json
          was_flagged_dangerous: boolean
        }
        Insert: {
          id?: string
          person_id: string
          risk_score_at_time?: number | null
          room_history?: Json
          was_flagged_dangerous?: boolean
        }
        Update: {
          id?: string
          person_id?: string
          risk_score_at_time?: number | null
          room_history?: Json
          was_flagged_dangerous?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "person_room_history_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      persons: {
        Row: {
          card_history: Json
          full_name: string
          id: string
          last_room_purchase_timestamp: string | null
        }
        Insert: {
          card_history?: Json
          full_name: string
          id?: string
          last_room_purchase_timestamp?: string | null
        }
        Update: {
          card_history?: Json
          full_name?: string
          id?: string
          last_room_purchase_timestamp?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          created_at: string
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      property_memberships: {
        Row: {
          created_at: string
          id: string
          property_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_memberships_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_events: {
        Row: {
          connector_id: string
          dedupe_key: string
          error: string | null
          id: string
          occurred_at: string | null
          payload: Json
          property_id: string
          received_at: string
          signature_valid: boolean
          system: string
          vendor: string
          vendor_event_id: string | null
        }
        Insert: {
          connector_id: string
          dedupe_key: string
          error?: string | null
          id?: string
          occurred_at?: string | null
          payload: Json
          property_id: string
          received_at?: string
          signature_valid?: boolean
          system: string
          vendor: string
          vendor_event_id?: string | null
        }
        Update: {
          connector_id?: string
          dedupe_key?: string
          error?: string | null
          id?: string
          occurred_at?: string | null
          payload?: Json
          property_id?: string
          received_at?: string
          signature_valid?: boolean
          system?: string
          vendor?: string
          vendor_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "raw_events_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "connectors"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          floor: number
          id: string
          is_active: boolean
          room_id: string
        }
        Insert: {
          created_at?: string
          floor: number
          id?: string
          is_active?: boolean
          room_id: string
        }
        Update: {
          created_at?: string
          floor?: number
          id?: string
          is_active?: boolean
          room_id?: string
        }
        Relationships: []
      }
      room_risk: {
        Row: {
          last_updated: string
          risk_score: number
          room_id: string
        }
        Insert: {
          last_updated?: string
          risk_score?: number
          room_id: string
        }
        Update: {
          last_updated?: string
          risk_score?: number
          room_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      compute_room_risk: {
        Args: { p_room_id: string; p_window_minutes?: number }
        Returns: {
          explanation: string
          risk_score: number
          score_breakdown: Json
        }[]
      }
      compute_person_risk: {
        Args: { p_person_id: string }
        Returns: {
          risk_level: string
          risk_score: number
          score_breakdown: Json
          trigger_room_id: string
        }[]
      }
      refresh_person_risk: {
        Args: never
        Returns: number
      }
      refresh_room_risk: {
        Args: {
          p_lookback_hours?: number
          p_room_ids?: string[] | null
          p_window_minutes?: number
        }
        Returns: number
      }
      try_parse_timestamptz: { Args: { p_text: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

// Convenience row types
export type RoomRiskRow = Tables<"room_risk">
export type AlertRow = Tables<"alerts">
export type HotelEventRow = Tables<"hotel_events">
export type CvEventRow = Tables<"cv_events">
export type CvVideoSummaryRow = Tables<"cv_video_summaries">
export type CvRiskEvidenceRow = Tables<"cv_risk_evidence">
export type PersonRow = Tables<"persons">
export type ProfileRow = Tables<"profiles">
export type RoomRow = Tables<"rooms">
export type PersonRiskRow = Tables<"person_risk">
export type PersonRoomHistoryRow = Tables<"person_room_history">

// Convenience insert/update types
export type RoomRiskInsert = TablesInsert<"room_risk">
export type RoomRiskUpdate = TablesUpdate<"room_risk">
export type AlertInsert = TablesInsert<"alerts">
export type AlertUpdate = TablesUpdate<"alerts">

// Display-layer type used by alert UIs for deduped "current room alert" views.
export type CurrentAlertedRoom = {
  room_id: AlertRow["room_id"]
  latest_alert: AlertRow
  alert_count: number
  max_risk_score: AlertRow["risk_score"]
}

// Signal weights as defined in the PRD
export const SIGNAL_WEIGHTS = {
  short_stay: 2,
  linen_spike: 3,
  keycard_reset: 3,
  cv_traffic_anomaly: 5,
} as const

export type EventType = keyof typeof SIGNAL_WEIGHTS
