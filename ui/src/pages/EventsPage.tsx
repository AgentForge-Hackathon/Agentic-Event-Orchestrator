import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, DollarSign, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

// ── Types ────────────────────────────────────────────────────────────────────

interface ApiEvent {
  id: string;
  name: string;
  description: string;
  category: string;
  location: { name: string; address: string; lat: number; lng: number };
  timeSlot: { start: string; end: string };
  price?: { min: number; max: number; currency: string };
  rating?: number;
  imageUrl?: string;
  sourceUrl: string;
  source: string;
  availability: 'available' | 'limited' | 'sold_out' | 'unknown';
  bookingRequired: boolean;
}

interface EventsResponse {
  events: ApiEvent[];
  total: number;
  limit: number;
  offset: number;
  cached: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat('en-SG', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Singapore',
  }).format(new Date(isoString));
}

function formatPrice(price?: ApiEvent['price']): string | null {
  if (!price) return null;
  if (price.min === 0 && price.max === 0) return 'Free';
  if (price.min === price.max) return `$${price.min} ${price.currency}`;
  return `$${price.min}–$${price.max} ${price.currency}`;
}

function capitalizeCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

const gradients = [
  'from-primary/20 to-primary/5',
  'from-secondary/20 to-secondary/5',
  'from-accent/20 to-accent/5',
  'from-muted to-muted/50',
  'from-primary/15 to-accent/5',
  'from-secondary/15 to-primary/5',
];

// ── Skeleton ──────────────────────────────────────────────────────────────────

function EventCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="h-48 bg-muted animate-pulse" />
      <CardContent className="pt-4 space-y-3">
        <div className="h-5 w-20 bg-muted animate-pulse rounded" />
        <div className="h-5 w-3/4 bg-muted animate-pulse rounded" />
        <div className="space-y-2">
          <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
          <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
        </div>
      </CardContent>
      <CardFooter>
        <div className="h-9 w-full bg-muted animate-pulse rounded" />
      </CardFooter>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function EventsPage() {
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);
      setError(null);

      const { data, error: apiError } = await apiClient.get<EventsResponse>('/events');

      if (apiError || !data) {
        setError(apiError ?? 'Failed to load events');
      } else {
        setEvents(data.events);
      }

      setLoading(false);
    }

    fetchEvents();
  }, []);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageHeader
          title="Discover Events"
          description="Find exciting events and experiences in Singapore"
        />

        {/* Error state */}
        {error && !loading && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive mb-6">
            <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Loading skeletons */}
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <EventCardSkeleton key={i} />
            ))}

          {/* Real events */}
          {!loading &&
            events.map((event, index) => {
              const priceLabel = formatPrice(event.price);
              return (
                <Card
                  key={event.id}
                  className="overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {event.imageUrl ? (
                    <img
                      src={event.imageUrl}
                      alt={event.name}
                      className="h-48 w-full object-cover object-center"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className={`h-48 bg-gradient-to-br ${gradients[index % gradients.length]}`}
                    />
                  )}
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant="outline">
                        {capitalizeCategory(event.category)}
                      </Badge>
                      {event.availability === 'limited' && (
                        <Badge variant="secondary" className="text-xs">
                          Limited spots
                        </Badge>
                      )}
                      {event.availability === 'sold_out' && (
                        <Badge variant="destructive" className="text-xs">
                          Sold out
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-lg mb-3 line-clamp-2">
                      {event.name}
                    </h3>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>{formatDate(event.timeSlot.start)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{event.location.name}</span>
                      </div>
                      {priceLabel && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>{priceLabel}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      variant="outline"
                      className="w-full"
                      asChild
                    >
                      <a
                        href={event.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View Details
                      </a>
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}

          {/* Empty state */}
          {!loading && !error && events.length === 0 && (
            <p className="col-span-full text-center text-muted-foreground py-12">
              No events found for today. Try checking back later.
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
}
