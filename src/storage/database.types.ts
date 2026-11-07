export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      user_training_documents: {
        Row: {
          user_id: string;
          document: Json;
          version: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          document: Json;
          version?: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          document?: Json;
          version?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      shared_workout_plans: {
        Row: {
          id: string;
          owner_id: string;
          source_plan_id: string;
          title: string;
          description: string;
          plan_data: Json;
          is_public: boolean;
          created_at: string;
          updated_at: string;
          search_vector: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          source_plan_id: string;
          title: string;
          description?: string;
          plan_data: Json;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          source_plan_id?: string;
          title?: string;
          description?: string;
          plan_data?: Json;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      save_training_document: {
        Args: {
          p_document: Json;
          p_expected_version: number;
        };
        Returns: number;
      };
      publish_shared_workout_plan: {
        Args: {
          p_source_plan_id: string;
          p_title: string;
          p_description: string;
          p_plan_data: Json;
        };
        Returns: string;
      };
      search_shared_workout_plans: {
        Args: { p_query: string | null };
        Returns: {
          id: string;
          title: string;
          description: string;
          plan_data: Json;
          updated_at: string;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
