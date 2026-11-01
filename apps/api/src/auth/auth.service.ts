import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { SignUpInput } from "@manasbal/types";
import { getDb } from "../prisma/db.js";
import { PasswordService } from "./password.service.js";

// The one answer for every sign-up that can't go ahead, so strangers can't learn which emails exist.
export const SIGN_UP_FAILED = "We could not create this account";

const FIELDS = ["id", "email", "name"] as const;

@Injectable()
export class AuthService {
  constructor(@Inject(PasswordService) private readonly passwords: Pick<PasswordService, "hash">) {}

  async signUp({ email, password, name }: SignUpInput) {
    // Hash first, so a taken email answers no faster than a free one.
    const passwordHash = await this.passwords.hash(password);
    const users = getDb().orm.public.User;
    if ((await users.where({ email }).select("id").first()) !== null) {
      throw new BadRequestException(SIGN_UP_FAILED);
    }
    try {
      // Visitor accounts are removed by the nightly reset.
      return await users.select(...FIELDS).create({
        email,
        name,
        passwordHash,
        role: "buyer",
        createdByVisitor: true,
      });
    } catch (error) {
      // Two sign-ups with the same email at once: the unique index stops the second.
      if ((await users.where({ email }).select("id").first()) !== null) {
        throw new BadRequestException(SIGN_UP_FAILED);
      }
      throw error;
    }
  }
}
