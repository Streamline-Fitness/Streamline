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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
