import { redirect } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  redirect("/?municipio=" + encodeURIComponent((await params).id));
}
