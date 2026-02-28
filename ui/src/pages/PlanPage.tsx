import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { apiClient } from '@/lib/apiClient';
import { TraceViewer } from '@/components/trace/TraceViewer';
import { Layout } from '@/components/layout/Layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Heart, Wallet, MapPin, Sparkles, ArrowLeft, Activity } from 'lucide-react';

const TOTAL_STEPS = 4;

const occasions = [
  { value: 'date_night', label: '❤️ Date Night' },
  { value: 'friends_day_out', label: '👯 Friends Day Out' },
  { value: 'family_outing', label: '👨‍👩‍👧‍👦 Family Outing' },
  { value: 'solo_adventure', label: '🎒 Solo Adventure' },
  { value: 'celebration', label: '🎉 Celebration' },
  { value: 'chill_hangout', label: '☕ Chill Hangout' },
] as const;

const budgetOptions = [
  { value: 'free', label: 'Free ($0)' },
  { value: 'under_30', label: 'Under $30/person' },
  { value: '30_to_80', label: '$30–80/person' },
  { value: '80_to_150', label: '$80–150/person' },
  { value: '150_plus', label: '$150+/person' },
] as const;

const timeOfDayOptions = [
  { value: 'morning', label: '🌅 Morning' },
  { value: 'afternoon', label: '☀️ Afternoon' },
  { value: 'evening', label: '🌇 Evening' },
  { value: 'night', label: '🌙 Night' },
  { value: 'flexible', label: '🤷 Flexible' },
] as const;

const durationOptions = [
  { value: '2_3_hours', label: '2–3 Hours' },
  { value: 'half_day', label: 'Half Day' },
  { value: 'full_day', label: 'Full Day' },
] as const;

const areaOptions = [
  'Anywhere',
  'CBD / Marina Bay',
  'Orchard / Somerset',
  'Chinatown / Tanjong Pagar',
  'Bugis / Kampong Glam',
  'Sentosa',
  'Holland Village / Dempsey',
  'East Coast',
  'Tiong Bahru',
  'Little India',
  'Clarke Quay / Boat Quay',
  'Jurong / West',
  'Woodlands / North',
];

type Occasion = (typeof occasions)[number]['value'];
type BudgetRange = (typeof budgetOptions)[number]['value'];
type TimeOfDay = (typeof timeOfDayOptions)[number]['value'];
type Duration = (typeof durationOptions)[number]['value'];

