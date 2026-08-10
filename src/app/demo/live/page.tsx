import { redirect } from "next/navigation";

/** The simulator moved up to /demo — this old URL follows it. */
export default function LiveRedirect() {
  redirect("/demo");
}
