
import { createFileRoute } from "@tanstack/react-router";
import { createToken, type User, type UserRole } from "@/lib/auth";
type DemoAccount = User & {
  password: string;
};

const getAccounts = (): DemoAccount[] => {
  return [
    {
      email: process.env["EMPLOYEE_EMAIL"] ?? "",
      password: process.env["EMPLOYEE_PASSWORD"] ?? "",
      role: "employee",
      region: process.env["EMPLOYEE_REGION"] ?? "India",
    },
    {
      email: process.env["MANAGER_EMAIL"] ?? "",
      password: process.env["MANAGER_PASSWORD"] ?? "",
      role: "manager",
      region: process.env["MANAGER_REGION"] ?? "India",
    },
    {
      email: process.env["HR_EMAIL"] ?? "",
      password: process.env["HR_PASSWORD"] ?? "",
      role: "hr",
      region: process.env["HR_REGION"] ?? "India",
    },
  ];
};

const isValidRole = (role: string): role is UserRole => {
  return role === "employee" || role === "manager" || role === "hr";
};

export const Route = createFileRoute("/api/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { email, password } = await request.json();

          if (
            typeof email !== "string" ||
            typeof password !== "string"
          ) {
            return new Response(
              JSON.stringify({ error: "Invalid login request." }),
              {
                status: 400,
                headers: { "content-type": "application/json" },
              },
            );
          }

          const accounts = getAccounts();

          const account = accounts.find(
            (candidate) =>
              candidate.email === email &&
              candidate.password === password,
          );

          if (!account || !isValidRole(account.role)) {
            return new Response(
              JSON.stringify({ error: "Invalid email or password." }),
              {
                status: 401,
                headers: { "content-type": "application/json" },
              },
            );
          }

          const user: User = {
            email: account.email,
            role: account.role,
            region: account.region,
          };

          const token = await createToken(user);

          return new Response(
            JSON.stringify({
              token,
              user: {
                email: user.email,
                role: user.role,
                region: user.region,
              },
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid request." }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            },
          );
        }
      },
    },
  },
});
