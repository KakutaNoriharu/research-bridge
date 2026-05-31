import MessagesContainer from "../_components/MessagesContainer";

export default function MessageThreadPage({
  params,
}: {
  params: { match_id: string };
}) {
  return <MessagesContainer initialMatchId={params.match_id} />;
}
