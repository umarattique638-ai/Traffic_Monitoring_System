// Who is logging in: saved on the session so the user can see their devices later.
export interface ClientInfo {
  userAgent: string;
  ip: string;
}

// What the controller puts in the cookies. refreshToken is null when the browser keeps the one it has.
export interface AuthTokens {
  accessToken: string;
  refreshToken: string | null;
}
