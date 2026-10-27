import { redirect } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  redirect("/?obra=" + encodeURIComponent((await params).id));
}
