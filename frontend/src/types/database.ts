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
          explanation: string | null
          id: string
          risk_score: number
          room_id: string
          timestamp: string
        }
        Insert: {
          explanation?: string | null
          id?: string
          risk_score: number
          room_id: string
          timestamp?: string
        }
        Update: {
          explanation?: string | null
          id?: string
          risk_score?: number
          room_id?: string
          timestamp?: string
        }
        Relationships: []
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
      person_room_history: {
        Row: {
          id: string
          person_id: string
          purchase_timestamp: string
          risk_score_at_time: number | null
          room_id: string
          was_flagged_dangerous: boolean
        }
        Insert: {
          id?: string
          person_id: string
          purchase_timestamp?: string
          risk_score_at_time?: number | null
          room_id: string
          was_flagged_dangerous?: boolean
        }
        Update: {
          id?: string
          person_id?: string
          purchase_timestamp?: string
          risk_score_at_time?: number | null
          room_id?: string
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
          full_name: string
          id: string
          last_room_purchase_timestamp: string | null
        }
        Insert: {
          full_name: string
          id?: string
          last_room_purchase_timestamp?: string | null
        }
        Update: {
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
      [_ in never]: never
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

// Convenience row types
export type RoomRiskRow = Tables<"room_risk">
export type AlertRow = Tables<"alerts">
export type HotelEventRow = Tables<"hotel_events">
export type CvEventRow = Tables<"cv_events">
export type PersonRow = Tables<"persons">
export type PersonRoomHistoryRow = Tables<"person_room_history">

// Signal weights as defined in the PRD
export const SIGNAL_WEIGHTS = {
  short_stay: 2,
  linen_spike: 3,
  keycard_reset: 3,
  cv_traffic_anomaly: 5,
} as const

export type EventType = keyof typeof SIGNAL_WEIGHTS
