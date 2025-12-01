import { Form, Link, useNavigation } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

type AuthFormProps = {
  mode: "login" | "register";
  error?: string;
  redirectTo?: string;
};

export function AuthForm({ mode, error, redirectTo }: AuthFormProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const isLogin = mode === "login";
  const title = isLogin ? "Welcome back" : "Create an account";
  const description = isLogin
    ? "Enter your credentials to access your account"
    : "Enter your details to create your account";
  const submitText = isLogin ? "Sign in" : "Create account";
  const alternateText = isLogin
    ? "Don't have an account?"
    : "Already have an account?";
  const alternateLink = isLogin ? "/auth/register" : "/auth/login";
  const alternateLinkText = isLogin ? "Sign up" : "Sign in";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>

        <Form method="post">
          <CardContent className="space-y-4">
            {redirectTo && (
              <input type="hidden" name="redirectTo" value={redirectTo} />
            )}

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="username"
                className="text-sm font-medium text-foreground"
              >
                Username
              </label>
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                placeholder="Enter your username"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-foreground"
              >
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
                placeholder="Enter your password"
                className="h-11"
              />
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <label
                  htmlFor="confirmPassword"
                  className="text-sm font-medium text-foreground"
                >
                  Confirm Password
                </label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="Confirm your password"
                  className="h-11"
                />
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full h-11"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Please wait..." : submitText}
            </Button>

            <p className="text-sm text-muted-foreground text-center">
              {alternateText}{" "}
              <Link
                to={alternateLink}
                className="text-primary hover:underline font-medium"
              >
                {alternateLinkText}
              </Link>
            </p>
          </CardFooter>
        </Form>
      </Card>
    </div>
  );
}
