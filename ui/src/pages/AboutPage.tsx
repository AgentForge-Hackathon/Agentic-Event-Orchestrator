import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

export function AboutPage() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageHeader
          title="About Planly"
          description="Your AI-powered event planning companion"
        />

        <Card>
          <CardContent className="pt-6 space-y-6">
            <p className="text-lg leading-relaxed">
              Planly is an AI-powered event planner that discovers activities, builds personalized itineraries, and handles bookings — all tailored to your preferences, budget, and interests.
            </p>

            <p className="text-lg leading-relaxed">
              Our intelligent planning system searches thousands of events, restaurants, and experiences across Singapore to craft the perfect plan for every occasion.
            </p>

            <p className="text-lg leading-relaxed">
              Whether you're planning a date night, a friends day out, or a celebration, Planly helps you discover hidden gems, optimize your schedule, and make the most of every moment.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
