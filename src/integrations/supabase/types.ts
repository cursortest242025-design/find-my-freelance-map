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
      favorites: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_items: {
        Row: {
          category: string
          client_name: string
          completion_year: number | null
          created_at: string
          description: string
          id: string
          image_url: string
          image_urls: string[]
          profile_id: string
          project_url: string
          results: string
          sort_order: number
          title: string
          tools: string[]
          updated_at: string
        }
        Insert: {
          category?: string
          client_name?: string
          completion_year?: number | null
          created_at?: string
          description?: string
          id?: string
          image_url: string
          image_urls?: string[]
          profile_id: string
          project_url?: string
          results?: string
          sort_order?: number
          title: string
          tools?: string[]
          updated_at?: string
        }
        Update: {
          category?: string
          client_name?: string
          completion_year?: number | null
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          image_urls?: string[]
          profile_id?: string
          project_url?: string
          results?: string
          sort_order?: number
          title?: string
          tools?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_items_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_comments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_reactions: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "profile_reactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string
          avatar_url: string | null
          bio: string
          contact_email: string
          country: string
          created_at: string
          currency: string
          full_name: string
          github_repos: string[]
          headline: string
          id: string
          instagram_url: string
          is_available: boolean
          is_listed: boolean
          latitude: number | null
          linkedin_url: string
          location_name: string
          longitude: number | null
          services: string[]
          show_address: boolean
          starting_price: number | null
          tags: string[]
          telegram_id: string
          updated_at: string
          username: string
          whatsapp_number: string
        }
        Insert: {
          address?: string
          avatar_url?: string | null
          bio?: string
          contact_email?: string
          country?: string
          created_at?: string
          currency?: string
          full_name?: string
          github_repos?: string[]
          headline?: string
          id: string
          instagram_url?: string
          is_available?: boolean
          is_listed?: boolean
          latitude?: number | null
          linkedin_url?: string
          location_name?: string
          longitude?: number | null
          services?: string[]
          show_address?: boolean
          starting_price?: number | null
          tags?: string[]
          telegram_id?: string
          updated_at?: string
          username: string
          whatsapp_number?: string
        }
        Update: {
          address?: string
          avatar_url?: string | null
          bio?: string
          contact_email?: string
          country?: string
          created_at?: string
          currency?: string
          full_name?: string
          github_repos?: string[]
          headline?: string
          id?: string
          instagram_url?: string
          is_available?: boolean
          is_listed?: boolean
          latitude?: number | null
          linkedin_url?: string
          location_name?: string
          longitude?: number | null
          services?: string[]
          show_address?: boolean
          starting_price?: number | null
          tags?: string[]
          telegram_id?: string
          updated_at?: string
          username?: string
          whatsapp_number?: string
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
    Enums: {},
  },
} as const
