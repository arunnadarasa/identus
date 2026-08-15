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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          connection_id: string | null
          created_at: string
          detail: Json | null
          id: string
          kind: string
          status: string
          summary: string | null
          user_id: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
          kind: string
          status?: string
          summary?: string | null
          user_id: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
          kind?: string
          status?: string
          summary?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "agent_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_connections: {
        Row: {
          api_key: string | null
          base_url: string | null
          created_at: string
          fly_app_name: string | null
          fly_region: string | null
          id: string
          is_active: boolean
          last_checked_at: string | null
          last_health: string | null
          last_probe: Json | null
          mode: string
          name: string
          provision_log: Json
          provision_status: string | null
          readiness_attempts: number
          readiness_started_at: string | null
          readiness_status: string
          ready_at: string | null
          updated_at: string
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          api_key?: string | null
          base_url?: string | null
          created_at?: string
          fly_app_name?: string | null
          fly_region?: string | null
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          last_health?: string | null
          last_probe?: Json | null
          mode?: string
          name: string
          provision_log?: Json
          provision_status?: string | null
          readiness_attempts?: number
          readiness_started_at?: string | null
          readiness_status?: string
          ready_at?: string | null
          updated_at?: string
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          api_key?: string | null
          base_url?: string | null
          created_at?: string
          fly_app_name?: string | null
          fly_region?: string | null
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          last_health?: string | null
          last_probe?: Json | null
          mode?: string
          name?: string
          provision_log?: Json
          provision_status?: string | null
          readiness_attempts?: number
          readiness_started_at?: string | null
          readiness_status?: string
          ready_at?: string | null
          updated_at?: string
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: []
      }
      agentic_sessions: {
        Row: {
          buyer_did: string | null
          created_at: string
          id: string
          kind: string
          payload: Json
          seller_did: string | null
          simulated: boolean
          status: string
          transcript: Json
          tx_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          buyer_did?: string | null
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          seller_did?: string | null
          simulated?: boolean
          status?: string
          transcript?: Json
          tx_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          buyer_did?: string | null
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          seller_did?: string | null
          simulated?: boolean
          status?: string
          transcript?: Json
          tx_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      compose_files: {
        Row: {
          content: string
          created_at: string
          id: string
          last_result: Json | null
          last_validated_at: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          last_result?: Json | null
          last_validated_at?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          last_result?: Json | null
          last_validated_at?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credential_records: {
        Row: {
          agent_connection_ref: string | null
          claims: Json
          connection_id: string | null
          created_at: string
          holder_did: string | null
          id: string
          invitation_url: string | null
          issuer_did: string | null
          jwt: string | null
          protocol_state: string
          record_id: string
          schema_name: string | null
          subject: string | null
          updated_at: string
          user_id: string
          verified: boolean | null
        }
        Insert: {
          agent_connection_ref?: string | null
          claims?: Json
          connection_id?: string | null
          created_at?: string
          holder_did?: string | null
          id?: string
          invitation_url?: string | null
          issuer_did?: string | null
          jwt?: string | null
          protocol_state?: string
          record_id: string
          schema_name?: string | null
          subject?: string | null
          updated_at?: string
          user_id: string
          verified?: boolean | null
        }
        Update: {
          agent_connection_ref?: string | null
          claims?: Json
          connection_id?: string | null
          created_at?: string
          holder_did?: string | null
          id?: string
          invitation_url?: string | null
          issuer_did?: string | null
          jwt?: string | null
          protocol_state?: string
          record_id?: string
          schema_name?: string | null
          subject?: string | null
          updated_at?: string
          user_id?: string
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "credential_records_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "agent_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      credential_schemas: {
        Row: {
          attributes: Json
          author_did: string | null
          connection_id: string | null
          created_at: string
          id: string
          name: string
          user_id: string
          version: string
        }
        Insert: {
          attributes?: Json
          author_did?: string | null
          connection_id?: string | null
          created_at?: string
          id?: string
          name: string
          user_id: string
          version?: string
        }
        Update: {
          attributes?: Json
          author_did?: string | null
          connection_id?: string | null
          created_at?: string
          id?: string
          name?: string
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "credential_schemas_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "agent_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      saved_dids: {
        Row: {
          alias: string | null
          connection_id: string | null
          created_at: string
          did: string
          id: string
          long_form_did: string | null
          publish_error: string | null
          purpose: string | null
          role: string
          status: string
          user_id: string
        }
        Insert: {
          alias?: string | null
          connection_id?: string | null
          created_at?: string
          did: string
          id?: string
          long_form_did?: string | null
          publish_error?: string | null
          purpose?: string | null
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          alias?: string | null
          connection_id?: string | null
          created_at?: string
          did?: string
          id?: string
          long_form_did?: string | null
          publish_error?: string | null
          purpose?: string | null
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_dids_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "agent_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      sim_connections: {
        Row: {
          connection_id: string | null
          created_at: string
          id: string
          invitation_url: string | null
          label: string
          my_did: string | null
          state: string
          their_did: string | null
          user_id: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          id?: string
          invitation_url?: string | null
          label: string
          my_did?: string | null
          state?: string
          their_did?: string | null
          user_id: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          id?: string
          invitation_url?: string | null
          label?: string
          my_did?: string | null
          state?: string
          their_did?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sim_connections_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "agent_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      sim_presentations: {
        Row: {
          connection_id: string | null
          created_at: string
          credential_record_id: string | null
          id: string
          result: string | null
          state: string
          user_id: string
          verifier_did: string | null
          zk_proof: Json | null
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          credential_record_id?: string | null
          id?: string
          result?: string | null
          state?: string
          user_id: string
          verifier_did?: string | null
          zk_proof?: Json | null
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          credential_record_id?: string | null
          id?: string
          result?: string | null
          state?: string
          user_id?: string
          verifier_did?: string | null
          zk_proof?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "sim_presentations_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "agent_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sim_presentations_credential_record_id_fkey"
            columns: ["credential_record_id"]
            isOneToOne: false
            referencedRelation: "credential_records"
            referencedColumns: ["id"]
          },
        ]
      }
      sprite_boxes: {
        Row: {
          created_at: string
          id: string
          lab_log: Json
          lab_ready: boolean
          provision_log: Json
          sdk_ready: boolean
          sprite_name: string
          status: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lab_log?: Json
          lab_ready?: boolean
          provision_log?: Json
          sdk_ready?: boolean
          sprite_name: string
          status?: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lab_log?: Json
          lab_ready?: boolean
          provision_log?: Json
          sdk_ready?: boolean
          sprite_name?: string
          status?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sprite_snippets: {
        Row: {
          code: string
          created_at: string
          id: string
          last_exit_code: number | null
          last_output: string | null
          last_run_at: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          code?: string
          created_at?: string
          id?: string
          last_exit_code?: number | null
          last_output?: string | null
          last_run_at?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          last_exit_code?: number | null
          last_output?: string | null
          last_run_at?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
