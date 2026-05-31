import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // 1. Login → get JWT
        const loginRes = await fetch(`${BACKEND}/api/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        });
        if (!loginRes.ok) return null;
        const { access_token } = await loginRes.json() as { access_token: string };

        // 2. Fetch current user to get id + role
        const meRes = await fetch(`${BACKEND}/api/v1/users/me`, {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        if (!meRes.ok) return null;
        const me = await meRes.json() as { id: string; email: string; role: string };

        return {
          id: me.id,
          email: me.email,
          role: me.role,
          accessToken: access_token,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = user.accessToken;
        token.userId = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.user.id = token.userId;
      session.user.role = token.role;
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
  },
};
