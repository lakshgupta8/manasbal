import { Injectable, UnauthorizedException } from "@nestjs/common";
import { getDb } from "../prisma/db.js";

@Injectable()
export class MeService {
  async get(userId: string) {
    const user = await getDb()
      .orm.public.User.where({ id: userId })
      .select("id", "name", "email", "role", "totpEnabledAt")
      .first();
    // A token can outlive its account: the nightly reset deletes every user.
    if (user === null) throw new UnauthorizedException("Sign in again");
    const { totpEnabledAt, ...me } = user;
    // Only whether two-step sign-in is on: never the secret or when it was switched on.
    return { ...me, twoStep: totpEnabledAt !== null };
  }
}
