import { SignJWT, jwtVerify } from "jose";

export type UserRole = "employee" | "manager" | "hr";

export type User = {
  email: string;
  role: UserRole;
  region: string;
};

const getSecret = () => {
  const secret = process.env["JWT_SECRET"];

  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return new TextEncoder().encode(secret);
};

export async function createToken(user: User) {
  return await new SignJWT({
    email: user.email,
    role: user.role,
    region: user.region,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(getSecret());
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret());

    return payload;
  } catch {
    return null;
  }
}
