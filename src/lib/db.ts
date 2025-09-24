export type DbUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
};

declare global {
  var __SKILINK_DB__: Map<string, DbUser> | undefined;
}
const store = (globalThis.__SKILINK_DB__ ||= new Map<string, DbUser>());

export async function findUserByEmail(email: string) {
  return store.get(email.toLowerCase()) ?? null;
}

export async function createUser(user: DbUser) {
  const key = user.email.toLowerCase();
  if (store.has(key)) throw new Error("User already exists");
  store.set(key, user);
  return user;
}
