// Locale-aware navigation helpers. Use these in client and server components
// in place of next/link and next/navigation so URLs always carry the active
// locale prefix.

import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter, getPathname } =
    createNavigation(routing);