export function PlanPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [workflowId, setWorkflowId] = useState<string | null>(null);

  const [occasion, setOccasion] = useState<Occasion | ''>('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const [budgetRange, setBudgetRange] = useState<BudgetRange | ''>('');
  const [partySize, setPartySize] = useState<number>(2);
  const [customPartySize, setCustomPartySize] = useState(false);
  const [preferFreeEvents, setPreferFreeEvents] = useState(false);

  const [date, setDate] = useState('');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay | ''>('');
  const [duration, setDuration] = useState<Duration | ''>('');
  const [areas, setAreas] = useState<string[]>([]);

  const today = new Date().toISOString().split('T')[0];

  const canProceed = (): boolean => {
    switch (step) {
      case 1: return occasion !== '';
      case 2: return budgetRange !== '' && partySize >= 1;
      case 3: return date !== '' && timeOfDay !== '' && duration !== '' && areas.length > 0;
      case 4: return true;
      default: return false;
    }
  };

  const handleNextStep = () => {
    if (step < TOTAL_STEPS && canProceed()) setStep(step + 1);
  };

  const handlePrevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const toggleArea = (area: string) => {
    if (area === 'Anywhere') {
      setAreas(areas.includes('Anywhere') ? [] : ['Anywhere']);
      return;
    }
    const without = areas.filter(a => a !== 'Anywhere');
    if (without.includes(area)) {
      setAreas(without.filter(a => a !== area));
    } else {
      setAreas([...without, area]);
    }
  };

  const handlePartySizeSelect = (size: number | 'custom') => {
    if (size === 'custom') {
      setCustomPartySize(true);
      setPartySize(7);
    } else {
      setCustomPartySize(false);
      setPartySize(size);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);

    const formData = {
      occasion,
      additionalNotes,
      budgetRange,
      partySize,
      date,
      timeOfDay,
      duration,
      areas: areas.includes('Anywhere') ? ['anywhere'] : areas,
      preferFreeEvents,
    };

    const response = await apiClient.post<{ workflowId: string; phase: string }>('/workflow', formData);

    if (response.error) {
      toast.error(response.error);
      setLoading(false);
      return;
    }

    if (response.data?.workflowId) {
      setWorkflowId(response.data.workflowId);
    }
    setLoading(false);
  };

  const stepIcons = [Heart, Wallet, MapPin, Sparkles];
  const stepTitles = [
    "What's the occasion?",
    'Budget & Party Size',
    'When & Where',
    'Review & Go',
  ];
  const stepDescriptions = [
    'Tell us what you\'re planning',
    'Set your budget and group size',
    'Pick your preferred date, time, and areas',
    'Confirm your plan details and let the agents work',
  ];

  const StepIcon = stepIcons[step - 1];

  const occasionLabel = occasions.find(o => o.value === occasion)?.label ?? '';
  const budgetLabel = budgetOptions.find(b => b.value === budgetRange)?.label ?? '';
  const timeLabel = timeOfDayOptions.find(t => t.value === timeOfDay)?.label ?? '';
  const durationLabel = durationOptions.find(d => d.value === duration)?.label ?? '';

  if (workflowId) {
    return (
      <Layout>
        <div className="h-[calc(100dvh-4rem)] flex items-center justify-center px-4 py-6 overflow-hidden">
          <Card className="w-full max-w-xl h-full max-h-[calc(100dvh-7rem)] flex flex-col">
            <CardHeader className="shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setWorkflowId(null);
                    setStep(1);
                  }}
                  className="p-1 h-auto"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <span className="text-sm text-muted-foreground">Back to Planning</span>
              </div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" aria-hidden="true" />
                Crafting Your Itinerary
              </CardTitle>
              <CardDescription>Sit back while we find the best events and build your perfect plan</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-hidden">
              <TraceViewer workflowId={workflowId} onComplete={() => navigate('/itineraries')} />
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="sm" onClick={() => navigate('/events')} className="p-1 h-auto">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <span className="text-sm text-muted-foreground">Back to Events</span>
            </div>

            <div className="flex flex-col items-center gap-2 mb-6">
              <div className="flex justify-center gap-2">
                {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(i => (
                  <div
                    key={i}
                    className={`h-2 w-2 rounded-full transition-colors ${
                      i <= step ? 'bg-primary' : 'bg-muted'
                    }`}
                    role="presentation"
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Step {step} of {TOTAL_STEPS}</p>
            </div>

            <CardTitle className="flex items-center gap-2">
              <StepIcon className="h-5 w-5" aria-hidden="true" />
              {stepTitles[step - 1]}
            </CardTitle>
            <CardDescription>{stepDescriptions[step - 1]}</CardDescription>
          </CardHeader>

          <CardContent className="min-h-[420px] max-h-[420px] overflow-y-auto">
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {occasions.map(o => (
                    <Badge
                      key={o.value}
                      variant={occasion === o.value ? 'default' : 'outline'}
                      className="cursor-pointer justify-center py-2 text-sm"
                      onClick={() => setOccasion(o.value)}
                    >
                      {o.label}
                    </Badge>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Additional notes (optional)</Label>
                  <Input
                    id="notes"
                    placeholder="e.g., we love live music and spicy food"
                    value={additionalNotes}
                    onChange={e => setAdditionalNotes(e.target.value)}
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="budget">Budget per person</Label>
                  <Select value={budgetRange} onValueChange={(v) => setBudgetRange(v as BudgetRange)}>
                    <SelectTrigger id="budget">
                      <SelectValue placeholder="Select your budget" />
                    </SelectTrigger>
                    <SelectContent>
                      {budgetOptions.map(b => (
                        <SelectItem key={b.value} value={b.value}>
                          {b.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Party size</Label>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5, 6].map(n => (
                      <Badge
                        key={n}
                        variant={!customPartySize && partySize === n ? 'default' : 'outline'}
                        className="cursor-pointer px-3 py-1.5"
                        onClick={() => handlePartySizeSelect(n)}
                      >
                        {n}
                      </Badge>
                    ))}
                    <Badge
                      variant={customPartySize ? 'default' : 'outline'}
                      className="cursor-pointer px-3 py-1.5"
                      onClick={() => handlePartySizeSelect('custom')}
                    >
                      7+
                    </Badge>
                  </div>
                  {customPartySize && (
                    <Input
                      type="number"
                      min={7}
                      max={10}
                      value={partySize}
                      onChange={e => {
                        const v = parseInt(e.target.value, 10);
                        if (v >= 1 && v <= 10) setPartySize(v);
                      }}
                      className="w-24 mt-2"
                    />
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    id="prefer-free"
                    checked={preferFreeEvents}
                    onCheckedChange={(checked) => setPreferFreeEvents(checked === true)}
                  />
                  <Label htmlFor="prefer-free" className="text-sm font-normal cursor-pointer">
                    Prioritise free events
                  </Label>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    min={today}
                    value={date}
                    onChange={e => setDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Time of day</Label>
                  <div className="flex flex-wrap gap-2">
                    {timeOfDayOptions.map(t => (
                      <Badge
                        key={t.value}
                        variant={timeOfDay === t.value ? 'default' : 'outline'}
                        className="cursor-pointer py-1.5"
                        onClick={() => setTimeOfDay(t.value)}
                      >
                        {t.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Duration</Label>
                  <div className="flex flex-wrap gap-2">
                    {durationOptions.map(d => (
                      <Badge
                        key={d.value}
                        variant={duration === d.value ? 'default' : 'outline'}
                        className="cursor-pointer py-1.5"
                        onClick={() => setDuration(d.value)}
                      >
                        {d.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Areas in Singapore</Label>
                  <p className="text-xs text-muted-foreground">
                    {areas.length} selected
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {areaOptions.map(area => (
                      <Badge
                        key={area}
                        variant={areas.includes(area) ? 'default' : 'outline'}
                        className="cursor-pointer justify-center py-1.5 text-xs"
                        onClick={() => toggleArea(area)}
                      >
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <SummaryRow label="Occasion" value={occasionLabel} />
                {additionalNotes && <SummaryRow label="Notes" value={additionalNotes} />}
                <SummaryRow label="Budget" value={budgetLabel} />
                <SummaryRow label="Party size" value={`${partySize} ${partySize === 1 ? 'person' : 'people'}`} />
                <SummaryRow label="Date" value={date} />
                <SummaryRow label="Time" value={timeLabel} />
                <SummaryRow label="Duration" value={durationLabel} />
                <SummaryRow label="Areas" value={areas.join(', ')} />
                {preferFreeEvents && <SummaryRow label="Free events" value="Prioritised" />}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={handlePrevStep}
              >
                Back
              </Button>
            )}

            <div className="ml-auto">
              {step < TOTAL_STEPS && (
                <Button onClick={handleNextStep} disabled={!canProceed()}>
                  Continue
                </Button>
              )}

              {step === TOTAL_STEPS && (
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Planning...' : 'Start Planning'}
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
      </div>
    </Layout>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}
