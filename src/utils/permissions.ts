import { User } from '../types/index.ts';

/**
 * Super Admin check:
 * The primary Super Admin is 'bossyemzee@gmail.com' or any user with role 'SUPER_ADMIN'.
 */
export function isUserSuperAdmin(user: User | null | undefined, email?: string | null): boolean {
  const targetEmail = (user?.email || email || '').trim().toLowerCase();
  if (targetEmail === 'bossyemzee@gmail.com') return true;
  return user?.role === 'SUPER_ADMIN';
}

/**
 * Admin Granted check:
 * An admin-granted user is either the Super Admin or a user who has been granted
 * the 'ADMIN' role or admin permissions ('ALL', 'ADMIN', 'ADMIN_ACCESS', 'MANAGE_USERS')
 * by the Super Admin.
 */
export function isUserAdminGranted(user: User | null | undefined, email?: string | null): boolean {
  if (!user && !email) return false;
  if (isUserSuperAdmin(user, email)) return true;
  if (user?.role === 'ADMIN') return true;

  const permissions = user?.permissions || [];
  return permissions.some(p => 
    p === 'ALL' || 
    p === 'ADMIN' || 
    p === 'ADMIN_ACCESS' || 
    p === 'MANAGE_USERS'
  );
}

/**
 * Contextual Mutation permission check:
 * Returns true if the user can perform inline additions, edits, or deletions.
 * When adminOnlyMode is active, inline mutations outside the Admin Console are disabled
 * unless the user is Super Admin in the Admin Console.
 */
export function canUserPerformMutation(
  user: User | null | undefined, 
  email?: string | null, 
  adminOnlyMode: boolean = false
): boolean {
  const isAdmin = isUserAdminGranted(user, email);
  if (!isAdmin) return false;
  // If adminOnlyMode is on, contextual inline mutations are locked to the Admin Console
  if (adminOnlyMode) return false;
  return true;
}
