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
      bridge_dc_anchor: {
        Row: {
          anchor_chain_id: string | null
          anchor_chain_name: string | null
          dc_code: string
          id: number
        }
        Insert: {
          anchor_chain_id?: string | null
          anchor_chain_name?: string | null
          dc_code: string
          id?: never
        }
        Update: {
          anchor_chain_id?: string | null
          anchor_chain_name?: string | null
          dc_code?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "bridge_dc_anchor_anchor_chain_id_fkey"
            columns: ["anchor_chain_id"]
            isOneToOne: false
            referencedRelation: "dim_chain"
            referencedColumns: ["chain_id"]
          },
          {
            foreignKeyName: "bridge_dc_anchor_dc_code_fkey"
            columns: ["dc_code"]
            isOneToOne: false
            referencedRelation: "dim_dc"
            referencedColumns: ["dc_code"]
          },
        ]
      }
      dim_chain: {
        Row: {
          account_manager: string | null
          active: string | null
          case_cost: number | null
          chain_id: string
          chain_name: string | null
          channel: string | null
          current_srp: number | null
          distributor: string | null
          edlp: string | null
          green_spoon_manager: string | null
          infra_ncg: string | null
          region: string | null
          state: string | null
          total_universe: number | null
          transitional_to_dsd: string | null
        }
        Insert: {
          account_manager?: string | null
          active?: string | null
          case_cost?: number | null
          chain_id: string
          chain_name?: string | null
          channel?: string | null
          current_srp?: number | null
          distributor?: string | null
          edlp?: string | null
          green_spoon_manager?: string | null
          infra_ncg?: string | null
          region?: string | null
          state?: string | null
          total_universe?: number | null
          transitional_to_dsd?: string | null
        }
        Update: {
          account_manager?: string | null
          active?: string | null
          case_cost?: number | null
          chain_id?: string
          chain_name?: string | null
          channel?: string | null
          current_srp?: number | null
          distributor?: string | null
          edlp?: string | null
          green_spoon_manager?: string | null
          infra_ncg?: string | null
          region?: string | null
          state?: string | null
          total_universe?: number | null
          transitional_to_dsd?: string | null
        }
        Relationships: []
      }
      dim_contact: {
        Row: {
          chain_id: string | null
          contact_id: number
          contact_name: string | null
          dc_code: string | null
          email: string | null
          notes: string | null
          phone: string | null
          role: string | null
        }
        Insert: {
          chain_id?: string | null
          contact_id?: never
          contact_name?: string | null
          dc_code?: string | null
          email?: string | null
          notes?: string | null
          phone?: string | null
          role?: string | null
        }
        Update: {
          chain_id?: string | null
          contact_id?: never
          contact_name?: string | null
          dc_code?: string | null
          email?: string | null
          notes?: string | null
          phone?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dim_contact_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "dim_chain"
            referencedColumns: ["chain_id"]
          },
          {
            foreignKeyName: "dim_contact_dc_code_fkey"
            columns: ["dc_code"]
            isOneToOne: false
            referencedRelation: "dim_dc"
            referencedColumns: ["dc_code"]
          },
        ]
      }
      dim_dc: {
        Row: {
          buyer: string | null
          city: string | null
          dc_code: string
          dc_name: string | null
          dp_case_cost: number | null
          dp_margin: number | null
          gocrisp_name: string | null
          l52w_did_buys: number | null
          l52w_volume: number | null
          new_at_kehe: string | null
          odyssey_contact: string | null
          state: string | null
          territory: string | null
          type: string | null
          zip: string | null
        }
        Insert: {
          buyer?: string | null
          city?: string | null
          dc_code: string
          dc_name?: string | null
          dp_case_cost?: number | null
          dp_margin?: number | null
          gocrisp_name?: string | null
          l52w_did_buys?: number | null
          l52w_volume?: number | null
          new_at_kehe?: string | null
          odyssey_contact?: string | null
          state?: string | null
          territory?: string | null
          type?: string | null
          zip?: string | null
        }
        Update: {
          buyer?: string | null
          city?: string | null
          dc_code?: string
          dc_name?: string | null
          dp_case_cost?: number | null
          dp_margin?: number | null
          gocrisp_name?: string | null
          l52w_did_buys?: number | null
          l52w_volume?: number | null
          new_at_kehe?: string | null
          odyssey_contact?: string | null
          state?: string | null
          territory?: string | null
          type?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      dim_prospect: {
        Row: {
          channel: string | null
          contacted: string | null
          hq_state: string | null
          notes: string | null
          prospect_id: number
          prospect_name: string | null
          region: string | null
          rtm: string | null
          units: number | null
        }
        Insert: {
          channel?: string | null
          contacted?: string | null
          hq_state?: string | null
          notes?: string | null
          prospect_id?: never
          prospect_name?: string | null
          region?: string | null
          rtm?: string | null
          units?: number | null
        }
        Update: {
          channel?: string | null
          contacted?: string | null
          hq_state?: string | null
          notes?: string | null
          prospect_id?: never
          prospect_name?: string | null
          region?: string | null
          rtm?: string | null
          units?: number | null
        }
        Relationships: []
      }
      dim_sku: {
        Row: {
          case_dimensions: string | null
          case_weight: string | null
          dist_case_cost: number | null
          flavor: string | null
          gtin: string | null
          launch_date: string | null
          mg: string | null
          notes: string | null
          pack: string | null
          package_size: string | null
          pallet_config: string | null
          product_name: string | null
          product_status: string | null
          retail_upc: string | null
          sell_sheet_url: string | null
          shelf_life: string | null
          sku_code: string
          srp: number | null
        }
        Insert: {
          case_dimensions?: string | null
          case_weight?: string | null
          dist_case_cost?: number | null
          flavor?: string | null
          gtin?: string | null
          launch_date?: string | null
          mg?: string | null
          notes?: string | null
          pack?: string | null
          package_size?: string | null
          pallet_config?: string | null
          product_name?: string | null
          product_status?: string | null
          retail_upc?: string | null
          sell_sheet_url?: string | null
          shelf_life?: string | null
          sku_code: string
          srp?: number | null
        }
        Update: {
          case_dimensions?: string | null
          case_weight?: string | null
          dist_case_cost?: number | null
          flavor?: string | null
          gtin?: string | null
          launch_date?: string | null
          mg?: string | null
          notes?: string | null
          pack?: string | null
          package_size?: string | null
          pallet_config?: string | null
          product_name?: string | null
          product_status?: string | null
          retail_upc?: string | null
          sell_sheet_url?: string | null
          shelf_life?: string | null
          sku_code?: string
          srp?: number | null
        }
        Relationships: []
      }
      fact_calendar: {
        Row: {
          detail: string | null
          entity: string | null
          event_type: string | null
          id: number
          month: number | null
          title: string | null
          year: number | null
        }
        Insert: {
          detail?: string | null
          entity?: string | null
          event_type?: string | null
          id?: never
          month?: number | null
          title?: string | null
          year?: number | null
        }
        Update: {
          detail?: string | null
          entity?: string | null
          event_type?: string | null
          id?: never
          month?: number | null
          title?: string | null
          year?: number | null
        }
        Relationships: []
      }
      fact_category_review: {
        Row: {
          chain_id: string
          comments: string | null
          date_scheduled: string | null
          meeting_progress: string | null
          odyssey_in_2025: string | null
          odyssey_in_2026: string | null
          review_period_2026: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          chain_id: string
          comments?: string | null
          date_scheduled?: string | null
          meeting_progress?: string | null
          odyssey_in_2025?: string | null
          odyssey_in_2026?: string | null
          review_period_2026?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          chain_id?: string
          comments?: string | null
          date_scheduled?: string | null
          meeting_progress?: string | null
          odyssey_in_2025?: string | null
          odyssey_in_2026?: string | null
          review_period_2026?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fact_category_review_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: true
            referencedRelation: "dim_chain"
            referencedColumns: ["chain_id"]
          },
        ]
      }
      fact_chain_sku_auth: {
        Row: {
          auth_status: string | null
          chain_id: string
          sku_code: string
        }
        Insert: {
          auth_status?: string | null
          chain_id: string
          sku_code: string
        }
        Update: {
          auth_status?: string | null
          chain_id?: string
          sku_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "fact_chain_sku_auth_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "dim_chain"
            referencedColumns: ["chain_id"]
          },
          {
            foreignKeyName: "fact_chain_sku_auth_sku_code_fkey"
            columns: ["sku_code"]
            isOneToOne: false
            referencedRelation: "dim_sku"
            referencedColumns: ["sku_code"]
          },
        ]
      }
      fact_dc_sku_auth: {
        Row: {
          auth_status: string | null
          dc_code: string
          moq: number | null
          sku_code: string
        }
        Insert: {
          auth_status?: string | null
          dc_code: string
          moq?: number | null
          sku_code: string
        }
        Update: {
          auth_status?: string | null
          dc_code?: string
          moq?: number | null
          sku_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "fact_dc_sku_auth_dc_code_fkey"
            columns: ["dc_code"]
            isOneToOne: false
            referencedRelation: "dim_dc"
            referencedColumns: ["dc_code"]
          },
          {
            foreignKeyName: "fact_dc_sku_auth_sku_code_fkey"
            columns: ["sku_code"]
            isOneToOne: false
            referencedRelation: "dim_sku"
            referencedColumns: ["sku_code"]
          },
        ]
      }
      ref_dsd_coverage: {
        Row: {
          county: string | null
          county_state: string | null
          county_type: string | null
          distributor: string | null
          fips: string | null
          id: number
          state: string | null
        }
        Insert: {
          county?: string | null
          county_state?: string | null
          county_type?: string | null
          distributor?: string | null
          fips?: string | null
          id?: never
          state?: string | null
        }
        Update: {
          county?: string | null
          county_state?: string | null
          county_type?: string | null
          distributor?: string | null
          fips?: string | null
          id?: never
          state?: string | null
        }
        Relationships: []
      }
      ref_fees: {
        Row: {
          cost: string | null
          definition: string | null
          distributor: string | null
          fee: string | null
          id: number
        }
        Insert: {
          cost?: string | null
          definition?: string | null
          distributor?: string | null
          fee?: string | null
          id?: never
        }
        Update: {
          cost?: string | null
          definition?: string | null
          distributor?: string | null
          fee?: string | null
          id?: never
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
