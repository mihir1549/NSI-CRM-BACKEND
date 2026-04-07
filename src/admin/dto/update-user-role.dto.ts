import { IsEnum, IsNotEmpty } from 'class-validator';

/**
 * Allowed roles that Super Admin can assign via the admin panel.
 * DISTRIBUTOR is intentionally excluded — it can only be granted via subscription payment.
 */
enum AssignableRole {
  USER = 'USER',
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
}

export class UpdateUserRoleDto {
  @IsNotEmpty()
  @IsEnum(AssignableRole, {
    message: 'Role must be one of: USER, CUSTOMER, ADMIN. Distributor role can only be granted via subscription payment.',
  })
  role: AssignableRole;
}
