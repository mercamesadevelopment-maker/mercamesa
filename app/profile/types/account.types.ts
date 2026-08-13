export interface AccountProfile {
  full_name: string;
  phone: string | null;
  email: string;
  document_number: string | null;
  /** El tipo de persona no se edita desde el perfil: define qué identificaciones valen. */
  person_type_id: string | null;
  identification_type_id: string | null;
  person_types: { id: string; name: string; requires_business_name: boolean } | null;
  identification_types: { id: string; name: string; code: string } | null;
  avatar_url: string | null;
  avatarSignedUrl: string | null;
}
