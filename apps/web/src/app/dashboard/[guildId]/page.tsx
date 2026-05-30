import { redirect } from 'next/navigation';

export default function GuildPage({ params }: { params: { guildId: string } }) {
  redirect(`/dashboard/${params.guildId}/now-playing`);
}
