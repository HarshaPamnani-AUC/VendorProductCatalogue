// Price Intelligence has been merged into Product Insights.
// Redirect anyone hitting this old URL.
import { redirect } from 'next/navigation';

export default function PriceIntelligenceRedirect() {
  redirect('/dashboard/update/history');
}
