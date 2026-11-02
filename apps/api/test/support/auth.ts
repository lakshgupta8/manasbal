import { TokensService } from "../../src/auth/tokens.service.js";

// The Authorization header for a user, with an access token signed the way sign-in signs one.
export async function bearer(userId: string, role = "buyer"): Promise<{ authorization: string }> {
  const token = await new TokensService().signAccess({ id: userId, role });
  return { authorization: `Bearer ${token}` };
}
