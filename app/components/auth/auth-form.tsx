import { Form, useNavigation } from "@remix-run/react";
import { motion } from "framer-motion";
import { Button, Input, FormField, Alert, Card } from "~/components/ui";

type AuthFormProps = {
  error?: string;
  redirectTo?: string;
};

export function AuthForm({ error, redirectTo }: AuthFormProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <Card className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">
              Welcome back
            </h1>
            <p className="text-zinc-400 text-sm">
              Enter your credentials to access your account
            </p>
          </div>

          <Form method="post" className="space-y-5">
            {redirectTo && (
              <input type="hidden" name="redirectTo" value={redirectTo} />
            )}

            {error && (
              <Alert variant="error">{error}</Alert>
            )}

            <FormField label="Username" htmlFor="username">
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                placeholder="Enter your username"
              />
            </FormField>

            <FormField label="Password" htmlFor="password">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="Enter your password"
              />
            </FormField>

            <Button type="submit" disabled={isSubmitting} className="w-full mt-2">
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </Form>
        </Card>
      </motion.div>
    </div>
  );
}
