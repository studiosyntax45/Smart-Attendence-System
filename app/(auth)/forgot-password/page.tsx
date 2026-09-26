import { Link } from "react-router-dom";
import { ArrowLeft, KeyRound } from "lucide-react";
import { PageTitle } from "@/src/page-title";
import { PesLogo } from "@/components/pes-logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ForgotPasswordPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-4">
      <PageTitle title="Forgot password" />
      <div className="w-full max-w-md space-y-6">
        <PesLogo className="h-9" />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />
              Forgot your password?
            </CardTitle>
            <CardDescription>
              Passwords are reset by the college admin. No email is sent.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <section className="space-y-1">
              <h2 className="font-medium">Students</h2>
              <p className="text-muted-foreground">
                If your college has Google sign-in turned on, go back and use{" "}
                <span className="font-medium text-foreground">
                  Sign in with college Google account
                </span>{" "}
                with your @pesu.pes.edu email. Otherwise ask the admin to reset your password, as below.
              </p>
            </section>
            <section className="space-y-1 border-t pt-4">
              <h2 className="font-medium">Faculty, admins and students without Google</h2>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>Contact the Smart Attendance admin for your department.</li>
                <li>
                  They open <span className="font-medium text-foreground">Admin → Dashboard → Users &amp; roles</span>{" "}
                  and click <span className="font-medium text-foreground">Reset</span> in the Password column.
                </li>
                <li>Sign in with the temporary password they give you.</li>
              </ol>
            </section>
          </CardContent>
        </Card>
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
