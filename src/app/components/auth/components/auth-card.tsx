"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function AuthCard() {
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Connect this to your Auth.js credentials authentication
    console.log("Form submitted");
  };

  const handleGoogle = async () => {
    await signIn("google", {
      redirectTo: "/",
    });
  };

  const handleGithub = async () => {
    await signIn("github", {
      redirectTo: "/",
    });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">
          {isSignUp ? "Create an account" : "Welcome back"}
        </CardTitle>

        <CardDescription>
          {isSignUp
            ? "Create your account to get started"
            : "Sign in to continue to Student Collab"}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              type="text"
              placeholder="Enter your username"
              required
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Enter your password"
              required
            />
          </div>

          {/* Confirm Password - only during signup */}
          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>

              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                required
              />
            </div>
          )}

          <Button type="submit" className="w-full">
            {isSignUp ? "Create account" : "Sign in"}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-muted-foreground text-sm">OR</span>
          <Separator className="flex-1" />
        </div>

        {/* Google */}
        <Button type="button" variant="outline" className="w-full" onClick={handleGoogle}>
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M21.35 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.42Z"
            />
            <path
              fill="currentColor"
              d="M12 21.8c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.29v2.53A9.74 9.74 0 0 0 12 21.8Z"
            />
            <path
              fill="currentColor"
              d="M6.54 13.88a5.86 5.86 0 0 1 0-3.76V7.59H3.29a9.77 9.77 0 0 0 0 8.82l3.25-2.53Z"
            />
            <path
              fill="currentColor"
              d="M12 6.09c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.84 3.15 14.63 2.2 12 2.2a9.74 9.74 0 0 0-8.71 5.39l3.25 2.53C7.31 7.81 9.46 6.09 12 6.09Z"
            />
          </svg>
          Continue with Google
        </Button>

        {/* GitHub */}
        <Button type="button" variant="outline" className="mt-3 w-full" onClick={handleGithub}>
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.38 7.86 10.9.58.1.79-.25.79-.55v-2.1c-3.2.7-3.87-1.55-3.87-1.55-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18A11 11 0 0 1 12 5.9c.98 0 1.97.13 2.89.38 2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.4-5.25 5.69.41.35.77 1.04.77 2.1v3.1c0 .3.21.65.8.54A9.5 9.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
          </svg>
          Continue with GitHub
        </Button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>
      </CardContent>
    </Card>
  );
}
