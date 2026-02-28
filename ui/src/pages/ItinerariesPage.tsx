import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, Sparkles, ArrowRight, DollarSign, CalendarDays } from 'lucide-react';
import {
  useItineraries,
  formatTime,
  formatDate,
  formatCost,
  type Itinerary,
  type ItineraryItem,
} from '@/hooks/useItineraries';

// ─── Skeleton ─────────────────────────────────────────────────────────────

function ItinerarySkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="h-4 w-48 rounded bg-muted" />
          <div className="h-5 w-16 rounded bg-muted flex-shrink-0" />
        </div>
        {/* date chip placeholders */}
        <div className="flex gap-2 mt-2">
          <div className="h-6 w-28 rounded-md bg-primary/10" />
          <div className="h-6 w-32 rounded-md bg-muted" />
        </div>
        <div className="h-3 w-24 rounded bg-muted mt-1" />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="h-10 w-full rounded bg-muted" />
        <div className="h-10 w-full rounded bg-muted" />
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export function ItinerariesPage() {
  const { data, isLoading, isError } = useItineraries();
  const itineraries = data ?? [];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageHeader
          title="My Itineraries"
          description="All your AI-generated event plans in one place."
        />

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            <ItinerarySkeleton />
            <ItinerarySkeleton />
            <ItinerarySkeleton />
          </div>
        )}

        {/* Error */}
        {!isLoading && isError && (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm text-destructive">
                Failed to load itineraries. Please try refreshing the page.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!isLoading && !isError && itineraries.length === 0 && (
          <Card>
            <CardContent className="py-16 flex flex-col items-center gap-4 text-center">
              <div className="bg-primary/10 rounded-full p-4">
                <Sparkles className="w-8 h-8 text-primary" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">No itineraries yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Plan your first event and it'll appear here.
                </p>
              </div>
              <Link to="/plan">
                <Button>
                  Plan Something{' '}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* List */}
        {!isLoading && !isError && itineraries.length > 0 && (
          <div className="space-y-6">
            {itineraries.map((itinerary) => (
              <ItineraryCard key={itinerary._id} itinerary={itinerary} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────

function ItineraryCard({ itinerary }: { itinerary: Itinerary }) {
  const cost = formatCost(itinerary.totalCost);
  const itemCount = itinerary.items.length;

  // Derive the date this plan is *for* from the first scheduled event
  const plannedForDate = itinerary.items[0]?.time.start
    ? formatDate(itinerary.items[0].time.start)
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        {/* Title + badge */}
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base font-semibold leading-snug">
            {itinerary.summary ?? 'Saved Itinerary'}
          </CardTitle>
          <Badge variant="secondary" className="flex-shrink-0">
            Saved
          </Badge>
        </div>

        {/* ── Date distinction chips ────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mt-2">
          {/* Planned FOR — accent pill: this is what the plan is about */}
          {plannedForDate && (
            <span
              className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
              title="Date the plan is scheduled for"
            >
              <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              For&nbsp;{plannedForDate}
            </span>
          )}

          {/* Created ON — muted pill: when the record was saved */}
          <span
            className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground"
            title="Date this itinerary was saved"
          >
            <Clock className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
            Created&nbsp;{formatDate(itinerary.createdAt)}
          </span>
        </div>

        {/* Count + cost — tertiary meta beneath the chips */}
        {(itemCount > 0 || cost) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
            {itemCount > 0 && (
              <span>{itemCount} {itemCount === 1 ? 'event' : 'events'}</span>
            )}
            {cost && (
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" aria-hidden="true" />
                {cost}
              </span>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {itinerary.items.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No events in this itinerary.
          </p>
        ) : (
          <div className="space-y-2">
            {itinerary.items.map((item, idx) => (
              <ItineraryItemRow key={idx} item={item} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Item row ─────────────────────────────────────────────────────────────

function ItineraryItemRow({ item }: { item: ItineraryItem }) {
  const { event, time, notes } = item;
  const timeLabel = formatTime(time.start);

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-background text-sm">
      {/* Time */}
      {timeLabel && (
        <span className="flex items-center gap-1 text-muted-foreground w-20 flex-shrink-0 pt-0.5">
          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
          {timeLabel}
        </span>
      )}

      {/* Event details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {event.url ? (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium truncate hover:underline"
            >
              {event.name}
            </a>
          ) : (
            <span className="font-medium truncate">{event.name}</span>
          )}
          {event.category && (
            <Badge variant="outline" className="text-xs flex-shrink-0 capitalize">
              {event.category}
            </Badge>
          )}
        </div>

        {/* Venue */}
        {event.venue && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <MapPin className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">{event.venue}</span>
          </div>
        )}

        {/* Notes */}
        {notes && (
          <p className="text-xs text-muted-foreground mt-1 italic">{notes}</p>
        )}
      </div>

      {/* Price */}
      {event.price && (
        <span className="text-xs text-muted-foreground flex-shrink-0 pt-0.5">
          ${event.price.min}–${event.price.max}
        </span>
      )}
    </div>
  );
}
