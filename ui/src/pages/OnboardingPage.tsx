import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/hooks/useAuth';
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
import { Compass, ArrowLeft } from 'lucide-react';

const planningStyles = [
  'Adventure Seeker',
  'Cultural Explorer',
  'Relaxation Lover',
  'Budget-Friendly',
  'Premium Experience',
];

const budgetRanges = [
  'Budget ($0-50/day)',
  'Moderate ($50-150/day)',
  'Premium ($150-300/day)',
  'Luxury ($300+/day)',
];

const interestTags = [
  'Food & Dining',
  'Nightlife',
  'Culture & History',
  'Nature & Outdoors',
  'Art & Museums',
  'Adventure Sports',
  'Shopping',
  'Photography',
  'Wellness & Spa',
  'Music & Festivals',
  'Architecture',
  'Local Markets',
];

const dietaryOptions = [
  'No Restrictions',
  'Vegetarian',
  'Vegan',
  'Halal',
  'Kosher',
  'Gluten-Free',
  'Nut Allergy',
  'Seafood Allergy',
  'Dairy-Free',
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { markOnboarded } = useAuth();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [planningStyle, setPlanningStyle] = useState('');
  const [budgetRange, setBudgetRange] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([]);
  const [specialRequests, setSpecialRequests] = useState('');

  const handleNextStep = () => {
    if (step === 1 && name.trim()) {
      setStep(2);
    } else if (step === 2 && planningStyle && budgetRange) {
      setStep(3);
    } else if (step === 3 && selectedInterests.length > 0) {
      setStep(4);
    }
  };

  const handlePrevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else if (selectedInterests.length < 5) {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const toggleDietary = (option: string) => {
    if (dietaryPreferences.includes(option)) {
      setDietaryPreferences(dietaryPreferences.filter(d => d !== option));
    } else if (dietaryPreferences.length < 3) {
      setDietaryPreferences([...dietaryPreferences, option]);
    }
  };

  const handleComplete = async () => {
    if (selectedInterests.length === 0) return;

    setLoading(true);
    try {
      await apiClient.post('/auth/onboarding', {
        name,
        planningStyle,
        budgetRange,
        interests: selectedInterests,
        phoneNumber: phoneNumber || undefined,
        dietaryPreferences: dietaryPreferences.length > 0 ? dietaryPreferences : undefined,
        specialRequests: specialRequests || undefined,
      });

      markOnboarded();
      navigate('/plan');
    } catch (error) {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="p-1 h-auto">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <span className="text-sm text-muted-foreground">Home</span>
          </div>
          <div className="flex flex-col items-center gap-2 mb-6">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    i <= step ? 'bg-primary' : 'bg-muted'
                  }`}
                  role="presentation"
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Step {step} of 4</p>
          </div>

          {step === 1 && (
            <>
              <CardTitle className="flex items-center gap-2">
                <Compass className="h-5 w-5" aria-hidden="true" />
                What's your name?
              </CardTitle>
              <CardDescription>
                Help us personalize your event planning experience
              </CardDescription>
            </>
          )}

          {step === 2 && (
            <>
              <CardTitle>Planning Preferences</CardTitle>
              <CardDescription>
                Tell us about your planning style and budget
              </CardDescription>
            </>
          )}

          {step === 3 && (
            <>
              <CardTitle>Your Interests</CardTitle>
              <CardDescription>
                Choose up to 5 interests that match your event style
              </CardDescription>
            </>
          )}

          {step === 4 && (
            <>
              <CardTitle>Booking Info</CardTitle>
              <CardDescription>
                Optional details for automatic reservations
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent>
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="style">Planning Style</Label>
                <Select value={planningStyle} onValueChange={setPlanningStyle}>
                  <SelectTrigger id="style">
                    <SelectValue placeholder="Select your planning style" />
                  </SelectTrigger>
                  <SelectContent>
                    {planningStyles.map(style => (
                      <SelectItem key={style} value={style}>
                        {style}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget">Budget Range</Label>
                <Select value={budgetRange} onValueChange={setBudgetRange}>
                  <SelectTrigger id="budget">
                    <SelectValue placeholder="Select your budget range" />
                  </SelectTrigger>
                  <SelectContent>
                    {budgetRanges.map(range => (
                      <SelectItem key={range} value={range}>
                        {range}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {selectedInterests.length} of 5 selected
              </p>
              <div className="grid grid-cols-2 gap-2">
                {interestTags.map(tag => (
                  <Badge
                    key={tag}
                    variant={
                      selectedInterests.includes(tag) ? 'default' : 'outline'
                    }
                    className="cursor-pointer justify-center py-1.5"
                    onClick={() => toggleInterest(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number (optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="e.g. +65 9123 4567"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Dietary Preferences (optional)</Label>
                <p className="text-sm text-muted-foreground">
                  {dietaryPreferences.length} of 3 selected
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {dietaryOptions.map(option => (
                    <Badge
                      key={option}
                      variant={
                        dietaryPreferences.includes(option) ? 'default' : 'outline'
                      }
                      className="cursor-pointer justify-center py-1.5"
                      onClick={() => toggleDietary(option)}
                    >
                      {option}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="requests">Special Requests (optional)</Label>
                <textarea
                  id="requests"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="e.g. wheelchair access, birthday celebration..."
                  value={specialRequests}
                  onChange={e => setSpecialRequests(e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex gap-3 justify-between">
          <Button
            variant="outline"
            onClick={handlePrevStep}
            disabled={step === 1}
          >
            Back
          </Button>

          {step < 4 && (
            <Button onClick={handleNextStep} disabled={
              (step === 1 && !name) ||
              (step === 2 && (!planningStyle || !budgetRange)) ||
              (step === 3 && selectedInterests.length === 0)
            }>
              Continue
            </Button>
          )}

          {step === 4 && (
            <Button
              onClick={handleComplete}
              disabled={loading}
            >
              Complete Setup
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
