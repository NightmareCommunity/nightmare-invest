import { getMarketSentiment } from "@/lib/market";
import { json } from "@/lib/api";

export async function GET() {
  const sentiment = await getMarketSentiment();
  return json(sentiment);
}
