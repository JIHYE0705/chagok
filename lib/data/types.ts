
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "access_allowlist": {
                  Row: {
                    "created_at": string,"google_subject": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"google_subject": string
                  }
                  Update: {
                    "created_at"?: string,"google_subject"?: string
                  }
                  Relationships: [
                    
                  ]
                },"attachments": {
                  Row: {
                    "created_at": string,"id": string,"item_id": string,"mime_type": string,"size_bytes": number,"status": string,"storage_path": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"item_id": string,"mime_type": string,"size_bytes": number,"status"?: string,"storage_path": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"item_id"?: string,"mime_type"?: string,"size_bytes"?: number,"status"?: string,"storage_path"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attachments_item_id_user_id_fkey"
      columns: ["item_id","user_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"ingredients": {
                  Row: {
                    "evidence_id": string | null,"id": string,"item_id": string,"name": string,"position": number,"quantity_text": string | null,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "evidence_id"?: string | null,"id"?: string,"item_id": string,"name": string,"position": number,"quantity_text"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Update: {
                    "evidence_id"?: string | null,"id"?: string,"item_id"?: string,"name"?: string,"position"?: number,"quantity_text"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ingredients_evidence_id_item_id_user_id_fkey"
      columns: ["evidence_id","item_id","user_id"]
isOneToOne: false
      referencedRelation: "source_evidence"
      referencedColumns: ["id","item_id","user_id"]
    },{
      foreignKeyName: "ingredients_item_id_user_id_fkey"
      columns: ["item_id","user_id"]
isOneToOne: false
      referencedRelation: "recipe_details"
      referencedColumns: ["item_id","user_id"]
    }
                  ]
                },"item_contents": {
                  Row: {
                    "body": string,"item_id": string,"raw_text": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string,"item_id": string,"raw_text"?: string,"user_id"?: string
                  }
                  Update: {
                    "body"?: string,"item_id"?: string,"raw_text"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_contents_item_id_user_id_fkey"
      columns: ["item_id","user_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"item_tags": {
                  Row: {
                    "item_id": string,"tag_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "item_id": string,"tag_id": string,"user_id"?: string
                  }
                  Update: {
                    "item_id"?: string,"tag_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_tags_item_id_user_id_fkey"
      columns: ["item_id","user_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "item_tags_tag_id_user_id_fkey"
      columns: ["tag_id","user_id"]
isOneToOne: false
      referencedRelation: "tags"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"items": {
                  Row: {
                    "created_at": string,"favorite": boolean,"id": string,"notes": string,"schema_version": number,"summary": string,"title": string,"type": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"favorite"?: boolean,"id"?: string,"notes"?: string,"schema_version"?: number,"summary"?: string,"title": string,"type"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"favorite"?: boolean,"id"?: string,"notes"?: string,"schema_version"?: number,"summary"?: string,"title"?: string,"type"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"processing_jobs": {
                  Row: {
                    "created_at": string,"error_code": string | null,"id": string,"idempotency_key": string,"item_id": string,"kind": string,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"error_code"?: string | null,"id"?: string,"idempotency_key": string,"item_id": string,"kind": string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"error_code"?: string | null,"id"?: string,"idempotency_key"?: string,"item_id"?: string,"kind"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "processing_jobs_item_id_user_id_fkey"
      columns: ["item_id","user_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"id": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string,"id": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"id"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"recipe_details": {
                  Row: {
                    "cook_time_text": string | null,"item_id": string,"prep_time_text": string | null,"servings_text": string | null,"temperature_text": string | null,"tips": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cook_time_text"?: string | null,"item_id": string,"prep_time_text"?: string | null,"servings_text"?: string | null,"temperature_text"?: string | null,"tips"?: string,"user_id"?: string
                  }
                  Update: {
                    "cook_time_text"?: string | null,"item_id"?: string,"prep_time_text"?: string | null,"servings_text"?: string | null,"temperature_text"?: string | null,"tips"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_details_item_id_user_id_fkey"
      columns: ["item_id","user_id"]
isOneToOne: true
      referencedRelation: "items"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"recipe_steps": {
                  Row: {
                    "evidence_id": string | null,"id": string,"instruction": string,"item_id": string,"position": number,"temperature_text": string | null,"time_text": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "evidence_id"?: string | null,"id"?: string,"instruction": string,"item_id": string,"position": number,"temperature_text"?: string | null,"time_text"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "evidence_id"?: string | null,"id"?: string,"instruction"?: string,"item_id"?: string,"position"?: number,"temperature_text"?: string | null,"time_text"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_steps_evidence_id_item_id_user_id_fkey"
      columns: ["evidence_id","item_id","user_id"]
isOneToOne: false
      referencedRelation: "source_evidence"
      referencedColumns: ["id","item_id","user_id"]
    },{
      foreignKeyName: "recipe_steps_item_id_user_id_fkey"
      columns: ["item_id","user_id"]
isOneToOne: false
      referencedRelation: "recipe_details"
      referencedColumns: ["item_id","user_id"]
    }
                  ]
                },"source_evidence": {
                  Row: {
                    "excerpt": string | null,"field": string,"id": string,"item_id": string,"location": string | null,"source_id": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "excerpt"?: string | null,"field": string,"id"?: string,"item_id": string,"location"?: string | null,"source_id": string,"status": string,"user_id"?: string
                  }
                  Update: {
                    "excerpt"?: string | null,"field"?: string,"id"?: string,"item_id"?: string,"location"?: string | null,"source_id"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "source_evidence_source_id_item_id_user_id_fkey"
      columns: ["source_id","item_id","user_id"]
isOneToOne: false
      referencedRelation: "sources"
      referencedColumns: ["id","item_id","user_id"]
    }
                  ]
                },"sources": {
                  Row: {
                    "author": string | null,"collection_method": string,"created_at": string,"id": string,"item_id": string,"kind": string,"platform": string | null,"url": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author"?: string | null,"collection_method": string,"created_at"?: string,"id"?: string,"item_id": string,"kind": string,"platform"?: string | null,"url"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "author"?: string | null,"collection_method"?: string,"created_at"?: string,"id"?: string,"item_id"?: string,"kind"?: string,"platform"?: string | null,"url"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sources_item_id_user_id_fkey"
      columns: ["item_id","user_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"tags": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
