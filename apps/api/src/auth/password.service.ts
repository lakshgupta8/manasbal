import { hash, verify } from "@node-rs/argon2";
import { Injectable } from "@nestjs/common";
import { ARGON2_OPTIONS } from "./argon2-options.js";

@Injectable()
export class PasswordService {
  // The result is a PHC string that carries the settings and a random salt, so equal passwords
  // never share a hash and verify() needs nothing else.
  hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password);
  }
}
