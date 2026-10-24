"use client";

import { useSession, signOut, signIn } from "@/lib/auth-client";

export default function AuthButton() {
  const { data, isPending } = useSession();
  const handleClick = function () {
    // TODO: Manage errors [signIn.social, signOut]
    if (data) signOut();
    else
      signIn.social({
        provider: "github",
        callbackURL: "/",
      });
  };

  return (
    <button disabled={isPending} onClick={handleClick}>
      {isPending ? "Cargando..." : data ? "Cerrar Sesión" : "Iniciar Sesión"}
    </button>
  );
}
