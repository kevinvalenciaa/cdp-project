export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          investigation_id: string
          occurrence_id: string
          opportunity_key: string
          result: Json | null
          run_id: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          investigation_id: string
          occurrence_id: string
          opportunity_key: string
          result?: Json | null
          run_id: string
          status: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          investigation_id?: string
          occurrence_id?: string
          opportunity_key?: string
          result?: Json | null
          run_id?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activations_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activations_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "opportunity_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activations_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "investigation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_events: {
        Row: {
          created_at: string
          event: Json
          event_dedupe_key: string
          id: number
          investigation_id: string
          message_id: string | null
          run_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          event: Json
          event_dedupe_key: string
          id?: never
          investigation_id: string
          message_id?: string | null
          run_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          event?: Json
          event_dedupe_key?: string
          id?: never
          investigation_id?: string
          message_id?: string | null
          run_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_events_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "investigation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "investigation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_messages: {
        Row: {
          citations: Json
          client_message_id: string | null
          content: string
          created_at: string
          error: string | null
          id: string
          intent: string
          investigation_id: string
          role: string
          run_id: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          citations?: Json
          client_message_id?: string | null
          content: string
          created_at?: string
          error?: string | null
          id?: string
          intent: string
          investigation_id: string
          role: string
          run_id?: string | null
          status: string
          workspace_id: string
        }
        Update: {
          citations?: Json
          client_message_id?: string | null
          content?: string
          created_at?: string
          error?: string | null
          id?: string
          intent?: string
          investigation_id?: string
          role?: string
          run_id?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_messages_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_messages_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "investigation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_runs: {
        Row: {
          assistant_message_id: string
          cancel_requested: boolean
          context: Json
          cost_usd: number | null
          error: string | null
          finished_at: string | null
          goal: string
          id: string
          input_message_id: string
          investigation_id: string
          queued_at: string
          result: Json | null
          started_at: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          assistant_message_id: string
          cancel_requested?: boolean
          context: Json
          cost_usd?: number | null
          error?: string | null
          finished_at?: string | null
          goal: string
          id?: string
          input_message_id: string
          investigation_id: string
          queued_at?: string
          result?: Json | null
          started_at?: string | null
          status: string
          workspace_id: string
        }
        Update: {
          assistant_message_id?: string
          cancel_requested?: boolean
          context?: Json
          cost_usd?: number | null
          error?: string | null
          finished_at?: string | null
          goal?: string
          id?: string
          input_message_id?: string
          investigation_id?: string
          queued_at?: string
          result?: Json | null
          started_at?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_runs_assistant_message_id_fkey"
            columns: ["assistant_message_id"]
            isOneToOne: false
            referencedRelation: "investigation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_runs_input_message_id_fkey"
            columns: ["input_message_id"]
            isOneToOne: false
            referencedRelation: "investigation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_runs_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      investigations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          last_activity_at: string
          objective: string
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          last_activity_at?: string
          objective: string
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          last_activity_at?: string
          objective?: string
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          attempts: number
          available_at: string
          created_at: string
          id: string
          investigation_id: string
          last_error: string | null
          lease_expires_at: string | null
          max_attempts: number
          message_id: string | null
          queue: string
          run_id: string | null
          status: string
          updated_at: string
          worker_id: string | null
          workspace_id: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          created_at?: string
          id?: string
          investigation_id: string
          last_error?: string | null
          lease_expires_at?: string | null
          max_attempts?: number
          message_id?: string | null
          queue: string
          run_id?: string | null
          status: string
          updated_at?: string
          worker_id?: string | null
          workspace_id: string
        }
        Update: {
          attempts?: number
          available_at?: string
          created_at?: string
          id?: string
          investigation_id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          max_attempts?: number
          message_id?: string | null
          queue?: string
          run_id?: string | null
          status?: string
          updated_at?: string
          worker_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "investigation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "investigation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_occurrences: {
        Row: {
          accepted: boolean
          id: string
          impact_monthly: number
          investigation_id: string
          opportunity: Json
          opportunity_key: string
          run_id: string
          source_investigation_title: string
          superseded_by_occurrence_id: string | null
          valid_until: string
          verdict: string
          verified_at: string
          workspace_id: string
        }
        Insert: {
          accepted: boolean
          id: string
          impact_monthly: number
          investigation_id: string
          opportunity: Json
          opportunity_key: string
          run_id: string
          source_investigation_title: string
          superseded_by_occurrence_id?: string | null
          valid_until: string
          verdict: string
          verified_at: string
          workspace_id: string
        }
        Update: {
          accepted?: boolean
          id?: string
          impact_monthly?: number
          investigation_id?: string
          opportunity?: Json
          opportunity_key?: string
          run_id?: string
          source_investigation_title?: string
          superseded_by_occurrence_id?: string | null
          valid_until?: string
          verdict?: string
          verified_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_occurrences_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_occurrences_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "investigation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_occurrences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      run_checkpoints: {
        Row: {
          checkpoint_key: string
          created_at: string
          id: string
          payload: Json
          run_id: string
          stage: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          checkpoint_key: string
          created_at?: string
          id?: string
          payload: Json
          run_id: string
          stage: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          checkpoint_key?: string
          created_at?: string
          id?: string
          payload?: Json
          run_id?: string
          stage?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_checkpoints_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "investigation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_checkpoints_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      share_snapshots: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          investigation_id: string
          revoked_at: string | null
          snapshot: Json
          token_hash: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          investigation_id: string
          revoked_at?: string | null
          snapshot: Json
          token_hash: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          investigation_id?: string
          revoked_at?: string | null
          snapshot?: Json
          token_hash?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_snapshots_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_insights: {
        Row: {
          claim: string
          confidence: number
          created_at: string
          evidence: Json
          id: string
          last_validated_at: string
          source_run_id: string | null
          subject: string
          subject_type: string
          valid_until: string
          verdict: string
          workspace_id: string
        }
        Insert: {
          claim: string
          confidence: number
          created_at?: string
          evidence?: Json
          id?: string
          last_validated_at?: string
          source_run_id?: string | null
          subject: string
          subject_type: string
          valid_until: string
          verdict: string
          workspace_id: string
        }
        Update: {
          claim?: string
          confidence?: number
          created_at?: string
          evidence?: Json
          id?: string
          last_validated_at?: string
          source_run_id?: string | null
          subject?: string
          subject_type?: string
          valid_until?: string
          verdict?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_insights_source_run_id_fkey"
            columns: ["source_run_id"]
            isOneToOne: false
            referencedRelation: "investigation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_insights_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_memberships: {
        Row: {
          created_at: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_memberships_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_opportunities: {
        Row: {
          current_occurrence_id: string
          occurrence_count: number
          opportunity_key: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          current_occurrence_id: string
          occurrence_count?: number
          opportunity_key: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          current_occurrence_id?: string
          occurrence_count?: number
          opportunity_key?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_opportunities_current_occurrence_id_fkey"
            columns: ["current_occurrence_id"]
            isOneToOne: false
            referencedRelation: "opportunity_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_opportunities_workspace_id_fkey"
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
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
