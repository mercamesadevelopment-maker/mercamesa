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
      actions: {
        Row: {
          id: string
          label: string
          name: string
        }
        Insert: {
          id?: string
          label: string
          name: string
        }
        Update: {
          id?: string
          label?: string
          name?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          order_id: string | null
          quantity: number
          status: Database["public"]["Enums"]["cart_item_status"]
          store_product_id: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          order_id?: string | null
          quantity: number
          status?: Database["public"]["Enums"]["cart_item_status"]
          store_product_id: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          order_id?: string | null
          quantity?: number
          status?: Database["public"]["Enums"]["cart_item_status"]
          store_product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_detail_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "cart_items_store_product_id_fkey"
            columns: ["store_product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_products: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          dane_unit_code: string | null
          dane_unit_name: string | null
          default_unit_id: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_ancestral_food: boolean
          is_medicinal_plant: boolean
          is_non_food: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          dane_unit_code?: string | null
          dane_unit_name?: string | null
          default_unit_id?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_ancestral_food?: boolean
          is_medicinal_plant?: boolean
          is_non_food?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          dane_unit_code?: string | null
          dane_unit_name?: string | null
          default_unit_id?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_ancestral_food?: boolean
          is_medicinal_plant?: boolean
          is_non_food?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_products_default_unit_id_fkey"
            columns: ["default_unit_id"]
            isOneToOne: false
            referencedRelation: "measurement_units"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          document_number: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_number: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_number?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_addresses: {
        Row: {
          address_line: string
          buyer_id: string
          created_at: string
          department: string
          id: string
          is_default: boolean
          label: string | null
          latitude: number | null
          longitude: number | null
          municipality: string
          neighborhood: string | null
        }
        Insert: {
          address_line: string
          buyer_id: string
          created_at?: string
          department?: string
          id?: string
          is_default?: boolean
          label?: string | null
          latitude?: number | null
          longitude?: number | null
          municipality?: string
          neighborhood?: string | null
        }
        Update: {
          address_line?: string
          buyer_id?: string
          created_at?: string
          department?: string
          id?: string
          is_default?: boolean
          label?: string | null
          latitude?: number | null
          longitude?: number | null
          municipality?: string
          neighborhood?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_addresses_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invitation_type: Database["public"]["Enums"]["invitation_type_enum"]
          invited_by: string | null
          marketplace_id: string | null
          role: string
          store_id: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invitation_type: Database["public"]["Enums"]["invitation_type_enum"]
          invited_by?: string | null
          marketplace_id?: string | null
          role: string
          store_id?: string | null
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invitation_type?: Database["public"]["Enums"]["invitation_type_enum"]
          invited_by?: string | null
          marketplace_id?: string | null
          role?: string
          store_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_delivery_users: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          marketplace_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          marketplace_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          marketplace_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_delivery_users_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_delivery_users_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_delivery_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_members: {
        Row: {
          created_at: string | null
          id: string
          invited_by: string | null
          marketplace_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          invited_by?: string | null
          marketplace_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          invited_by?: string | null
          marketplace_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_members_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_members_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplaces: {
        Row: {
          address: string | null
          city: string
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          department: string
          description: string | null
          id: string
          is_active: boolean
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          description?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          description?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_units: {
        Row: {
          abbreviation: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          abbreviation: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          abbreviation?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      modules: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          parent_id: string | null
          path: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          key: string
          label: string
          parent_id?: string | null
          path?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          parent_id?: string | null
          path?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "modules_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          catalog_name: string
          created_at: string
          id: string
          order_id: string
          quantity: number
          store_product_id: string
          total_price: number
          unit_name: string
          unit_price: number
        }
        Insert: {
          catalog_name: string
          created_at?: string
          id?: string
          order_id: string
          quantity: number
          store_product_id: string
          total_price: number
          unit_name: string
          unit_price: number
        }
        Update: {
          catalog_name?: string
          created_at?: string
          id?: string
          order_id?: string
          quantity?: number
          store_product_id?: string
          total_price?: number
          unit_name?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_detail_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_store_product_id_fkey"
            columns: ["store_product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_change_fee: number
          buyer_id: string
          buyer_type: Database["public"]["Enums"]["buyer_type"]
          client_idempotency_key: string | null
          created_at: string
          delivery_address_id: string | null
          delivery_fee: number
          discount: number
          id: string
          notes: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          address_change_fee?: number
          buyer_id: string
          buyer_type?: Database["public"]["Enums"]["buyer_type"]
          client_idempotency_key?: string | null
          created_at?: string
          delivery_address_id?: string | null
          delivery_fee?: number
          discount?: number
          id?: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          address_change_fee?: number
          buyer_id?: string
          buyer_type?: Database["public"]["Enums"]["buyer_type"]
          client_idempotency_key?: string | null
          created_at?: string
          delivery_address_id?: string | null
          delivery_fee?: number
          discount?: number
          id?: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "delivery_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "orders_detail_view"
            referencedColumns: ["delivery_address_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          callback_response: Json | null
          created_at: string
          id: string
          order_id: string
          payment_method: string | null
          payment_method_label: string | null
          payment_url: string | null
          provider: string
          provider_payment_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          str_id_pago: string
          updated_at: string
        }
        Insert: {
          amount: number
          callback_response?: Json | null
          created_at?: string
          id?: string
          order_id: string
          payment_method?: string | null
          payment_method_label?: string | null
          payment_url?: string | null
          provider?: string
          provider_payment_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          str_id_pago: string
          updated_at?: string
        }
        Update: {
          amount?: number
          callback_response?: Json | null
          created_at?: string
          id?: string
          order_id?: string
          payment_method?: string | null
          payment_method_label?: string | null
          payment_url?: string | null
          provider?: string
          provider_payment_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          str_id_pago?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_payments_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_payments_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_detail_view"
            referencedColumns: ["order_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          buyer_type: string | null
          created_at: string
          document_number: string | null
          document_type: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          language: Database["public"]["Enums"]["app_language"]
          phone: string | null
          reputation_score: number | null
          role_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          buyer_type?: string | null
          created_at?: string
          document_number?: string | null
          document_type?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
          language?: Database["public"]["Enums"]["app_language"]
          phone?: string | null
          reputation_score?: number | null
          role_id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          buyer_type?: string | null
          created_at?: string
          document_number?: string | null
          document_type?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          language?: Database["public"]["Enums"]["app_language"]
          phone?: string | null
          reputation_score?: number | null
          role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          action_id: string
          created_at: string
          id: string
          module_id: string
          role_id: string
          updated_at: string
        }
        Insert: {
          action_id: string
          created_at?: string
          id?: string
          module_id: string
          role_id: string
          updated_at?: string
        }
        Update: {
          action_id?: string
          created_at?: string
          id?: string
          module_id?: string
          role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          label: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          label: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          label?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_members: {
        Row: {
          created_at: string | null
          id: string
          invited_by: string | null
          role: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          invited_by?: string | null
          role: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          invited_by?: string | null
          role?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_members_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      store_offers: {
        Row: {
          created_at: string
          discount_pct: number | null
          ends_at: string | null
          id: string
          is_active: boolean
          label: string | null
          special_price: number | null
          starts_at: string
          store_product_id: string
        }
        Insert: {
          created_at?: string
          discount_pct?: number | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          special_price?: number | null
          starts_at: string
          store_product_id: string
        }
        Update: {
          created_at?: string
          discount_pct?: number | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          special_price?: number | null
          starts_at?: string
          store_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_offers_store_product_id_fkey"
            columns: ["store_product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_orders: {
        Row: {
          created_at: string
          has_refrigerated: boolean
          id: string
          notes: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          has_refrigerated?: boolean
          id?: string
          notes?: string | null
          order_id: string
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          has_refrigerated?: boolean
          id?: string
          notes?: string | null
          order_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          subtotal?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_detail_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "store_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_products: {
        Row: {
          catalog_product_id: string
          created_at: string
          id: string
          is_active: boolean
          last_price_update: string | null
          min_order_qty: number
          price_per_unit: number
          stock: number
          store_id: string
          unit_id: string
          updated_at: string
          updated_by_bot: boolean
          wholesale_min_qty: number | null
          wholesale_price: number | null
        }
        Insert: {
          catalog_product_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_price_update?: string | null
          min_order_qty?: number
          price_per_unit: number
          stock?: number
          store_id: string
          unit_id: string
          updated_at?: string
          updated_by_bot?: boolean
          wholesale_min_qty?: number | null
          wholesale_price?: number | null
        }
        Update: {
          catalog_product_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_price_update?: string | null
          min_order_qty?: number
          price_per_unit?: number
          stock?: number
          store_id?: string
          unit_id?: string
          updated_at?: string
          updated_by_bot?: boolean
          wholesale_min_qty?: number | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "store_products_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "measurement_units"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_verified: boolean
          logo_url: string | null
          marketplace_id: string
          name: string
          owner_id: string
          phone: string | null
          reputation_score: number | null
          slug: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_verified?: boolean
          logo_url?: string | null
          marketplace_id: string
          name: string
          owner_id: string
          phone?: string | null
          reputation_score?: number | null
          slug: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_verified?: boolean
          logo_url?: string | null
          marketplace_id?: string
          name?: string
          owner_id?: string
          phone?: string | null
          reputation_score?: number | null
          slug?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      marketplaces_detail: {
        Row: {
          address: string | null
          city: string | null
          cover_image_url: string | null
          created_at: string | null
          created_by: string | null
          department: string | null
          description: string | null
          id: string | null
          is_active: boolean | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string | null
          slug: string | null
          stores: Json | null
          stores_count: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders_detail_view: {
        Row: {
          address_line: string | null
          buyer_id: string | null
          created_at: string | null
          delivery_address_id: string | null
          department: string | null
          municipality: string | null
          neighborhood: string | null
          order_id: string | null
          payment_method: string | null
          payment_method_label: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          products: Json | null
          status: Database["public"]["Enums"]["order_status"] | null
          store_id: string | null
          store_name: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_permission: {
        Args: { action_name: string; module_key: string }
        Returns: boolean
      }
    }
    Enums: {
      app_language: "es" | "en"
      buyer_type: "retail" | "wholesale"
      cart_item_status: "active" | "pending"
      delivery_status:
        | "available"
        | "assigned"
        | "picked_up"
        | "in_transit"
        | "delivered"
        | "failed"
      invitation_type_enum:
        | "marketplace_member"
        | "store_member"
        | "delivery_user"
        | "admin"
      order_status:
        | "pending"
        | "confirmed"
        | "paid"
        | "packing"
        | "at_collection"
        | "dispatched"
        | "delivered"
        | "cancelled"
        | "returned"
      payment_status:
        | "pending"
        | "processing"
        | "approved"
        | "rejected"
        | "refunded"
        | "disputed"
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
      app_language: ["es", "en"],
      buyer_type: ["retail", "wholesale"],
      cart_item_status: ["active", "pending"],
      delivery_status: [
        "available",
        "assigned",
        "picked_up",
        "in_transit",
        "delivered",
        "failed",
      ],
      invitation_type_enum: [
        "marketplace_member",
        "store_member",
        "delivery_user",
        "admin",
      ],
      order_status: [
        "pending",
        "confirmed",
        "paid",
        "packing",
        "at_collection",
        "dispatched",
        "delivered",
        "cancelled",
        "returned",
      ],
      payment_status: [
        "pending",
        "processing",
        "approved",
        "rejected",
        "refunded",
        "disputed",
      ],
    },
  },
} as const
