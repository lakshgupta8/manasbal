import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { getDb } from "../prisma/db.js";

// Lets in only users whose role is admin. It runs after DemoUserGuard, which has already put the
// user's id on the request.
@Injectable()
export class AdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ userId?: string }>();
    const user = await getDb()
      .orm.public.User.where({ id: request.userId! })
      .select("role")
      .first();
    if (user?.role !== "admin") throw new ForbiddenException("Only an admin can see this");
    return true;
  }
}
