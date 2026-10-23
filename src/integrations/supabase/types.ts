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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: never
        }
        Relationships: []
      }
      payment_attempts: {
        Row: {
          amount_cents: number
          created_at: string
          display_text: string | null
          id: string
          paystack_id: number | null
          phone: string
          provider_message: string | null
          provider_status: string | null
          reference: string
          rent_charge_id: string
          status: Database["public"]["Enums"]["attempt_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          display_text?: string | null
          id?: string
          paystack_id?: number | null
          phone: string
          provider_message?: string | null
          provider_status?: string | null
          reference: string
          rent_charge_id: string
          status?: Database["public"]["Enums"]["attempt_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          display_text?: string | null
          id?: string
          paystack_id?: number | null
          phone?: string
          provider_message?: string | null
          provider_status?: string | null
          reference?: string
          rent_charge_id?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_rent_charge_id_fkey"
            columns: ["rent_charge_id"]
            isOneToOne: false
            referencedRelation: "rent_charges"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          attempt_id: string
          balance_after_cents: number
          created_at: string
          id: string
          method: string
          paid_at: string
          paystack_reference: string
          receipt_number: string
          rent_charge_id: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          attempt_id: string
          balance_after_cents: number
          created_at?: string
          id?: string
          method?: string
          paid_at?: string
          paystack_reference: string
          receipt_number?: string
          rent_charge_id: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          attempt_id?: string
          balance_after_cents?: number
          created_at?: string
          id?: string
          method?: string
          paid_at?: string
          paystack_reference?: string
          receipt_number?: string
          rent_charge_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "payment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_rent_charge_id_fkey"
            columns: ["rent_charge_id"]
            isOneToOne: false
            referencedRelation: "rent_charges"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          email: string
          full_name: string
          gender: string
          id: string
          location: string
          phone: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          email?: string
          full_name?: string
          gender?: string
          id: string
          location?: string
          phone?: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          email?: string
          full_name?: string
          gender?: string
          id?: string
          location?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          admin_note: string
          created_at: string
          id: string
          occupants: number
          reference: string
          residence_id: string
          reviewed_at: string | null
          room_id: string
          semester_id: string
          status: Database["public"]["Enums"]["registration_status"]
          user_id: string
        }
        Insert: {
          admin_note?: string
          created_at?: string
          id?: string
          occupants: number
          reference?: string
          residence_id: string
          reviewed_at?: string | null
          room_id: string
          semester_id: string
          status?: Database["public"]["Enums"]["registration_status"]
          user_id: string
        }
        Update: {
          admin_note?: string
          created_at?: string
          id?: string
          occupants?: number
          reference?: string
          residence_id?: string
          reviewed_at?: string | null
          room_id?: string
          semester_id?: string
          status?: Database["public"]["Enums"]["registration_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_residence_id_fkey"
            columns: ["residence_id"]
            isOneToOne: false
            referencedRelation: "residences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_charges: {
        Row: {
          amount_cents: number
          created_at: string
          due_date: string
          id: string
          paid_cents: number
          reference: string
          room_id: string
          semester_id: string
          status: Database["public"]["Enums"]["charge_status"]
          tenancy_id: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          due_date: string
          id?: string
          paid_cents?: number
          reference?: string
          room_id: string
          semester_id: string
          status?: Database["public"]["Enums"]["charge_status"]
          tenancy_id: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          due_date?: string
          id?: string
          paid_cents?: number
          reference?: string
          room_id?: string
          semester_id?: string
          status?: Database["public"]["Enums"]["charge_status"]
          tenancy_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_charges_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_charges_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_charges_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      residences: {
        Row: {
          active: boolean
          created_at: string
          default_price_cents: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_price_cents?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_price_cents?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      room_notes: {
        Row: {
          maintenance_notes: string
          room_id: string
          updated_at: string
        }
        Insert: {
          maintenance_notes?: string
          room_id: string
          updated_at?: string
        }
        Update: {
          maintenance_notes?: string
          room_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_notes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          active: boolean
          created_at: string
          current_occupants: number
          description: string
          id: string
          max_occupancy: number
          residence_id: string
          room_number: string
          room_type: string
          semester_price_cents: number
          status: Database["public"]["Enums"]["room_status"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          current_occupants?: number
          description?: string
          id?: string
          max_occupancy?: number
          residence_id: string
          room_number: string
          room_type?: string
          semester_price_cents: number
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          current_occupants?: number
          description?: string
          id?: string
          max_occupancy?: number
          residence_id?: string
          room_number?: string
          room_type?: string
          semester_price_cents?: number
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_residence_id_fkey"
            columns: ["residence_id"]
            isOneToOne: false
            referencedRelation: "residences"
            referencedColumns: ["id"]
          },
        ]
      }
      semesters: {
        Row: {
          academic_year: string
          created_at: string
          end_date: string
          id: string
          name: string
          rent_due_date: string
          start_date: string
          status: string
        }
        Insert: {
          academic_year: string
          created_at?: string
          end_date: string
          id?: string
          name: string
          rent_due_date: string
          start_date: string
          status?: string
        }
        Update: {
          academic_year?: string
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          rent_due_date?: string
          start_date?: string
          status?: string
        }
        Relationships: []
      }
      tenancies: {
        Row: {
          ended_at: string | null
          id: string
          occupants: number
          registration_id: string | null
          room_id: string
          semester_id: string
          started_at: string
          status: Database["public"]["Enums"]["tenancy_status"]
          user_id: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          occupants: number
          registration_id?: string | null
          room_id: string
          semester_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["tenancy_status"]
          user_id: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          occupants?: number
          registration_id?: string | null
          room_id?: string
          semester_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["tenancy_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancies_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancies_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancies_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_registration: {
        Args: { _note?: string; _reg_id: string; _room_id?: string }
        Returns: string
      }
      end_tenancy: {
        Args: { _note?: string; _tenancy_id: string }
        Returns: undefined
      }
      finalize_payment: {
        Args: {
          _amount_cents: number
          _currency: string
          _paid_at: string
          _paystack_id: number
          _reference: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      reject_registration: {
        Args: { _note: string; _reg_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "tenant"
      attempt_status: "pending" | "success" | "failed" | "unmatched"
      charge_status: "unpaid" | "partially_paid" | "paid" | "overdue"
      registration_status: "pending" | "approved" | "rejected"
      room_status: "available" | "occupied" | "vacant" | "maintenance"
      tenancy_status: "active" | "ended"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "tenant"],
      attempt_status: ["pending", "success", "failed", "unmatched"],
      charge_status: ["unpaid", "partially_paid", "paid", "overdue"],
      registration_status: ["pending", "approved", "rejected"],
      room_status: ["available", "occupied", "vacant", "maintenance"],
      tenancy_status: ["active", "ended"],
    },
  },
} as const
