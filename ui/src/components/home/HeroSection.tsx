import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Sparkles, ArrowRight, MapPin, Calendar, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

export function HeroSection() {
  const { user } = useAuth();
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20"
        style={{
          maskImage: 'radial-gradient(ellipse at center, transparent 0%, black 100%)',
        }}
      />

      <div className="absolute top-1/4 -right-32 w-[600px] h-[600px] bg-primary/20 blur-[100px] rounded-full" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Badge variant="secondary" className="mb-4 px-4 py-1.5 text-sm">
              <Sparkles className="w-3 h-3 mr-2" aria-hidden="true" />
              AI-Powered Planning
            </Badge>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
              Your Next Event,
              <br />
              Perfectly Planned
            </h1>

            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              From date nights to group hangouts, let AI discover events, plan your schedule, and handle bookings — all matched to your style and budget.
            </p>

            <div className="flex gap-4 mt-8">
              <Link to={user ? '/plan' : '/signup'}>
                <Button size="lg">
                  Start Planning <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
              <Link to="/events">
                <Button variant="outline" size="lg">
                  Explore Events
                </Button>
              </Link>
            </div>

            <div className="flex gap-6 mt-12 text-sm text-muted-foreground">
              <div>500+ Events Discovered</div>
              <div>4.9★ Rating</div>
              <div>50+ Categories</div>
            </div>
          </div>

          <div className="hidden lg:block">
            <Card className="p-6 rotate-2 hover:rotate-0 transition-transform duration-500">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">Saturday Date Night</h3>
                  <Badge className="mt-2">AI Generated</Badge>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-primary" aria-hidden="true" />
                    <span className="text-sm">Marina Bay Sands</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-primary" aria-hidden="true" />
                    <span className="text-sm">Sat, 7:00 PM</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Compass className="w-4 h-4 text-primary" aria-hidden="true" />
                    <span className="text-sm">Dinner & Live Jazz</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
