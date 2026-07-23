import type { Role, AccessMap } from "@/lib/auth/roles";

/* Plain types shared between the admin server actions and the client UI.
   (Kept out of the "use server" file, which may only export async functions.) */

export type Person = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: string; // active | deactivated
  teamId: string | null;
  access: AccessMap; // this person's own per-module overrides
  lastSignIn: string | null;
  isSelf: boolean;
};

export type Team = { id: string; name: string; access: AccessMap };

export type OrgSettings = { brandName: string; timezone: string; workingHours: string };

export type AuditEntry = { id: string; actorName: string; action: string; detail: string | null; createdAt: string };

export type PeopleView = {
  ok: boolean;
  reason?: "not_manager" | "no_service_role";
  people: Person[];
  teams: Team[];
};
