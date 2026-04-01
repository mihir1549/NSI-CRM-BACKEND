import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JwtAuthGuard — validates the access token from the Authorization Bearer header.
 * After validation, the decoded JWT payload is attached to request.user.
 *
 * IMPORTANT: The JWT payload is a ROUTING HINT only.
 * Any guard that makes authorization decisions MUST re-fetch the user from the database.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
