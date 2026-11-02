import { Injectable, UnauthorizedException } from "@nestjs/common";
import { getDb } from "../prisma/db.js";

@Injectable()
export class MeService {
  async get(userId: string) {
    const me = await getDb()
      .orm.public.User.where({ id: userId })
      .select("id", "name", "email", "role")
      .first();
    // A token can outlive its account: the nightly reset deletes every user.
    if (me === null) throw new UnauthorizedException("Sign in again");
    return me;
  }
}
