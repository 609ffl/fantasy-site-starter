import dynamic from "next/dynamic";

const TradeViz = dynamic(
  () => import("../components/ThreeTeamTradeVisualizer"),
  { ssr: false }
);

export default function Page() {
  return <TradeViz />;
}
