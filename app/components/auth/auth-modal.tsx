import { Fragment } from "react";
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
import { useFetcher } from "@remix-run/react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { Button, Input, FormField, Alert } from "~/components/ui";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "login" | "register";
  onSwitchMode: () => void;
}

export function AuthModal({ isOpen, onClose, mode, onSwitchMode }: AuthModalProps) {
  const fetcher = useFetcher<{ error?: string }>();
  const isSubmitting = fetcher.state === "submitting";
  const error = fetcher.data?.error;

  const isLogin = mode === "login";
  const action = isLogin ? "/auth/login" : "/auth/register";

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Backdrop */}
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 p-8 shadow-xl transition-all">
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white transition-colors rounded-lg hover:bg-zinc-800"
                >
                  <X className="h-5 w-5" />
                </button>

                {/* Header */}
                <div className="text-center mb-8">
                  <DialogTitle className="text-2xl font-bold text-white mb-2">
                    {isLogin ? "Welcome back" : "Create an account"}
                  </DialogTitle>
                  <p className="text-zinc-400 text-sm">
                    {isLogin
                      ? "Enter your credentials to access your account"
                      : "Sign up to start tracking your portfolio"}
                  </p>
                </div>

                {/* Form */}
                <fetcher.Form method="post" action={action} className="space-y-5">
                  <input type="hidden" name="redirectTo" value="/" />

                  {error && <Alert variant="error">{error}</Alert>}

                  <FormField label="Username" htmlFor="username">
                    <Input
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      required
                      placeholder={isLogin ? "Enter your username" : "Choose a username"}
                    />
                  </FormField>

                  <FormField label="Password" htmlFor="password">
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete={isLogin ? "current-password" : "new-password"}
                      required
                      placeholder={isLogin ? "Enter your password" : "Choose a strong password"}
                    />
                  </FormField>

                  {!isLogin && (
                    <FormField label="Confirm Password" htmlFor="confirmPassword">
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        required
                        placeholder="Confirm your password"
                      />
                    </FormField>
                  )}

                  <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting
                      ? isLogin
                        ? "Signing in..."
                        : "Creating account..."
                      : isLogin
                      ? "Sign in"
                      : "Create account"}
                  </Button>
                </fetcher.Form>

                {/* Switch mode */}
                <div className="mt-6 text-center">
                  <p className="text-zinc-500 text-sm">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                    <button
                      onClick={onSwitchMode}
                      className="text-blue-400 hover:text-blue-300 font-medium"
                    >
                      {isLogin ? "Sign up" : "Sign in"}
                    </button>
                  </p>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
