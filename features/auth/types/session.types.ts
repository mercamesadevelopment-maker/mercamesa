/** Lo que la interfaz sabe de quien tiene la sesión. Lo demás de su perfil lo pide cada pantalla. */
export interface BuyerProfile {
  id: string;
  role_id?: string;
  name: string;
  email: string;
  avatar: string;
}
