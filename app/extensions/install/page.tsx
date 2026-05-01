import { redirect } from "next/navigation";

export default function ExtensionInstallPage() {
  redirect("/extensions/connect");
}
