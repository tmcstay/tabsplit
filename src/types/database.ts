export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type SplitStatus = 'pending' | 'draft' | 'finalised'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          phone: string | null
          display_name: string | null
          created_at: string
        }
        Insert: {
          id: string
          phone?: string | null
          display_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          phone?: string | null
          display_name?: string | null
          created_at?: string
        }
      }
      groups: {
        Row: {
          id: string
          organiser_id: string
          name: string
          saved: boolean
          created_at: string
        }
        Insert: {
          id?: string
          organiser_id: string
          name: string
          saved?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          organiser_id?: string
          name?: string
          saved?: boolean
          created_at?: string
        }
      }
      group_members: {
        Row: {
          id: string
          group_id: string
          display_name: string
          phone: string | null
          email: string | null
          user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          display_name: string
          phone?: string | null
          email?: string | null
          user_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          display_name?: string
          phone?: string | null
          email?: string | null
          user_id?: string | null
          created_at?: string
        }
      }
      splits: {
        Row: {
          id: string
          organiser_id: string
          group_id: string | null
          title: string
          receipt_url: string | null
          total: number | null
          status: SplitStatus
          created_at: string
        }
        Insert: {
          id?: string
          organiser_id: string
          group_id?: string | null
          title: string
          receipt_url?: string | null
          total?: number | null
          status?: SplitStatus
          created_at?: string
        }
        Update: {
          id?: string
          organiser_id?: string
          group_id?: string | null
          title?: string
          receipt_url?: string | null
          total?: number | null
          status?: SplitStatus
          created_at?: string
        }
      }
      attendee_groups: {
        Row: {
          id: string
          split_id: string
          label: string
          created_at: string
        }
        Insert: {
          id?: string
          split_id: string
          label: string
          created_at?: string
        }
        Update: {
          id?: string
          split_id?: string
          label?: string
          created_at?: string
        }
      }
      attendees: {
        Row: {
          id: string
          split_id: string
          user_id: string | null
          display_name: string
          phone: string | null
          email: string | null
          group_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          split_id: string
          user_id?: string | null
          display_name: string
          phone?: string | null
          email?: string | null
          group_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          split_id?: string
          user_id?: string | null
          display_name?: string
          phone?: string | null
          email?: string | null
          group_id?: string | null
          created_at?: string
        }
      }
      items: {
        Row: {
          id: string
          split_id: string
          description: string
          price: number
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          split_id: string
          description: string
          price: number
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          split_id?: string
          description?: string
          price?: number
          sort_order?: number
          created_at?: string
        }
      }
      item_assignments: {
        Row: {
          id: string
          item_id: string
          attendee_id: string
          created_at: string
        }
        Insert: {
          id?: string
          item_id: string
          attendee_id: string
          created_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          attendee_id?: string
          created_at?: string
        }
      }
      share_links: {
        Row: {
          id: string
          split_id: string
          token: string
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          split_id: string
          token?: string
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          split_id?: string
          token?: string
          expires_at?: string | null
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      split_status: SplitStatus
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
