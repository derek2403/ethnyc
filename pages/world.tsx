import { useState } from "react";
import { Geist } from "next/font/google";
import WorldIdVerification from "@/components/WorldIdVerification";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

const APP_ID = process.env.NEXT_PUBLIC_WORLD_APP_ID as
  | `app_${string}`
  | undefined;
const RP_ID = process.env.NEXT_PUBLIC_RP_ID;

export default function World() {
  const [verified, setVerified] = useState(false);
  const [status, setStatus] = useState("");

  const configured = Boolean(APP_ID && RP_ID);

  return (
    <div
      className={`${geist.variable} flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black`}
    >
      <main className="flex w-full max-w-md flex-col gap-6 px-6 py-16">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            World ID
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Prove you are a unique human with a zero-knowledge World ID proof.
          </p>
        </div>

        {configured ? (
          <WorldIdVerification
            verified={verified}
            setVerified={setVerified}
            setStatus={setStatus}
            appId={APP_ID!}
            rpId={RP_ID!}
          />
        ) : (
          <div className="w-full rounded-2xl border border-yellow-300 bg-yellow-50 p-6 text-sm text-yellow-800 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-400">
            Set <code>NEXT_PUBLIC_WORLD_APP_ID</code>,{" "}
            <code>NEXT_PUBLIC_RP_ID</code> and <code>RP_SIGNING_KEY</code> in{" "}
            <code>.env.local</code> to enable World ID verification.
          </div>
        )}

        {status && (
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            {status}
          </p>
        )}

        {verified && (
          <p className="text-center text-sm font-medium text-green-600 dark:text-green-400">
            You are verified as a unique human.
          </p>
        )}
      </main>
    </div>
  );
}
