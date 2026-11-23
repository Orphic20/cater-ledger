export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          name: string | null;
          contact_name: string | null;
          contact_number: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name?: string | null;
          contact_name?: string | null;
          contact_number?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string | null;
          contact_name?: string | null;
          contact_number?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      soas: {
        Row: {
          id: string;
          client_id: string | null;
          ref_no: string | null;
          agency: string | null;
          soa_date: string | null;
          due_date: string | null;
          amount: number | null;
          paid_at: string | null;
          event_name: string | null;
          event_date: string | null;
          event_end_date: string | null;
          venue: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id?: string | null;
          ref_no?: string | null;
          agency?: string | null;
          soa_date?: string | null;
          due_date?: string | null;
          amount?: number | null;
          paid_at?: string | null;
          event_name?: string | null;
          event_date?: string | null;
          event_end_date?: string | null;
          venue?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string | null;
          ref_no?: string | null;
          agency?: string | null;
          soa_date?: string | null;
          due_date?: string | null;
          amount?: number | null;
          paid_at?: string | null;
          event_name?: string | null;
          event_date?: string | null;
          event_end_date?: string | null;
          venue?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "soas_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      soa_tracker: {
        Row: {
          id: string;
          client_id: string | null;
          ref_no: string | null;
          agency: string | null;
          soa_date: string | null;
          due_date: string | null;
          amount: number | null;
          paid_at: string | null;
          event_name: string | null;
          event_date: string | null;
          event_end_date: string | null;
          venue: string | null;
          created_at: string;
          updated_at: string;
          status: "Paid" | "Unpaid" | "Overdue";
        };
        Relationships: [
          {
            foreignKeyName: "soas_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      create_soa: {
        Args: {
          p_ref_mode?: string;
          p_ref_no?: string | null;
          p_client_id?: string | null;
          p_agency?: string | null;
          p_soa_date?: string | null;
          p_due_date?: string | null;
          p_amount?: number | null;
          p_event_name?: string | null;
          p_event_date?: string | null;
          p_venue?: string | null;
        };
        Returns: Database["public"]["Tables"]["soas"]["Row"];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
