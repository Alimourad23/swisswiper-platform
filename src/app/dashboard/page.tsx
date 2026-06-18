import { redirect } from "next/navigation";

/* The Bridge is the home of the app now. Anything landing on /dashboard
   (the TopBar wordmark, old links, the post-login default) is sent there;
   the command-center lives at /dashboard/overview, reachable from the Bridge's
   "Enter dashboard" action and the sidebar. */
export default function DashboardIndex() {
  redirect("/bridge");
}
